'use client';

/**
 * TradingView Advanced Chart Widget
 *
 * - 공식 TradingView widget API 사용
 * - 다크모드 기본값
 * - 심볼 변경 가능 (BTC, SPY, KOSPI, USD/KRW, GOLD, US10Y)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { ASSET_META, ASSET_IDS } from '@/lib/constants';
import type { AssetId } from '@/lib/types';

// TradingView 타입 선언
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    TradingView: any;
  }
}

const TV_CONTAINER_ID = 'tradingview_advanced_chart';

interface Props {
  defaultAsset?: AssetId;
}

const INTERVAL_OPTIONS = [
  { value: 'W', label: '주봉' },
  { value: 'D', label: '일봉' },
  { value: '240', label: '4시간' },
  { value: '60', label: '1시간' },
  { value: '15', label: '15분' },
];

export function TradingViewChart({ defaultAsset = 'BTC' }: Props) {
  const [selectedAsset, setSelectedAsset] = useState<AssetId>(defaultAsset);
  const [interval, setInterval] = useState('D');
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<unknown>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  const createWidget = useCallback(() => {
    if (!containerRef.current || typeof window === 'undefined') return;
    if (!window.TradingView) return;

    // 기존 위젯 정리
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    const symbol = ASSET_META[selectedAsset].tvSymbol;

    widgetRef.current = new window.TradingView.widget({
      container_id: TV_CONTAINER_ID,
      symbol,
      interval,
      timezone: 'Asia/Seoul',
      theme: 'dark',
      style: '1',
      locale: 'kr',
      toolbar_bg: '#0f1628',
      enable_publishing: false,
      allow_symbol_change: true,
      watchlist: ASSET_IDS.map(id => ASSET_META[id].tvSymbol),
      details: true,
      hotlist: false,
      calendar: false,
      studies: ['RSI@tv-basicstudies', 'Volume@tv-basicstudies'],
      show_popup_button: false,
      popup_width: '1000',
      popup_height: '650',
      width: '100%',
      height: '100%',
      autosize: true,
      hide_side_toolbar: false,
      withdateranges: true,
      save_image: false,
      backgroundColor: 'rgba(10, 14, 26, 1)',
      gridColor: 'rgba(30, 45, 74, 0.5)',
      overrides: {
        'paneProperties.background': '#0a0e1a',
        'paneProperties.backgroundType': 'solid',
        'paneProperties.gridProperties.color': 'rgba(30, 45, 74, 0.5)',
        'scalesProperties.textColor': '#4a6080',
        'scalesProperties.backgroundColor': '#0f1628',
      },
    });
  }, [selectedAsset, interval]);

  // 스크립트 로드
  useEffect(() => {
    if (scriptRef.current || document.getElementById('tv-script')) return;

    const script = document.createElement('script');
    script.id = 'tv-script';
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      setLoaded(true);
    };
    script.onerror = () => {
      console.error('[TradingView] 스크립트 로드 실패');
    };
    document.head.appendChild(script);
    scriptRef.current = script;

    // 이미 로드됐으면 바로 사용
    if (window.TradingView) setLoaded(true);

    return () => {
      // 컴포넌트 언마운트 시 정리 (스크립트는 유지)
    };
  }, []);

  // 위젯 생성 / 갱신
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => createWidget(), 100);
    return () => clearTimeout(timer);
  }, [loaded, createWidget]);

  return (
    <div className="flex flex-col h-full">
      {/* 컨트롤 바 */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {/* 자산 선택 */}
        <div className="flex gap-1 flex-wrap">
          {ASSET_IDS.map(id => {
            const meta = ASSET_META[id];
            return (
              <button
                key={id}
                onClick={() => setSelectedAsset(id)}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono
                  transition-all duration-150 border
                  ${selectedAsset === id
                    ? 'font-semibold'
                    : 'border-[#1e2d4a] text-[#4a6080] hover:border-[#2a3d5a] hover:text-[#c8d8f0]'
                  }
                `}
                style={selectedAsset === id
                  ? { color: meta.color, backgroundColor: `${meta.color}18`, borderColor: `${meta.color}50` }
                  : {}
                }
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: selectedAsset === id ? meta.color : '#4a6080' }}
                />
                {meta.nameKo}
              </button>
            );
          })}
        </div>

        {/* 구분선 */}
        <div className="w-px h-5 bg-[#1e2d4a] hidden sm:block" />

        {/* 시간봉 선택 */}
        <div className="flex gap-1">
          {INTERVAL_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setInterval(opt.value)}
              className={`
                px-2.5 py-1.5 rounded text-xs font-mono transition-all border
                ${interval === opt.value
                  ? 'bg-[#00d4ff20] border-[#00d4ff50] text-[#00d4ff] font-semibold'
                  : 'border-[#1e2d4a] text-[#4a6080] hover:border-[#2a3d5a] hover:text-[#c8d8f0]'
                }
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 현재 선택 표시 */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] font-mono text-[#4a6080]">
            TradingView · {ASSET_META[selectedAsset].tvSymbol}
          </span>
        </div>
      </div>

      {/* 차트 컨테이너 */}
      <div className="flex-1 relative rounded-lg overflow-hidden border border-[#1e2d4a] min-h-[480px]">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0f1628] z-10">
            <div className="text-center">
              <div className="inline-block w-8 h-8 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs text-[#4a6080] font-mono">TradingView 차트 로딩 중...</p>
            </div>
          </div>
        )}
        <div
          id={TV_CONTAINER_ID}
          ref={containerRef}
          className="w-full h-full"
          style={{ minHeight: '480px' }}
        />
      </div>
    </div>
  );
}
