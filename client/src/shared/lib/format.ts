// client/src/shared/lib/format.ts
const LOCALE = 'ru-RU';

/** Дата и время «05.10.2026, 19:35:09». */
export const formatDateTime = (value: Date | number): string => new Date(value).toLocaleString(LOCALE);

/** Время «19:35». */
export const formatTime = (value: Date | number): string =>
  new Date(value).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });

/** Дата «05 окт. 2026 г.». */
export const formatDate = (value: Date | number): string =>
  new Date(value).toLocaleDateString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' });

/** Координаты цели: «59.550000, 30.800000» либо с указанием полушарий. */
export const formatCoordinates = (lat: number, lng: number, withHemisphere = false): string =>
  withHemisphere
    ? `${Math.abs(lat).toFixed(6)} ${lat >= 0 ? 'с.ш.' : 'ю.ш.'}, ${Math.abs(lng).toFixed(6)} ${lng >= 0 ? 'в.д.' : 'з.д.'}`
    : `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

const secondsFormat = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Короткий интервал «4,2 с»: время реакции измеряется долями секунды, формат мм:сс его теряет. */
export const formatSeconds = (sec: number): string => `${secondsFormat.format(sec)} с`;
