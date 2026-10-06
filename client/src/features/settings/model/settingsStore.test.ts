import { beforeEach, expect, it, vi } from 'vitest';
vi.hoisted(() => {
  const memory = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
    clear: () => memory.clear(),
  });
  vi.stubGlobal('window', { localStorage });
});
import { loadSettingsForUser, useSettingsStore as settings } from './settingsStore';
beforeEach(() => localStorage.clear());
it('keeps preferences separate and restores them on the next login', () => {
  loadSettingsForUser('A');
  settings.getState().setSound({ volume: 0.2 });
  loadSettingsForUser('B');
  expect(settings.getState().sound.volume).toBe(0.5);
  settings.getState().setSound({ volume: 0.9 });
  loadSettingsForUser('A');
  expect(settings.getState().sound.volume).toBe(0.2);
});
it('normalizes malformed persisted settings', () => {
  localStorage.setItem(
    'rls-settings:A',
    JSON.stringify({
      state: {
        map: { home: { lat: 200, lng: 0, zoom: 3 }, showDirection: 'yes' },
        training: { maxConcurrent: 1000 },
        sound: { volume: -5 },
      },
    }),
  );
  loadSettingsForUser('A');
  expect(settings.getState().map.home).toBeNull();
  expect(settings.getState().map.showDirection).toBe(false);
  expect(settings.getState().training.maxConcurrent).toBe(20);
  expect(settings.getState().sound.volume).toBe(0);
});
