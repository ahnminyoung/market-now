/* 실적 발표 캘린더 데이터 레이어.
 * 국장: DART OpenAPI — 분기/반기/사업보고서 + 잠정실적(주요사항보고서)
 * 미장: Alpha Vantage EARNINGS_CALENDAR (horizon=12month, 전체 단일 캐시)
 * API 키가 없으면 빈 Map을 반환한다. */

const DART_KEY = import.meta.env.VITE_DART_API_KEY;
const AV_KEY   = import.meta.env.VITE_AV_API_KEY ?? 'demo';

const _krCache = new Map(); // 'kr-2026-5' → Map<dateISO, items[]>
let _avAll     = null;      // 전체 Alpha Vantage 데이터 Map<dateISO, items[]>
let _avFetchedDate = null;  // 오늘 날짜 기준 하루 유효

function dartMarket(cls) {
  return cls === 'Y' ? '코스피' : cls === 'K' ? '코스닥' : '기타';
}

function isEarningsReport(name) {
  return (
    name.includes('분기보고서') ||
    name.includes('반기보고서') ||
    name.includes('사업보고서') ||
    name.includes('잠정실적')
  );
}

async function fetchDartPage(url) {
  const res = await fetch(url);
  return res.json();
}

async function fetchKr(year, month) {
  const cacheKey = `kr-${year}-${month}`;
  if (_krCache.has(cacheKey)) return _krCache.get(cacheKey);

  const map = new Map();
  _krCache.set(cacheKey, map);
  if (!DART_KEY) return map;

  const pad = n => String(n).padStart(2, '0');
  const bgn = `${year}${pad(month + 1)}01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end = `${year}${pad(month + 1)}${pad(lastDay)}`;

  // 정기공시(분기/반기/사업보고서) + 주요사항(잠정실적) 동시 조회
  for (const pblntfTy of ['A', 'B']) {
    let page = 1;
    for (;;) {
      const url =
        `/dart/api/list.json?crtfc_key=${DART_KEY}` +
        `&bgn_de=${bgn}&end_de=${end}&pblntfTy=${pblntfTy}` +
        `&page_no=${page}&page_count=100`;
      const d = await fetchDartPage(url);
      if (d.status !== '000' || !d.list?.length) break;

      for (const item of d.list) {
        if (item.corp_cls !== 'Y' && item.corp_cls !== 'K') continue;
        const nm = item.report_nm ?? '';
        if (!isEarningsReport(nm)) continue;

        const dt = item.rcept_dt; // YYYYMMDD
        const iso = `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`;
        if (!map.has(iso)) map.set(iso, []);

        const isPrelimnary = nm.includes('잠정실적');
        map.get(iso).push({
          name: item.corp_name,
          market: dartMarket(item.corp_cls),
          time: '장후',
          label: isPrelimnary ? '잠정' : undefined,
          stockCode: item.stock_code || null,
          corpCode: item.corp_code || null,
        });
      }

      if (page >= (d.total_page ?? 1)) break;
      page++;
    }
  }

  return map;
}

async function fetchUs(year, month) {
  const todayStr = new Date().toISOString().slice(0, 10);

  if (_avFetchedDate !== todayStr) {
    _avAll = null;
    _avFetchedDate = todayStr;
  }

  if (!_avAll) {
    _avAll = new Map();
    try {
      const res = await fetch(
        `/alphavantage/query?function=EARNINGS_CALENDAR&horizon=12month&apikey=${AV_KEY}`
      );
      const csv = await res.text();
      if (!csv.startsWith('symbol')) throw new Error('unexpected response');

      for (const line of csv.trim().split('\n').slice(1)) {
        const [symbol, name, reportDate, , , currency, timeOfDay] = line.split(',');
        if (!reportDate || currency !== 'USD') continue;

        if (!_avAll.has(reportDate)) _avAll.set(reportDate, []);
        _avAll.get(reportDate).push({
          name: name || symbol,
          market: 'NYSE/NASDAQ',
          time: (timeOfDay ?? '').includes('pre') ? '장전' : '장후',
        });
      }
    } catch (e) {
      console.warn('Alpha Vantage earnings fetch failed:', e.message);
    }
  }

  const map = new Map();
  for (const [date, items] of _avAll) {
    const [y, m] = date.split('-').map(Number);
    if (y === year && m - 1 === month) map.set(date, items);
  }
  return map;
}

// year: 연도, month: 0-based 월
export async function fetchMonthlyEarnings(year, month, marketId) {
  return marketId === 'kr' ? fetchKr(year, month) : fetchUs(year, month);
}
