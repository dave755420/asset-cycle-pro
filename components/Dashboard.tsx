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
import { SP500ScanPanel } from './SP500ScanPanel';
import { NewsPanel } from './NewsPanel';
import { QuantLabPanel } from './QuantLabPanel';
import { PortfolioPanel } from './PortfolioPanel';
import { AlertPanel } from './AlertPanel';
import { AIInsightPanel } from './AIInsightPanel';
import { useQuotes, useCorrelation } from '@/hooks/useAssetData';
import { formatDatetime } from '@/lib/utils';
import { ASSET_IDS, ASSET_META } from '@/lib/constants';
import type { AssetId, Period, RollingWindow } from '@/lib/types';

type TabId =
  | 'overview' | 'tradingview' | 'vsa' | 'sp500scan'
  | 'quantlab' | 'portfolio' | 'alerts' | 'ai'
  | 'correlation' | 'news' | 'table';

const TABS: Array<{ id: TabId; label: string; emoji: string; group?: string }> = [
  { id: 'overview',    label: '개요',       emoji: '◈',  group: '분석' },
  { id: 'tradingview', label: 'TV 차트',    emoji: '📊', group: '분석' },
  { id: 'vsa',         label: 'VSA 분석',   emoji: '⚡', group: '분석' },
  { id: 'sp500scan',   label: 'S&P 스캔',   emoji: '🔍', group: '분석' },
  { id: 'quantlab',    label: '퀀트 랩',    emoji: '⚗️', group: '전략' },
  { id: 'portfolio',   label: '포트폴리오', emoji: '💼', group: '자산' },
  { id: 'alerts',      label: '알림',       emoji: '🔔', group: '자산' },
  { id: 'ai',          label: 'AI 분석',    emoji: '🤖', group: 'AI'   },
  { id: 'correlation', label: '상관관계',   emoji: '🔗', group: '데이터' },
  { id: 'news',        label: '뉴스',       emoji: '📰', group: '데이터' },
  { id: 'table',       label: '데이터',     emoji: '≡',  group: '데이터' },
];

export function Dashboard() {
  const [period, setPeriod]               = useState<Period>('1Y');
  const [rollingWindow, setRollingWindow] = useState<RollingWindow>(90);
  const [selectedAsset, setSelectedAsset] = useState<AssetId>('BTC');
  const [activeTab, setActiveTab]         = useState<TabId>('overview');

  const { quotes, loading: qLoading, lastUpdated, countdown, refresh } = useQuotes();
  const { correlationMatrix, insights, loading: cLoading } = useCorrelation(period, rollingWindow);

  const usdkrwQuote = quotes.find(q => q.id === 'USDKRW');
  const sourceColor = usdkrwQuote?.source === 'yahoo'  ? '#00ff88' :
                      usdkrwQuote?.source === 'backup' ? '#ffb800' : '#ff4466';

  return (
    <div className="flex h-screen bg-[#0a0e1a] overflow-hidden">
      <Sidebar period={period} window={rollingWindow} onPeriodChange={setPeriod} onWindowChange={setRollingWindow} />

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ─── Top bar ──────────────────────────────────────────────────── */}
        <header className="shrink-0 border-b border-[#1e2d4a] bg-[#0a0e1a]/90 backdrop-blur-sm px-4 lg:px-6 py-3">
          <div className="flex items-center justify-between gap-4 ml-10 lg:ml-0">
            <div>
              <h1 className="text-sm font-bold text-[#e8f0ff] tracking-wider">글로벌 자산 유동성 순환 분석</h1>
              <p className="text-[10px] text-[#4a6080] font-mono">ASSET CYCLE PRO v2 · KOREAN EDITION</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {usdkrwQuote && (
                <div className="hidden md:flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sourceColor }} />
                  <span className="text-[10px] font-mono" style={{ color: sourceColor }}>
                    USD/KRW {usdkrwQuote.source === 'yahoo' ? 'Yahoo' : usdkrwQuote.source === 'backup' ? '보조API' : 'Fallback'}
                  </span>
                </div>
              )}
              <div className="hidden sm:flex items-center gap-1.5">
                <div className="relative w-6 h-6">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 -rotate-90">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="#1e2d4a" strokeWidth="2" />
                    <circle cx="12" cy="12" r="10" fill="none" stroke="#00d4ff" strokeWidth="2"
                      strokeDasharray={`${62.8 * (countdown / 60)} 62.8`}
                      className="transition-all duration-1000" />
                  </svg>
                </div>
                <span className="text-[10px] font-mono text-[#4a6080]">{countdown}초</span>
              </div>
              {lastUpdated && (
                <span className="text-[10px] font-mono text-[#4a6080] hidden lg:block">{formatDatetime(lastUpdated)} KST</span>
              )}
              <button onClick={refresh}
                className="text-[10px] font-mono px-2.5 py-1.5 rounded border border-[#1e2d4a] text-[#4a6080] hover:border-[#00d4ff] hover:text-[#00d4ff] transition-colors">
                ↺ 새로고침
              </button>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
                <span className="text-[10px] font-mono text-[#00ff88]">LIVE</span>
              </div>
            </div>
          </div>
        </header>

        {/* ─── Tab bar ──────────────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-[#1e2d4a] bg-[#0a0e1a] overflow-x-auto">
          <div className="flex gap-0 ml-10 lg:ml-0 min-w-max px-2 lg:px-4">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-all duration-150 whitespace-nowrap
                  ${activeTab === tab.id ? 'border-[#00d4ff] text-[#00d4ff]' : 'border-transparent text-[#4a6080] hover:text-[#c8d8f0]'}
                  ${tab.id === 'portfolio' ? 'border-l border-[#1e2d4a] ml-2 pl-4' : ''}
                  ${tab.id === 'correlation' ? 'border-l border-[#1e2d4a] ml-2 pl-4' : ''}
                `}>
                <span>{tab.emoji}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Main content ─────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 grid-bg">

          {/* ═══ OVERVIEW ═════════════════════════════════════════════════ */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fadeIn">
              <section>
                <p className="text-[10px] tracking-[0.15em] uppercase text-[#4a6080] mb-3 font-mono">실시간 자산 현황</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                  {qLoading
                    ? ASSET_IDS.map(id => <div key={id} className="h-28 bg-[#0f1628] rounded-lg border border-[#1e2d4a] animate-pulse" />)
                    : quotes.map(q => <PriceCard key={q.id} quote={q} selected={selectedAsset === q.id} onClick={() => setSelectedAsset(q.id)} />)
                  }
                </div>
              </section>

              <div className="grid lg:grid-cols-4 gap-4">
                {/* 상관관계 */}
                <div className="lg:col-span-1 bg-[#0f1628] rounded-xl border border-[#1e2d4a] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-bold text-[#e8f0ff]">상관관계</h2>
                    <button onClick={() => setActiveTab('correlation')} className="text-[10px] text-[#00d4ff] hover:underline font-mono">자세히 →</button>
                  </div>
                  {cLoading || !correlationMatrix ? <div className="h-60 bg-[#0a0e1a] rounded animate-pulse" /> : <CorrelationHeatmap matrix={correlationMatrix} />}
                </div>
                {/* 인사이트 */}
                <div className="lg:col-span-1 bg-[#0f1628] rounded-xl border border-[#1e2d4a] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-bold text-[#e8f0ff]">자동 인사이트</h2>
                    <button onClick={() => setActiveTab('ai')} className="text-[10px] text-[#b48eff] hover:underline font-mono">AI 분석 →</button>
                  </div>
                  <InsightPanel insights={insights} loading={cLoading} />
                </div>
                {/* 퀀트 랩 바로가기 */}
                <div className="lg:col-span-1 bg-[#0f1628] rounded-xl border border-[#1e2d4a] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-bold text-[#e8f0ff]">⚗️ 퀀트 랩</h2>
                    <button onClick={() => setActiveTab('quantlab')} className="text-[10px] text-[#00ffcc] hover:underline font-mono">열기 →</button>
                  </div>
                  <div className="space-y-1">
                    {['RSI 역추세', 'BB 역추세', 'MA 골든크로스', 'MACD 크로스', 'VSA 거래량', '가격 모멘텀', '멀티팩터 ⭐'].map(s => (
                      <div key={s} onClick={() => setActiveTab('quantlab')}
                        className="flex items-center gap-2 p-1.5 rounded bg-[#0a0e1a] border border-[#1e2d4a] cursor-pointer hover:border-[#2a3d5a] transition-colors">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00ffcc] shrink-0" />
                        <span className="text-[10px] font-mono text-[#c8d8f0]">{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* 신기능 바로가기 */}
                <div className="lg:col-span-1 bg-[#0f1628] rounded-xl border border-[#1e2d4a] p-4 space-y-3">
                  {[
                    { tab: 'portfolio' as TabId, emoji: '💼', title: '포트폴리오', desc: '보유 자산 실시간 손익', color: '#00ff88' },
                    { tab: 'alerts'    as TabId, emoji: '🔔', title: '알림 시스템', desc: '조건 충족 시 자동 알림', color: '#ffb800' },
                    { tab: 'ai'        as TabId, emoji: '🏠', title: '부동산(개발중)',    desc: 'Claude 시장 인사이트',  color: '#b48eff' },
                  ].map(item => (
                    <div key={item.tab} onClick={() => setActiveTab(item.tab)}
                      className="p-3 rounded-lg bg-[#0a0e1a] border border-[#1e2d4a] cursor-pointer hover:border-[#2a3d5a] transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <span>{item.emoji}</span>
                        <span className="text-xs font-bold font-mono" style={{ color: item.color }}>{item.title}</span>
                      </div>
                      <p className="text-[10px] text-[#4a6080]">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ TRADINGVIEW ══════════════════════════════════════════════ */}
          {activeTab === 'tradingview' && (
            <div className="h-full animate-fadeIn">
              <section className="h-full bg-[#0f1628] rounded-xl border border-[#1e2d4a] p-5 flex flex-col">
                <TradingViewChart defaultAsset={selectedAsset} />
              </section>
            </div>
          )}

          {/* ═══ VSA ANALYSIS ════════════════════════════════════════════ */}
          {activeTab === 'vsa' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="grid lg:grid-cols-5 gap-5">
                <section className="lg:col-span-3 bg-[#0f1628] rounded-xl border border-[#1e2d4a] p-5">
                  <div className="mb-4">
                    <h2 className="text-xs font-bold text-[#e8f0ff]">VSA 주봉 퀀트 분석 엔진</h2>
                    <p className="text-[10px] text-[#4a6080] font-mono mt-0.5">조건: 주봉 RSI &lt; 30 + 거래량 ≥ 최근 20주 평균 × 1.5배</p>
                  </div>
                  <VSASignalPanel defaultAsset={selectedAsset} />
                </section>
                <section className="lg:col-span-2 bg-[#0f1628] rounded-xl border border-[#1e2d4a] p-5">
                  <h2 className="text-xs font-bold text-[#e8f0ff] mb-4">분석 방법론</h2>
                  <div className="space-y-3 text-[11px] text-[#c8d8f0] leading-relaxed">
                    {[
                      { color: '#ffb800', title: '📐 RSI 계산 방식', body: "Wilder's Smoothing Method (기간: 14주봉)." },
                      { color: '#00ff88', title: '📊 거래량 기준', body: '최근 20주 평균 대비 1.5배(강), 2.0배(극단) 구분.' },
                      { color: '#00d4ff', title: '🎯 시그널 해석', body: 'RSI 과매도 + 대량 거래량 = 스마트머니 개입 가능성.' },
                    ].map(item => (
                      <div key={item.title} className="p-3 rounded-lg bg-[#0a0e1a] border border-[#1e2d4a]">
                        <p className="font-semibold mb-1" style={{ color: item.color }}>{item.title}</p>
                        <p>{item.body}</p>
                      </div>
                    ))}
                    <div className="p-3 rounded-lg bg-[#ff446612] border border-[#ff446630]">
                      <p className="font-semibold text-[#ff4466] mb-1">⚠ 투자 유의사항</p>
                      <p className="text-[#4a6080]">본 분석은 교육 목적이며 투자 권유가 아닙니다.</p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* ═══ S&P 500 SCAN ═════════════════════════════════════════════ */}
          {activeTab === 'sp500scan' && (
            <div className="animate-fadeIn">
              <section className="bg-[#0f1628] rounded-xl border border-[#1e2d4a] p-5">
                <SP500ScanPanel />
              </section>
            </div>
          )}

          {/* ═══ QUANT LAB ════════════════════════════════════════════════ */}
          {activeTab === 'quantlab' && (
            <div className="animate-fadeIn">
              <section className="bg-[#0f1628] rounded-xl border border-[#1e2d4a] p-5">
                <QuantLabPanel />
              </section>
            </div>
          )}

          {/* ═══ PORTFOLIO ════════════════════════════════════════════════ */}
          {activeTab === 'portfolio' && (
            <div className="animate-fadeIn">
              <section className="bg-[#0f1628] rounded-xl border border-[#1e2d4a] p-5">
                <PortfolioPanel />
              </section>
            </div>
          )}

          {/* ═══ ALERTS ═══════════════════════════════════════════════════ */}
          {activeTab === 'alerts' && (
            <div className="animate-fadeIn">
              <section className="bg-[#0f1628] rounded-xl border border-[#1e2d4a] p-5">
                <AlertPanel />
              </section>
            </div>
          )}

          {/* ═══ AI INSIGHT ═══════════════════════════════════════════════ */}
          {activeTab === 'ai' && (
            <div className="animate-fadeIn">
              <section className="bg-[#0f1628] rounded-xl border border-[#1e2d4a] p-5">
                <AIInsightPanel />
              </section>
            </div>
          )}

          {/* ═══ CORRELATION ══════════════════════════════════════════════ */}
          {activeTab === 'correlation' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="grid lg:grid-cols-5 gap-5">
                <section className="lg:col-span-3 bg-[#0f1628] rounded-xl border border-[#1e2d4a] p-5">
                  <div className="mb-4">
                    <h2 className="text-xs font-bold text-[#e8f0ff]">자산 간 상관관계 매트릭스</h2>
                    <p className="text-[10px] text-[#4a6080] font-mono mt-0.5">기간: {period} | 롤링 윈도우: {rollingWindow}일</p>
                  </div>
                  {cLoading || !correlationMatrix ? <div className="h-72 bg-[#0a0e1a] rounded animate-pulse" /> : <CorrelationHeatmap matrix={correlationMatrix} />}
                </section>
                <section className="lg:col-span-2 bg-[#0f1628] rounded-xl border border-[#1e2d4a] p-5">
                  <div className="mb-4">
                    <h2 className="text-xs font-bold text-[#e8f0ff]">자동 인사이트 전체</h2>
                    <p className="text-[10px] text-[#4a6080] font-mono mt-0.5">선행지표 · 리스크 · 헷지</p>
                  </div>
                  <InsightPanel insights={insights} loading={cLoading} />
                </section>
              </div>
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

          {/* ═══ NEWS ═════════════════════════════════════════════════════ */}
          {activeTab === 'news' && (
            <div className="animate-fadeIn">
              <section className="bg-[#0f1628] rounded-xl border border-[#1e2d4a] p-5">
                <NewsPanel />
              </section>
            </div>
          )}

          {/* ═══ DATA TABLE ═══════════════════════════════════════════════ */}
          {activeTab === 'table' && (
            <div className="animate-fadeIn">
              <section className="bg-[#0f1628] rounded-xl border border-[#1e2d4a] p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xs font-bold text-[#e8f0ff]">실시간 가격 데이터</h2>
                    <p className="text-[10px] text-[#4a6080] font-mono mt-0.5">Yahoo Finance + 보조 API · 60초 자동 갱신</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-3 text-[10px] font-mono">
                    {[['#00ff88', 'Yahoo'], ['#ffb800', '보조API'], ['#ff4466', 'Fallback']].map(([c, l]) => (
                      <div key={l} className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c }} />
                        <span className="text-[#4a6080]">{l}</span>
                      </div>
                    ))}
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
