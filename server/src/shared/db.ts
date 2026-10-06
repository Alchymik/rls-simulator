import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { chmod, mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { nanoid } from 'nanoid';

/** Сектор входа цели в зону обнаружения — контракт клиента и архива событий. */
export const SECTORS = ['Север', 'Юг', 'Запад', 'Восток'] as const;
export type Sector = (typeof SECTORS)[number];

export interface DbUser {
  id: string;
  login: string;
  passwordHash: string;
  role: 'admin' | 'operator';
  displayName: string;
  mustChangePassword: boolean;
  tokenVersion: number;
}

export interface SessionPayload {
  sessionId: string;
  mode: 'training';
  startedAt: number;
  finishedAt: number;
  durationSec: number;
  markedTotal: number;
  correct: number;
  wrong: number;
  points: { t: number; reactionMs: number; correct: boolean }[];
}

export interface DbSession extends SessionPayload {
  id: string;
  userId: string;
}

/** Тревожное событие со снимком экрана (п.3.1 ТЗ). */
export interface DbEvent {
  id: string;
  userId: string;
  at: number;
  targetId: string;
  sector: Sector;
  speedKmh: number;
  lat: number;
  lng: number;
  screenshot: string;
  thumbnail: string;
}

export type NewUser = Omit<DbUser, 'id' | 'tokenVersion'>;
export type UserChanges = { displayName?: string; role?: DbUser['role']; passwordHash?: string };
export type NewEvent = Omit<DbEvent, 'id' | 'userId'>;

/** Историю ограничиваем объёмом, но сохраняем между запусками. */
export const LIMITS = { eventsPerUser: 30, sessionsPerUser: 100 } as const;
export const JWT_EXPIRES_IN = '12h';
const FILE_NAME = 'rls-data.json';
const FILE_VERSION = 2;

interface PersistedState {
  version: number;
  jwtSecret: string;
  users: DbUser[];
  sessions: DbSession[];
  sessionReceipts: { sessionId: string; userId: string; recordId: string; fingerprint: string }[];
  events: DbEvent[];
}

const clone = <T>(value: T): T => (value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T));
export const normalizeLogin = (login: string) => login.trim().toLowerCase();

/**
 * File-backed repository. Mutations are serialized and published in memory only
 * after an atomic rename succeeds, so a failed write cannot acknowledge lost data.
 */
export class Database {
  private state: PersistedState | null = null;
  private queue: Promise<void> = Promise.resolve();
  private readonly dataDir: string;
  private readonly filePath: string;

  constructor(dataDir = process.env.RLS_DATA_DIR ?? path.join(os.homedir(), '.rls-simulator')) {
    this.dataDir = path.resolve(dataDir);
    this.filePath = path.join(this.dataDir, FILE_NAME);
  }

  async initialize() {
    if (this.state) return;
    await mkdir(this.dataDir, { recursive: true, mode: 0o700 });
    await chmod(this.dataDir, 0o700);
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      if (!this.isPersistedState(parsed)) throw new Error('Invalid local database format');
      this.state = parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const state = this.initialState();
      await this.writeAtomically(state);
      this.state = state;
    }
    this.getJwtSecret();
  }

  getJwtSecret() {
    const configured = process.env.JWT_SECRET;
    if (configured && Buffer.byteLength(configured, 'utf8') < 32) {
      throw new Error('JWT_SECRET должен содержать не менее 32 байт UTF-8');
    }
    return configured ?? this.requireState().jwtSecret;
  }

  findUserById(id: string) {
    const user = this.requireState().users.find((item) => item.id === id);
    return user ? clone(user) : undefined;
  }

  findUserByLogin(login: string) {
    const normalized = normalizeLogin(login);
    const user = this.requireState().users.find((item) => normalizeLogin(item.login) === normalized);
    return user ? clone(user) : undefined;
  }

  listUsers() {
    return clone(this.requireState().users);
  }

  listSessions(userId: string) {
    return clone(this.requireState().sessions.filter((item) => item.userId === userId));
  }

  listEvents(userId: string) {
    return clone(this.requireState().events.filter((item) => item.userId === userId));
  }

  findEvent(userId: string, id: string) {
    const event = this.requireState().events.find((item) => item.id === id && item.userId === userId);
    return event ? clone(event) : undefined;
  }

  async createUser(actorId: string, actorTokenVersion: number, input: NewUser) {
    return this.mutate((state) => {
      if (
        !state.users.some(
          (user) =>
            user.id === actorId &&
            user.tokenVersion === actorTokenVersion &&
            user.role === 'admin' &&
            !user.mustChangePassword,
        )
      ) {
        return { error: 'forbidden' as const };
      }
      if (state.users.some((user) => normalizeLogin(user.login) === normalizeLogin(input.login))) {
        return { error: 'duplicate' as const };
      }
      const user: DbUser = { ...input, id: nanoid(12), tokenVersion: 0 };
      state.users.push(user);
      return { user };
    });
  }

  async updateUser(actorId: string, actorTokenVersion: number, targetId: string, changes: UserChanges) {
    return this.mutate((state) => {
      const actor = state.users.find((user) => user.id === actorId);
      if (
        !actor ||
        actor.tokenVersion !== actorTokenVersion ||
        actor.role !== 'admin' ||
        actor.mustChangePassword
      )
        return { error: 'forbidden' as const };
      const user = state.users.find((item) => item.id === targetId);
      if (!user) return { error: 'missing' as const };
      if (changes.role && changes.role !== user.role && user.id === actorId)
        return { error: 'self-role' as const };
      if (changes.passwordHash !== undefined && user.id === actorId)
        return { error: 'self-password' as const };
      if (
        changes.role &&
        changes.role !== 'admin' &&
        user.role === 'admin' &&
        state.users.filter((item) => item.role === 'admin').length === 1
      ) {
        return { error: 'last-admin' as const };
      }
      if (changes.displayName !== undefined) user.displayName = changes.displayName;
      if (changes.role !== undefined) user.role = changes.role;
      if (changes.passwordHash !== undefined) {
        user.passwordHash = changes.passwordHash;
        user.mustChangePassword = true;
        user.tokenVersion += 1;
      }
      return { user };
    });
  }

  async deleteUser(actorId: string, actorTokenVersion: number, targetId: string) {
    return this.mutate((state) => {
      const actor = state.users.find((user) => user.id === actorId);
      if (
        !actor ||
        actor.tokenVersion !== actorTokenVersion ||
        actor.role !== 'admin' ||
        actor.mustChangePassword
      )
        return { error: 'forbidden' as const };
      const userIndex = state.users.findIndex((item) => item.id === targetId);
      const target = state.users[userIndex];
      if (!target) return { error: 'missing' as const };
      if (target.id === actorId) return { error: 'self-delete' as const };
      if (target.role === 'admin' && state.users.filter((item) => item.role === 'admin').length === 1) {
        return { error: 'last-admin' as const };
      }
      state.users.splice(userIndex, 1);
      state.sessions = state.sessions.filter((item) => item.userId !== target.id);
      state.events = state.events.filter((item) => item.userId !== target.id);
      state.sessionReceipts = state.sessionReceipts.filter((item) => item.userId !== target.id);
      return { ok: true as const };
    });
  }

  async changePassword(userId: string, expectedHash: string, passwordHash: string) {
    return this.mutate((state) => {
      const user = state.users.find((item) => item.id === userId);
      if (!user || user.passwordHash !== expectedHash) return undefined;
      user.passwordHash = passwordHash;
      user.mustChangePassword = false;
      user.tokenVersion += 1;
      return user;
    });
  }

  async saveSession(userId: string, tokenVersion: number, payload: SessionPayload) {
    return this.mutate((state) => {
      const user = state.users.find((item) => item.id === userId);
      if (!user || user.tokenVersion !== tokenVersion) return { error: 'unauthorized' as const };
      if (user.mustChangePassword) return { error: 'forbidden' as const };
      const receipt = state.sessionReceipts.find((item) => item.sessionId === payload.sessionId);
      if (receipt) {
        if (receipt.userId !== userId || receipt.fingerprint !== sessionFingerprint(payload))
          return { error: 'conflict' as const };
        const previous = state.sessions.find((item) => item.id === receipt.recordId);
        const session = previous ?? { ...clone(payload), id: receipt.recordId, userId };
        return { session, duplicate: true as const };
      }
      const session: DbSession = { ...clone(payload), id: nanoid(12), userId };
      state.sessions.unshift(session);
      state.sessionReceipts.push({
        sessionId: payload.sessionId,
        userId,
        recordId: session.id,
        fingerprint: sessionFingerprint(payload),
      });
      const mine = state.sessions.filter((item) => item.userId === userId);
      if (mine.length > LIMITS.sessionsPerUser) {
        const keep = new Set(mine.slice(0, LIMITS.sessionsPerUser).map((item) => item.id));
        state.sessions = state.sessions.filter((item) => item.userId !== userId || keep.has(item.id));
      }
      return { session, duplicate: false as const };
    });
  }

  async createEvent(userId: string, tokenVersion: number, input: NewEvent) {
    return this.mutate((state) => {
      const user = state.users.find((item) => item.id === userId);
      if (!user || user.tokenVersion !== tokenVersion) return { error: 'unauthorized' as const };
      if (user.mustChangePassword) return { error: 'forbidden' as const };
      const event: DbEvent = { ...clone(input), id: nanoid(12), userId };
      state.events.unshift(event);
      const mine = state.events.filter((item) => item.userId === userId);
      if (mine.length > LIMITS.eventsPerUser) {
        const keep = new Set(mine.slice(0, LIMITS.eventsPerUser).map((item) => item.id));
        state.events = state.events.filter((item) => item.userId !== userId || keep.has(item.id));
      }
      return { event };
    });
  }

  async clearEvents(userId: string, tokenVersion: number) {
    return this.mutate((state) => {
      const user = state.users.find((item) => item.id === userId);
      if (!user || user.tokenVersion !== tokenVersion) return { error: 'unauthorized' as const };
      if (user.mustChangePassword) return { error: 'forbidden' as const };
      state.events = state.events.filter((item) => item.userId !== userId);
      return { ok: true as const };
    });
  }

  private async mutate<T>(operation: (state: PersistedState) => T) {
    await this.initialize();
    let release!: () => void;
    const previous = this.queue;
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      const next = clone(this.requireState());
      const result = operation(next);
      if (
        result &&
        typeof result === 'object' &&
        ('error' in result || ('duplicate' in result && result.duplicate === true))
      ) {
        return clone(result);
      }
      await this.writeAtomically(next);
      this.state = next;
      return clone(result);
    } finally {
      release();
    }
  }

  private initialState(): PersistedState {
    return {
      version: FILE_VERSION,
      jwtSecret: process.env.JWT_SECRET ?? randomBytes(32).toString('hex'),
      users: [
        {
          id: 'seed-admin-v1',
          login: 'admin',
          passwordHash: bcrypt.hashSync('admin', 10),
          role: 'admin',
          displayName: 'admin',
          mustChangePassword: true,
          tokenVersion: 0,
        },
        {
          id: 'seed-operator-v1',
          login: 'operator',
          passwordHash: bcrypt.hashSync('operator', 10),
          role: 'operator',
          displayName: 'Оператор',
          mustChangePassword: true,
          tokenVersion: 0,
        },
      ],
      sessions: [],
      sessionReceipts: [],
      events: [],
    };
  }

  private isPersistedState(value: unknown): value is PersistedState {
    if (!value || typeof value !== 'object') return false;
    const state = value as Partial<PersistedState>;
    return (
      state.version === FILE_VERSION &&
      typeof state.jwtSecret === 'string' &&
      state.jwtSecret.length >= 32 &&
      Array.isArray(state.users) &&
      Array.isArray(state.sessions) &&
      Array.isArray(state.sessionReceipts) &&
      Array.isArray(state.events) &&
      state.users.every(
        (user) =>
          typeof user.id === 'string' &&
          typeof user.login === 'string' &&
          typeof user.passwordHash === 'string' &&
          (user.role === 'admin' || user.role === 'operator') &&
          typeof user.displayName === 'string' &&
          typeof user.mustChangePassword === 'boolean' &&
          Number.isInteger(user.tokenVersion),
      )
    );
  }

  private requireState() {
    if (!this.state) throw new Error('Database has not been initialized');
    return this.state;
  }

  private async writeAtomically(state: PersistedState) {
    const tempPath = `${this.filePath}.${process.pid}.${nanoid(8)}.tmp`;
    try {
      const file = await open(tempPath, 'wx', 0o600);
      try {
        await file.writeFile(JSON.stringify(state), 'utf8');
        await file.sync();
      } finally {
        await file.close();
      }
      await rename(tempPath, this.filePath);
    } catch (error) {
      await rm(tempPath, { force: true });
      throw error;
    }
  }
}

const sessionFingerprint = (payload: SessionPayload) =>
  createHash('sha256').update(JSON.stringify(payload)).digest('hex');
