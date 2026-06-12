import { useMemo } from 'react';
import { fmtPct, cls } from '../lib/api.js';

export default function Tape({ stocks }) {
  const items = useMemo(
    () => [...stocks].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 20),
    [stocks],
  );

  if (!items.length) return <div className="tape-wrap" />;

  // 무한 루프 애니메이션을 위해 동일 목록을 두 번 렌더링
  const half = dup =>
    items.map(s => (
      <span key={dup + s.code}>
        <b>{s.name}</b>
        <span className={`num ${cls(s.pct)}`}>{fmtPct(s.pct)}</span>
      </span>
    ));

  return (
    <div className="tape-wrap">
      <div className="tape">
        {half('a')}
        {half('b')}
      </div>
    </div>
  );
}
