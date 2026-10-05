// client/src/shared/lib/units.ts
export const MS_TO_KMH = 3.6;

/** Метры в секунду → километры в час. */
export const msToKmh = (metersPerSecond: number, fractionDigits = 1): number =>
  +(metersPerSecond * MS_TO_KMH).toFixed(fractionDigits);

/** Секунды → «мм:сс». */
export const formatDuration = (sec: number): string =>
  `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
