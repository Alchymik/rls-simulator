import { beforeEach, expect, it, vi } from 'vitest';
import { AxiosError, type AxiosAdapter } from 'axios';
vi.mock('../lib/captureScreenshot', () => ({ captureScreenshot: vi.fn() }));
import { captureScreenshot } from '../lib/captureScreenshot';
import { useEventsStore as events } from './eventsStore';
import { api, invalidateAuthRequests, setAuthHandlers } from '@/shared/api/client';
import type { AlarmEventSummary } from '@/entities/event/types';

const payload = { at: 1, targetId: 't1', sector: 'Север' as const, speedKmh: 100, lat: 59.55, lng: 30.8 };
const event: AlarmEventSummary = { id: 'event-1', userId: 'A', ...payload, thumbnail: '' };
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
let token = 'session-A';
const onUnauthorized = vi.fn();
beforeEach(() => {
  invalidateAuthRequests();
  token = 'session-A';
  setAuthHandlers({ getToken: () => token, onUnauthorized });
  onUnauthorized.mockClear();
  events.getState().reset();
  vi.mocked(captureScreenshot).mockReset().mockResolvedValue({ screenshot: '', thumbnail: '' });
});
it('does not upload a capture after the account changes', async () => {
  const capture = deferred<{ screenshot: string; thumbnail: string }>();
  vi.mocked(captureScreenshot).mockReturnValueOnce(capture.promise);
  const adapter = vi.fn<AxiosAdapter>((config) =>
    Promise.resolve({ status: 201, statusText: 'Created', headers: {}, config, data: event }),
  );
  api.defaults.adapter = adapter;
  const saving = events.getState().archiveDetection(payload, []);
  token = 'session-B';
  invalidateAuthRequests();
  events.getState().reset();
  capture.resolve({ screenshot: '', thumbnail: '' });
  await saving;
  expect(adapter).not.toHaveBeenCalled();
  expect(events.getState().events).toEqual([]);
});
it('discards an old GET after logout', async () => {
  const response = deferred<AlarmEventSummary[]>();
  api.defaults.adapter = async (config) => ({
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
    data: await response.promise,
  });
  const loading = events.getState().load();
  token = 'session-B';
  invalidateAuthRequests();
  events.getState().reset();
  response.resolve([event]);
  await loading;
  expect(events.getState().events).toEqual([]);
});
it('merges a newly archived event with an older GET', async () => {
  const response = deferred<AlarmEventSummary[]>();
  api.defaults.adapter = async (config) => ({
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
    data: config.method === 'get' ? await response.promise : event,
  });
  const loading = events.getState().load();
  await events.getState().archiveDetection(payload, []);
  response.resolve([]);
  await loading;
  expect(events.getState().events).toEqual([event]);
});
it('does not log out a new account on a late 401', async () => {
  const response = deferred<void>();
  api.defaults.adapter = async (config) => {
    await response.promise;
    throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      config,
      data: {},
    });
  };
  const loading = events.getState().load();
  token = 'session-B';
  invalidateAuthRequests();
  response.resolve();
  await loading;
  expect(onUnauthorized).not.toHaveBeenCalled();
});
it('captures a whole batch immediately and archives every alarm', async () => {
  let id = 0;
  api.defaults.adapter = (config) =>
    Promise.resolve({
      status: 201,
      statusText: 'Created',
      headers: {},
      config,
      data: { ...event, id: String(++id) },
    });
  const saving = events.getState().archiveDetections([payload, { ...payload, targetId: 't2' }], []);
  expect(captureScreenshot).toHaveBeenCalledTimes(1);
  await saving;
  expect(events.getState().events).toHaveLength(2);
});
it('waits for an existing POST before clearing the server archive', async () => {
  const posted = deferred<void>();
  const started = deferred<void>();
  const methods: string[] = [];
  api.defaults.adapter = async (config) => {
    methods.push(config.method ?? '');
    if (config.method === 'post') {
      started.resolve();
      await posted.promise;
    }
    return { status: 200, statusText: 'OK', headers: {}, config, data: event };
  };
  const saving = events.getState().archiveDetection(payload, []);
  await started.promise;
  const clearing = events.getState().clear();
  expect(methods).toEqual(['post']);
  posted.resolve();
  await Promise.all([saving, clearing]);
  expect(methods).toEqual(['post', 'delete']);
  expect(events.getState().events).toEqual([]);
});
