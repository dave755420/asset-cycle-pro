'use client';

/**
 * components/AlertPanel.tsx
 * 알림 시스템 — 가격 조건 + VSA 시그널 알림
 * 브라우저 Notification API + localStorage 저장
 */

import { useState, useEffect, useCallback, useRef } from 'react';

type AlertType = 'price_above' | 'price_below' | 'pct_change';
type AlertStatus = 'active' | 'triggered' | 'paused';

interface PriceAlert {
  id: string;
  symbol: string;
  nameKo: string;
  type: AlertType;
  value: number;          // 임계값 (가격 또는 %)
  currentPrice: number;
  status: AlertStatus;
  createdAt: string;
  triggeredAt?: string;
  notified: boolean;
}

const ASSETS = [
  { symbol: 'BTC-USD',  nameKo: '비트코인',      color: '#f7931a' },
  { symbol: 'SPY',      nameKo: 'S&P 500 (SPY)', color: '#00d4ff' },
  { symbol: '^KS11',    nameKo: '코스피',         color: '#00ff88' },
  { symbol: 'GC=F',     nameKo: '금',             color: '#ffd700' },
  { symbol: '^TNX',     nameKo: '미 국채 10Y',    color: '#b48eff' },
  { symbol: 'USDKRW=X', nameKo: 'USD/KRW',       color: '#ffb800' },
];

const ALERT_STORAGE_KEY = 'asset-cycle-alerts-v1';

function loadAlerts(): PriceAlert[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(ALERT_STORAGE_KEY) ?? '[]'); }
  catch { return []; }
}

function saveAlerts(alerts: PriceAlert[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ALERT_STORAGE_KEY, JSON.stringify(alerts));
}

async function fetchPrice(symbol: string): Promise<number> {
  try {
    const res = await fetch(`/api/quant-data?symbol=${encodeURIComponent(symbol)}&range=5d&interval=1d`, { cache: 'no-store' });
    if (!res.ok) return 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as any;
    return json?.chart?.result?.[0]?.meta?.regularMarketPrice ?? 0;
  } catch { return 0; }
}

function checkCondition(alert: PriceAlert, currentPrice: number): boolean {
  if (currentPrice <= 0) return false;
  switch (alert.type) {
    case 'price_above':  return currentPrice >= alert.value;
    case 'price_below':  return currentPrice <= alert.value;
    case 'pct_change': {
      if (alert.currentPrice <= 0) return false;
      const pct = Math.abs((currentPrice - alert.currentPrice) / alert.currentPrice * 100);
      return pct >= alert.value;
    }
  }
}

function typeLabel(type: AlertType): string {
  return { price_above: '이상', price_below: '이하', pct_change: '% 변동' }[type];
}

export function AlertPanel() {
  const [alerts, setAlerts]     = useState<PriceAlert[]>([]);
  const [prices, setPrices]     = useState<Record<string, number>>({});
  const [showForm, setShowForm] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [form, setForm] = useState({
    symbol: ASSETS[0].symbol,
    nameKo: ASSETS[0].nameKo,
    type: 'price_above' as AlertType,
    value: '',
  });

  // 초기 로드
  useEffect(() => {
    setAlerts(loadAlerts());
    if ('Notification' in window) setPermission(Notification.permission);
  }, []);

  // 브라우저 알림 권한 요청
  const requestPermission = async () => {
    if (!('Notification' in window)) return;
    const p = await Notification.requestPermission();
    setPermission(p);
  };

  // 알림 발송
  const sendNotification = useCallback((alert: PriceAlert, price: number) => {
    const body = alert.type === 'pct_change'
      ? `현재가 ${price.toFixed(2)} (${((price - alert.currentPrice) / alert.currentPrice * 100).toFixed(2)}% 변동)`
      : `현재가 ${price.toFixed(2)} / 조건 ${alert.value} ${typeLabel(alert.type)}`;

    if (permission === 'granted') {
      new Notification(`🔔 ${alert.nameKo} 알림 도달!`, { body, icon: '/favicon.ico' });
    }
    // 콘솔 fallback
    console.log(`[Alert] ${alert.nameKo}: ${body}`);
  }, [permission]);

  // 가격 체크 & 알림 트리거
  const checkAlerts = useCallback(async (currentAlerts: PriceAlert[]) => {
    const activeAlerts = currentAlerts.filter(a => a.status === 'active');
    if (activeAlerts.length === 0) return;

    const symbols = [...new Set(activeAlerts.map(a => a.symbol))];
    const freshPrices: Record<string, number> = {};
    await Promise.all(symbols.map(async s => { freshPrices[s] = await fetchPrice(s); }));
    setPrices(prev => ({ ...prev, ...freshPrices }));

    const updated = currentAlerts.map(alert => {
      if (alert.status !== 'active') return alert;
      const price = freshPrices[alert.symbol];
      if (!price) return alert;
      if (checkCondition(alert, price)) {
        if (!alert.notified) sendNotification(alert, price);
        return { ...alert, status: 'triggered' as AlertStatus, triggeredAt: new Date().toISOString(), notified: true, currentPrice: price };
      }
      return { ...alert, currentPrice: price };
    });

    setAlerts(updated);
    saveAlerts(updated);
  }, [sendNotification]);

  // 60초 자동 체크
  useEffect(() => {
    if (alerts.length > 0) {
      checkAlerts(alerts);
      intervalRef.current = setInterval(() => checkAlerts(alerts), 60_000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [alerts.length, checkAlerts]);  // eslint-disable-line

  // 알림 추가
  const handleAdd = async () => {
    if (!form.value) return;
    const currentPrice = await fetchPrice(form.symbol);
    const newAlert: PriceAlert = {
      id:           `${form.symbol}-${Date.now()}`,
      symbol:       form.symbol,
      nameKo:       form.nameKo,
      type:         form.type,
      value:        parseFloat(form.value),
      currentPrice: currentPrice,
      status:       'active',
      createdAt:    new Date().toISOString(),
      notified:     false,
    };
    const updated = [...alerts, newAlert];
    setAlerts(updated);
    saveAlerts(updated);
    setShowForm(false);
    setForm({ ...form, value: '' });
  };

  const handleDelete = (id: string) => {
    const updated = alerts.filter(a => a.id !== id);
    setAlerts(updated);
    saveAlerts(updated);
  };

  const handleToggle = (id: string) => {
    const updated = alerts.map(a =>
      a.id === id ? { ...a, status: (a.status === 'active' ? 'paused' : 'active') as AlertStatus, notified: false } : a
    );
    setAlerts(updated);
    saveAlerts(updated);
  };

  const statusColor = (s: AlertStatus) =>
    s === 'triggered' ? '#00ff88' : s === 'active' ? '#ffb800' : '#4a6080';
  const statusLabel = (s: AlertStatus) =>
    s === 'triggered' ? '✅ 도달' : s === 'active' ? '⏳ 감시 중' : '⏸ 일시정지';

  const activeCount    = alerts.filter(a => a.status === 'active').length;
  const triggeredCount = alerts.filter(a => a.status === 'triggered').length;

  return (
    <div className="space-y-5">

      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#e8f0ff]">🔔 알림 시스템</h2>
          <p className="text-[10px] text-[#4a6080] font-mono mt-0.5">
            감시 중 {activeCount}개 · 도달 {triggeredCount}개 · 60초 자동 체크
          </p>
        </div>
        <div className="flex gap-2">
          {permission !== 'granted' && (
            <button onClick={requestPermission}
              className="px-3 py-1.5 rounded border border-[#ffb80040] bg-[#ffb80010] text-[10px] font-mono text-[#ffb800] hover:bg-[#ffb80020] transition-colors">
              🔔 알림 허용
            </button>
          )}
          {permission === 'granted' && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-[#00ff88]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />브라우저 알림 활성
            </span>
          )}
          <button onClick={() => setShowForm(!showForm)}
            className="px-4 py-1.5 rounded border border-[#00d4ff50] bg-[#00d4ff10] text-[10px] font-mono text-[#00d4ff] hover:bg-[#00d4ff20] transition-colors">
            + 알림 추가
          </button>
        </div>
      </div>

      {/* 알림 추가 폼 */}
      {showForm && (
        <div className="p-4 rounded-xl bg-[#0a0e1a] border border-[#00d4ff30] space-y-3">
          <p className="text-[11px] font-bold text-[#00d4ff] font-mono">+ 새 알림 설정</p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-[#4a6080] font-mono">자산</label>
              <select value={form.symbol}
                onChange={e => {
                  const a = ASSETS.find(p => p.symbol === e.target.value)!;
                  setForm({ ...form, symbol: a.symbol, nameKo: a.nameKo });
                }}
                className="w-full mt-1 px-2 py-1.5 rounded bg-[#0f1628] border border-[#1e2d4a] text-[11px] font-mono text-[#c8d8f0]">
                {ASSETS.map(a => <option key={a.symbol} value={a.symbol}>{a.nameKo}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#4a6080] font-mono">조건</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as AlertType })}
                className="w-full mt-1 px-2 py-1.5 rounded bg-[#0f1628] border border-[#1e2d4a] text-[11px] font-mono text-[#c8d8f0]">
                <option value="price_above">가격 이상</option>
                <option value="price_below">가격 이하</option>
                <option value="pct_change">% 변동</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#4a6080] font-mono">
                {form.type === 'pct_change' ? '변동률 (%)' : '기준 가격'}
              </label>
              <input type="number" placeholder="0" value={form.value}
                onChange={e => setForm({ ...form, value: e.target.value })}
                className="w-full mt-1 px-2 py-1.5 rounded bg-[#0f1628] border border-[#1e2d4a] text-[11px] font-mono text-[#c8d8f0] placeholder-[#2a3d5a]"
              />
            </div>
          </div>
          {form.symbol && prices[form.symbol] && (
            <p className="text-[10px] font-mono text-[#4a6080]">
              현재가: {prices[form.symbol].toFixed(2)}
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={handleAdd}
              className="px-4 py-1.5 rounded border border-[#00d4ff50] bg-[#00d4ff10] text-[11px] font-mono text-[#00d4ff] hover:bg-[#00d4ff20] transition-colors">
              알림 시작
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-1.5 rounded border border-[#1e2d4a] text-[11px] font-mono text-[#4a6080] hover:border-[#ff4466] hover:text-[#ff4466] transition-colors">
              취소
            </button>
          </div>
        </div>
      )}

      {/* 알림 목록 */}
      {alerts.length === 0 ? (
        <div className="text-center py-16 text-[#4a6080]">
          <p className="text-4xl mb-3">🔔</p>
          <p className="text-sm">조건 설정 시 자동으로 알림을 받을 수 있습니다</p>
          <p className="text-xs mt-1 text-[#2a3d5a]">예: BTC $100,000 이상 / SPY -5% 변동</p>
          <button onClick={() => setShowForm(true)}
            className="mt-4 px-5 py-2 rounded-lg border border-[#00d4ff40] text-[#00d4ff] text-xs font-mono hover:bg-[#00d4ff15] transition-all">
            + 첫 알림 설정
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map(alert => (
            <div key={alert.id}
              className={`p-4 rounded-xl border transition-all ${
                alert.status === 'triggered' ? 'border-[#00ff8840] bg-[#00ff8808]' : 'border-[#1e2d4a] bg-[#0a0e1a]'
              }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-lg">{alert.status === 'triggered' ? '✅' : alert.status === 'active' ? '⏳' : '⏸'}</div>
                  <div>
                    <p className="text-xs font-bold text-[#e8f0ff]">{alert.nameKo}</p>
                    <p className="text-[10px] font-mono text-[#4a6080]">
                      {alert.type === 'pct_change'
                        ? `${alert.value}% 변동 시`
                        : `${alert.value.toLocaleString()} ${typeLabel(alert.type)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] font-mono" style={{ color: statusColor(alert.status) }}>
                      {statusLabel(alert.status)}
                    </p>
                    {alert.triggeredAt && (
                      <p className="text-[9px] font-mono text-[#2a3d5a]">
                        {new Date(alert.triggeredAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                  {alert.status !== 'triggered' && (
                    <button onClick={() => handleToggle(alert.id)}
                      className="text-[9px] font-mono px-2 py-1 rounded border border-[#1e2d4a] text-[#4a6080] hover:border-[#ffb800] hover:text-[#ffb800] transition-colors">
                      {alert.status === 'active' ? '정지' : '재개'}
                    </button>
                  )}
                  <button onClick={() => handleDelete(alert.id)}
                    className="text-[#2a3d5a] hover:text-[#ff4466] transition-colors text-sm">✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
