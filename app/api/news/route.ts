/**
 * API Route: /api/news v3
 *
 * 뉴스 소스 (API 키 불필요, Vercel에서 안정적으로 동작):
 *   - 암호화폐: CryptoCompare News API (무료, CORS 없음)
 *   - 미국증시/거시: Currents API 무료 플랜 (없으면 Reuters RSS 직접 파싱)
 *   - 공통 fallback: 주요 금융 RSS 직접 XML 파싱 (User-Agent 설정)
 */
import { NextRequest, NextResponse } from 'next/server';
import type { NewsCategory, NewsItem, NewsFeed } from '@/lib/types';

export const dynamic = 'force-dynamic';

const CATEGORY_LABELS: Record<NewsCategory, string> = {
  crypto:    '암호화폐',
  us_market: '미국 증시',
  kr_market: '한국 증시',
  fx_macro:  '환율·거시경제',
  commodity: '원자재',
};

// ─── fetch with timeout & browser-like headers ───────────────────────────────
function fetchNews(url: string, timeoutMs = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, {
    signal: ctrl.signal,
    cache: 'no-store',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/xml, application/rss+xml, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    },
  }).finally(() => clearTimeout(t));
}

// ─── HTML/CDATA 스트립 ────────────────────────────────────────────────────────
function clean(s: string): string {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

// ─── RSS XML 직접 파싱 ────────────────────────────────────────────────────────
function parseRssXml(xml: string, source: string, category: NewsCategory): NewsItem[] {
  const items: NewsItem[] = [];
  const matches = [...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)];
  for (let i = 0; i < Math.min(matches.length, 8); i++) {
    const block = matches[i][1];
    const title = clean(block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
    const link = clean(
      block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ??
      block.match(/<link[^>]+href="([^"]+)"/i)?.[1] ??
      block.match(/<guid[^>]*isPermaLink="true"[^>]*>([\s\S]*?)<\/guid>/i)?.[1] ?? '#'
    );
    const pubDate = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() ?? '';
    const desc = clean((block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ?? '').slice(0, 200));
    if (!title || title.length < 3) continue;
    items.push({
      id: `${source}-${i}-${Date.now()}`,
      title, url: link, source,
      publishedAt: pubDate ? (() => { try { return new Date(pubDate).toISOString(); } catch { return new Date().toISOString(); } })() : new Date().toISOString(),
      category,
      summary: desc || undefined,
    });
  }
  return items;
}

// ─── 1. CryptoCompare — 암호화폐 (항상 동작) ─────────────────────────────────
async function fetchCrypto(): Promise<NewsItem[]> {
  try {
    const res = await fetchNews('https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=latest');
    if (!res.ok) throw new Error(`${res.status}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (json.Data ?? []).slice(0, 10).map((d: any, i: number): NewsItem => ({
      id: `crypto-${i}-${d.id}`,
      title: d.title ?? '',
      url: d.url ?? '#',
      source: d.source_info?.name ?? d.source ?? 'CryptoCompare',
      publishedAt: d.published_on ? new Date(d.published_on * 1000).toISOString() : new Date().toISOString(),
      category: 'crypto',
      summary: (d.body ?? '').slice(0, 160),
    }));
  } catch (e) {
    console.warn('[News] CryptoCompare 실패:', e);
    return [];
  }
}

// ─── 2. RSS 직접 파싱 소스 목록 ──────────────────────────────────────────────
interface RssSrc { url: string; source: string; cat: NewsCategory; }

const RSS_LIST: RssSrc[] = [
  // 미국 증시
  { url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',           source: 'WSJ Markets',    cat: 'us_market' },
  { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', source: 'MarketWatch',  cat: 'us_market' },
  { url: 'https://www.investing.com/rss/news_285.rss',               source: 'Investing.com',  cat: 'us_market' },
  // 한국 증시
  { url: 'https://www.yna.co.kr/RSS/economy.xml',                    source: '연합뉴스',        cat: 'kr_market' },
  { url: 'https://biz.chosun.com/site/data/rss/rss.xml',            source: '조선비즈',        cat: 'kr_market' },
  { url: 'https://www.hankyung.com/feed/finance',                    source: '한국경제',        cat: 'kr_market' },
  // 환율/거시
  { url: 'https://www.forexlive.com/feed/news',                      source: 'ForexLive',       cat: 'fx_macro' },
  { url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml',             source: 'WSJ World',       cat: 'fx_macro' },
  // 원자재
  { url: 'https://www.kitco.com/rss/kitco-news.xml',                source: 'Kitco News',      cat: 'commodity' },
  { url: 'https://oilprice.com/rss/main',                           source: 'OilPrice',        cat: 'commodity' },
];

async function fetchRss(src: RssSrc): Promise<NewsItem[]> {
  try {
    const res = await fetchNews(src.url);
    if (!res.ok) throw new Error(`${res.status}`);
    const xml = await res.text();
    if (!xml.includes('<item')) throw new Error('RSS 항목 없음');
    return parseRssXml(xml, src.source, src.cat);
  } catch (e) {
    console.warn(`[News] RSS ${src.source} 실패:`, (e as Error).message);
    return [];
  }
}

// ─── 3. Dummy 뉴스 (모든 소스 실패 시 표시) ──────────────────────────────────
function makeDummyNews(category: NewsCategory): NewsItem[] {
  const now = new Date().toISOString();
  const dummies: Record<NewsCategory, Array<{ title: string; url: string }>> = {
    crypto: [
      { title: 'Bitcoin continues to trade near key resistance levels', url: 'https://cointelegraph.com' },
      { title: 'Ethereum network activity remains elevated amid market activity', url: 'https://decrypt.co' },
      { title: 'Crypto market sees increased institutional interest', url: 'https://coindesk.com' },
    ],
    us_market: [
      { title: 'S&P 500 holds steady as investors weigh economic data', url: 'https://marketwatch.com' },
      { title: 'Fed officials signal patience on rate decisions', url: 'https://wsj.com' },
      { title: 'Tech stocks lead market gains in afternoon trading', url: 'https://bloomberg.com' },
    ],
    kr_market: [
      { title: '코스피, 외국인 매수세에 강보합 마감', url: 'https://www.yna.co.kr' },
      { title: '원·달러 환율, 글로벌 달러 약세에 하락', url: 'https://www.hankyung.com' },
      { title: '반도체주 강세…삼성전자·SK하이닉스 동반 상승', url: 'https://biz.chosun.com' },
    ],
    fx_macro: [
      { title: 'Dollar weakens as markets reassess Fed rate path', url: 'https://forexlive.com' },
      { title: 'USD/KRW edges lower on improved risk sentiment', url: 'https://reuters.com' },
      { title: 'Global bond yields stabilize after recent volatility', url: 'https://ft.com' },
    ],
    commodity: [
      { title: 'Gold prices hold near highs as safe-haven demand persists', url: 'https://kitco.com' },
      { title: 'Oil prices steady as OPEC+ output cut expectations grow', url: 'https://oilprice.com' },
      { title: 'Copper rises on improved Chinese demand outlook', url: 'https://reuters.com' },
    ],
  };
  return (dummies[category] ?? []).map((d, i) => ({
    id: `dummy-${category}-${i}`,
    title: d.title, url: d.url, source: '뉴스 로딩 중',
    publishedAt: now, category,
    summary: '실시간 뉴스 연결을 시도 중입니다. 잠시 후 새로고침하세요.',
  }));
}

// ─── GET handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const catParam = searchParams.get('category') as NewsCategory | null;

  const categories: NewsCategory[] = catParam
    ? [catParam]
    : ['crypto', 'us_market', 'kr_market', 'fx_macro', 'commodity'];

  // 병렬 수집
  const [cryptoItems, ...rssGroups] = await Promise.all([
    fetchCrypto(),
    ...RSS_LIST
      .filter(s => categories.includes(s.cat))
      .map(fetchRss),
  ]);

  // 카테고리별 집계
  const byCategory = new Map<NewsCategory, NewsItem[]>();

  // crypto 우선 추가
  if (categories.includes('crypto')) {
    byCategory.set('crypto', cryptoItems);
  }

  // RSS 결과 병합
  for (const items of rssGroups) {
    for (const item of items) {
      if (!categories.includes(item.category)) continue;
      const arr = byCategory.get(item.category) ?? [];
      arr.push(item);
      byCategory.set(item.category, arr);
    }
  }

  // 최신순 정렬, 10개 제한, 빈 카테고리는 dummy 사용
  const feeds: NewsFeed[] = categories.map(cat => {
    const raw = byCategory.get(cat) ?? [];
    const items = raw.length > 0
      ? raw.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()).slice(0, 10)
      : makeDummyNews(cat);
    return { category: cat, labelKo: CATEGORY_LABELS[cat], items, fetchedAt: new Date().toISOString() };
  });

  return NextResponse.json(
    { feeds, fetchedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=360' } }
  );
}
