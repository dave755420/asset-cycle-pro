'use client';

/**
 * components/AIInsightPanel.tsx
 * Claude AI 시장 분석 패널
 * 환경변수 ANTHROPIC_API_KEY 필요
 */

import { useState, useCallback } from 'react';

type AnalysisMode = 'market' | 'news';

interface InsightResult {
  analysis: string;
  mode: AnalysisMode;
  generatedAt: string;
}

const MODE_CONFIG = {
  market: { label: '시장 현황 분석', emoji: '📊', desc: '현재 자산 시세를 AI가 종합 분석' },
  news:   { label: '뉴스 영향 분석', emoji: '📰', desc: '최신 뉴스의 시장 영향을 AI가 해석' },
};

// 자산 시세 fetch
async function fetchQuotes() {
  try {
    const symbols = ['BTC-USD', 'SPY', '^KS11', 'GC=F', '^TNX', 'USDKRW=X'];
    const nameMap: Record<string, string> = {
      'BTC-USD': '비트코인', 'SPY': 'S&P 500', '^KS11': '코스피',
      'GC=F': '금', '^TNX': '미 국채10Y', 'USDKRW=X': 'USD/KRW',
    };
    const results = await Promise.all(
      symbols.map(async s => {
        const res = await fetch(`/api/quant-data?symbol=${encodeURIComponent(s)}&range=5d&interval=1d`, { cache: 'no-store' });
        if (!res.ok) return null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const json = await res.json() as any;
        const meta = json?.chart?.result?.[0]?.meta;
        if (!meta) return null;
        const price     = meta.regularMarketPrice ?? 0;
        const prevClose = meta.chartPreviousClose ?? price;
        const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
        return { symbol: s, nameKo: nameMap[s], price, changePct };
      })
    );
    return results.filter(Boolean);
  } catch { return []; }
}

// 뉴스 헤드라인 fetch
async function fetchHeadlines(): Promise<string[]> {
  try {
    const res = await fetch('/api/news', { cache: 'no-store' });
    if (!res.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as any;
    const headlines: string[] = [];
    for (const feed of json?.feeds ?? []) {
      for (const item of feed.items?.slice(0, 2) ?? []) {
        headlines.push(item.title);
      }
    }
    return headlines.slice(0, 10);
  } catch { return []; }
}

export function AIInsightPanel() {
  const [mode, setMode]         = useState<AnalysisMode>('market');
  const [result, setResult]     = useState<InsightResult | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [history, setHistory]   = useState<InsightResult[]>([]);

  const handleAnalyze = useCallback(async () => {
    setLoading(true); setError('');
    try {
      let data: Record<string, unknown> = {};

      if (mode === 'market') {
        const quotes = await fetchQuotes();
        data = { quotes };
      } else if (mode === 'news') {
        const headlines = await fetchHeadlines();
        data = { headlines };
      }

      const res = await fetch('/api/ai-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, data }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '알 수 없는 오류' }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const json: InsightResult = await res.json();
      setResult(json);
      setHistory(prev => [json, ...prev].slice(0, 5));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-5">

      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#e8f0ff]">🤖 AI 마켓 인사이트</h2>
          <p className="text-[10px] text-[#4a6080] font-mono mt-0.5">Claude AI가 실시간 데이터를 분석합니다</p>
        </div>
        <button onClick={handleAnalyze} disabled={loading}
          className={`px-5 py-2 rounded-lg text-xs font-mono font-semibold border transition-all ${
            loading
              ? 'border-[#1e2d4a] text-[#4a6080] cursor-not-allowed'
              : 'border-[#b48eff50] text-[#b48eff] bg-[#b48eff10] hover:bg-[#b48eff20]'
          }`}>
          {loading
            ? <><span className="inline-block w-3 h-3 border border-t-transparent border-[#4a6080] rounded-full animate-spin mr-1.5" />분석 중...</>
            : '🤖 AI 분석 시작'}
        </button>
      </div>

      {/* 모드 탭 */}
      <div className="flex gap-2">
        {(Object.entries(MODE_CONFIG) as [AnalysisMode, typeof MODE_CONFIG['market']][]).map(([id, cfg]) => (
          <button key={id} onClick={() => setMode(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono border transition-all ${
              mode === id ? 'border-[#b48eff50] bg-[#b48eff12] text-[#b48eff]' : 'border-[#1e2d4a] text-[#4a6080]'
            }`}>
            <span>{cfg.emoji}</span>
            <div className="text-left">
              <p className="font-semibold">{cfg.label}</p>
              <p className="text-[9px] opacity-70">{cfg.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* 에러 */}
      {error && (
        <div className="p-3 rounded-lg bg-[#ff446615] border border-[#ff446640] text-[11px] font-mono text-[#ff4466]">
          ⚠ {error}
          {error.includes('API_KEY') && (
            <p className="mt-1 text-[10px] text-[#ffb800]">
              → Vercel 대시보드 → Settings → Environment Variables → ANTHROPIC_API_KEY 추가 필요
            </p>
          )}
        </div>
      )}

      {/* 현재 분석 결과 */}
      {result && (
        <div className="p-5 rounded-xl bg-[#0a0e1a] border border-[#b48eff30]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">{MODE_CONFIG[result.mode].emoji}</span>
              <span className="text-xs font-bold text-[#b48eff] font-mono">{MODE_CONFIG[result.mode].label}</span>
            </div>
            <span className="text-[10px] font-mono text-[#4a6080]">{formatTime(result.generatedAt)} KST</span>
          </div>

          {/* AI 분석 텍스트 */}
          <div className="text-[12px] text-[#c8d8f0] leading-relaxed whitespace-pre-wrap font-sans">
            {result.analysis}
          </div>

          <p className="text-[9px] text-[#2a3d5a] font-mono mt-3">
            ⚠ AI 분석은 참고 자료이며 투자 권유가 아닙니다. Claude claude-sonnet-4-20250514
          </p>
        </div>
      )}

      {/* 초기 상태 */}
      {!result && !loading && (
        <div className="text-center py-16 text-[#4a6080]">
          <p className="text-5xl mb-4">🤖</p>
          <p className="text-sm text-[#c8d8f0]">분석 유형을 선택하고 AI 분석을 시작하세요</p>
          <p className="text-xs mt-2 text-[#2a3d5a]">Claude AI가 실시간 시세 & 뉴스를 종합 분석합니다</p>
        </div>
      )}

      {/* 분석 기록 */}
      {history.length > 1 && (
        <div className="space-y-2">
          <p className="text-[10px] text-[#4a6080] font-mono">이전 분석 기록</p>
          {history.slice(1).map((h, i) => (
            <div key={i} className="p-3 rounded-lg bg-[#0a0e1a] border border-[#1e2d4a] cursor-pointer hover:border-[#2a3d5a] transition-colors"
              onClick={() => setResult(h)}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono text-[#b48eff]">{MODE_CONFIG[h.mode].emoji} {MODE_CONFIG[h.mode].label}</span>
                <span className="text-[9px] font-mono text-[#4a6080]">{formatTime(h.generatedAt)}</span>
              </div>
              <p className="text-[10px] text-[#4a6080] line-clamp-2">{h.analysis.slice(0, 100)}...</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
