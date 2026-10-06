import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/dist/app.js';

const dataDir = await mkdtemp(path.join(os.tmpdir(), 'rls-e2e-'));
const app = await createApp({ dataDir });
const server = app.listen(4177, '127.0.0.1');
let closing = false;
const close = () => {
  if (closing) return;
  closing = true;
  server.close(async () => {
    await rm(dataDir, { recursive: true, force: true });
    process.exit(0);
  });
  server.closeAllConnections();
};
process.on('SIGTERM', close);
process.on('SIGINT', close);
