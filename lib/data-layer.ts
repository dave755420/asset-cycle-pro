/**
 * DATA LAYER v3 — Asset Cycle Pro
 *
 * 가격 수집 전략 (Vercel 서버 Yahoo Finance v7 차단 문제 해결):
 *  1. 개별 심볼마다 v8/finance/chart API 사용 (가장 안정적)
 *  2. USD/KRW → Frankfurter (ECB 기준, 100% 무료·안정)
 *  3. 전부 실패 시 현실적 fallback 가격 반환
 */

import { ASSET_IDS, ASSET_META, PERIOD_RANGE_MAP } from './constants';
import type { AssetId, AssetQuote, PricePoint, Period } from './types';

// ─── In-memory cache ─────────────────────────────────────────────────────────
interface CacheEntry<T> { data: T; expiresAt: number; }
class DataCache {
  private store = new Map<string, CacheEntry<unknown>>();
  get<T>(key: string): T | null {
    const e = this.store.get(key);
    if (!e) return null;
    if (Date.now() > e.expiresAt) { this.store.delete(key); return null; }
    return e.data as T;
  }
  set<T>(key: string, data: T, ttlMs: number) {
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs });
  }
}
const historyCache = new DataCache();
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ─── fetch helper ─────────────────────────────────────────────────────────────
async function safeFetch(url: string, retries = 2): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (res.ok) return res;
      if ((res.status === 429 || res.status >= 500) && i < retries) {
        await sleep(800 * (i + 1));
        continue;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (i === retries) throw err;
      await sleep(800 * (i + 1));
    }
  }
  throw new Error('fetch 실패');
}

// ─── 개별 심볼 현재가 (v8 chart — Vercel에서 가장 안정적) ─────────────────────
async function fetchQuoteByChart(symbol: string): Promise<{ price: number; prevClose: number } | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  try {
    const res = await safeFetch(url);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as any;
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price: number = meta.regularMarketPrice ?? meta.previousClose ?? 0;
    const prevClose: number = meta.chartPreviousClose ?? meta.previousClose ?? price;
    if (!price) return null;
    return { price, prevClose };
  } catch {
    return null;
  }
}

// ─── USD/KRW: Frankfurter → Yahoo 순서 ────────────────────────────────────────
async function fetchUSDKRW(): Promise<{ price: number; prevClose: number; src: 'yahoo' | 'backup' | 'fallback' }> {
  // 1순위: Frankfurter (ECB — 항상 동작)
  try {
    const res = await safeFetch('https://api.frankfurter.app/latest?from=USD&to=KRW');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as any;
    const price = json?.rates?.KRW as number | undefined;
    if (price && price > 900 && price < 2000) {
      let prevClose = price;
      try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().slice(0, 10);
        const res2 = await safeFetch(`https://api.frankfurter.app/${yStr}?from=USD&to=KRW`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const j2 = await res2.json() as any;
        prevClose = j2?.rates?.KRW ?? price;
      } catch { /* 무시 */ }
      return { price, prevClose, src: 'backup' };
    }
  } catch { /* fallthrough */ }

  // 2순위: Yahoo Finance
  const yResult = await fetchQuoteByChart('USDKRW=X');
  if (yResult && yResult.price > 900 && yResult.price < 2000) {
    return { ...yResult, src: 'yahoo' };
  }

  return { price: 1460, prevClose: 1458, src: 'fallback' };
}

// ─── 전체 실시간 시세 ─────────────────────────────────────────────────────────
export async function fetchLiveQuotes(): Promise<AssetQuote[]> {
  return Promise.all(
    ASSET_IDS.map(async (id): Promise<AssetQuote> => {
      const meta = ASSET_META[id];
      const now = new Date().toISOString();

      if (id === 'USDKRW') {
        const r = await fetchUSDKRW();
        const change = r.price - r.prevClose;
        const changePct = r.prevClose ? (change / r.prevClose) * 100 : 0;
        return { id, price: r.price, prevClose: r.prevClose, change, changePct, updatedAt: now, source: r.src, isStale: r.src === 'fallback' };
      }

      const r = await fetchQuoteByChart(meta.symbol);
      if (r && r.price > 0) {
        const change = r.price - r.prevClose;
        const changePct = r.prevClose ? (change / r.prevClose) * 100 : 0;
        return { id, price: r.price, prevClose: r.prevClose, change, changePct, updatedAt: now, source: 'yahoo', isStale: false };
      }
      return buildFallbackQuote(id);
    })
  );
}

// ─── 일봉 히스토리 ────────────────────────────────────────────────────────────
export async function fetchAssetHistory(id: AssetId, period: Period): Promise<PricePoint[]> {
  const cacheKey = `history-${id}-${period}`;
  const cached = historyCache.get<PricePoint[]>(cacheKey);
  if (cached) return cached;

  const meta = ASSET_META[id];
  const range = PERIOD_RANGE_MAP[period];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(meta.symbol)}?interval=1d&range=${range}`;

  try {
    const res = await safeFetch(url);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as any;
    const chart = json?.chart?.result?.[0];
    if (!chart) throw new Error('차트 데이터 없음');

    const timestamps: number[] = chart.timestamp ?? [];
    const q = chart.indicators?.quote?.[0] ?? {};

    const points: PricePoint[] = timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().slice(0, 10),
        close: ((q.close as (number | null)[])?.[i]) ?? 0,
        open: ((q.open as (number | null)[])?.[i]) ?? undefined,
        high: ((q.high as (number | null)[])?.[i]) ?? undefined,
        low: ((q.low as (number | null)[])?.[i]) ?? undefined,
        volume: ((q.volume as (number | null)[])?.[i]) ?? undefined,
      }))
      .filter(p => p.close > 0);

    const ttl = period === '1Y' ? 1_800_000 : 43_200_000;
    historyCache.set(cacheKey, points, ttl);
    return points;
  } catch (err) {
    console.error(`[DataLayer] history ${id}/${period}:`, err);
    return generateMockHistory(id, period);
  }
}

// ─── 주봉 히스토리 (VSA용) ────────────────────────────────────────────────────
export async function fetchWeeklyHistory(id: AssetId): Promise<PricePoint[]> {
  const cacheKey = `weekly-${id}`;
  const cached = historyCache.get<PricePoint[]>(cacheKey);
  if (cached) return cached;

  const meta = ASSET_META[id];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(meta.symbol)}?interval=1wk&range=2y`;

  try {
    const res = await safeFetch(url);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as any;
    const chart = json?.chart?.result?.[0];
    if (!chart) throw new Error('주봉 없음');

    const timestamps: number[] = chart.timestamp ?? [];
    const q = chart.indicators?.quote?.[0] ?? {};

    const points: PricePoint[] = timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().slice(0, 10),
        close: ((q.close as (number | null)[])?.[i]) ?? 0,
        open: ((q.open as (number | null)[])?.[i]) ?? undefined,
        high: ((q.high as (number | null)[])?.[i]) ?? undefined,
        low: ((q.low as (number | null)[])?.[i]) ?? undefined,
        volume: ((q.volume as (number | null)[])?.[i]) ?? undefined,
      }))
      .filter(p => p.close > 0);

    historyCache.set(cacheKey, points, 1_800_000);
    return points;
  } catch (err) {
    console.error(`[DataLayer] weekly ${id}:`, err);
    return generateMockHistory(id, '1Y');
  }
}

// ─── 일봉 → 주봉 집계 ────────────────────────────────────────────────────────
export function aggregateToWeekly(daily: PricePoint[]): import('./types').WeeklyBar[] {
  const weekMap = new Map<string, import('./types').WeeklyBar>();
  for (const p of daily) {
    const date = new Date(p.date);
    const day = date.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const monday = new Date(date);
    monday.setDate(date.getDate() + diff);
    const weekKey = monday.toISOString().slice(0, 10);
    const ex = weekMap.get(weekKey);
    if (!ex) {
      weekMap.set(weekKey, { weekStart: weekKey, open: p.open ?? p.close, high: p.high ?? p.close, low: p.low ?? p.close, close: p.close, volume: p.volume ?? 0 });
    } else {
      ex.high = Math.max(ex.high, p.high ?? p.close);
      ex.low = Math.min(ex.low, p.low ?? p.close);
      ex.close = p.close;
      ex.volume += p.volume ?? 0;
    }
  }
  return [...weekMap.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

// ─── Fallback ────────────────────────────────────────────────────────────────
const FALLBACK_PRICES: Record<AssetId, [number, number]> = {
  BTC:    [88000,  87500],
  SPY:    [565,    562],
  KOSPI:  [2550,   2540],
  USDKRW: [1460,   1458],
  TNX:    [4.30,   4.28],
  GOLD:   [2920,   2910],
};

function buildFallbackQuote(id: AssetId): AssetQuote {
  const [price, prevClose] = FALLBACK_PRICES[id];
  const change = price - prevClose;
  const changePct = (change / prevClose) * 100;
  return { id, price, prevClose, change, changePct, updatedAt: new Date().toISOString(), source: 'fallback', isStale: true };
}

function generateMockHistory(id: AssetId, period: Period): PricePoint[] {
  const DAYS: Record<Period, number> = { '1Y': 252, '5Y': 1260, '10Y': 2520, 'ALL': 3650 };
  const [startPrice] = FALLBACK_PRICES[id];
  const days = DAYS[period];
  let price = startPrice * 0.7;
  const points: PricePoint[] = [];
  for (let i = days; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const vol = id === 'BTC' ? 0.03 : id === 'TNX' ? 0.003 : 0.01;
    price = Math.max(price * (1 + 0.0002 + vol * (Math.random() * 2 - 1)), startPrice * 0.2);
    points.push({ date: d.toISOString().slice(0, 10), close: parseFloat(price.toFixed(2)), volume: Math.floor(Math.random() * 5e7 + 1e7) });
  }
  return points;
}
