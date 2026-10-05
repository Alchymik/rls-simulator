// client/src/pages/Simulation/Simulation.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { Map as LeafletMap } from 'leaflet';
import { RadarMap } from '@/widgets/Map/RadarMap';
import { MapControls } from '@/widgets/MapControls/MapControls';
import { SimulationSettingsMenu } from '@/widgets/SimulationSettingsMenu/SimulationSettingsMenu';
import { ResultsModal, type SaveStatus } from '@/widgets/ResultsModal/ResultsModal';
import { useSimulationStore } from '@/features/simulation/model/simulationStore';
import { useSimulationLoop } from '@/features/simulation/model/useSimulationLoop';
import { useUiStore } from '@/features/simulation/model/uiStore';
import { useSettingsStore } from '@/features/settings/model/settingsStore';
import { saveSession } from '@/features/sessions/api/sessionsApi';
import { useHotkey } from '@/shared/lib/useHotkey';
import { buildSessionPayload } from './lib/sessionPayload';
import styles from './Simulation.module.css';

const SimulationPage = () => {
  const navigate = useNavigate();
  const start = useSimulationStore((s) => s.start);
  const status = useSimulationStore((s) => s.status);
  const pause = useSimulationStore((s) => s.pause);
  const resume = useSimulationStore((s) => s.resume);
  const startedAt = useSimulationStore((s) => s.startedAt);
  const training = useSettingsStore((s) => s.training);
  const setMapPrefs = useSettingsStore((s) => s.setMap);
  const settingsMenuOpen = useUiStore((s) => s.settingsMenuOpen);
  const closeSettingsMenu = useUiStore((s) => s.closeSettingsMenu);

  // Итог сохранения сеанса и сеанс, для которого окно результатов уже закрыли:
  // startedAt уникален для каждого запуска, поэтому состояние не требуется сбрасывать вручную
  const [save, setSave] = useState<{ startedAt: number; status: SaveStatus } | null>(null);
  const [dismissedFor, setDismissedFor] = useState(0);
  const [map, setMap] = useState<LeafletMap | null>(null);
  useSimulationLoop();

  // Параметры сеанса берутся из окна «Настройки тренировки» (п.3.3 ТЗ, п.2)
  useEffect(() => {
    start(training);
  }, [start, training]);

  // Сохранение результатов сеанса для раздела «Профиль» (п.3.3 ТЗ, п.7)
  useEffect(() => {
    if (status !== 'finished') return;
    const s = useSimulationStore.getState();
    saveSession(buildSessionPayload(s))
      .then(() => setSave({ startedAt: s.startedAt, status: 'saved' }))
      .catch(() => setSave({ startedAt: s.startedAt, status: 'error' }));
  }, [status]);

  // Выход из режима (в том числе через боковое меню) не должен терять результаты сеанса
  useEffect(
    () => () => {
      const s = useSimulationStore.getState();
      if (s.status !== 'running' && s.status !== 'paused') return;
      if (s.stats.markedTotal > 0) {
        void saveSession(buildSessionPayload(s)).catch(() => undefined);
      }
      s.reset();
    },
    [],
  );

  // Горячие клавиши режима тренировки (п.2.3 ТЗ)
  useHotkey('Space', () => {
    if (status === 'running') pause();
    else if (status === 'paused') resume();
  });
  useHotkey('Escape', () => {
    if (settingsMenuOpen) closeSettingsMenu();
  }, settingsMenuOpen);

  const showResults = status === 'finished' && dismissedFor !== startedAt;
  const saveStatus: SaveStatus = save?.startedAt === startedAt ? save.status : 'pending';

  const saveHome = () => {
    if (!map) return;
    const center = map.getCenter();
    setMapPrefs({ home: { lat: center.lat, lng: center.lng, zoom: map.getZoom() } });
  };

  const exitToMenu = () => {
    closeSettingsMenu();
    // Сеанс завершает и сохраняет очистка эффекта при размонтировании страницы
    void navigate('/');
  };

  return (
    <div className={styles.root}>
      <RadarMap onReady={setMap} />
      <MapControls map={map} />
      {settingsMenuOpen && (
        <SimulationSettingsMenu
          onClose={closeSettingsMenu}
          onExit={exitToMenu}
          onSaveHome={saveHome}
        />
      )}
      {showResults && <ResultsModal saveStatus={saveStatus} onClose={() => setDismissedFor(startedAt)} />}
    </div>
  );
};

export default SimulationPage;
