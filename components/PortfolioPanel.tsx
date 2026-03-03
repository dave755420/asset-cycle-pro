'use client';

/**
 * components/PortfolioPanel.tsx
 * 포트폴리오 트래커 — 보유 자산 실시간 손익 추적
 * 데이터는 localStorage에 저장 (서버 불필요)
 */

import { useState, useEffect, useCallback } from 'react';

interface Holding {
  id: string;
  symbol: string;
  nameKo: string;
  quantity: number;
  avgPrice: number;
  currency: 'USD' | 'KRW';
}

interface HoldingWithPrice extends Holding {
  currentPrice: number;
  currentValue: number;
  costBasis: number;
  pnl: number;
  pnlPct: number;
  loading: boolean;
}

const PRESET_ASSETS = [
  { symbol: 'BTC-USD',  nameKo: '비트코인',     currency: 'USD' as const },
  { symbol: 'SPY',      nameKo: 'S&P 500 (SPY)', currency: 'USD' as const },
  { symbol: 'GC=F',     nameKo: '금 (Gold)',      currency: 'USD' as const },
  { symbol: 'USDKRW=X', nameKo: '달러/원 환율',  currency: 'KRW' as const },
  { symbol: '^KS11',    nameKo: '코스피',         currency: 'KRW' as const },
  { symbol: '^TNX',     nameKo: '미 국채 10Y',    currency: 'USD' as const },
];

const STORAGE_KEY = 'asset-cycle-portfolio-v1';

function loadHoldings(): Holding[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch { return []; }
}

function saveHoldings(holdings: Holding[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings));
}

async function fetchCurrentPrice(symbol: string): Promise<number> {
  try {
    const res = await fetch(`/api/quant-data?symbol=${encodeURIComponent(symbol)}&range=5d&interval=1d`, { cache: 'no-store' });
    if (!res.ok) return 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as any;
    return json?.chart?.result?.[0]?.meta?.regularMarketPrice ?? 0;
  } catch { return 0; }
}

const fmtUSD = (v: number) => v >= 1000 ? `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : `$${v.toFixed(2)}`;
const fmtKRW = (v: number) => `₩${(v / 10000).toFixed(0)}만`;
const fmtPct  = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

export function PortfolioPanel() {
  const [holdings, setHoldings]   = useState<Holding[]>([]);
  const [prices, setPrices]       = useState<Record<string, number>>({});
  const [loadingP, setLoadingP]   = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [usdKrw, setUsdKrw]       = useState(1460);

  // 폼 상태
  const [form, setForm] = useState({
    symbol: PRESET_ASSETS[0].symbol,
    nameKo: PRESET_ASSETS[0].nameKo,
    currency: PRESET_ASSETS[0].currency,
    quantity: '',
    avgPrice: '',
  });

  // 초기 로드
  useEffect(() => {
    setHoldings(loadHoldings());
  }, []);

  // 가격 갱신
  const refreshPrices = useCallback(async (hs: Holding[]) => {
    if (hs.length === 0) return;
    setLoadingP(true);
    const symbols = [...new Set(hs.map(h => h.symbol))];
    symbols.push('USDKRW=X');
    const results = await Promise.all(symbols.map(async s => ({ s, p: await fetchCurrentPrice(s) })));
    const map: Record<string, number> = {};
    for (const { s, p } of results) map[s] = p;
    if (map['USDKRW=X']) setUsdKrw(map['USDKRW=X']);
    setPrices(map);
    setLoadingP(false);
  }, []);

  useEffect(() => { refreshPrices(holdings); }, [holdings, refreshPrices]);

  // 보유 자산 + 가격 합치기
  const enriched: HoldingWithPrice[] = holdings.map(h => {
    const currentPrice = prices[h.symbol] ?? 0;
    const costBasis    = h.quantity * h.avgPrice;
    const currentValue = h.quantity * currentPrice;
    const pnl          = currentValue - costBasis;
    const pnlPct       = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
    return { ...h, currentPrice, currentValue, costBasis, pnl, pnlPct, loading: loadingP && !prices[h.symbol] };
  });

  // 총계
  const totalCost  = enriched.reduce((a, h) => {
    const v = h.currency === 'USD' ? h.costBasis * usdKrw : h.costBasis;
    return a + v;
  }, 0);
  const totalValue = enriched.reduce((a, h) => {
    const v = h.currency === 'USD' ? h.currentValue * usdKrw : h.currentValue;
    return a + v;
  }, 0);
  const totalPnl    = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  // 자산 추가
  const handleAdd = () => {
    if (!form.quantity || !form.avgPrice) return;
    const newH: Holding = {
      id:       `${form.symbol}-${Date.now()}`,
      symbol:   form.symbol,
      nameKo:   form.nameKo,
      quantity: parseFloat(form.quantity),
      avgPrice: parseFloat(form.avgPrice),
      currency: form.currency,
    };
    const updated = [...holdings, newH];
    setHoldings(updated);
    saveHoldings(updated);
    setShowForm(false);
    setForm({ ...form, quantity: '', avgPrice: '' });
  };

  // 자산 삭제
  const handleDelete = (id: string) => {
    const updated = holdings.filter(h => h.id !== id);
    setHoldings(updated);
    saveHoldings(updated);
  };

  return (
    <div className="space-y-5">

      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#e8f0ff]">💼 포트폴리오 트래커</h2>
          <p className="text-[10px] text-[#4a6080] font-mono mt-0.5">보유 자산 실시간 손익 · USD/KRW {usdKrw.toFixed(0)}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refreshPrices(holdings)}
            className="px-3 py-1.5 rounded border border-[#1e2d4a] text-[10px] font-mono text-[#4a6080] hover:border-[#00d4ff] hover:text-[#00d4ff] transition-colors">
            ↺ 갱신
          </button>
          <button onClick={() => setShowForm(!showForm)}
            className="px-4 py-1.5 rounded border border-[#00ff8850] bg-[#00ff8810] text-[10px] font-mono text-[#00ff88] hover:bg-[#00ff8820] transition-colors">
            + 자산 추가
          </button>
        </div>
      </div>

      {/* 총 손익 요약 */}
      {holdings.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '총 평가금액',  value: fmtKRW(totalValue), color: '#e8f0ff' },
            { label: '총 손익',      value: fmtKRW(totalPnl),   color: totalPnl >= 0 ? '#00ff88' : '#ff4466' },
            { label: '수익률',       value: fmtPct(totalPnlPct), color: totalPnlPct >= 0 ? '#00ff88' : '#ff4466' },
          ].map(m => (
            <div key={m.label} className="p-4 rounded-xl bg-[#0a0e1a] border border-[#1e2d4a] text-center">
              <p className="text-[10px] text-[#4a6080] font-mono mb-1">{m.label}</p>
              <p className="text-lg font-bold font-mono" style={{ color: m.color }}>{m.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* 자산 추가 폼 */}
      {showForm && (
        <div className="p-4 rounded-xl bg-[#0a0e1a] border border-[#00d4ff30] space-y-3">
          <p className="text-[11px] font-bold text-[#00d4ff] font-mono">+ 보유 자산 추가</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[#4a6080] font-mono">자산 선택</label>
              <select
                value={form.symbol}
                onChange={e => {
                  const a = PRESET_ASSETS.find(p => p.symbol === e.target.value)!;
                  setForm({ ...form, symbol: a.symbol, nameKo: a.nameKo, currency: a.currency });
                }}
                className="w-full mt-1 px-2 py-1.5 rounded bg-[#0f1628] border border-[#1e2d4a] text-[11px] font-mono text-[#c8d8f0]"
              >
                {PRESET_ASSETS.map(a => (
                  <option key={a.symbol} value={a.symbol}>{a.nameKo}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#4a6080] font-mono">수량</label>
              <input type="number" placeholder="0.00" value={form.quantity}
                onChange={e => setForm({ ...form, quantity: e.target.value })}
                className="w-full mt-1 px-2 py-1.5 rounded bg-[#0f1628] border border-[#1e2d4a] text-[11px] font-mono text-[#c8d8f0] placeholder-[#2a3d5a]"
              />
            </div>
            <div>
              <label className="text-[10px] text-[#4a6080] font-mono">평균 매수가 ({form.currency})</label>
              <input type="number" placeholder="0.00" value={form.avgPrice}
                onChange={e => setForm({ ...form, avgPrice: e.target.value })}
                className="w-full mt-1 px-2 py-1.5 rounded bg-[#0f1628] border border-[#1e2d4a] text-[11px] font-mono text-[#c8d8f0] placeholder-[#2a3d5a]"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd}
              className="px-4 py-1.5 rounded border border-[#00ff8850] bg-[#00ff8810] text-[11px] font-mono text-[#00ff88] hover:bg-[#00ff8820] transition-colors">
              추가
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-1.5 rounded border border-[#1e2d4a] text-[11px] font-mono text-[#4a6080] hover:border-[#ff4466] hover:text-[#ff4466] transition-colors">
              취소
            </button>
          </div>
        </div>
      )}

      {/* 보유 자산 목록 */}
      {holdings.length === 0 ? (
        <div className="text-center py-16 text-[#4a6080]">
          <p className="text-4xl mb-3">💼</p>
          <p className="text-sm">보유 자산을 추가하면 실시간 손익이 표시됩니다</p>
          <button onClick={() => setShowForm(true)}
            className="mt-4 px-5 py-2 rounded-lg border border-[#00ff8840] text-[#00ff88] text-xs font-mono hover:bg-[#00ff8815] transition-all">
            + 첫 자산 추가
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {enriched.map(h => (
            <div key={h.id} className="p-4 rounded-xl bg-[#0a0e1a] border border-[#1e2d4a] hover:border-[#2a3d5a] transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#1e2d4a] flex items-center justify-center text-xs font-bold text-[#c8d8f0]">
                    {h.nameKo.slice(0, 1)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#e8f0ff]">{h.nameKo}</p>
                    <p className="text-[10px] text-[#4a6080] font-mono">{h.quantity} × {h.currency === 'USD' ? fmtUSD(h.avgPrice) : `₩${h.avgPrice.toLocaleString()}`}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs font-mono text-[#c8d8f0]">
                      {h.loading ? '...' : (h.currency === 'USD' ? fmtUSD(h.currentPrice) : `₩${h.currentPrice.toLocaleString()}`)}
                    </p>
                    <p className="text-[10px] text-[#4a6080] font-mono">현재가</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold font-mono" style={{ color: h.pnl >= 0 ? '#00ff88' : '#ff4466' }}>
                      {h.loading ? '...' : fmtPct(h.pnlPct)}
                    </p>
                    <p className="text-[10px] font-mono" style={{ color: h.pnl >= 0 ? '#00ff8880' : '#ff446680' }}>
                      {h.loading ? '' : (h.currency === 'USD' ? fmtUSD(Math.abs(h.pnl)) : fmtKRW(Math.abs(h.pnl)))} {h.pnl >= 0 ? '수익' : '손실'}
                    </p>
                  </div>
                  <button onClick={() => handleDelete(h.id)}
                    className="text-[#2a3d5a] hover:text-[#ff4466] transition-colors text-sm">✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-[#2a3d5a] text-center font-mono">
        💾 데이터는 이 브라우저에만 저장됩니다 · 투자 권유 아님
      </p>
    </div>
  );
}
