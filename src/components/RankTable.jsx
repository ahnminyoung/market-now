import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtPrice, fmtPct, fmtEok, cls } from '../lib/api.js';

const TABS = [
  { id: 'gain', label: '급상승' },
  { id: 'lose', label: '급하락' },
  { id: 'vol', label: '거래대금' },
];

export default function RankTable({ stocks, onSelect }) {
  const [tab, setTab] = useState('gain');
  const prevPrices = useRef(new Map());

  const list = useMemo(() => {
    const s = [...stocks];
    if (tab === 'gain') s.sort((a, b) => b.pct - a.pct);
    else if (tab === 'lose') s.sort((a, b) => a.pct - b.pct);
    else s.sort((a, b) => b.vol - a.vol);
    return s.slice(0, 10);
  }, [stocks, tab]);

  // 직전 가격과 비교해 틱 방향을 구하고, 렌더 후 현재 가격을 저장
  const flashOf = s => {
    const prev = prevPrices.current.get(s.code);
    if (prev === undefined || prev === s.price) return '';
    return s.price > prev ? 'flash-up' : 'flash-down';
  };
  useEffect(() => {
    const m = prevPrices.current;
    stocks.forEach(s => m.set(s.code, s.price));
  }, [stocks]);

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">실시간 랭킹</span>
        <div className="tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={tab === t.id ? 'active' : ''}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>종목</th>
            <th>현재가</th>
            <th>등락률</th>
            <th>거래대금</th>
          </tr>
        </thead>
        <tbody>
          {list.length === 0 && (
            <tr>
              <td colSpan={4} style={{ textAlign: 'center', color: 'var(--dim)' }}>
                시세를 불러오는 중…
              </td>
            </tr>
          )}
          {list.map((s, i) => (
            <tr key={s.code} onClick={() => onSelect(s)}>
              <td>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span className="rank-no num">{i + 1}</span>
                  <div>
                    <div className="stock-name">{s.name}</div>
                    <div className="stock-theme">{s.market}</div>
                  </div>
                </div>
              </td>
              {/* key에 가격을 넣어 가격이 바뀔 때마다 플래시 애니메이션이 다시 돈다 */}
              <td key={`p${s.price}`} className={`num ${flashOf(s)}`}>
                {fmtPrice(s.price)}
              </td>
              <td className={`num ${cls(s.pct)}`} style={{ fontWeight: 700 }}>
                {fmtPct(s.pct)}
              </td>
              <td className="num" style={{ color: 'var(--dim)' }}>
                {fmtEok(s.vol)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
