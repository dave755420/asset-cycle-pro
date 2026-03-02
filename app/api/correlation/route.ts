/**
 * API Route: /api/correlation
 * 상관관계 분석 — 기간/윈도우 파라미터
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchAssetHistory } from '@/lib/data-layer';
import { buildCorrelationMatrix, computeLeadLag, generateInsights } from '@/lib/quant-engine';
import { ASSET_IDS } from '@/lib/constants';
import type { AssetId, Period, RollingWindow, PricePoint } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = (searchParams.get('period') ?? '1Y') as Period;
  const window = parseInt(searchParams.get('window') ?? '90') as RollingWindow;

  try {
    const entries = await Promise.all(
      ASSET_IDS.map(id =>
        fetchAssetHistory(id, period).then(data => [id, data] as [AssetId, PricePoint[]])
      )
    );
    const histories = new Map<AssetId, PricePoint[]>(entries);
    const correlationMatrix = buildCorrelationMatrix(histories, period, window);

    const pairs: Array<[AssetId, AssetId]> = [
      ['BTC', 'SPY'], ['SPY', 'KOSPI'], ['TNX', 'GOLD'],
      ['BTC', 'GOLD'], ['SPY', 'GOLD'], ['TNX', 'SPY'],
    ];
    const leadLags = pairs.map(([a, b]) =>
      computeLeadLag(histories.get(a) ?? [], histories.get(b) ?? [], a, b)
    );

    const insights = generateInsights(correlationMatrix, leadLags);

    return NextResponse.json(
      { correlationMatrix, insights, leadLags, updatedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    );
  } catch (err) {
    console.error('[API/correlation]', err);
    return NextResponse.json({ error: '분석 실패' }, { status: 500 });
  }
}
