import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { db, type DbUser } from '../../shared/db.js';
import { toPublicUser } from '../../shared/mappers.js';
import type { AuthedRequest } from '../../shared/middleware/authGuard.js';

export const usersRouter = Router();

const roleSchema = z.enum(['admin', 'operator']);

const createSchema = z.object({
  login: z.string().min(3),
  password: z.string().min(4),
  displayName: z.string().min(1),
  role: roleSchema,
});

const updateSchema = z.object({
  displayName: z.string().min(1).optional(),
  role: roleSchema.optional(),
  password: z.string().min(4).optional(),
});

const adminsCount = () => db.users.filter((u) => u.role === 'admin').length;

usersRouter.get('/', (_req, res) => {
  res.json(db.users.map(toPublicUser));
});

usersRouter.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Bad request' });
  if (db.users.some((u) => u.login === parsed.data.login)) {
    return res.status(409).json({ message: 'Логин уже занят' });
  }
  const user: DbUser = {
    id: nanoid(8),
    login: parsed.data.login,
    passwordHash: await bcrypt.hash(parsed.data.password, 10),
    role: parsed.data.role,
    displayName: parsed.data.displayName,
  };
  db.users.push(user);
  res.status(201).json(toPublicUser(user));
});

usersRouter.patch('/:id', async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Bad request' });

  const user = db.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

  // Нельзя оставить систему без администратора
  if (parsed.data.role && parsed.data.role !== 'admin' && user.role === 'admin' && adminsCount() === 1) {
    return res.status(409).json({ message: 'В системе должен остаться хотя бы один администратор' });
  }

  if (parsed.data.displayName) user.displayName = parsed.data.displayName;
  if (parsed.data.role) user.role = parsed.data.role;
  if (parsed.data.password) user.passwordHash = await bcrypt.hash(parsed.data.password, 10);

  res.json(toPublicUser(user));
});

usersRouter.delete('/:id', (req: AuthedRequest, res) => {
  const index = db.users.findIndex((u) => u.id === req.params.id);
  const target = db.users[index];
  if (!target) return res.status(404).json({ message: 'Пользователь не найден' });
  if (target.id === req.userId) {
    return res.status(409).json({ message: 'Нельзя удалить самого себя' });
  }
  if (target.role === 'admin' && adminsCount() === 1) {
    return res.status(409).json({ message: 'В системе должен остаться хотя бы один администратор' });
  }
  db.users.splice(index, 1);
  res.status(204).end();
});
