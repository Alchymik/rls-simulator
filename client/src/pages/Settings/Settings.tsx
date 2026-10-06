// client/src/pages/Settings/Settings.tsx
import { useAuthStore } from '@/features/auth/model/authStore';
import { useSettingsStore } from '@/features/settings/model/settingsStore';
import { UsersPanel } from '@/widgets/UsersPanel/UsersPanel';
import { playAlert } from '@/shared/lib/sound';
import styles from './Settings.module.css';

const Settings = () => {
  const user = useAuthStore((s) => s.user);
  const map = useSettingsStore((s) => s.map);
  const setMap = useSettingsStore((s) => s.setMap);
  const sound = useSettingsStore((s) => s.sound);
  const setSound = useSettingsStore((s) => s.setSound);

  if (!user) return null;

  return (
    <div className={styles.root}>
      <h2>Настройки</h2>

      <section className={styles.card}>
        <h3>Графика</h3>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={map.showTrajectory}
            onChange={(e) => setMap({ showTrajectory: e.target.checked })}
          />
          <span>Показывать траектории целей</span>
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={map.showDirection}
            onChange={(e) => setMap({ showDirection: e.target.checked })}
          />
          <span>Показывать направление движения целей</span>
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={map.showDetectionZone}
            onChange={(e) => setMap({ showDetectionZone: e.target.checked })}
          />
          <span>Показывать зону обнаружения</span>
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={map.showIgnoreZone}
            onChange={(e) => setMap({ showIgnoreZone: e.target.checked })}
          />
          <span>Показывать зону игнорирования</span>
        </label>
      </section>

      <section className={styles.card}>
        <h3>Звук</h3>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={sound.enabled}
            onChange={(e) => setSound({ enabled: e.target.checked })}
          />
          <span>Звуковой сигнал при обнаружении цели в зоне обнаружения</span>
        </label>
        <label className={styles.range}>
          <span>Громкость</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={sound.volume}
            disabled={!sound.enabled}
            onChange={(e) => setSound({ volume: Number(e.target.value) })}
          />
          <b>{Math.round(sound.volume * 100)}%</b>
        </label>
        <button className={styles.test} onClick={() => playAlert(sound.volume)} disabled={!sound.enabled}>
          Проверить сигнал
        </button>
      </section>

      {user.role === 'admin' && <UsersPanel currentUserId={user.id} />}
    </div>
  );
};

export default Settings;
