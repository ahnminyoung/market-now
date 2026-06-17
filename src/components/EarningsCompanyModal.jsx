import { useEffect, useState } from 'react';
import { fetchAnnualFinance, fetchQuarterFinance, fetchStockMetrics } from '../lib/api.js';

const DART_KEY = import.meta.env.VITE_DART_API_KEY;

function Loading() {
  return <div className="fin-loading">불러오는 중...</div>;
}

function FinTable({ data, label }) {
  if (!data) return <Loading />;
  const { periods, rows } = data;
  if (!rows.length) return <div className="fin-empty">데이터 없음</div>;

  return (
    <div className="fin-section">
      <div className="fin-section-title">{label} <span style={{ fontWeight: 400, fontSize: 11 }}>(단위: 억원 / 부채비율 %)</span></div>
      <div className="fin-table-wrap">
        <table className="fin-table">
          <thead>
            <tr>
              <th className="fin-th-label">항목</th>
              {periods.map(p => (
                <th key={p.key} className={p.isConsensus === 'Y' ? 'fin-consensus' : ''}>
                  {p.title.replace(/\.$/, '')}
                  {p.isConsensus === 'Y' && <span style={{ marginLeft: 3, fontSize: 9, opacity: 0.7 }}>E</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.title}>
                <td className="fin-td-label">{row.title}</td>
                {periods.map(p => {
                  const val = row.columns?.[p.key]?.value ?? '—';
                  return (
                    <td key={p.key} className={`num ${p.isConsensus === 'Y' ? 'fin-consensus' : ''}`}>
                      {val}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Metrics({ data }) {
  if (!data) return null;
  const items = [
    { k: '외인보유율', v: data.foreignRate },
    { k: 'PER', v: data.per },
    { k: 'PBR', v: data.pbr },
    { k: 'EPS', v: data.eps },
  ];
  return (
    <div className="fin-section">
      <div className="fin-section-title">투자 지표</div>
      <div className="m-stats" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        {items.map(it => (
          <div className="m-stat" key={it.k}>
            <div className="k">{it.k}</div>
            <div className="v num">{it.v}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 8 }}>
        * 투자자별 매매동향(개인/외인/기관)은 외인보유율로 대체합니다.
      </div>
    </div>
  );
}

function Disclosures({ corpCode }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    if (!corpCode || !DART_KEY) { setItems([]); return; }
    const today = new Date();
    const pad = n => String(n).padStart(2, '0');
    const end = `${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}`;
    const start = `${today.getFullYear() - 1}0101`;
    fetch(
      `/dart/api/list.json?crtfc_key=${DART_KEY}&corp_code=${corpCode}&bgn_de=${start}&end_de=${end}&page_no=1&page_count=8`
    )
      .then(r => r.json())
      .then(d => {
        if (d.status !== '000') { setItems([]); return; }
        setItems(
          (d.list ?? []).map(i => ({
            title: i.report_nm?.trim(),
            date: `${i.rcept_dt.slice(0, 4)}.${i.rcept_dt.slice(4, 6)}.${i.rcept_dt.slice(6, 8)}`,
            url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${i.rcept_no}`,
          }))
        );
      })
      .catch(() => setItems([]));
  }, [corpCode]);

  return (
    <div className="fin-section">
      <div className="fin-section-title">최근 공시 · 수주</div>
      {items === null ? (
        <Loading />
      ) : items.length === 0 ? (
        <div className="fin-empty">공시 정보가 없습니다</div>
      ) : (
        <div className="disclosure-list">
          {items.map((it, i) => (
            <a key={i} href={it.url} target="_blank" rel="noreferrer" className="disclosure-item">
              <span className="disclosure-title">{it.title}</span>
              <span className="disclosure-date num">{it.date}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EarningsCompanyModal({ company, onClose }) {
  const [annual, setAnnual] = useState(null);
  const [quarter, setQuarter] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(false);

  const { name, market, stockCode, corpCode } = company ?? {};

  useEffect(() => {
    if (!stockCode) { setError(true); return; }
    let alive = true;
    setAnnual(null); setQuarter(null); setMetrics(null); setError(false);

    Promise.all([
      fetchAnnualFinance(stockCode),
      fetchQuarterFinance(stockCode),
      fetchStockMetrics(stockCode),
    ])
      .then(([ann, qtr, met]) => {
        if (!alive) return;
        setAnnual(ann);
        setQuarter(qtr);
        setMetrics(met);
      })
      .catch(() => alive && setError(true));

    return () => { alive = false; };
  }, [stockCode]);

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!company) return null;

  return (
    <div className="modal-bg open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal company-modal">
        <div className="modal-head">
          <div>
            <h2>{name}</h2>
            <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
              <span className="badge">{market}</span>
              {stockCode && <span className="badge num">{stockCode}</span>}
            </div>
          </div>
          <button className="close" onClick={onClose}>✕</button>
        </div>

        {error ? (
          <div className="fin-empty" style={{ padding: '24px 0' }}>
            종목 코드가 없어 실적 데이터를 불러올 수 없습니다.
          </div>
        ) : (
          <>
            <Metrics data={metrics} />
            <FinTable data={annual} label="연간 실적" />
            <FinTable data={quarter} label="분기 실적" />
            <Disclosures corpCode={corpCode} />
          </>
        )}
      </div>
    </div>
  );
}
