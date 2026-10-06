import { Router } from 'express';
import { z } from 'zod';
import type { Database, DbEvent } from '../../shared/db.js';
import { SECTORS } from '../../shared/db.js';
import type { AuthedRequest } from '../../shared/middleware/authGuard.js';

/** Только JPEG в data URL: произвольная строка попала бы в <img src> (например, внешний адрес). */
const jpegDataUrl = (maxLength: number) =>
  z.union([
    z.literal(''),
    z
      .string()
      .max(maxLength)
      .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/),
  ]);

const createSchema = z.object({
  at: z.number().int().nonnegative(),
  targetId: z.string().min(1).max(64),
  sector: z.enum(SECTORS),
  speedKmh: z.number().nonnegative().max(10_000),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  screenshot: jpegDataUrl(4_000_000),
  thumbnail: jpegDataUrl(100_000),
});

const toSummary = ({ screenshot: _screenshot, ...summary }: DbEvent) => summary;

export const createEventsRouter = (db: Database) => {
  const router = Router();

  router.get('/', (req: AuthedRequest, res) => {
    if (!req.userId) return res.status(401).json({ message: 'Invalid token' });
    res.json(db.listEvents(req.userId).map(toSummary));
  });

  router.get('/:id', (req: AuthedRequest, res) => {
    if (!req.userId) return res.status(401).json({ message: 'Invalid token' });
    const id = req.params.id;
    if (typeof id !== 'string') return res.status(404).json({ message: 'Событие не найдено' });
    const event = db.findEvent(req.userId, id);
    if (!event) return res.status(404).json({ message: 'Событие не найдено' });
    res.json(event);
  });

  router.post('/', async (req: AuthedRequest, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Bad request' });
    if (!req.userId) return res.status(401).json({ message: 'Invalid token' });
    const result = await db.createEvent(req.userId, req.tokenVersion!, parsed.data);
    if ('error' in result) {
      if (result.error === 'unauthorized') return res.status(401).json({ message: 'Invalid token' });
      return res.status(403).json({ message: 'Необходимо сменить пароль' });
    }
    res.status(201).json(toSummary(result.event));
  });

  router.delete('/', async (req: AuthedRequest, res) => {
    if (!req.userId) return res.status(401).json({ message: 'Invalid token' });
    const result = await db.clearEvents(req.userId, req.tokenVersion!);
    if ('error' in result) {
      if (result.error === 'unauthorized') return res.status(401).json({ message: 'Invalid token' });
      return res.status(403).json({ message: 'Необходимо сменить пароль' });
    }
    res.status(204).end();
  });

  return router;
};
