/**
 * API Route: /api/vsa
 * VSA 주봉 퀀트 분석
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchAssetHistory, fetchWeeklyHistory } from '@/lib/data-layer';
import { analyzeVSA } from '@/lib/vsa-engine';
import { ASSET_IDS } from '@/lib/constants';
import type { AssetId } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const assetParam = searchParams.get('asset');
  const targetIds: AssetId[] = assetParam
    ? [assetParam as AssetId]
    : ASSET_IDS;

  try {
    const results = await Promise.all(
      targetIds.map(async id => {
        // 주봉 데이터 시도 → 실패 시 일봉 데이터로 집계
        let prices = await fetchWeeklyHistory(id).catch(() => null);
        if (!prices || prices.length < 30) {
          prices = await fetchAssetHistory(id, '5Y');
        }
        return analyzeVSA(id, prices);
      })
    );

    return NextResponse.json(
      { results, analyzedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' } }
    );
  } catch (err) {
    console.error('[API/vsa]', err);
    return NextResponse.json({ error: 'VSA 분석 실패' }, { status: 500 });
  }
}
