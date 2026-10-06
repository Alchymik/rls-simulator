import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_EXPIRES_IN, type Database, type DbUser } from '../db.js';

export interface AuthedRequest extends Request {
  userId?: string;
  userRole?: DbUser['role'];
  tokenVersion?: number;
}

export const signUserToken = (db: Database, user: DbUser) =>
  jwt.sign({ ver: user.tokenVersion }, db.getJwtSecret(), {
    subject: user.id,
    expiresIn: JWT_EXPIRES_IN,
    algorithm: 'HS256',
  });

export const createAuthMiddleware = (db: Database) => {
  const authGuard = (req: AuthedRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized' });
    try {
      const payload = jwt.verify(header.slice(7), db.getJwtSecret(), { algorithms: ['HS256'] });
      if (typeof payload === 'string' || typeof payload.sub !== 'string' || !Number.isInteger(payload.ver)) {
        return res.status(401).json({ message: 'Invalid token' });
      }
      const user = db.findUserById(payload.sub);
      if (!user || user.tokenVersion !== payload.ver)
        return res.status(401).json({ message: 'Invalid token' });
      req.userId = user.id;
      req.userRole = user.role;
      req.tokenVersion = user.tokenVersion;
      next();
    } catch {
      res.status(401).json({ message: 'Invalid token' });
    }
  };

  const requireAdmin = (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (req.userRole !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    next();
  };

  const requirePasswordChanged = (req: AuthedRequest, res: Response, next: NextFunction) => {
    const user = req.userId ? db.findUserById(req.userId) : undefined;
    if (!user) return res.status(401).json({ message: 'Invalid token' });
    if (user.mustChangePassword) return res.status(403).json({ message: 'Необходимо сменить пароль' });
    next();
  };

  return { authGuard, requireAdmin, requirePasswordChanged };
};
