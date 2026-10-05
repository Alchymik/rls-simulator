// client/src/features/sessions/api/sessionsApi.ts
import { api } from '@/shared/api/client';
import type { ReactionPoint, SessionResult } from '@/entities/session/types';

/** Тело запроса на сохранение результатов сеанса (после тренировки, п.3.3 ТЗ, п.7). */
export interface SaveSessionPayload {
  mode: 'training';
  durationSec: number;
  markedTotal: number;
  correct: number;
  wrong: number;
  points: ReactionPoint[];
}

export const fetchSessions = () => api.get<SessionResult[]>('/sessions').then((r) => r.data);

export const saveSession = (payload: SaveSessionPayload) =>
  api.post<SessionResult>('/sessions', payload).then((r) => r.data);
