// client/src/features/simulation/lib/targetFactory.ts
import { nanoid } from 'nanoid';
import type { LatLng, Target, TargetType } from '@/entities/target/types';
import { movePoint, bearingTo } from '@/shared/lib/geo';
import { BEHAVIOR, RADAR, SPAWN_RANGE } from './config';

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));

/** Точка появления: случайный азимут и дистанция в пределах, допустимых для типа объекта. */
const spawnAt = (type: TargetType): LatLng => {
  const [min, max] = SPAWN_RANGE[type];
  return movePoint(RADAR.center, rand(min, max), rand(0, 360));
};

export const createTarget = (): Target => {
  const type: TargetType = Math.random() < 0.4 ? 'uav' : 'bird';
  const cfg = BEHAVIOR[type];
  const spawnPoint = spawnAt(type);
  const speed = rand(cfg.speed[0], cfg.speed[1]);
  const lifespanMs = randInt(cfg.lifespanMs[0], cfg.lifespanMs[1]);

  // БВС летит по прямой К РЛС, птица — по кривой (случайные блуждания)
  const baseHeading =
    type === 'uav'
      ? bearingTo(spawnPoint, RADAR.center)
      : rand(0, 360);

  return {
    id: nanoid(8),
    type,
    position: { ...spawnPoint },
    spawnPoint,
    trajectory: [{ ...spawnPoint }],
    speed,
    heading: baseHeading,
    bornAt: performance.now(),
    lifespanMs,
    notified: false,
    identified: null,
    insideIgnoreZone: false,
    ignored: false,
    sampleTick: 0,
  };
};

/**
 * След траектории оставляется реже кадров и ограничен по длине: линия охватывает время
 * с момента обнаружения цели (а не последнюю секунду) и при этом не раздувает путь полилинии.
 */
const TRAJECTORY_SAMPLE_EVERY = 4;
const TRAJECTORY_MAX_POINTS = 600;

export const advanceTarget = (t: Target, dtSec: number): Target => {
  let heading = t.heading;
  if (t.type === 'bird') {
    // плавное случайное блуждание
    heading = (heading + (Math.random() - 0.5) * 60 + 360) % 360;
  }
  const next = movePoint(t.position, t.speed * dtSec, heading);
  const sampleTick = t.sampleTick + 1;
  const trajectory =
    sampleTick % TRAJECTORY_SAMPLE_EVERY === 0
      ? [...t.trajectory, next].slice(-TRAJECTORY_MAX_POINTS)
      : t.trajectory;
  return { ...t, position: next, heading, trajectory, sampleTick };
};