'use client';

import { ASSET_META } from '@/lib/constants';
import { formatPrice, formatChangePct } from '@/lib/utils';
import type { AssetQuote } from '@/lib/types';

interface Props {
  quote: AssetQuote;
  selected?: boolean;
  onClick?: () => void;
}

export function PriceCard({ quote, selected, onClick }: Props) {
  const meta = ASSET_META[quote.id];
  const isPositive = quote.changePct >= 0;
  const changeColor = isPositive ? '#00ff88' : '#ff4466';
  const sourceColor = quote.source === 'yahoo' ? '#00ff88' : quote.source === 'backup' ? '#ffb800' : '#ff4466';

  return (
    <button
      onClick={onClick}
      className={`
        relative w-full text-left p-4 rounded-lg border transition-all duration-200
        ${selected
          ? 'border-[#00d4ff] bg-[#0f1628] shadow-[0_0_20px_rgba(0,212,255,0.10)]'
          : 'border-[#1e2d4a] bg-[#0f1628] hover:border-[#2a3d5a]'
        }
      `}
    >
      {/* Color bar */}
      <div className="absolute top-0 left-0 w-1 h-full rounded-l-lg" style={{ backgroundColor: meta.color }} />

      {/* Source + stale dot */}
      <div className="absolute top-2 right-2 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sourceColor }} title={`소스: ${quote.source}`} />
      </div>

      <div className="pl-2">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-[10px] tracking-[0.12em] uppercase text-[#4a6080] font-mono">{meta.unit}</p>
            <p className="text-sm font-semibold text-[#e8f0ff] leading-tight mt-0.5">{meta.nameKo}</p>
          </div>
          <span
            className="text-[9px] px-1.5 py-0.5 rounded font-mono tracking-wider"
            style={{ color: meta.color, backgroundColor: `${meta.color}18`, border: `1px solid ${meta.color}30` }}
          >
            {meta.id}
          </span>
        </div>

        <p className="text-2xl font-bold font-num text-[#e8f0ff] leading-none">
          {formatPrice(quote.price, quote.id)}
        </p>

        <div className="flex items-center gap-2 mt-1.5" style={{ color: changeColor }}>
          <span className="text-sm font-mono font-semibold">{formatChangePct(quote.changePct)}</span>
          <span className="text-xs font-mono opacity-75">
            {isPositive ? '▲' : '▼'} {Math.abs(quote.change).toLocaleString('ko-KR', { maximumFractionDigits: meta.decimals })}
          </span>
        </div>
      </div>
    </button>
  );
}
