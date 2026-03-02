/**
 * API Route: /api/assets
 * 실시간 자산 시세 — 캐시 없음, 항상 최신 데이터
 */
import { NextResponse } from 'next/server';
import { fetchLiveQuotes } from '@/lib/data-layer';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const quotes = await fetchLiveQuotes();
    return NextResponse.json(
      { quotes, updatedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (err) {
    console.error('[API/assets]', err);
    return NextResponse.json({ error: '데이터 로드 실패' }, { status: 500 });
  }
}
