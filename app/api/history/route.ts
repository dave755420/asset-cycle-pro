import { NextRequest, NextResponse } from 'next/server';
import { fetchAssetHistory } from '@/lib/data-layer';
import type { AssetId, Period } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id') as AssetId;
  const period = (searchParams.get('period') ?? '1Y') as Period;

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  try {
    const data = await fetchAssetHistory(id, period);
    return NextResponse.json(
      { id, period, data },
      { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } }
    );
  } catch (err) {
    console.error('[API/history]', err);
    return NextResponse.json({ error: '히스토리 로드 실패' }, { status: 500 });
  }
}
