/**
 * app/api/ai-insight/route.ts
 * Claude API를 이용한 AI 시장 분석
 * 환경변수: ANTHROPIC_API_KEY (Vercel에 설정)
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { mode, data } = body;

    let prompt = '';

    if (mode === 'market') {
      // 현재 시장 상황 분석
      const quotes = data?.quotes ?? [];
      const quoteText = quotes.map((q: { nameKo: string; price: number; changePct: number; }) =>
        `${q.nameKo}: ${q.price} (${q.changePct >= 0 ? '+' : ''}${q.changePct?.toFixed(2)}%)`
      ).join('\n');
      prompt = `당신은 한국의 기관 투자자를 위한 금융 분석 전문가입니다.

현재 주요 자산 시세:
${quoteText}

위 데이터를 바탕으로 다음을 한국어로 분석해주세요 (총 300자 내외):
1. 현재 시장의 전반적인 분위기 (위험선호/위험회피)
2. 주목할 만한 자산 움직임
3. 단기 투자자가 주의해야 할 점

분석은 객관적 사실 기반으로, 투기적 예측보다는 현황 해석에 집중하세요.`;

    } else if (mode === 'backtest') {
      // 백테스트 결과 해석
      const bt = data?.result;
      prompt = `당신은 퀀트 투자 전략 분석 전문가입니다.

백테스트 결과:
- 전략: ${bt?.strategyId}
- 총 수익률: ${bt?.totalReturn}%
- CAGR: ${bt?.cagr}%
- 샤프지수: ${bt?.sharpe}
- 최대 낙폭(MDD): ${bt?.maxDrawdown}%
- 승률: ${bt?.winRate}%
- 손익비: ${bt?.profitFactor}
- 거래 횟수: ${bt?.numTrades}회

위 결과를 바탕으로 한국어로 다음을 분석해주세요 (250자 내외):
1. 이 전략의 강점과 약점
2. 실전 적용 시 주의사항
3. 개선 방향 1가지 제안`;

    } else if (mode === 'news') {
      // 뉴스 요약 + 시장 영향 분석
      const headlines = (data?.headlines ?? []).slice(0, 8).join('\n');
      prompt = `당신은 글로벌 금융 뉴스 분석 전문가입니다.

최신 금융 뉴스 헤드라인:
${headlines}

위 뉴스들을 바탕으로 한국어로 분석해주세요 (250자 내외):
1. 오늘 시장에 가장 큰 영향을 줄 뉴스
2. 한국 투자자 관점에서의 시사점`;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[AI Insight] Claude API 오류:', errText);
      return NextResponse.json({ error: 'Claude API 호출 실패' }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await response.json() as any;
    const text: string = result?.content?.[0]?.text ?? '';

    return NextResponse.json({ analysis: text, mode, generatedAt: new Date().toISOString() });

  } catch (err) {
    console.error('[AI Insight]', err);
    return NextResponse.json({ error: `분석 실패: ${(err as Error).message}` }, { status: 500 });
  }
}
