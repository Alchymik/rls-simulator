import React from 'react';
import ReactDOM from 'react-dom/client';
import * as leaflet from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@/shared/styles/global.css';
import { App } from '@/app/App';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import '@/app/resetOnSignOut';
import { installTrainingPersistence } from '@/app/trainingPersistence';

// leaflet-rotate — классический плагин Leaflet: он обращается к глобальному `L`
// (в его исходниках нет ни одного import). Поэтому сначала публикуем Leaflet в window,
// затем подгружаем плагин поворота карты (п.3.3.2.6 ТЗ) и только после этого рендерим.
type LeafletModule = typeof leaflet;
(window as unknown as { L?: LeafletModule }).L = leaflet;

const disposePersistence = installTrainingPersistence();
if (import.meta.hot) import.meta.hot.dispose(disposePersistence);

const render = () =>
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );

// Без catch сбой загрузки плагина оставлял белый экран без сообщения
import('leaflet-rotate').then(render, (e: unknown) => {
  console.error('[map] не удалось загрузить поворот карты', e);
  render();
});
