// client/src/features/sessions/api/sessionsApi.ts
import { api, authRequestConfig, captureAuthContext } from '@/shared/api/client';
import type { ReactionPoint, SessionResult } from '@/entities/session/types';

/** Тело запроса на сохранение результатов сеанса (после тренировки, п.3.3 ТЗ, п.7). */
export interface SaveSessionPayload {
  sessionId: string;
  finishedAt: number;
  mode: 'training';
  startedAt: number;
  durationSec: number;
  markedTotal: number;
  correct: number;
  wrong: number;
  points: ReactionPoint[];
}

export const fetchSessions = (context = captureAuthContext()) =>
  api.get<SessionResult[]>('/sessions', authRequestConfig(context)).then((r) => r.data);

export const saveSession = (payload: SaveSessionPayload, context = captureAuthContext()) =>
  api.post<SessionResult>('/sessions', payload, authRequestConfig(context)).then((r) => r.data);
