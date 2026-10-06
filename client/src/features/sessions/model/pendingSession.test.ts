import { beforeEach, expect, it, vi } from 'vitest';
vi.hoisted(() => {
  const memory = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    get length() {
      return memory.size;
    },
    key: (i: number) => [...memory.keys()][i] ?? null,
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
    clear: () => memory.clear(),
  });
});
vi.mock('../api/sessionsApi', () => ({ saveSession: vi.fn() }));
import { saveSession } from '../api/sessionsApi';
import {
  checkpointSession,
  flushPendingSessions,
  restorePendingSessions,
  useSessionQueue,
} from './pendingSession';
import { invalidateAuthRequests, setAuthHandlers } from '@/shared/api/client';
import type { SessionResult } from '@/entities/session/types';

const payload = {
  sessionId: 'session-one',
  mode: 'training' as const,
  startedAt: 1000,
  finishedAt: 11_000,
  durationSec: 10,
  markedTotal: 1,
  correct: 1,
  wrong: 0,
  points: [{ t: 1, reactionMs: 500, correct: true }],
};
const result: SessionResult = { ...payload, id: 'saved', userId: 'A' };
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
beforeEach(() => {
  localStorage.clear();
  useSessionQueue.setState({ entries: [], saving: {}, saved: [], storageError: null });
  invalidateAuthRequests();
  setAuthHandlers({ getToken: () => 'token-A', onUnauthorized: () => undefined });
  vi.mocked(saveSession).mockReset().mockResolvedValue(result);
});
it('coalesces simultaneous flush calls and retains another account result', async () => {
  const saved = deferred<SessionResult>();
  vi.mocked(saveSession).mockReturnValue(saved.promise);
  checkpointSession('A', payload, true);
  checkpointSession('B', { ...payload, sessionId: 'session-b' }, true);
  const a = flushPendingSessions('A');
  const b = flushPendingSessions('A');
  expect(saveSession).toHaveBeenCalledTimes(1);
  saved.resolve(result);
  await Promise.all([a, b]);
  expect(useSessionQueue.getState().entries.map((entry) => entry.userId)).toEqual(['B']);
});
it('never removes a different result queued during a POST', async () => {
  const saved = deferred<SessionResult>();
  vi.mocked(saveSession).mockReturnValueOnce(saved.promise);
  checkpointSession('A', payload, true);
  const flush = flushPendingSessions('A');
  checkpointSession('A', { ...payload, sessionId: 'session-two' }, true);
  saved.resolve(result);
  await flush;
  expect(useSessionQueue.getState().entries.some((entry) => entry.payload.sessionId === 'session-two')).toBe(
    true,
  );
});
it('recovers a checkpoint after a reload and keeps the payload immutable', async () => {
  const draft = { ...payload, points: [...payload.points] };
  checkpointSession('A', draft, false);
  draft.points.push({ t: 2, reactionMs: 1, correct: false });
  useSessionQueue.setState({ entries: [] });
  restorePendingSessions('A');
  await flushPendingSessions('A');
  expect(vi.mocked(saveSession).mock.calls[0]?.[0].points).toHaveLength(1);
});
it('preserves a failed completed result and retries it with the same ID', async () => {
  vi.mocked(saveSession).mockRejectedValueOnce(new Error('offline'));
  checkpointSession('A', payload, true);
  await flushPendingSessions('A');
  expect(useSessionQueue.getState().entries).toHaveLength(1);
  expect(useSessionQueue.getState().entries[0]?.error).toBeTruthy();
  await flushPendingSessions('A');
  expect(useSessionQueue.getState().entries).toHaveLength(0);
  expect(vi.mocked(saveSession).mock.calls.map(([entry]) => entry.sessionId)).toEqual([
    'session-one',
    'session-one',
  ]);
});
it('does not send the next old-account result after logout during upload', async () => {
  const saved = deferred<SessionResult>();
  vi.mocked(saveSession).mockReturnValueOnce(saved.promise);
  checkpointSession('A', payload, true);
  checkpointSession('A', { ...payload, sessionId: 'session-two' }, true);
  const flush = flushPendingSessions('A');
  invalidateAuthRequests();
  saved.resolve(result);
  await flush;
  expect(saveSession).toHaveBeenCalledTimes(1);
  expect(useSessionQueue.getState().entries).toHaveLength(2);
});
