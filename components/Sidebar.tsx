'use client';

import { useState } from 'react';
import type { Period, RollingWindow } from '@/lib/types';
import { PERIODS, ROLLING_WINDOWS, ASSET_IDS, ASSET_META } from '@/lib/constants';

interface Props {
  period: Period;
  window: RollingWindow;
  onPeriodChange: (p: Period) => void;
  onWindowChange: (w: RollingWindow) => void;
}

export function Sidebar({ period, window, onPeriodChange, onWindowChange }: Props) {
  const [open, setOpen] = useState(true);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="lg:hidden fixed top-4 left-4 z-50 w-9 h-9 rounded-lg border border-[#1e2d4a] bg-[#0f1628] flex items-center justify-center text-[#c8d8f0] hover:border-[#00d4ff] transition-colors"
        aria-label={open ? '사이드바 닫기' : '사이드바 열기'}
      >
        {open ? '✕' : '☰'}
      </button>

      {/* Overlay on mobile */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 z-40 h-screen
          w-64 flex flex-col
          bg-[#0a0e1a] border-r border-[#1e2d4a]
          transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          overflow-y-auto
        `}
      >
        {/* Logo */}
        <div className="p-5 border-b border-[#1e2d4a]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[#00d4ff] text-xl">◈</span>
            <span className="text-sm font-bold tracking-wider text-[#e8f0ff]">ASSET CYCLE</span>
          </div>
          <p className="text-[10px] font-mono text-[#4a6080] tracking-widest ml-7">PRO · KOREAN EDITION</p>
        </div>

        {/* Navigation sections */}
        <nav className="flex-1 p-4 space-y-6">

          {/* Analysis period */}
          <div>
            <p className="text-[10px] tracking-[0.15em] uppercase text-[#4a6080] mb-3 font-mono">분석 기간</p>
            <div className="grid grid-cols-2 gap-1.5">
              {PERIODS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => onPeriodChange(id)}
                  className={`
                    py-1.5 rounded text-xs font-mono transition-all duration-150
                    ${period === id
                      ? 'bg-[#00d4ff20] border border-[#00d4ff50] text-[#00d4ff] font-semibold'
                      : 'border border-[#1e2d4a] text-[#4a6080] hover:border-[#2a3d5a] hover:text-[#c8d8f0]'
                    }
                  `}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Rolling window */}
          <div>
            <p className="text-[10px] tracking-[0.15em] uppercase text-[#4a6080] mb-3 font-mono">롤링 윈도우</p>
            <div className="space-y-1">
              {ROLLING_WINDOWS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => onWindowChange(value)}
                  className={`
                    w-full py-2 px-3 rounded text-left text-xs font-mono transition-all duration-150
                    flex items-center justify-between
                    ${window === value
                      ? 'bg-[#162040] border border-[#00d4ff30] text-[#00d4ff]'
                      : 'border border-transparent text-[#4a6080] hover:bg-[#0f1628] hover:text-[#c8d8f0]'
                    }
                  `}
                >
                  <span>{label} 이동평균</span>
                  {window === value && <span className="text-[#00d4ff]">●</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Asset legend */}
          <div>
            <p className="text-[10px] tracking-[0.15em] uppercase text-[#4a6080] mb-3 font-mono">추적 자산</p>
            <div className="space-y-2">
              {ASSET_IDS.map(id => {
                const meta = ASSET_META[id];
                return (
                  <div key={id} className="flex items-center gap-2.5 py-1">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#c8d8f0] truncate">{meta.nameKo}</p>
                      <p className="text-[10px] font-mono text-[#4a6080]">{meta.symbol}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-[#1e2d4a]">
          <p className="text-[9px] font-mono text-[#4a6080] leading-relaxed">
            데이터: Yahoo Finance<br />
            갱신: 60초 자동 업데이트<br />
            분석: 기관 투자자 등급
          </p>
        </div>
      </aside>
    </>
  );
}
