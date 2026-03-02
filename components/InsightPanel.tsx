'use client';

import type { QuantInsight } from '@/lib/types';
import { ASSET_META } from '@/lib/constants';

interface Props {
  insights: QuantInsight[];
  loading?: boolean;
}

const SEVERITY_CONFIG = {
  alert:   { icon: '⚡', label: '경고', bg: 'bg-[#ff446615]', border: 'border-[#ff446640]', text: 'text-[#ff4466]', badge: 'bg-[#ff446625] text-[#ff4466]' },
  warning: { icon: '◈', label: '주의', bg: 'bg-[#ffb80015]', border: 'border-[#ffb80040]', text: 'text-[#ffb800]', badge: 'bg-[#ffb80025] text-[#ffb800]' },
  info:    { icon: '◎', label: '인사이트', bg: 'bg-[#00d4ff10]', border: 'border-[#00d4ff30]', text: 'text-[#00d4ff]', badge: 'bg-[#00d4ff15] text-[#00d4ff]' },
};

const TYPE_LABELS: Record<QuantInsight['type'], string> = {
  correlation: '상관관계',
  leadlag: '선행지표',
  divergence: '괴리',
  risk: '리스크',
};

export function InsightPanel({ insights, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 rounded-lg bg-[#0f1628] border border-[#1e2d4a] animate-pulse" />
        ))}
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="text-center py-8 text-[#4a6080]">
        <p className="text-2xl mb-2">◎</p>
        <p className="text-sm">현재 선택된 기간·윈도우에서 유의미한 시그널이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {insights.map((insight, idx) => {
        const cfg = SEVERITY_CONFIG[insight.severity];
        return (
          <div
            key={insight.id}
            className={`rounded-lg border p-4 ${cfg.bg} ${cfg.border} animate-fadeIn`}
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className={`text-base ${cfg.text}`}>{cfg.icon}</span>
                <span className={`text-xs font-semibold ${cfg.text}`}>{insight.titleKo}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${cfg.badge}`}>
                  {TYPE_LABELS[insight.type]}
                </span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${cfg.badge}`}>
                  {cfg.label}
                </span>
              </div>
            </div>

            {/* Body */}
            <p className="text-xs text-[#c8d8f0] leading-relaxed mb-3">{insight.bodyKo}</p>

            {/* Asset tags */}
            <div className="flex flex-wrap gap-1.5">
              {insight.assets.map(assetId => (
                <span
                  key={assetId}
                  className="text-[10px] px-2 py-0.5 rounded-full font-mono"
                  style={{
                    color: ASSET_META[assetId].color,
                    backgroundColor: `${ASSET_META[assetId].color}15`,
                    border: `1px solid ${ASSET_META[assetId].color}30`,
                  }}
                >
                  {ASSET_META[assetId].nameKo}
                </span>
              ))}
              {insight.value !== undefined && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono text-[#4a6080] bg-[#1e2d4a]">
                  값: {insight.value.toFixed(3)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
