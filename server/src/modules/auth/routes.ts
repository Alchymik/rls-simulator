import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { Database } from '../../shared/db.js';
import { normalizeLogin } from '../../shared/db.js';
import { toPublicUser } from '../../shared/mappers.js';
import { passwordField, passwordInput } from '../../shared/validation.js';
import {
  createAuthMiddleware,
  signUserToken,
  type AuthedRequest,
} from '../../shared/middleware/authGuard.js';

const schema = z.object({ login: z.string().trim().min(1).max(64), password: passwordInput });
const passwordSchema = z
  .object({ currentPassword: passwordInput, newPassword: passwordField })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: 'Новый пароль совпадает с текущим',
  });

/** Сравнение для неизвестного логина занимает примерно столько же, сколько для существующего. */
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10);

export const createAuthRouter = (db: Database) => {
  const router = Router();
  const { authGuard } = createAuthMiddleware(db);

  router.post('/login', async (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Bad request' });

    const candidate = db.findUserByLogin(normalizeLogin(parsed.data.login));
    const passwordOk = await bcrypt.compare(parsed.data.password, candidate?.passwordHash ?? DUMMY_HASH);
    if (!candidate || !passwordOk) return res.status(401).json({ message: 'Неверный логин или пароль' });

    // Пароль или учётную запись могли изменить, пока выполнялся bcrypt.compare.
    const user = db.findUserById(candidate.id);
    if (
      !user ||
      user.passwordHash !== candidate.passwordHash ||
      user.tokenVersion !== candidate.tokenVersion
    ) {
      return res.status(401).json({ message: 'Неверный логин или пароль' });
    }
    res.json({ token: signUserToken(db, user), user: toPublicUser(user) });
  });

  // Клиент проверяет сохранённую авторизацию при каждом запуске приложения.
  router.get('/me', authGuard, (req: AuthedRequest, res) => {
    const user = req.userId ? db.findUserById(req.userId) : undefined;
    if (!user) return res.status(401).json({ message: 'Invalid token' });
    res.json(toPublicUser(user));
  });

  router.post('/password', authGuard, async (req: AuthedRequest, res) => {
    const parsed = passwordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Bad request' });
    }

    const user = req.userId ? db.findUserById(req.userId) : undefined;
    if (!user) return res.status(401).json({ message: 'Invalid token' });
    if (!(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
      return res.status(400).json({ message: 'Текущий пароль неверен' });
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    const changed = await db.changePassword(user.id, user.passwordHash, passwordHash);
    if (!changed) return res.status(409).json({ message: 'Пароль уже изменён. Войдите снова.' });
    res.json({ token: signUserToken(db, changed), user: toPublicUser(changed) });
  });

  return router;
};
