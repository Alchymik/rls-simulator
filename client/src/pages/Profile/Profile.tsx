// client/src/pages/Profile/Profile.tsx
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiErrorMessage } from '@/shared/api/client';
import { useAuthStore } from '@/features/auth/model/authStore';
import { flushPendingSessions, useSessionQueue } from '@/features/sessions/model/pendingSession';
import { fetchSessions } from '@/features/sessions/api/sessionsApi';
import { ROLE_LABEL } from '@/entities/user/model/roleLabels';
import { StatsChart } from '@/widgets/StatsChart/StatsChart';
import { formatDateTime } from '@/shared/lib/format';
import { formatDuration } from '@/shared/lib/units';
import type { SessionResult } from '@/entities/session/types';
import styles from './Profile.module.css';

const Profile = () => {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;
  const mustChangePassword = user?.mustChangePassword;
  const logout = useAuthStore((s) => s.logout);
  const changePassword = useAuthStore((s) => s.changePassword);
  const queueEntries = useSessionQueue((s) => s.entries);
  const saving = useSessionQueue((s) => s.saving);
  const saved = useSessionQueue((s) => s.saved);
  const pending = queueEntries.filter((entry) => entry.userId === user?.id && entry.ready);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const passwordLock = useRef(false);

  const [sessions, setSessions] = useState<SessionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [pwd, setPwd] = useState({ current: '', next: '', repeat: '' });
  const [pwdMessage, setPwdMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!userId || mustChangePassword) return;
    let cancelled = false;
    fetchSessions()
      .then((next) => {
        if (!cancelled) {
          setSessions(next);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(apiErrorMessage(error, 'Не удалось загрузить историю тренировок'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, mustChangePassword, saved]);

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (passwordLock.current) return;
    setPwdMessage(null);
    if (pwd.next.length < 8) {
      setPwdMessage({ kind: 'error', text: 'Новый пароль должен быть не короче 8 символов' });
      return;
    }
    if (new TextEncoder().encode(pwd.next).length > 72) {
      setPwdMessage({ kind: 'error', text: 'Пароль должен занимать не больше 72 байт UTF-8' });
      return;
    }
    if (pwd.next !== pwd.repeat) {
      setPwdMessage({ kind: 'error', text: 'Пароли не совпадают' });
      return;
    }
    passwordLock.current = true;
    setPasswordBusy(true);
    try {
      await changePassword(pwd.current, pwd.next);
      setPwd({ current: '', next: '', repeat: '' });
      setPwdMessage({ kind: 'ok', text: 'Пароль изменён' });
    } catch (e: unknown) {
      setPwdMessage({ kind: 'error', text: apiErrorMessage(e, 'Не удалось изменить пароль') });
    } finally {
      passwordLock.current = false;
      setPasswordBusy(false);
    }
  };

  if (!user) return null;

  const totals = sessions.reduce(
    (acc, s) => ({
      marked: acc.marked + s.markedTotal,
      correct: acc.correct + s.correct,
      wrong: acc.wrong + s.wrong,
    }),
    { marked: 0, correct: 0, wrong: 0 },
  );

  return (
    <div className={styles.root}>
      <h2>Профиль</h2>

      <section className={styles.card}>
        <div className={styles.userRow}>
          <div className={styles.avatar}>👤</div>
          <div>
            <div className={styles.name}>{user.displayName}</div>
            <div className={styles.meta}>
              Логин: {user.login} · Роль: {ROLE_LABEL[user.role]}
            </div>
          </div>
          <button className={styles.logout} onClick={logout}>
            Выйти из системы
          </button>
        </div>
      </section>

      <section className={styles.card}>
        <h3>Смена пароля</h3>
        {user.mustChangePassword && (
          <p className={styles.error} role="alert">
            Установлен пароль по умолчанию. Смените его, чтобы продолжить работу.
          </p>
        )}
        <form className={styles.form} onSubmit={(event) => void submitPassword(event)}>
          <label className={styles.field}>
            <span>Текущий пароль</span>
            <input
              type="password"
              autoComplete="current-password"
              value={pwd.current}
              onChange={(e) => setPwd({ ...pwd, current: e.target.value })}
              required
            />
          </label>
          <label className={styles.field}>
            <span>Новый пароль</span>
            <input
              type="password"
              autoComplete="new-password"
              value={pwd.next}
              onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
              required
            />
          </label>
          <label className={styles.field}>
            <span>Повтор нового пароля</span>
            <input
              type="password"
              autoComplete="new-password"
              value={pwd.repeat}
              onChange={(e) => setPwd({ ...pwd, repeat: e.target.value })}
              required
            />
          </label>
          <button className={styles.submit} type="submit" disabled={passwordBusy}>
            {passwordBusy ? 'Сохраняем…' : 'Изменить пароль'}
          </button>
          {pwdMessage && (
            <p className={pwdMessage.kind === 'ok' ? styles.ok : styles.error} role="status">
              {pwdMessage.text}
            </p>
          )}
        </form>
      </section>

      {pending.length > 0 && (
        <section className={styles.card} aria-label="Очередь результатов">
          <p role="status">Ожидают отправки: {pending.length}. Результаты хранятся на этом устройстве.</p>
          {pending.some((entry) => entry.error) && (
            <p className={styles.error}>{pending.find((entry) => entry.error)?.error}</p>
          )}
          <button
            className={styles.submit}
            disabled={Object.keys(saving).length > 0 || user.mustChangePassword}
            onClick={() => void flushPendingSessions(user.id)}
          >
            Повторить отправку
          </button>
        </section>
      )}
      {!user.mustChangePassword && (
        <section className={styles.card}>
          <h3>История тренировок и статистика</h3>
          {loading && <p className={styles.meta}>Загрузка…</p>}
          {loadError && <p className={styles.error}>{loadError}</p>}
          {!loading && !loadError && sessions.length === 0 && (
            <p className={styles.meta}>Сохранённых тренировок пока нет.</p>
          )}

          {sessions.length > 0 && (
            <>
              <div className={styles.totals}>
                <span>
                  Сеансов: <b>{sessions.length}</b>
                </span>
                <span>
                  Отмечено целей: <b>{totals.marked}</b>
                </span>
                <span className={styles.green}>
                  Верно: <b>{totals.correct}</b>
                </span>
                <span className={styles.red}>
                  Ошибок: <b>{totals.wrong}</b>
                </span>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Длительность</th>
                      <th>Отмечено</th>
                      <th>Верно</th>
                      <th>Ошибок</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id}>
                        <td>{formatDateTime(s.startedAt)}</td>
                        <td>{formatDuration(s.durationSec)}</td>
                        <td>{s.markedTotal}</td>
                        <td className={styles.green}>{s.correct}</td>
                        <td className={styles.red}>{s.wrong}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <StatsChart sessions={sessions} />
            </>
          )}
        </section>
      )}
    </div>
  );
};

export default Profile;
