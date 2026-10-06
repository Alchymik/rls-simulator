// client/src/widgets/TopBar/TopBar.tsx
import { useLocation } from 'react-router';
import { useSimulationStore } from '@/features/simulation/model/simulationStore';
import { useUiStore } from '@/features/simulation/model/uiStore';
import { useNow } from '@/shared/lib/useNow';
import { formatDate, formatTime } from '@/shared/lib/format';
import styles from './TopBar.module.css';

export const TopBar = () => {
  const { pathname } = useLocation();
  const inSimulation = pathname === '/simulation' || pathname.startsWith('/simulation/');

  const status = useSimulationStore((s) => s.status);
  // Целые секунды: панель перерисовывается раз в секунду, а не на каждом кадре
  const elapsedSec = useSimulationStore((s) => Math.floor(s.elapsedSec));
  const pause = useSimulationStore((s) => s.pause);
  const resume = useSimulationStore((s) => s.resume);
  const finish = useSimulationStore((s) => s.finish);
  const notificationCount = useSimulationStore((s) => s.notifications.length);

  const notificationsOpen = useUiStore((s) => s.notificationsOpen);
  const toggleNotifications = useUiStore((s) => s.toggleNotifications);
  const settingsMenuOpen = useUiStore((s) => s.settingsMenuOpen);
  const toggleSettingsMenu = useUiStore((s) => s.toggleSettingsMenu);

  const now = useNow(1000);

  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
  const ss = String(elapsedSec % 60).padStart(2, '0');

  // Досрочное завершение сохраняет результат и показывает окно результатов, как по истечении времени
  const finishEarly = () => {
    if (window.confirm('Завершить тренировку досрочно? Результат будет сохранён.')) finish();
  };
  const active = status === 'running' || status === 'paused';

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
            {/* Новый сеанс запускается только из основного меню через окно настроек (п.3.3 ТЗ, п.1–2) */}
            {status === 'running' && (
              <button className={styles.pause} onClick={pause}>
                ❚❚ Пауза
              </button>
            )}
            {status === 'paused' && (
              <button className={styles.start} onClick={resume}>
                ▶ Продолжить
              </button>
            )}
            <div className={styles.timer}>
              ⏱ {mm}:{ss}
            </div>
            <button className={styles.reset} onClick={finishEarly} disabled={!active}>
              ■ Завершить
            </button>
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
