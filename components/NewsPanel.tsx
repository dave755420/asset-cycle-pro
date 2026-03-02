'use client';

/**
 * 실시간 뉴스 패널
 * - 5개 카테고리 탭: 암호화폐 / 미국증시 / 한국증시 / 환율·거시 / 원자재
 * - 최신순 카드 UI
 * - 클릭 시 새 창
 * - 모바일 반응형
 */

import { useState, useEffect, useCallback } from 'react';
import type { NewsCategory, NewsFeed, NewsItem } from '@/lib/types';
import { NEWS_CATEGORIES } from '@/lib/constants';

function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block group p-3.5 rounded-xl border border-[#1e2d4a] bg-[#0f1628] hover:border-[#2a3d5a] hover:bg-[#162040] transition-all duration-150 animate-fadeIn"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h3 className="text-xs font-semibold text-[#e8f0ff] leading-snug group-hover:text-[#00d4ff] transition-colors line-clamp-2 flex-1">
          {item.title}
        </h3>
        <span className="text-[#00d4ff] text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
          ↗
        </span>
      </div>

      {item.summary && item.summary.length > 10 && (
        <p className="text-[11px] text-[#4a6080] leading-relaxed line-clamp-2 mb-2">
          {item.summary}
        </p>
      )}

      <div className="flex items-center gap-2 mt-1">
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1e2d4a] text-[#c8d8f0]">
          {item.source}
        </span>
        <span className="text-[10px] font-mono text-[#4a6080]">
          {timeAgo(item.publishedAt)}
        </span>
      </div>
    </a>
  );
}

function SkeletonCard() {
  return (
    <div className="p-3.5 rounded-xl border border-[#1e2d4a] bg-[#0f1628] animate-pulse space-y-2">
      <div className="h-3 bg-[#1e2d4a] rounded w-full" />
      <div className="h-3 bg-[#1e2d4a] rounded w-4/5" />
      <div className="h-2 bg-[#1e2d4a] rounded w-1/3 mt-1" />
    </div>
  );
}

export function NewsPanel() {
  const [activeCategory, setActiveCategory] = useState<NewsCategory>('crypto');
  const [feeds, setFeeds] = useState<Map<NewsCategory, NewsFeed>>(new Map());
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadNews = useCallback(() => {
    setLoading(true);
    fetch('/api/news', { cache: 'no-store' })
      .then(r => r.json())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((data: any) => {
        const map = new Map<NewsCategory, NewsFeed>();
        for (const feed of data.feeds ?? []) {
          map.set(feed.category as NewsCategory, feed);
        }
        setFeeds(map);
        setFetchedAt(data.fetchedAt ?? '');
        setError(null);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadNews();
    const timer = setInterval(loadNews, 120_000); // 2분 갱신
    return () => clearInterval(timer);
  }, [loadNews]);

  const currentFeed = feeds.get(activeCategory);
  const items: NewsItem[] = currentFeed?.items ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xs font-bold text-[#e8f0ff]">실시간 금융 뉴스</h2>
          <p className="text-[10px] text-[#4a6080] font-mono mt-0.5">
            {fetchedAt ? new Date(fetchedAt).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' KST 기준' : '로딩 중...'}
          </p>
        </div>
        <button
          onClick={loadNews}
          className="text-[10px] font-mono px-2.5 py-1.5 rounded border border-[#1e2d4a] text-[#4a6080] hover:border-[#00d4ff] hover:text-[#00d4ff] transition-colors"
        >
          ↺ 갱신
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 flex-wrap mb-4">
        {NEWS_CATEGORIES.map(cat => {
          const feedData = feeds.get(cat.id);
          const count = feedData?.items.length ?? 0;

          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                transition-all duration-150 border
                ${activeCategory === cat.id
                  ? 'bg-[#00d4ff18] border-[#00d4ff50] text-[#00d4ff]'
                  : 'border-[#1e2d4a] text-[#4a6080] hover:border-[#2a3d5a] hover:text-[#c8d8f0]'
                }
              `}
            >
              <span>{cat.emoji}</span>
              <span>{cat.labelKo}</span>
              {!loading && count > 0 && (
                <span className={`
                  text-[9px] font-mono px-1 py-0.5 rounded-full min-w-[16px] text-center
                  ${activeCategory === cat.id ? 'bg-[#00d4ff30] text-[#00d4ff]' : 'bg-[#1e2d4a] text-[#4a6080]'}
                `}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-3 p-3 rounded-lg bg-[#ffb80015] border border-[#ffb80040] text-[#ffb800] text-xs">
          ⚠ 뉴스 로드 중 오류가 발생했습니다. 잠시 후 다시 시도합니다.
        </div>
      )}

      {/* News list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {loading ? (
          [...Array(5)].map((_, i) => <SkeletonCard key={i} />)
        ) : items.length > 0 ? (
          items.map((item, idx) => (
            <div key={item.id} style={{ animationDelay: `${idx * 40}ms` }}>
              <NewsCard item={item} />
            </div>
          ))
        ) : (
          <div className="text-center py-12 text-[#4a6080]">
            <p className="text-2xl mb-2">📰</p>
            <p className="text-sm">뉴스를 불러오는 중입니다...</p>
            <button
              onClick={loadNews}
              className="mt-3 text-xs text-[#00d4ff] hover:underline"
            >
              다시 시도
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
