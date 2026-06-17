export default function Breadth({ up, down, total, onFilter }) {
  const known = up + down;
  const flat = Math.max((total || known) - known, 0);
  const sum = up + down + flat || 1;

  return (
    <div className="panel breadth">
      <span className="panel-title">시장 온도</span>
      <div className="bar breadth-bar-clickable">
        <div className="u" style={{ width: `${(up / sum) * 100}%` }} onClick={() => onFilter?.('up')} title="상승 종목 보기" />
        <div className="f" style={{ width: `${(flat / sum) * 100}%` }} onClick={() => onFilter?.('flat')} title="보합 종목 보기" />
        <div className="d" style={{ width: `${(down / sum) * 100}%` }} onClick={() => onFilter?.('down')} title="하락 종목 보기" />
      </div>
      <div className="nums">
        <span className="up breadth-chip" onClick={() => onFilter?.('up')}>상승 {up.toLocaleString()}</span>
        <span className="breadth-chip" onClick={() => onFilter?.('flat')}>보합 {flat.toLocaleString()}</span>
        <span className="down breadth-chip" onClick={() => onFilter?.('down')}>하락 {down.toLocaleString()}</span>
      </div>
    </div>
  );
}
