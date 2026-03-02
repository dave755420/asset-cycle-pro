'use client';

/**
 * S&P 500 VSA 스캐너 — 완전 클라이언트 사이드
 * 브라우저에서 Yahoo Finance에 직접 요청 → Vercel 타임아웃 문제 완전 해결
 */

import { useState, useCallback } from 'react';
import { SP500_UNIVERSE, SP500_SECTORS } from '@/lib/sp500-symbols';

interface Bar {
  date: string; open: number; high: number;
  low: number; close: number; volume: number;
}

interface ScanResult {
  symbol: string; name: string; sector: string;
  signal: 'buy' | 'sell'; signalKo: string; date: string;
  price: number; change: number; changePct: number;
  volume: number; volumeAvg: number; volumeMultiple: number;
  bodyRatio: number; descKo: string;
}

// ─── Yahoo Finance 직접 fetch (브라우저에서 호출) ─────────────────────────────
async function fetchBars(symbol: string): Promise<Bar[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=60d&corsDomain=finance.yahoo.com`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as any;
    const result = json?.chart?.result?.[0];
    if (!result) return [];
    const timestamps: number[] = result.timestamp ?? [];
    const q = result.indicators?.quote?.[0] ?? {};
    return timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().slice(0, 10),
        open:   (q.open   as number[])?.[i] ?? 0,
        high:   (q.high   as number[])?.[i] ?? 0,
        low:    (q.low    as number[])?.[i] ?? 0,
        close:  (q.close  as number[])?.[i] ?? 0,
        volume: (q.volume as number[])?.[i] ?? 0,
      }))
      .filter(b => b.close > 0 && b.volume > 0);
  } catch { return []; }
}

// ─── VSA 조건 판별 ─────────────────────────────────────────────────────────────
function detectSignal(bars: Bar[]): Omit<ScanResult, 'symbol' | 'name' | 'sector'> | null {
  if (bars.length < 22) return null;
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];

  const spread     = last.high - last.low;
  const prevSpread = prev.high - prev.low;
  const body       = Math.abs(last.close - last.open);
  const bodyRatio  = spread > 0 ? body / spread : 0;
  const bullBar    = last.close > last.open;
  const bearBar    = last.close < last.open;

  const volSlice   = bars.slice(-21, -1).map(b => b.volume);
  const volumeAvg  = volSlice.reduce((a, b) => a + b, 0) / volSlice.length;
  const volHigh    = last.volume > volumeAvg * 1.5;
  const volumeMultiple = volumeAvg > 0 ? last.volume / volumeAvg : 1;
  const change     = last.close - prev.close;
  const changePct  = prev.close > 0 ? (change / prev.close) * 100 : 0;

  // Stopping Volume (매수)
  const stoppingVolume =
    last.low < prev.low && bullBar && volHigh &&
    last.close > prev.close && spread > prevSpread;

  // Upthrust (매도)
  const upthrust =
    last.high > prev.high && bearBar && volHigh &&
    last.close < prev.close && spread > prevSpread &&
    last.close < prev.open;

  if (stoppingVolume) return {
    signal: 'buy', signalKo: '매수 — Stopping Volume',
    date: last.date, price: last.close, change, changePct,
    volume: last.volume, volumeAvg, volumeMultiple, bodyRatio,
    descKo: `신저가(${last.low.toFixed(2)}) 후 양봉 마감. 거래량 ${volumeMultiple.toFixed(1)}배 급증. 스마트머니 매집 가능성.`,
  };

  if (upthrust) return {
    signal: 'sell', signalKo: '매도 — Upthrust',
    date: last.date, price: last.close, change, changePct,
    volume: last.volume, volumeAvg, volumeMultiple, bodyRatio,
    descKo: `신고가(${last.high.toFixed(2)}) 달성 후 음봉 반락. 거래량 ${volumeMultiple.toFixed(1)}배 급증. 분배 가능성.`,
  };

  return null;
}

// ─── UI 컴포넌트 ──────────────────────────────────────────────────────────────
function fmt(n: number, d = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtVol(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function SignalCard({ r }: { r: ScanResult }) {
  const isBuy = r.signal === 'buy';
  const c = isBuy ? '#00ff88' : '#ff4466';
  return (
    <div className="p-4 rounded-xl border hover:opacity-90 transition-all"
      style={{ backgroundColor: `${c}10`, borderColor: `${c}35` }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold px-2 py-1 rounded"
            style={{ color: c, backgroundColor: `${c}18`, border: `1px solid ${c}35` }}>
            {r.symbol}
          </span>
          <div>
            <p className="text-xs font-semibold text-[#e8f0ff]">{r.name}</p>
            <p className="text-[10px] text-[#4a6080]">{r.sector}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-mono font-bold text-[#e8f0ff]">${fmt(r.price)}</p>
          <p className={`text-[11px] font-mono ${r.changePct >= 0 ? 'text-[#00ff88]' : 'text-[#ff4466]'}`}>
            {r.changePct >= 0 ? '▲' : '▼'} {Math.abs(r.changePct).toFixed(2)}%
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] font-bold" style={{ color: c }}>{isBuy ? '▲' : '▼'} {r.signalKo}</span>
        <span className="text-[10px] font-mono text-[#4a6080]">{r.date}</span>
      </div>
      <p className="text-[11px] text-[#c8d8f0] leading-relaxed mb-3">{r.descKo}</p>
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { label: '거래량 배율', val: `×${r.volumeMultiple.toFixed(1)}`, color: c },
          { label: '거래량',     val: fmtVol(r.volume),                   color: '#c8d8f0' },
          { label: '몸통 비율', val: `${(r.bodyRatio * 100).toFixed(0)}%`, color: '#c8d8f0' },
        ].map(s => (
          <div key={s.label} className="text-center p-2 rounded bg-[#0a0e1a] border border-[#1e2d4a]">
            <p className="text-[9px] text-[#4a6080] mb-0.5">{s.label}</p>
            <p className="text-xs font-mono font-bold" style={{ color: s.color }}>{s.val}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 메인 패널 ────────────────────────────────────────────────────────────────
const BATCH_SIZE = 10; // 동시에 10개씩

export function SP500ScanPanel() {
  const [results, setResults]         = useState<ScanResult[]>([]);
  const [scanning, setScanning]       = useState(false);
  const [scannedCount, setScannedCount] = useState(0);
  const [scannedAt, setScannedAt]     = useState('');
  const [activeTab, setActiveTab]     = useState<'buy' | 'sell'>('buy');
  const [sectorFilter, setSectorFilter] = useState('전체');
  const [hasScanned, setHasScanned]   = useState(false);

  const runScan = useCallback(async () => {
    setScanning(true);
    setResults([]);
    setScannedCount(0);

    const found: ScanResult[] = [];

    for (let i = 0; i < SP500_UNIVERSE.length; i += BATCH_SIZE) {
      const batch = SP500_UNIVERSE.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(async stock => {
          const bars = await fetchBars(stock.symbol);
          const sig = detectSignal(bars);
          if (!sig) return null;
          return { symbol: stock.symbol, name: stock.name, sector: stock.sector, ...sig } as ScanResult;
        })
      );

      for (const r of batchResults) {
        if (r.status === 'fulfilled' && r.value) found.push(r.value);
      }

      const newCount = Math.min(i + BATCH_SIZE, SP500_UNIVERSE.length);
      setScannedCount(newCount);
      // 중간 결과 실시간 업데이트
      setResults([...found]);
    }

    setScannedAt(new Date().toISOString());
    setHasScanned(true);
    setScanning(false);
  }, []);

  const progress   = SP500_UNIVERSE.length > 0 ? Math.round((scannedCount / SP500_UNIVERSE.length) * 100) : 0;
  const buySignals  = results.filter(r => r.signal === 'buy').sort((a, b) => b.volumeMultiple - a.volumeMultiple);
  const sellSignals = results.filter(r => r.signal === 'sell').sort((a, b) => b.volumeMultiple - a.volumeMultiple);
  const current    = activeTab === 'buy' ? buySignals : sellSignals;
  const filtered   = sectorFilter === '전체' ? current : current.filter(r => r.sector === sectorFilter);

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xs font-bold text-[#e8f0ff]">S&P 500 VSA 스캐너</h2>
          <p className="text-[10px] text-[#4a6080] font-mono mt-0.5">
            {scanning
              ? `스캔 중... ${scannedCount}/${SP500_UNIVERSE.length}종목 — 시그널 ${results.length}개 감지`
              : scannedAt
                ? `${SP500_UNIVERSE.length}개 완료 · ${new Date(scannedAt).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })} KST`
                : '스캔 대기 중 (브라우저 직접 분석)'
            }
          </p>
        </div>
        <button
          onClick={runScan} disabled={scanning}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-semibold border transition-all
            ${scanning
              ? 'border-[#1e2d4a] text-[#4a6080] cursor-not-allowed'
              : 'border-[#00d4ff50] text-[#00d4ff] bg-[#00d4ff12] hover:bg-[#00d4ff20]'
            }`}
        >
          {scanning
            ? <><span className="inline-block w-3 h-3 border border-t-transparent border-[#4a6080] rounded-full animate-spin" />스캔 중...</>
            : '↺ 스캔 시작'
          }
        </button>
      </div>

      {/* 알고리즘 설명 */}
      <div className="p-3 rounded-lg bg-[#0a0e1a] border border-[#1e2d4a] text-[10px] font-mono text-[#4a6080] leading-relaxed">
        <span className="text-[#00ff88]">▲ 매수(Stopping Volume)</span>: 신저가 + 양봉 + 거래량 1.5배↑ + 종가 상승 + 스프레드 확대
        <br/>
        <span className="text-[#ff4466]">▼ 매도(Upthrust)</span>: 신고가 + 음봉 + 거래량 1.5배↑ + 종가 하락 + 스프레드 확대 + 전봉 시가 하향
      </div>

      {/* 진행 바 */}
      {scanning && (
        <div className="space-y-1">
          <div className="h-1.5 bg-[#1e2d4a] rounded-full overflow-hidden">
            <div className="h-full bg-[#00d4ff] rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[10px] font-mono text-[#4a6080] text-right">{progress}% 완료 — 감지: {results.length}개</p>
        </div>
      )}

      {/* 시그널 탭 */}
      {hasScanned && (
        <div className="flex gap-2">
          {([
            { id: 'buy'  as const, label: '▲ 매수 시그널', count: buySignals.length,  color: '#00ff88' },
            { id: 'sell' as const, label: '▼ 매도 시그널', count: sellSignals.length, color: '#ff4466' },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border transition-all"
              style={activeTab === tab.id
                ? { color: tab.color, backgroundColor: `${tab.color}15`, borderColor: `${tab.color}45` }
                : { color: '#4a6080', borderColor: '#1e2d4a' }
              }
            >
              {tab.label}
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
                style={activeTab === tab.id
                  ? { backgroundColor: `${tab.color}25`, color: tab.color }
                  : { backgroundColor: '#1e2d4a', color: '#4a6080' }
                }>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* 섹터 필터 */}
      {hasScanned && current.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {['전체', ...SP500_SECTORS].map(s => (
            <button key={s} onClick={() => setSectorFilter(s)}
              className={`px-2.5 py-1 rounded text-[10px] font-mono border transition-all
                ${sectorFilter === s
                  ? 'bg-[#00d4ff18] border-[#00d4ff50] text-[#00d4ff]'
                  : 'border-[#1e2d4a] text-[#4a6080] hover:border-[#2a3d5a]'
                }`}
            >{s}</button>
          ))}
        </div>
      )}

      {/* 결과 */}
      {!hasScanned && !scanning ? (
        <div className="text-center py-16 text-[#4a6080]">
          <p className="text-3xl mb-3">◎</p>
          <p className="text-sm">스캔 시작 버튼을 눌러 S&P 500 전체를 분석합니다</p>
          <p className="text-xs mt-1 text-[#2a3d5a]">브라우저에서 직접 분석 · 약 30~60초 소요</p>
        </div>
      ) : filtered.length === 0 && !scanning ? (
        <div className="text-center py-12 text-[#4a6080]">
          <p className="text-2xl mb-2">{activeTab === 'buy' ? '▲' : '▼'}</p>
          <p className="text-sm">
            {sectorFilter !== '전체' ? `${sectorFilter} 섹터에서 ` : ''}
            {activeTab === 'buy' ? '매수' : '매도'} 시그널 없음
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(r => <SignalCard key={`${r.symbol}-${r.date}`} r={r} />)}
          {scanning && [...Array(3)].map((_, i) => (
            <div key={i} className="p-4 rounded-xl border border-[#1e2d4a] bg-[#0f1628] animate-pulse h-40" />
          ))}
        </div>
      )}

      <p className="text-[10px] text-[#2a3d5a] text-center pt-2">
        ⚠ 본 시그널은 알고리즘 분석 결과이며 투자 권유가 아닙니다.
      </p>
    </div>
  );
}
