// client/src/features/events/lib/captureScreenshot.ts
import { divIcon, marker } from 'leaflet';
import { domToJpeg } from 'modern-screenshot';
import { getActiveMap } from '@/shared/lib/mapRegistry';

/** Целевая ширина снимка, px */
const SCREENSHOT_WIDTH = 960;
const JPEG_QUALITY = 0.62;

/** Отметка на снимке: цель, которая была видна оператору в момент тревоги */
export interface CaptureMark {
  lat: number;
  lng: number;
  /** Цель, из-за которой сработала тревога: кольцо крупнее и с подписью сектора и скорости */
  accent?: boolean;
  /** Подпись под кольцом (только для акцентной отметки) */
  label?: string;
}

/**
 * Экранная позиция точки относительно документа.
 * Берётся у временного маркера карты: смещение, масштаб и поворот карты учитывает сам Leaflet,
 * а не ручная проекция координат.
 */
const projectPoint = (lat: number, lng: number): { x: number; y: number } | null => {
  const map = getActiveMap();
  const root = document.getElementById('root');
  if (!map || !root) return null;

  const probe = marker([lat, lng], {
    icon: divIcon({ className: 'rls-capture-probe', html: '', iconSize: [0, 0] }),
    interactive: false,
    keyboard: false,
  }).addTo(map);

  const rect = probe.getElement()?.getBoundingClientRect();
  probe.remove();
  if (!rect) return null;

  const rootRect = root.getBoundingClientRect();
  return { x: rect.left - rootRect.left, y: rect.top - rootRect.top };
};

/**
 * Отметки обнаруженных целей (п.3.1 ТЗ): по снимку должно быть видно, какая обстановка была
 * на экране и какая именно цель вызвала тревогу.
 *
 * Отметки строятся обычными элементами страницы, а не слоями карты: инструмент снимка переносит
 * содержимое страницы, но слои, добавленные внутрь контейнера карты, в кадр не попадают.
 */
const addMark = (mark: CaptureMark): HTMLElement | null => {
  const root = document.getElementById('root');
  const point = projectPoint(mark.lat, mark.lng);
  if (!root || !point) return null;

  const box = document.createElement('div');
  box.className = mark.accent ? 'rls-target-mark rls-target-mark--accent' : 'rls-target-mark';
  box.style.left = `${point.x}px`;
  box.style.top = `${point.y}px`;

  const ring = document.createElement('span');
  ring.className = 'rls-target-mark__ring';
  box.append(ring);

  if (mark.label) {
    const label = document.createElement('b');
    label.className = 'rls-target-mark__label';
    label.textContent = mark.label;
    box.append(label);
  }

  root.append(box);
  return box;
};

/**
 * Даёт браузеру отрисовать добавленные отметки до снятия кадра.
 * Ожидание ограничено по времени: в свёрнутом или фоновом окне кадры не запрашиваются,
 * и без ограничения снимок вместе с конвейером тревоги завис бы.
 */
const waitForPaint = () =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 150);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        clearTimeout(timer);
        resolve();
      }),
    );
  });

/**
 * Снимок экрана ПО для архива тревожных событий (п.3.1 ТЗ).
 *
 * В кадр должен попадать весь интерфейс, поэтому размер задаётся через `scale` (множитель DPI),
 * а не через `width`: `width` задаёт ширину узла перед рендером, из-за чего раскладка
 * перестраивается под это число и часть экрана теряется при широком окне, а при узком
 * добавляется пустая полоса. Библиотека сама встраивает внешние изображения (тайлы карты).
 */
export const captureScreenshot = async (marks: CaptureMark[] = []): Promise<string> => {
  const root = document.getElementById('root');
  if (!root) return '';

  // Уменьшаем широкие окна до целевой ширины, но никогда не растягиваем узкие
  const scale = Math.min(1, SCREENSHOT_WIDTH / root.clientWidth) || 1;

  const added = marks.map(addMark).filter((el): el is HTMLElement => el !== null);
  if (added.length) await waitForPaint();

  try {
    return await domToJpeg(root, {
      scale,
      quality: JPEG_QUALITY,
      backgroundColor: '#eef1f5',
      timeout: 5000,
    });
  } catch {
    // Сбой снимка не должен прерывать тренировку — событие сохранится без картинки
    return '';
  } finally {
    for (const el of added) el.remove();
  }
};
