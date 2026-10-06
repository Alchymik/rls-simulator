// client/src/widgets/ResultsModal/ResultsModal.tsx
import { useSimulationStore } from '@/features/simulation/model/simulationStore';
import { Dialog } from '@/shared/ui/Dialog';
import { formatDuration } from '@/shared/lib/units';
import { formatSeconds } from '@/shared/lib/format';
import styles from './ResultsModal.module.css';

/** Состояние записи сеанса в профиль пользователя (п.3.3 ТЗ, п.7). */
export type SaveStatus = 'pending' | 'saved' | 'error';

interface Props {
  saveStatus: SaveStatus;
  onClose: () => void;
  onRetry: () => void;
  error?: string | null;
}

const Row = ({ label, value, accent }: { label: string; value: string; accent?: 'green' | 'red' }) => (
  <div className={styles.row}>
    <span>{label}</span>
    <b className={accent ? styles[accent] : ''}>{value}</b>
  </div>
);

/** Окно результатов после завершения сеанса тренировки (п.3.3 ТЗ, п.6). */
export const ResultsModal = ({ saveStatus, onClose, onRetry, error }: Props) => {
  const elapsedSec = useSimulationStore((s) => s.elapsedSec);
  const stats = useSimulationStore((s) => s.stats);

  // Среднее время — по верно определённым БВС: ошибочные отметки птиц его искажают
  const correctSamples = stats.reactionSamples.filter((s) => s.correct);
  const avgSec = correctSamples.length
    ? correctSamples.reduce((sum, s) => sum + s.reactionMs, 0) / correctSamples.length / 1000
    : null;

  return (
    <Dialog className={styles.backdrop} onClose={onClose} labelledBy="results-title">
      <div className={styles.modal}>
        <h3 id="results-title">Результаты тренировки</h3>
        <Row label="Общее время симуляции" value={formatDuration(elapsedSec)} />
        <Row label="Отмеченных целей" value={String(stats.markedTotal)} />
        <Row label="Верно" value={String(stats.correct)} accent="green" />
        <Row label="Ошибок" value={String(stats.wrong)} accent="red" />
        <Row label="Среднее время определения БВС" value={avgSec === null ? '—' : formatSeconds(avgSec)} />
        <p className={saveStatus === 'error' ? styles.saveError : styles.saved} role="status">
          {saveStatus === 'saved'
            ? 'Результаты сохранены в разделе «Профиль»'
            : saveStatus === 'pending'
              ? 'Сохраняем результат…'
              : (error ?? 'Результат сохранён на устройстве и будет отправлен позже.')}
        </p>
        {saveStatus === 'error' && (
          <button className={styles.ok} onClick={onRetry}>
            Повторить сохранение
          </button>
        )}
        <button className={styles.ok} onClick={onClose}>
          ✓ OK
        </button>
      </div>
    </Dialog>
  );
};
