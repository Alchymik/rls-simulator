import { Router } from 'express';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { db, LIMITS, SECTORS, type DbEvent } from '../../shared/db.js';
import type { AuthedRequest } from '../../shared/middleware/authGuard.js';

export const eventsRouter = Router();

const createSchema = z.object({
  at: z.number().int().nonnegative(),
  targetId: z.string().min(1).max(64),
  sector: z.enum(SECTORS),
  speedKmh: z.number().nonnegative().max(10_000),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  // Снимок экрана приходит data URL; ограничение совпадает с лимитом тела запроса
  screenshot: z.string().max(4_000_000),
});

eventsRouter.get('/', (req: AuthedRequest, res) => {
  res.json(db.events.filter((e) => e.userId === req.userId).slice(0, LIMITS.eventsPerUser));
});

eventsRouter.post('/', (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success || !req.userId) return res.status(400).json({ message: 'Bad request' });

  const event: DbEvent = { id: nanoid(10), userId: req.userId, ...parsed.data };
  db.events.unshift(event);

  const mine = db.events.filter((e) => e.userId === req.userId);
  if (mine.length > LIMITS.eventsPerUser) {
    const keep = new Set(mine.slice(0, LIMITS.eventsPerUser).map((e) => e.id));
    db.events = db.events.filter((e) => e.userId !== req.userId || keep.has(e.id));
  }

  res.status(201).json(event);
});

eventsRouter.delete('/', (req: AuthedRequest, res) => {
  db.events = db.events.filter((e) => e.userId !== req.userId);
  res.status(204).end();
});
