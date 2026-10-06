// client/src/features/simulation/lib/targetFactory.ts
import { nanoid } from 'nanoid';
import type { LatLng, Target, TargetType } from '@/entities/target/types';
import { movePoint, bearingTo } from '@/shared/lib/geo';
import { BEHAVIOR, BIRD_TURN, RADAR, SPAWN_RANGE } from './config';

type Random = () => number;
const rand = (a: number, b: number, random: Random) => a + random() * (b - a);
const clamp = (value: number, limit: number) => Math.min(Math.max(value, -limit), limit);

/** Точка появления: случайный азимут и дистанция в пределах, допустимых для типа объекта. */
const spawnAt = (type: TargetType, random: Random): LatLng => {
  const [min, max] = SPAWN_RANGE[type];
  return movePoint(RADAR.center, rand(min, max, random), rand(0, 360, random));
};

/** @param nowSec время симуляции, с: срок жизни цели не идёт на паузе */
export const createTarget = (nowSec: number, random: Random = Math.random): Target => {
  const type: TargetType = random() < 0.4 ? 'uav' : 'bird';
  const cfg = BEHAVIOR[type];
  const spawnPoint = spawnAt(type, random);

  return {
    id: nanoid(8),
    type,
    position: { ...spawnPoint },
    spawnPoint,
    trajectory: [{ ...spawnPoint }],
    speed: rand(cfg.speed[0], cfg.speed[1], random),
    // БВС летит по прямой К РЛС, птица — по кривой
    heading: type === 'uav' ? bearingTo(spawnPoint, RADAR.center) : rand(0, 360, random),
    turnRate: type === 'uav' ? 0 : rand(-BIRD_TURN.maxRate, BIRD_TURN.maxRate, random),
    bornAtSec: nowSec,
    lifespanSec: rand(cfg.lifespanSec[0], cfg.lifespanSec[1], random),
    firstSeenSec: null,
    notified: false,
    identified: null,
    insideIgnoreZone: false,
    ignored: false,
    sinceSampleSec: 0,
  };
};

/**
 * След траектории прореживается по времени, а не по кадрам: на мониторе 60 и 144 Гц он одинаков.
 * 600 точек по 0,25 с — 150 с, это больше максимального срока жизни цели.
 */
const TRAJECTORY_SAMPLE_SEC = 0.25;
const TRAJECTORY_MAX_POINTS = 600;

export const advanceTarget = (t: Target, dtSec: number, random: Random = Math.random): Target => {
  if (!Number.isFinite(dtSec) || dtSec <= 0) return t;
  let { heading, turnRate } = t;
  if (t.type === 'bird') {
    // Случайное изменение скорости поворота масштабируется на √dt: изгиб траектории
    // не зависит от частоты кадров
    turnRate = clamp(turnRate + (random() * 2 - 1) * BIRD_TURN.noise * Math.sqrt(dtSec), BIRD_TURN.maxRate);
    heading = (heading + turnRate * dtSec + 360) % 360;
  }

  const next = movePoint(t.position, t.speed * dtSec, heading);
  const sinceSampleSec = t.sinceSampleSec + dtSec;
  const sample = sinceSampleSec >= TRAJECTORY_SAMPLE_SEC;

  return {
    ...t,
    position: next,
    heading,
    turnRate,
    trajectory: sample ? [...t.trajectory, next].slice(-TRAJECTORY_MAX_POINTS) : t.trajectory,
    sinceSampleSec: sample ? sinceSampleSec % TRAJECTORY_SAMPLE_SEC : sinceSampleSec,
  };
};
