// client/src/widgets/ResultsModal/ResultsModal.tsx
import { useSimulationStore } from '@/features/simulation/model/simulationStore';
import { useHotkey } from '@/shared/lib/useHotkey';
import { formatDuration } from '@/shared/lib/units';
import styles from './ResultsModal.module.css';

/** Состояние записи сеанса в профиль пользователя (п.3.3 ТЗ, п.7). */
export type SaveStatus = 'pending' | 'saved' | 'error';

interface Props {
  saveStatus: SaveStatus;
  onClose: () => void;
}

const Row = ({ label, value, accent }: { label: string; value: string; accent?: 'green' | 'red' }) => (
  <div className={styles.row}>
    <span>{label}</span>
    <b className={accent ? styles[accent] : ''}>{value}</b>
  </div>
);

/** Окно результатов после завершения сеанса тренировки (п.3.3 ТЗ, п.6). */
export const ResultsModal = ({ saveStatus, onClose }: Props) => {
  const elapsedSec = useSimulationStore((s) => s.elapsedSec);
  const stats = useSimulationStore((s) => s.stats);

  useHotkey('Escape', onClose);

  const avgSec = stats.reactionSamples.length
    ? stats.reactionSamples.reduce((sum, s) => sum + s.reactionMs, 0) /
      stats.reactionSamples.length /
      1000
    : 0;

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="results-title">
        <h3 id="results-title">Результаты тренировки</h3>
        <Row label="Общее время симуляции" value={formatDuration(elapsedSec)} />
        <Row label="Отмеченных целей" value={String(stats.markedTotal)} />
        <Row label="Верно" value={String(stats.correct)} accent="green" />
        <Row label="Ошибок" value={String(stats.wrong)} accent="red" />
        <Row label="Среднее время определения" value={formatDuration(avgSec)} />
        {saveStatus !== 'pending' && (
          <p className={saveStatus === 'saved' ? styles.saved : styles.saveError} role="status">
            {saveStatus === 'saved'
              ? 'Результаты сохранены в разделе «Профиль»'
              : 'Не удалось сохранить результаты: нет связи с сервером'}
          </p>
        )}
        <button className={styles.ok} onClick={onClose}>✓ OK</button>
      </div>
    </div>
  );
};
