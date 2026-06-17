/* 시장별 데이터 레이어 통합 인터페이스.
 * 컴포넌트는 MARKETS[id]의 동일한 메서드만 사용하므로
 * 추후 다른 시장/실 API 교체 시 이 파일만 손대면 된다. */
import {
  fetchIndices,
  fetchUsdKrw,
  fetchIndexSeriesKr,
  fetchMarketSnapshot,
  fetchBreadthKr,
  fetchThemes,
  fetchStockLive,
  fetchStockDetail,
  fetchStockCandles,
  searchStocks,
  fmtPrice,
  fmtEok,
} from './api.js';
import {
  fetchIndicesUs,
  fetchIndexSeriesUs,
  fetchSnapshotUs,
  fetchBreadthUs,
  fetchThemesUs,
  fetchStockLiveUs,
  fetchStockDetailUs,
  fetchStockCandlesUs,
  searchStocksUs,
  fmtUsd,
} from './usMarket.js';

export const MARKETS = {
  kr: {
    id: 'kr',
    label: '국장',
    fetchIndices,
    fetchFx: fetchUsdKrw,
    fetchIndexSeries: fetchIndexSeriesKr,
    fetchSnapshot: fetchMarketSnapshot,
    fetchBreadth: fetchBreadthKr,
    breadthIntervalMs: 60_000,
    fetchThemes: () => fetchThemes(6),
    fetchStockLive,
    fetchStockCandles,
    fetchStockDetail: async code => {
      const d = await fetchStockDetail(code);
      return {
        tradingValueText: fmtEok(d.tradingValueEok) + '원',
        high52Text: d.high52 + '원',
        low52Text: d.low52 + '원',
      };
    },
    search: searchStocks,
    fmtPrice,
    fmtMoney: v => fmtPrice(v) + '원',
  },
  us: {
    id: 'us',
    label: '미장',
    fetchIndices: fetchIndicesUs,
    fetchFx: fetchUsdKrw, // 환율 카드는 양쪽 공통
    fetchIndexSeries: fetchIndexSeriesUs,
    fetchSnapshot: fetchSnapshotUs,
    fetchBreadth: fetchBreadthUs,
    breadthIntervalMs: 180_000, // 이진 탐색이라 요청이 많아 길게
    fetchThemes: fetchThemesUs,
    fetchStockLive: fetchStockLiveUs,
    fetchStockCandles: fetchStockCandlesUs,
    fetchStockDetail: fetchStockDetailUs,
    search: searchStocksUs,
    fmtPrice: v => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    fmtMoney: fmtUsd,
  },
};
