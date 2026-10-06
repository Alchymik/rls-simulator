// client/src/widgets/TrainingSetupModal/TrainingSetupModal.tsx
import { useState, type FormEvent } from 'react';
import { clampTraining, TRAINING_LIMITS, type TrainingSettings } from '@/entities/session/model/training';
import { formatDuration } from '@/shared/lib/units';
import { Dialog } from '@/shared/ui/Dialog';
import styles from './TrainingSetupModal.module.css';

interface Props {
  initial: TrainingSettings;
  onCancel: () => void;
  onStart: (settings: TrainingSettings) => void;
}

/** Всплывающее окно «Настройки тренировки» перед началом сеанса (п.3.3 ТЗ, п.2). */
export const TrainingSetupModal = ({ initial, onCancel, onStart }: Props) => {
  const [draft, setDraft] = useState(initial);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onStart(clampTraining(draft));
  };

  return (
    <Dialog className={styles.backdrop} onClose={onCancel} labelledBy="training-setup-title">
      <form className={styles.modal} onSubmit={submit}>
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
          <button className={styles.cancel} type="button" onClick={onCancel}>
            Отмена
          </button>
          <button className={styles.start} type="submit">
            Начать
          </button>
        </div>
      </form>
    </Dialog>
  );
};
