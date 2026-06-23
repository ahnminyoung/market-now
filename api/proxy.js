export const config = { runtime: 'edge' };

const TARGETS = {
  'naver-api':     { base: 'https://m.stock.naver.com',          prefix: '/api' },
  'naver-front':   { base: 'https://m.stock.naver.com',          prefix: '/front-api' },
  'naver-polling': { base: 'https://polling.finance.naver.com',   prefix: '/api' },
  'naver-chart':   { base: 'https://api.stock.naver.com',         prefix: '/chart' },
  'naver-stock':   { base: 'https://api.stock.naver.com',         prefix: '' },
  'naver-ac':      { base: 'https://ac.stock.naver.com',          prefix: '' },
  'dart':          { base: 'https://opendart.fss.or.kr',          prefix: '' },
  'alphavantage':  { base: 'https://www.alphavantage.co',         prefix: '' },
  'gnews':         { base: 'https://news.google.com',             prefix: '' },
};

export default async function handler(req) {
  const url = new URL(req.url);
  const t = url.searchParams.get('t');
  const p = url.searchParams.get('p') ?? '';

  url.searchParams.delete('t');
  url.searchParams.delete('p');
  const qs = url.searchParams.toString();

  const target = TARGETS[t];
  if (!target) return new Response('Not found', { status: 404 });

  const targetUrl = `${target.base}${target.prefix}/${p}${qs ? '?' + qs : ''}`;

  const response = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      'Referer': 'https://m.stock.naver.com/',
    },
  });

  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');

  return new Response(response.body, { status: response.status, headers });
}
