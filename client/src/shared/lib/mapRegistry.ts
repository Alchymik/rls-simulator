// client/src/shared/lib/mapRegistry.ts
import type { Map as LeafletMap } from 'leaflet';

/**
 * Активный экземпляр карты. Нужен подсистемам, которые не являются частью виджета карты:
 * снимок экрана в архиве событий отмечает на кадре цель, для чего рисует слой поверх карты.
 * Регистрация выполняется самим виджетом карты при монтировании.
 */
let activeMap: LeafletMap | null = null;

export const setActiveMap = (map: LeafletMap) => {
  activeMap = map;
};

/** Снимает регистрацию только если это всё ещё та же карта (уход со страницы не должен сбрасывать новую). */
export const clearActiveMap = (map: LeafletMap) => {
  if (activeMap === map) activeMap = null;
};

export const getActiveMap = (): LeafletMap | null => activeMap;
