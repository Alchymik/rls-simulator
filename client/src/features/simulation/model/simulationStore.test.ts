// client/src/features/simulation/model/simulationStore.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { useSimulationStore } from './simulationStore';
import { DETECTION_ZONE, IGNORE_ZONE } from '../lib/config';
import type { LatLng, Target, TargetType } from '@/entities/target/types';

const centroid = (poly: LatLng[]): LatLng => ({
  lat: poly.reduce((sum, p) => sum + p.lat, 0) / poly.length,
  lng: poly.reduce((sum, p) => sum + p.lng, 0) / poly.length,
});

const makeTarget = (id: string, at: LatLng, type: TargetType = 'uav'): Target => ({
  id,
  type,
  position: at,
  spawnPoint: at,
  trajectory: [at],
  speed: 30,
  heading: 90,
  bornAt: performance.now(),
  lifespanMs: 60_000,
  notified: false,
  identified: null,
  insideIgnoreZone: false,
  ignored: false,
  sampleTick: 0,
});

const store = () => useSimulationStore.getState();

/** maxConcurrent: 0 — отключает спавн, чтобы тесты были детерминированными */
const startDeterministic = () => {
  store().start({ durationSec: 3600, maxConcurrent: 0, spawnEveryMs: 60_000 });
  useSimulationStore.setState({ stats: { ...store().stats, lastSpawnAt: performance.now() } });
};

describe('simulationStore', () => {
  beforeEach(() => {
    useSimulationStore.setState({ status: 'idle', targets: [], notifications: [] });
    startDeterministic();
  });

  it('уведомляет о входе цели в зону обнаружения ровно один раз', () => {
    useSimulationStore.setState({ targets: [makeTarget('t1', centroid(DETECTION_ZONE))] });

    store().tick(0.016);
    expect(store().notifications).toHaveLength(1);
    expect(store().notifications[0]?.targetId).toBe('t1');
    expect(store().targets[0]?.notified).toBe(true);

    store().tick(0.016);
    expect(store().notifications).toHaveLength(1);
  });

  it('не создаёт уведомлений для цели в зоне игнорирования и скрывает её', () => {
    useSimulationStore.setState({ targets: [makeTarget('t2', centroid(IGNORE_ZONE))] });

    store().tick(0.016);

    expect(store().notifications).toHaveLength(0);
    expect(store().targets[0]?.insideIgnoreZone).toBe(true);
    expect(store().targets[0]?.ignored).toBe(true);
  });

  it('не уведомляет о цели, которая вышла из зоны игнорирования в зону обнаружения', () => {
    const ignoredTarget = makeTarget('t6', centroid(IGNORE_ZONE));
    useSimulationStore.setState({ targets: [ignoredTarget] });
    store().tick(0.016);

    const hidden = store().targets[0];
    expect(hidden).toBeDefined();
    if (!hidden) return;

    useSimulationStore.setState({
      targets: [{ ...hidden, position: centroid(DETECTION_ZONE), insideIgnoreZone: false }],
    });
    store().tick(0.016);

    expect(store().notifications).toHaveLength(0);
  });

  it('считает верным определением только БВС', () => {
    useSimulationStore.setState({
      targets: [
        makeTarget('uav', centroid(DETECTION_ZONE), 'uav'),
        makeTarget('bird', centroid(DETECTION_ZONE), 'bird'),
      ],
    });

    store().identify('uav');
    store().identify('bird');

    const targets = store().targets;
    expect(targets.find((t) => t.id === 'uav')?.identified).toBe('correct');
    expect(targets.find((t) => t.id === 'bird')?.identified).toBe('wrong');
    expect(store().stats).toMatchObject({ markedTotal: 2, correct: 1, wrong: 1 });
    expect(store().stats.reactionSamples).toHaveLength(2);
  });

  it('игнорирует повторное определение цели', () => {
    useSimulationStore.setState({ targets: [makeTarget('t3', centroid(DETECTION_ZONE))] });

    store().identify('t3');
    store().identify('t3');

    expect(store().stats.markedTotal).toBe(1);
  });

  it('завершает сеанс по истечении времени', () => {
    useSimulationStore.setState({ status: 'running', elapsedSec: 0 });
    useSimulationStore.getState().start({ durationSec: 1 });

    store().tick(0.5);
    expect(store().status).toBe('running');

    store().tick(0.6);
    expect(store().status).toBe('finished');
    expect(store().elapsedSec).toBe(1);
  });

  it('не двигает цели на паузе', () => {
    useSimulationStore.setState({ targets: [makeTarget('t4', centroid(DETECTION_ZONE))] });
    store().pause();

    const before = store().targets[0]?.position;
    store().tick(0.016);

    expect(store().targets[0]?.position).toEqual(before);
  });

  it('очищает уведомления', () => {    useSimulationStore.setState({ targets: [makeTarget('t5', centroid(DETECTION_ZONE))] });
    store().tick(0.016);

    store().clearNotifications();
    expect(store().notifications).toHaveLength(0);
  });
});
