// server/src/shared/mappers.ts
import type { DbUser } from './db.js';

/** Публичное представление пользователя: пароль и хеш наружу не отдаются. */
export const toPublicUser = (u: DbUser) => ({
  id: u.id,
  login: u.login,
  role: u.role,
  displayName: u.displayName,
});
