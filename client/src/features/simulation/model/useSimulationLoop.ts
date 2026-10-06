import { useEffect } from 'react';
import { useSimulationStore } from './simulationStore';

const STEP_SEC = 1 / 60;
/** Fixed physics cadence; hidden windows pause instead of accumulating wall-clock delay. */
export const useSimulationLoop = () => {
  const tick = useSimulationStore((state) => state.tick);
  const status = useSimulationStore((state) => state.status);
  useEffect(() => {
    if (status !== 'running') return;
    let raf = 0;
    let last = performance.now();
    let accumulated = 0;
    const loop = (now: number) => {
      accumulated += Math.min(Math.max((now - last) / 1000, 0), 0.25);
      last = now;
      while (accumulated + 1e-9 >= STEP_SEC) {
        tick(STEP_SEC);
        accumulated -= STEP_SEC;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, tick]);
};
