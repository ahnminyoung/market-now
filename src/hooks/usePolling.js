import { useEffect, useRef, useState } from 'react';

// fn을 즉시 한 번 실행하고 이후 intervalMs 간격으로 반복 호출한다.
// fn이 null이면 폴링을 멈추고 데이터를 비운다 (모달 닫힘 등).
export default function usePolling(fn, intervalMs, deps = []) {
  const [data, setData] = useState(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!fnRef.current) {
      setData(null);
      return;
    }
    let alive = true;
    let timer;
    const tick = async () => {
      try {
        const d = await fnRef.current();
        if (alive) setData(d);
      } catch (e) {
        console.warn('polling failed:', e.message);
      }
      if (alive) timer = setTimeout(tick, intervalMs);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return data;
}
