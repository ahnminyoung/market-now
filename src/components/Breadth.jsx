export default function Breadth({ up, down, total }) {
  const known = up + down;
  const flat = Math.max((total || known) - known, 0);
  const sum = up + down + flat || 1;

  return (
    <div className="panel breadth">
      <span className="panel-title">시장 온도</span>
      <div className="bar">
        <div className="u" style={{ width: `${(up / sum) * 100}%` }} />
        <div className="f" style={{ width: `${(flat / sum) * 100}%` }} />
        <div className="d" style={{ width: `${(down / sum) * 100}%` }} />
      </div>
      <div className="nums">
        <span className="up">상승 {up.toLocaleString()}</span>
        <span>보합 {flat.toLocaleString()}</span>
        <span className="down">하락 {down.toLocaleString()}</span>
      </div>
    </div>
  );
}
