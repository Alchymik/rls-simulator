import { useAuthStore } from '@/features/auth/model/authStore';
import {
  checkpointSession,
  flushPendingSessions,
  useSessionQueue,
} from '@/features/sessions/model/pendingSession';
import { useSimulationStore } from '@/features/simulation/model/simulationStore';
import { buildSessionPayload } from '@/pages/Simulation/lib/sessionPayload';

type Simulation = ReturnType<typeof useSimulationStore.getState>;
const checkpoint = (state: Simulation, ready: boolean) => {
  if (!state.sessionId || !state.ownerId) return;
  checkpointSession(state.ownerId, buildSessionPayload(state), ready);
  const { user, verified } = useAuthStore.getState();
  if (ready && verified && user?.id === state.ownerId && !user.mustChangePassword)
    void flushPendingSessions(user.id);
};

/** Persistence survives page unmounts; UI effects do not own the result. */
export const installTrainingPersistence = () => {
  const unsubscribe = useSimulationStore.subscribe((state, prev) => {
    if (state.status === 'idle') {
      if (prev.status === 'running' || prev.status === 'paused') checkpoint(prev, true);
      return;
    }
    if (state.status === 'finished') {
      if (prev.status !== 'finished') checkpoint(state, true);
      return;
    }
    if (
      state.sessionId !== prev.sessionId ||
      state.status !== prev.status ||
      state.stats.markedTotal !== prev.stats.markedTotal ||
      Math.floor(state.elapsedSec / 5) !== Math.floor(prev.elapsedSec / 5)
    ) {
      checkpoint(state, false);
      if (useSessionQueue.getState().storageError && state.status === 'running') state.pause();
    }
  });
  const pauseWhenHidden = () => {
    if (document.visibilityState === 'hidden') useSimulationStore.getState().pause();
  };
  const finishOnClose = () => useSimulationStore.getState().finish();
  document.addEventListener('visibilitychange', pauseWhenHidden);
  window.addEventListener('pagehide', finishOnClose);
  return () => {
    unsubscribe();
    document.removeEventListener('visibilitychange', pauseWhenHidden);
    window.removeEventListener('pagehide', finishOnClose);
  };
};
