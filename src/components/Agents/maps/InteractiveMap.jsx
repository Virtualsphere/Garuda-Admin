import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  PenTool,
  Check,
  Undo2,
  Trash2,
  Search,
} from 'lucide-react';

/**
 * Schematic SVG map of the territory — village polygons, land parcels and town
 * outlines drawn on a plain grid rather than on satellite tiles.
 *
 * This is deliberately NOT the Leaflet map. It answers a different question:
 * where villages sit *relative to each other* and what their allotment state
 * is, with no imagery to read around. It is also the surface boundaries are
 * drawn on, because click-to-place-a-point is far easier without a basemap
 * panning underneath.
 *
 * Projection is a flat equirectangular approximation. Over a district-sized
 * area the distortion is not visible, and it keeps unproject() — needed for
 * edit mode — a plain inverse rather than a spherical solve.
 */

// Where the operation is, used only when no data has coordinates yet.
const FALLBACK_CENTER = { lat: 16.74, lng: 78.34 };
const SCALE_BASE = 5200; // px per degree at zoom 1

// A district-wide territory spans ~0.7°, which is ~3,600px at zoom 1 — far
// wider than the canvas. The floor has to go low enough for "fit" to actually
// frame that, or the button clamps and still shows nothing.
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 6;

const VIEW_W = 800;
const VIEW_H = 500;

const EMPTY = [];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export default function InteractiveMap({
  height = '420px',
  towns = EMPTY,
  villages = EMPTY,
  lands = EMPTY,
  candidatePins = EMPTY,
  selectedVillageId,
  selectedLandId,
  onSelectVillage,
  onSelectLand,
  editable = false,
  editType = 'polygon',
  initialPolygon = EMPTY,
  initialPin,
  onSavePolygon,
  onSavePin,
  showAllotmentColors = false,
  agentMapMode = false,
}) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [isEditActive, setIsEditActive] = useState(false);
  const [editPoints, setEditPoints] = useState(initialPolygon);
  const [editPinCoord, setEditPinCoord] = useState(initialPin);

  /* ── Centre ───────────────────────────────────────────────────
   * The prototype hardcodes a centre. Real village coordinates would then sit
   * far off-canvas, so the centre is derived from the data and only falls back
   * to a constant when nothing is placeable.
   */
  const center = useMemo(() => {
    const points = [];
    villages.forEach((v) => {
      const lat = num(v.centerCoordinates?.lat);
      const lng = num(v.centerCoordinates?.lng);
      if (lat !== null && lng !== null) points.push([lat, lng]);
    });
    lands.forEach((l) => {
      const lat = num(l.gpsCoordinates?.lat);
      const lng = num(l.gpsCoordinates?.lng);
      if (lat !== null && lng !== null) points.push([lat, lng]);
    });

    if (!points.length) return FALLBACK_CENTER;

    const lats = points.map((p) => p[0]);
    const lngs = points.map((p) => p[1]);
    return {
      lat: (Math.min(...lats) + Math.max(...lats)) / 2,
      lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    };
  }, [villages, lands]);

  const project = useCallback(
    (lat, lng) => ({
      x: VIEW_W / 2 + (lng - center.lng) * SCALE_BASE * zoom + pan.x,
      y: VIEW_H / 2 - (lat - center.lat) * SCALE_BASE * zoom + pan.y,
    }),
    [center, zoom, pan]
  );

  // Screen → coordinate, for placing boundary points in edit mode.
  const unproject = useCallback(
    (screenX, screenY, width, heightVal) => {
      // The SVG scales to its container, so a click in CSS pixels has to be
      // converted into viewBox units before it can be unprojected.
      const vx = (screenX / width) * VIEW_W;
      const vy = (screenY / heightVal) * VIEW_H;
      return {
        lat:
          Math.round(
            (-(vy - VIEW_H / 2 - pan.y) / (SCALE_BASE * zoom) + center.lat) * 10000
          ) / 10000,
        lng:
          Math.round(
            ((vx - VIEW_W / 2 - pan.x) / (SCALE_BASE * zoom) + center.lng) * 10000
          ) / 10000,
      };
    },
    [center, zoom, pan]
  );

  /* ── Pan & zoom ───────────────────────────────────────────── */

  const handleMouseDown = (e) => {
    if (isEditActive) return; // clicks place points instead
    dragRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y, moved: false };
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    drag.moved = true;
    setPan({ x: e.clientX - drag.x, y: e.clientY - drag.y });
  };

  const endDrag = () => {
    dragRef.current = null;
    setIsDragging(false);
  };

  // Wheel zoom about the cursor. A non-passive listener is required to
  // preventDefault, which React's onWheel prop cannot guarantee.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;

    const onWheel = (e) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * VIEW_W;
      const py = ((e.clientY - rect.top) / rect.height) * VIEW_H;

      setZoom((prev) => {
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
        if (next === prev) return prev;
        // Keep the point under the cursor fixed while scaling.
        setPan((p) => ({
          x: px - (px - p.x - VIEW_W / 2) * (next / prev) - VIEW_W / 2,
          y: py - (py - p.y - VIEW_H / 2) * (next / prev) - VIEW_H / 2,
        }));
        return next;
      });
    };

    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  /* ── Edit mode ────────────────────────────────────────────── */

  const handleMapClick = (e) => {
    if (!isEditActive || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const coord = unproject(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);

    if (editType === 'pin') setEditPinCoord(coord);
    else setEditPoints((prev) => [...prev, coord]);
  };

  const handleStartEdit = () => {
    setEditPoints(initialPolygon ? [...initialPolygon] : []);
    setEditPinCoord(initialPin);
    setIsEditActive(true);
  };

  const handleSaveBoundary = () => {
    if (editType === 'polygon') onSavePolygon?.(editPoints);
    else if (editPinCoord) onSavePin?.(editPinCoord);
    setIsEditActive(false);
  };

  /* ── Framing ──────────────────────────────────────────────── */

  const handleReset = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  /**
   * Actually frame the data, rather than the prototype's fixed zoom of 1.1 —
   * with real coordinates a constant zoom frames nothing in particular.
   */
  const handleFit = () => {
    const points = [];
    villages.forEach((v) => {
      const lat = num(v.centerCoordinates?.lat);
      const lng = num(v.centerCoordinates?.lng);
      if (lat !== null && lng !== null) points.push([lat, lng]);
    });
    lands.forEach((l) => {
      const lat = num(l.gpsCoordinates?.lat);
      const lng = num(l.gpsCoordinates?.lng);
      if (lat !== null && lng !== null) points.push([lat, lng]);
    });

    if (!points.length) return handleReset();

    const lats = points.map((p) => p[0]);
    const lngs = points.map((p) => p[1]);
    const latSpan = Math.max(...lats) - Math.min(...lats);
    const lngSpan = Math.max(...lngs) - Math.min(...lngs);

    // A single point (or a cluster at one coordinate) has no span to fit.
    if (latSpan < 1e-6 && lngSpan < 1e-6) {
      setPan({ x: 0, y: 0 });
      setZoom(1.5);
      return;
    }

    const padding = 0.85;
    const fitZoom = Math.min(
      (VIEW_W * padding) / (lngSpan * SCALE_BASE || 1),
      (VIEW_H * padding) / (latSpan * SCALE_BASE || 1)
    );

    setPan({ x: 0, y: 0 });
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fitZoom)));
  };

  /**
   * Frame the territory the first time data arrives.
   *
   * Zoom 1 is only meaningful for a handful of villages in one mandal; a real
   * district lands entirely off-canvas at that scale, so opening on an empty
   * grid would be the normal case rather than the exception. Refits when the
   * data identity changes (a new filter), but never fights the user afterwards.
   */
  const fittedKeyRef = useRef(null);
  const dataKey = useMemo(
    () =>
      `${villages.length}:${lands.length}:${center.lat.toFixed(4)},${center.lng.toFixed(4)}`,
    [villages.length, lands.length, center]
  );

  useEffect(() => {
    if (fittedKeyRef.current === dataKey) return;
    if (!villages.length && !lands.length) return;
    fittedKeyRef.current = dataKey;
    handleFit();
    // handleFit reads the same data this key is derived from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey]);

  /* ── Data ─────────────────────────────────────────────────── */

  const filteredVillages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return villages;
    return villages.filter(
      (v) =>
        String(v.name || '').toLowerCase().includes(q) ||
        String(v.mandal || '').toLowerCase().includes(q) ||
        String(v.district || '').toLowerCase().includes(q)
    );
  }, [villages, searchQuery]);

  const polygonPoints = useCallback(
    (poly) =>
      (poly || [])
        .map((p) => {
          const lat = num(p.lat);
          const lng = num(p.lng);
          if (lat === null || lng === null) return null;
          const pt = project(lat, lng);
          return `${pt.x},${pt.y}`;
        })
        .filter(Boolean)
        .join(' '),
    [project]
  );

  /**
   * Allotment colouring. The three states are mutually exclusive and checked
   * in this order, which is what the legend below mirrors — the prototype's
   * legend named a fourth colour it never drew.
   */
  const villageTone = (vil, isSelected) => {
    if (showAllotmentColors || agentMapMode) {
      if (Number(vil.vacancy) === 0) return { fill: '#f1f5f9', stroke: '#64748b' };
      if (Number(vil.interestedAgentsCount) > 0) return { fill: '#e0f2fe', stroke: '#0284c7' };
      return { fill: '#dcfce7', stroke: '#16a34a' };
    }
    if (isSelected) return { fill: '#EFF6FF', stroke: '#2563EB' };
    return { fill: '#ffffff', stroke: '#cbd5e1' };
  };

  const heightClass =
    { '280px': 'h-[280px]', '320px': 'h-[320px]', '360px': 'h-[360px]', '440px': 'h-[440px]', '480px': 'h-[480px]', '500px': 'h-[500px]' }[
      height
    ] || 'h-[420px]';

  const placeableCount = villages.filter(
    (v) => num(v.centerCoordinates?.lat) !== null
  ).length;

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${heightClass} bg-stone-100/80 border border-stone-200 rounded-lg overflow-hidden select-none flex flex-col`}
    >
      {/* Control bar */}
      <div className="absolute top-2 left-2 right-2 z-10 flex items-start justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto flex items-center bg-white/95 backdrop-blur-xs border border-stone-200 rounded shadow-xs px-2.5 py-1 text-xs w-56">
          <Search className="w-3.5 h-3.5 text-stone-400 shrink-0 mr-1.5" />
          <input
            type="text"
            placeholder="Search village, mandal…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-stone-800"
          />
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5 bg-white/95 backdrop-blur-xs border border-stone-200 rounded p-1 shadow-xs text-xs">
          {editable && (
            <>
              {!isEditActive ? (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="px-2 py-1 rounded bg-[#16A34A] hover:bg-[#15803D] text-white font-medium flex items-center gap-1 text-[11px] transition-colors"
                >
                  <PenTool className="w-3 h-3" />
                  <span>Edit mode</span>
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditPoints((p) => p.slice(0, -1))}
                    title="Undo last point"
                    className="p-1 rounded hover:bg-stone-100 text-stone-700"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditPoints([]);
                      setEditPinCoord(undefined);
                    }}
                    title="Clear points"
                    className="p-1 rounded hover:bg-stone-100 text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveBoundary}
                    className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-1 text-[11px]"
                  >
                    <Check className="w-3 h-3" />
                    <span>Save</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditActive(false)}
                    className="px-2 py-1 rounded border border-stone-200 hover:bg-stone-100 text-stone-700 text-[11px]"
                  >
                    Cancel
                  </button>
                </div>
              )}
              <div className="w-px h-4 bg-stone-200 my-auto" />
            </>
          )}

          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.25))}
            title="Zoom in"
            className="p-1 rounded hover:bg-stone-100 text-stone-700"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z / 1.25))}
            title="Zoom out"
            className="p-1 rounded hover:bg-stone-100 text-stone-700"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleFit}
            title="Fit to territory"
            className="p-1 rounded hover:bg-stone-100 text-stone-700"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleReset}
            title="Reset view"
            className="p-1 rounded hover:bg-stone-100 text-stone-700"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        className={`w-full h-full ${
          isEditActive ? 'cursor-crosshair' : isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onClick={handleMapClick}
      >
        <defs>
          <pattern id="garuda-map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={VIEW_W} height={VIEW_H} fill="url(#garuda-map-grid)" />

        {/* Towns */}
        {towns.map((town) => {
          const pts = polygonPoints(town.boundaryPolygon);
          if (!pts) return null;
          const lat = num(town.centerCoordinates?.lat);
          const lng = num(town.centerCoordinates?.lng);
          const c = lat !== null && lng !== null ? project(lat, lng) : null;

          return (
            <g key={town.id}>
              <polygon
                points={pts}
                fill="#f3f4f6"
                stroke="#9ca3af"
                strokeWidth="1.5"
                strokeDasharray="4,2"
                opacity={0.8}
              />
              {c && (
                <text
                  x={c.x}
                  y={c.y}
                  textAnchor="middle"
                  className="text-[10px] font-bold fill-stone-500 tracking-wide uppercase pointer-events-none select-none"
                >
                  {town.name}
                </text>
              )}
            </g>
          );
        })}

        {/* Context watermark */}
        <g className="pointer-events-none select-none" transform="translate(14, 20)">
          <rect
            x="0"
            y="0"
            width="184"
            height="32"
            rx="6"
            fill="#ffffff"
            fillOpacity="0.88"
            stroke="#cbd5e1"
            strokeWidth="1"
          />
          <text x="8" y="14" className="text-[9px] font-bold fill-stone-800">
            Schematic territory view
          </text>
          <text x="8" y="25" className="text-[8px] fill-stone-500 font-medium">
            {placeableCount} village{placeableCount === 1 ? '' : 's'} ·{' '}
            {center.lat.toFixed(2)}°N, {center.lng.toFixed(2)}°E
          </text>
        </g>

        {/* Villages */}
        {filteredVillages.map((vil) => {
          const lat = num(vil.centerCoordinates?.lat);
          const lng = num(vil.centerCoordinates?.lng);
          if (lat === null || lng === null) return null;

          const isSelected = String(selectedVillageId) === String(vil.id);
          const tone = villageTone(vil, isSelected);
          const pts = polygonPoints(vil.boundaryPolygon);
          const c = project(lat, lng);

          const pins = candidatePins.filter(
            (p) =>
              String(p.village || '').toLowerCase() === String(vil.name || '').toLowerCase()
          );

          return (
            <g
              key={vil.id}
              className="cursor-pointer transition-opacity hover:opacity-95"
              onClick={(e) => {
                e.stopPropagation();
                if (!isEditActive) onSelectVillage?.(vil);
              }}
            >
              {pts && (
                <polygon
                  points={pts}
                  fill={tone.fill}
                  stroke={tone.stroke}
                  strokeWidth={isSelected ? '2.5' : '1.5'}
                />
              )}

              {/* When a village has no surveyed boundary, the marker carries
                  the allotment colour so the state is still readable. */}
              <circle
                cx={c.x}
                cy={c.y - 1}
                r={isSelected ? '5' : '3.5'}
                fill={isSelected ? '#2563EB' : tone.stroke}
                stroke="#ffffff"
                strokeWidth={pts ? '0' : '1.5'}
              />

              <text
                x={c.x}
                y={c.y - 8}
                textAnchor="middle"
                className="text-[10px] font-bold fill-stone-900 pointer-events-none select-none"
              >
                {vil.name}
              </text>
              <text
                x={c.x}
                y={c.y + 7}
                textAnchor="middle"
                className="text-[7.5px] font-medium fill-stone-500 pointer-events-none select-none"
              >
                {vil.mandal} Mdl
              </text>

              {(showAllotmentColors || agentMapMode) && (
                <g transform={`translate(${c.x}, ${c.y + 17})`} className="pointer-events-none">
                  <rect
                    x="-34"
                    y="-7"
                    width="68"
                    height="14"
                    rx="7"
                    fill="#ffffff"
                    fillOpacity="0.95"
                    stroke={isSelected ? '#2563EB' : tone.stroke}
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="3"
                    textAnchor="middle"
                    className="text-[8px] font-bold fill-stone-800 select-none"
                  >
                    A{vil.attachedAgentsCount ?? 0} | I{vil.interestedAgentsCount ?? 0} | V
                    {vil.vacancy ?? 0}
                  </text>
                </g>
              )}

              {pins.slice(0, 4).map((cand, idx) => (
                <g
                  key={cand.id ?? idx}
                  transform={`translate(${c.x + (idx % 2 === 0 ? -1 : 1) * 14}, ${
                    c.y + 28 + idx * 11
                  })`}
                  className="pointer-events-none"
                >
                  <rect x="-22" y="-6" width="44" height="12" rx="6" fill="#2563EB" fillOpacity="0.9" />
                  <text x="0" y="2.5" textAnchor="middle" className="text-[7px] font-bold fill-white">
                    {String(cand.name || '').split(' ')[0]}
                  </text>
                </g>
              ))}
            </g>
          );
        })}

        {/* Lands */}
        {lands.map((land) => {
          const lat = num(land.gpsCoordinates?.lat);
          const lng = num(land.gpsCoordinates?.lng);
          if (lat === null || lng === null) return null;

          const isSelected = String(selectedLandId) === String(land.id);
          const pts = polygonPoints(land.boundaryPolygon);
          const pt = project(lat, lng);

          return (
            <g
              key={land.id}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (!isEditActive) onSelectLand?.(land);
              }}
            >
              {pts && (
                <polygon
                  points={pts}
                  fill={isSelected ? '#86EFAC' : '#DCFCE7'}
                  fillOpacity={0.7}
                  stroke={isSelected ? '#15803D' : '#16A34A'}
                  strokeWidth={isSelected ? '2.5' : '1.5'}
                />
              )}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isSelected ? '6' : '4.5'}
                fill={isSelected ? '#15803D' : '#16A34A'}
                stroke="#ffffff"
                strokeWidth="2"
              />
              <text
                x={pt.x}
                y={pt.y - 8}
                textAnchor="middle"
                className="text-[9px] font-bold fill-stone-800 pointer-events-none select-none"
              >
                {land.label ?? land.id}
                {land.acres != null ? ` (${land.acres}Ac)` : ''}
              </text>
            </g>
          );
        })}

        {/* Boundary being drawn */}
        {isEditActive && editType === 'polygon' && editPoints.length > 0 && (
          <g>
            <polygon
              points={polygonPoints(editPoints)}
              fill="#BBF7D0"
              fillOpacity={0.5}
              stroke="#16A34A"
              strokeWidth="2"
              strokeDasharray="4,2"
            />
            {editPoints.map((p, idx) => {
              const pt = project(p.lat, p.lng);
              return (
                <circle
                  key={idx}
                  cx={pt.x}
                  cy={pt.y}
                  r="4"
                  fill="#16A34A"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              );
            })}
          </g>
        )}

        {isEditActive && editType === 'pin' && editPinCoord && (
          <circle
            cx={project(editPinCoord.lat, editPinCoord.lng).x}
            cy={project(editPinCoord.lat, editPinCoord.lng).y}
            r="7"
            fill="#16A34A"
            stroke="#ffffff"
            strokeWidth="2.5"
          />
        )}
      </svg>

      {/* Nothing to draw */}
      {placeableCount === 0 && lands.length === 0 && !isEditActive && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="bg-white/90 border border-stone-200 rounded-lg px-3 py-2 text-xs text-stone-500 font-medium">
            No village in this territory has a coordinate yet.
          </span>
        </div>
      )}

      {/* Info bar */}
      <div className="absolute bottom-2 left-2 right-2 z-10 flex items-center justify-between gap-3 text-[11px] text-stone-600 bg-white/90 backdrop-blur-xs border border-stone-200 px-3 py-1 rounded shadow-xs pointer-events-none">
        <div className="flex items-center gap-3">
          {showAllotmentColors || agentMapMode ? (
            <>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" /> Vacancy open
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-sky-500 inline-block" /> Interest exists
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-slate-400 inline-block" /> Fully staffed
              </span>
            </>
          ) : (
            <span>
              Centre: {center.lat.toFixed(3)}°N, {center.lng.toFixed(3)}°E · zoom{' '}
              {zoom.toFixed(1)}×
            </span>
          )}
        </div>

        <span className={isEditActive ? 'text-[#16A34A] font-semibold' : ''}>
          {isEditActive
            ? `Edit mode: click to place ${editType === 'pin' ? 'the pin' : 'boundary points'}`
            : 'Drag to pan · scroll to zoom · click a village for details'}
        </span>
      </div>
    </div>
  );
}
