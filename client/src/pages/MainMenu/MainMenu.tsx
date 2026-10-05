// client/src/pages/MainMenu/MainMenu.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { RadarMap } from '@/widgets/Map/RadarMap';
import { TrainingSetupModal } from '@/widgets/TrainingSetupModal/TrainingSetupModal';
import { useSettingsStore, type TrainingSettings } from '@/features/settings/model/settingsStore';
import { useSimulationStore } from '@/features/simulation/model/simulationStore';
import styles from './MainMenu.module.css';

const MainMenu = () => {
  const navigate = useNavigate();
  const training = useSettingsStore((s) => s.training);
  const setTraining = useSettingsStore((s) => s.setTraining);
  const [setupOpen, setSetupOpen] = useState(false);

  // Перед сеансом параметры задаются в окне настроек тренировки (п.3.3 ТЗ, п.2)
  const startSession = (settings: TrainingSettings) => {
    setTraining(settings);
    // Остатки прошлого сеанса не должны попадать на карту главного меню
    useSimulationStore.getState().reset();
    setSetupOpen(false);
    void navigate('/simulation');
  };

  return (
    <div className={styles.root}>
      <RadarMap />

      <div className={styles.backdrop}>
        <div className={styles.card}>
          <h3>Тренажёр оператора РЛС</h3>
          <p className={styles.hint}>Центр 2401 · режим тренировки</p>
          <button className={styles.launch} onClick={() => setSetupOpen(true)}>
            Режим «Тренировка»
          </button>
        </div>
      </div>

      {setupOpen && (
        <TrainingSetupModal
          initial={training}
          onCancel={() => setSetupOpen(false)}
          onStart={startSession}
        />
      )}
    </div>
  );
};

export default MainMenu;
