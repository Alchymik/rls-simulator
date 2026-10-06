// client/src/features/events/lib/captureScreenshot.ts
import { divIcon, marker } from 'leaflet';
import { domToCanvas } from 'modern-screenshot';
import { getActiveMap } from '@/shared/lib/mapRegistry';

/** Целевая ширина снимка, px */
const SCREENSHOT_WIDTH = 960;
/** Ширина миниатюры для списка архива, px */
const THUMBNAIL_WIDTH = 240;
const JPEG_QUALITY = 0.62;

/** Отметка на снимке: цель, которая была видна оператору в момент тревоги */
export interface CaptureMark {
  lat: number;
  lng: number;
  /** Цель, из-за которой сработала тревога: кольцо крупнее и с подписью сектора и скорости */
  accent?: boolean;
  /** Подпись над кольцом (только для акцентной отметки) */
  label?: string;
}

export interface Capture {
  screenshot: string;
  thumbnail: string;
}

/**
 * Экранная позиция точки относительно корня приложения.
 * Берётся у временного маркера карты: смещение, масштаб и поворот карты учитывает сам Leaflet,
 * а не ручная проекция координат.
 */
const projectPoint = (root: HTMLElement, lat: number, lng: number): { x: number; y: number } | null => {
  const map = getActiveMap();
  if (!map) return null;

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
 * Отметка рисуется на готовом кадре, а не элементами страницы: оператор не видит мелькающих колец,
 * а отметки соседних тревог не попадают в чужой снимок.
 * @param k множитель «пиксели кадра / CSS-пиксели»
 */
const drawMark = (ctx: CanvasRenderingContext2D, mark: CaptureMark, x: number, y: number, k: number) => {
  ctx.beginPath();
  ctx.arc(x, y, (mark.accent ? 14 : 9) * k, 0, Math.PI * 2);
  ctx.lineWidth = (mark.accent ? 3 : 2) * k;
  ctx.strokeStyle = mark.accent ? '#c62828' : '#ffd166';
  ctx.fillStyle = mark.accent ? 'rgba(255, 45, 85, 0.25)' : 'rgba(255, 209, 102, 0.18)';
  ctx.fill();
  ctx.stroke();

  if (!mark.label) return;
  ctx.font = `600 ${12 * k}px system-ui, sans-serif`;
  const width = ctx.measureText(mark.label).width + 16 * k;
  ctx.fillStyle = 'rgba(10, 30, 70, 0.88)';
  ctx.fillRect(x - width / 2, y - 42 * k, width, 22 * k);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(mark.label, x, y - 31 * k);
};

const toThumbnail = (source: HTMLCanvasElement): string => {
  const thumb = document.createElement('canvas');
  thumb.width = THUMBNAIL_WIDTH;
  thumb.height = Math.round((source.height * THUMBNAIL_WIDTH) / source.width);
  thumb.getContext('2d')?.drawImage(source, 0, 0, thumb.width, thumb.height);
  return thumb.toDataURL('image/jpeg', 0.7);
};

/**
 * Снимок экрана ПО для архива тревожных событий (п.3.1 ТЗ).
 *
 * В кадр должен попадать весь интерфейс, поэтому размер задаётся через `scale` (множитель DPI),
 * а не через `width`: `width` задаёт ширину узла перед рендером, из-за чего раскладка
 * перестраивается под это число и часть экрана теряется при широком окне, а при узком
 * добавляется пустая полоса. Библиотека сама встраивает внешние изображения (тайлы карты).
 */
export const captureScreenshot = async (marks: CaptureMark[] = []): Promise<Capture> => {
  const root = document.getElementById('root');
  if (!root) return { screenshot: '', thumbnail: '' };

  // Уменьшаем широкие окна до целевой ширины, но никогда не растягиваем узкие
  const width = root.clientWidth;
  const height = root.clientHeight;
  const scale = Math.min(1, SCREENSHOT_WIDTH / width) || 1;
  // Позиции снимаются до кадра, пока карта не сдвинулась
  const points = marks.map((mark) => ({ mark, point: projectPoint(root, mark.lat, mark.lng) }));

  // Freeze the DOM before waiting on images/fonts: a slow upload must not capture a later page.
  const snapshot = root.cloneNode(true) as HTMLElement;
  snapshot.id = 'rls-capture-root';
  snapshot.setAttribute('aria-hidden', 'true');
  snapshot.inert = true;
  Object.assign(snapshot.style, {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    width: `${width}px`,
    height: `${height}px`,
  });
  snapshot.style.transform = 'translateZ(0)';
  document.querySelectorAll('dialog[open]').forEach((dialog) => snapshot.appendChild(dialog.cloneNode(true)));
  document.body.appendChild(snapshot);
  const canvases = root.querySelectorAll('canvas');
  snapshot.querySelectorAll('canvas').forEach((copy, index) => {
    const original = canvases[index];
    if (original) copy.getContext('2d')?.drawImage(original, 0, 0);
  });
  try {
    const canvas = await domToCanvas(snapshot, { scale, backgroundColor: '#eef1f5', timeout: 5000 });
    const ctx = canvas.getContext('2d');
    const k = canvas.width / width;
    if (ctx) {
      for (const { mark, point } of points) if (point) drawMark(ctx, mark, point.x * k, point.y * k, k);
    }
    return { screenshot: canvas.toDataURL('image/jpeg', JPEG_QUALITY), thumbnail: toThumbnail(canvas) };
  } catch {
    // Сбой снимка не должен прерывать тренировку — событие сохранится без картинки
    return { screenshot: '', thumbnail: '' };
  } finally {
    snapshot.remove();
  }
};
