// client/src/pages/Profile/Profile.tsx
import { useEffect, useState, type FormEvent } from 'react';
import { apiErrorMessage } from '@/shared/api/client';
import { useAuthStore } from '@/features/auth/model/authStore';
import { changePasswordRequest } from '@/features/auth/api/authApi';
import { fetchSessions } from '@/features/sessions/api/sessionsApi';
import { ROLE_LABEL } from '@/entities/user/model/roleLabels';
import { StatsChart } from '@/widgets/StatsChart/StatsChart';
import { formatDateTime } from '@/shared/lib/format';
import { formatDuration } from '@/shared/lib/units';
import type { SessionResult } from '@/entities/session/types';
import styles from './Profile.module.css';

const Profile = () => {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [sessions, setSessions] = useState<SessionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [pwd, setPwd] = useState({ current: '', next: '', repeat: '' });
  const [pwdMessage, setPwdMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSessions()
      .then(setSessions)
      .catch((e: unknown) => setLoadError(apiErrorMessage(e, 'Не удалось загрузить историю тренировок')))
      .finally(() => setLoading(false));
  }, []);

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwdMessage(null);    if (pwd.next.length < 4) {
      setPwdMessage({ kind: 'error', text: 'Новый пароль должен быть не короче 4 символов' });
      return;
    }
    if (pwd.next !== pwd.repeat) {
      setPwdMessage({ kind: 'error', text: 'Пароли не совпадают' });
      return;
    }
    try {
      await changePasswordRequest(pwd.current, pwd.next);
      setPwd({ current: '', next: '', repeat: '' });
      setPwdMessage({ kind: 'ok', text: 'Пароль изменён' });
    } catch (e: unknown) {
      setPwdMessage({ kind: 'error', text: apiErrorMessage(e, 'Не удалось изменить пароль') });
    }
  };

  if (!user) return null;

  const totals = sessions.reduce(
    (acc, s) => ({ marked: acc.marked + s.markedTotal, correct: acc.correct + s.correct, wrong: acc.wrong + s.wrong }),
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
          <button className={styles.logout} onClick={logout}>Выйти из системы</button>
        </div>
      </section>

      <section className={styles.card}>
        <h3>Смена пароля</h3>
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
          <button className={styles.submit} type="submit">Изменить пароль</button>
          {pwdMessage && (
            <p className={pwdMessage.kind === 'ok' ? styles.ok : styles.error} role="status">
              {pwdMessage.text}
            </p>
          )}
        </form>
      </section>

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
              <span>Сеансов: <b>{sessions.length}</b></span>
              <span>Отмечено целей: <b>{totals.marked}</b></span>
              <span className={styles.green}>Верно: <b>{totals.correct}</b></span>
              <span className={styles.red}>Ошибок: <b>{totals.wrong}</b></span>
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
    </div>
  );
};

export default Profile;
