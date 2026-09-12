import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';

export const TILE_LAYERS = {
  STREET: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    options: { maxZoom: 19, subdomains: 'abcd' },
  },
  SATELLITE: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: { maxZoom: 19 },
  },
};

// Kalwakurthy / Nagarkurnool — where the operation is, so an empty map still
// opens somewhere meaningful rather than in the ocean.
const DEFAULT_CENTER = [16.74, 78.34];
const DEFAULT_ZOOM = 10;

/**
 * Leaflet map lifecycle for the Agents maps: creates the map once, swaps the
 * basemap on demand, and hands back a layer group to draw into.
 *
 * The map is destroyed on unmount rather than cached. React StrictMode mounts
 * every effect twice in development, and a Leaflet map left attached to its
 * container makes the second mount throw "Map container is already
 * initialized" — so teardown has to be real.
 */
export default function useLeafletMap({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  tileMode = 'STREET',
  zoomControlPosition = 'topright',
} = {}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerGroupRef = useRef(null);
  const tileLayerRef = useRef(null);

  const [isReady, setIsReady] = useState(false);

  // Create the map once, against whatever container is mounted.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const map = L.map(container, {
      center,
      zoom,
      zoomControl: false,
      attributionControl: false,
    });

    L.control.zoom({ position: zoomControlPosition }).addTo(map);

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setIsReady(true);

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
      tileLayerRef.current = null;
      setIsReady(false);
    };
    // Center/zoom are the *initial* view only; re-creating the map when they
    // change would throw away the user's panning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomControlPosition]);

  // Basemap, swapped in place so markers are never torn down with it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    const config = TILE_LAYERS[tileMode] || TILE_LAYERS.STREET;
    const layer = L.tileLayer(config.url, config.options);
    layer.addTo(map);
    // Keep the basemap under every marker and polygon.
    layer.bringToBack();
    tileLayerRef.current = layer;
  }, [tileMode, isReady]);

  /**
   * Leaflet measures its container on creation. Anything that resizes it
   * afterwards — entering fullscreen, a sidebar opening — leaves grey tiles
   * until it re-measures.
   */
  const invalidateSize = useCallback((delay = 200) => {
    const timer = setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  const panTo = useCallback((lat, lng, options = { animate: true }) => {
    const map = mapRef.current;
    if (!map || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    map.panTo([lat, lng], options);
  }, []);

  /** Frame every drawable point. Ignored when nothing has a coordinate. */
  const fitBounds = useCallback((points = [], options = { padding: [40, 40], maxZoom: 14 }) => {
    const map = mapRef.current;
    if (!map) return;

    const latLngs = points
      .map((p) => [Number(p.latitude ?? p.lat), Number(p.longitude ?? p.lng)])
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

    if (!latLngs.length) return;
    map.fitBounds(L.latLngBounds(latLngs), options);
  }, []);

  return {
    containerRef,
    mapRef,
    layerGroupRef,
    isReady,
    invalidateSize,
    panTo,
    fitBounds,
  };
}
