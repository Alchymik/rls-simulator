// client/src/features/simulation/model/useSimulationLoop.ts
import { useEffect } from 'react';
import { useSimulationStore } from './simulationStore';

/** RAF-цикл с фиксированным шагом (clamp на большие лаги). */
export const useSimulationLoop = () => {
  const tick = useSimulationStore((s) => s.tick);
  const status = useSimulationStore((s) => s.status);

  useEffect(() => {
    if (status !== 'running') return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dtSec = Math.min((now - last) / 1000, 0.1);
      last = now;
      tick(dtSec);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, tick]);
};