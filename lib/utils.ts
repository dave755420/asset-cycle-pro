import type { AssetId } from './types';
import { ASSET_META } from './constants';

export function formatPrice(value: number, id: AssetId): string {
  const meta = ASSET_META[id];
  return value.toLocaleString('ko-KR', {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  });
}

export function formatChangePct(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

export function formatDatetime(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'short',
    day: 'numeric',
  });
}

export function correlationColor(value: number): string {
  if (value >= 0.7)  return '#00ff88';
  if (value >= 0.4)  return '#7ecb75';
  if (value >= 0.1)  return '#3a5a3f';
  if (value >= -0.1) return '#1e2d4a';
  if (value >= -0.4) return '#5a3a4a';
  if (value >= -0.7) return '#cb757e';
  return '#ff4466';
}

export function describeCorrelation(corr: number): string {
  const abs = Math.abs(corr);
  const dir = corr >= 0 ? '양의' : '음의';
  if (abs >= 0.9) return `매우 강한 ${dir} 상관`;
  if (abs >= 0.7) return `강한 ${dir} 상관`;
  if (abs >= 0.5) return `중간 ${dir} 상관`;
  if (abs >= 0.3) return `약한 ${dir} 상관`;
  return '거의 무상관';
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
