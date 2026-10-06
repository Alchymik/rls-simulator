import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clampTraining, DEFAULT_TRAINING, type TrainingSettings } from '@/entities/session/model/training';

export interface HomePosition {
  lat: number;
  lng: number;
  zoom: number;
}
export interface MapPreferences {
  home: HomePosition | null;
  showTrajectory: boolean;
  showDirection: boolean;
  showDetectionZone: boolean;
  showIgnoreZone: boolean;
}
export interface SoundSettings {
  enabled: boolean;
  volume: number;
}
interface SettingsState {
  map: MapPreferences;
  training: TrainingSettings;
  sound: SoundSettings;
  setMap: (patch: Partial<MapPreferences>) => void;
  setTraining: (patch: Partial<TrainingSettings>) => void;
  setSound: (patch: Partial<SoundSettings>) => void;
}
const defaults = () => ({
  map: {
    home: null,
    showTrajectory: true,
    showDirection: false,
    showDetectionZone: true,
    showIgnoreZone: true,
  } as MapPreferences,
  training: { ...DEFAULT_TRAINING },
  sound: { enabled: true, volume: 0.5 },
});
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
const finite = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const boolean = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);
const normalize = (persisted: unknown) => {
  const saved = object(persisted);
  const map = object(saved.map);
  const sound = object(saved.sound);
  const training = object(saved.training);
  const initial = defaults();
  const home = object(map.home);
  const hasHome =
    typeof home.lat === 'number' &&
    Math.abs(home.lat) <= 90 &&
    typeof home.lng === 'number' &&
    Math.abs(home.lng) <= 180 &&
    typeof home.zoom === 'number' &&
    home.zoom >= 1 &&
    home.zoom <= 18;
  return {
    map: {
      home: hasHome ? { lat: home.lat as number, lng: home.lng as number, zoom: home.zoom as number } : null,
      showTrajectory: boolean(map.showTrajectory, true),
      showDirection: boolean(map.showDirection, false),
      showDetectionZone: boolean(map.showDetectionZone, true),
      showIgnoreZone: boolean(map.showIgnoreZone, true),
    },
    training: clampTraining({
      durationSec: finite(training.durationSec, initial.training.durationSec),
      maxConcurrent: finite(training.maxConcurrent, initial.training.maxConcurrent),
      spawnEveryMs: finite(training.spawnEveryMs, initial.training.spawnEveryMs),
    }),
    sound: {
      enabled: boolean(sound.enabled, true),
      volume: Math.min(1, Math.max(0, finite(sound.volume, 0.5))),
    },
  };
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults(),
      setMap: (patch) => set((state) => ({ map: normalize({ map: { ...state.map, ...patch } }).map })),
      setTraining: (patch) => set((state) => ({ training: clampTraining({ ...state.training, ...patch }) })),
      setSound: (patch) =>
        set((state) => ({ sound: normalize({ sound: { ...state.sound, ...patch } }).sound })),
    }),
    {
      name: 'rls-settings:guest',
      version: 2,
      migrate: normalize,
      merge: (saved, current) => ({ ...current, ...normalize(saved) }),
    },
  ),
);

/** Change storage namespace before exposing an account's screens. */
export const loadSettingsForUser = (userId: string | null) => {
  const name = `rls-settings:${userId ?? 'guest'}`;
  let saved: unknown;
  try {
    const raw = localStorage.getItem(name);
    saved = raw ? (JSON.parse(raw) as { state?: unknown }).state : undefined;
  } catch {
    saved = undefined;
  }
  useSettingsStore.persist.setOptions({ name });
  useSettingsStore.setState(normalize(saved));
};
