import { useEffect, useRef, useState } from 'react';
import usePolling from '../hooks/usePolling.js';
import { fmtPct, cls, num, fetchQuarterFinance, fetchStockMetrics, fetchDartDisclosures, fetchStockNews } from '../lib/api.js';

const QTR_COLORS = ['#3a8ef5', '#f04452', '#f5b54a'];
const QTR_METRICS = ['매출액', '영업이익', '당기순이익'];
const QTR_LABELS = ['매출', '영업익', '순이익'];
const TARGET_KEYS = ['202503', '202506', '202509', '202512', '202603'];

function fmtQtrVal(v) {
  if (v === null || isNaN(v)) return '—';
  if (v >= 10000) return `${(v / 10000).toFixed(1)}조`;
  if (v >= 1000) return `${Math.round(v).toLocaleString('ko-KR')}억`;
  return `${Math.round(v)}억`;
}

function getDisplayPeriods(periods) {
  const byKey = TARGET_KEYS.map(k => periods.find(p => p.key === k)).filter(Boolean);
  return byKey.length >= 3 ? byKey : periods.slice(-5);
}

function parseQtrVal(row, key) {
  if (!row) return null;
  const v = row.columns?.[key]?.value;
  if (!v || v === '—') return null;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function periodLabel(p) {
  const t = (p.title ?? '').replace(/\.$/, '');
  const m = t.match(/(\d{4})[.\-/](\d{2})/);
  if (!m) {
    const k = p.key ?? '';
    if (k.length === 6) return `${k.slice(2, 4)}.${Math.ceil(parseInt(k.slice(4)) / 3)}Q`;
    return t;
  }
  return `${m[1].slice(2)}.${Math.ceil(parseInt(m[2]) / 3)}Q`;
}

function drawCandles(canvas, candles) {
  const ctx = canvas.getContext('2d');
  const w = (canvas.width = canvas.offsetWidth * 2);
  const h = (canvas.height = 360);
  ctx.clearRect(0, 0, w, h);
  const n = candles.length;
  if (!n) return;

  const all = candles.flatMap(c => [c.highPrice, c.lowPrice]);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const rng = max - min || 1;
  const y = v => h - 14 - ((v - min) / rng) * (h - 28);
  const bw = w / n;

  candles.forEach((c, i) => {
    const x = i * bw + bw / 2;
    const up = c.closePrice >= c.openPrice;
    ctx.strokeStyle = ctx.fillStyle = up ? '#f04452' : '#3182f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y(c.highPrice));
    ctx.lineTo(x, y(c.lowPrice));
    ctx.stroke();
    const top = y(Math.max(c.openPrice, c.closePrice));
    const bot = y(Math.min(c.openPrice, c.closePrice));
    ctx.fillRect(x - bw * 0.32, top, bw * 0.64, Math.max(bot - top, 2));
  });
}

function drawQuarterBars(canvas, periods, rows) {
  if (!canvas || !periods?.length || !rows?.length) return;
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = canvas.offsetWidth || 520;
  const H = 150;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const displayPeriods = getDisplayPeriods(periods);
  const dataRows = QTR_METRICS.map(m => rows.find(r => r.title === m));
  const data = displayPeriods.map(p => dataRows.map(r => parseQtrVal(r, p.key)));
  const allVals = data.flat().filter(v => v !== null && v > 0);
  if (!allVals.length) return;

  const maxVal = Math.max(...allVals);
  if (!maxVal) return;

  const padL = 4, padR = 4, padT = 8, padB = 26;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const groupW = cW / displayPeriods.length;
  const barW = Math.max(Math.min(groupW * 0.2, 13), 4);
  const gap = Math.max(barW * 0.15, 1.5);
  const groupInner = QTR_METRICS.length * barW + (QTR_METRICS.length - 1) * gap;
  const gOff = (groupW - groupInner) / 2;
  const baseY = padT + cH;

  // 그리드
  ctx.strokeStyle = 'rgba(35,44,66,0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, baseY);
  ctx.lineTo(padL + cW, baseY);
  ctx.stroke();

  // 중간 그리드
  ctx.strokeStyle = 'rgba(35,44,66,0.4)';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(padL, padT + cH * 0.5);
  ctx.lineTo(padL + cW, padT + cH * 0.5);
  ctx.stroke();
  ctx.setLineDash([]);

  displayPeriods.forEach((p, gi) => {
    const gx = padL + gi * groupW + gOff;

    QTR_METRICS.forEach((_, mi) => {
      const val = data[gi][mi];
      if (val === null || val <= 0) return;
      const barH = Math.max((val / maxVal) * cH * 0.92, 1);
      const bx = gx + mi * (barW + gap);
      const by = baseY - barH;
      ctx.fillStyle = p.isConsensus === 'Y'
        ? QTR_COLORS[mi] + '55'
        : QTR_COLORS[mi];
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, barW, barH, [2, 2, 0, 0]);
      else ctx.rect(bx, by, barW, barH);
      ctx.fill();
    });

    // 분기 레이블
    const label = periodLabel(p) + (p.isConsensus === 'Y' ? 'E' : '');
    ctx.fillStyle = p.isConsensus === 'Y' ? '#5a6480' : '#8d97ac';
    ctx.font = `10px ui-monospace, Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(label, padL + gi * groupW + groupW / 2, H - 7);
  });
}

function QuarterTable({ periods, rows }) {
  const displayPeriods = getDisplayPeriods(periods);
  const dataRows = QTR_METRICS.map(m => rows.find(r => r.title === m));

  return (
    <div className="qtr-table-wrap">
      <table className="qtr-table">
        <thead>
          <tr>
            <th></th>
            {displayPeriods.map(p => (
              <th key={p.key} style={{ color: p.isConsensus === 'Y' ? 'var(--dim)' : 'var(--text)' }}>
                {periodLabel(p)}{p.isConsensus === 'Y' && <span style={{ fontSize: 9, opacity: 0.6 }}>E</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {QTR_LABELS.map((label, mi) => (
            <tr key={label}>
              <td className="qtr-label" style={{ color: QTR_COLORS[mi] }}>{label}</td>
              {displayPeriods.map(p => {
                const val = parseQtrVal(dataRows[mi], p.key);
                return (
                  <td key={p.key} className="num" style={{ color: p.isConsensus === 'Y' ? 'var(--dim)' : undefined }}>
                    {fmtQtrVal(val)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionTitle({ children }) {
  return <div className="m-section-title">{children}</div>;
}

function MetricGrid({ metrics, detail }) {
  const items = [
    { k: '거래대금', v: detail?.tradingValueText },
    { k: '52주 최고', v: detail?.high52Text },
    { k: '52주 최저', v: detail?.low52Text },
    { k: '외인보유율', v: metrics?.foreignRate },
    { k: 'PER', v: metrics?.per },
    { k: 'PBR', v: metrics?.pbr },
  ].filter(it => it.v && it.v !== '—');

  if (!items.length) return null;
  return (
    <div className="m-stats" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
      {items.map(it => (
        <div className="m-stat" key={it.k}>
          <div className="k">{it.k}</div>
          <div className="v num">{it.v}</div>
        </div>
      ))}
    </div>
  );
}

function InvestorSection({ metrics }) {
  if (!metrics) return <div className="m-loading">불러오는 중...</div>;

  const rawForeign = parseFloat(String(metrics.foreignRate ?? '').replace(/[^0-9.]/g, ''));
  const foreignPct = isNaN(rawForeign) ? null : rawForeign;

  const items = [
    { label: '외인보유율', value: metrics.foreignRate, pct: foreignPct, color: '#3a8ef5' },
    { label: 'EPS', value: metrics.eps, pct: null, color: null },
    { label: 'PBR', value: metrics.pbr, pct: null, color: null },
  ];

  return (
    <div>
      {foreignPct !== null && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
            <span style={{ color: 'var(--dim)' }}>외인보유율</span>
            <span className="num" style={{ color: '#3a8ef5', fontWeight: 700 }}>{metrics.foreignRate}</span>
          </div>
          <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(foreignPct, 100)}%`,
              background: 'linear-gradient(90deg, #3a8ef5, #60aaff)',
              borderRadius: 4,
              transition: 'width 0.6s ease',
            }} />
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { k: 'EPS', v: metrics.eps },
          { k: 'PBR', v: metrics.pbr },
          { k: 'PER', v: metrics.per },
        ].map(it => (
          <div className="m-stat" key={it.k}>
            <div className="k">{it.k}</div>
            <div className="v num">{it.v ?? '—'}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: '#5a6480', marginTop: 10, lineHeight: 1.5 }}>
        * 기관·개인 순매수 데이터는 준비 중입니다
      </div>
    </div>
  );
}

function DisclosureSection({ stockCode }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    if (!stockCode) { setItems([]); return; }
    let alive = true;
    fetchDartDisclosures(stockCode)
      .then(d => alive && setItems(d))
      .catch(() => alive && setItems([]));
    return () => { alive = false; };
  }, [stockCode]);

  if (items === null) return <div className="m-loading">불러오는 중...</div>;
  if (!items.length) return <div className="m-empty">공시 정보 없음 (최근 3개월)</div>;

  return (
    <div className="disclosure-list">
      {items.map((it, i) => (
        <a key={i} href={it.url} target="_blank" rel="noreferrer" className="disclosure-item">
          <span className="disclosure-title">{it.title}</span>
          <span className="disclosure-date num">{it.date}</span>
        </a>
      ))}
    </div>
  );
}

function NewsSection({ stockName }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    if (!stockName) { setItems([]); return; }
    let alive = true;
    fetchStockNews(stockName)
      .then(d => alive && setItems(d))
      .catch(() => alive && setItems([]));
    return () => { alive = false; };
  }, [stockName]);

  if (items === null) return <div className="m-loading">불러오는 중...</div>;
  if (!items.length) return <div className="m-empty">뉴스를 불러올 수 없습니다</div>;

  return (
    <div className="disclosure-list">
      {items.map((it, i) => (
        <a key={i} href={it.url} target="_blank" rel="noreferrer" className="disclosure-item">
          <span className="disclosure-title">{it.title}</span>
          <span className="disclosure-date" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
            <span style={{ fontSize: 10.5, color: 'var(--amber)' }}>{it.source}</span>
            <span className="num" style={{ fontSize: 11 }}>{it.date}</span>
          </span>
        </a>
      ))}
    </div>
  );
}

export default function StockModal({ market, stock, onClose }) {
  const code = stock?.code;
  const candleRef = useRef(null);
  const qtrRef = useRef(null);
  const [detail, setDetail] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [quarter, setQuarter] = useState(null);

  const live = usePolling(code ? () => market.fetchStockLive(code) : null, 5000, [code]);

  useEffect(() => {
    setDetail(null); setMetrics(null); setQuarter(null);
    if (!code) return;
    let alive = true;

    market.fetchStockCandles(code)
      .then(c => alive && candleRef.current && drawCandles(candleRef.current, c.slice(-30)))
      .catch(() => {});

    market.fetchStockDetail(code)
      .then(d => alive && setDetail(d))
      .catch(() => {});

    fetchStockMetrics(code)
      .then(m => alive && setMetrics(m))
      .catch(() => alive && setMetrics({}));

    if (market.id === 'kr') {
      fetchQuarterFinance(code)
        .then(q => {
          if (!alive) return;
          setQuarter(q);
          requestAnimationFrame(() => {
            if (qtrRef.current) drawQuarterBars(qtrRef.current, q.periods, q.rows);
          });
        })
        .catch(() => alive && setQuarter({ periods: [], rows: [] }));
    }

    return () => { alive = false; };
  }, [code, market]);

  useEffect(() => {
    if (!quarter?.periods?.length || !qtrRef.current) return;
    drawQuarterBars(qtrRef.current, quarter.periods, quarter.rows);
  }, [quarter]);

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!stock) return null;

  const price = live?.price ?? stock.price;
  const pct = live?.pct ?? stock.pct;
  const isKr = market.id === 'kr';

  return (
    <div className="modal-bg open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal stock-modal">
        <div className="modal-head">
          <div>
            <h2>{stock.name}</h2>
            <span style={{ fontSize: 12, color: 'var(--dim)' }}>
              {stock.theme ? `${stock.theme} 테마` : stock.market || ''}
              {code && <span className="num" style={{ marginLeft: 6 }}>{code}</span>}
            </span>
          </div>
          <button className="close" onClick={onClose}>✕</button>
        </div>

        <div className="m-price num">{price != null ? market.fmtMoney(price) : '—'}</div>
        <div className={`m-chg num ${pct != null ? cls(pct) : 'flat'}`}>
          {pct != null ? `${pct > 0 ? '▲' : pct < 0 ? '▼' : ''} ${fmtPct(pct)} 오늘` : '시세 조회 중'}
        </div>

        <canvas ref={candleRef} />

        <MetricGrid metrics={metrics} detail={detail} />

        {isKr && (
          <>
            <div className="m-section">
              <SectionTitle>
                분기 실적
                <span className="qtr-legend">
                  {QTR_LABELS.map((l, i) => (
                    <span key={l} style={{ color: QTR_COLORS[i] }}>● {l}</span>
                  ))}
                </span>
              </SectionTitle>
              {quarter === null ? (
                <div className="m-loading">불러오는 중...</div>
              ) : quarter.periods.length === 0 ? (
                <div className="m-empty">실적 데이터 없음</div>
              ) : (
                <>
                  <canvas ref={qtrRef} className="qtr-canvas" />
                  <QuarterTable periods={quarter.periods} rows={quarter.rows} />
                </>
              )}
            </div>

            <div className="m-section">
              <SectionTitle>투자자 수급</SectionTitle>
              <InvestorSection metrics={metrics} />
            </div>

            <div className="m-section">
              <SectionTitle>최근 공시 · 수주</SectionTitle>
              <DisclosureSection stockCode={code} />
            </div>

            <div className="m-section">
              <SectionTitle>관련 기사</SectionTitle>
              <NewsSection stockName={stock.name} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
