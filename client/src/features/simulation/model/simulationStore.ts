// client/src/features/simulation/model/simulationStore.ts
import { create } from 'zustand';
import type { LatLng, Target } from '@/entities/target/types';
import type { Sector } from '@/entities/event/types';
import { advanceTarget, createTarget } from '../lib/targetFactory';
import { DETECTION_ZONE, IGNORE_ZONE, RADAR } from '../lib/config';
import { distanceMeters, pointInPolygon } from '@/shared/lib/geo';
import { msToKmh } from '@/shared/lib/units';

export type SimulationStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface NotificationEntry {
  id: string;
  targetId: string;
  sector: Sector;
  speedKmh: number;
  lat: number;
  lng: number;
  at: number;
}

export interface SimulationConfig {
  durationSec: number;
  maxConcurrent: number;
  spawnEveryMs: number;
}

export interface ReactionSample {
  t: number;
  reactionMs: number;
  correct: boolean;
}

interface Stats {
  markedTotal: number;
  correct: number;
  wrong: number;
  reactionSamples: ReactionSample[];
  lastSpawnAt: number;
}

interface State {
  status: SimulationStatus;
  startedAt: number;
  elapsedSec: number;
  config: SimulationConfig;
  targets: Target[];
  notifications: NotificationEntry[];
  stats: Stats;
  start: (config: Partial<SimulationConfig>) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  tick: (dtSec: number) => void;
  identify: (targetId: string) => void;
  clearNotifications: () => void;
}

const DEFAULT_CONFIG: SimulationConfig = {
  durationSec: 120,
  maxConcurrent: 20,
  spawnEveryMs: 1500,
};

const emptyStats = (): Stats => ({
  markedTotal: 0,
  correct: 0,
  wrong: 0,
  reactionSamples: [],
  lastSpawnAt: 0,
});

const sectorOf = (p: LatLng): Sector => {
  const dLat = p.lat - RADAR.center.lat;
  const dLng = p.lng - RADAR.center.lng;
  if (Math.abs(dLat) >= Math.abs(dLng)) return dLat > 0 ? 'Север' : 'Юг';
  return dLng > 0 ? 'Восток' : 'Запад';
};

export const useSimulationStore = create<State>((set, get) => ({
  status: 'idle',
  startedAt: 0,
  elapsedSec: 0,
  config: DEFAULT_CONFIG,
  targets: [],
  notifications: [],
  stats: emptyStats(),

  start: (config) =>
    set({
      status: 'running',
      config: { ...DEFAULT_CONFIG, ...config },
      startedAt: performance.now(),
      elapsedSec: 0,
      targets: [],
      notifications: [],
      stats: emptyStats(),
    }),

  pause: () => set({ status: 'paused' }),
  resume: () => set({ status: 'running' }),
  reset: () =>
    set({ status: 'idle', elapsedSec: 0, targets: [], notifications: [], stats: emptyStats() }),

  tick: (dtSec) => {
    const s = get();
    if (s.status !== 'running') return;

    const now = performance.now();
    const nextElapsed = s.elapsedSec + dtSec;
    if (nextElapsed >= s.config.durationSec) {
      set({ status: 'finished', elapsedSec: s.config.durationSec });
      return;
    }

    // 1. Продвинуть цели, отфильтровать вышедшие за пределы / прожившие свой срок
    let targets = s.targets
      .map((t) => advanceTarget(t, dtSec))
      .filter((t) => {
        const dist = distanceMeters(t.position, RADAR.center);
        const age = now - t.bornAt;
        return dist <= RADAR.rings.far && age <= t.lifespanMs;
      });

    // 2. Зоны: игнор-зона + уведомление при входе цели в зону обнаружения (п.3.3.1.3 ТЗ)
    let notifications = s.notifications;
    targets = targets.map((t) => {
      const insideIgnoreZone = pointInPolygon(t.position, IGNORE_ZONE);
      // Цель, побывавшая в зоне игнорирования, уведомлений не создаёт вовсе (п.3.3.1.3 ТЗ)
      const ignored = t.ignored || insideIgnoreZone;
      const detected = !ignored && pointInPolygon(t.position, DETECTION_ZONE);
      if (!detected || t.notified) return { ...t, insideIgnoreZone, ignored };

      notifications = [
        {
          id: t.id + ':n',
          targetId: t.id,
          sector: sectorOf(t.position),
          speedKmh: msToKmh(t.speed),
          lat: t.position.lat,
          lng: t.position.lng,
          at: Date.now(),
        },
        ...notifications,
      ].slice(0, 50);
      return { ...t, insideIgnoreZone, ignored, notified: true };
    });

    // 3. Спавн новых
    let lastSpawnAt = s.stats.lastSpawnAt;
    if (targets.length < s.config.maxConcurrent && now - s.stats.lastSpawnAt >= s.config.spawnEveryMs) {
      targets.push(createTarget());
      lastSpawnAt = now;
    }

    set({ targets, notifications, elapsedSec: nextElapsed, stats: { ...s.stats, lastSpawnAt } });
  },

  identify: (targetId) => {
    const s = get();
    const target = s.targets.find((t) => t.id === targetId);
    if (!target || target.identified) return;

    // Верным считается определение БВС (п.3.3 ТЗ, п.5)
    const isCorrect = target.type === 'uav';

    set({
      targets: s.targets.map((t) =>
        t.id === targetId ? { ...t, identified: isCorrect ? 'correct' : 'wrong' } : t,
      ),
      stats: {
        ...s.stats,
        markedTotal: s.stats.markedTotal + 1,
        correct: s.stats.correct + (isCorrect ? 1 : 0),
        wrong: s.stats.wrong + (isCorrect ? 0 : 1),
        reactionSamples: [
          ...s.stats.reactionSamples,
          { t: s.elapsedSec, reactionMs: performance.now() - target.bornAt, correct: isCorrect },
        ],
      },
    });
  },

  clearNotifications: () => set({ notifications: [] }),
}));
