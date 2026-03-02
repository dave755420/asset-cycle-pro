/**
 * API Route: /api/vsa-scan v3
 *
 * Edge Runtime 사용 (Vercel Hobby 30초 허용, 기존 서버리스 10초 대비 3배)
 * 페이지당 15종목, 동시 fetch
 */
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { SP500_UNIVERSE } from '@/lib/sp500-symbols';

interface Bar {
  date: string; open: number; high: number;
  low: number; close: number; volume: number;
}

export interface ScanResult {
  symbol: string; name: string; sector: string;
  signal: 'buy' | 'sell'; signalKo: string; date: string;
  price: number; change: number; changePct: number;
  volume: number; volumeAvg: number; volumeMultiple: number;
  spread: number; prevSpread: number; bodyRatio: number;
  descKo: string;
}

async function fetchBars(symbol: string): Promise<Bar[]> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=60d`,
      {
        cache: 'no-store',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
          'Accept': 'application/json',
        },
      }
    );
    if (!res.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as any;
    const result = json?.chart?.result?.[0];
    if (!result) return [];
    const timestamps: number[] = result.timestamp ?? [];
    const q = result.indicators?.quote?.[0] ?? {};
    return timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().slice(0, 10),
        open:   (q.open   as number[])?.[i] ?? 0,
        high:   (q.high   as number[])?.[i] ?? 0,
        low:    (q.low    as number[])?.[i] ?? 0,
        close:  (q.close  as number[])?.[i] ?? 0,
        volume: (q.volume as number[])?.[i] ?? 0,
      }))
      .filter(b => b.close > 0 && b.volume > 0);
  } catch { return []; }
}

function detectSignal(bars: Bar[]): Omit<ScanResult, 'symbol' | 'name' | 'sector'> | null {
  if (bars.length < 22) return null;
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];

  const spread     = last.high - last.low;
  const prevSpread = prev.high - prev.low;
  const body       = Math.abs(last.close - last.open);
  const bodyRatio  = spread > 0 ? body / spread : 0;
  const bullBar    = last.close > last.open;
  const bearBar    = last.close < last.open;

  const volSlice   = bars.slice(-21, -1).map(b => b.volume);
  const volumeAvg  = volSlice.reduce((a, b) => a + b, 0) / volSlice.length;
  const volHigh    = last.volume > volumeAvg * 1.5;
  const volumeMultiple = volumeAvg > 0 ? last.volume / volumeAvg : 1;
  const change     = last.close - prev.close;
  const changePct  = prev.close > 0 ? (change / prev.close) * 100 : 0;

  const stoppingVolume =
    last.low < prev.low && bullBar && volHigh &&
    last.close > prev.close && spread > prevSpread;

  const upthrust =
    last.high > prev.high && bearBar && volHigh &&
    last.close < prev.close && spread > prevSpread &&
    last.close < prev.open;

  if (stoppingVolume) return {
    signal: 'buy', signalKo: '매수 — Stopping Volume',
    date: last.date, price: last.close, change, changePct,
    volume: last.volume, volumeAvg, volumeMultiple,
    spread, prevSpread, bodyRatio,
    descKo: `신저가(${last.low.toFixed(2)}) 후 양봉 마감. 거래량 ${volumeMultiple.toFixed(1)}배 급증. 스마트머니 매집 가능성.`,
  };

  if (upthrust) return {
    signal: 'sell', signalKo: '매도 — Upthrust',
    date: last.date, price: last.close, change, changePct,
    volume: last.volume, volumeAvg, volumeMultiple,
    spread, prevSpread, bodyRatio,
    descKo: `신고가(${last.high.toFixed(2)}) 달성 후 음봉 반락. 거래량 ${volumeMultiple.toFixed(1)}배 급증. 분배 가능성.`,
  };

  return null;
}

// 페이지당 15종목 (Edge 30초 안에 충분히 처리 가능)
const PAGE_SIZE = 15;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') ?? '0', 10);
  const start = page * PAGE_SIZE;
  const slice = SP500_UNIVERSE.slice(start, start + PAGE_SIZE);

  if (slice.length === 0) {
    return NextResponse.json({ results: [], page, total: SP500_UNIVERSE.length, done: true });
  }

  try {
    const settled = await Promise.allSettled(
      slice.map(async stock => {
        const bars = await fetchBars(stock.symbol);
        const sig = detectSignal(bars);
        if (!sig) return null;
        return { symbol: stock.symbol, name: stock.name, sector: stock.sector, ...sig } as ScanResult;
      })
    );

    const signals = settled
      .filter((r): r is PromiseFulfilledResult<ScanResult | null> => r.status === 'fulfilled')
      .map(r => r.value)
      .filter((r): r is ScanResult => r !== null);

    const done = start + PAGE_SIZE >= SP500_UNIVERSE.length;

    return NextResponse.json(
      { results: signals, page, total: SP500_UNIVERSE.length, done },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    return NextResponse.json(
      { results: [], page, total: SP500_UNIVERSE.length, done: false, error: String(err) },
      { status: 200 }
    );
  }
}
