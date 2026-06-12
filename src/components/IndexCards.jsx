import { useEffect, useState } from 'react';
import { fetchIndexCandles, fetchFxSeries, fmtPrice, fmtPct, cls } from '../lib/api.js';
import Sparkline from './Sparkline.jsx';

const INDEX_CODES = ['KOSPI', 'KOSDAQ', 'KPI200'];

export default function IndexCards({ indices, usdkrw }) {
  // 스파크라인용 일봉 시계열은 마운트 시 한 번만 받아온다
  const [series, setSeries] = useState({});

  useEffect(() => {
    let alive = true;
    INDEX_CODES.forEach(async code => {
      try {
        const candles = await fetchIndexCandles(code);
        if (alive) setSeries(s => ({ ...s, [code]: candles.map(c => c.closePrice) }));
      } catch (e) {
        console.warn('index candles failed:', e.message);
      }
    });
    (async () => {
      try {
        const fx = await fetchFxSeries();
        if (alive) setSeries(s => ({ ...s, FX_USDKRW: fx }));
      } catch (e) {
        console.warn('fx series failed:', e.message);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const cards = [...(indices ?? []), ...(usdkrw ? [usdkrw] : [])];

  if (!cards.length) {
    return (
      <section className="indices">
        {['KOSPI', 'KOSDAQ', 'KOSPI200', 'USD/KRW'].map(n => (
          <div className="index-card" key={n}>
            <div className="label">{n}</div>
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
