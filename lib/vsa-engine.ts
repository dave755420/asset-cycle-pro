/**
 * VSA (Volume Spread Analysis) ENGINE — Asset Cycle Pro v2
 *
 * 분석 조건:
 *   A) 주봉 RSI(14) < 25 (극심한 과매도)
 *   B) 해당 주봉 거래량 >= 최근 20주 평균 × 2.0배
 *
 * 두 조건 동시 충족 → "강한 과매도 + 수급 급증" 시그널
 *
 * 구조:
 *   - 순수 계산 모듈 (외부 API 호출 없음)
 *   - 확장 가능: 과매수, RSI 다이버전스, Smart Money 등 추가 가능
 */

import { VSA_CONFIG } from './constants';
import type { AssetId, PricePoint, VSASignal, VSAAnalysisResult, WeeklyBar } from './types';
import { ASSET_META } from './constants';
import { aggregateToWeekly } from './data-layer';

// ─── RSI 계산 (Wilder's Smoothing) ────────────────────────────────────────
export function calculateRSI(closes: number[], period: number = 14): number[] {
  if (closes.length < period + 1) return [];

  const rsi: number[] = new Array(period).fill(NaN);
  let avgGain = 0;
  let avgLoss = 0;

  // 초기 평균 (단순 평균)
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  const rs0 = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi.push(100 - 100 / (1 + rs0));

  // Wilder's smoothing
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(100 - 100 / (1 + rs));
  }

  return rsi;
}

// ─── 거래량 이동평균 ──────────────────────────────────────────────────────
export function rollingVolumeAvg(volumes: number[], lookback: number): number[] {
  const result: number[] = new Array(lookback - 1).fill(NaN);
  for (let i = lookback - 1; i < volumes.length; i++) {
    const slice = volumes.slice(i - lookback + 1, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / lookback;
    result.push(avg);
  }
  return result;
}

// ─── VSA 시그널 생성 ──────────────────────────────────────────────────────
function buildSignalText(assetName: string, rsi: number, volMultiple: number, weekStart: string): {
  titleKo: string;
  bodyKo: string;
  severity: 'strong' | 'extreme';
} {
  const severity: 'strong' | 'extreme' = rsi < VSA_CONFIG.RSI_OVERSOLD_EXTREME ? 'extreme' : 'strong';
  const dateStr = weekStart;

  if (severity === 'extreme') {
    return {
      titleKo: `⚡ ${assetName} 극심한 과매도 + 수급 폭발 감지`,
      bodyKo: `${dateStr} 주봉 기준 RSI ${rsi.toFixed(1)} (임계값 ${VSA_CONFIG.RSI_OVERSOLD_EXTREME} 이하)이며, 해당 주 거래량이 최근 20주 평균 대비 ${volMultiple.toFixed(1)}배 급등했습니다. 역사적으로 이 구간은 스마트머니의 강력한 매수 개입 가능성이 높습니다.`,
      severity,
    };
  }

  return {
    titleKo: `◈ ${assetName} 과매도 구간 + 대량 거래량 포착`,
    bodyKo: `${dateStr} 주봉 기준 RSI ${rsi.toFixed(1)} (임계값 ${VSA_CONFIG.RSI_OVERSOLD_STRONG} 이하)이며, 해당 주 거래량이 최근 20주 평균 대비 ${volMultiple.toFixed(1)}배 증가했습니다. 강한 과매도 국면에서의 대규모 수급 유입 신호입니다.`,
    severity,
  };
}

// ─── 메인 분석 함수 ───────────────────────────────────────────────────────
export function analyzeVSA(
  assetId: AssetId,
  dailyPrices: PricePoint[],
): VSAAnalysisResult {
  const meta = ASSET_META[assetId];
  const now = new Date().toISOString();
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  // 일봉 → 주봉 집계
  const weekly: WeeklyBar[] = aggregateToWeekly(dailyPrices);

  if (weekly.length < VSA_CONFIG.RSI_PERIOD + VSA_CONFIG.VOLUME_LOOKBACK + 2) {
    return { assetId, signals: [], latestRsi: 50, latestVolMultiple: 1, analyzedAt: now, weeklyBars: weekly, rsiSeries: [] };
  }

  const closes = weekly.map(w => w.close);
  const volumes = weekly.map(w => w.volume);

  const rsiValues = calculateRSI(closes, VSA_CONFIG.RSI_PERIOD);
  const volAvgValues = rollingVolumeAvg(volumes, VSA_CONFIG.VOLUME_LOOKBACK);

  // RSI 시계열 (차트용)
  const rsiSeries = weekly
    .map((w, i) => ({ date: w.weekStart, rsi: rsiValues[i] ?? NaN }))
    .filter(p => !isNaN(p.rsi))
    .map(p => ({ date: p.date, rsi: parseFloat(p.rsi.toFixed(2)) }));

  const signals: VSASignal[] = [];

  for (let i = VSA_CONFIG.RSI_PERIOD + VSA_CONFIG.VOLUME_LOOKBACK; i < weekly.length; i++) {
    const rsi = rsiValues[i];
    const volAvg = volAvgValues[i];
    const vol = volumes[i];
    const bar = weekly[i];

    if (isNaN(rsi) || isNaN(volAvg) || volAvg === 0) continue;

    const volMult = vol / volAvg;

    // 조건 A: RSI < 30 (strong) 또는 < 25 (extreme)
    const condA = rsi < VSA_CONFIG.RSI_OVERSOLD_STRONG;
    // 조건 B: 거래량 >= 1.5배 평균 (strong) 또는 >= 2배 (extreme)
    const condBStrong = volMult >= VSA_CONFIG.VOLUME_MULTIPLIER_STRONG;

    if (condA && condBStrong) {
      const { titleKo, bodyKo, severity } = buildSignalText(meta.nameKo, rsi, volMult, bar.weekStart);
      const isRecent = new Date(bar.weekStart) >= fourWeeksAgo;

      signals.push({
        id: `vsa-${assetId}-${bar.weekStart}`,
        assetId,
        weekStart: bar.weekStart,
        rsi: parseFloat(rsi.toFixed(2)),
        rsiThreshold: severity === 'extreme' ? VSA_CONFIG.RSI_OVERSOLD_EXTREME : VSA_CONFIG.RSI_OVERSOLD_STRONG,
        volume: vol,
        volumeAvg: parseFloat(volAvg.toFixed(0)),
        volumeMultiple: parseFloat(volMult.toFixed(2)),
        titleKo,
        bodyKo,
        severity,
        isRecent,
      });
    }
  }

  // 최신 값
  const latestRsi = rsiValues[rsiValues.length - 1] ?? 50;
  const latestVol = volumes[volumes.length - 1] ?? 0;
  const latestVolAvg = volAvgValues[volAvgValues.length - 1] ?? 1;
  const latestVolMultiple = latestVolAvg > 0 ? latestVol / latestVolAvg : 1;

  return {
    assetId,
    signals: signals.slice(-10), // 최근 10개만
    latestRsi: parseFloat(latestRsi.toFixed(2)),
    latestVolMultiple: parseFloat(latestVolMultiple.toFixed(2)),
    analyzedAt: now,
    weeklyBars: weekly.slice(-52), // 최근 52주
    rsiSeries: rsiSeries.slice(-52),
  };
}

// ─── 전체 자산 VSA 배치 분석 ─────────────────────────────────────────────
export function analyzeAllVSA(
  histories: Map<AssetId, PricePoint[]>,
): Map<AssetId, VSAAnalysisResult> {
  const results = new Map<AssetId, VSAAnalysisResult>();
  for (const [id, prices] of histories.entries()) {
    results.set(id, analyzeVSA(id, prices));
  }
  return results;
}
