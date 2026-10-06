import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');

test('bundled backend reports its real port and shuts down through IPC', { timeout: 15_000 }, async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'rls-bundle-'));
  const child = fork(path.join(root, 'server/dist-desktop/index.cjs'), [], {
    env: {
      ...process.env,
      PORT: '0',
      RLS_DATA_DIR: dataDir,
      RLS_CLIENT_DIR: path.join(dataDir, 'no-renderer'),
    },
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  });
  let errors = '';
  child.stderr.on('data', (chunk) => {
    errors += chunk;
  });
  try {
    const ready = await Promise.race([
      once(child, 'message').then(([message]) => message),
      once(child, 'exit').then(([code]) => {
        throw new Error(`Backend exited ${code}: ${errors}`);
      }),
    ]);
    assert.equal(ready.type, 'server-ready');
    assert.equal(ready.host, '127.0.0.1');
    assert.ok(Number.isInteger(ready.port) && ready.port > 0);
    const origin = `http://${ready.host}:${ready.port}`;
    const health = await fetch(`${origin}/api/health`);
    assert.deepEqual(await health.json(), { ok: true });
    assert.equal((await fetch(`${origin}/api/users`)).status, 401);
    const exit = once(child, 'exit');
    child.send({ type: 'shutdown' });
    const [code] = await exit;
    assert.equal(code, 0, errors);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exit = once(child, 'exit');
      child.kill();
      await exit;
    }
    await rm(dataDir, { recursive: true, force: true });
  }
});
