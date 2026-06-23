/* 네이버 증권 비공식 API 래퍼. 모든 경로는 vite.config.js의 프록시를 거친다. */

export async function getJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

/* ---------- 포맷/파싱 유틸 ---------- */
export const num = v =>
  typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, '')) || 0;

// API의 등락률은 대체로 부호가 포함되지만, 방향 타입으로 한 번 더 보정한다.
export function signedPct(ratio, directionName) {
  let p = num(ratio);
  if ((directionName === 'FALLING' || directionName === 'LOWER_LIMIT') && p > 0) p = -p;
  return p;
}

export const fmtPct = p => (p > 0 ? '+' : '') + p.toFixed(2) + '%';
export function fmtShares(v) {
  const n = Number(String(v ?? '').replace(/,/g, ''));
  if (!n || isNaN(n)) return '—';
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}억주`;
  if (n >= 1e4) return `${Math.round(n / 1e4).toLocaleString('ko-KR')}만주`;
  return `${n.toLocaleString('ko-KR')}주`;
}
export const fmtPrice = v =>
  v >= 10000
    ? Math.round(v).toLocaleString('ko-KR')
    : v.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
export const cls = p => (p >= 1 ? 'up' : p <= -1 ? 'down' : 'flat');

// 억 단위 금액 → '1조 2,345억' / '987억'
export function fmtEok(eok) {
  if (eok >= 10000) {
    const jo = Math.floor(eok / 10000);
    const rest = Math.round(eok % 10000);
    return rest ? `${jo}조 ${rest.toLocaleString('ko-KR')}억` : `${jo}조`;
  }
  return `${Math.round(eok).toLocaleString('ko-KR')}억`;
}

export function getHeatColor(pct) {
  const c = Math.max(-30, Math.min(30, pct));
  const t = Math.min(Math.abs(c) / 30, 1);
  if (c >= 1) return `rgb(${Math.round(255 - 55 * t)},${Math.round(205 - 205 * t)},${Math.round(205 - 175 * t)})`;
  if (c <= -1) return `rgb(${Math.round(205 - 195 * t)},${Math.round(225 - 165 * t)},${Math.round(255 - 55 * t)})`;
  return 'rgb(110,118,134)';
}
export const heatText = p => (Math.abs(p) > 15 ? '#fff' : '#10131a');

const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, '');

const mapStock = market => s => {
  const vol = num(s.accumulatedTradingValue) / 100; // 백만원 → 억원
  return {
    code: s.itemCode,
    name: s.stockName,
    market,
    price: num(s.closePrice),
    pct: signedPct(s.fluctuationsRatio, s.compareToPreviousPrice?.name),
    vol,
    volText: fmtEok(vol),
  };
};

/* ---------- 지수 / 환율 ---------- */
export async function fetchIndices() {
  const d = await getJson('/n-polling/realtime/domestic/index/KOSPI,KOSDAQ,KPI200');
  return (d.datas ?? []).map(it => ({
    code: it.itemCode,
    name: it.itemCode === 'KPI200' ? 'KOSPI200' : it.itemCode,
    val: num(it.closePriceRaw ?? it.closePrice),
    pct: signedPct(it.fluctuationsRatioRaw ?? it.fluctuationsRatio, it.compareToPreviousPrice?.name),
    marketStatus: it.marketStatus,
  }));
}

export async function fetchUsdKrw() {
  const d = await getJson('/n-front/marketIndex/productDetail?category=exchange&reutersCode=FX_USDKRW');
  const r = d.result;
  return {
    code: 'FX_USDKRW',
    name: 'USD/KRW',
    val: num(r.calcPrice ?? r.closePrice),
    pct: signedPct(r.fluctuationsRatio, r.fluctuationsType?.name),
  };
}

// 환율 일별 시세 (스파크라인용, 과거 → 최신 순으로 반환)
export async function fetchFxSeries(size = 40) {
  const d = await getJson(`/n-front/marketIndex/prices?category=exchange&reutersCode=FX_USDKRW&page=1&pageSize=${size}`);
  return (d.result ?? []).map(p => num(p.closePrice)).reverse();
}

/* ---------- 캔들 ---------- */
function candleRange(days) {
  const end = new Date();
  const start = new Date(Date.now() - days * 864e5);
  return `startDateTime=${ymd(start)}000000&endDateTime=${ymd(end)}235959`;
}

export async function fetchIndexCandles(code, days = 70) {
  return getJson(`/n-chart/domestic/index/${code}/day?${candleRange(days)}`);
}

export async function fetchStockCandles(code, days = 70) {
  return getJson(`/n-chart/domestic/item/${code}/day?${candleRange(days)}`);
}

/* ---------- 시장 스냅샷 (랭킹 + 시장 온도) ---------- */
export async function fetchMarketSnapshot() {
  const [upK, downK, upQ, downQ] = await Promise.all([
    getJson('/n-api/stocks/up/KOSPI?page=1&pageSize=100'),
    getJson('/n-api/stocks/down/KOSPI?page=1&pageSize=100'),
    getJson('/n-api/stocks/up/KOSDAQ?page=1&pageSize=100'),
    getJson('/n-api/stocks/down/KOSDAQ?page=1&pageSize=100'),
  ]);
  const stocks = [
    ...(upK.stocks ?? []).map(mapStock('코스피')),
    ...(downK.stocks ?? []).map(mapStock('코스피')),
    ...(upQ.stocks ?? []).map(mapStock('코스닥')),
    ...(downQ.stocks ?? []).map(mapStock('코스닥')),
  ];
  return {
    stocks,
    up: (upK.totalCount ?? 0) + (upQ.totalCount ?? 0),
    down: (downK.totalCount ?? 0) + (downQ.totalCount ?? 0),
    marketStatus: upK.marketStatus,
  };
}

// 시장 온도: 상승/하락 랭킹의 totalCount가 곧 상승/하락 종목 수,
// 시가총액 랭킹의 totalCount가 전체 상장 종목 수다 (실측으로 확인).
export async function fetchBreadthKr() {
  const get = (sort, mk) => getJson(`/n-api/stocks/${sort}/${mk}?page=1&pageSize=1`);
  const [uk, uq, dk, dq, mk, mq] = await Promise.all([
    get('up', 'KOSPI'), get('up', 'KOSDAQ'),
    get('down', 'KOSPI'), get('down', 'KOSDAQ'),
    get('marketValue', 'KOSPI'), get('marketValue', 'KOSDAQ'),
  ]);
  return {
    up: (uk.totalCount ?? 0) + (uq.totalCount ?? 0),
    down: (dk.totalCount ?? 0) + (dq.totalCount ?? 0),
    total: (mk.totalCount ?? 0) + (mq.totalCount ?? 0),
  };
}

// 지수 카드 스파크라인용 일별 종가 시계열 묶음
export async function fetchIndexSeriesKr() {
  const out = {};
  await Promise.all([
    ...['KOSPI', 'KOSDAQ', 'KPI200'].map(async code => {
      try {
        out[code] = (await fetchIndexCandles(code)).map(c => c.closePrice);
      } catch (e) {
        console.warn('index candles failed:', e.message);
      }
    }),
    (async () => {
      try {
        out.FX_USDKRW = await fetchFxSeries();
      } catch (e) {
        console.warn('fx series failed:', e.message);
      }
    })(),
  ]);
  return out;
}

/* ---------- 테마 ---------- */
export async function fetchThemes(count = 6) {
  const g = await getJson('/n-api/stocks/theme?page=1&pageSize=20');
  const groups = [...(g.groups ?? [])]
    .sort((a, b) => num(b.changeRate) - num(a.changeRate))
    .slice(0, count);
  const details = await Promise.all(
    groups.map(t => getJson(`/n-api/stocks/theme/${t.no}?page=1&pageSize=9`)),
  );
  return groups.map((t, i) => ({
    no: t.no,
    theme: t.name,
    avg: num(t.changeRate),
    stocks: (details[i].stocks ?? [])
      .map(mapStock(''))
      .sort((a, b) => b.pct - a.pct),
  }));
}

/* ---------- 시장온도 종목 리스트 ---------- */
// direction: 'up' | 'down' | 'flat'
// flat은 Naver에 전용 엔드포인트가 없어 전체 시가총액 목록을 병렬 스캔 후 등락률 0 필터링
export async function fetchBreadthStockPage(direction, page = 1, pageSize = 100) {
  const mapS = market => s => ({
    code: s.itemCode,
    name: s.stockName,
    market,
    stockType: s.stockEndType ?? 'stock',
    price: num(s.closePrice),
    pct: signedPct(s.fluctuationsRatio, s.compareToPreviousPrice?.name),
  });

  if (direction === 'flat') {
    // 첫 페이지로 총 종목 수 파악 → 전 페이지 병렬 패치 → pct=0 필터
    const SCAN_SIZE = 100;
    const [k1, q1] = await Promise.all([
      getJson(`/n-api/stocks/marketValue/KOSPI?page=1&pageSize=${SCAN_SIZE}`),
      getJson(`/n-api/stocks/marketValue/KOSDAQ?page=1&pageSize=${SCAN_SIZE}`),
    ]);
    const kospiPages = Math.min(Math.ceil((k1.totalCount ?? 0) / SCAN_SIZE), 20);
    const kosdaqPages = Math.min(Math.ceil((q1.totalCount ?? 0) / SCAN_SIZE), 20);
    const [kRest, qRest] = await Promise.all([
      Promise.all(Array.from({ length: kospiPages - 1 }, (_, i) =>
        getJson(`/n-api/stocks/marketValue/KOSPI?page=${i + 2}&pageSize=${SCAN_SIZE}`).catch(() => ({ stocks: [] }))
      )),
      Promise.all(Array.from({ length: kosdaqPages - 1 }, (_, i) =>
        getJson(`/n-api/stocks/marketValue/KOSDAQ?page=${i + 2}&pageSize=${SCAN_SIZE}`).catch(() => ({ stocks: [] }))
      )),
    ]);
    // compareToPreviousPrice.name === 'UNCHANGED' 이 실제 보합 판별 기준
    const mapSFlat = market => s => ({
      code: s.itemCode,
      name: s.stockName,
      market,
      stockType: s.stockEndType ?? 'stock',
      price: num(s.closePrice),
      pct: signedPct(s.fluctuationsRatio, s.compareToPreviousPrice?.name),
      _dir: s.compareToPreviousPrice?.name,
    });
    const all = [
      ...[k1, ...kRest].flatMap(d => (d.stocks ?? []).map(mapSFlat('코스피'))),
      ...[q1, ...qRest].flatMap(d => (d.stocks ?? []).map(mapSFlat('코스닥'))),
    ];
    const flatStocks = all.filter(s => s._dir === 'UNCHANGED').map(({ _dir, ...s }) => s);
    return { stocks: flatStocks, total: flatStocks.length, hasMore: false };
  }

  const [k, q] = await Promise.all([
    getJson(`/n-api/stocks/${direction}/KOSPI?page=${page}&pageSize=${pageSize}`),
    getJson(`/n-api/stocks/${direction}/KOSDAQ?page=${page}&pageSize=${pageSize}`),
  ]);
  const kospiTotal = k.totalCount ?? 0;
  const kosdaqTotal = q.totalCount ?? 0;
  return {
    stocks: [
      ...(k.stocks ?? []).map(mapS('코스피')),
      ...(q.stocks ?? []).map(mapS('코스닥')),
    ],
    total: kospiTotal + kosdaqTotal,
    hasMore: page * pageSize < kospiTotal || page * pageSize < kosdaqTotal,
  };
}

/* ---------- 개별 종목 ---------- */
export async function fetchStockLive(code) {
  const d = await getJson(`/n-polling/realtime/domestic/stock/${code}`);
  const it = d.datas?.[0];
  if (!it) throw new Error(`no data for ${code}`);
  return {
    code,
    name: it.stockName,
    price: num(it.closePrice),
    pct: signedPct(it.fluctuationsRatio, it.compareToPreviousPrice?.name),
  };
}

export async function fetchStockDetail(code) {
  const d = await getJson(`/n-api/stock/${code}/integration`);
  const info = c => d.totalInfos?.find(i => i.code === c)?.value;
  return {
    name: d.stockName,
    tradingValueEok: num(info('accumulatedTradingValue')) / 100, // 백만원 → 억원
    high52: info('highPriceOf52Weeks') ?? '—',
    low52: info('lowPriceOf52Weeks') ?? '—',
    marketValue: info('marketValue') ?? '—',
    tradingVolume: info('accumulatedTradingVolume') ?? '—',
  };
}

/* ---------- 실적 / 재무 ---------- */
const FINANCE_METRICS = ['매출액', '영업이익', '당기순이익', '부채비율'];

function parseFinanceData(d) {
  const fi = d.financeInfo ?? {};
  return {
    periods: fi.trTitleList ?? [],
    rows: (fi.rowList ?? []).filter(r => FINANCE_METRICS.includes(r.title)),
  };
}

export async function fetchAnnualFinance(code) {
  return parseFinanceData(await getJson(`/n-api/stock/${code}/finance/annual`));
}

export async function fetchQuarterFinance(code) {
  return parseFinanceData(await getJson(`/n-api/stock/${code}/finance/quarter`));
}

export async function fetchStockMetrics(code) {
  const d = await getJson(`/n-api/stock/${code}/integration`);
  const info = c => d.totalInfos?.find(i => i.code === c)?.value ?? '—';
  return {
    foreignRate: info('foreignRate'),
    per: info('per'),
    pbr: info('pbr'),
    eps: info('eps'),
  };
}

/* ---------- 관련 뉴스 (Google News RSS) ---------- */
export async function fetchStockNews(name, count = 7) {
  const q = encodeURIComponent(`${name} 주식`);
  const res = await fetch(`/gnews/rss/search?q=${q}&hl=ko&gl=KR&ceid=KR:ko`);
  if (!res.ok) throw new Error('news fetch failed');
  const text = await res.text();
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  return Array.from(doc.querySelectorAll('item')).slice(0, count).map(item => {
    const title = item.querySelector('title')?.textContent ?? '';
    const raw = item.querySelector('pubDate')?.textContent ?? '';
    const d = raw ? new Date(raw) : null;
    const date = d && !isNaN(d)
      ? `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`
      : '';
    return {
      title: title.replace(/ - [^-]+$/, '').trim(),
      url: item.querySelector('link')?.textContent?.trim() ?? '',
      source: item.querySelector('source')?.textContent?.trim() ?? '',
      date,
    };
  });
}

/* ---------- DART 공시 ---------- */
export async function fetchDartDisclosures(stockCode, maxItems = 8) {
  const key = import.meta.env.VITE_DART_API_KEY;
  if (!key) throw new Error('no key');
  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  const end = `${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}`;
  // stock_code 직접 지원 (3개월 이내)
  const start3m = new Date(Date.now() - 90 * 864e5);
  const start = `${start3m.getFullYear()}${pad(start3m.getMonth() + 1)}${pad(start3m.getDate())}`;
  const d = await getJson(
    `/dart/api/list.json?crtfc_key=${key}&stock_code=${stockCode}&bgn_de=${start}&end_de=${end}&page_no=1&page_count=${maxItems}`
  );
  if (d.status !== '000') throw new Error('no data');
  return (d.list ?? []).map(i => ({
    title: i.report_nm?.trim(),
    date: `${i.rcept_dt.slice(0, 4)}.${i.rcept_dt.slice(4, 6)}.${i.rcept_dt.slice(6, 8)}`,
    url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${i.rcept_no}`,
  }));
}

/* ---------- 검색 ---------- */
export async function searchStocks(q) {
  const d = await getJson(`/n-ac/ac?q=${encodeURIComponent(q)}&target=stock`);
  return (d.items ?? [])
    .filter(i => i.nationCode === 'KOR')
    .map(i => ({ code: i.code, name: i.name, market: i.typeName }));
}
