import { createApp } from './app.js';

const PORT = Number(process.env.PORT ?? 3001);
/**
 * Только локальный интерфейс: сервер — внутренняя часть десктопного приложения.
 * На всех интерфейсах любой компьютер в сети входил бы под admin/admin.
 */
const HOST = '127.0.0.1';

const start = async () => {
  const app = await createApp();
  const server = app.listen(PORT, HOST);
  server.on('listening', () => {
    const address = server.address();
    if (!address || typeof address === 'string') {
      console.error('[server] bound address is unavailable');
      process.exit(1);
      return;
    }
    console.log(`[server] http://${HOST}:${address.port}`);
    if (process.send) {
      process.send({ type: 'server-ready', host: HOST, port: address.port });
    }
  });
  server.on('error', (err) => {
    console.error('[server] не удалось запустить', err);
    process.exit(1);
  });
  process.on('message', (message) => {
    if (message !== null && typeof message === 'object' && 'type' in message && message.type === 'shutdown') {
      server.close(() => process.exit(0));
    }
  });
};

void start().catch((error) => {
  console.error('[server] failed to initialize', error);
  process.exit(1);
});
