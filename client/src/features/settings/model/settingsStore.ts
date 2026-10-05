// client/src/features/settings/model/settingsStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface HomePosition {
  lat: number;
  lng: number;
  zoom: number;
}

/** Параметры сеанса, настраиваемые в окне «Настройки тренировки» (п.3.3 ТЗ, п.2). */
export interface TrainingSettings {
  durationSec: number;
  maxConcurrent: number;
  spawnEveryMs: number;
}

export interface MapPreferences {
  /** null — домашняя позиция совпадает с центром РЛС */
  home: HomePosition | null;
  showTrajectory: boolean;
  showDirection: boolean;
  showDetectionZone: boolean;
  showIgnoreZone: boolean;
}

export interface SoundSettings {
  enabled: boolean;
  /** 0..1 */
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

// Значения по умолчанию для окна настроек тренировки: maxConcurrent = 20 согласно п.3.3.1.4.3 ТЗ
export const DEFAULT_TRAINING: TrainingSettings = {
  durationSec: 120,
  maxConcurrent: 20,
  spawnEveryMs: 1500,
};

export const TRAINING_LIMITS = {
  durationSec: { min: 30, max: 3600 },
  maxConcurrent: { min: 1, max: 20 },
  spawnEveryMs: { min: 300, max: 10_000 },
} as const;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      map: {
        home: null,
        showTrajectory: true,
        // Направление по умолчанию показывает след траектории; шеврон курса включается в настройках
        showDirection: false,
        showDetectionZone: true,
        showIgnoreZone: true,
      },
      training: DEFAULT_TRAINING,
      sound: { enabled: true, volume: 0.5 },
      setMap: (patch) => set((s) => ({ map: { ...s.map, ...patch } })),
      setTraining: (patch) => set((s) => ({ training: { ...s.training, ...patch } })),
      setSound: (patch) => set((s) => ({ sound: { ...s.sound, ...patch } })),
    }),
    {
      name: 'rls-settings',
      version: 2,
      // Версия 2: направление движения показывает след траектории, шеврон курса выключен по умолчанию
      migrate: (persisted) => {
        const saved = (persisted ?? {}) as Partial<SettingsState>;
        return { ...saved, map: { ...saved.map, showDirection: false, showTrajectory: true } };
      },
      // Сохранённое состояние прошлых версий не содержит новых полей: приводим его к текущей
      // форме, а секции сливаем в merge, иначе часть карты перестанет отображаться
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<SettingsState>;
        return {
          ...current,
          map: { ...current.map, ...saved.map },
          training: { ...current.training, ...saved.training },
          sound: { ...current.sound, ...saved.sound },
        };
      },
    },
  ),
);
