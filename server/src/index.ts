import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { authRouter } from './modules/auth/routes.js';
import { sessionsRouter } from './modules/sessions/routes.js';
import { usersRouter } from './modules/users/routes.js';
import { eventsRouter } from './modules/events/routes.js';
import { authGuard, requireAdmin } from './shared/middleware/authGuard.js';
import { errorHandler } from './shared/middleware/errorHandler.js';

const app = express();

// Локальный desktop-клиент: разрешаем только localhost-источники
app.use(
  cors({
    origin: (origin, callback) =>
      callback(null, !origin || /^http:\/\/localhost(:\d+)?$/.test(origin)),
    credentials: true,
  }),
);
// Лимит повышен под снимки экрана в архиве событий
app.use(express.json({ limit: '4mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/sessions', authGuard, sessionsRouter);
app.use('/api/users', authGuard, requireAdmin, usersRouter);
app.use('/api/events', authGuard, eventsRouter);

// Собранный клиент отдаёт тот же сервер, поэтому desktop-сборке не нужен Vite
const clientDist = path.resolve(import.meta.dirname, '../../client/dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(errorHandler);

const PORT = Number(process.env.PORT ?? 3001);
app.listen(PORT, () => console.log(`[server] http://localhost:${PORT}`));
