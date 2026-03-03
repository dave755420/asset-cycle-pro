/**
 * app/api/ai-insight/route.ts
 * 오늘의 뉴스 카테고리별 AI 요약
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CATEGORIES = [
  { id: 'crypto',    label: '비트코인 & 암호화폐', emoji: '🟠' },
  { id: 'us_market', label: '나스닥 & 미국 증시',  emoji: '🟦' },
  { id: 'kr_market', label: '코스피 & 한국 증시',  emoji: '🟩' },
  { id: 'commodity', label: '금 & 원자재',          emoji: '🟤' },
  { id: 'fx_macro',  label: '달러 & 환율',          emoji: '💵' },
];

async function fetchNewsByCategory(category: string, baseUrl: string): Promise<string[]> {
  try {
    const res = await fetch(
      `${baseUrl}/api/news?category=${category}`,
      { cache: 'no-store', signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as any;
    const feed = json?.feeds?.[0];
    if (!feed) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (feed.items ?? []).slice(0, 5).map((item: any) => item.title as string).filter(Boolean);
  } catch {
    return [];
  }
}

async function summarizeWithGemini(apiKey: string, categoryLabel: string, headlines: string[]): Promise<string> {
  if (headlines.length === 0) return '현재 관련 뉴스를 불러올 수 없습니다.';

  const headlineText = headlines.map((h, i) => `${i + 1}. ${h}`).join('\n');

  const prompt = `당신은 금융 뉴스 요약 전문가입니다.
아래는 오늘의 [${categoryLabel}] 관련 최신 뉴스 헤드라인입니다.

${headlineText}

위 헤드라인에 나온 내용만 기반으로 아래 형식에 맞게 작성하세요. 없는 내용을 추가하지 마세요.

**핵심 요약**
오늘의 주요 흐름을 3~4문장으로 요약.

**투자 관점**
투자자에게 시사하는 점을 1~2문장으로.

**주의 리스크**
가장 주의할 리스크 1가지를 한 문장으로.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) throw new Error(`Gemini API 오류: ${response.status}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await response.json() as any;
  return result?.candidates?.[0]?.content?.parts?.[0]?.text ?? '요약 생성 실패';
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

  try {
    const body = await req.json();
    const requestedCategories: string[] = body?.categories ?? CATEGORIES.map(c => c.id);
    const targets = CATEGORIES.filter(c => requestedCategories.includes(c.id));

    // 뉴스 병렬 fetch
    const newsMap = await Promise.all(
      targets.map(async cat => ({
        ...cat,
        headlines: await fetchNewsByCategory(cat.id, baseUrl),
      }))
    );

    // Gemini 병렬 요약 (5개 카테고리 동시 처리 → 약 5~10초)
    const summaries = await Promise.all(
      newsMap.map(async cat => ({
        id:        cat.id,
        label:     cat.label,
        emoji:     cat.emoji,
        headlines: cat.headlines,
        summary:   await summarizeWithGemini(apiKey, cat.label, cat.headlines),
      }))
    );

    return NextResponse.json({ summaries, generatedAt: new Date().toISOString() });

  } catch (err) {
    console.error('[AI Insight]', err);
    return NextResponse.json({ error: `분석 실패: ${(err as Error).message}` }, { status: 500 });
  }
}
