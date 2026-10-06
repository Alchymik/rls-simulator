// client/src/features/simulation/lib/targetFactory.test.ts
import { describe, expect, it } from 'vitest';
import { distanceMeters } from '@/shared/lib/geo';
import { advanceTarget, createTarget } from './targetFactory';
import { RADAR } from './config';
import type { Target } from '@/entities/target/types';

const bird = (random: () => number): Target => ({
  ...createTarget(0, random),
  type: 'bird',
  speed: 6,
  position: RADAR.center,
});

/** Средний сдвиг птицы за 8 с при заданной частоте кадров */
const netDisplacement = (fps: number) => {
  let seed = 12345;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const runs = 200;
  let sum = 0;
  for (let run = 0; run < runs; run += 1) {
    let target = bird(random);
    for (let frame = 0; frame < fps * 8; frame += 1) target = advanceTarget(target, 1 / fps, random);
    sum += distanceMeters(RADAR.center, target.position);
  }
  return sum / runs;
};

/** След траектории: линия от точки обнаружения цели до текущего положения */
describe('след траектории цели', () => {
  it('начинается в точке появления и пополняется по времени, а не по кадрам', () => {
    let at60 = createTarget(0);
    let at144 = createTarget(0);
    expect(at60.trajectory).toHaveLength(1);

    for (let frame = 0; frame < 60 * 2; frame += 1) at60 = advanceTarget(at60, 1 / 60);
    for (let frame = 0; frame < 144 * 2; frame += 1) at144 = advanceTarget(at144, 1 / 144);

    // 2 с, точка каждые 0,25 с: точка появления + 8 точек следа при любой частоте кадров
    expect(at60.trajectory.length).toBeGreaterThanOrEqual(8);
    expect(Math.abs(at60.trajectory.length - at144.trajectory.length)).toBeLessThanOrEqual(1);
  });

  it('ограничивает длину следа, чтобы линия не росла бесконечно', () => {
    let target = createTarget(0);
    for (let frame = 0; frame < 60 * 200; frame += 1) target = advanceTarget(target, 1 / 60);

    expect(target.trajectory.length).toBeLessThanOrEqual(600);
    expect(target.trajectory.length).toBeGreaterThan(100);
  });
});

describe('движение птицы', () => {
  it('летит дугой, а не дрожит на месте', () => {
    // Путь 48 м: при плавном повороте птица уходит от точки появления больше чем на половину пути
    expect(netDisplacement(60)).toBeGreaterThan(24);
  });

  it('не зависит от частоты кадров', () => {
    const at60 = netDisplacement(60);
    const at144 = netDisplacement(144);
    expect(Math.abs(at60 - at144) / at60).toBeLessThan(0.15);
  });
});
