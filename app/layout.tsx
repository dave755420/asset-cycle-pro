import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Asset Cycle Pro | 글로벌 자산 유동성 순환 분석',
  description: '비트코인, S&P500, 코스피, 달러/원, 미국 국채, 금의 상관관계를 실시간으로 분석하는 기관 투자자 수준의 금융 대시보드',
  keywords: ['비트코인', 'S&P500', '코스피', '금융 분석', '상관관계', '퀀트 분석'],
  authors: [{ name: 'Asset Cycle Pro' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0e1a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="dark">
      <body>{children}</body>
    </html>
  );
}
