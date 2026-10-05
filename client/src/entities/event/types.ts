// client/src/entities/event/types.ts
/** Сектор, в котором цель вошла в зону обнаружения (п.3.3.1.4 ТЗ). */
export type Sector = 'Север' | 'Юг' | 'Запад' | 'Восток';

/** Событие обнаружения цели в зоне обнаружения со снимком экрана (п.3.1 ТЗ). */
export interface AlarmEvent {
  id: string;
  userId: string;
  at: number;
  targetId: string;
  sector: Sector;
  speedKmh: number;
  lat: number;
  lng: number;
  /** data URL снимка экрана ПО в момент обнаружения */
  screenshot: string;
}
