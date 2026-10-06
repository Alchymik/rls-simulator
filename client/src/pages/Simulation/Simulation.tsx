import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import type { Map as LeafletMap } from 'leaflet';
import { RadarMap } from '@/widgets/Map/RadarMap';
import { MapControls } from '@/widgets/MapControls/MapControls';
import { SimulationSettingsMenu } from '@/widgets/SimulationSettingsMenu/SimulationSettingsMenu';
import { ResultsModal, type SaveStatus } from '@/widgets/ResultsModal/ResultsModal';
import { useSimulationStore } from '@/features/simulation/model/simulationStore';
import { useSimulationLoop } from '@/features/simulation/model/useSimulationLoop';
import { useUiStore } from '@/features/simulation/model/uiStore';
import { useSettingsStore } from '@/features/settings/model/settingsStore';
import {
  flushPendingSessions,
  sessionQueueKey,
  useSessionQueue,
} from '@/features/sessions/model/pendingSession';
import { useHotkey } from '@/shared/lib/useHotkey';
import styles from './Simulation.module.css';

const SimulationPage = () => {
  const navigate = useNavigate();
  const status = useSimulationStore((s) => s.status);
  const sessionId = useSimulationStore((s) => s.sessionId);
  const ownerId = useSimulationStore((s) => s.ownerId);
  const targets = useSimulationStore((s) => s.targets);
  const identify = useSimulationStore((s) => s.identify);
  const pause = useSimulationStore((s) => s.pause);
  const resume = useSimulationStore((s) => s.resume);
  const setMapPrefs = useSettingsStore((s) => s.setMap);
  const settingsMenuOpen = useUiStore((s) => s.settingsMenuOpen);
  const closeSettingsMenu = useUiStore((s) => s.closeSettingsMenu);
  const queueKey = sessionQueueKey(ownerId ?? '', sessionId);
  const pending = useSessionQueue((s) =>
    s.entries.find((entry) => entry.payload.sessionId === sessionId && entry.userId === ownerId),
  );
  const saving = useSessionQueue((s) => s.saving[queueKey] !== undefined);
  const saved = useSessionQueue((s) => s.saved.includes(queueKey));
  const storageError = useSessionQueue((s) => s.storageError);
  const [dismissedFor, setDismissedFor] = useState('');
  const [map, setMap] = useState<LeafletMap | null>(null);
  useSimulationLoop();
  useHotkey('Space', () => {
    if (status === 'running') pause();
    else if (status === 'paused') resume();
  });

  if (status === 'idle') return <Navigate to="/" replace />;
  const saveStatus: SaveStatus = saved
    ? 'saved'
    : saving
      ? 'pending'
      : pending?.error || storageError
        ? 'error'
        : 'pending';
  const saveHome = () => {
    if (!map) return;
    const center = map.getCenter();
    setMapPrefs({ home: { lat: center.lat, lng: center.lng, zoom: map.getZoom() } });
  };
  const exitToMenu = () => {
    useSimulationStore.getState().finish();
    closeSettingsMenu();
    void navigate('/');
  };

  return (
    <div className={styles.root}>
      <RadarMap targets={targets} onIdentify={status === 'running' ? identify : undefined} onReady={setMap} />
      <MapControls map={map} />
      {settingsMenuOpen && (
        <SimulationSettingsMenu onClose={closeSettingsMenu} onExit={exitToMenu} onSaveHome={saveHome} />
      )}
      {status === 'finished' && dismissedFor !== sessionId && (
        <ResultsModal
          saveStatus={saveStatus}
          error={pending?.error ?? storageError}
          onRetry={() => {
            if (ownerId) void flushPendingSessions(ownerId);
          }}
          onClose={() => setDismissedFor(sessionId)}
        />
      )}
    </div>
  );
};
export default SimulationPage;
