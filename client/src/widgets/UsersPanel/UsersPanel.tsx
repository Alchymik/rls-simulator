// client/src/widgets/UsersPanel/UsersPanel.tsx
import { useEffect, useState, type FormEvent } from 'react';
import { apiErrorMessage } from '@/shared/api/client';
import { createUser, deleteUser, fetchUsers, updateUser } from '@/features/users/api/usersApi';
import { ROLE_LABEL } from '@/entities/user/model/roleLabels';
import type { Role, User } from '@/entities/user/types';
import styles from './UsersPanel.module.css';

/** Настройки пользователей и прав доступа — доступно только администратору (п.3.2 ТЗ, п.2). */
export const UsersPanel = ({ currentUserId }: { currentUserId: string }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [draft, setDraft] = useState({ login: '', password: '', displayName: '', role: 'operator' as Role });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchUsers()
      .then((list) => {
        if (!cancelled) setUsers(list);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setMessage({ kind: 'error', text: apiErrorMessage(e, 'Не удалось загрузить пользователей') });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setMessage(null);
    try {
      await action();
      setMessage({ kind: 'ok', text: success });
      setReloadToken((n) => n + 1);
    } catch (e: unknown) {
      setMessage({ kind: 'error', text: apiErrorMessage(e, 'Операция не выполнена') });
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const { login, password, displayName, role } = draft;
    void run(async () => {
      await createUser({ login, password, displayName, role });
      setDraft({ login: '', password: '', displayName: '', role: 'operator' });
    }, `Пользователь ${login} создан`);
  };

  const remove = (user: User) => {
    if (!window.confirm(`Удалить пользователя ${user.login}?`)) return;
    void run(() => deleteUser(user.id), `Пользователь ${user.login} удалён`);
  };

  return (
    <section className={styles.panel}>
      <h3>Пользователи и права доступа</h3>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Логин</th>
              <th>Имя</th>
              <th>Роль</th>
              <th aria-label="Действия" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.login}</td>
                <td>{u.displayName}</td>
                <td>
                  <select
                    className={styles.select}
                    value={u.role}
                    onChange={(e) =>
                      void run(() => updateUser(u.id, { role: e.target.value as Role }), 'Роль изменена')
                    }
                  >
                    <option value="operator">Оператор</option>
                    <option value="admin">Администратор</option>
                  </select>
                </td>
                <td>
                  <button
                    className={styles.remove}
                    onClick={() => remove(u)}
                    disabled={u.id === currentUserId}
                    title={u.id === currentUserId ? 'Нельзя удалить себя' : 'Удалить пользователя'}
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className={styles.form} onSubmit={submit}>
        <label className={styles.field}>
          <span>Логин</span>
          <input value={draft.login} onChange={(e) => setDraft({ ...draft, login: e.target.value })} required minLength={3} />
        </label>
        <label className={styles.field}>
          <span>Имя</span>
          <input value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} required />
        </label>
        <label className={styles.field}>
          <span>Пароль</span>
          <input type="password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} required minLength={4} />
        </label>
        <label className={styles.field}>
          <span>Роль</span>
          <select className={styles.select} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}>
            <option value="operator">{ROLE_LABEL.operator}</option>
            <option value="admin">{ROLE_LABEL.admin}</option>
          </select>
        </label>
        <button className={styles.submit} type="submit">Добавить</button>
      </form>

      {message && (
        <p className={message.kind === 'ok' ? styles.ok : styles.error} role="status">{message.text}</p>
      )}
    </section>
  );
};
