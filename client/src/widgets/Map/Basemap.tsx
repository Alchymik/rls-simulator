import { useMemo, useState } from 'react';
import { TileLayer } from 'react-leaflet';
import styles from './RadarMap.module.css';

const ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';

/** Radar geometry remains usable when the external imagery service is offline. */
export const Basemap = () => {
  const [unavailable, setUnavailable] = useState(false);
  const events = useMemo(() => ({ tileerror: () => setUnavailable(true) }), []);
  return unavailable ? (
    <div className={styles.mapNotice} role="status">
      Подложка недоступна. Показана схема РЛС.
      <button onClick={() => setUnavailable(false)}>Повторить загрузку карты</button>
    </div>
  ) : (
    <TileLayer
      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      attribution={ATTRIBUTION}
      eventHandlers={events}
    />
  );
};
