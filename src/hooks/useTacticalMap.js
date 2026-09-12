import { useState, useRef, useCallback, useMemo, useEffect } from 'react';

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const PADDING = 0.08; // keep nodes off the very edge of the surface

/**
 * Shared pan/zoom + lat-lng projection for the tactical maps.
 *
 * Projects a set of nodes (anything with numeric `latitude` / `longitude`)
 * into percentage coordinates inside the map surface, and provides the
 * standard tactical controls: wheel zoom about the cursor, drag to pan,
 * and zoom in / out / reset.
 *
 * Usage:
 *   const { surfaceRef, project, transform, scale, handlers, zoomIn, zoomOut, reset } =
 *     useTacticalMap(nodes);
 *
 *   <div ref={surfaceRef} {...handlers}>
 *     <div style={{ transform }}>
 *       {nodes.map(n => { const { x, y } = project(n); ... })}
 *     </div>
 *   </div>
 */
export default function useTacticalMap(nodes = []) {
  const surfaceRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragState = useRef(null);

  // ─── Bounding box of every placeable node ───────────────────────
  const bounds = useMemo(() => {
    const points = nodes.filter(
      (n) => Number.isFinite(Number(n.latitude)) && Number.isFinite(Number(n.longitude))
    );

    if (!points.length) return null;

    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    points.forEach((n) => {
      const lat = Number(n.latitude);
      const lng = Number(n.longitude);
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    });

    return { minLat, maxLat, minLng, maxLng };
  }, [nodes]);

  /**
   * Project one node to { x, y } percentages of the surface.
   * A single node — or a set sharing one coordinate — lands in the centre.
   */
  const project = useCallback(
    (node) => {
      const lat = Number(node?.latitude);
      const lng = Number(node?.longitude);

      if (!bounds || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        return { x: 50, y: 50 };
      }

      const latSpan = bounds.maxLat - bounds.minLat;
      const lngSpan = bounds.maxLng - bounds.minLng;

      const usable = 1 - PADDING * 2;
      const fx = lngSpan === 0 ? 0.5 : (lng - bounds.minLng) / lngSpan;
      // latitude grows northwards, y grows downwards
      const fy = latSpan === 0 ? 0.5 : (bounds.maxLat - lat) / latSpan;

      return {
        x: (PADDING + fx * usable) * 100,
        y: (PADDING + fy * usable) * 100,
      };
    },
    [bounds]
  );

  const clampScale = (value) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));

  // ─── Zoom about a point (defaults to the surface centre) ────────
  const zoomAbout = useCallback((nextScaleRaw, originX, originY) => {
    setScale((prevScale) => {
      const nextScale = clampScale(nextScaleRaw);
      if (nextScale === prevScale) return prevScale;

      const surface = surfaceRef.current;
      if (surface) {
        const rect = surface.getBoundingClientRect();
        const px = originX ?? rect.width / 2;
        const py = originY ?? rect.height / 2;

        setOffset((prevOffset) => {
          // keep the point under the cursor fixed while scaling
          const ratio = nextScale / prevScale;
          return {
            x: px - (px - prevOffset.x) * ratio,
            y: py - (py - prevOffset.y) * ratio,
          };
        });
      }

      if (nextScale === MIN_SCALE) setOffset({ x: 0, y: 0 });

      return nextScale;
    });
  }, []);

  const zoomIn = useCallback(() => zoomAbout(scale * 1.4), [scale, zoomAbout]);
  const zoomOut = useCallback(() => zoomAbout(scale / 1.4), [scale, zoomAbout]);

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  // Wheel zoom needs a non-passive listener to be able to preventDefault,
  // which React's onWheel prop cannot guarantee.
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return undefined;

    const onWheel = (e) => {
      e.preventDefault();
      const rect = surface.getBoundingClientRect();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      zoomAbout(scale * factor, e.clientX - rect.left, e.clientY - rect.top);
    };

    surface.addEventListener('wheel', onWheel, { passive: false });
    return () => surface.removeEventListener('wheel', onWheel);
  }, [scale, zoomAbout]);

  // ─── Drag to pan ────────────────────────────────────────────────
  const onMouseDown = useCallback(
    (e) => {
      // let clicks on nodes through; only the surface itself drags
      if (e.button !== 0) return;
      dragState.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: offset.x,
        originY: offset.y,
        moved: false,
      };
    },
    [offset]
  );

  const onMouseMove = useCallback((e) => {
    const drag = dragState.current;
    if (!drag) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;

    setOffset({ x: drag.originX + dx, y: drag.originY + dy });
  }, []);

  const endDrag = useCallback(() => {
    dragState.current = null;
  }, []);

  const handlers = {
    onMouseDown,
    onMouseMove,
    onMouseUp: endDrag,
    onMouseLeave: endDrag,
  };

  return {
    surfaceRef,
    project,
    scale,
    offset,
    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
    handlers,
    zoomIn,
    zoomOut,
    reset,
    isZoomed: scale > 1 || offset.x !== 0 || offset.y !== 0,
    hasCoordinates: !!bounds,
  };
}
