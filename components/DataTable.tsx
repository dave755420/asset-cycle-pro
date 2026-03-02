'use client';

import type { AssetQuote } from '@/lib/types';
import { ASSET_META } from '@/lib/constants';
import { formatPrice, formatChangePct, formatDatetime } from '@/lib/utils';

interface Props {
  quotes: AssetQuote[];
  loading?: boolean;
}

const SOURCE_CONFIG = {
  yahoo:   { color: '#00ff88', label: 'Yahoo' },
  backup:  { color: '#ffb800', label: '보조API' },
  fallback:{ color: '#ff4466', label: 'Fallback' },
};

export function DataTable({ quotes, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-10 bg-[#0f1628] rounded animate-pulse border border-[#1e2d4a]" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] border-collapse">
        <thead>
          <tr className="border-b border-[#1e2d4a]">
            {['자산', '현재가', '등락률', '전일 종가', '변동', '단위', '데이터 소스', '업데이트'].map(h => (
              <th key={h} className="text-left py-2 px-3 text-[10px] tracking-[0.1em] uppercase text-[#4a6080] font-mono whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {quotes.map((quote, idx) => {
            const meta = ASSET_META[quote.id];
            const isPos = quote.changePct >= 0;
            const src = SOURCE_CONFIG[quote.source ?? 'fallback'];
            return (
              <tr
                key={quote.id}
                className="border-b border-[#1e2d4a20] hover:bg-[#162040] transition-colors duration-100 animate-fadeIn"
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                    <div>
                      <p className="text-xs font-semibold text-[#e8f0ff]">{meta.nameKo}</p>
                      <p className="text-[10px] font-mono text-[#4a6080]">{meta.symbol}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-3">
                  <span className="font-num text-sm font-bold text-[#e8f0ff]">
                    {formatPrice(quote.price, quote.id)}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span className={`font-num text-sm font-bold ${isPos ? 'text-[#00ff88]' : 'text-[#ff4466]'}`}>
                    {isPos ? '▲' : '▼'} {formatChangePct(quote.changePct)}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span className="font-num text-xs text-[#4a6080]">{formatPrice(quote.prevClose, quote.id)}</span>
                </td>
                <td className="py-3 px-3">
                  <span className={`font-num text-xs ${isPos ? 'text-[#00ff88]' : 'text-[#ff4466]'}`}>
                    {isPos ? '+' : ''}{quote.change.toLocaleString('ko-KR', { maximumFractionDigits: meta.decimals })}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span className="text-[10px] font-mono text-[#4a6080]">{meta.unit}</span>
                </td>
                <td className="py-3 px-3">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ color: src.color, backgroundColor: `${src.color}15`, border: `1px solid ${src.color}30` }}>
                    {src.label}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-1.5">
                    {quote.isStale && <span className="w-1.5 h-1.5 rounded-full bg-[#ffb800] shrink-0 animate-pulse" />}
                    <span className="text-[10px] font-mono text-[#4a6080] whitespace-nowrap">
                      {formatDatetime(quote.updatedAt)}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
