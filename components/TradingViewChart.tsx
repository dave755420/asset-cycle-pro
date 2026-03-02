'use client';

/**
 * TradingView Advanced Chart Widget (iframe 임베드 방식)
 * - embed-widget-advanced-chart.js 사용 (공식 권장 방식)
 * - tv.js 방식 대비 훨씬 안정적, 선물/현물 모두 지원
 * - 심볼 변경 시 컨테이너 재마운트
 */

import { useEffect, useRef, useState, useId } from 'react';
import { ASSET_META, ASSET_IDS } from '@/lib/constants';
import type { AssetId } from '@/lib/types';

const INTERVAL_OPTIONS = [
  { value: 'W',   label: '주봉' },
  { value: 'D',   label: '일봉' },
  { value: '240', label: '4시간' },
  { value: '60',  label: '1시간' },
  { value: '15',  label: '15분' },
];

interface Props {
  defaultAsset?: AssetId;
}

export function TradingViewChart({ defaultAsset = 'BTC' }: Props) {
  const [selectedAsset, setSelectedAsset] = useState<AssetId>(defaultAsset);
  const [interval, setInterval] = useState('D');
  const containerRef = useRef<HTMLDivElement>(null);
  // useId로 고유한 컨테이너 ID 생성 (SSR 안전)
  const uid = useId().replace(/:/g, '');
  const containerId = `tv_chart_${uid}`;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 기존 위젯 완전 제거
    container.innerHTML = '';

    const symbol = ASSET_META[selectedAsset].tvSymbol;

    // TradingView Advanced Chart 공식 embed 방식
    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.cssText = 'height:100%;width:100%;';
    container.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    // 설정은 script의 textContent로 전달 (공식 방식)
    script.textContent = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: 'Asia/Seoul',
      theme: 'dark',
      style: '1',
      locale: 'kr',
      withdateranges: true,
      allow_symbol_change: true,
      calendar: false,
      studies: [
        'STD;RSI',
        'STD;Volume',
      ],
      support_host: 'https://www.tradingview.com',
      container_id: containerId,
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, [selectedAsset, interval, containerId]);

  return (
    <div className="flex flex-col h-full">
      {/* 컨트롤 바 */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {/* 자산 선택 */}
        <div className="flex gap-1 flex-wrap">
          {ASSET_IDS.map(id => {
            const meta = ASSET_META[id];
            const isActive = selectedAsset === id;
            return (
              <button
                key={id}
                onClick={() => setSelectedAsset(id)}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono
                  transition-all duration-150 border
                  ${isActive
                    ? 'font-semibold'
                    : 'border-[#1e2d4a] text-[#4a6080] hover:border-[#2a3d5a] hover:text-[#c8d8f0]'
                  }
                `}
                style={isActive
                  ? { color: meta.color, backgroundColor: `${meta.color}18`, borderColor: `${meta.color}50` }
                  : {}
                }
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: isActive ? meta.color : '#4a6080' }}
                />
                {meta.nameKo}
              </button>
            );
          })}
        </div>

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

        <div className="ml-auto">
          <span className="text-[10px] font-mono text-[#4a6080]">
            {ASSET_META[selectedAsset].tvSymbol}
          </span>
        </div>
      </div>

      {/* 차트 컨테이너 */}
      <div
        className="tradingview-widget-container flex-1 rounded-lg overflow-hidden border border-[#1e2d4a]"
        style={{ minHeight: '500px' }}
        id={containerId}
        ref={containerRef}
      />
    </div>
  );
}
