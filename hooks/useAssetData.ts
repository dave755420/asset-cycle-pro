'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AssetQuote, CorrelationMatrix, QuantInsight, LeadLagResult, Period, RollingWindow } from '@/lib/types';
import { REFRESH_INTERVAL_MS } from '@/lib/constants';

// ─── Live Quotes hook ──────────────────────────────────────────────────────
export function useQuotes() {
  const [quotes, setQuotes] = useState<AssetQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_MS / 1000);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const countdownRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const fetchQuotes = useCallback(async () => {
    try {
      // no-store: 항상 최신 데이터 요청
      const res = await fetch('/api/assets', { cache: 'no-store' });
      if (!res.ok) throw new Error(`API 오류 (${res.status})`);
      const data = await res.json();
      setQuotes(data.quotes ?? []);
      setLastUpdated(data.updatedAt ?? new Date().toISOString());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setCountdown(REFRESH_INTERVAL_MS / 1000);
    }
  }, []);

  useEffect(() => {
    fetchQuotes();
    timerRef.current = setInterval(fetchQuotes, REFRESH_INTERVAL_MS);
    countdownRef.current = setInterval(() => {
      setCountdown(c => Math.max(0, c - 1));
    }, 1000);
    return () => {
      clearInterval(timerRef.current);
      clearInterval(countdownRef.current);
    };
  }, [fetchQuotes]);

  return { quotes, loading, error, lastUpdated, countdown, refresh: fetchQuotes };
}

// ─── Correlation hook ──────────────────────────────────────────────────────
export function useCorrelation(period: Period, window: RollingWindow) {
  const [correlationMatrix, setCorrelationMatrix] = useState<CorrelationMatrix | null>(null);
  const [insights, setInsights] = useState<QuantInsight[]>([]);
  const [leadLags, setLeadLags] = useState<LeadLagResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const ctrl = new AbortController();
    fetch(`/api/correlation?period=${period}&window=${window}`, { signal: ctrl.signal })
      .then(r => {
        if (!r.ok) throw new Error('분석 데이터 로드 실패');
        return r.json();
      })
      .then(data => {
        setCorrelationMatrix(data.correlationMatrix ?? null);
        setInsights(data.insights ?? []);
        setLeadLags(data.leadLags ?? []);
        setError(null);
      })
      .catch(err => {
        if (err.name !== 'AbortError') setError(err.message);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [period, window]);

  return { correlationMatrix, insights, leadLags, loading, error };
}
