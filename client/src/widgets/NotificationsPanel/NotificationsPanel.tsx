// client/src/widgets/NotificationsPanel/NotificationsPanel.tsx
import { useRef, useState, type KeyboardEvent } from 'react';
import { useSimulationStore } from '@/features/simulation/model/simulationStore';
import { useUiStore } from '@/features/simulation/model/uiStore';
import { useEventsStore } from '@/features/events/model/eventsStore';
import type { AlarmEventSummary } from '@/entities/event/types';
import { formatCoordinates, formatDateTime } from '@/shared/lib/format';
import { EventPreviewModal } from './EventPreviewModal';
import styles from './NotificationsPanel.module.css';

const TABS = [
  { id: 'detections', label: '◎ Обнаружения' },
  { id: 'archive', label: '▤ Архив событий' },
] as const;

type Tab = (typeof TABS)[number]['id'];

/** Центр уведомлений с архивом тревожных событий (п.3.3.2.2, п.3.1 ТЗ). */
export const NotificationsPanel = () => {
  const items = useSimulationStore((s) => s.notifications);
  const clearNotifications = useSimulationStore((s) => s.clearNotifications);
  const toggleNotifications = useUiStore((s) => s.toggleNotifications);

  const events = useEventsStore((s) => s.events);
  const clearing = useEventsStore((s) => s.clearing);
  const eventsLoading = useEventsStore((s) => s.loading);
  const eventsError = useEventsStore((s) => s.error);
  const loadEvents = useEventsStore((s) => s.load);
  const clearEvents = useEventsStore((s) => s.clear);

  const [tab, setTab] = useState<Tab>('detections');
  const [preview, setPreview] = useState<AlarmEventSummary | null>(null);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ detections: null, archive: null });

  const selectTab = (next: Tab) => {
    setTab(next);
    if (next === 'archive') void loadEvents();
  };

  // Клавиатурная навигация по табам стрелками — требование паттерна ARIA tabs
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = TABS.findIndex((t) => t.id === tab);
    const next = TABS[(index + step + TABS.length) % TABS.length];
    if (!next) return;
    selectTab(next.id);
    tabRefs.current[next.id]?.focus();
  };

  const panelId = `notifications-panel-${tab}`;

  return (
    <aside className={styles.panel} aria-labelledby="notifications-title">
      <header className={styles.header}>
        <h3 id="notifications-title">Центр уведомлений</h3>
        <button
          className={styles.close}
          onClick={toggleNotifications}
          aria-label="Закрыть центр уведомлений"
          title="Закрыть"
        >
          ✕
        </button>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Разделы центра уведомлений">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            ref={(node) => {
              tabRefs.current[id] = node;
            }}
            id={`notifications-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={`notifications-panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            className={tab === id ? styles.tabActive : styles.tab}
            onClick={() => selectTab(id)}
            onKeyDown={onTabKeyDown}
          >
            {label}
          </button>
        ))}
      </div>

      {/* role="tabpanel" на обёртке: у самого <ul> нельзя отнимать роль списка */}
      <div
        className={styles.tabPanel}
        id={panelId}
        role="tabpanel"
        aria-labelledby={`notifications-tab-${tab}`}
        tabIndex={0}
      >
        <ul className={styles.list}>
          {tab === 'detections' && (
            <>
              {items.length === 0 && (
                <li className={styles.empty}>
                  Уведомлений нет. Они появятся, когда цель войдёт в зону обнаружения.
                </li>
              )}
              {items.map((n) => (
                <li key={n.id} className={styles.item}>
                  <div className={styles.top}>
                    <span className={styles.title}>Цель {n.targetId}</span>
                    <span className={styles.badge}>Обнаружение «{n.sector}»</span>
                  </div>
                  <div className={styles.meta}>
                    <span>{n.speedKmh} км/ч</span>
                    <span>{formatDateTime(n.at)}</span>
                  </div>
                  <div className={styles.coords}>{formatCoordinates(n.lat, n.lng, true)}</div>
                </li>
              ))}
            </>
          )}

          {tab === 'archive' && (
            <>
              {eventsLoading && <li className={styles.empty}>Загрузка архива…</li>}
              {eventsError && <li className={styles.error}>{eventsError}</li>}
              {!eventsLoading && !eventsError && events.length === 0 && (
                <li className={styles.empty}>
                  Архив пуст. Снимок экрана делается автоматически при обнаружении цели в зоне обнаружения.
                </li>
              )}
              {events.map((e) => (
                <li key={e.id} className={styles.item}>
                  <button
                    type="button"
                    className={styles.event}
                    onClick={() => setPreview(e)}
                    title="Открыть снимок экрана"
                  >
                    {e.thumbnail ? (
                      <img
                        className={styles.thumb}
                        src={e.thumbnail}
                        alt={`Обнаружение в секторе ${e.sector}`}
                      />
                    ) : (
                      <span className={styles.thumbEmpty}>нет снимка</span>
                    )}
                    <span className={styles.eventMeta}>
                      <b>{formatDateTime(e.at)}</b>
                      <span>
                        Сектор «{e.sector}» · {e.speedKmh} км/ч
                      </span>
                      <span className={styles.coords}>{formatCoordinates(e.lat, e.lng)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </>
          )}
        </ul>
      </div>

      {tab === 'detections' ? (
        <button className={styles.clear} onClick={clearNotifications} disabled={items.length === 0}>
          Удалить все уведомления
        </button>
      ) : (
        <button
          className={styles.clear}
          onClick={() => {
            if (window.confirm('Удалить все события архива вместе со снимками?')) void clearEvents();
          }}
          disabled={events.length === 0 || clearing}
        >
          Очистить архив
        </button>
      )}

      {preview && <EventPreviewModal key={preview.id} event={preview} onClose={() => setPreview(null)} />}
    </aside>
  );
};
