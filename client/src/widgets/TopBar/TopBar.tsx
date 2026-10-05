// client/src/widgets/TopBar/TopBar.tsx
import { useLocation } from 'react-router';
import { useSimulationStore } from '@/features/simulation/model/simulationStore';
import { useUiStore } from '@/features/simulation/model/uiStore';
import { useSettingsStore } from '@/features/settings/model/settingsStore';
import { useNow } from '@/shared/lib/useNow';
import { formatDate, formatTime } from '@/shared/lib/format';
import styles from './TopBar.module.css';

export const TopBar = () => {
  const { pathname } = useLocation();
  const inSimulation = pathname === '/simulation' || pathname.startsWith('/simulation/');

  const status = useSimulationStore((s) => s.status);
  const elapsedSec = useSimulationStore((s) => s.elapsedSec);
  const start = useSimulationStore((s) => s.start);
  const pause = useSimulationStore((s) => s.pause);
  const resume = useSimulationStore((s) => s.resume);
  const reset = useSimulationStore((s) => s.reset);
  const notificationCount = useSimulationStore((s) => s.notifications.length);
  const training = useSettingsStore((s) => s.training);

  const notificationsOpen = useUiStore((s) => s.notificationsOpen);
  const toggleNotifications = useUiStore((s) => s.toggleNotifications);
  const settingsMenuOpen = useUiStore((s) => s.settingsMenuOpen);
  const toggleSettingsMenu = useUiStore((s) => s.toggleSettingsMenu);

  const now = useNow(1000);

  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
  const ss = String(Math.floor(elapsedSec % 60)).padStart(2, '0');

  return (
    <header className={styles.bar}>
      {inSimulation ? (
        <button
          className={styles.burger}
          onClick={toggleSettingsMenu}
          aria-label="Меню настроек симуляции"
          aria-expanded={settingsMenuOpen}
          title="Меню настроек симуляции"
        >
          ⚙
        </button>
      ) : (
        <span aria-hidden />
      )}

      <div className={styles.center}>
        {inSimulation && (
          <>
            {status !== 'running' ? (
              <button className={styles.start} onClick={() => (status === 'paused' ? resume() : start(training))}>
                ▶ {status === 'paused' ? 'Продолжить' : 'Старт'}
              </button>
            ) : (
              <button className={styles.pause} onClick={pause}>❚❚ Пауза</button>
            )}
            <div className={styles.timer}>⏱ {mm}:{ss}</div>
            <button className={styles.reset} onClick={reset}>↺ Сброс</button>
          </>
        )}
      </div>

      <div className={styles.right}>
        <div className={styles.time}>{formatTime(now)}</div>
        <div className={styles.date}>{formatDate(now)}</div>
        <button
          className={styles.bell}
          onClick={toggleNotifications}
          aria-label="Центр уведомлений"
          aria-pressed={notificationsOpen}
          title="Центр уведомлений"
        >
          🔔
          {notificationCount > 0 && <span className={styles.badge}>{notificationCount}</span>}
        </button>
      </div>
    </header>
  );
};