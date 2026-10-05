import type { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { db, type DbUser } from '../db.js';

// Секрет задаётся переменной окружения; в desktop-сборке (и при разработке) генерируется
// случайный — токены прошлых запусков всё равно недействительны из-за in-memory БД.
export const JWT_SECRET = process.env.JWT_SECRET ?? randomBytes(32).toString('hex');
export const JWT_EXPIRES_IN = '12h';

export interface AuthedRequest extends Request {
  userId?: string;
  userRole?: DbUser['role'];
}

export const authGuard = (req: AuthedRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { sub: string };
    // Роль берём из БД, а не из токена: изменение прав действует без перелогина.
    // In-memory БД сбрасывается при рестарте, поэтому токен из прошлого запуска
    // остаётся валидным по подписи, но указывает на несуществующего пользователя.
    const user = db.users.find((u) => u.id === payload.sub);
    if (!user) return res.status(401).json({ message: 'Invalid token' });
    req.userId = user.id;
    req.userRole = user.role;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};

/** Разграничение прав доступа: административные операции (п.3.2 ТЗ, п.2). */
export const requireAdmin = (req: AuthedRequest, res: Response, next: NextFunction) => {
  if (req.userRole !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  next();
};