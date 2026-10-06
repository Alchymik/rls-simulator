// client/src/features/simulation/model/simulationStore.ts
import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { Target } from '@/entities/target/types';
import type { Sector } from '@/entities/event/types';
import { DEFAULT_TRAINING, type TrainingSettings } from '@/entities/session/model/training';
import { advanceTarget, createTarget } from '../lib/targetFactory';
import { DETECTION_ZONE, IGNORE_ZONE, RADAR } from '../lib/config';
import { sectorOf } from '../lib/sector';
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

export type SimulationConfig = TrainingSettings;

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
  /** Время симуляции последнего появления цели, с */
  lastSpawnSec: number;
}

interface State {
  status: SimulationStatus;
  sessionId: string;
  ownerId: string | null;
  finishedAt: number | null;
  /** Время запуска по часам рабочей станции, мс: уходит в историю и отличает сеансы друг от друга */
  startedAt: number;
  /** Единые часы симуляции, с: стоят на паузе и в свёрнутом окне */
  elapsedSec: number;
  config: SimulationConfig;
  targets: Target[];
  notifications: NotificationEntry[];
  stats: Stats;
  start: (config: Partial<SimulationConfig>, ownerId?: string) => void;
  pause: () => void;
  resume: () => void;
  /** Досрочное завершение: результаты сохраняются так же, как по истечении времени */
  finish: () => void;
  reset: () => void;
  tick: (dtSec: number) => void;
  identify: (targetId: string) => void;
  clearNotifications: () => void;
}

const MAX_NOTIFICATIONS = 50;

const emptyStats = (): Stats => ({
  markedTotal: 0,
  correct: 0,
  wrong: 0,
  reactionSamples: [],
  lastSpawnSec: Number.NEGATIVE_INFINITY,
});

const toNotification = (t: Target): NotificationEntry => ({
  id: `${t.id}:n`,
  targetId: t.id,
  sector: sectorOf(t.position),
  speedKmh: msToKmh(t.speed),
  lat: t.position.lat,
  lng: t.position.lng,
  at: Date.now(),
});

export const useSimulationStore = create<State>((set, get) => ({
  status: 'idle',
  sessionId: '',
  ownerId: null,
  finishedAt: null,
  startedAt: 0,
  elapsedSec: 0,
  config: DEFAULT_TRAINING,
  targets: [],
  notifications: [],
  stats: emptyStats(),

  start: (config, ownerId) =>
    set({
      status: 'running',
      sessionId: nanoid(),
      ownerId: ownerId ?? null,
      finishedAt: null,
      config: { ...DEFAULT_TRAINING, ...config },
      startedAt: Date.now(),
      elapsedSec: 0,
      targets: [],
      notifications: [],
      stats: emptyStats(),
    }),

  pause: () => set((s) => (s.status === 'running' ? { status: 'paused' } : s)),
  resume: () => set((s) => (s.status === 'paused' ? { status: 'running' } : s)),
  finish: () =>
    set((s) =>
      s.status === 'running' || s.status === 'paused' ? { status: 'finished', finishedAt: Date.now() } : s,
    ),
  reset: () =>
    set({
      status: 'idle',
      sessionId: '',
      ownerId: null,
      finishedAt: null,
      elapsedSec: 0,
      targets: [],
      notifications: [],
      stats: emptyStats(),
    }),

  tick: (dtSec) => {
    const s = get();
    if (s.status !== 'running' || !Number.isFinite(dtSec) || dtSec <= 0) return;

    // Срок жизни, появление целей и время реакции считаются по часам симуляции,
    // а не по performance.now(): иначе за паузу «умирают» все птицы, а время реакции растёт
    const now = s.elapsedSec + dtSec;
    if (now >= s.config.durationSec) {
      set({ status: 'finished', finishedAt: Date.now(), elapsedSec: s.config.durationSec });
      return;
    }

    const fresh: NotificationEntry[] = [];
    const targets = s.targets
      .map((t) => advanceTarget(t, dtSec))
      .filter(
        (t) =>
          distanceMeters(t.position, RADAR.center) <= RADAR.rings.far && now - t.bornAtSec <= t.lifespanSec,
      )
      .map((t) => {
        const insideIgnoreZone = pointInPolygon(t.position, IGNORE_ZONE);
        // Цель, побывавшая в зоне игнорирования, уведомлений не создаёт вовсе (п.3.3.1.3 ТЗ)
        const ignored = t.ignored || insideIgnoreZone;
        const firstSeenSec = t.firstSeenSec ?? (insideIgnoreZone ? null : now);
        const next = { ...t, insideIgnoreZone, ignored, firstSeenSec };
        if (ignored || t.notified || !pointInPolygon(t.position, DETECTION_ZONE)) return next;

        fresh.push(toNotification(next));
        return { ...next, notified: true };
      });

    let lastSpawnSec = s.stats.lastSpawnSec;
    if (targets.length < s.config.maxConcurrent && (now - lastSpawnSec) * 1000 >= s.config.spawnEveryMs) {
      const target = createTarget(now);
      const insideIgnoreZone = pointInPolygon(target.position, IGNORE_ZONE);
      target.insideIgnoreZone = insideIgnoreZone;
      target.ignored = insideIgnoreZone;
      target.firstSeenSec = insideIgnoreZone ? null : now;
      if (!insideIgnoreZone && pointInPolygon(target.position, DETECTION_ZONE)) {
        target.notified = true;
        fresh.push(toNotification(target));
      }
      targets.push(target);
      lastSpawnSec = now;
    }

    set({
      targets,
      notifications: fresh.length
        ? [...fresh, ...s.notifications].slice(0, MAX_NOTIFICATIONS)
        : s.notifications,
      elapsedSec: now,
      stats: { ...s.stats, lastSpawnSec },
    });
  },

  identify: (targetId) => {
    const s = get();
    // Отметка засчитывается только в идущем сеансе: не на паузе и не после окончания
    if (s.status !== 'running') return;

    const target = s.targets.find((t) => t.id === targetId);
    if (!target || target.identified || target.insideIgnoreZone) return;

    // Верным считается определение БВС (п.3.3 ТЗ, п.5)
    const isCorrect = target.type === 'uav';
    // Время реакции — с момента, когда цель стала видна оператору
    const reactionMs = Math.round((s.elapsedSec - (target.firstSeenSec ?? s.elapsedSec)) * 1000);

    set({
      targets: s.targets.map((t) =>
        t.id === targetId ? { ...t, identified: isCorrect ? 'correct' : 'wrong' } : t,
      ),
      stats: {
        ...s.stats,
        markedTotal: s.stats.markedTotal + 1,
        correct: s.stats.correct + (isCorrect ? 1 : 0),
        wrong: s.stats.wrong + (isCorrect ? 0 : 1),
        reactionSamples: [...s.stats.reactionSamples, { t: s.elapsedSec, reactionMs, correct: isCorrect }],
      },
    });
  },

  clearNotifications: () => set({ notifications: [] }),
}));
