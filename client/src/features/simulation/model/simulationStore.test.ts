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
  turnRate: 0,
  bornAtSec: 0,
  lifespanSec: 60,
  firstSeenSec: 0,
  notified: false,
  identified: null,
  insideIgnoreZone: false,
  ignored: false,
  sinceSampleSec: 0,
});

const store = () => useSimulationStore.getState();

/** maxConcurrent: 0 — отключает спавн, чтобы тесты были детерминированными */
const startDeterministic = () => {
  store().start({ durationSec: 3600, maxConcurrent: 0, spawnEveryMs: 60_000 });
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

  it('не теряет цели и не наращивает время реакции за паузу', () => {
    useSimulationStore.setState({
      targets: [{ ...makeTarget('bird', centroid(DETECTION_ZONE), 'bird'), lifespanSec: 5 }],
    });
    store().pause();
    // На паузе часы симуляции стоят, сколько бы ни прошло реального времени
    for (let frame = 0; frame < 600; frame += 1) store().tick(0.1);
    store().resume();
    store().tick(0.016);

    expect(store().targets).toHaveLength(1);
  });

  it('не засчитывает отметку на паузе и после окончания сеанса', () => {
    useSimulationStore.setState({ targets: [makeTarget('t7', centroid(DETECTION_ZONE))] });

    store().pause();
    store().identify('t7');
    store().finish();
    store().identify('t7');

    expect(store().stats.markedTotal).toBe(0);
  });

  it('считает время реакции с момента, когда цель стала видна', () => {
    useSimulationStore.setState({ targets: [makeTarget('t8', centroid(DETECTION_ZONE))], elapsedSec: 2 });
    store().identify('t8');

    expect(store().stats.reactionSamples[0]?.reactionMs).toBe(2000);
  });

  it('создаёт уведомления для всех целей, вошедших в зону за один кадр', () => {
    useSimulationStore.setState({
      targets: [makeTarget('a', centroid(DETECTION_ZONE)), makeTarget('b', centroid(DETECTION_ZONE))],
    });
    store().tick(0.016);

    expect(
      store()
        .notifications.map((n) => n.targetId)
        .sort(),
    ).toEqual(['a', 'b']);
  });

  it('очищает уведомления', () => {
    useSimulationStore.setState({ targets: [makeTarget('t5', centroid(DETECTION_ZONE))] });
    store().tick(0.016);

    store().clearNotifications();
    expect(store().notifications).toHaveLength(0);
  });
});
