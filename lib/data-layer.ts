/**
 * DATA LAYER v2 — Asset Cycle Pro
 *
 * 개선사항:
 * - Live quotes: cache: 'no-store' (stale 방지)
 * - USD/KRW: USDKRW=X 심볼 + 백업 소스 이중화
 * - 히스토리: 주봉 집계 지원 (VSA용)
 * - fallback 가격 현실 반영 (1460원대)
 */

import { ASSET_IDS, ASSET_META, PERIOD_RANGE_MAP } from './constants';
import type { AssetId, AssetQuote, PricePoint, Period, WeeklyBar } from './types';

// ─── In-memory cache (히스토리용만 사용, 실시간 시세는 사용 안 함) ─────────
interface CacheEntry<T> { data: T; expiresAt: number; }

class DataCache {
  private store = new Map<string, CacheEntry<unknown>>();
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { this.store.delete(key); return null; }
    return entry.data as T;
  }
  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs });
  }
  invalidate(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}

const historyCache = new DataCache();

// ─── Retry helper ─────────────────────────────────────────────────────────
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 3,
  delayMs = 600,
): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AssetCyclePro/2.0)',
          Accept: 'application/json',
          ...options.headers,
        },
      });
      if (res.ok) return res;
      if (res.status === 429 || res.status >= 500) {
        await sleep(delayMs * Math.pow(2, attempt));
        continue;
      }
      throw new Error(`HTTP ${res.status}: ${url}`);
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await sleep(delayMs * Math.pow(2, attempt));
    }
  }
  throw new Error('Max retries exceeded');
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Yahoo Finance URLs ────────────────────────────────────────────────────
const YF_QUOTE = (syms: string) =>
  `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(syms)}&fields=regularMarketPrice,regularMarketPreviousClose,regularMarketChange,regularMarketChangePercent,regularMarketTime`;

const YF_QUOTE2 = (syms: string) =>
  `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(syms)}&fields=regularMarketPrice,regularMarketPreviousClose,regularMarketChange,regularMarketChangePercent,regularMarketTime`;

const YF_CHART = (symbol: string, range: string, interval = '1d') =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;

// ─── Fetch live quotes (캐시 없음 — 항상 최신) ───────────────────────────
export async function fetchLiveQuotes(): Promise<AssetQuote[]> {
  const symbols = ASSET_IDS.map(id => ASSET_META[id].symbol).join(',');

  // Yahoo Finance에서 전체 시세 조회 (query1 → query2 fallback)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let results: any[] = [];
  let source: 'yahoo' | 'backup' | 'fallback' = 'fallback';

  try {
    const res = await fetchWithRetry(YF_QUOTE(symbols), { cache: 'no-store' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as any;
    results = json?.quoteResponse?.result ?? [];
    if (results.length > 0) source = 'yahoo';
  } catch {
    // query1 실패 → query2 시도
    try {
      const res2 = await fetchWithRetry(YF_QUOTE2(symbols), { cache: 'no-store' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json2 = await res2.json() as any;
      results = json2?.quoteResponse?.result ?? [];
      if (results.length > 0) source = 'backup';
    } catch (err2) {
      console.error('[DataLayer] fetchLiveQuotes 전체 실패:', err2);
    }
  }

  // USD/KRW 정확도 보정: Yahoo에서 가져온 값이 합리적인지 검증
  // USDKRW=X는 1200~1600 범위여야 함
  const quotes: AssetQuote[] = await Promise.all(
    ASSET_IDS.map(async id => {
      const meta = ASSET_META[id];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = results.find((q: any) => q.symbol === meta.symbol);

      if (id === 'USDKRW') {
        return fetchUSDKRW(r, source);
      }

      if (!r || !r.regularMarketPrice) return buildFallbackQuote(id);

      return {
        id,
        price: r.regularMarketPrice,
        prevClose: r.regularMarketPreviousClose ?? r.regularMarketPrice,
        change: r.regularMarketChange ?? 0,
        changePct: r.regularMarketChangePercent ?? 0,
        updatedAt: new Date().toISOString(),
        source,
        isStale: false,
      } satisfies AssetQuote;
    })
  );

  return quotes;
}

// ─── USD/KRW 전용: Yahoo + 백업 API 이중화 ───────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchUSDKRW(yahooResult: any | null, yahooSource: string): Promise<AssetQuote> {
  const now = new Date().toISOString();

  // Yahoo에서 유효한 값이 나왔고 범위가 합리적이면 사용
  if (yahooResult?.regularMarketPrice) {
    const price = yahooResult.regularMarketPrice as number;
    if (price >= 1100 && price <= 1700) {
      return {
        id: 'USDKRW',
        price,
        prevClose: yahooResult.regularMarketPreviousClose ?? price,
        change: yahooResult.regularMarketChange ?? 0,
        changePct: yahooResult.regularMarketChangePercent ?? 0,
        updatedAt: now,
        source: yahooSource as 'yahoo' | 'backup',
        isStale: false,
      };
    }
  }

  // Yahoo 실패 또는 범위 이탈 → Frankfurter API (ECB 기반, 무료)
  try {
    const res = await fetchWithRetry(
      'https://api.frankfurter.app/latest?from=USD&to=KRW',
      { cache: 'no-store' }
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as any;
    const price = json?.rates?.KRW as number;
    if (price && price >= 1100 && price <= 1700) {
      // Frankfurter는 전일 종가 없으므로 변동 계산 불가
      return { id: 'USDKRW', price, prevClose: price, change: 0, changePct: 0, updatedAt: now, source: 'backup', isStale: false };
    }
  } catch (err) {
    console.error('[DataLayer] Frankfurter USD/KRW 실패:', err);
  }

  // 최후 fallback — 현실적인 값 사용
  return buildFallbackQuote('USDKRW');
}

// ─── Fetch historical OHLCV (히스토리 캐싱 유지) ─────────────────────────
export async function fetchAssetHistory(id: AssetId, period: Period): Promise<PricePoint[]> {
  const cacheKey = `history-${id}-${period}`;
  const cached = historyCache.get<PricePoint[]>(cacheKey);
  if (cached) return cached;

  const meta = ASSET_META[id];
  const range = PERIOD_RANGE_MAP[period];

  try {
    const res = await fetchWithRetry(YF_CHART(meta.symbol, range), { cache: 'no-store' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as any;
    const chart = json?.chart?.result?.[0];
    if (!chart) throw new Error('chart data 없음');

    const timestamps: number[] = chart.timestamp ?? [];
    const q = chart.indicators?.quote?.[0] ?? {};
    const closes: (number | null)[] = q.close ?? [];
    const opens: (number | null)[] = q.open ?? [];
    const highs: (number | null)[] = q.high ?? [];
    const lows: (number | null)[] = q.low ?? [];
    const volumes: (number | null)[] = q.volume ?? [];

    const points: PricePoint[] = timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().slice(0, 10),
        close: closes[i] ?? 0,
        open: opens[i] ?? undefined,
        high: highs[i] ?? undefined,
        low: lows[i] ?? undefined,
        volume: volumes[i] ?? undefined,
      }))
      .filter(p => p.close > 0);

    const ttl = period === '1Y' ? 1_800_000 : 43_200_000; // 30분 / 12시간
    historyCache.set(cacheKey, points, ttl);
    return points;
  } catch (err) {
    console.error(`[DataLayer] fetchAssetHistory ${id}/${period}:`, err);
    return generateMockHistory(id, period);
  }
}

// ─── Weekly OHLCV (VSA용 — 2년 주봉) ────────────────────────────────────
export async function fetchWeeklyHistory(id: AssetId): Promise<PricePoint[]> {
  const cacheKey = `weekly-${id}`;
  const cached = historyCache.get<PricePoint[]>(cacheKey);
  if (cached) return cached;

  const meta = ASSET_META[id];

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(meta.symbol)}?interval=1wk&range=2y`;
    const res = await fetchWithRetry(url, { cache: 'no-store' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as any;
    const chart = json?.chart?.result?.[0];
    if (!chart) throw new Error('주봉 데이터 없음');

    const timestamps: number[] = chart.timestamp ?? [];
    const q = chart.indicators?.quote?.[0] ?? {};

    const points: PricePoint[] = timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().slice(0, 10),
        close: (q.close?.[i] as number) ?? 0,
        open: (q.open?.[i] as number) ?? undefined,
        high: (q.high?.[i] as number) ?? undefined,
        low: (q.low?.[i] as number) ?? undefined,
        volume: (q.volume?.[i] as number) ?? undefined,
      }))
      .filter(p => p.close > 0);

    historyCache.set(cacheKey, points, 1_800_000); // 30분
    return points;
  } catch (err) {
    console.error(`[DataLayer] fetchWeeklyHistory ${id}:`, err);
    return generateMockHistory(id, '1Y');
  }
}

// ─── Aggregate daily → weekly bars ────────────────────────────────────────
export function aggregateToWeekly(daily: PricePoint[]): WeeklyBar[] {
  const weekMap = new Map<string, WeeklyBar>();

  for (const p of daily) {
    const date = new Date(p.date);
    const day = date.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(date);
    monday.setDate(date.getDate() + diffToMonday);
    const weekKey = monday.toISOString().slice(0, 10);

    const existing = weekMap.get(weekKey);
    if (!existing) {
      weekMap.set(weekKey, {
        weekStart: weekKey,
        open: p.open ?? p.close,
        high: p.high ?? p.close,
        low: p.low ?? p.close,
        close: p.close,
        volume: p.volume ?? 0,
      });
    } else {
      existing.high = Math.max(existing.high, p.high ?? p.close);
      existing.low = Math.min(existing.low, p.low ?? p.close);
      existing.close = p.close;
      existing.volume += p.volume ?? 0;
    }
  }

  return [...weekMap.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

// ─── Fallback / mock ──────────────────────────────────────────────────────
function buildFallbackQuote(id: AssetId): AssetQuote {
  // 2025년 3월 기준 현실적인 가격
  const FALLBACK: Record<AssetId, number> = {
    BTC: 88000, SPY: 565, KOSPI: 2550, USDKRW: 1460, TNX: 4.30, GOLD: 2920,
  };
  const price = FALLBACK[id];
  const changePct = (Math.random() - 0.5) * 1.5;
  const change = price * changePct / 100;
  return { id, price, prevClose: price - change, change, changePct, updatedAt: new Date().toISOString(), source: 'fallback', isStale: true };
}

function generateMockHistory(id: AssetId, period: Period): PricePoint[] {
  const DAYS: Record<Period, number> = { '1Y': 252, '5Y': 1260, '10Y': 2520, 'ALL': 3650 };
  const START: Record<AssetId, number> = {
    BTC: 45000, SPY: 480, KOSPI: 2400, USDKRW: 1330, TNX: 3.8, GOLD: 2200,
  };
  const days = DAYS[period];
  const startPrice = START[id];
  const points: PricePoint[] = [];
  let price = startPrice;

  for (let i = days; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const vol = id === 'BTC' ? 0.035 : id === 'TNX' ? 0.004 : 0.01;
    const drift = 0.00015;
    price = Math.max(price * (1 + drift + vol * (Math.random() * 2 - 1)), startPrice * 0.1);
    const volume = Math.floor(Math.random() * 50_000_000 + 10_000_000);
    points.push({ date: d.toISOString().slice(0, 10), close: parseFloat(price.toFixed(2)), volume });
  }
  return points;
}
