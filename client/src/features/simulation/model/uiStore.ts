// client/src/features/simulation/model/uiStore.ts
import { create } from 'zustand';

interface UiState {
  notificationsOpen: boolean;
  settingsMenuOpen: boolean;
  toggleNotifications: () => void;
  openNotifications: () => void;
  toggleSettingsMenu: () => void;
  closeSettingsMenu: () => void;
}

/** Видимость накладных панелей режима тренировки (п.3.3.2 ТЗ). */
export const useUiStore = create<UiState>((set) => ({
  notificationsOpen: false,
  settingsMenuOpen: false,
  toggleNotifications: () => set((s) => ({ notificationsOpen: !s.notificationsOpen })),
  openNotifications: () => set({ notificationsOpen: true }),
  toggleSettingsMenu: () => set((s) => ({ settingsMenuOpen: !s.settingsMenuOpen })),
  closeSettingsMenu: () => set({ settingsMenuOpen: false }),
}));
