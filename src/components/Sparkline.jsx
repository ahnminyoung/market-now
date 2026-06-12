import { useEffect, useRef } from 'react';

// 실제 일별 종가 시계열을 라인 + 그라데이션으로 그린다.
export default function Sparkline({ values, pct }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !values?.length) return;
    const ctx = canvas.getContext('2d');
    const w = (canvas.width = canvas.offsetWidth * 2);
    const h = (canvas.height = 88);
    ctx.clearRect(0, 0, w, h);

    const min = Math.min(...values);
    const max = Math.max(...values);
    const rng = max - min || 1;
    const color = pct >= 0 ? '#f04452' : '#3182f6';

    ctx.beginPath();
    values.forEach((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - 8 - ((v - min) / rng) * (h - 20);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, color + '40');
    grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad;
    ctx.fill();
  }, [values, pct]);

  return <canvas ref={ref} />;
}
