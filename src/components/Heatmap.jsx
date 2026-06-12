import { fmtPct, cls, getHeatColor, heatText } from '../lib/api.js';

export default function Heatmap({ themes, onSelect }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">테마 히트맵</span>
        <span style={{ fontSize: '11.5px', color: 'var(--dim)' }}>등락률순</span>
      </div>
      <div className="hm-grid">
        {(themes ?? []).map(t => (
          <div className="hm-sec" key={t.no}>
            <div className="hm-sec-head">
              <span
                className="hm-badge"
                style={{ background: getHeatColor(t.avg), color: heatText(t.avg) }}
              >
                {t.theme}
              </span>
              <span className={`hm-avg num ${cls(t.avg)}`}>{fmtPct(t.avg)}</span>
            </div>
            <div className="hm-cells">
              {t.stocks.map(s => (
                <div
                  className="hm-cell"
                  key={s.code}
                  style={{ background: getHeatColor(s.pct), color: heatText(s.pct) }}
                  onClick={() => onSelect({ ...s, theme: t.theme })}
                >
                  <span className="n">{s.name}</span>
                  <span className="p num">{fmtPct(s.pct)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!themes && <div style={{ color: 'var(--dim)', fontSize: 13, padding: 8 }}>테마 불러오는 중…</div>}
      </div>
    </div>
  );
}
