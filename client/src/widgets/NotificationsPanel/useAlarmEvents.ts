import { useEffect, useRef } from 'react';
import { useSimulationStore } from '@/features/simulation/model/simulationStore';
import { useSettingsStore } from '@/features/settings/model/settingsStore';
import { useEventsStore } from '@/features/events/model/eventsStore';
import { useUiStore } from '@/features/simulation/model/uiStore';
import { playAlert } from '@/shared/lib/sound';

/**
 * Конвейер тревожного события: звуковой сигнал об обнаружении цели в зоне обнаружения,
 * визуальное уведомление и снимок экрана в архив событий (п.3.3.1.3, п.3.1 ТЗ).
 * Живёт в layout, а не в панели: события фиксируются и при закрытом центре уведомлений.
 */
export const useAlarmEvents = () => {
  const latest = useSimulationStore((s) => s.notifications[0]);
  const soundEnabled = useSettingsStore((s) => s.sound.enabled);
  const volume = useSettingsStore((s) => s.sound.volume);
  const archiveDetection = useEventsStore((s) => s.archiveDetection);
  // Начальное значение — уже существующее уведомление: повторный монтирование не переигрывает сигнал,
  // но первое уведомление новой сессии обрабатывается штатно.
  const seenRef = useRef<string | undefined>(latest?.id);

  useEffect(() => {
    if (!latest) {
      seenRef.current = undefined;
      return;
    }
    if (seenRef.current === latest.id) return;
    seenRef.current = latest.id;

    if (soundEnabled) playAlert(volume);
    useUiStore.getState().openNotifications();

    // Отметки для снимка: цель тревоги плюс остальные видимые цели, чтобы кадр отражал обстановку
    const visible = useSimulationStore
      .getState()
      .targets.filter((t) => !t.insideIgnoreZone && t.id !== latest.targetId)
      .map((t) => ({ lat: t.position.lat, lng: t.position.lng }));

    void archiveDetection(
      {
        at: latest.at,
        targetId: latest.targetId,
        sector: latest.sector,
        speedKmh: latest.speedKmh,
        lat: latest.lat,
        lng: latest.lng,
      },
      [
        {
          lat: latest.lat,
          lng: latest.lng,
          accent: true,
          label: `Сектор «${latest.sector}» · ${latest.speedKmh} км/ч`,
        },
        ...visible,
      ],
    );
  }, [latest, soundEnabled, volume, archiveDetection]);
};
