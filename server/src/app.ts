import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createAuthRouter } from './modules/auth/routes.js';
import { createSessionsRouter, MAX_SESSION_POINTS } from './modules/sessions/routes.js';
import { createUsersRouter } from './modules/users/routes.js';
import { createEventsRouter } from './modules/events/routes.js';
import { Database } from './shared/db.js';
import { createAuthMiddleware } from './shared/middleware/authGuard.js';
import { errorHandler } from './shared/middleware/errorHandler.js';

/**
 * Приложение отдельно от запуска сервера: тесты поднимают его на свободном порту.
 * CORS не нужен: в поставке клиент отдаёт этот же сервер, при разработке запросы идут через прокси Vite.
 */
export const createApp = async (options: { dataDir?: string } = {}) => {
  const db = new Database(options.dataDir);
  await db.initialize();
  const { authGuard, requireAdmin, requirePasswordChanged } = createAuthMiddleware(db);
  const app = express();

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use(
    '/api/events',
    authGuard,
    requirePasswordChanged,
    express.json({ limit: '4mb' }),
    createEventsRouter(db),
  );
  // До 12,001 реакций на час тренировки укладываются в этот отдельный лимит JSON.
  app.use(
    '/api/sessions',
    authGuard,
    requirePasswordChanged,
    express.json({ limit: `${MAX_SESSION_POINTS * 100}b` }),
    createSessionsRouter(db),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use('/api/auth', createAuthRouter(db));
  app.use('/api/users', authGuard, requirePasswordChanged, requireAdmin, createUsersRouter(db));
  // Неизвестный адрес API — JSON, а не HTML-страница Express
  app.use('/api', (_req, res) => res.status(404).json({ message: 'Not found' }));

  // Собранный клиент отдаёт тот же сервер, поэтому desktop-сборке не нужен Vite
  const clientDist = path.resolve(
    process.env.RLS_CLIENT_DIR ?? path.resolve(import.meta.dirname, '../../client/dist'),
  );
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
};
