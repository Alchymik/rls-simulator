import { useEffect } from 'react';
import { useSimulationStore, type NotificationEntry } from '@/features/simulation/model/simulationStore';
import { useSettingsStore } from '@/features/settings/model/settingsStore';
import { useEventsStore } from '@/features/events/model/eventsStore';
import type { CaptureMark } from '@/features/events/lib/captureScreenshot';
import { useUiStore } from '@/features/simulation/model/uiStore';
import type { Target } from '@/entities/target/types';
import { playAlert } from '@/shared/lib/sound';

/** Отметки для снимка: цель тревоги плюс остальные видимые цели, чтобы кадр отражал обстановку */
const marksFor = (notifications: NotificationEntry[], targets: Target[]): CaptureMark[] => [
  ...notifications.map((n) => ({
    lat: n.lat,
    lng: n.lng,
    accent: true,
    label: `Цель ${n.targetId} · ${n.sector} · ${n.speedKmh} км/ч`,
  })),
  ...targets
    .filter((t) => !t.insideIgnoreZone && !notifications.some((n) => n.targetId === t.id))
    .map((t) => ({ lat: t.position.lat, lng: t.position.lng })),
];

/**
 * Конвейер тревожного события: звуковой сигнал об обнаружении цели в зоне обнаружения,
 * визуальное уведомление и снимок экрана в архив событий (п.3.3.1.3, п.3.1 ТЗ).
 * Живёт в layout, а не в панели: события фиксируются и при закрытом центре уведомлений.
 */
export const useAlarmEvents = () => {
  useEffect(() => {
    let firstAlarm = true;

    return useSimulationStore.subscribe((state, prev) => {
      if (state.sessionId !== prev.sessionId) firstAlarm = true;
      if (state.notifications === prev.notifications) return;

      // Все новые уведомления, а не только последнее: за один кадр в зону могут войти несколько целей
      const known = new Set(prev.notifications.map((n) => n.id));
      const fresh = state.notifications.filter((n) => !known.has(n.id)).reverse();
      if (!fresh.length) return;

      const { sound } = useSettingsStore.getState();
      if (sound.enabled) playAlert(sound.volume);
      // Центр уведомлений открывается при первой тревоге сеанса; закрытый оператором — не навязываем
      if (firstAlarm) {
        firstAlarm = false;
        useUiStore.getState().openNotifications();
      }

      const payloads = fresh.map((n) => ({
        at: n.at,
        targetId: n.targetId,
        sector: n.sector,
        speedKmh: n.speedKmh,
        lat: n.lat,
        lng: n.lng,
      }));
      void useEventsStore.getState().archiveDetections(payloads, marksFor(fresh, state.targets));
    });
  }, []);
};
