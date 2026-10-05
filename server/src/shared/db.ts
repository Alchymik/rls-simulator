import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

/** Сектор входа цели в зону обнаружения — контракт клиента и архива событий. */
export const SECTORS = ['Север', 'Юг', 'Запад', 'Восток'] as const;
export type Sector = (typeof SECTORS)[number];

export interface DbUser { id: string; login: string; passwordHash: string; role: 'admin' | 'operator'; displayName: string; }

export interface DbSession {
  id: string; userId: string; mode: 'training';
  startedAt: number; finishedAt: number; durationSec: number;
  markedTotal: number; correct: number; wrong: number;
  points: { t: number; reactionMs: number; correct: boolean }[];
}

/** Тревожное событие со снимком экрана (п.3.1 ТЗ). */
export interface DbEvent {
  id: string; userId: string; at: number;
  targetId: string; sector: Sector; speedKmh: number;
  lat: number; lng: number; screenshot: string;
}

/** Ограничения in-memory хранилища, чтобы история не росла бесконечно. */
export const LIMITS = { eventsPerUser: 30, sessionsPerUser: 100 } as const;

export const db = {
  users: [] as DbUser[],
  sessions: [] as DbSession[],
  events: [] as DbEvent[],
};

// seed
const seed = () => {
  if (db.users.length) return;
  db.users.push(
    { id: nanoid(8), login: 'admin', passwordHash: bcrypt.hashSync('admin', 10), role: 'admin', displayName: 'admin' },
    { id: nanoid(8), login: 'operator', passwordHash: bcrypt.hashSync('operator', 10), role: 'operator', displayName: 'Оператор' },
  );
};
seed();