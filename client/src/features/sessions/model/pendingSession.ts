import { create } from 'zustand';
import {
  apiErrorMessage,
  captureAuthContext,
  isAuthContextCurrent,
  isRequestCancelled,
} from '@/shared/api/client';
import { saveSession, type SaveSessionPayload } from '../api/sessionsApi';

const PREFIX = 'rls-session:';
interface PendingSession {
  userId: string;
  ready: boolean;
  payload: SaveSessionPayload;
  error?: string;
}
interface QueueState {
  entries: PendingSession[];
  saving: Record<string, number>;
  saved: string[];
  storageError: string | null;
}
export const useSessionQueue = create<QueueState>(() => ({
  entries: [],
  saving: {},
  saved: [],
  storageError: null,
}));
const recordKey = (entry: Pick<PendingSession, 'userId' | 'payload'>) =>
  `${PREFIX}${entry.userId}:${entry.payload.sessionId}`;
const inFlight = new Map<string, Promise<void>>();

const remember = (entry: PendingSession) =>
  useSessionQueue.setState((state) => ({
    entries: [...state.entries.filter((item) => recordKey(item) !== recordKey(entry)), entry],
  }));
const persist = (entry: PendingSession): boolean => {
  try {
    localStorage.setItem(recordKey(entry), JSON.stringify(entry));
    useSessionQueue.setState({ storageError: null });
    return true;
  } catch {
    useSessionQueue.setState({
      storageError:
        'Не удалось записать результат на устройстве. Не закрывайте приложение; освободите место и повторите сохранение.',
    });
    return false;
  }
};

/** Snapshot is copied synchronously; later ticks cannot change a queued result. */
export const checkpointSession = (userId: string, payload: SaveSessionPayload, ready: boolean) => {
  const key = recordKey({ userId, payload });
  const state = useSessionQueue.getState();
  if (state.saved.includes(key) || state.entries.some((entry) => recordKey(entry) === key && entry.ready))
    return;
  const entry = { userId, ready, payload: structuredClone(payload) };
  remember(entry);
  persist(entry);
};

const parseEntry = (raw: string): PendingSession => {
  const entry = JSON.parse(raw) as PendingSession;
  if (
    !entry ||
    typeof entry.userId !== 'string' ||
    typeof entry.ready !== 'boolean' ||
    !entry.payload ||
    typeof entry.payload.sessionId !== 'string' ||
    !Array.isArray(entry.payload.points)
  ) {
    throw new Error('Invalid pending session');
  }
  return entry;
};

/** Only abandoned drafts are sealed on recovery; the current live session stays local. */
export const restorePendingSessions = (userId: string, liveSessionId?: string) => {
  try {
    const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index));
    for (const key of keys) {
      if (!key?.startsWith(PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const entry = parseEntry(raw);
      if (recordKey(entry) !== key) throw new Error('Invalid pending session key');
      if (entry.userId !== userId) continue;
      if (!entry.ready && entry.payload.sessionId !== liveSessionId) {
        entry.ready = true;
        persist(entry);
      }
      remember(entry);
    }
    // Upgrade the single-slot queue from the reviewed patch without dropping its result.
    const raw = localStorage.getItem('rls-pending-session');
    if (raw) {
      const legacy = JSON.parse(raw) as { userId: string; payload: SaveSessionPayload };
      if (legacy.userId === userId && legacy.payload?.startedAt) {
        const payload = {
          ...legacy.payload,
          sessionId: `legacy-${legacy.payload.startedAt}`,
          finishedAt: legacy.payload.startedAt + legacy.payload.durationSec * 1000,
        };
        checkpointSession(userId, payload, true);
        if (localStorage.getItem(recordKey({ userId, payload })))
          localStorage.removeItem('rls-pending-session');
      }
    }
  } catch {
    useSessionQueue.setState({
      storageError: 'Не удалось прочитать локальную очередь результатов. Записи сохранены на устройстве.',
    });
  }
};

export const flushPendingSessions = (userId: string): Promise<void> => {
  const context = captureAuthContext();
  if (!context.token) return Promise.resolve();
  const runKey = `${context.generation}:${userId}`;
  const existing = inFlight.get(runKey);
  if (existing) return existing;
  const pending = useSessionQueue
    .getState()
    .entries.filter((entry) => entry.userId === userId && entry.ready);
  const request = (async () => {
    for (const entry of pending) {
      if (!isAuthContextCurrent(context)) break;
      const key = recordKey(entry);
      useSessionQueue.setState((state) => ({ saving: { ...state.saving, [key]: context.generation } }));
      try {
        await saveSession(entry.payload, context);
        if (!isAuthContextCurrent(context)) break;
        localStorage.removeItem(key);
        useSessionQueue.setState((state) => ({
          entries: state.entries.filter((item) => recordKey(item) !== key),
          saved: [...state.saved, key].slice(-100),
        }));
      } catch (error) {
        if (!isAuthContextCurrent(context) || isRequestCancelled(error)) break;
        remember({
          ...entry,
          error: apiErrorMessage(
            error,
            'Не удалось отправить результат. Он сохранён на устройстве; повторите попытку.',
          ),
        });
        break;
      } finally {
        useSessionQueue.setState((state) => {
          if (state.saving[key] !== context.generation) return state;
          const saving = { ...state.saving };
          delete saving[key];
          return { saving };
        });
      }
    }
  })().finally(() => {
    inFlight.delete(runKey);
  });
  inFlight.set(runKey, request);
  return request;
};

export const sessionQueueKey = (userId: string, sessionId: string) => `${PREFIX}${userId}:${sessionId}`;
