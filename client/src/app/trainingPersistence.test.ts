import { afterEach, beforeEach, expect, it, vi } from 'vitest';
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
  vi.stubGlobal(
    'window',
    Object.assign(new EventTarget(), { localStorage, location: new URL('http://localhost/') }),
  );
  vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }));
});
vi.mock('@/features/sessions/api/sessionsApi', () => ({ saveSession: vi.fn() }));
vi.mock('@/features/events/lib/captureScreenshot', () => ({ captureScreenshot: vi.fn() }));
import { installTrainingPersistence } from './trainingPersistence';
import './resetOnSignOut';
import { useSimulationStore as simulation } from '@/features/simulation/model/simulationStore';
import { useAuthStore as auth } from '@/features/auth/model/authStore';
import { useSessionQueue } from '@/features/sessions/model/pendingSession';
import { saveSession } from '@/features/sessions/api/sessionsApi';
let dispose: () => void;

beforeEach(() => {
  localStorage.clear();
  simulation.getState().reset();
  useSessionQueue.setState({ entries: [], saving: {}, saved: [], storageError: null });
  auth.setState({
    user: { id: 'A', login: 'a', displayName: 'A', role: 'operator', mustChangePassword: false },
    token: 'session-A',
    verified: true,
  });
  vi.mocked(saveSession).mockReset().mockRejectedValue(new Error('offline'));
  dispose = installTrainingPersistence();
});

afterEach(() => dispose());

it('retains a failed finished result after leaving the page', async () => {
  simulation.getState().start({}, 'A');
  simulation.getState().tick(1);
  simulation.getState().finish();
  simulation.getState().reset();
  await vi.waitFor(() => expect(saveSession).toHaveBeenCalledTimes(1));
  expect(useSessionQueue.getState().entries[0]).toMatchObject({
    userId: 'A',
    ready: true,
    payload: { durationSec: 1 },
  });
});

it('seals the old account result on logout without sending it as another user', () => {
  simulation.getState().start({}, 'A');
  simulation.getState().tick(1);
  auth.getState().logout();
  auth.setState({
    user: { id: 'B', login: 'b', displayName: 'B', role: 'operator', mustChangePassword: false },
    token: 'session-B',
    verified: true,
  });
  expect(useSessionQueue.getState().entries[0]).toMatchObject({ userId: 'A', ready: true });
  expect(saveSession).not.toHaveBeenCalled();
});

it('checkpoints active progress and seals it synchronously on pagehide', () => {
  simulation.getState().start({}, 'A');
  simulation.getState().tick(5);
  expect(useSessionQueue.getState().entries[0]).toMatchObject({ ready: false, payload: { durationSec: 5 } });
  window.dispatchEvent(new Event('pagehide'));
  expect(useSessionQueue.getState().entries[0]?.ready).toBe(true);
  expect(localStorage.getItem(localStorage.key(0) ?? '')).not.toBeNull();
});

it('pauses without spending simulation time when the window is hidden', () => {
  simulation.getState().start({}, 'A');
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  simulation.getState().tick(20);
  expect(simulation.getState().status).toBe('paused');
  expect(simulation.getState().elapsedSec).toBe(0);
});
