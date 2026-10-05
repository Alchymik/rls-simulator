import { Router } from 'express';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { db, LIMITS } from '../../shared/db.js';
import type { AuthedRequest } from '../../shared/middleware/authGuard.js';

export const sessionsRouter = Router();

const createSchema = z.object({
  mode: z.literal('training'),
  durationSec: z.number().nonnegative().max(24 * 3600),
  markedTotal: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
  wrong: z.number().int().nonnegative(),
  points: z
    .array(
      z.object({
        t: z.number().nonnegative(),
        reactionMs: z.number().nonnegative(),
        correct: z.boolean(),
      }),
    )
    .max(5_000),
});

sessionsRouter.post('/', (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success || !req.userId) return res.status(400).json({ message: 'Bad request' });
  const s = {
    id: nanoid(10),
    userId: req.userId,
    startedAt: Date.now() - parsed.data.durationSec * 1000,
    finishedAt: Date.now(),
    ...parsed.data,
  };
  db.sessions.unshift(s);

  // История ограничена, чтобы in-memory хранилище не росло бесконечно
  const mine = db.sessions.filter((x) => x.userId === req.userId);
  if (mine.length > LIMITS.sessionsPerUser) {
    const keep = new Set(mine.slice(0, LIMITS.sessionsPerUser).map((x) => x.id));
    db.sessions = db.sessions.filter((x) => x.userId !== req.userId || keep.has(x.id));
  }

  res.status(201).json(s);
});

sessionsRouter.get('/', (req: AuthedRequest, res) => {
  res.json(db.sessions.filter((s) => s.userId === req.userId).slice(0, LIMITS.sessionsPerUser));
});