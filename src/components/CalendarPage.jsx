import { useEffect, useMemo, useState } from 'react';
import TopBar from './TopBar.jsx';
import { fetchMonthlyEarnings } from '../lib/earnings.js';
import EarningsCompanyModal from './EarningsCompanyModal.jsx';

const DART_CONFIGURED  = !!import.meta.env.VITE_DART_API_KEY;
const AV_CONFIGURED    = !!import.meta.env.VITE_AV_API_KEY;

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MAX_PER_CELL = 3;

const iso = d =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function monthCells(year, month) {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array(first.getDay()).fill(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7) cells.push(null);
  return cells;
}

function DayModal({ dateISO, items, onClose, onSelectCompany }) {
  return (
    <div className="modal-bg open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <div>
            <h2>{dateISO.replaceAll('-', '. ')}</h2>
            <span style={{ fontSize: 12, color: 'var(--dim)' }}>실적 발표 {items.length}건</span>
          </div>
          <button className="close" onClick={onClose}>✕</button>
        </div>
        <div className="day-list">
          {items.map((it, i) => (
            <div className="day-row day-row-click" key={i} onClick={() => onSelectCompany(it)}>
              <span className="day-name">{it.name}</span>
              <span className="day-badges">
                <span className="badge">{it.market}</span>
                <span className={`badge ${it.time === '장전' ? 'badge-pre' : 'badge-post'}`}>
                  {it.time}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const today = new Date();
  const [cursor, setCursor]     = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [marketId, setMarketId] = useState('kr');
  const [openDay, setOpenDay]   = useState(null);
  const [openCompany, setOpenCompany] = useState(null);
  const [monthData, setMonthData] = useState(new Map());
  const [loading, setLoading]   = useState(false);

  const year  = cursor.getFullYear();
  const month = cursor.getMonth();

  const cells = useMemo(() => monthCells(year, month), [year, month]);

  useEffect(() => {
    setLoading(true);
    setMonthData(new Map());
    fetchMonthlyEarnings(year, month, marketId)
      .then(map => { setMonthData(map); setLoading(false); })
      .catch(() => setLoading(false));
  }, [year, month, marketId]);

  const move = delta => setCursor(c => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  const needsKey = marketId === 'kr' ? !DART_CONFIGURED : !AV_CONFIGURED;
  const keyUrl   = marketId === 'kr'
    ? 'https://opendart.fss.or.kr/uat/uia/eLogin.do'
    : 'https://www.alphavantage.co/support/#api-key';
  const keyVar   = marketId === 'kr' ? 'VITE_DART_API_KEY' : 'VITE_AV_API_KEY';

  return (
    <>
      <TopBar />
      <main>
        <div className="panel cal-panel">
          <div className="panel-head cal-head">
            <div className="cal-nav">
              <button className="cal-arrow" onClick={() => move(-1)}>‹</button>
              <span className="panel-title">
                {year}년 {month + 1}월 실적 캘린더
              </span>
              <button className="cal-arrow" onClick={() => move(1)}>›</button>
            </div>
            <div className="tabs">
              <button className={marketId === 'kr' ? 'active' : ''} onClick={() => setMarketId('kr')}>국장</button>
              <button className={marketId === 'us' ? 'active' : ''} onClick={() => setMarketId('us')}>미장</button>
            </div>
          </div>

          {needsKey && (
            <div style={{
              margin: '0 0 12px',
              padding: '10px 14px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 13,
              color: 'var(--dim)',
              lineHeight: 1.6,
            }}>
              실제 데이터를 보려면 <strong style={{ color: 'var(--text)' }}>.env</strong>에{' '}
              <code style={{ color: 'var(--amber)' }}>{keyVar}</code>를 설정하세요.{' '}
              <a href={keyUrl} target="_blank" rel="noreferrer"
                style={{ color: 'var(--amber)', textDecoration: 'underline' }}>
                무료 API 키 발급 →
              </a>
            </div>
          )}

          <div className="cal-grid cal-weekdays">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={i === 0 ? 'sun' : i === 6 ? 'sat' : ''}>{w}</div>
            ))}
          </div>

          <div className="cal-grid" style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
            {cells.map((d, i) => {
              if (!d) return <div className="cal-cell empty" key={`e${i}`} />;
              const dISO = iso(d);
              const items = monthData.get(dISO) ?? [];
              const isToday = dISO === iso(today);
              return (
                <div className={`cal-cell ${isToday ? 'today' : ''}`} key={dISO}>
                  <span className="cal-date num">{d.getDate()}</span>
                  {items.slice(0, MAX_PER_CELL).map((it, j) => (
                    <div
                      className="cal-item cal-item-click"
                      key={j}
                      title={`${it.market} · ${it.time}`}
                      onClick={() => setOpenCompany(it)}
                    >
                      {it.name}
                    </div>
                  ))}
                  {items.length > MAX_PER_CELL && (
                    <button className="cal-more" onClick={() => setOpenDay(dISO)}>
                      +{items.length - MAX_PER_CELL} more
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
      {openDay && (
        <DayModal
          dateISO={openDay}
          items={monthData.get(openDay) ?? []}
          onClose={() => setOpenDay(null)}
          onSelectCompany={company => { setOpenDay(null); setOpenCompany(company); }}
        />
      )}
      {openCompany && (
        <EarningsCompanyModal
          company={openCompany}
          onClose={() => setOpenCompany(null)}
        />
      )}
    </>
  );
}
