// client/src/widgets/NotificationsPanel/EventPreviewModal.tsx
import { useEffect, useState } from 'react';
import type { AlarmEventSummary } from '@/entities/event/types';
import { fetchEvent } from '@/features/events/api/eventsApi';
import { Dialog } from '@/shared/ui/Dialog';
import { formatCoordinates, formatDateTime } from '@/shared/lib/format';
import styles from './EventPreviewModal.module.css';

interface Props {
  event: AlarmEventSummary;
  onClose: () => void;
}

type Screenshot = { status: 'loading' } | { status: 'ready'; src: string } | { status: 'missing' };

/** Просмотр снимка экрана из архива событий (п.3.1 ТЗ). Полный снимок загружается по требованию. */
export const EventPreviewModal = ({ event, onClose }: Props) => {
  const [shot, setShot] = useState<Screenshot>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetchEvent(event.id)
      .then((full) => {
        if (!cancelled)
          setShot(full.screenshot ? { status: 'ready', src: full.screenshot } : { status: 'missing' });
      })
      .catch(() => {
        if (!cancelled) setShot({ status: 'missing' });
      });
    return () => {
      cancelled = true;
    };
  }, [event.id]);

  return (
    <Dialog className={styles.backdrop} label="Снимок экрана события" onClose={onClose}>
      <figure className={styles.figure} onClick={(e) => e.stopPropagation()}>
        {shot.status === 'ready' && (
          <img className={styles.image} src={shot.src} alt="Снимок экрана в момент обнаружения цели" />
        )}
        {shot.status === 'loading' && <p className={styles.missing}>Загрузка снимка…</p>}
        {shot.status === 'missing' && <p className={styles.missing}>Снимок экрана не был сохранён</p>}
        <figcaption className={styles.caption}>
          {formatDateTime(event.at)} · сектор «{event.sector}» · {event.speedKmh} км/ч ·{' '}
          {formatCoordinates(event.lat, event.lng)}
        </figcaption>
      </figure>
      <button className={styles.close} onClick={onClose} aria-label="Закрыть снимок">
        ✕
      </button>
    </Dialog>
  );
};
