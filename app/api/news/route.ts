/**
 * API Route: /api/news  v5
 * 번역: MyMemory 무료 API (API 키 불필요, 서버사이드 실행)
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

const KR_SOURCES = new Set(['연합뉴스', '조선비즈', '한국경제', '한경', '뉴스1', '머니투데이', '이데일리']);

function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, {
    signal: ctrl.signal, cache: 'no-store',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/xml, application/rss+xml, */*',
    },
  }).finally(() => clearTimeout(t));
}

function clean(s: string): string {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function parseRssXml(xml: string, source: string, category: NewsCategory): NewsItem[] {
  const items: NewsItem[] = [];
  const matches = [...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)];
  for (let i = 0; i < Math.min(matches.length, 8); i++) {
    const block = matches[i][1];
    const title = clean(block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
    const link  = clean(
      block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ??
      block.match(/<link[^>]+href="([^"]+)"/i)?.[1] ??
      block.match(/<guid[^>]*isPermaLink="true"[^>]*>([\s\S]*?)<\/guid>/i)?.[1] ?? '#'
    );
    const pubDate = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() ?? '';
    const desc    = clean((block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ?? '').slice(0, 200));
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

// ─── MyMemory 무료 번역 ──────────────────────────────────────────────────────
async function translateOne(text: string): Promise<string> {
  if (!text?.trim()) return text;
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 400))}&langpair=en|ko`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return text;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json() as any;
    const t: string = data?.responseData?.translatedText ?? '';
    if (!t || t.toLowerCase().includes('mymemory warning') || t === text) return text;
    return t;
  } catch { return text; }
}

async function translateItems(items: NewsItem[]): Promise<NewsItem[]> {
  const toTranslate = items.filter(i => !KR_SOURCES.has(i.source));
  const alreadyKr   = items.filter(i =>  KR_SOURCES.has(i.source));
  if (toTranslate.length === 0) return items;

  // 8개씩 병렬 번역
  const translated = [...toTranslate];
  const BATCH = 8;
  for (let i = 0; i < toTranslate.length; i += BATCH) {
    await Promise.all(
      toTranslate.slice(i, i + BATCH).map(async (item, j) => {
        translated[i + j] = { ...item, title: await translateOne(item.title) };
      })
    );
  }

  return [...translated, ...alreadyKr]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

// ─── CryptoCompare ───────────────────────────────────────────────────────────
async function fetchCrypto(): Promise<NewsItem[]> {
  try {
    const res = await fetchWithTimeout('https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=latest');
    if (!res.ok) throw new Error(`${res.status}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as any;
    return (json?.Data ?? []).slice(0, 10).map((d: any, i: number): NewsItem => ({
      id: `crypto-${i}-${d.id}`,
      title: d.title ?? '',
      url: d.url ?? '#',
      source: d.source_info?.name ?? d.source ?? 'CryptoCompare',
      publishedAt: d.published_on ? new Date(d.published_on * 1000).toISOString() : new Date().toISOString(),
      category: 'crypto',
      summary: (d.body ?? '').slice(0, 160),
    }));
  } catch (e) { console.warn('[News] CryptoCompare 실패:', e); return []; }
}

interface RssSrc { url: string; source: string; cat: NewsCategory; }
const RSS_LIST: RssSrc[] = [
  { url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',    source: 'WSJ Markets',   cat: 'us_market' },
  { url: 'https://www.investing.com/rss/news_285.rss',        source: 'Investing.com', cat: 'us_market' },
  { url: 'https://www.yna.co.kr/RSS/economy.xml',             source: '연합뉴스',       cat: 'kr_market' },
  { url: 'https://biz.chosun.com/site/data/rss/rss.xml',     source: '조선비즈',       cat: 'kr_market' },
  { url: 'https://www.hankyung.com/feed/finance',             source: '한국경제',       cat: 'kr_market' },
  { url: 'https://www.forexlive.com/feed/news',               source: 'ForexLive',     cat: 'fx_macro'  },
  { url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml',      source: 'WSJ World',     cat: 'fx_macro'  },
  { url: 'https://www.kitco.com/rss/kitco-news.xml',         source: 'Kitco News',    cat: 'commodity' },
  { url: 'https://oilprice.com/rss/main',                     source: 'OilPrice',      cat: 'commodity' },
];

async function fetchRss(src: RssSrc): Promise<NewsItem[]> {
  try {
    const res = await fetchWithTimeout(src.url);
    if (!res.ok) throw new Error(`${res.status}`);
    const xml = await res.text();
    if (!xml.includes('<item')) throw new Error('RSS 항목 없음');
    return parseRssXml(xml, src.source, src.cat);
  } catch (e) { console.warn(`[News] RSS ${src.source} 실패:`, (e as Error).message); return []; }
}

function makeDummyNews(category: NewsCategory): NewsItem[] {
  const now = new Date().toISOString();
  const dummies: Record<NewsCategory, Array<{ title: string; url: string }>> = {
    crypto:    [
      { title: 'Bitcoin, 주요 저항선 부근에서 거래 지속', url: 'https://cointelegraph.com' },
      { title: 'Ethereum 네트워크 활동 상승세',           url: 'https://decrypt.co' },
      { title: '기관 투자자들의 암호화폐 관심 증가',       url: 'https://coindesk.com' },
    ],
    us_market: [
      { title: 'S&P 500, 경제지표 소화 속 보합 유지',     url: 'https://marketwatch.com' },
      { title: 'Fed 위원들, 금리 결정에 신중한 입장 시사', url: 'https://wsj.com' },
      { title: '기술주 주도로 오후 장 상승세',             url: 'https://bloomberg.com' },
    ],
    kr_market: [
      { title: '코스피, 외국인 매수세에 강보합 마감',       url: 'https://www.yna.co.kr' },
      { title: '원·달러 환율, 글로벌 달러 약세에 하락',    url: 'https://www.hankyung.com' },
      { title: '반도체주 강세…삼성전자·SK하이닉스 상승',   url: 'https://biz.chosun.com' },
    ],
    fx_macro:  [
      { title: '달러 약세, Fed 금리 전망 재평가',           url: 'https://forexlive.com' },
      { title: '달러·원 환율, 위험선호 개선에 하락',        url: 'https://reuters.com' },
      { title: '글로벌 채권 금리, 변동성 이후 안정',         url: 'https://ft.com' },
    ],
    commodity: [
      { title: '금 가격, 안전자산 수요에 고점 유지',         url: 'https://kitco.com' },
      { title: '유가, OPEC+ 감산 기대감에 안정세',           url: 'https://oilprice.com' },
      { title: '구리, 중국 수요 개선 전망에 상승',           url: 'https://reuters.com' },
    ],
  };
  return (dummies[category] ?? []).map((d, i) => ({
    id: `dummy-${category}-${i}`, title: d.title, url: d.url, source: '뉴스 로딩 중',
    publishedAt: now, category, summary: '실시간 뉴스 연결 중입니다. 잠시 후 새로고침하세요.',
  }));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const catParam = searchParams.get('category') as NewsCategory | null;
  const categories: NewsCategory[] = catParam ? [catParam] : ['crypto', 'us_market', 'kr_market', 'fx_macro', 'commodity'];

  const [cryptoItems, ...rssGroups] = await Promise.all([
    fetchCrypto(),
    ...RSS_LIST.filter(s => categories.includes(s.cat)).map(fetchRss),
  ]);

  const byCategory = new Map<NewsCategory, NewsItem[]>();
  if (categories.includes('crypto')) byCategory.set('crypto', cryptoItems);
  for (const items of rssGroups) {
    for (const item of items) {
      if (!categories.includes(item.category)) continue;
      const arr = byCategory.get(item.category) ?? [];
      arr.push(item);
      byCategory.set(item.category, arr);
    }
  }

  const feeds: NewsFeed[] = await Promise.all(
    categories.map(async cat => {
      const raw = byCategory.get(cat) ?? [];
      let items: NewsItem[];
      if (raw.length > 0) {
        const sorted = raw.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()).slice(0, 10);
        items = await translateItems(sorted);
      } else {
        items = makeDummyNews(cat);
      }
      return { category: cat, labelKo: CATEGORY_LABELS[cat], items, fetchedAt: new Date().toISOString() };
    })
  );

  return NextResponse.json(
    { feeds, fetchedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
  );
}
