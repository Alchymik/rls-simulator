// Пакет leaflet-rotate не поставляет деклараций, а импортируется только ради побочного эффекта
// (патчит L.Map через глобальный L). Ambient-объявление обязано лежать в файле без import/export.
declare module 'leaflet-rotate';
