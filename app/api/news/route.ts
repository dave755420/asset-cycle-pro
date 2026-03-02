/**
 * API Route: /api/news
 * 카테고리별 실시간 뉴스 — RSS 피드 집계
 *
 * 소스:
 *   - 암호화폐:    CoinTelegraph, Decrypt
 *   - 미국 증시:   Reuters (finance), Seeking Alpha
 *   - 한국 증시:   연합뉴스 경제, 한경
 *   - 환율/거시:   FT Markets RSS
 *   - 원자재:      Kitco News, Reuters Commodities
 *
 * RSS → JSON: rss2json.com 무료 API (10K req/day)
 * 폴백: 직접 XML 파싱 (DOMParser 불가 → 정규식)
 */
import { NextRequest, NextResponse } from 'next/server';
import type { NewsCategory, NewsItem, NewsFeed } from '@/lib/types';

const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';

interface RssSource {
  url: string;
  source: string;
  category: NewsCategory;
}

const RSS_SOURCES: RssSource[] = [
  // 암호화폐
  { url: 'https://cointelegraph.com/rss', source: 'CoinTelegraph', category: 'crypto' },
  { url: 'https://decrypt.co/feed', source: 'Decrypt', category: 'crypto' },
  // 미국 증시
  { url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC&region=US&lang=en-US', source: 'Yahoo Finance', category: 'us_market' },
  { url: 'https://www.investing.com/rss/news_285.rss', source: 'Investing.com', category: 'us_market' },
  // 한국 증시
  { url: 'https://www.yna.co.kr/RSS/economy.xml', source: '연합뉴스', category: 'kr_market' },
  { url: 'https://www.hankyung.com/feed/stock-market', source: '한국경제', category: 'kr_market' },
  // 환율/거시경제
  { url: 'https://www.investing.com/rss/news_301.rss', source: 'Investing.com FX', category: 'fx_macro' },
  { url: 'https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines', source: 'MarketWatch', category: 'fx_macro' },
  // 원자재
  { url: 'https://www.kitco.com/rss/kitco-news.xml', source: 'Kitco News', category: 'commodity' },
  { url: 'https://www.investing.com/rss/news_25.rss', source: 'Investing.com 원자재', category: 'commodity' },
];

const CATEGORY_LABELS: Record<NewsCategory, string> = {
  crypto:    '암호화폐',
  us_market: '미국 증시',
  kr_market: '한국 증시',
  fx_macro:  '환율·거시경제',
  commodity: '원자재',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRssItems(items: any[], source: string, category: NewsCategory): NewsItem[] {
  return (items ?? []).slice(0, 6).map((item, idx) => ({
    id: `${source}-${idx}-${Date.now()}`,
    title: stripHtml(item.title ?? ''),
    url: item.link ?? item.url ?? '#',
    source,
    publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    category,
    summary: stripHtml((item.description ?? item.content ?? '').slice(0, 160)),
  }));
}

function stripHtml(str: string): string {
  return str
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

async function fetchRSSFeed(src: RssSource): Promise<NewsItem[]> {
  const url = `${RSS2JSON}${encodeURIComponent(src.url)}&count=8`;
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as any;
    if (json.status !== 'ok' && json.status !== 'success') throw new Error('RSS2JSON error');
    return parseRssItems(json.items ?? [], src.source, src.category);
  } catch (err) {
    console.warn(`[News] RSS fetch failed (${src.source}):`, err);
    return [];
  }
}

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const catParam = searchParams.get('category') as NewsCategory | null;

  const sources = catParam
    ? RSS_SOURCES.filter(s => s.category === catParam)
    : RSS_SOURCES;

  try {
    // 병렬 fetch
    const itemArrays = await Promise.all(sources.map(fetchRSSFeed));

    // 카테고리별 집계
    const byCategory = new Map<NewsCategory, NewsItem[]>();
    for (const items of itemArrays) {
      for (const item of items) {
        const arr = byCategory.get(item.category) ?? [];
        arr.push(item);
        byCategory.set(item.category, arr);
      }
    }

    // 각 카테고리 최신순 정렬, 최대 10개
    const feeds: NewsFeed[] = [...byCategory.entries()].map(([cat, items]) => ({
      category: cat,
      labelKo: CATEGORY_LABELS[cat],
      items: items
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
        .slice(0, 10),
      fetchedAt: new Date().toISOString(),
    }));

    return NextResponse.json(
      { feeds, fetchedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } }
    );
  } catch (err) {
    console.error('[API/news]', err);
    return NextResponse.json({ error: '뉴스 로드 실패', feeds: [] }, { status: 500 });
  }
}
