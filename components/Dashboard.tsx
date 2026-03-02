'use client';

import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { PriceCard } from './PriceCard';
import { CorrelationHeatmap } from './CorrelationHeatmap';
import { InsightPanel } from './InsightPanel';
import { DataTable } from './DataTable';
import { PriceChart } from './PriceChart';
import { TradingViewChart } from './TradingViewChart';
import { VSASignalPanel } from './VSASignalPanel';
import { NewsPanel } from './NewsPanel';
import { useQuotes, useCorrelation } from '@/hooks/useAssetData';
import { formatDatetime } from '@/lib/utils';
import { ASSET_IDS, ASSET_META } from '@/lib/constants';
import type { AssetId, Period, RollingWindow } from '@/lib/types';

type TabId = 'overview' | 'tradingview' | 'vsa' | 'correlation' | 'news' | 'table';

const TABS: Array<{ id: TabId; label: string; emoji: string }> = [
  { id: 'overview',     label: '개요',        emoji: '◈' },
  { id: 'tradingview',  label: 'TV 차트',     emoji: '📊' },
  { id: 'vsa',          label: 'VSA 분석',    emoji: '⚡' },
  { id: 'correlation',  label: '상관관계',    emoji: '🔗' },
  { id: 'news',         label: '뉴스',        emoji: '📰' },
  { id: 'table',        label: '데이터',      emoji: '≡' },
];

export function Dashboard() {
  const [period, setPeriod] = useState<Period>('1Y');
  const [rollingWindow, setRollingWindow] = useState<RollingWindow>(90);
  const [selectedAsset, setSelectedAsset] = useState<AssetId>('BTC');
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const { quotes, loading: qLoading, lastUpdated, countdown, refresh } = useQuotes();
  const { correlationMatrix, insights, loading: cLoading } = useCorrelation(period, rollingWindow);

  // Quote source indicator
  const usdkrwQuote = quotes.find(q => q.id === 'USDKRW');
  const sourceColor = usdkrwQuote?.source === 'yahoo' ? '#00ff88' :
                      usdkrwQuote?.source === 'backup' ? '#ffb800' : '#ff4466';

  return (
    <div className="flex h-screen bg-[#0a0e1a] overflow-hidden">
      <Sidebar
        period={period}
        window={rollingWindow}
        onPeriodChange={setPeriod}
        onWindowChange={setRollingWindow}
      />

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ─── Top bar ────────────────────────────────────────────────── */}
        <header className="shrink-0 border-b border-[#1e2d4a] bg-[#0a0e1a]/90 backdrop-blur-sm px-4 lg:px-6 py-3">
          <div className="flex items-center justify-between gap-4 ml-10 lg:ml-0">
            <div>
              <h1 className="text-sm font-bold text-[#e8f0ff] tracking-wider">
                글로벌 자산 유동성 순환 분석
              </h1>
              <p className="text-[10px] text-[#4a6080] font-mono">ASSET CYCLE PRO v2 · KOREAN EDITION</p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Data source indicator */}
              {usdkrwQuote && (
                <div className="hidden md:flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sourceColor }} />
                  <span className="text-[10px] font-mono" style={{ color: sourceColor }}>
                    USD/KRW {usdkrwQuote.source === 'yahoo' ? 'Yahoo' : usdkrwQuote.source === 'backup' ? '보조API' : 'Fallback'}
                  </span>
                </div>
              )}

              {/* Countdown ring */}
              <div className="hidden sm:flex items-center gap-1.5">
                <div className="relative w-6 h-6">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 -rotate-90">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="#1e2d4a" strokeWidth="2" />
                    <circle
                      cx="12" cy="12" r="10"
                      fill="none" stroke="#00d4ff" strokeWidth="2"
                      strokeDasharray={`${62.8 * (countdown / 60)} 62.8`}
                      className="transition-all duration-1000"
                    />
                  </svg>
                </div>
                <span className="text-[10px] font-mono text-[#4a6080]">{countdown}초</span>
              </div>

              {lastUpdated && (
                <span className="text-[10px] font-mono text-[#4a6080] hidden lg:block">
                  {formatDatetime(lastUpdated)} KST
                </span>
              )}

              <button
                onClick={refresh}
                className="text-[10px] font-mono px-2.5 py-1.5 rounded border border-[#1e2d4a] text-[#4a6080] hover:border-[#00d4ff] hover:text-[#00d4ff] transition-colors"
              >
                ↺ 새로고침
              </button>

              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
                <span className="text-[10px] font-mono text-[#00ff88]">LIVE</span>
              </div>
            </div>
          </div>
        </header>

        {/* ─── Tab bar ─────────────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-[#1e2d4a] bg-[#0a0e1a] overflow-x-auto">
          <div className="flex gap-0 ml-10 lg:ml-0 min-w-max px-2 lg:px-4">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-1.5 px-3.5 py-3 text-xs font-semibold
                  border-b-2 transition-all duration-150 whitespace-nowrap
                  ${activeTab === tab.id
                    ? 'border-[#00d4ff] text-[#00d4ff]'
                    : 'border-transparent text-[#4a6080] hover:text-[#c8d8f0]'
                  }
                `}
              >
                <span className="text-xs">{tab.emoji}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Main content ────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 grid-bg">

          {/* ═══ OVERVIEW ═══════════════════════════════════════════════ */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fadeIn">

              {/* Price cards */}
              <section>
                <p className="text-[10px] tracking-[0.15em] uppercase text-[#4a6080] mb-3 font-mono">
                  실시간 자산 현황
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                  {qLoading
                    ? ASSET_IDS.map(id => (
                        <div key={id} className="h-28 bg-[#0f1628] rounded-lg border border-[#1e2d4a] animate-pulse" />
                      ))
                    : quotes.map(q => (
                        <PriceCard
                          key={q.id}
                          quote={q}
                          selected={selectedAsset === q.id}
                          onClick={() => setSelectedAsset(q.id)}
                        />
                      ))
                  }
                </div>
              </section>

              {/* 3-column grid: Heatmap + Insights + News preview */}
              <div className="grid lg:grid-cols-3 gap-5">
                {/* Correlation heatmap */}
                <div className="lg:col-span-1 bg-[#0f1628] rounded-xl border border-[#1e2d4a] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-xs font-bold text-[#e8f0ff]">상관관계 히트맵</h2>
                      <p className="text-[10px] text-[#4a6080] font-mono mt-0.5">{period} / {rollingWindow}일 윈도우</p>
                    </div>
                    <button onClick={() => setActiveTab('correlation')} className="text-[10px] text-[#00d4ff] hover:underline font-mono">자세히 →</button>
                  </div>
                  {cLoading || !correlationMatrix
                    ? <div className="h-48 bg-[#0a0e1a] rounded animate-pulse" />
                    : <CorrelationHeatmap matrix={correlationMatrix} />
                  }
                </div>

                {/* Quant insights */}
                <div className="lg:col-span-1 bg-[#0f1628] rounded-xl border border-[#1e2d4a] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-xs font-bold text-[#e8f0ff]">퀀트 인사이트</h2>
                      <p className="text-[10px] text-[#4a6080] font-mono mt-0.5">자동 생성 · 한국어</p>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00d4ff15] text-[#00d4ff] border border-[#00d4ff30]">
                      {insights.length}개
                    </span>
                  </div>
                  <InsightPanel insights={insights.slice(0, 3)} loading={cLoading} />
                </div>

                {/* VSA preview */}
                <div className="lg:col-span-1 bg-[#0f1628] rounded-xl border border-[#1e2d4a] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-xs font-bold text-[#e8f0ff]">VSA 주봉 시그널</h2>
                      <p className="text-[10px] text-[#4a6080] font-mono mt-0.5">RSI + 거래량 분석</p>
                    </div>
                    <button onClick={() => setActiveTab('vsa')} className="text-[10px] text-[#00d4ff] hover:underline font-mono">자세히 →</button>
                  </div>
                  <VSASignalPanel defaultAsset={selectedAsset} />
                </div>
              </div>

              {/* News preview row */}
              <div className="bg-[#0f1628] rounded-xl border border-[#1e2d4a] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-bold text-[#e8f0ff]">실시간 뉴스</h2>
                  <button onClick={() => setActiveTab('news')} className="text-[10px] text-[#00d4ff] hover:underline font-mono">전체 보기 →</button>
                </div>
                <NewsPanel />
              </div>
            </div>
          )}

          {/* ═══ TRADINGVIEW ════════════════════════════════════════════ */}
          {activeTab === 'tradingview' && (
            <div className="animate-fadeIn h-full flex flex-col">
              <section className="bg-[#0f1628] rounded-xl border border-[#1e2d4a] p-5 flex-1 flex flex-col" style={{ minHeight: '620px' }}>
                <div className="mb-4">
                  <h2 className="text-xs font-bold text-[#e8f0ff]">TradingView 고급 차트</h2>
                  <p className="text-[10px] text-[#4a6080] font-mono mt-0.5">
                    RSI · 거래량 · 기술적 분석 내장 | 다크모드 | 실시간 가격
                  </p>
                </div>
                <div className="flex-1">
                  <TradingViewChart defaultAsset={selectedAsset} />
                </div>
              </section>
            </div>
          )}

          {/* ═══ VSA ANALYSIS ═══════════════════════════════════════════ */}
          {activeTab === 'vsa' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="grid lg:grid-cols-5 gap-5">
                {/* VSA main panel */}
                <section className="lg:col-span-3 bg-[#0f1628] rounded-xl border border-[#1e2d4a] p-5">
                  <div className="mb-4">
                    <h2 className="text-xs font-bold text-[#e8f0ff]">VSA 주봉 퀀트 분석 엔진</h2>
                    <p className="text-[10px] text-[#4a6080] font-mono mt-0.5">
                      조건: 주봉 RSI &lt; 30 + 거래량 ≥ 최근 20주 평균 × 1.5배
                    </p>
                  </div>
                  <VSASignalPanel defaultAsset={selectedAsset} />
                </section>

                {/* Methodology */}
                <section className="lg:col-span-2 bg-[#0f1628] rounded-xl border border-[#1e2d4a] p-5">
                  <h2 className="text-xs font-bold text-[#e8f0ff] mb-4">분석 방법론</h2>
                  <div className="space-y-4 text-[11px] text-[#c8d8f0] leading-relaxed">
                    <div className="p-3 rounded-lg bg-[#0a0e1a] border border-[#1e2d4a]">
                      <p className="font-semibold text-[#ffb800] mb-1">📐 RSI 계산 방식</p>
                      <p>Wilder's Smoothing Method 적용 (기간: 14주봉). 단순 평균 초기화 후 지수 이동 평균으로 수렴.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#0a0e1a] border border-[#1e2d4a]">
                      <p className="font-semibold text-[#00ff88] mb-1">📊 거래량 기준</p>
                      <p>최근 20주 단순 이동 평균 대비 1.5배 이상 (강한 신호), 2.0배 이상 (극단적 신호)으로 구분.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#0a0e1a] border border-[#1e2d4a]">
                      <p className="font-semibold text-[#00d4ff] mb-1">🎯 시그널 해석</p>
                      <p>RSI 과매도 + 대량 거래량의 동시 출현은 스마트머니 개입 가능성 신호. 추세 전환 전후 2~4주 내 발생하는 경향.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#ff446612] border border-[#ff446630]">
                      <p className="font-semibold text-[#ff4466] mb-1">⚠ 투자 유의사항</p>
                      <p className="text-[#4a6080]">본 분석은 교육 목적이며 투자 권유가 아닙니다. 실제 투자 결정은 전문가와 상담하세요.</p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* ═══ CORRELATION ════════════════════════════════════════════ */}
          {activeTab === 'correlation' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="grid lg:grid-cols-5 gap-5">
                <section className="lg:col-span-3 bg-[#0f1628] rounded-xl border border-[#1e2d4a] p-5">
                  <div className="mb-4">
                    <h2 className="text-xs font-bold text-[#e8f0ff]">자산 간 상관관계 매트릭스</h2>
                    <p className="text-[10px] text-[#4a6080] font-mono mt-0.5">
                      기간: {period} | 롤링 윈도우: {rollingWindow}일 | 피어슨 상관계수
                    </p>
                  </div>
                  {cLoading || !correlationMatrix
                    ? <div className="h-72 bg-[#0a0e1a] rounded animate-pulse" />
                    : <CorrelationHeatmap matrix={correlationMatrix} />
                  }
                </section>
                <section className="lg:col-span-2 bg-[#0f1628] rounded-xl border border-[#1e2d4a] p-5">
                  <div className="mb-4">
                    <h2 className="text-xs font-bold text-[#e8f0ff]">자동 인사이트 전체</h2>
                    <p className="text-[10px] text-[#4a6080] font-mono mt-0.5">선행지표 · 리스크 · 헷지</p>
                  </div>
                  <InsightPanel insights={insights} loading={cLoading} />
                </section>
              </div>

              {/* Per-asset charts */}
              <section>
                <p className="text-[10px] tracking-[0.15em] uppercase text-[#4a6080] mb-3 font-mono">자산별 가격 추이</p>
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {ASSET_IDS.map(id => (
                    <div key={id} className="bg-[#0f1628] rounded-xl border border-[#1e2d4a] p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-[#e8f0ff]">{ASSET_META[id].nameKo}</span>
                        <span className="text-[10px] font-mono text-[#4a6080]">{period}</span>
                      </div>
                      <PriceChart assetId={id} period={period} />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* ═══ NEWS ════════════════════════════════════════════════════ */}
          {activeTab === 'news' && (
            <div className="animate-fadeIn">
              <section className="bg-[#0f1628] rounded-xl border border-[#1e2d4a] p-5">
                <NewsPanel />
              </section>
            </div>
          )}

          {/* ═══ DATA TABLE ══════════════════════════════════════════════ */}
          {activeTab === 'table' && (
            <div className="animate-fadeIn">
              <section className="bg-[#0f1628] rounded-xl border border-[#1e2d4a] p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xs font-bold text-[#e8f0ff]">실시간 가격 데이터</h2>
                    <p className="text-[10px] text-[#4a6080] font-mono mt-0.5">
                      Yahoo Finance + 보조 API · 60초 자동 갱신
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Source legend */}
                    <div className="hidden sm:flex items-center gap-3 text-[10px] font-mono">
                      <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#00ff88]" /><span className="text-[#4a6080]">Yahoo</span></div>
                      <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#ffb800]" /><span className="text-[#4a6080]">보조API</span></div>
                      <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#ff4466]" /><span className="text-[#4a6080]">Fallback</span></div>
                    </div>
                  </div>
                </div>
                <DataTable quotes={quotes} loading={qLoading} />
              </section>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
