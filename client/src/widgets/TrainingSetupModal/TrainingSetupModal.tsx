// client/src/widgets/TrainingSetupModal/TrainingSetupModal.tsx
import { useState, type FormEvent } from 'react';
import {
  TRAINING_LIMITS,
  type TrainingSettings,
} from '@/features/settings/model/settingsStore';
import { formatDuration } from '@/shared/lib/units';
import { useHotkey } from '@/shared/lib/useHotkey';
import styles from './TrainingSetupModal.module.css';

interface Props {
  initial: TrainingSettings;
  onCancel: () => void;
  onStart: (settings: TrainingSettings) => void;
}

const clamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.min(Math.max(Math.round(value), min), max) : min;

/** Всплывающее окно «Настройки тренировки» перед началом сеанса (п.3.3 ТЗ, п.2). */
export const TrainingSetupModal = ({ initial, onCancel, onStart }: Props) => {
  const [draft, setDraft] = useState(initial);

  useHotkey('Escape', onCancel);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onStart({
      durationSec: clamp(draft.durationSec, TRAINING_LIMITS.durationSec.min, TRAINING_LIMITS.durationSec.max),
      maxConcurrent: clamp(draft.maxConcurrent, TRAINING_LIMITS.maxConcurrent.min, TRAINING_LIMITS.maxConcurrent.max),
      spawnEveryMs: clamp(draft.spawnEveryMs, TRAINING_LIMITS.spawnEveryMs.min, TRAINING_LIMITS.spawnEveryMs.max),
    });
  };

  return (
    <div className={styles.backdrop}>
      <form
        className={styles.modal}
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="training-setup-title"
      >
        <h3 id="training-setup-title">Настройки тренировки</h3>
        <label className={styles.field}>
          <span>Ограничение по времени, с</span>
          <input
            type="number"
            min={TRAINING_LIMITS.durationSec.min}
            max={TRAINING_LIMITS.durationSec.max}
            step={30}
            value={draft.durationSec}
            onChange={(e) => setDraft({ ...draft, durationSec: Number(e.target.value) })}
          />
          <small>Это {formatDuration(draft.durationSec)}</small>
        </label>

        <label className={styles.field}>
          <span>Максимум объектов на карте</span>
          <input
            type="number"
            min={TRAINING_LIMITS.maxConcurrent.min}
            max={TRAINING_LIMITS.maxConcurrent.max}
            step={1}
            value={draft.maxConcurrent}
            onChange={(e) => setDraft({ ...draft, maxConcurrent: Number(e.target.value) })}
          />
          <small>По ТЗ одновременно не более 20</small>
        </label>

        <label className={styles.field}>
          <span>Период генерации объектов, мс</span>
          <input
            type="number"
            min={TRAINING_LIMITS.spawnEveryMs.min}
            max={TRAINING_LIMITS.spawnEveryMs.max}
            step={100}
            value={draft.spawnEveryMs}
            onChange={(e) => setDraft({ ...draft, spawnEveryMs: Number(e.target.value) })}
          />
          <small>Чем меньше, тем чаще появляются цели</small>
        </label>

        <div className={styles.actions}>
          <button className={styles.cancel} type="button" onClick={onCancel}>Отмена</button>
          <button className={styles.start} type="submit">Начать</button>
        </div>
      </form>
    </div>
  );
};
