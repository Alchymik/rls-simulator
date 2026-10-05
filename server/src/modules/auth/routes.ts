import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../../shared/db.js';
import { toPublicUser } from '../../shared/mappers.js';
import { authGuard, JWT_EXPIRES_IN, JWT_SECRET, type AuthedRequest } from '../../shared/middleware/authGuard.js';

export const authRouter = Router();

const schema = z.object({ login: z.string().min(1), password: z.string().min(1) });
const passwordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(4) });

authRouter.post('/login', async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Bad request' });

  const user = db.users.find((u) => u.login === parsed.data.login);
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ message: 'Неверный логин или пароль' });
  }
  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.json({ token, user: { id: user.id, login: user.login, role: user.role, displayName: user.displayName } });
});

// Текущий пользователь по токену: клиент проверяет сессию при запуске приложения
authRouter.get('/me', authGuard, (req: AuthedRequest, res) => {
  const user = db.users.find((u) => u.id === req.userId);
  if (!user) return res.status(401).json({ message: 'Invalid token' });
  res.json(toPublicUser(user));
});

// Смена пароля из раздела «Профиль» (п.3.2 ТЗ, п.2)
authRouter.post('/password', authGuard, async (req: AuthedRequest, res) => {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Пароль должен быть не короче 4 символов' });

  const user = db.users.find((u) => u.id === req.userId);
  if (!user) return res.status(401).json({ message: 'Invalid token' });

  if (!(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
    return res.status(400).json({ message: 'Текущий пароль неверен' });
  }

  user.passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  res.status(204).end();
});