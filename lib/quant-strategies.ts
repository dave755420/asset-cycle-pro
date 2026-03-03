/**
 * lib/quant-strategies.ts
 * 7가지 퀀트 전략 정의 + 지표 계산 유틸
 */

export interface Bar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Signal {
  date: string;
  type: 'buy' | 'sell' | 'hold';
  price: number;
  reason: string;
}

export interface StrategyParam {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface Strategy {
  id: string;
  nameKo: string;
  descKo: string;
  color: string;
  params: StrategyParam[];
  generate: (bars: Bar[], params: Record<string, number>) => Signal[];
}

// ─── 지표 계산 유틸 ────────────────────────────────────────────────────────────

export function calcRSI(closes: number[], period: number): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return result;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) avgGain += d; else avgLoss -= d;
  }
  avgGain /= period; avgLoss /= period;
  for (let i = period; i < closes.length; i++) {
    if (i > period) {
      const d = closes[i] - closes[i - 1];
      avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    }
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

export function calcSMA(values: number[], period: number): number[] {
  return values.map((_, i) => {
    if (i < period - 1) return NaN;
    return values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
  });
}

export function calcEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = new Array(values.length).fill(NaN);
  const startIdx = values.findIndex((_, i) => i >= period - 1);
  if (startIdx === -1) return result;
  result[period - 1] = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    result[i] = values[i] * k + result[i - 1] * (1 - k);
  }
  return result;
}

export function calcBB(closes: number[], period: number, mult: number) {
  return closes.map((_, i) => {
    if (i < period - 1) return { upper: NaN, middle: NaN, lower: NaN };
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
    return { upper: mean + mult * std, middle: mean, lower: mean - mult * std };
  });
}

export function calcMACD(closes: number[], fast: number, slow: number, signal: number) {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);
  const macdLine = closes.map((_, i) => isNaN(emaFast[i]) || isNaN(emaSlow[i]) ? NaN : emaFast[i] - emaSlow[i]);
  const validStart = macdLine.findIndex(v => !isNaN(v));
  const signalLine = calcEMA(macdLine.slice(validStart), signal);
  const fullSignal = new Array(validStart).fill(NaN).concat(signalLine);
  return { macdLine, signalLine: fullSignal };
}

function rollingAvgVolume(volumes: number[], period: number): number[] {
  return volumes.map((_, i) => {
    if (i < period) return NaN;
    return volumes.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
  });
}

// ─── 전략 1: RSI 역추세 ────────────────────────────────────────────────────────
const rsiReversal: Strategy = {
  id: 'rsi_reversal',
  nameKo: 'RSI 역추세',
  descKo: 'RSI 과매도 구간 매수 → 과매수 구간 매도. 평균 회귀 원리.',
  color: '#00d4ff',
  params: [
    { key: 'period',   label: 'RSI 기간',    min: 7,  max: 21, step: 1,  default: 14 },
    { key: 'oversold', label: '과매도 기준', min: 20, max: 40, step: 1,  default: 30 },
    { key: 'overbought', label: '과매수 기준', min: 60, max: 85, step: 1, default: 70 },
  ],
  generate(bars, p) {
    const closes = bars.map(b => b.close);
    const rsi = calcRSI(closes, p.period);
    const signals: Signal[] = [];
    let inPosition = false;
    for (let i = 1; i < bars.length; i++) {
      if (isNaN(rsi[i])) continue;
      if (!inPosition && rsi[i] <= p.oversold && rsi[i - 1] > p.oversold) {
        signals.push({ date: bars[i].date, type: 'buy', price: bars[i].close, reason: `RSI ${rsi[i].toFixed(1)} 과매도` });
        inPosition = true;
      } else if (inPosition && rsi[i] >= p.overbought && rsi[i - 1] < p.overbought) {
        signals.push({ date: bars[i].date, type: 'sell', price: bars[i].close, reason: `RSI ${rsi[i].toFixed(1)} 과매수` });
        inPosition = false;
      }
    }
    return signals;
  },
};

// ─── 전략 2: 볼린저 밴드 역추세 ──────────────────────────────────────────────
const bbReversal: Strategy = {
  id: 'bb_reversal',
  nameKo: 'BB 역추세',
  descKo: '볼린저 하단 터치 시 매수, 중심선 도달 시 매도. 변동성 수축 활용.',
  color: '#ffb800',
  params: [
    { key: 'period', label: 'BB 기간', min: 10, max: 30, step: 1, default: 20 },
    { key: 'mult',   label: '표준편차 배수', min: 1, max: 3, step: 0.1, default: 2.0 },
  ],
  generate(bars, p) {
    const closes = bars.map(b => b.close);
    const bb = calcBB(closes, p.period, p.mult);
    const signals: Signal[] = [];
    let inPosition = false;
    for (let i = 1; i < bars.length; i++) {
      if (isNaN(bb[i].lower)) continue;
      if (!inPosition && bars[i].low <= bb[i].lower) {
        signals.push({ date: bars[i].date, type: 'buy', price: bars[i].close, reason: `BB 하단($${bb[i].lower.toFixed(1)}) 터치` });
        inPosition = true;
      } else if (inPosition && bars[i].close >= bb[i].middle) {
        signals.push({ date: bars[i].date, type: 'sell', price: bars[i].close, reason: `BB 중심선($${bb[i].middle.toFixed(1)}) 도달` });
        inPosition = false;
      }
    }
    return signals;
  },
};

// ─── 전략 3: MA 골든크로스 ────────────────────────────────────────────────────
const maCross: Strategy = {
  id: 'ma_cross',
  nameKo: 'MA 골든크로스',
  descKo: '단기 이동평균이 장기선 상향 돌파 시 매수 (골든크로스). 추세 추종.',
  color: '#00ff88',
  params: [
    { key: 'fast', label: '단기 MA', min: 5,  max: 30,  step: 1, default: 20  },
    { key: 'slow', label: '장기 MA', min: 30, max: 200, step: 5, default: 60 },
  ],
  generate(bars, p) {
    const closes = bars.map(b => b.close);
    const fast = calcSMA(closes, p.fast);
    const slow = calcSMA(closes, p.slow);
    const signals: Signal[] = [];
    let inPosition = false;
    for (let i = 1; i < bars.length; i++) {
      if (isNaN(fast[i]) || isNaN(slow[i])) continue;
      const crossUp   = fast[i] > slow[i] && fast[i-1] <= slow[i-1];
      const crossDown = fast[i] < slow[i] && fast[i-1] >= slow[i-1];
      if (!inPosition && crossUp) {
        signals.push({ date: bars[i].date, type: 'buy', price: bars[i].close, reason: `골든크로스 (MA${p.fast} > MA${p.slow})` });
        inPosition = true;
      } else if (inPosition && crossDown) {
        signals.push({ date: bars[i].date, type: 'sell', price: bars[i].close, reason: `데드크로스 (MA${p.fast} < MA${p.slow})` });
        inPosition = false;
      }
    }
    return signals;
  },
};

// ─── 전략 4: MACD ─────────────────────────────────────────────────────────────
const macdStrategy: Strategy = {
  id: 'macd',
  nameKo: 'MACD 크로스',
  descKo: 'MACD선이 시그널선 상향 돌파 시 매수. 모멘텀 + 추세 복합.',
  color: '#b48eff',
  params: [
    { key: 'fast',   label: '빠른 EMA', min: 5,  max: 20, step: 1, default: 12 },
    { key: 'slow',   label: '느린 EMA', min: 15, max: 35, step: 1, default: 26 },
    { key: 'signal', label: '시그널',   min: 5,  max: 15, step: 1, default: 9  },
  ],
  generate(bars, p) {
    const closes = bars.map(b => b.close);
    const { macdLine, signalLine } = calcMACD(closes, p.fast, p.slow, p.signal);
    const signals: Signal[] = [];
    let inPosition = false;
    for (let i = 1; i < bars.length; i++) {
      if (isNaN(macdLine[i]) || isNaN(signalLine[i])) continue;
      const crossUp   = macdLine[i] > signalLine[i] && macdLine[i-1] <= signalLine[i-1];
      const crossDown = macdLine[i] < signalLine[i] && macdLine[i-1] >= signalLine[i-1];
      if (!inPosition && crossUp) {
        signals.push({ date: bars[i].date, type: 'buy', price: bars[i].close, reason: `MACD 상향 크로스` });
        inPosition = true;
      } else if (inPosition && crossDown) {
        signals.push({ date: bars[i].date, type: 'sell', price: bars[i].close, reason: `MACD 하향 크로스` });
        inPosition = false;
      }
    }
    return signals;
  },
};

// ─── 전략 5: VSA 거래량 분석 ─────────────────────────────────────────────────
const vsaStrategy: Strategy = {
  id: 'vsa',
  nameKo: 'VSA 거래량',
  descKo: '신저가 + 양봉 + 거래량 급증 시 매수 (Stopping Volume). 스마트머니 추적.',
  color: '#ff4466',
  params: [
    { key: 'volPeriod',   label: '거래량 기준 기간', min: 10, max: 30, step: 1,   default: 20  },
    { key: 'volMultiple', label: '거래량 배율',      min: 1,  max: 3,  step: 0.1, default: 1.5 },
    { key: 'holdDays',    label: '보유 기간(일)',     min: 3,  max: 20, step: 1,   default: 10  },
  ],
  generate(bars, p) {
    const volumes = bars.map(b => b.volume);
    const volAvg = rollingAvgVolume(volumes, p.volPeriod);
    const signals: Signal[] = [];
    let holdCounter = 0;
    let inPosition = false;
    for (let i = 1; i < bars.length; i++) {
      if (inPosition) {
        holdCounter++;
        if (holdCounter >= p.holdDays) {
          signals.push({ date: bars[i].date, type: 'sell', price: bars[i].close, reason: `보유 ${p.holdDays}일 후 청산` });
          inPosition = false; holdCounter = 0;
        }
        continue;
      }
      if (isNaN(volAvg[i])) continue;
      const stoppingVolume =
        bars[i].low < bars[i-1].low &&
        bars[i].close > bars[i].open &&
        bars[i].volume > volAvg[i] * p.volMultiple &&
        bars[i].close > bars[i-1].close;
      if (stoppingVolume) {
        signals.push({ date: bars[i].date, type: 'buy', price: bars[i].close, reason: `Stopping Volume (×${(bars[i].volume / volAvg[i]).toFixed(1)})` });
        inPosition = true;
      }
    }
    return signals;
  },
};

// ─── 전략 6: 모멘텀 ──────────────────────────────────────────────────────────
const momentumStrategy: Strategy = {
  id: 'momentum',
  nameKo: '가격 모멘텀',
  descKo: 'N일 전 대비 수익률이 임계값 초과 시 매수. 추세 지속성 활용.',
  color: '#ff8c00',
  params: [
    { key: 'lookback',   label: '모멘텀 기간(일)', min: 10, max: 60, step: 5,   default: 20  },
    { key: 'threshold',  label: '진입 수익률(%)',  min: 1,  max: 10, step: 0.5, default: 3.0 },
    { key: 'stopLoss',   label: '손절 비율(%)',    min: 2,  max: 15, step: 0.5, default: 5.0 },
  ],
  generate(bars, p) {
    const signals: Signal[] = [];
    let inPosition = false;
    let entryPrice = 0;
    for (let i = p.lookback; i < bars.length; i++) {
      const momentum = ((bars[i].close / bars[i - p.lookback].close) - 1) * 100;
      if (inPosition) {
        const pnl = ((bars[i].close / entryPrice) - 1) * 100;
        if (pnl <= -p.stopLoss) {
          signals.push({ date: bars[i].date, type: 'sell', price: bars[i].close, reason: `손절 (${pnl.toFixed(1)}%)` });
          inPosition = false;
        } else if (momentum < 0) {
          signals.push({ date: bars[i].date, type: 'sell', price: bars[i].close, reason: `모멘텀 반전` });
          inPosition = false;
        }
        continue;
      }
      if (momentum >= p.threshold) {
        signals.push({ date: bars[i].date, type: 'buy', price: bars[i].close, reason: `${p.lookback}일 모멘텀 +${momentum.toFixed(1)}%` });
        inPosition = true;
        entryPrice = bars[i].close;
      }
    }
    return signals;
  },
};

// ─── 전략 7: 복합 멀티팩터 (추천 전략) ────────────────────────────────────────
const multiFactor: Strategy = {
  id: 'multi_factor',
  nameKo: '멀티팩터 복합 ⭐',
  descKo: 'RSI 과매도 + BB 하단 + 거래량 급증 3가지 동시 충족 시 매수. 오탐률 최소화.',
  color: '#00ffcc',
  params: [
    { key: 'rsiPeriod',   label: 'RSI 기간',    min: 7,  max: 21, step: 1,   default: 14  },
    { key: 'rsiLevel',    label: 'RSI 기준',    min: 25, max: 45, step: 1,   default: 35  },
    { key: 'bbPeriod',    label: 'BB 기간',     min: 10, max: 30, step: 1,   default: 20  },
    { key: 'volMult',     label: '거래량 배율', min: 1,  max: 3,  step: 0.1, default: 1.3 },
  ],
  generate(bars, p) {
    const closes  = bars.map(b => b.close);
    const volumes = bars.map(b => b.volume);
    const rsi   = calcRSI(closes, p.rsiPeriod);
    const bb    = calcBB(closes, p.bbPeriod, 2.0);
    const volAvg = rollingAvgVolume(volumes, 20);
    const signals: Signal[] = [];
    let inPosition = false;
    for (let i = 1; i < bars.length; i++) {
      if (isNaN(rsi[i]) || isNaN(bb[i].lower) || isNaN(volAvg[i])) continue;
      const rsiCond = rsi[i] <= p.rsiLevel;
      const bbCond  = bars[i].close <= bb[i].lower * 1.02;
      const volCond = bars[i].volume >= volAvg[i] * p.volMult;
      if (!inPosition && rsiCond && bbCond && volCond) {
        signals.push({ date: bars[i].date, type: 'buy', price: bars[i].close, reason: `RSI${rsi[i].toFixed(0)}+BB하단+거래량×${(bars[i].volume/volAvg[i]).toFixed(1)}` });
        inPosition = true;
      } else if (inPosition && rsi[i] >= 65) {
        signals.push({ date: bars[i].date, type: 'sell', price: bars[i].close, reason: `RSI ${rsi[i].toFixed(1)} 과매수 청산` });
        inPosition = false;
      }
    }
    return signals;
  },
};

export const STRATEGIES: Strategy[] = [
  rsiReversal,
  bbReversal,
  maCross,
  macdStrategy,
  vsaStrategy,
  momentumStrategy,
  multiFactor,
];

export const STRATEGY_MAP = Object.fromEntries(STRATEGIES.map(s => [s.id, s]));
