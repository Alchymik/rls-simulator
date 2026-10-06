import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';

let server: Server;
let base = '';
let dataDir = '';
let adminToken = '';
let adminPassword = '';
let operatorToken = '';
let traineeToken = '';
let sessionId = '';
let savedEventId = '';

const startServer = async () => {
  const app = await createApp({ dataDir });
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
};

const stopServer = async () =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

const call = (url: string, init: RequestInit & { token?: string } = {}) =>
  fetch(`${base}${url}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
  });

const login = async (loginName: string, password: string) => {
  const response = await call('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login: loginName, password }),
  });
  if (!response.ok) throw new Error(`Login failed with status ${response.status}`);
  return ((await response.json()) as { token: string }).token;
};

const changePassword = async (token: string, currentPassword: string, newPassword: string) => {
  const response = await call('/api/auth/password', {
    method: 'POST',
    token,
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return {
    response,
    body: (await response.json()) as { token: string; user: { mustChangePassword: boolean } },
  };
};

const createSessionPayload = (overrides: Record<string, unknown> = {}) => ({
  sessionId,
  mode: 'training',
  startedAt: Date.now() - 10_000,
  finishedAt: Date.now(),
  durationSec: 8,
  markedTotal: 1,
  correct: 1,
  wrong: 0,
  points: [{ t: 5, reactionMs: 4_000, correct: true }],
  ...overrides,
});

beforeAll(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), 'rls-api-test-'));
  sessionId = 'session-test-0001';
  await startServer();
});

afterAll(async () => {
  await stopServer();
  await rm(dataDir, { recursive: true, force: true });
});

describe('server API and persisted repository', () => {
  it('requires the bootstrap password to change and invalidates the old token', async () => {
    const initialToken = await login('ADMIN', 'admin');
    const meResponse = await call('/api/auth/me', { token: initialToken });
    expect(meResponse.status).toBe(200);
    expect(((await meResponse.json()) as { mustChangePassword: boolean }).mustChangePassword).toBe(true);
    expect((await call('/api/users', { token: initialToken })).status).toBe(403);

    const changed = await changePassword(initialToken, 'admin', 'admin-password-1');
    expect(changed.response.status).toBe(200);
    expect(changed.body.user.mustChangePassword).toBe(false);
    adminToken = changed.body.token;
    adminPassword = 'admin-password-1';
    expect((await call('/api/auth/me', { token: initialToken })).status).toBe(401);
    expect((await call('/api/users', { token: adminToken })).status).toBe(200);

    const tooManyUtf8Bytes = 'я'.repeat(37);
    expect((await changePassword(adminToken, 'admin-password-1', tooManyUtf8Bytes)).response.status).toBe(
      400,
    );

    const initialOperatorToken = await login('operator', 'operator');
    expect((await call('/api/sessions', { token: initialOperatorToken })).status).toBe(403);
    expect((await call('/api/events', { token: initialOperatorToken })).status).toBe(403);
    const operatorChanged = await changePassword(initialOperatorToken, 'operator', 'operator-password-1');
    operatorToken = operatorChanged.body.token;
  });

  it('serializes simultaneous password changes and returns one replacement token', async () => {
    const previousToken = adminToken;
    const candidates = ['admin-password-2a', 'admin-password-2b'];
    const responses = await Promise.all(
      candidates.map((newPassword) =>
        call('/api/auth/password', {
          method: 'POST',
          token: previousToken,
          body: JSON.stringify({ currentPassword: adminPassword, newPassword }),
        }),
      ),
    );
    const results = await Promise.all(
      responses.map(async (response) => ({
        status: response.status,
        body: (await response.json()) as { token?: string },
      })),
    );
    const succeeded = results.find((result) => result.status === 200);
    expect(succeeded?.body.token).toBeTruthy();
    expect(
      results
        .filter((result) => result.status !== 200)
        .every((result) => result.status === 401 || result.status === 409),
    ).toBe(true);
    adminToken = succeeded!.body.token!;
    adminPassword = candidates[results.findIndex((result) => result === succeeded)]!;
    expect((await call('/api/auth/me', { token: previousToken })).status).toBe(401);
  });

  it('rejects malformed JSON and returns JSON for unknown API routes', async () => {
    expect((await call('/api/auth/login', { method: 'POST', body: '{bad' })).status).toBe(400);
    const missing = await call('/api/nope');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ message: 'Not found' });
  });

  it('blocks operators from user administration and races duplicate case-insensitive logins safely', async () => {
    const createOperator = await call('/api/users', {
      method: 'POST',
      token: adminToken,
      body: JSON.stringify({
        login: 'trainee',
        password: 'trainee-password',
        displayName: 'Trainee',
        role: 'operator',
      }),
    });
    expect(createOperator.status).toBe(201);

    const traineeInitialToken = await login('TRAINEE', 'trainee-password');
    expect((await call('/api/users', { token: traineeInitialToken })).status).toBe(403);
    const traineeChanged = await changePassword(
      traineeInitialToken,
      'trainee-password',
      'trainee-password-new',
    );
    traineeToken = traineeChanged.body.token;
    expect((await call('/api/users', { token: traineeToken })).status).toBe(403);

    const create = (loginName: string) =>
      call('/api/users', {
        method: 'POST',
        token: adminToken,
        body: JSON.stringify({
          login: loginName,
          password: 'duplicate-password',
          displayName: loginName,
          role: 'operator',
        }),
      });
    const responses = await Promise.all([create('CaseUser'), create('caseuser')]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
  });

  it('validates all session counters and time bounds', async () => {
    const invalid = await call('/api/sessions', {
      method: 'POST',
      token: operatorToken,
      body: JSON.stringify(
        createSessionPayload({ correct: 0, points: [{ t: 5, reactionMs: 5_001, correct: false }] }),
      ),
    });
    expect(invalid.status).toBe(400);

    const invalidCalendarTime = await call('/api/sessions', {
      method: 'POST',
      token: operatorToken,
      body: JSON.stringify(createSessionPayload({ startedAt: Date.now() + 100_000 })),
    });
    expect(invalidCalendarTime.status).toBe(400);

    const delayed = await call('/api/sessions', {
      method: 'POST',
      token: operatorToken,
      body: JSON.stringify(
        createSessionPayload({ sessionId: 'delayed-session', startedAt: Date.now() - 26 * 60 * 60_000 }),
      ),
    });
    expect(delayed.status).toBe(201);
  });

  it('accepts the maximum training result body and saves by stable idempotency key', async () => {
    const manyPoints = Array.from({ length: 12_001 }, () => ({ t: 0, reactionMs: 0, correct: true }));
    const maxPayload = createSessionPayload({
      startedAt: Date.now() - 3_610_000,
      durationSec: 3_600,
      markedTotal: manyPoints.length,
      correct: manyPoints.length,
      wrong: 0,
      points: manyPoints,
    });
    const first = await call('/api/sessions', {
      method: 'POST',
      token: operatorToken,
      body: JSON.stringify(maxPayload),
    });
    expect(first.status).toBe(201);
    const firstBody = (await first.json()) as { id: string; sessionId: string; userId: string };
    expect(firstBody.sessionId).toBe(sessionId);

    const repeated = await call('/api/sessions', {
      method: 'POST',
      token: operatorToken,
      body: JSON.stringify(maxPayload),
    });
    expect(repeated.status).toBe(200);
    expect(((await repeated.json()) as { id: string }).id).toBe(firstBody.id);

    const altered = await call('/api/sessions', {
      method: 'POST',
      token: operatorToken,
      body: JSON.stringify({ ...maxPayload, durationSec: 3_599 }),
    });
    expect(altered.status).toBe(409);

    const operatorResponse = await call('/api/auth/me', { token: operatorToken });
    expect(((await operatorResponse.json()) as { id: string }).id).toBe(firstBody.userId);
  });

  it('persists users, sessions, events and token verification across a server restart', async () => {
    const event = await call('/api/events', {
      method: 'POST',
      token: operatorToken,
      body: JSON.stringify({
        at: Date.now(),
        targetId: 'target-1',
        sector: 'Север',
        speedKmh: 18,
        lat: 59.55,
        lng: 30.8,
        screenshot: '',
        thumbnail: '',
      }),
    });
    expect(event.status).toBe(201);
    savedEventId = ((await event.json()) as { id: string }).id;

    await stopServer();
    await startServer();
    expect((await call('/api/auth/me', { token: operatorToken })).status).toBe(200);
    const sessions = await call('/api/sessions', { token: operatorToken });
    expect(((await sessions.json()) as { sessionId: string }[]).map((item) => item.sessionId)).toContain(
      sessionId,
    );
    const events = await call('/api/events', { token: operatorToken });
    expect(((await events.json()) as { id: string }[]).map((item) => item.id)).toContain(savedEventId);

    // Один sessionId, переданный другим владельцем, не раскрывает исходную запись и не создаёт дубль.
    const secondUser = await call('/api/users', {
      method: 'POST',
      token: adminToken,
      body: JSON.stringify({
        login: 'other',
        password: 'other-password',
        displayName: 'Other',
        role: 'operator',
      }),
    });
    expect(secondUser.status).toBe(201);
    const otherInitial = await login('other', 'other-password');
    const otherChanged = await changePassword(otherInitial, 'other-password', 'other-password-new');
    const otherSave = await call('/api/sessions', {
      method: 'POST',
      token: otherChanged.body.token,
      body: JSON.stringify(createSessionPayload()),
    });
    expect(otherSave.status).toBe(409);
  });

  it('revokes tokens after an administrator resets another user password', async () => {
    const usersResponse = await call('/api/users', { token: adminToken });
    const trainee = ((await usersResponse.json()) as { id: string; login: string }[]).find(
      (user) => user.login === 'trainee',
    );
    expect(trainee).toBeDefined();
    const reset = await call(`/api/users/${trainee!.id}`, {
      method: 'PATCH',
      token: adminToken,
      body: JSON.stringify({ password: 'reset-password-1' }),
    });
    expect(reset.status).toBe(200);
    expect((await call('/api/auth/me', { token: traineeToken })).status).toBe(401);
    const resetToken = await login('trainee', 'reset-password-1');
    expect((await call('/api/sessions', { token: resetToken })).status).toBe(403);
  });
});
