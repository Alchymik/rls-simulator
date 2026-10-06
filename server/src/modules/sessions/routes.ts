import { Router } from 'express';
import { z } from 'zod';
import { Database } from '../../shared/db.js';
import type { AuthedRequest } from '../../shared/middleware/authGuard.js';

export const MAX_SESSION_POINTS = 12_001;

const createSchema = z
  .object({
    sessionId: z.string().min(1).max(64),
    mode: z.literal('training'),
    /** Calendar timestamps; active duration is tracked independently by the simulation. */
    startedAt: z.number().int().positive(),
    finishedAt: z.number().int().positive(),
    durationSec: z.number().nonnegative().max(3_600),
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
      .max(MAX_SESSION_POINTS),
  })
  .superRefine((session, context) => {
    if (session.startedAt > session.finishedAt || session.finishedAt > Date.now() + 5 * 60_000) {
      context.addIssue({ code: 'custom', message: 'Некорректное время сеанса' });
    }
    if (session.finishedAt - session.startedAt + 1 < session.durationSec * 1_000) {
      context.addIssue({ code: 'custom', message: 'Длительность превышает календарное время сеанса' });
    }
    const actualCorrect = session.points.filter((point) => point.correct).length;
    const actualWrong = session.points.length - actualCorrect;
    if (
      session.correct !== actualCorrect ||
      session.wrong !== actualWrong ||
      session.markedTotal !== session.points.length
    ) {
      context.addIssue({ code: 'custom', message: 'Счётчики сеанса не согласованы' });
    }
    for (const point of session.points) {
      if (point.t > session.durationSec + 0.001 || point.reactionMs > point.t * 1_000 + 1) {
        context.addIssue({ code: 'custom', message: 'Точка находится за пределами времени сеанса' });
        break;
      }
    }
  });

export const createSessionsRouter = (db: Database) => {
  const router = Router();

  router.post('/', async (req: AuthedRequest, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Bad request' });
    if (!req.userId) return res.status(401).json({ message: 'Invalid token' });

    const result = await db.saveSession(req.userId, req.tokenVersion!, parsed.data);
    if ('error' in result) {
      if (result.error === 'unauthorized') return res.status(401).json({ message: 'Invalid token' });
      if (result.error === 'forbidden') return res.status(403).json({ message: 'Необходимо сменить пароль' });
      return res.status(409).json({ message: 'Идентификатор сеанса уже использован' });
    }
    res.status(result.duplicate ? 200 : 201).json(result.session);
  });

  router.get('/', (req: AuthedRequest, res) => {
    if (!req.userId) return res.status(401).json({ message: 'Invalid token' });
    res.json(db.listSessions(req.userId));
  });

  return router;
};
