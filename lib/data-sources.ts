/**
 * lib/data-sources.ts
 * 다중 데이터 소스 — Yahoo → Alpha Vantage → Finnhub 순서로 자동 전환
 *
 * 환경 변수 (Vercel에 설정):
 *   ALPHA_VANTAGE_KEY  : https://www.alphavantage.co/support/#api-key (무료)
 *   FINNHUB_KEY        : https://finnhub.io/register (무료)
 */

export interface QuoteResult {
  price: number;
  prevClose: number;
  src: 'yahoo' | 'alphavantage' | 'finnhub' | 'fallback';
}

export interface BarResult {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── 심볼 매핑 테이블 ─────────────────────────────────────────────────────────
const AV_SYMBOL: Record<string, string> = {
  'BTC-USD': 'BTC',  'SPY': 'SPY',   '^KS11': '',
  'GC=F': '',        '^TNX': '',     'USDKRW=X': 'KRW',
};

const FINNHUB_SYMBOL: Record<string, string> = {
  'BTC-USD': 'BINANCE:BTCUSDT', 'SPY': 'SPY',
  'GC=F': 'OANDA:XAU_USD',      'USDKRW=X': 'OANDA:USD_KRW',
  '^KS11': '', '^TNX': '',
};

// ─── Yahoo Finance (v8) ──────────────────────────────────────────────────────
async function fetchYahooQuote(symbol: string): Promise<QuoteResult | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as any;
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price     = meta.regularMarketPrice ?? 0;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
    if (!price) return null;
    return { price, prevClose, src: 'yahoo' };
  } catch { return null; }
}

// ─── Alpha Vantage ────────────────────────────────────────────────────────────
async function fetchAVQuote(symbol: string): Promise<QuoteResult | null> {
  const apiKey = process.env.ALPHA_VANTAGE_KEY;
  if (!apiKey) return null;
  const avSym = AV_SYMBOL[symbol];
  if (!avSym) return null;
  try {
    // 암호화폐
    if (symbol === 'BTC-USD') {
      const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=BTC&to_currency=USD&apikey=${apiKey}`;
      const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json = await res.json() as any;
      const rate = json?.['Realtime Currency Exchange Rate'];
      if (!rate) return null;
      const price = parseFloat(rate['5. Exchange Rate'] ?? '0');
      if (!price) return null;
      return { price, prevClose: price * 0.99, src: 'alphavantage' };
    }
    // 주식
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${avSym}&apikey=${apiKey}`;
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as any;
    const q = json?.['Global Quote'];
    if (!q) return null;
    const price     = parseFloat(q['05. price'] ?? '0');
    const prevClose = parseFloat(q['08. previous close'] ?? '0');
    if (!price) return null;
    return { price, prevClose: prevClose || price, src: 'alphavantage' };
  } catch { return null; }
}

// ─── Finnhub ──────────────────────────────────────────────────────────────────
async function fetchFinnhubQuote(symbol: string): Promise<QuoteResult | null> {
  const apiKey = process.env.FINNHUB_KEY;
  if (!apiKey) return null;
  const fSym = FINNHUB_SYMBOL[symbol];
  if (!fSym) return null;
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${fSym}&token=${apiKey}`;
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as any;
    const price     = json?.c ?? 0;
    const prevClose = json?.pc ?? 0;
    if (!price) return null;
    return { price, prevClose: prevClose || price, src: 'finnhub' };
  } catch { return null; }
}

// ─── 통합 시세 조회 (폭포식 fallback) ────────────────────────────────────────
export async function fetchQuoteMultiSource(symbol: string): Promise<QuoteResult> {
  const fallbackPrices: Record<string, [number, number]> = {
    'BTC-USD': [88000, 87500], 'SPY': [565, 562], '^KS11': [2550, 2540],
    'USDKRW=X': [1460, 1458], '^TNX': [4.30, 4.28], 'GC=F': [2920, 2910],
  };

  // 1순위: Yahoo
  const yahoo = await fetchYahooQuote(symbol);
  if (yahoo) return yahoo;

  // 2순위: Alpha Vantage
  const av = await fetchAVQuote(symbol);
  if (av) return av;

  // 3순위: Finnhub
  const fh = await fetchFinnhubQuote(symbol);
  if (fh) return fh;

  // 최후 fallback
  const [price, prevClose] = fallbackPrices[symbol] ?? [100, 99];
  return { price, prevClose, src: 'fallback' };
}

// ─── 히스토리 (Yahoo 우선, Alpha Vantage 보조) ───────────────────────────────
export async function fetchHistoryMultiSource(symbol: string, range: string): Promise<BarResult[]> {
  // Yahoo 시도
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120' },
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json = await res.json() as any;
      const result = json?.chart?.result?.[0];
      if (result) {
        const timestamps: number[] = result.timestamp ?? [];
        const q = result.indicators?.quote?.[0] ?? {};
        const bars = timestamps
          .map((ts, i) => ({
            date:   new Date(ts * 1000).toISOString().slice(0, 10),
            open:   (q.open   as number[])?.[i] ?? 0,
            high:   (q.high   as number[])?.[i] ?? 0,
            low:    (q.low    as number[])?.[i] ?? 0,
            close:  (q.close  as number[])?.[i] ?? 0,
            volume: (q.volume as number[])?.[i] ?? 0,
          }))
          .filter(b => b.close > 0);
        if (bars.length > 10) return bars;
      }
    }
  } catch { /* fall through */ }

  // Alpha Vantage 시도 (SPY, 주식만)
  const apiKey = process.env.ALPHA_VANTAGE_KEY;
  const avSym  = AV_SYMBOL[symbol];
  if (apiKey && avSym && symbol !== 'BTC-USD') {
    try {
      const outputSize = range === '5y' || range === '2y' ? 'full' : 'compact';
      const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${avSym}&outputsize=${outputSize}&apikey=${apiKey}`;
      const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const json = await res.json() as any;
        const ts = json?.['Time Series (Daily)'];
        if (ts) {
          return Object.entries(ts)
            .map(([date, v]: [string, unknown]) => {
              const vals = v as Record<string, string>;
              return {
                date,
                open:   parseFloat(vals['1. open']   ?? '0'),
                high:   parseFloat(vals['2. high']   ?? '0'),
                low:    parseFloat(vals['3. low']    ?? '0'),
                close:  parseFloat(vals['4. close']  ?? '0'),
                volume: parseFloat(vals['5. volume'] ?? '0'),
              };
            })
            .filter(b => b.close > 0)
            .sort((a, b) => a.date.localeCompare(b.date));
        }
      }
    } catch { /* fall through */ }
  }

  return []; // 모든 소스 실패
}
