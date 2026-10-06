// client/src/entities/event/types.ts
/** Сектор, в котором цель вошла в зону обнаружения (п.3.3.1.4 ТЗ). */
export type Sector = 'Север' | 'Юг' | 'Запад' | 'Восток';

/** Событие в списке архива: без полного снимка, чтобы список не весил мегабайты (п.3.1 ТЗ). */
export interface AlarmEventSummary {
  id: string;
  userId: string;
  at: number;
  targetId: string;
  sector: Sector;
  speedKmh: number;
  lat: number;
  lng: number;
  /** data URL миниатюры (~10 КБ); пустая строка — снимок не удался */
  thumbnail: string;
}

/** Событие обнаружения цели со снимком экрана ПО в момент обнаружения. */
export interface AlarmEvent extends AlarmEventSummary {
  /** data URL снимка экрана */
  screenshot: string;
}
