// Типы для leaflet-rotate (пакет не поставляет деклараций).
// Лицензия пакета — GPL-3.0, см. TECH_STACK.md.
import 'leaflet';

declare module 'leaflet' {
  interface MapOptions {
    /** Включает поворот карты (плагин leaflet-rotate). */
    rotate?: boolean;
    /** Начальный угол поворота, градусы. */
    bearing?: number;
    /** Встроенный контрол поворота не нужен: используем собственную панель компаса. */
    rotateControl?: boolean;
  }

  interface Map {
    setBearing(theta: number): this;
    getBearing(): number;
  }
}
