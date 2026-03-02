// ============================================================
// TYPES — Asset Cycle Pro v2
// ============================================================

export type AssetId = 'BTC' | 'SPY' | 'KOSPI' | 'USDKRW' | 'TNX' | 'GOLD';

export type Period = '1Y' | '5Y' | '10Y' | 'ALL';
export type RollingWindow = 30 | 90 | 180;

// TradingView 심볼 매핑
export type TVSymbol = string;

export interface AssetMeta {
  id: AssetId;
  symbol: string;         // Yahoo Finance symbol
  tvSymbol: TVSymbol;     // TradingView symbol
  nameKo: string;
  unit: string;
  decimals: number;
  color: string;
}

export interface PricePoint {
  date: string;
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

// Weekly aggregated for VSA
export interface WeeklyBar {
  weekStart: string;      // Monday date ISO
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AssetQuote {
  id: AssetId;
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  updatedAt: string;
  source: 'yahoo' | 'backup' | 'fallback';
  isStale?: boolean;
}

export interface AssetHistory {
  id: AssetId;
  period: Period;
  data: PricePoint[];
  fetchedAt: string;
}

export interface CorrelationMatrix {
  assets: AssetId[];
  matrix: number[][];
  period: Period;
  window: RollingWindow;
  computedAt: string;
}

export interface RollingCorrelation {
  assetA: AssetId;
  assetB: AssetId;
  data: Array<{ date: string; value: number }>;
}

export interface LeadLagResult {
  assetA: AssetId;
  assetB: AssetId;
  lag: number;
  correlation: number;
}

export interface QuantInsight {
  id: string;
  type: 'correlation' | 'leadlag' | 'divergence' | 'risk';
  titleKo: string;
  bodyKo: string;
  severity: 'info' | 'warning' | 'alert';
  assets: AssetId[];
  value?: number;
}

// ─── VSA Types ──────────────────────────────────────────────────────────────
export interface VSASignal {
  id: string;
  assetId: AssetId;
  weekStart: string;       // Signal week
  rsi: number;             // RSI at signal
  rsiThreshold: number;    // e.g. 25
  volume: number;          // Week volume
  volumeAvg: number;       // 20-week avg
  volumeMultiple: number;  // volume / volumeAvg
  titleKo: string;
  bodyKo: string;
  severity: 'strong' | 'extreme';
  isRecent: boolean;       // Within last 4 weeks
}

export interface VSAAnalysisResult {
  assetId: AssetId;
  signals: VSASignal[];
  latestRsi: number;
  latestVolMultiple: number;
  analyzedAt: string;
  weeklyBars: WeeklyBar[];
  rsiSeries: Array<{ date: string; rsi: number }>;
}

// ─── News Types ─────────────────────────────────────────────────────────────
export type NewsCategory = 'crypto' | 'us_market' | 'kr_market' | 'fx_macro' | 'commodity';

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;    // ISO
  category: NewsCategory;
  summary?: string;
}

export interface NewsFeed {
  category: NewsCategory;
  labelKo: string;
  items: NewsItem[];
  fetchedAt: string;
  error?: string;
}

export interface DashboardData {
  quotes: AssetQuote[];
  correlationMatrix: CorrelationMatrix;
  insights: QuantInsight[];
  updatedAt: string;
}
