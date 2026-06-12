import { useCallback, useState } from 'react';
import usePolling from './hooks/usePolling.js';
import {
  fetchMarketSnapshot,
  fetchIndices,
  fetchUsdKrw,
  fetchThemes,
  fetchTotalCount,
} from './lib/api.js';
import TopBar from './components/TopBar.jsx';
import Tape from './components/Tape.jsx';
import IndexCards from './components/IndexCards.jsx';
import RankTable from './components/RankTable.jsx';
import Breadth from './components/Breadth.jsx';
import Heatmap from './components/Heatmap.jsx';
import StockModal from './components/StockModal.jsx';

export default function App() {
  const snapshot = usePolling(fetchMarketSnapshot, 7000); // 랭킹 + 상승/하락 수
  const indices = usePolling(fetchIndices, 7000);
  const usdkrw = usePolling(fetchUsdKrw, 60000);
  const themes = usePolling(() => fetchThemes(6), 30000);
  const totalCount = usePolling(fetchTotalCount, 300000);

  const [selected, setSelected] = useState(null);
  const openStock = useCallback(s => setSelected(s), []);
  const closeStock = useCallback(() => setSelected(null), []);

  const stocks = snapshot?.stocks ?? [];
  const marketStatus = snapshot?.marketStatus ?? indices?.[0]?.marketStatus;

  return (
    <>
      <TopBar marketStatus={marketStatus} stocks={stocks} onSelect={openStock} />
      <Tape stocks={stocks} />
      <main>
        <IndexCards indices={indices} usdkrw={usdkrw} />
        <div className="columns">
          <RankTable stocks={stocks} onSelect={openStock} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Breadth up={snapshot?.up ?? 0} down={snapshot?.down ?? 0} total={totalCount ?? 0} />
            <Heatmap themes={themes} onSelect={openStock} />
          </div>
        </div>
      </main>
      <StockModal stock={selected} onClose={closeStock} />
      <footer>
        마켓나우 · 네이버 증권 비공개 API 기반 데모입니다. 시세는 지연될 수 있으며 투자 판단의
        근거가 될 수 없습니다.
      </footer>
    </>
  );
}
