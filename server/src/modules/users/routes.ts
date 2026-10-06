import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { Database } from '../../shared/db.js';
import { toPublicUser } from '../../shared/mappers.js';
import type { AuthedRequest } from '../../shared/middleware/authGuard.js';
import { passwordField } from '../../shared/validation.js';

const roleSchema = z.enum(['admin', 'operator']);
const createSchema = z.object({
  login: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9._-]+$/i, 'Логин: латиница, цифры, точка, дефис'),
  password: passwordField,
  displayName: z.string().trim().min(1).max(64),
  role: roleSchema,
});
const updateSchema = z.object({
  displayName: z.string().trim().min(1).max(64).optional(),
  role: roleSchema.optional(),
  password: passwordField.optional(),
});

export const createUsersRouter = (db: Database) => {
  const router = Router();

  router.get('/', (_req, res) => res.json(db.listUsers().map(toPublicUser)));

  router.post('/', async (req: AuthedRequest, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Bad request' });
    if (!req.userId) return res.status(401).json({ message: 'Invalid token' });

    // Hashing happens before the repository's atomic uniqueness check and insert.
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const result = await db.createUser(req.userId, req.tokenVersion!, {
      login: parsed.data.login,
      passwordHash,
      role: parsed.data.role,
      displayName: parsed.data.displayName,
      mustChangePassword: true,
    });
    if ('error' in result) {
      if (result.error === 'duplicate') return res.status(409).json({ message: 'Логин уже занят' });
      return res.status(403).json({ message: 'Forbidden' });
    }
    res.status(201).json(toPublicUser(result.user));
  });

  router.patch('/:id', async (req: AuthedRequest, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Bad request' });
    if (!req.userId) return res.status(401).json({ message: 'Invalid token' });
    const targetId = req.params.id;
    if (typeof targetId !== 'string') return res.status(404).json({ message: 'Пользователь не найден' });

    const changes = {
      ...(parsed.data.displayName !== undefined ? { displayName: parsed.data.displayName } : {}),
      ...(parsed.data.role !== undefined ? { role: parsed.data.role } : {}),
      ...(parsed.data.password ? { passwordHash: await bcrypt.hash(parsed.data.password, 10) } : {}),
    };
    const result = await db.updateUser(req.userId, req.tokenVersion!, targetId, changes);
    if ('error' in result) {
      if (result.error === 'missing') return res.status(404).json({ message: 'Пользователь не найден' });
      if (result.error === 'self-role')
        return res.status(409).json({ message: 'Нельзя изменить собственную роль' });
      if (result.error === 'self-password')
        return res.status(409).json({ message: 'Свой пароль меняют в разделе «Профиль»' });
      if (result.error === 'last-admin')
        return res.status(409).json({ message: 'В системе должен остаться хотя бы один администратор' });
      return res.status(403).json({ message: 'Forbidden' });
    }
    res.json(toPublicUser(result.user));
  });

  router.delete('/:id', async (req: AuthedRequest, res) => {
    if (!req.userId) return res.status(401).json({ message: 'Invalid token' });
    const targetId = req.params.id;
    if (typeof targetId !== 'string') return res.status(404).json({ message: 'Пользователь не найден' });
    const result = await db.deleteUser(req.userId, req.tokenVersion!, targetId);
    if ('error' in result) {
      if (result.error === 'missing') return res.status(404).json({ message: 'Пользователь не найден' });
      if (result.error === 'self-delete')
        return res.status(409).json({ message: 'Нельзя удалить самого себя' });
      if (result.error === 'last-admin')
        return res.status(409).json({ message: 'В системе должен остаться хотя бы один администратор' });
      return res.status(403).json({ message: 'Forbidden' });
    }
    res.status(204).end();
  });

  return router;
};
