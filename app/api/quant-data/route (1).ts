/**
 * API Route: /api/quant-data
 * 퀀트 랩 백테스트용 Yahoo Finance 서버사이드 프록시
 * 브라우저 CORS 문제 해결
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function safeFetch(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  return fetch(url, {
    signal: ctrl.signal,
    cache: 'no-store',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  }).finally(() => clearTimeout(t));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol   = searchParams.get('symbol');
  const range    = searchParams.get('range') ?? '2y';
  const interval = searchParams.get('interval') ?? '1d';

  if (!symbol) {
    return NextResponse.json({ error: 'symbol 파라미터 필요' }, { status: 400 });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
    const res = await safeFetch(url);

    if (!res.ok) {
      // query2 fallback
      const url2 = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
      const res2 = await safeFetch(url2);
      if (!res2.ok) throw new Error(`Yahoo Finance HTTP ${res2.status}`);
      const json2 = await res2.json();
      return NextResponse.json(json2, {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' }
      });
    }

    const json = await res.json();
    return NextResponse.json(json, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' }
    });
  } catch (err) {
    console.error('[API/quant-data]', err);
    return NextResponse.json({ error: `데이터 로드 실패: ${(err as Error).message}` }, { status: 500 });
  }
}
