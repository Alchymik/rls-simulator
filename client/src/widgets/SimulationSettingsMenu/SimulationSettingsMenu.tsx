// client/src/widgets/SimulationSettingsMenu/SimulationSettingsMenu.tsx
import { useState } from 'react';
import { useSettingsStore } from '@/features/settings/model/settingsStore';
import styles from './SimulationSettingsMenu.module.css';

interface Props {
  onClose: () => void;
  onExit: () => void;
  /** Сохранить текущий вид карты как домашнюю позицию (координаты берёт страница) */
  onSaveHome: () => void;
}

/** Меню настроек симуляции: карта, зоны, выход из режима (п.3.3.2.1 ТЗ). */
export const SimulationSettingsMenu = ({ onClose, onExit, onSaveHome }: Props) => {
  const map = useSettingsStore((s) => s.map);
  const setMap = useSettingsStore((s) => s.setMap);
  const [homeSaved, setHomeSaved] = useState(false);

  const saveHome = () => {
    onSaveHome();
    setHomeSaved(true);
  };

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <aside className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <h3>Настройки симуляции</h3>
          <button className={styles.close} onClick={onClose} aria-label="Закрыть настройки симуляции">✕</button>
        </header>

        <section className={styles.block}>
          <h4>Настройка карты</h4>
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
            <span>Показывать направление движения</span>
          </label>
          <button className={styles.action} onClick={saveHome}>
            Сделать текущий вид домашним
          </button>
          {homeSaved && <p className={styles.hint}>Домашняя позиция обновлена</p>}
        </section>

        <section className={styles.block}>
          <h4>Настройка зон</h4>
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

        <button className={styles.exit} onClick={onExit}>Выйти из режима «Тренировка»</button>
      </aside>
    </div>
  );
};
