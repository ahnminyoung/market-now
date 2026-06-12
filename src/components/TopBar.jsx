import { useEffect, useRef, useState } from 'react';
import { searchStocks, fmtPct, cls } from '../lib/api.js';

const STATUS_LABEL = { OPEN: '장중', CLOSE: '장마감', PREOPEN: '장 시작 전' };

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span>
      {now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

function SearchBox({ stocks, onSelect }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);
  const boxRef = useRef(null);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setHits([]);
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const items = await searchStocks(query);
        if (alive) setHits(items.slice(0, 6));
      } catch {
        if (alive) setHits([]);
      }
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  useEffect(() => {
    const onDoc = e => {
      if (!boxRef.current?.contains(e.target)) setHits([]);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const pick = hit => {
    // 랭킹 스냅샷에 이미 있는 종목이면 가격/등락률을 초기값으로 넘긴다
    const known = stocks.find(s => s.code === hit.code);
    onSelect(known ?? hit);
    setQ('');
    setHits([]);
  };

  return (
    <div className="search" ref={boxRef}>
      <input
        type="text"
        placeholder="종목명 검색"
        autoComplete="off"
        value={q}
        onChange={e => setQ(e.target.value)}
      />
      {hits.length > 0 && (
        <div className="search-results">
          {hits.map(hit => {
            const known = stocks.find(s => s.code === hit.code);
            return (
              <div className="row" key={hit.code} onClick={() => pick(hit)}>
                <span>{hit.name}</span>
                {known ? (
                  <span className={`num ${cls(known.pct)}`}>{fmtPct(known.pct)}</span>
                ) : (
                  <span className="flat">{hit.market}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TopBar({ marketStatus, stocks, onSelect }) {
  const open = marketStatus === 'OPEN';
  return (
    <div className="topbar">
      <div className="logo">
        마켓<em>나우</em>
      </div>
      <SearchBox stocks={stocks} onSelect={onSelect} />
      <div className={`live ${open ? '' : 'off'}`}>
        <Clock /> {STATUS_LABEL[marketStatus] ?? '연결 중'}
      </div>
    </div>
  );
}
