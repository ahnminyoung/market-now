import { useCallback, useEffect, useState } from 'react';
import usePolling from '../hooks/usePolling.js';
import { MARKETS } from '../lib/markets.js';
import TopBar from './TopBar.jsx';
import Tape from './Tape.jsx';
import IndexCards from './IndexCards.jsx';
import RankTable from './RankTable.jsx';
import Breadth from './Breadth.jsx';
import BreadthListModal from './BreadthListModal.jsx';
import Heatmap from './Heatmap.jsx';
import StockModal from './StockModal.jsx';

// 국장/미장 공용 대시보드 — marketId만 바뀌면 데이터 레이어가 통째로 교체된다
export default function MarketDashboard({ marketId }) {
  const m = MARKETS[marketId];

  const snapshot = usePolling(() => m.fetchSnapshot(), 8000, [marketId]);
  const indices = usePolling(() => m.fetchIndices(), 8000, [marketId]);
  const fx = usePolling(() => m.fetchFx(), 60000, [marketId]);
  const themes = usePolling(() => m.fetchThemes(), 30000, [marketId]);
  const breadth = usePolling(() => m.fetchBreadth(), m.breadthIntervalMs, [marketId]);

  const [selected, setSelected] = useState(null);
  const openStock = useCallback(s => setSelected(s), []);
  const closeStock = useCallback(() => setSelected(null), []);
  useEffect(() => setSelected(null), [marketId]);

  const [breadthFilter, setBreadthFilter] = useState(null);
  const closeBreadthFilter = useCallback(() => setBreadthFilter(null), []);
  useEffect(() => setBreadthFilter(null), [marketId]);

  const stocks = snapshot?.stocks ?? [];
  const marketStatus = snapshot?.marketStatus ?? indices?.[0]?.marketStatus ?? null;

  return (
    <>
      <TopBar market={m} marketStatus={marketStatus} stocks={stocks} onSelect={openStock} />
      <Tape stocks={stocks} />
      <main>
        <IndexCards market={m} indices={indices} fx={fx} />
        <div className="columns">
          {/* key로 시장 전환 시 탭/플래시 등 내부 상태를 초기화 */}
          <RankTable key={marketId} market={m} stocks={stocks} onSelect={openStock} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Breadth
              up={breadth?.up ?? 0}
              down={breadth?.down ?? 0}
              total={breadth?.total ?? 0}
              onFilter={m.id === 'kr' ? setBreadthFilter : undefined}
            />
            <Heatmap themes={themes} onSelect={openStock} />
          </div>
        </div>
      </main>
      <StockModal market={m} stock={selected} onClose={closeStock} />
      {breadthFilter && (
        <BreadthListModal
          direction={breadthFilter}
          count={
            breadthFilter === 'up' ? (breadth?.up ?? 0) :
            breadthFilter === 'down' ? (breadth?.down ?? 0) :
            Math.max((breadth?.total ?? 0) - (breadth?.up ?? 0) - (breadth?.down ?? 0), 0)
          }
          onClose={closeBreadthFilter}
          onSelect={openStock}
        />
      )}
    </>
  );
}
