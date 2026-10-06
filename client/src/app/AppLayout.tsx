// AppLayout.tsx
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { SideMenu } from '@/widgets/SideMenu/SideMenu';
import { TopBar } from '@/widgets/TopBar/TopBar';
import { NotificationsPanel } from '@/widgets/NotificationsPanel/NotificationsPanel';
import { useAlarmEvents } from '@/widgets/NotificationsPanel/useAlarmEvents';
import { useUiStore } from '@/features/simulation/model/uiStore';
import { useAuthStore } from '@/features/auth/model/authStore';
import {
  flushPendingSessions,
  restorePendingSessions,
  useSessionQueue,
} from '@/features/sessions/model/pendingSession';
import { useSimulationStore } from '@/features/simulation/model/simulationStore';
import styles from './AppLayout.module.css';

export const AppLayout = () => {
  const notificationsOpen = useUiStore((s) => s.notificationsOpen);
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;
  const mustChangePassword = user?.mustChangePassword;
  const token = useAuthStore((s) => s.token);
  const { pathname } = useLocation();
  const storageError = useSessionQueue((s) => s.storageError);
  useAlarmEvents();

  useEffect(() => {
    if (pathname === '/simulation') return;
    const state = useSimulationStore.getState();
    state.finish();
    state.reset();
  }, [pathname]);

  useEffect(() => {
    if (!userId || mustChangePassword) return;
    restorePendingSessions(userId, useSimulationStore.getState().sessionId);
    const flush = () => {
      void flushPendingSessions(userId);
    };
    flush();
    const timer = window.setInterval(flush, 10_000);
    window.addEventListener('online', flush);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', flush);
    };
  }, [userId, mustChangePassword, token]);

  useEffect(() => {
    const verify = () => {
      if (document.visibilityState === 'visible') void useAuthStore.getState().verifySession();
    };
    window.addEventListener('focus', verify);
    document.addEventListener('visibilitychange', verify);
    return () => {
      window.removeEventListener('focus', verify);
      document.removeEventListener('visibilitychange', verify);
    };
  }, []);

  return (
    <div className={styles.root}>
      <TopBar />
      <div className={styles.body}>
        <SideMenu />
        <main className={styles.content}>
          {storageError && <p role="alert">{storageError}</p>}
          <Outlet />
        </main>
        {notificationsOpen && <NotificationsPanel />}
      </div>
    </div>
  );
};
