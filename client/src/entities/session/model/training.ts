// client/src/entities/session/model/training.ts

/** Параметры сеанса, настраиваемые в окне «Настройки тренировки» (п.3.3 ТЗ, п.2). */
export interface TrainingSettings {
  durationSec: number;
  maxConcurrent: number;
  spawnEveryMs: number;
}

/** Единственный источник значений по умолчанию: maxConcurrent = 20 согласно п.3.3.1.4.3 ТЗ */
export const DEFAULT_TRAINING: TrainingSettings = {
  durationSec: 120,
  maxConcurrent: 20,
  spawnEveryMs: 1500,
};

export const TRAINING_LIMITS = {
  durationSec: { min: 30, max: 3600 },
  maxConcurrent: { min: 1, max: 20 },
  spawnEveryMs: { min: 300, max: 10_000 },
} as const;

const clamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.min(Math.max(Math.round(value), min), max) : min;

/** Приводит параметры к допустимым: и из формы, и из localStorage прошлых версий */
export const clampTraining = (t: TrainingSettings): TrainingSettings => ({
  durationSec: clamp(t.durationSec, TRAINING_LIMITS.durationSec.min, TRAINING_LIMITS.durationSec.max),
  maxConcurrent: clamp(t.maxConcurrent, TRAINING_LIMITS.maxConcurrent.min, TRAINING_LIMITS.maxConcurrent.max),
  spawnEveryMs: clamp(t.spawnEveryMs, TRAINING_LIMITS.spawnEveryMs.min, TRAINING_LIMITS.spawnEveryMs.max),
});
