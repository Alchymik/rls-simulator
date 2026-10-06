// client/src/app/resetOnSignOut.ts
import { loadSettingsForUser } from '@/features/settings/model/settingsStore';
import { useAuthStore } from '@/features/auth/model/authStore';
import { useEventsStore } from '@/features/events/model/eventsStore';
import { useSimulationStore } from '@/features/simulation/model/simulationStore';
import { useUiStore } from '@/features/simulation/model/uiStore';

/**
 * Выход из системы — кнопкой в профиле или по ответу 401 — очищает данные прошлого пользователя:
 * уведомления, архив и открытые панели не должны достаться следующему.
 * Подписка живёт в слое app: features не импортируют друг друга.
 */
loadSettingsForUser(useAuthStore.getState().user?.id ?? null);

useAuthStore.subscribe((state, prev) => {
  if (prev.user?.id === state.user?.id) return;
  useSimulationStore.getState().finish();
  useSimulationStore.getState().reset();
  useEventsStore.getState().reset();
  loadSettingsForUser(state.user?.id ?? null);
  useUiStore.setState({ notificationsOpen: false, settingsMenuOpen: false });
});
