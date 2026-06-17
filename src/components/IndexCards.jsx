import { useEffect, useState } from 'react';
import { fmtPrice, fmtPct, cls } from '../lib/api.js';
import Sparkline from './Sparkline.jsx';

export default function IndexCards({ market, indices, fx }) {
  // 스파크라인용 일봉 시계열은 시장이 바뀔 때 한 번만 받아온다
  const [series, setSeries] = useState({});

  useEffect(() => {
    let alive = true;
    setSeries({});
    market
      .fetchIndexSeries()
      .then(s => alive && setSeries(s))
      .catch(e => console.warn('index series failed:', e.message));
    return () => {
      alive = false;
    };
  }, [market]);

  const cards = [...(indices ?? []), ...(fx ? [fx] : [])];

  if (!cards.length) {
    return (
      <section className="indices">
        {[0, 1, 2, 3].map(i => (
          <div className="index-card" key={i}>
            <div className="label">&nbsp;</div>
            <div className="price num flat">—</div>
            <div className="chg num flat">불러오는 중</div>
          </div>
        ))}
      </section>
    );
  }

  return (
    <section className="indices">
      {cards.map(ix => (
        <div className="index-card" key={ix.code}>
          <div className="label">{ix.name}</div>
          <div className="price num">{fmtPrice(ix.val)}</div>
          <div className={`chg num ${cls(ix.pct)}`}>
            {ix.pct > 0 ? '▲' : ix.pct < 0 ? '▼' : ''} {fmtPct(ix.pct)}
          </div>
          <Sparkline values={series[ix.code]} pct={ix.pct} />
        </div>
      ))}
    </section>
  );
}
