'use client';

/**
 * components/QuantLabPanel.tsx
 * 퀀트 랩 — 백테스트 + 자동 최적화
 * v2: /api/quant-data 서버 프록시 사용 (CORS 해결)
 */

import { useState, useCallback, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts';
import { STRATEGIES, STRATEGY_MAP } from '@/lib/quant-strategies';
import { runBacktest, runOptimize, suggestImprovement } from '@/lib/backtest-engine';
import type { BacktestResult, OptimizeResult, OptimizeProgress } from '@/lib/backtest-engine';
import type { Bar } from '@/lib/quant-strategies';

// ─── 자산 목록 ────────────────────────────────────────────────────────────────
const ASSETS = [
  { id: 'BTC-USD',  label: 'BTC (비트코인)',  color: '#f7931a' },
  { id: 'SPY',      label: 'SPY (S&P 500)',   color: '#00d4ff' },
  { id: '^KS11',    label: 'KOSPI (코스피)',   color: '#00ff88' },
  { id: 'GC=F',     label: 'GOLD (금)',        color: '#ffd700' },
  { id: '^TNX',     label: 'TNX (미 국채10Y)', color: '#b48eff' },
  { id: 'USDKRW=X', label: 'USD/KRW (환율)',  color: '#ffb800' },
];

const PERIODS = [
  { label: '1년', range: '1y' },
  { label: '2년', range: '2y' },
  { label: '5년', range: '5y' },
];

// ─── 서버 프록시를 통한 데이터 fetch ─────────────────────────────────────────
async function fetchBars(symbol: string, range: string): Promise<Bar[]> {
  try {
    const url = `/api/quant-data?symbol=${encodeURIComponent(symbol)}&range=${range}&interval=1d`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as any;
    const result = json?.chart?.result?.[0];
    if (!result) throw new Error('차트 데이터 없음');

    const timestamps: number[] = result.timestamp ?? [];
    const q = result.indicators?.quote?.[0] ?? {};

    const bars: Bar[] = timestamps
      .map((ts, i) => ({
        date:   new Date(ts * 1000).toISOString().slice(0, 10),
        open:   (q.open   as number[])?.[i] ?? 0,
        high:   (q.high   as number[])?.[i] ?? 0,
        low:    (q.low    as number[])?.[i] ?? 0,
        close:  (q.close  as number[])?.[i] ?? 0,
        volume: (q.volume as number[])?.[i] ?? 0,
      }))
      .filter(b => b.close > 0);

    return bars;
  } catch (e) {
    throw new Error(`데이터 로드 실패: ${(e as Error).message}`);
  }
}

// ─── 포맷 유틸 ────────────────────────────────────────────────────────────────
const fmtPct   = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
const fmtMoney = (v: number) => `₩${(v / 10000).toFixed(0)}만`;

// ─── MetricCard ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="p-3 rounded-lg bg-[#0a0e1a] border border-[#1e2d4a]">
      <p className="text-[10px] text-[#4a6080] font-mono mb-1">{label}</p>
      <p className="text-sm font-mono font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

// ─── 커스텀 툴팁 ──────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0d1117] border border-[#1e2d4a] rounded-lg p-2 text-[11px] font-mono">
      <p className="text-[#4a6080] mb-1">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {p.name === 'MDD' ? `${p.value.toFixed(1)}%` : fmtMoney(p.value)}
        </p>
      ))}
    </div>
  );
}

// ─── 거래 내역 테이블 ─────────────────────────────────────────────────────────
function TradeTable({ trades }: { trades: BacktestResult['trades'] }) {
  const [show, setShow] = useState(false);
  const visible = show ? trades : trades.slice(0, 5);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-[#4a6080] font-mono">거래 내역 ({trades.length}건)</p>
        {trades.length > 5 && (
          <button onClick={() => setShow(!show)} className="text-[10px] text-[#00d4ff] font-mono hover:underline">
            {show ? '접기' : `전체 보기 (${trades.length}건)`}
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] font-mono">
          <thead>
            <tr className="text-[#4a6080] border-b border-[#1e2d4a]">
              {['진입일', '청산일', '진입가', '청산가', '수익률', '보유일'].map(h => (
                <th key={h} className={`py-1.5 pr-3 ${h === '진입일' || h === '청산일' ? 'text-left' : 'text-right'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((t, i) => (
              <tr key={i} className="border-b border-[#0f1628] hover:bg-[#0f1628] transition-colors">
                <td className="py-1.5 pr-3 text-[#c8d8f0]">{t.entryDate}</td>
                <td className="py-1.5 pr-3 text-[#c8d8f0]">{t.exitDate}</td>
                <td className="py-1.5 pr-3 text-right text-[#c8d8f0]">{t.entryPrice.toFixed(2)}</td>
                <td className="py-1.5 pr-3 text-right text-[#c8d8f0]">{t.exitPrice.toFixed(2)}</td>
                <td className={`py-1.5 pr-3 text-right font-bold ${t.returnPct >= 0 ? 'text-[#00ff88]' : 'text-[#ff4466]'}`}>
                  {fmtPct(t.returnPct)}
                </td>
                <td className="py-1.5 text-right text-[#4a6080]">{t.holdDays}일</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── 최적화 결과 ──────────────────────────────────────────────────────────────
function OptResultTable({ results, onApply }: { results: OptimizeResult[]; onApply: (p: Record<string, number>) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] text-[#4a6080] font-mono">최적화 결과 TOP {results.length}</p>
      <div className="space-y-2">
        {results.slice(0, 5).map(r => (
          <div key={r.rank} className={`p-3 rounded-lg border transition-all ${r.rank === 1 ? 'border-[#00ffcc40] bg-[#00ffcc08]' : 'border-[#1e2d4a] bg-[#0a0e1a]'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold font-mono ${r.rank === 1 ? 'text-[#00ffcc]' : 'text-[#4a6080]'}`}>
                #{r.rank} {r.rank === 1 ? '⭐ 최적' : ''}
              </span>
              <button onClick={() => onApply(r.params)}
                className="text-[10px] px-2.5 py-1 rounded border border-[#00d4ff40] text-[#00d4ff] hover:bg-[#00d4ff15] transition-all font-mono">
                적용
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[
                { label: '샤프',   val: r.sharpe.toFixed(2),       color: r.sharpe >= 1 ? '#00ff88' : r.sharpe >= 0.5 ? '#ffb800' : '#ff4466' },
                { label: '수익률', val: fmtPct(r.totalReturn),     color: r.totalReturn >= 0 ? '#00ff88' : '#ff4466' },
                { label: 'MDD',    val: `${r.maxDrawdown.toFixed(1)}%`, color: r.maxDrawdown > -15 ? '#00ff88' : r.maxDrawdown > -30 ? '#ffb800' : '#ff4466' },
                { label: '승률',   val: `${r.winRate.toFixed(0)}%`, color: r.winRate >= 55 ? '#00ff88' : '#ffb800' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className="text-[9px] text-[#4a6080]">{s.label}</p>
                  <p className="text-xs font-mono font-bold" style={{ color: s.color }}>{s.val}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(r.params).map(([k, v]) => (
                <span key={k} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#1e2d4a] text-[#4a6080]">{k}={v}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 파라미터 슬라이더 ────────────────────────────────────────────────────────
function ParamSlider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <label className="text-[10px] text-[#4a6080] font-mono">{label}</label>
        <span className="text-[10px] font-mono font-bold text-[#00d4ff]">{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: '#00d4ff' }}
      />
      <div className="flex justify-between text-[9px] text-[#2a3d5a] font-mono">
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export function QuantLabPanel() {
  const [selectedAsset,    setSelectedAsset]    = useState(ASSETS[0].id);
  const [selectedPeriod,   setSelectedPeriod]   = useState(PERIODS[1].range);
  const [selectedStrategy, setSelectedStrategy] = useState(STRATEGIES[6].id);
  const [params, setParams] = useState<Record<string, number>>(
    Object.fromEntries(STRATEGIES[6].params.map(p => [p.key, p.default]))
  );
  const [btResult,    setBtResult]    = useState<BacktestResult | null>(null);
  const [optResults,  setOptResults]  = useState<OptimizeResult[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [optimizing,  setOptimizing]  = useState(false);
  const [optProgress, setOptProgress] = useState<OptimizeProgress | null>(null);
  const [activeView,  setActiveView]  = useState<'chart' | 'trades' | 'optimize'>('chart');
  const [error,       setError]       = useState('');
  const [dataInfo,    setDataInfo]    = useState('');
  const barsRef = useRef<Bar[]>([]);

  const handleStrategyChange = useCallback((id: string) => {
    setSelectedStrategy(id);
    setParams(Object.fromEntries(STRATEGY_MAP[id].params.map(p => [p.key, p.default])));
    setBtResult(null); setOptResults([]); setOptProgress(null);
  }, []);

  // 데이터 로드 (공통)
  const loadData = useCallback(async (): Promise<Bar[]> => {
    if (barsRef.current.length > 0) return barsRef.current;
    setDataInfo('📡 Yahoo Finance에서 데이터 로딩 중...');
    const bars = await fetchBars(selectedAsset, selectedPeriod);
    barsRef.current = bars;
    setDataInfo(`✅ ${bars.length}개 봉 로드 완료`);
    return bars;
  }, [selectedAsset, selectedPeriod]);

  // 백테스트 실행
  const handleBacktest = useCallback(async () => {
    setLoading(true); setError(''); setBtResult(null);
    try {
      const bars = await loadData();
      if (bars.length < 50) throw new Error(`데이터 부족: ${bars.length}봉 (최소 50봉 필요). 다른 자산이나 기간을 선택하세요.`);
      const result = runBacktest(bars, STRATEGY_MAP[selectedStrategy], params);
      setBtResult(result);
      setActiveView('chart');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [loadData, selectedStrategy, params]);

  // 자동 최적화
  const handleOptimize = useCallback(async () => {
    setOptimizing(true); setOptResults([]); setOptProgress(null); setActiveView('optimize');
    try {
      const bars = await loadData();
      if (bars.length < 50) throw new Error(`데이터 부족: ${bars.length}봉`);
      const results = await runOptimize(
        bars,
        STRATEGY_MAP[selectedStrategy],
        (p) => setOptProgress({ ...p }),
      );
      setOptResults(results);
      if (results.length > 0) {
        setParams(results[0].params);
        setBtResult(runBacktest(bars, STRATEGY_MAP[selectedStrategy], results[0].params));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOptimizing(false);
    }
  }, [loadData, selectedStrategy]);

  // 최적화 파라미터 적용
  const handleApplyParams = useCallback((p: Record<string, number>) => {
    setParams(p);
    if (barsRef.current.length > 0) {
      setBtResult(runBacktest(barsRef.current, STRATEGY_MAP[selectedStrategy], p));
      setActiveView('chart');
    }
  }, [selectedStrategy]);

  // 자산/기간 변경 시 캐시 초기화
  const resetData = useCallback(() => {
    barsRef.current = []; setBtResult(null); setOptResults([]); setDataInfo('');
  }, []);

  const strategy    = STRATEGY_MAP[selectedStrategy];
  const improvement = btResult ? suggestImprovement(btResult, strategy) : null;
  const assetInfo   = ASSETS.find(a => a.id === selectedAsset)!;

  return (
    <div className="space-y-5">

      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#e8f0ff]">⚗️ 퀀트 랩</h2>
          <p className="text-[10px] text-[#4a6080] font-mono mt-0.5">
            7가지 전략 백테스트 + 자동 파라미터 최적화 · 실시간 데이터
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleBacktest} disabled={loading || optimizing}
            className={`px-4 py-2 rounded-lg text-xs font-mono font-semibold border transition-all ${
              loading ? 'border-[#1e2d4a] text-[#4a6080] cursor-not-allowed'
              : 'border-[#00d4ff50] text-[#00d4ff] bg-[#00d4ff12] hover:bg-[#00d4ff20]'
            }`}>
            {loading
              ? <><span className="inline-block w-3 h-3 border border-t-transparent border-[#4a6080] rounded-full animate-spin mr-1" />로딩 중...</>
              : '▶ 백테스트'}
          </button>
          <button onClick={handleOptimize} disabled={loading || optimizing}
            className={`px-4 py-2 rounded-lg text-xs font-mono font-semibold border transition-all ${
              optimizing ? 'border-[#1e2d4a] text-[#4a6080] cursor-not-allowed'
              : 'border-[#00ffcc50] text-[#00ffcc] bg-[#00ffcc08] hover:bg-[#00ffcc15]'
            }`}>
            {optimizing
              ? <><span className="inline-block w-3 h-3 border border-t-transparent border-[#4a6080] rounded-full animate-spin mr-1" />최적화 중...</>
              : '🤖 자동 최적화'}
          </button>
        </div>
      </div>

      {/* 설정 패널 */}
      <div className="grid md:grid-cols-3 gap-4">

        {/* 자산 선택 */}
        <div className="space-y-2">
          <p className="text-[10px] text-[#4a6080] font-mono">대상 자산</p>
          <div className="grid grid-cols-2 gap-1.5">
            {ASSETS.map(a => (
              <button key={a.id}
                onClick={() => { setSelectedAsset(a.id); resetData(); }}
                className="px-2 py-1.5 rounded text-[10px] font-mono border transition-all text-left"
                style={selectedAsset === a.id
                  ? { borderColor: `${a.color}60`, backgroundColor: `${a.color}12`, color: a.color }
                  : { borderColor: '#1e2d4a', color: '#4a6080' }
                }
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* 기간 + 전략 */}
        <div className="space-y-3">
          <div>
            <p className="text-[10px] text-[#4a6080] font-mono mb-1.5">백테스트 기간</p>
            <div className="flex gap-2">
              {PERIODS.map(p => (
                <button key={p.range}
                  onClick={() => { setSelectedPeriod(p.range); resetData(); }}
                  className={`flex-1 py-1.5 rounded text-[10px] font-mono border transition-all ${
                    selectedPeriod === p.range ? 'border-[#00d4ff50] bg-[#00d4ff15] text-[#00d4ff]' : 'border-[#1e2d4a] text-[#4a6080]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-[#4a6080] font-mono mb-1.5">전략 선택</p>
            <div className="space-y-1">
              {STRATEGIES.map(s => (
                <button key={s.id} onClick={() => handleStrategyChange(s.id)}
                  className="w-full px-2.5 py-1.5 rounded text-[10px] font-mono border transition-all text-left"
                  style={selectedStrategy === s.id
                    ? { borderColor: `${s.color}60`, backgroundColor: `${s.color}10`, color: s.color }
                    : { borderColor: '#1e2d4a', color: '#4a6080' }
                  }
                >
                  {s.nameKo}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 파라미터 */}
        <div className="space-y-2">
          <p className="text-[10px] text-[#4a6080] font-mono">파라미터 조정</p>
          <div className="p-3 rounded-lg bg-[#0a0e1a] border border-[#1e2d4a] space-y-4">
            <p className="text-[10px] text-[#c8d8f0]">{strategy.descKo}</p>
            {strategy.params.map(p => (
              <ParamSlider key={p.key} label={p.label}
                value={params[p.key] ?? p.default}
                min={p.min} max={p.max} step={p.step}
                onChange={v => setParams(prev => ({ ...prev, [p.key]: v }))}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 데이터 로딩 상태 */}
      {dataInfo && (
        <div className="px-3 py-2 rounded-lg bg-[#0a0e1a] border border-[#1e2d4a] text-[10px] font-mono text-[#4a6080]">
          {dataInfo}
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="p-3 rounded-lg bg-[#ff446615] border border-[#ff446640] text-[11px] text-[#ff4466] font-mono">
          ⚠ {error}
        </div>
      )}

      {/* 최적화 진행 */}
      {optimizing && optProgress && (
        <div className="space-y-2 p-3 rounded-lg bg-[#0a0e1a] border border-[#1e2d4a]">
          <div className="flex justify-between text-[10px] font-mono text-[#4a6080]">
            <span>🤖 파라미터 탐색 중... {optProgress.tested}/{optProgress.total}</span>
            {optProgress.best && <span className="text-[#00ffcc]">현재 최고 샤프: {optProgress.best.sharpe.toFixed(2)}</span>}
          </div>
          <div className="h-1.5 bg-[#1e2d4a] rounded-full overflow-hidden">
            <div className="h-full bg-[#00ffcc] rounded-full transition-all duration-300"
              style={{ width: `${(optProgress.tested / optProgress.total) * 100}%` }} />
          </div>
        </div>
      )}

      {/* 결과 */}
      {btResult && (
        <div className="space-y-4">
          {/* 핵심 메트릭 */}
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {[
              { label: '총 수익률', value: fmtPct(btResult.totalReturn),         color: btResult.totalReturn >= 0 ? '#00ff88' : '#ff4466' },
              { label: 'CAGR',     value: fmtPct(btResult.cagr),                 color: btResult.cagr >= 0 ? '#00ff88' : '#ff4466' },
              { label: '샤프지수', value: btResult.sharpe.toFixed(2),            color: btResult.sharpe >= 1 ? '#00ff88' : btResult.sharpe >= 0.5 ? '#ffb800' : '#ff4466' },
              { label: 'MDD',      value: fmtPct(btResult.maxDrawdown),          color: btResult.maxDrawdown > -15 ? '#00ff88' : btResult.maxDrawdown > -30 ? '#ffb800' : '#ff4466' },
              { label: '승률',     value: `${btResult.winRate.toFixed(1)}%`,     color: btResult.winRate >= 55 ? '#00ff88' : '#ffb800' },
              { label: '손익비',   value: btResult.profitFactor.toFixed(2),      color: btResult.profitFactor >= 1.5 ? '#00ff88' : '#ffb800' },
              { label: '거래 횟수', value: `${btResult.numTrades}회`,            color: '#c8d8f0' },
              { label: '평균 보유', value: `${btResult.avgHoldDays}일`,          color: '#c8d8f0' },
            ].map(m => <MetricCard key={m.label} {...m} />)}
          </div>

          {/* 자가학습 진단 */}
          {improvement && (
            <div className="p-3 rounded-lg border text-[11px] font-mono"
              style={{
                borderColor: improvement.score === 'good' ? '#00ff8840' : improvement.score === 'ok' ? '#ffb80040' : '#ff446640',
                backgroundColor: improvement.score === 'good' ? '#00ff8808' : improvement.score === 'ok' ? '#ffb80008' : '#ff446808',
              }}>
              <span style={{ color: improvement.score === 'good' ? '#00ff88' : improvement.score === 'ok' ? '#ffb800' : '#ff4466' }}>
                {improvement.score === 'good' ? '✅ 전략 성과 양호' : improvement.score === 'ok' ? '⚠ 개선 여지 있음' : '🤖 자동 최적화 권장'}
              </span>
              {improvement.suggestions.map((s, i) => <p key={i} className="text-[#4a6080] mt-1">· {s}</p>)}
              {improvement.score === 'bad' && (
                <button onClick={handleOptimize}
                  className="mt-2 px-3 py-1 rounded border border-[#00ffcc40] text-[#00ffcc] text-[10px] hover:bg-[#00ffcc15] transition-all">
                  🤖 지금 바로 최적화 실행
                </button>
              )}
            </div>
          )}

          {/* 탭 */}
          <div className="flex gap-2">
            {([
              { id: 'chart',    label: '📈 자산 곡선' },
              { id: 'trades',   label: `📋 거래 내역 (${btResult.numTrades}건)` },
              { id: 'optimize', label: `⭐ 최적화 결과 (${optResults.length}개)` },
            ] as const).map(tab => (
              <button key={tab.id} onClick={() => setActiveView(tab.id)}
                className={`px-3 py-1.5 rounded text-xs font-mono border transition-all ${
                  activeView === tab.id ? 'border-[#00d4ff50] bg-[#00d4ff15] text-[#00d4ff]' : 'border-[#1e2d4a] text-[#4a6080]'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* 자산 곡선 */}
          {activeView === 'chart' && (
            <div className="p-4 rounded-xl bg-[#0f1628] border border-[#1e2d4a]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-mono text-[#e8f0ff]">
                  자산 곡선 — {assetInfo.label} × {strategy.nameKo}
                </p>
                <div className="flex gap-3 text-[10px] font-mono">
                  <span className="text-[#00ff88]">● 자산가치</span>
                  <span className="text-[#ff4466]">● MDD</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={btResult.equityCurve.filter((_, i) => i % 3 === 0)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
                  <XAxis dataKey="date" tick={{ fill: '#4a6080', fontSize: 9 }} tickFormatter={d => d.slice(2, 10)} interval="preserveStartEnd" />
                  <YAxis yAxisId="equity" orientation="left"  tick={{ fill: '#4a6080', fontSize: 9 }} tickFormatter={v => `${(v/10000).toFixed(0)}만`} />
                  <YAxis yAxisId="dd"     orientation="right" tick={{ fill: '#4a6080', fontSize: 9 }} tickFormatter={v => `${v.toFixed(0)}%`} domain={[-50, 0]} />
                  <Tooltip content={<ChartTooltip />} />
                  <ReferenceLine yAxisId="equity" y={10_000_000} stroke="#1e2d4a" strokeDasharray="4 4" />
                  <Line yAxisId="equity" type="monotone" dataKey="equity"   name="자산가치" stroke="#00ff88" strokeWidth={2} dot={false} />
                  <Line yAxisId="dd"     type="monotone" dataKey="drawdown" name="MDD"    stroke="#ff4466" strokeWidth={1} dot={false} opacity={0.7} />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex justify-between text-[10px] font-mono text-[#4a6080] mt-2">
                <span>시작: ₩1,000만</span>
                <span>최종: {fmtMoney(btResult.equityCurve.at(-1)?.equity ?? 10_000_000)}</span>
                <span>최대 손실: {btResult.maxDrawdown.toFixed(1)}%</span>
              </div>
            </div>
          )}

          {/* 거래 내역 */}
          {activeView === 'trades' && (
            <div className="p-4 rounded-xl bg-[#0f1628] border border-[#1e2d4a]">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <MetricCard label="최고 수익 거래" value={fmtPct(btResult.bestTrade)}  color="#00ff88" />
                <MetricCard label="최대 손실 거래" value={fmtPct(btResult.worstTrade)} color="#ff4466" />
                <MetricCard label="평균 보유 기간" value={`${btResult.avgHoldDays}일`} color="#c8d8f0" />
              </div>
              <TradeTable trades={btResult.trades} />
            </div>
          )}

          {/* 최적화 결과 */}
          {activeView === 'optimize' && (
            <div className="p-4 rounded-xl bg-[#0f1628] border border-[#1e2d4a]">
              {optResults.length === 0 ? (
                <div className="text-center py-8 text-[#4a6080]">
                  <p className="text-2xl mb-2">🤖</p>
                  <p className="text-sm">자동 최적화를 실행하면 최적 파라미터를 탐색합니다</p>
                  <button onClick={handleOptimize}
                    className="mt-4 px-5 py-2 rounded-lg border border-[#00ffcc40] text-[#00ffcc] text-xs font-mono hover:bg-[#00ffcc15] transition-all">
                    🤖 자동 최적화 시작
                  </button>
                </div>
              ) : (
                <OptResultTable results={optResults} onApply={handleApplyParams} />
              )}
            </div>
          )}
        </div>
      )}

      {/* 초기 상태 */}
      {!btResult && !loading && !optimizing && (
        <div className="text-center py-16 text-[#4a6080]">
          <p className="text-4xl mb-3">⚗️</p>
          <p className="text-sm">자산과 전략을 선택 후 ▶ 백테스트를 클릭하세요</p>
          <p className="text-xs mt-1 text-[#2a3d5a]">서버에서 실시간 데이터를 가져와 백테스팅합니다</p>
        </div>
      )}

      <p className="text-[10px] text-[#2a3d5a] text-center">
        ⚠ 과거 성과는 미래를 보장하지 않습니다. 본 결과는 투자 권유가 아닙니다.
      </p>
    </div>
  );
}
