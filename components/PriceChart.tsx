'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { AssetId, Period } from '@/lib/types';
import { ASSET_META } from '@/lib/constants';
import { formatDateShort } from '@/lib/utils';

interface Props {
  assetId: AssetId;
  period: Period;
}

interface PricePoint {
  date: string;
  close: number;
}

export function PriceChart({ assetId, period }: Props) {
  const [data, setData] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const meta = ASSET_META[assetId];

  useEffect(() => {
    setLoading(true);
    fetch(`/api/history?id=${assetId}&period=${period}`)
      .then(r => r.json())
      .then(json => { setData(json.data ?? []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [assetId, period]);

  if (loading) {
    return <div className="h-48 bg-[#0f1628] rounded animate-pulse border border-[#1e2d4a]" />;
  }

  const firstClose = data[0]?.close ?? 0;
  const lastClose = data[data.length - 1]?.close ?? 0;
  const isPositive = lastClose >= firstClose;
  const lineColor = isPositive ? '#00ff88' : '#ff4466';

  // Thin data for performance on large datasets
  const MAX_POINTS = 300;
  const step = Math.ceil(data.length / MAX_POINTS);
  const chartData = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-[#0a0e1a] border border-[#1e2d4a] rounded-lg p-2.5 shadow-xl">
        <p className="text-[10px] text-[#4a6080] font-mono">{formatDateShort(payload[0].payload.date)}</p>
        <p className="text-sm font-mono font-bold" style={{ color: meta.color }}>
          {payload[0].value?.toLocaleString('ko-KR', { maximumFractionDigits: meta.decimals })} {meta.unit}
        </p>
      </div>
    );
  };

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`grad-${assetId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fill: '#4a6080', fontSize: 9, fontFamily: 'monospace' }}
            tickFormatter={d => {
              const date = new Date(d);
              return `${date.getMonth() + 1}/${date.getFullYear().toString().slice(2)}`;
            }}
            interval="preserveStartEnd"
            axisLine={{ stroke: '#1e2d4a' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#4a6080', fontSize: 9, fontFamily: 'monospace' }}
            tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(meta.decimals)}
            axisLine={false}
            tickLine={false}
            width={40}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={firstClose} stroke="#1e2d4a" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="close"
            stroke={lineColor}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: lineColor, stroke: '#0a0e1a' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
