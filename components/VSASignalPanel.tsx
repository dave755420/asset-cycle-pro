'use client';

/**
 * VSA 시그널 패널
 * - 주봉 RSI + 거래량 분석 결과 표시
 * - 자산별 탭
 * - RSI 게이지
 * - 시그널 카드 (최신 우선)
 */

import { useState, useEffect } from 'react';
import type { AssetId, VSAAnalysisResult } from '@/lib/types';
import { ASSET_IDS, ASSET_META } from '@/lib/constants';

interface Props {
  defaultAsset?: AssetId;
}

function RSIGauge({ rsi }: { rsi: number }) {
  const pct = Math.max(0, Math.min(100, rsi));
  const color =
    rsi < 25 ? '#ff4466' :
    rsi < 35 ? '#ffb800' :
    rsi < 50 ? '#4a6080' :
    rsi < 65 ? '#3a5a3f' :
    rsi < 75 ? '#ffb800' : '#ff4466';

  const zone =
    rsi < 25 ? '극심한 과매도' :
    rsi < 35 ? '과매도 구간' :
    rsi < 45 ? '중립 하단' :
    rsi < 55 ? '중립' :
    rsi < 65 ? '중립 상단' :
    rsi < 75 ? '과매수 구간' : '극심한 과매수';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#4a6080] font-mono">RSI (14주봉)</span>
        <div className="flex items-center gap-2">
          <span className="text-lg font-mono font-bold" style={{ color }}>{rsi.toFixed(1)}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}30` }}>
            {zone}
          </span>
        </div>
      </div>
      {/* Gauge bar */}
      <div className="relative h-3 rounded-full overflow-hidden bg-[#0a0e1a] border border-[#1e2d4a]">
        {/* Zone colors */}
        <div className="absolute inset-0 flex">
          <div className="w-[25%] bg-[#ff446630]" />
          <div className="w-[10%] bg-[#ffb80025]" />
          <div className="w-[30%] bg-[#1e2d4a40]" />
          <div className="w-[10%] bg-[#ffb80025]" />
          <div className="w-[25%] bg-[#ff446630]" />
        </div>
        {/* Zone labels */}
        <div className="absolute inset-0 flex items-center justify-between px-2">
          <span className="text-[7px] font-mono text-[#ff4466]">25</span>
          <span className="text-[7px] font-mono text-[#4a6080]">50</span>
          <span className="text-[7px] font-mono text-[#ff4466]">75</span>
        </div>
        {/* Indicator */}
        <div
          className="absolute top-0 bottom-0 w-0.5 rounded-full transition-all duration-500"
          style={{ left: `${pct}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
        />
      </div>
    </div>
  );
}

function VolumeBadge({ multiple }: { multiple: number }) {
  const color =
    multiple >= 2 ? '#ff4466' :
    multiple >= 1.5 ? '#ffb800' :
    multiple >= 1 ? '#4a6080' : '#1e2d4a';
  const label =
    multiple >= 2 ? '수급 폭발' :
    multiple >= 1.5 ? '수급 급증' :
    multiple >= 1 ? '평균 수준' : '저조';

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[#4a6080] font-mono">거래량 배율</span>
      <span className="text-sm font-mono font-bold" style={{ color }}>×{multiple.toFixed(2)}</span>
      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}30` }}>
        {label}
      </span>
    </div>
  );
}

export function VSASignalPanel({ defaultAsset = 'BTC' }: Props) {
  const [selectedAsset, setSelectedAsset] = useState<AssetId>(defaultAsset);
  const [results, setResults] = useState<Map<AssetId, VSAAnalysisResult>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/vsa', { cache: 'no-store' })
      .then(r => r.json())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((data: any) => {
        const map = new Map<AssetId, VSAAnalysisResult>();
        for (const result of data.results ?? []) {
          map.set(result.assetId as AssetId, result);
        }
        setResults(map);
        setError(null);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const current = results.get(selectedAsset);
  const recentSignals = current?.signals.filter(s => s.isRecent) ?? [];
  const allSignals = [...(current?.signals ?? [])].reverse();

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-16 bg-[#0f1628] rounded-lg border border-[#1e2d4a] animate-pulse" />
        <div className="h-32 bg-[#0f1628] rounded-lg border border-[#1e2d4a] animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-[#ff446610] border border-[#ff446630] text-[#ff4466] text-xs">
        VSA 분석 로드 실패: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 자산 탭 */}
      <div className="flex gap-1.5 flex-wrap">
        {ASSET_IDS.map(id => {
          const meta = ASSET_META[id];
          const res = results.get(id);
          const hasRecent = (res?.signals ?? []).some(s => s.isRecent);

          return (
            <button
              key={id}
              onClick={() => setSelectedAsset(id)}
              className={`
                relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                font-mono transition-all border
                ${selectedAsset === id
                  ? 'font-semibold'
                  : 'border-[#1e2d4a] text-[#4a6080] hover:border-[#2a3d5a]'
                }
              `}
              style={selectedAsset === id
                ? { color: meta.color, backgroundColor: `${meta.color}15`, borderColor: `${meta.color}40` }
                : {}
              }
            >
              {meta.nameKo}
              {hasRecent && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#ff4466] border border-[#0a0e1a]" />
              )}
            </button>
          );
        })}
      </div>

      {current ? (
        <div className="space-y-4 animate-fadeIn">
          {/* 현재 상태 패널 */}
          <div className="p-4 rounded-xl border border-[#1e2d4a] bg-[#0f1628] space-y-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-[#e8f0ff]">
                {ASSET_META[selectedAsset].nameKo} — 현재 주봉 상태
              </span>
              <span className="text-[9px] font-mono text-[#4a6080]">
                {new Date(current.analyzedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} 분석
              </span>
            </div>
            <RSIGauge rsi={current.latestRsi} />
            <VolumeBadge multiple={current.latestVolMultiple} />
          </div>

          {/* 최근 시그널 배너 */}
          {recentSignals.length > 0 && (
            <div className="p-3 rounded-lg bg-[#ff446618] border border-[#ff446650] animate-fadeIn">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[#ff4466] text-base">⚡</span>
                <span className="text-xs font-bold text-[#ff4466]">최근 4주 내 시그널 감지!</span>
              </div>
              {recentSignals.map(sig => (
                <p key={sig.id} className="text-xs text-[#c8d8f0] ml-6">
                  {sig.weekStart} — RSI {sig.rsi} / 거래량 ×{sig.volumeMultiple}
                </p>
              ))}
            </div>
          )}

          {/* 시그널 이력 */}
          {allSignals.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] tracking-[0.15em] uppercase text-[#4a6080] font-mono">
                VSA 시그널 이력 ({allSignals.length}개)
              </p>
              {allSignals.slice(0, 5).map(sig => (
                <div
                  key={sig.id}
                  className={`
                    p-3 rounded-lg border
                    ${sig.severity === 'extreme'
                      ? 'bg-[#ff446612] border-[#ff446640]'
                      : 'bg-[#ffb80010] border-[#ffb80035]'
                    }
                    ${sig.isRecent
                      ? sig.severity === 'extreme'
                        ? 'ring-1 ring-[#ff4466]'
                        : 'ring-1 ring-[#ffb800]'
                      : ''
                    }
                  `}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className={`text-xs font-bold ${sig.severity === 'extreme' ? 'text-[#ff4466]' : 'text-[#ffb800]'}`}>
                      {sig.titleKo}
                    </span>
                    {sig.isRecent && (
                      <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded font-mono bg-[#ff446625] text-[#ff4466] border border-[#ff446640]">
                        최근
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#c8d8f0] leading-relaxed mb-2">{sig.bodyKo}</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[10px] font-mono text-[#4a6080]">📅 {sig.weekStart}</span>
                    <span className={`text-[10px] font-mono ${sig.rsi < 25 ? 'text-[#ff4466]' : 'text-[#ffb800]'}`}>
                      RSI: {sig.rsi}
                    </span>
                    <span className={`text-[10px] font-mono ${sig.volumeMultiple >= 2 ? 'text-[#ff4466]' : 'text-[#ffb800]'}`}>
                      거래량: ×{sig.volumeMultiple}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[#4a6080]">
              <p className="text-2xl mb-2">◎</p>
              <p className="text-sm">현재 VSA 조건 미충족</p>
              <p className="text-xs mt-1 text-[#2a3d5a]">RSI &lt; 30 + 거래량 1.5배 이상 동시 충족 시 시그널 출력</p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-[#4a6080] text-sm">데이터 없음</div>
      )}
    </div>
  );
}
