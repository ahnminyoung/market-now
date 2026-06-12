/* 네이버 증권 비공식 API 래퍼. 모든 경로는 vite.config.js의 프록시를 거친다. */

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

/* ---------- 포맷/파싱 유틸 ---------- */
export const num = v =>
  typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, '')) || 0;

// API의 등락률은 대체로 부호가 포함되지만, 방향 타입으로 한 번 더 보정한다.
function signedPct(ratio, directionName) {
  let p = num(ratio);
  if ((directionName === 'FALLING' || directionName === 'LOWER_LIMIT') && p > 0) p = -p;
  return p;
}

export const fmtPct = p => (p > 0 ? '+' : '') + p.toFixed(2) + '%';
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

const mapStock = market => s => ({
  code: s.itemCode,
  name: s.stockName,
  market,
  price: num(s.closePrice),
  pct: signedPct(s.fluctuationsRatio, s.compareToPreviousPrice?.name),
  vol: num(s.accumulatedTradingValue) / 100, // 백만원 → 억원
});

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

// 상장 종목 총수 (보합 종목 수 계산용 — 자주 바뀌지 않으므로 긴 주기로 호출)
export async function fetchTotalCount() {
  const [k, q] = await Promise.all([
    getJson('/n-api/stocks/marketValue/KOSPI?page=1&pageSize=1'),
    getJson('/n-api/stocks/marketValue/KOSDAQ?page=1&pageSize=1'),
  ]);
  return (k.totalCount ?? 0) + (q.totalCount ?? 0);
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
  };
}

/* ---------- 검색 ---------- */
export async function searchStocks(q) {
  const d = await getJson(`/n-ac/ac?q=${encodeURIComponent(q)}&target=stock`);
  return (d.items ?? [])
    .filter(i => i.nationCode === 'KOR')
    .map(i => ({ code: i.code, name: i.name, market: i.typeName }));
}
