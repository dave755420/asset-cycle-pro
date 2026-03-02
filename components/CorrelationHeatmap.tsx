'use client';

import { useMemo, useState } from 'react';
import type { CorrelationMatrix } from '@/lib/types';
import { ASSET_META } from '@/lib/constants';
import { correlationColor, describeCorrelation } from '@/lib/utils';

interface Props {
  matrix: CorrelationMatrix;
}

export function CorrelationHeatmap({ matrix }: Props) {
  const [hovered, setHovered] = useState<[number, number] | null>(null);
  const { assets, matrix: m } = matrix;

  const tooltip = useMemo(() => {
    if (!hovered) return null;
    const [i, j] = hovered;
    if (i === j) return null;
    const corr = m[i][j];
    const nameA = ASSET_META[assets[i]].nameKo;
    const nameB = ASSET_META[assets[j]].nameKo;
    return { nameA, nameB, corr, desc: describeCorrelation(corr) };
  }, [hovered, assets, m]);

  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <div className="min-w-[340px]">
          {/* Column headers */}
          <div className="flex mb-1" style={{ paddingLeft: '80px' }}>
            {assets.map((id, j) => (
              <div
                key={id}
                className="flex-1 min-w-[44px] flex items-end justify-center pb-1"
                style={{ minHeight: '60px' }}
              >
                <span
                  className="text-[9px] font-mono tracking-wider whitespace-nowrap"
                  style={{
                    color: ASSET_META[id].color,
                    writingMode: 'vertical-rl',
                    transform: 'rotate(180deg)',
                  }}
                >
                  {ASSET_META[id].nameKo}
                </span>
              </div>
            ))}
          </div>

          {/* Rows */}
          {assets.map((rowId, i) => (
            <div key={rowId} className="flex items-center mb-1">
              {/* Row label */}
              <div className="w-20 shrink-0 text-right pr-2">
                <span className="text-[10px] font-mono" style={{ color: ASSET_META[rowId].color }}>
                  {ASSET_META[rowId].nameKo.length > 5
                    ? ASSET_META[rowId].nameKo.slice(0, 5) + '…'
                    : ASSET_META[rowId].nameKo}
                </span>
              </div>

              {/* Cells */}
              {assets.map((colId, j) => {
                const corr = m[i][j];
                const isHovered = hovered?.[0] === i && hovered?.[1] === j;
                const isDiag = i === j;

                return (
                  <div
                    key={colId}
                    className="flex-1 min-w-[44px] h-11 flex items-center justify-center cursor-pointer rounded transition-all duration-150"
                    style={{
                      backgroundColor: isDiag ? '#1e2d4a' : `${correlationColor(corr)}40`,
                      border: `1px solid ${isHovered ? '#00d4ff' : isDiag ? '#2a3d5a' : `${correlationColor(corr)}60`}`,
                      transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                    }}
                    onMouseEnter={() => setHovered([i, j])}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <span
                      className="text-[11px] font-mono font-bold"
                      style={{ color: isDiag ? '#4a6080' : correlationColor(corr) }}
                    >
                      {isDiag ? '—' : corr.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="mt-3 p-3 rounded-lg border border-[#1e2d4a] bg-[#0a0e1a] animate-fadeIn">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-[#4a6080]">{tooltip.nameA}</span>
            <span className="text-[#1e2d4a]">↔</span>
            <span className="text-xs text-[#4a6080]">{tooltip.nameB}</span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="text-2xl font-mono font-bold"
              style={{ color: correlationColor(tooltip.corr) }}
            >
              {tooltip.corr.toFixed(3)}
            </span>
            <span className="text-xs text-[#c8d8f0]">{tooltip.desc}</span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex items-center gap-2">
        <span className="text-[10px] text-[#4a6080]">강한 음의 상관</span>
        <div className="flex-1 h-2 rounded-full" style={{
          background: 'linear-gradient(to right, #ff4466, #1e2d4a, #00ff88)'
        }} />
        <span className="text-[10px] text-[#4a6080]">강한 양의 상관</span>
      </div>
    </div>
  );
}
