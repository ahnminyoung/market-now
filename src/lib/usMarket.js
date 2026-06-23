/* 미국 시장 데이터 레이어 (네이버 해외주식 API, 시세는 거래소 기준 지연 시세) */
import { getJson, num, signedPct, fetchFxSeries, fmtShares } from './api.js';

const EXCHANGES = ['NYSE', 'NASDAQ'];
const INDEX_NAMES = { '.INX': 'S&P 500', '.IXIC': '나스닥', '.DJI': '다우존스' };

export const fmtUsd = v =>
  '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, '');
function candleRange(days) {
  const end = new Date();
  const start = new Date(Date.now() - days * 864e5);
  return `startDateTime=${ymd(start)}000000&endDateTime=${ymd(end)}235959`;
}

/* ---------- 지수 ---------- */
export async function fetchIndicesUs() {
  const d = await getJson('/n-polling/realtime/worldstock/index/.INX,.IXIC,.DJI');
  return (d.datas ?? []).map(it => ({
    code: it.reutersCode,
    name: INDEX_NAMES[it.reutersCode] ?? it.indexName,
    val: num(it.closePrice),
    pct: signedPct(it.fluctuationsRatio, it.compareToPreviousPrice?.name),
    marketStatus: it.marketStatus,
  }));
}

export async function fetchIndexSeriesUs() {
  const out = {};
  await Promise.all([
    ...Object.keys(INDEX_NAMES).map(async code => {
      try {
        const c = await getJson(`/n-chart/foreign/index/${code}/day?${candleRange(70)}`);
        out[code] = c.map(x => x.closePrice);
      } catch (e) {
        console.warn('us index candles failed:', e.message);
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

/* ---------- 랭킹 스냅샷 ---------- */
const mapUsStock = exchange => s => ({
  code: s.reutersCode,
  name: s.stockName,
  market: exchange,
  price: num(s.closePrice),
  pct: signedPct(s.fluctuationsRatio, s.compareToPreviousPrice?.name),
  vol: num(s.accumulatedTradingValue), // '0.59억 USD' → 0.59 (억 USD, 정렬용)
  volText: (s.accumulatedTradingValueKrwHangeul ?? '').replace(/원$/, '') || '—',
});

export async function fetchSnapshotUs() {
  const lists = await Promise.all(
    EXCHANGES.flatMap(ex => [
      getJson(`/n-stockapi/stock/exchange/${ex}/up?page=1&pageSize=100`),
      getJson(`/n-stockapi/stock/exchange/${ex}/down?page=1&pageSize=100`),
    ]),
  );
  const stocks = lists.flatMap((l, i) => (l.stocks ?? []).map(mapUsStock(EXCHANGES[i >> 1])));
  return { stocks, marketStatus: lists[0].marketStatus };
}

/* ---------- 시장 온도 ----------
 * 미국 랭킹 API의 totalCount는 거래소 전체 종목 수라서 (상승/하락 동일)
 * 등락률 정렬 리스트에서 부호가 바뀌는 경계 페이지를 이진 탐색해
 * 상승/하락 종목 수를 구한다. 페이지 단위(100개)로 탐색해 체인당 ~6회 요청. */
async function countSigned(exchange, dir) {
  const SIZE = 100;
  const page = p =>
    getJson(`/n-stockapi/stock/exchange/${exchange}/${dir}?page=${p}&pageSize=${SIZE}`);
  const matches = s => (dir === 'up' ? num(s.fluctuationsRatio) > 0 : num(s.fluctuationsRatio) < 0);
  const countIn = pg => (pg.stocks ?? []).filter(matches).length;

  const first = await page(1);
  const total = first.totalCount ?? 0;
  if (!total) return { count: 0, total };

  // 경계(부호가 바뀌는 지점)가 첫 페이지 안에 있으면 바로 끝
  let k = countIn(first);
  let n = (first.stocks ?? []).length;
  if (k < n) return { count: k, total };

  // lo: 전체가 부호 일치함이 확인된 마지막 페이지, loLen: 그 페이지의 종목 수
  let lo = 1;
  let loLen = n;
  let hi = Math.ceil(total / SIZE);
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    const pg = await page(mid);
    k = countIn(pg);
    n = (pg.stocks ?? []).length;
    if (n > 0 && k === n) {
      lo = mid;
      loLen = n;
    } else if (k === 0) {
      hi = mid - 1;
    } else {
      // 경계 페이지 적중 (정렬 리스트라 일치 항목이 모두 앞쪽에 몰려 있음)
      return { count: (mid - 1) * SIZE + k, total };
    }
  }
  return { count: (lo - 1) * SIZE + loLen, total };
}

export async function fetchBreadthUs() {
  const [un, uq, dn, dq] = await Promise.all([
    countSigned('NYSE', 'up'),
    countSigned('NASDAQ', 'up'),
    countSigned('NYSE', 'down'),
    countSigned('NASDAQ', 'down'),
  ]);
  return {
    up: un.count + uq.count,
    down: dn.count + dq.count,
    total: un.total + uq.total,
  };
}

/* ---------- 테마 (대표 섹터별 구성 종목, 시세는 전부 실시간 폴링) ---------- */
const US_THEMES = [
  { name: '빅테크', codes: ['AAPL.O', 'MSFT.O', 'GOOGL.O', 'AMZN.O', 'META.O', 'NVDA.O', 'TSLA.O', 'NFLX.O', 'AVGO.O'] },
  { name: '반도체', codes: ['NVDA.O', 'AVGO.O', 'AMD.O', 'TSM', 'INTC.O', 'QCOM.O', 'MU.O', 'TXN.O', 'ASML.O'] },
  { name: 'AI·소프트웨어', codes: ['ORCL.K', 'CRM', 'NOW', 'PLTR.O', 'SNOW.K', 'CRWD.O', 'PANW.O', 'MSTR.O', 'ADBE.O'] },
  { name: '금융', codes: ['JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'V', 'MA', 'AXP'] },
  { name: '헬스케어', codes: ['LLY', 'UNH', 'JNJ', 'ABBV.K', 'MRK', 'PFE', 'AMGN.O', 'GILD.O', 'MRNA.O'] },
  { name: '에너지', codes: ['XOM', 'CVX', 'COP', 'SLB', 'EOG', 'OXY', 'MPC', 'PSX', 'KMI'] },
];

export async function fetchThemesUs() {
  const results = await Promise.all(
    US_THEMES.map(t =>
      getJson(`/n-polling/realtime/worldstock/stock/${t.codes.join(',')}`),
    ),
  );
  return US_THEMES.map((t, i) => {
    const stocks = (results[i].datas ?? [])
      .map(d => ({
        code: d.reutersCode,
        name: d.stockName,
        price: num(d.closePrice),
        pct: signedPct(d.fluctuationsRatio, d.compareToPreviousPrice?.name),
        market: '',
      }))
      .sort((a, b) => b.pct - a.pct);
    const avg = stocks.length ? stocks.reduce((a, s) => a + s.pct, 0) / stocks.length : 0;
    return { no: i, theme: t.name, avg, stocks };
  }).sort((a, b) => b.avg - a.avg);
}

/* ---------- 개별 종목 ---------- */
export async function fetchStockLiveUs(code) {
  const d = await getJson(`/n-polling/realtime/worldstock/stock/${code}`);
  const it = d.datas?.[0];
  if (!it) throw new Error(`no data for ${code}`);
  return {
    code,
    name: it.stockName,
    price: num(it.closePrice),
    pct: signedPct(it.fluctuationsRatio, it.compareToPreviousPrice?.name),
    tradingValueText: it.accumulatedTradingValue ?? '—',
  };
}

export async function fetchStockCandlesUs(code, days = 70) {
  return getJson(`/n-chart/foreign/item/${code}/day?${candleRange(days)}`);
}

// 해외 종목은 52주 고저 필드를 주는 API가 없어 1년치 일봉에서 직접 계산한다.
export async function fetchStockDetailUs(code) {
  const [candles, liveData] = await Promise.all([
    fetchStockCandlesUs(code, 372),
    getJson(`/n-polling/realtime/worldstock/stock/${code}`).catch(() => null),
  ]);
  const it = liveData?.datas?.[0];
  const highs = candles.map(c => c.highPrice);
  const lows = candles.map(c => c.lowPrice);
  return {
    tradingValueText: it?.accumulatedTradingValue ?? '—',
    high52Text: highs.length ? fmtUsd(Math.max(...highs)) : '—',
    low52Text: lows.length ? fmtUsd(Math.min(...lows)) : '—',
    marketCapText: it?.marketValueHangeul ?? '—',
    tradingVolumeText: fmtShares(it?.accumulatedTradingVolume),
  };
}

/* ---------- 검색 ---------- */
export async function searchStocksUs(q) {
  const d = await getJson(`/n-ac/ac?q=${encodeURIComponent(q)}&target=stock`);
  return (d.items ?? [])
    .filter(i => i.nationCode === 'USA')
    .map(i => {
      const m = i.url?.match(/\/worldstock\/stock\/([^/]+)/);
      return m && { code: m[1], name: i.name, market: i.typeName };
    })
    .filter(Boolean);
}
