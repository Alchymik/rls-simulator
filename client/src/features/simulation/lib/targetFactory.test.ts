// client/src/features/simulation/lib/targetFactory.test.ts
import { describe, expect, it } from 'vitest';
import { advanceTarget, createTarget } from './targetFactory';

/** След траектории: линия от точки обнаружения цели до текущего положения */
describe('след траектории цели', () => {
  it('начинается в точке появления и пополняется прореженными точками', () => {
    let target = createTarget();
    expect(target.trajectory).toHaveLength(1);

    for (let frame = 0; frame < 40; frame += 1) target = advanceTarget(target, 0.05);

    // 40 кадров, точка берётся каждый 4-й кадр: точка появления + 10 точек следа
    expect(target.trajectory).toHaveLength(11);
  });

  it('ограничивает длину следа, чтобы линия не росла бесконечно', () => {
    let target = createTarget();
    for (let frame = 0; frame < 4000; frame += 1) target = advanceTarget(target, 0.02);

    expect(target.trajectory.length).toBeLessThanOrEqual(600);
    expect(target.trajectory.length).toBeGreaterThan(100);
  });
});
