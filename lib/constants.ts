import type { AssetId, AssetMeta, Period, RollingWindow, NewsCategory } from './types';

export const ASSET_META: Record<AssetId, AssetMeta> = {
  BTC: {
    id: 'BTC', symbol: 'BTC-USD', tvSymbol: 'BINANCE:BTCUSDT',
    nameKo: '비트코인', unit: 'USD', decimals: 0, color: '#f7931a',
  },
  SPY: {
    id: 'SPY', symbol: 'SPY', tvSymbol: 'AMEX:SPY',
    nameKo: 'S&P 500 (SPY)', unit: 'USD', decimals: 2, color: '#00d4ff',
  },
  KOSPI: {
    id: 'KOSPI', symbol: '^KS11', tvSymbol: 'INDEX:KOSPI',
    nameKo: '코스피', unit: 'KRW', decimals: 0, color: '#00ff88',
  },
  USDKRW: {
    id: 'USDKRW', symbol: 'USDKRW=X', tvSymbol: 'FX_IDC:USDKRW',
    nameKo: '달러/원 환율', unit: 'KRW', decimals: 1, color: '#ffb800',
  },
  TNX: {
    id: 'TNX', symbol: '^TNX', tvSymbol: 'TVC:US10Y',
    nameKo: '미국 10년 국채금리', unit: '%', decimals: 2, color: '#b48eff',
  },
  GOLD: {
    id: 'GOLD', symbol: 'GC=F', tvSymbol: 'COMEX:GC1!',
    nameKo: '금 (Gold)', unit: 'USD', decimals: 1, color: '#ffd700',
  },
};

export const ASSET_IDS: AssetId[] = ['BTC', 'SPY', 'KOSPI', 'USDKRW', 'TNX', 'GOLD'];

export const PERIODS: Array<{ id: Period; label: string }> = [
  { id: '1Y',  label: '1년'  },
  { id: '5Y',  label: '5년'  },
  { id: '10Y', label: '10년' },
  { id: 'ALL', label: '전체' },
];

export const ROLLING_WINDOWS: Array<{ value: RollingWindow; label: string }> = [
  { value: 30,  label: '30일' },
  { value: 90,  label: '90일' },
  { value: 180, label: '180일' },
];

export const PERIOD_RANGE_MAP: Record<Period, string> = {
  '1Y':  '1y',
  '5Y':  '5y',
  '10Y': '10y',
  'ALL': 'max',
};

export const REFRESH_INTERVAL_MS = 60_000;

// ─── News categories ────────────────────────────────────────────────────────
export const NEWS_CATEGORIES: Array<{ id: NewsCategory; labelKo: string; emoji: string }> = [
  { id: 'crypto',    labelKo: '암호화폐',        emoji: '₿' },
  { id: 'us_market', labelKo: '미국 증시',        emoji: '🇺🇸' },
  { id: 'kr_market', labelKo: '한국 증시',        emoji: '🇰🇷' },
  { id: 'fx_macro',  labelKo: '환율·거시경제',   emoji: '💱' },
  { id: 'commodity', labelKo: '원자재',           emoji: '🥇' },
];

// ─── VSA Config ─────────────────────────────────────────────────────────────
export const VSA_CONFIG = {
  RSI_PERIOD: 14,
  RSI_OVERSOLD_STRONG: 30,
  RSI_OVERSOLD_EXTREME: 25,
  VOLUME_LOOKBACK: 20,
  VOLUME_MULTIPLIER_STRONG: 1.5,
  VOLUME_MULTIPLIER_EXTREME: 2.0,
} as const;
