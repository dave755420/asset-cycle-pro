/**
 * QUANT ANALYSIS ENGINE — Asset Cycle Pro
 * 
 * Responsibilities:
 * - Pearson correlation calculation
 * - Rolling correlation (window-based)
 * - Lead-lag analysis
 * - Automated Korean insight generation
 * - NO data fetching, NO UI
 */

import type { AssetId, CorrelationMatrix, LeadLagResult, PricePoint, QuantInsight, RollingCorrelation, RollingWindow, Period } from './types';
import { ASSET_IDS, ASSET_META } from './constants';

// ─── Math utilities ────────────────────────────────────────────────────────

/** Convert price series to daily returns */
export function toReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] !== 0) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }
  return returns;
}

/** Pearson correlation coefficient */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 5) return 0;

  const xs = x.slice(0, n);
  const ys = y.slice(0, n);

  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const denom = Math.sqrt(denX * denY);
  if (denom === 0) return 0;
  return Math.max(-1, Math.min(1, num / denom));
}

/** Align two price series by date */
export function alignSeries(
  a: PricePoint[],
  b: PricePoint[]
): { datesA: string[]; valuesA: number[]; valuesB: number[] } {
  const bMap = new Map(b.map(p => [p.date, p.close]));
  const aligned = a
    .filter(p => bMap.has(p.date))
    .map(p => ({ date: p.date, vA: p.close, vB: bMap.get(p.date)! }));

  return {
    datesA: aligned.map(p => p.date),
    valuesA: aligned.map(p => p.vA),
    valuesB: aligned.map(p => p.vB),
  };
}

// ─── Correlation Matrix ────────────────────────────────────────────────────
export function buildCorrelationMatrix(
  histories: Map<AssetId, PricePoint[]>,
  period: Period,
  window: RollingWindow
): CorrelationMatrix {
  const n = ASSET_IDS.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const a = histories.get(ASSET_IDS[i]) ?? [];
      const b = histories.get(ASSET_IDS[j]) ?? [];

      const { valuesA, valuesB } = alignSeries(a, b);
      const retA = toReturns(valuesA.slice(-window));
      const retB = toReturns(valuesB.slice(-window));
      const corr = pearsonCorrelation(retA, retB);

      matrix[i][j] = corr;
      matrix[j][i] = corr;
    }
  }

  return { assets: ASSET_IDS, matrix, period, window, computedAt: new Date().toISOString() };
}

// ─── Rolling Correlation ──────────────────────────────────────────────────
export function computeRollingCorrelation(
  aHistory: PricePoint[],
  bHistory: PricePoint[],
  assetA: AssetId,
  assetB: AssetId,
  windowSize: number = 60,
  step: number = 5
): RollingCorrelation {
  const { datesA, valuesA, valuesB } = alignSeries(aHistory, bHistory);
  const retA = toReturns(valuesA);
  const retB = toReturns(valuesB);
  const dates = datesA.slice(1);

  const result: Array<{ date: string; value: number }> = [];

  for (let i = windowSize; i < retA.length; i += step) {
    const sliceA = retA.slice(i - windowSize, i);
    const sliceB = retB.slice(i - windowSize, i);
    const corr = pearsonCorrelation(sliceA, sliceB);
    result.push({ date: dates[i], value: parseFloat(corr.toFixed(4)) });
  }

  return { assetA, assetB, data: result };
}

// ─── Lead-Lag Analysis ────────────────────────────────────────────────────
export function computeLeadLag(
  aHistory: PricePoint[],
  bHistory: PricePoint[],
  assetA: AssetId,
  assetB: AssetId,
  maxLag: number = 20
): LeadLagResult {
  const { valuesA, valuesB } = alignSeries(aHistory, bHistory);
  const retA = toReturns(valuesA);
  const retB = toReturns(valuesB);

  let bestCorr = -Infinity;
  let bestLag = 0;

  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let a: number[], b: number[];
    if (lag >= 0) {
      a = retA.slice(lag);
      b = retB.slice(0, retB.length - lag || undefined);
    } else {
      a = retA.slice(0, retA.length + lag);
      b = retB.slice(-lag);
    }
    const n = Math.min(a.length, b.length);
    const corr = Math.abs(pearsonCorrelation(a.slice(0, n), b.slice(0, n)));
    if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
  }

  return { assetA, assetB, lag: bestLag, correlation: bestCorr };
}

// ─── Insight Generator (Korean) ───────────────────────────────────────────
export function generateInsights(
  matrix: CorrelationMatrix,
  leadLags: LeadLagResult[]
): QuantInsight[] {
  const insights: QuantInsight[] = [];
  const { assets, matrix: m } = matrix;

  // 1. Strong positive correlations
  for (let i = 0; i < assets.length; i++) {
    for (let j = i + 1; j < assets.length; j++) {
      const corr = m[i][j];
      const nameA = ASSET_META[assets[i]].nameKo;
      const nameB = ASSET_META[assets[j]].nameKo;

      if (corr >= 0.75) {
        insights.push({
          id: `pos-${i}-${j}`,
          type: 'correlation',
          titleKo: `강한 동반 상승 패턴`,
          bodyKo: `${nameA}와 ${nameB}의 상관계수가 ${corr.toFixed(2)}로 매우 높게 나타납니다. 두 자산은 최근 ${matrix.window}일간 높은 동조화를 보이며, 한 자산의 방향성이 다른 자산으로 전이될 가능성이 큽니다.`,
          severity: 'info',
          assets: [assets[i], assets[j]],
          value: corr,
        });
      } else if (corr <= -0.65) {
        insights.push({
          id: `neg-${i}-${j}`,
          type: 'correlation',
          titleKo: `역방향 헷지 관계 감지`,
          bodyKo: `${nameA}와 ${nameB}의 상관계수가 ${corr.toFixed(2)}로 강한 역상관을 보입니다. ${nameA} 하락 국면에서 ${nameB}를 헷지 수단으로 고려할 수 있습니다.`,
          severity: 'warning',
          assets: [assets[i], assets[j]],
          value: corr,
        });
      }
    }
  }

  // 2. Lead-lag insights
  for (const ll of leadLags) {
    if (Math.abs(ll.lag) >= 3 && ll.correlation >= 0.45) {
      const nameA = ASSET_META[ll.assetA].nameKo;
      const nameB = ASSET_META[ll.assetB].nameKo;
      const direction = ll.lag > 0 ? '선행' : '후행';
      const lagAbs = Math.abs(ll.lag);
      insights.push({
        id: `leadlag-${ll.assetA}-${ll.assetB}`,
        type: 'leadlag',
        titleKo: `선행-후행 시그널 감지`,
        bodyKo: `${nameA}가 ${nameB}에 대해 평균 ${lagAbs}일 ${direction}하는 패턴이 포착됩니다 (상관도: ${ll.correlation.toFixed(2)}). 이 시그널을 활용한 전술적 매매 타이밍 포착이 가능합니다.`,
        severity: 'warning',
        assets: [ll.assetA, ll.assetB],
        value: ll.lag,
      });
    }
  }

  // 3. Bitcoin-specific risk
  const btcIdx = assets.indexOf('BTC');
  const tnxIdx = assets.indexOf('TNX');
  if (btcIdx >= 0 && tnxIdx >= 0) {
    const btcTnxCorr = m[btcIdx][tnxIdx];
    if (btcTnxCorr < -0.3) {
      insights.push({
        id: 'btc-tnx-risk',
        type: 'risk',
        titleKo: '금리 상승 → 비트코인 하방 압력',
        bodyKo: `비트코인과 미국 10년 국채금리 간 상관계수가 ${btcTnxCorr.toFixed(2)}입니다. 금리 인상 사이클에서 비트코인의 리스크 자산 특성이 두드러지므로 포지션 관리 시 주의가 필요합니다.`,
        severity: 'alert',
        assets: ['BTC', 'TNX'],
        value: btcTnxCorr,
      });
    }
  }

  // 4. KOSPI-USDKRW inverse relationship
  const kospiIdx = assets.indexOf('KOSPI');
  const usdkrwIdx = assets.indexOf('USDKRW');
  if (kospiIdx >= 0 && usdkrwIdx >= 0) {
    const corr = m[kospiIdx][usdkrwIdx];
    if (corr < -0.2) {
      insights.push({
        id: 'kospi-usdkrw',
        type: 'divergence',
        titleKo: '원화 약세 구간 코스피 주의',
        bodyKo: `코스피와 달러/원 환율의 상관계수가 ${corr.toFixed(2)}입니다. 달러 강세(원화 약세) 국면에서 코스피는 외국인 매도 압력을 받는 경향이 있으므로 환율 동향을 면밀히 모니터링하세요.`,
        severity: 'warning',
        assets: ['KOSPI', 'USDKRW'],
        value: corr,
      });
    }
  }

  // 5. Gold safe-haven check
  const goldIdx = assets.indexOf('GOLD');
  const spyIdx = assets.indexOf('SPY');
  if (goldIdx >= 0 && spyIdx >= 0) {
    const corr = m[goldIdx][spyIdx];
    if (corr < 0) {
      insights.push({
        id: 'gold-safehaven',
        type: 'correlation',
        titleKo: '금의 안전자산 특성 확인',
        bodyKo: `금(Gold)과 S&P500의 상관계수가 ${corr.toFixed(2)}로 역방향입니다. 주식시장 불안정 시 금의 안전자산 수요가 높아지는 전형적인 패턴이 나타나고 있습니다.`,
        severity: 'info',
        assets: ['GOLD', 'SPY'],
        value: corr,
      });
    }
  }

  // Sort by severity
  const order = { alert: 0, warning: 1, info: 2 };
  return insights.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 8);
}

// ─── Utility: Describe correlation strength ───────────────────────────────
// describeCorrelation is in lib/utils.ts
