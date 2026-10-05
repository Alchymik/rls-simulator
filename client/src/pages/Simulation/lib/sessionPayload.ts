// client/src/pages/Simulation/lib/sessionPayload.ts
import type { useSimulationStore } from '@/features/simulation/model/simulationStore';
import type { SaveSessionPayload } from '@/features/sessions/api/sessionsApi';

type SimulationState = ReturnType<typeof useSimulationStore.getState>;

/**
 * Тело запроса на сохранение сеанса. Используется и при завершении по времени,
 * и при выходе из режима тренировки, чтобы результаты не терялись (п.3.3 ТЗ, п.7).
 */
export const buildSessionPayload = (state: SimulationState): SaveSessionPayload => ({
  mode: 'training',
  durationSec: state.elapsedSec,
  markedTotal: state.stats.markedTotal,
  correct: state.stats.correct,
  wrong: state.stats.wrong,
  points: state.stats.reactionSamples,
});
