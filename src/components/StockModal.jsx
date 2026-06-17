import { useEffect, useRef, useState } from 'react';
import usePolling from '../hooks/usePolling.js';
import { fmtPct, cls } from '../lib/api.js';

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

export default function StockModal({ market, stock, onClose }) {
  const code = stock?.code;
  const canvasRef = useRef(null);
  const [detail, setDetail] = useState(null);

  // 현재가는 실시간 폴링, 상세/캔들은 종목이 바뀔 때 한 번
  const live = usePolling(code ? () => market.fetchStockLive(code) : null, 5000, [code]);

  useEffect(() => {
    setDetail(null);
    if (!code) return;
    let alive = true;
    market
      .fetchStockDetail(code)
      .then(d => alive && setDetail(d))
      .catch(e => console.warn('detail failed:', e.message));
    market
      .fetchStockCandles(code)
      .then(c => alive && canvasRef.current && drawCandles(canvasRef.current, c.slice(-30)))
      .catch(e => console.warn('candles failed:', e.message));
    return () => {
      alive = false;
    };
  }, [code, market]);

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!stock) return null;

  const price = live?.price ?? stock.price;
  const pct = live?.pct ?? stock.pct;

  return (
    <div className="modal-bg open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <div>
            <h2>{stock.name}</h2>
            <span style={{ fontSize: 12, color: 'var(--dim)' }}>
              {stock.theme ? `${stock.theme} 테마` : stock.market || ''}
            </span>
          </div>
          <button className="close" onClick={onClose}>✕</button>
        </div>
        <div className="m-price num">{price != null ? market.fmtMoney(price) : '—'}</div>
        <div className={`m-chg num ${pct != null ? cls(pct) : 'flat'}`}>
          {pct != null ? `${pct > 0 ? '▲' : pct < 0 ? '▼' : ''} ${fmtPct(pct)} 오늘` : '시세 조회 중'}
        </div>
        <canvas ref={canvasRef} />
        <div className="m-stats">
          <div className="m-stat">
            <div className="k">거래대금</div>
            <div className="v num">{detail?.tradingValueText ?? '—'}</div>
          </div>
          <div className="m-stat">
            <div className="k">52주 최고</div>
            <div className="v num">{detail?.high52Text ?? '—'}</div>
          </div>
          <div className="m-stat">
            <div className="k">52주 최저</div>
            <div className="v num">{detail?.low52Text ?? '—'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
