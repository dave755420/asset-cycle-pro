/**
 * lib/backtest-engine.ts
 * 백테스트 엔진 + 자동 최적화 봇
 */

import type { Bar, Signal, Strategy } from './quant-strategies';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Trade {
  entryDate: string;
  exitDate:  string;
  entryPrice: number;
  exitPrice:  number;
  returnPct:  number;
  holdDays:   number;
  reason:     string;
}

export interface EquityPoint {
  date:   string;
  equity: number;
  drawdown: number;
}

export interface BacktestResult {
  strategyId:    string;
  params:        Record<string, number>;
  totalReturn:   number;   // %
  cagr:          number;   // %
  sharpe:        number;
  maxDrawdown:   number;   // % (음수)
  winRate:       number;   // %
  profitFactor:  number;
  trades:        Trade[];
  equityCurve:   EquityPoint[];
  numTrades:     number;
  avgHoldDays:   number;
  bestTrade:     number;   // %
  worstTrade:    number;   // %
}

export interface OptimizeResult {
  rank:         number;
  params:       Record<string, number>;
  sharpe:       number;
  totalReturn:  number;
  maxDrawdown:  number;
  winRate:      number;
  numTrades:    number;
}

// ─── 백테스트 코어 ────────────────────────────────────────────────────────────

export function runBacktest(
  bars: Bar[],
  strategy: Strategy,
  params: Record<string, number>,
  initialCapital = 10_000_000, // 1천만원
): BacktestResult {
  const signals: Signal[] = strategy.generate(bars, params);

  // 시그널 → 트레이드 변환
  const trades: Trade[] = [];
  const barMap = new Map(bars.map(b => [b.date, b]));

  for (let i = 0; i < signals.length - 1; i++) {
    const entry = signals[i];
    if (entry.type !== 'buy') continue;
    // 다음 sell 찾기
    for (let j = i + 1; j < signals.length; j++) {
      if (signals[j].type === 'sell') {
        const entryBar = barMap.get(entry.date);
        const exitBar  = barMap.get(signals[j].date);
        if (!entryBar || !exitBar) break;

        const entryIdx = bars.findIndex(b => b.date === entry.date);
        const exitIdx  = bars.findIndex(b => b.date === signals[j].date);
        const holdDays = Math.max(1, exitIdx - entryIdx);
        const returnPct = ((signals[j].price / entry.price) - 1) * 100;

        trades.push({
          entryDate:  entry.date,
          exitDate:   signals[j].date,
          entryPrice: entry.price,
          exitPrice:  signals[j].price,
          returnPct,
          holdDays,
          reason:     signals[j].reason,
        });
        i = j; // 다음 buy부터 탐색
        break;
      }
    }
  }

  // 미청산 포지션 — 마지막 가격으로 강제 청산
  const lastBuy = signals.filter(s => s.type === 'buy').at(-1);
  const lastSell = signals.filter(s => s.type === 'sell').at(-1);
  if (lastBuy && (!lastSell || lastBuy.date > lastSell.date)) {
    const lastBar = bars.at(-1)!;
    const returnPct = ((lastBar.close / lastBuy.price) - 1) * 100;
    const entryIdx = bars.findIndex(b => b.date === lastBuy.date);
    trades.push({
      entryDate:  lastBuy.date,
      exitDate:   lastBar.date,
      entryPrice: lastBuy.price,
      exitPrice:  lastBar.close,
      returnPct,
      holdDays:   Math.max(1, bars.length - 1 - entryIdx),
      reason:     '보유 중 (강제청산)',
    });
  }

  // 자산 곡선 계산
  const equityCurve: EquityPoint[] = [];
  let equity = initialCapital;
  let peak   = initialCapital;
  let tradeIdx = 0;

  for (const bar of bars) {
    // 해당 날짜에 청산된 트레이드 적용
    while (tradeIdx < trades.length && trades[tradeIdx].exitDate <= bar.date) {
      equity *= (1 + trades[tradeIdx].returnPct / 100);
      tradeIdx++;
    }
    if (equity > peak) peak = equity;
    const drawdown = peak > 0 ? ((equity - peak) / peak) * 100 : 0;
    equityCurve.push({ date: bar.date, equity: Math.round(equity), drawdown });
  }

  // 통계 계산
  const numTrades  = trades.length;
  const winners    = trades.filter(t => t.returnPct > 0);
  const losers     = trades.filter(t => t.returnPct <= 0);
  const winRate    = numTrades > 0 ? (winners.length / numTrades) * 100 : 0;
  const grossProfit = winners.reduce((a, t) => a + t.returnPct, 0);
  const grossLoss   = Math.abs(losers.reduce((a, t) => a + t.returnPct, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0;
  const totalReturn  = ((equity / initialCapital) - 1) * 100;
  const years        = bars.length / 252;
  const cagr         = years > 0 ? (Math.pow(equity / initialCapital, 1 / years) - 1) * 100 : 0;
  const maxDrawdown  = equityCurve.length > 0 ? Math.min(...equityCurve.map(e => e.drawdown)) : 0;
  const avgHoldDays  = numTrades > 0 ? trades.reduce((a, t) => a + t.holdDays, 0) / numTrades : 0;
  const bestTrade    = numTrades > 0 ? Math.max(...trades.map(t => t.returnPct)) : 0;
  const worstTrade   = numTrades > 0 ? Math.min(...trades.map(t => t.returnPct)) : 0;

  // 샤프 지수 (일별 수익률 기반)
  let sharpe = 0;
  if (equityCurve.length > 1) {
    const dailyReturns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      dailyReturns.push((equityCurve[i].equity / equityCurve[i-1].equity) - 1);
    }
    const meanR = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const stdR  = Math.sqrt(dailyReturns.reduce((a, r) => a + (r - meanR) ** 2, 0) / dailyReturns.length);
    sharpe = stdR > 0 ? (meanR / stdR) * Math.sqrt(252) : 0;
  }

  return {
    strategyId: strategy.id,
    params,
    totalReturn: parseFloat(totalReturn.toFixed(2)),
    cagr:        parseFloat(cagr.toFixed(2)),
    sharpe:      parseFloat(sharpe.toFixed(3)),
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    winRate:     parseFloat(winRate.toFixed(1)),
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    trades,
    equityCurve,
    numTrades,
    avgHoldDays: parseFloat(avgHoldDays.toFixed(1)),
    bestTrade:   parseFloat(bestTrade.toFixed(2)),
    worstTrade:  parseFloat(worstTrade.toFixed(2)),
  };
}

// ─── 자동 최적화 (그리드 서치) ────────────────────────────────────────────────

export interface OptimizeProgress {
  tested:  number;
  total:   number;
  best:    OptimizeResult | null;
}

/**
 * 파라미터 그리드를 생성합니다.
 * 각 파라미터 범위에서 5개 포인트 샘플링 (조합 폭발 방지)
 */
function buildGrid(strategy: Strategy): Array<Record<string, number>> {
  const paramSamples: Array<Array<{ key: string; val: number }>> = strategy.params.map(p => {
    const steps = Math.min(5, Math.floor((p.max - p.min) / p.step) + 1);
    const vals: number[] = [];
    for (let i = 0; i < steps; i++) {
      const v = p.min + Math.round((i / (steps - 1)) * ((p.max - p.min) / p.step)) * p.step;
      vals.push(Math.min(p.max, parseFloat(v.toFixed(4))));
    }
    return [...new Set(vals)].map(val => ({ key: p.key, val }));
  });

  // 카르테시안 곱
  let grid: Array<Record<string, number>> = [{}];
  for (const samples of paramSamples) {
    const next: Array<Record<string, number>> = [];
    for (const existing of grid) {
      for (const sample of samples) {
        next.push({ ...existing, [sample.key]: sample.val });
      }
    }
    grid = next;
  }
  return grid;
}

/**
 * 자동 최적화 실행
 * onProgress: 진행 상황 콜백
 * returns: 상위 10개 파라미터 조합
 */
export async function runOptimize(
  bars: Bar[],
  strategy: Strategy,
  onProgress?: (p: OptimizeProgress) => void,
): Promise<OptimizeResult[]> {
  const grid = buildGrid(strategy);
  const results: OptimizeResult[] = [];
  const total = grid.length;

  for (let i = 0; i < grid.length; i++) {
    const params = grid[i];

    // 최소 트레이드 필터 — 데이터 부족한 파라미터 스킵
    try {
      const bt = runBacktest(bars, strategy, params);
      if (bt.numTrades >= 3) { // 최소 3번은 거래해야 유효
        results.push({
          rank:        0,
          params,
          sharpe:      bt.sharpe,
          totalReturn: bt.totalReturn,
          maxDrawdown: bt.maxDrawdown,
          winRate:     bt.winRate,
          numTrades:   bt.numTrades,
        });
      }
    } catch { /* 실패한 파라미터 스킵 */ }

    // 50개마다 또는 마지막에 진행률 업데이트
    if (onProgress && (i % 50 === 0 || i === grid.length - 1)) {
      const best = results.length > 0
        ? results.reduce((a, b) => b.sharpe > a.sharpe ? b : a)
        : null;
      onProgress({ tested: i + 1, total, best });
      // 브라우저 블로킹 방지
      await new Promise(r => setTimeout(r, 0));
    }
  }

  // 샤프 기준 정렬, 상위 10개 반환
  return results
    .sort((a, b) => b.sharpe - a.sharpe)
    .slice(0, 10)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

// ─── 자가학습: 이전 결과 기반 파라미터 재조정 ──────────────────────────────────

/**
 * 백테스트 결과가 나쁠 때 파라미터를 자동으로 조정
 * - 샤프 < 0.5 → 최적화 봇 실행 권고
 * - 승률 < 40% → 진입 조건 강화 (RSI 기준 낮춤 등)
 * - MDD < -30% → 손절 조건 추가
 */
export function suggestImprovement(result: BacktestResult, strategy: Strategy): {
  score: 'good' | 'ok' | 'bad';
  suggestions: string[];
  autoAdjust?: Record<string, number>;
} {
  const suggestions: string[] = [];
  let score: 'good' | 'ok' | 'bad' = 'good';

  if (result.sharpe < 0.3 || result.totalReturn < 0) {
    score = 'bad';
    suggestions.push('수익률 저조 — 자동 최적화 실행 권장');
  } else if (result.sharpe < 0.8) {
    score = 'ok';
    suggestions.push('샤프지수 개선 여지 있음 — 최적화 시도 권장');
  }

  if (result.winRate < 40) {
    suggestions.push(`승률 ${result.winRate}% 낮음 — 진입 조건 강화 필요`);
  }

  if (result.maxDrawdown < -25) {
    suggestions.push(`MDD ${result.maxDrawdown}% — 리스크 관리 강화 필요`);
  }

  if (result.numTrades < 5) {
    suggestions.push(`거래 횟수 ${result.numTrades}회 부족 — 기간 늘리거나 조건 완화`);
  }

  if (result.profitFactor < 1.2) {
    suggestions.push('손익비 낮음 — 손절/익절 비율 재검토 필요');
  }

  // 자동 조정 파라미터 제안
  const autoAdjust: Record<string, number> = {};
  if (result.winRate < 40) {
    // RSI 기준 낮추기
    const rsiParam = strategy.params.find(p => p.key === 'oversold' || p.key === 'rsiLevel');
    if (rsiParam) {
      const current = result.params[rsiParam.key];
      autoAdjust[rsiParam.key] = Math.max(rsiParam.min, current - 5);
    }
  }

  return { score, suggestions, autoAdjust: Object.keys(autoAdjust).length > 0 ? autoAdjust : undefined };
}
