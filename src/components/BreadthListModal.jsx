import { useEffect, useRef, useState } from 'react';
import { fetchBreadthStockPage } from '../lib/api.js';

const DIR_LABEL = { up: '상승', flat: '보합', down: '하락' };

export default function BreadthListModal({ direction, count, onClose, onSelect }) {
  const [stocks, setStocks] = useState([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');
  const sentinelRef = useRef(null);
  const filterInputRef = useRef(null);
  const pageRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);

  const loadNext = async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    const nextPage = pageRef.current + 1;
    try {
      const res = await fetchBreadthStockPage(direction, nextPage);
      setStocks(prev => [...prev, ...res.stocks]);
      pageRef.current = nextPage;
      hasMoreRef.current = res.hasMore;
      if (!res.hasMore) setDone(true);
    } catch (e) {
      setError('데이터를 불러올 수 없습니다');
      hasMoreRef.current = false;
      setDone(true);
    } finally {
      loadingRef.current = false;
    }
  };

  useEffect(() => { loadNext(); }, []);

  // 모달 열리면 검색창에 포커스
  useEffect(() => {
    const t = setTimeout(() => filterInputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadNext();
    }, { threshold: 0.1 });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  });

  const label = DIR_LABEL[direction] ?? direction;
  const dirCls = direction === 'up' ? 'up' : direction === 'down' ? 'down' : '';
  const q = filter.trim().toLowerCase();
  const visible = q ? stocks.filter(s => s.name.toLowerCase().includes(q)) : stocks;

  return (
    <div className="modal-bg open" onClick={onClose}>
      <div className="modal breadth-list-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 className={dirCls}>{label} 종목</h2>
            <span style={{ fontSize: 13, color: 'var(--dim)', fontWeight: 500 }}>
              {q ? `${visible.length} / ${stocks.length}` : count.toLocaleString()}개
            </span>
          </div>
          <button className="close" onClick={onClose}>✕</button>
        </div>

        <div className="blm-search-wrap">
          <input
            ref={filterInputRef}
            className="blm-search"
            type="text"
            placeholder="종목명으로 필터…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
          {filter && (
            <button className="blm-search-clear" onClick={() => setFilter('')}>✕</button>
          )}
        </div>

        <div className="blm-list">
          {visible.map(s => (
            <div
              key={s.code}
              className="blm-row"
              onClick={() => { onSelect(s); onClose(); }}
            >
              <div className="blm-info">
                <span className="blm-name">{s.name}</span>
                <span className="blm-market">{s.market}</span>
              </div>
              <div className="blm-nums">
                <span className="blm-price">{s.price.toLocaleString('ko-KR')}</span>
                <span className={`blm-pct ${s.pct > 0 ? 'up' : s.pct < 0 ? 'down' : ''}`}>
                  {s.pct > 0 ? '+' : ''}{s.pct.toFixed(2)}%
                </span>
              </div>
            </div>
          ))}

          {!done && !error && !q && (
            <div className="blm-loading">불러오는 중…</div>
          )}
          {!done && !error && q && (
            <div className="blm-loading">로드 중인 종목이 있어 결과가 늘어날 수 있습니다</div>
          )}
          {error && <div className="blm-empty">{error}</div>}
          {done && visible.length === 0 && !error && (
            <div className="blm-empty">{q ? '일치하는 종목이 없습니다' : '표시할 종목이 없습니다'}</div>
          )}
          {!q && <div ref={sentinelRef} style={{ height: 1 }} />}
        </div>
      </div>
    </div>
  );
}
