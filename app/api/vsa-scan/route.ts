/**
 * /api/vsa-scan — 더미 엔드포인트
 * 실제 스캔은 SP500ScanPanel에서 브라우저가 직접 처리합니다.
 */
import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ message: 'Client-side scanning only', results: [] });
}
