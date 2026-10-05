// client/src/widgets/NotificationsPanel/EventPreviewModal.tsx
import type { AlarmEvent } from '@/entities/event/types';
import { useHotkey } from '@/shared/lib/useHotkey';
import { formatCoordinates, formatDateTime } from '@/shared/lib/format';
import styles from './EventPreviewModal.module.css';

interface Props {
  event: AlarmEvent;
  onClose: () => void;
}

/** Просмотр снимка экрана из архива событий (п.3.1 ТЗ). */
export const EventPreviewModal = ({ event, onClose }: Props) => {
  useHotkey('Escape', onClose);

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Снимок экрана события"
      onClick={onClose}
    >
      <figure className={styles.figure} onClick={(e) => e.stopPropagation()}>
        {event.screenshot ? (
          <img className={styles.image} src={event.screenshot} alt="Снимок экрана в момент обнаружения цели" />
        ) : (
          <p className={styles.missing}>Снимок экрана не был сохранён</p>
        )}
        <figcaption className={styles.caption}>
          {formatDateTime(event.at)} · сектор «{event.sector}» · {event.speedKmh} км/ч ·{' '}
          {formatCoordinates(event.lat, event.lng)}
        </figcaption>
      </figure>
      <button className={styles.close} onClick={onClose} aria-label="Закрыть снимок">✕</button>
    </div>
  );
};
