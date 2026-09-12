import { useState, useEffect, useMemo, useCallback } from 'react';
import L from 'leaflet';
import {
  Layers,
  Map as MapIcon,
  Satellite,
  Maximize2,
  Minimize2,
  Loader2,
  CheckCircle2,
  Eye,
  Link2,
  X,
  Square,
  CheckSquare,
} from 'lucide-react';

import useLeafletMap from '../../../hooks/useLeafletMap';
import agentService from '../../../services/agentService';
import agentObservationService from '../../../services/agentObservationService';
import { OBSERVATION_FREQUENCIES } from '../agentConstants';

/**
 * How a land parcel relates to the agent being worked. This is the single
 * source of the map's colour scheme — the legend reads from the same table.
 */
const RELATIONSHIPS = {
  ATTACHED_AND_OBSERVATION: {
    label: 'Attached + observation',
    fill: '#2563EB',
    border: '#0D9488',
    badge: 'bg-gradient-to-r from-orange-500 to-teal-600',
  },
  ATTACHED_THIS: {
    label: 'Attached to agent',
    fill: '#2563EB',
    border: '#EA580C',
    badge: 'bg-orange-500',
  },
  OBSERVATION_THIS: {
    label: 'Observation assigned',
    fill: '#0D9488',
    border: '#0F766E',
    badge: 'bg-teal-600',
  },
  ATTACHED_OTHER: {
    label: 'Attached to another agent',
    fill: '#6366F1',
    border: '#4F46E5',
    badge: 'bg-indigo-600',
  },
  AVAILABLE: {
    label: 'Available',
    fill: '#10B981',
    border: '#059669',
    badge: 'bg-emerald-600',
  },
};

const relationshipOf = (land) => {
  if (land.linked_to_agent && land.observed_by_agent) return 'ATTACHED_AND_OBSERVATION';
  if (land.linked_to_agent) return 'ATTACHED_THIS';
  if (land.observed_by_agent) return 'OBSERVATION_THIS';
  if (land.agent_id) return 'ATTACHED_OTHER';
  return 'AVAILABLE';
};

const RELATION_FILTERS = [
  { key: 'ALL', label: 'All lands' },
  { key: 'AVAILABLE', label: 'Available' },
  { key: 'ATTACHED_THIS', label: 'Attached to this agent' },
  { key: 'OBSERVATION_THIS', label: 'Observed by this agent' },
  { key: 'ATTACHED_OTHER', label: 'Other agents' },
  { key: 'DUE', label: 'Information due' },
];

const inr = (value) => {
  const num = Number(value) || 0;
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
  return `₹${num.toLocaleString('en-IN')}`;
};

/**
 * The agent's land workspace: every parcel in their territory drawn on a real
 * basemap with its surveyed boundary, coloured by how it relates to them.
 *
 * Two actions run from here — attaching a parcel as the agent's primary link,
 * and assigning it as a standing observation on a cadence. Parcels whose
 * observation report has come due carry a red ping, read from the server's
 * `observation_due` rather than recomputed here.
 */
export default function AgentAttachLandMap({ agent, onClose }) {
  const [lands, setLands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedIds, setSelectedIds] = useState([]);
  const [activeLandId, setActiveLandId] = useState(null);
  const [relationFilter, setRelationFilter] = useState('ALL');
  const [tileMode, setTileMode] = useState('STREET');
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [drawer, setDrawer] = useState(null); // 'ATTACH' | 'OBSERVE' | null
  const [frequency, setFrequency] = useState('MONTHLY');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const { containerRef, mapRef, layerGroupRef, isReady, invalidateSize, fitBounds } =
    useLeafletMap({ tileMode });

  const agentId = agent?.id;

  /* ── Data ───────────────────────────────────────────────────── */

  const load = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    try {
      const data = await agentService.getLandNodes({
        agentId,
        state: agent.state || undefined,
        district: agent.district || undefined,
      });
      const list = data.result || data.data || [];
      setLands(Array.isArray(list) ? list : []);
      setError(null);
    } catch (err) {
      console.error('Failed to load agent land nodes:', err);
      setLands([]);
      setError(
        err?.response?.status === 404
          ? 'Land node endpoint is not available on this backend yet.'
          : 'Could not load lands for this agent.'
      );
    } finally {
      setLoading(false);
    }
  }, [agentId, agent?.state, agent?.district]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => invalidateSize(220), [isFullscreen, invalidateSize]);

  /* ── Filtering ──────────────────────────────────────────────── */

  const filteredLands = useMemo(() => {
    if (relationFilter === 'ALL') return lands;
    if (relationFilter === 'DUE') return lands.filter((l) => l.observation_due);
    return lands.filter((land) => {
      const rel = relationshipOf(land);
      if (relationFilter === 'ATTACHED_THIS') {
        return rel === 'ATTACHED_THIS' || rel === 'ATTACHED_AND_OBSERVATION';
      }
      if (relationFilter === 'OBSERVATION_THIS') {
        return rel === 'OBSERVATION_THIS' || rel === 'ATTACHED_AND_OBSERVATION';
      }
      return rel === relationFilter;
    });
  }, [lands, relationFilter]);

  useEffect(() => {
    if (!isReady || loading || !filteredLands.length) return;
    fitBounds(filteredLands);
  }, [isReady, loading, filteredLands, fitBounds]);

  const toggleLand = useCallback((id) => {
    setSelectedIds((prev) =>
      prev.some((x) => String(x) === String(id))
        ? prev.filter((x) => String(x) !== String(id))
        : [...prev, id]
    );
  }, []);

  /* ── Drawing ────────────────────────────────────────────────── */

  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    filteredLands.forEach((land) => {
      const isSelected = selectedIds.some((x) => String(x) === String(land.id));
      const rel = RELATIONSHIPS[relationshipOf(land)];

      // Surveyed boundary, when the parcel has enough GPS points to enclose one.
      if (showBoundaries && Array.isArray(land.boundary) && land.boundary.length >= 3) {
        const polygon = L.polygon(land.boundary, {
          color: isSelected ? '#2563EB' : rel.border,
          weight: isSelected ? 4 : 2,
          opacity: 0.9,
          fillColor: isSelected ? '#2563EB' : rel.fill,
          fillOpacity: isSelected ? 0.45 : 0.25,
          dashArray: isSelected ? '4, 4' : undefined,
        });

        polygon.on('click', () => {
          setActiveLandId(land.id);
          toggleLand(land.id);
        });

        polygon.bindTooltip(
          `<div style="font-weight:700;font-size:11px;">
             <div style="color:#1c1917">LD-${land.id} · ${land.village || ''}</div>
             <div style="color:#57534e;font-weight:400">${Number(land.total_acres).toFixed(
               1
             )} acres · ${inr(land.total_value)}</div>
             <div style="color:${rel.border};font-size:10px;font-weight:700">${rel.label}</div>
           </div>`,
          { sticky: true, direction: 'top', offset: [0, -10] }
        );

        layerGroup.addLayer(polygon);
      }

      const icon = L.divIcon({
        className: 'custom-land-pin',
        html: `
          <div style="position:relative;cursor:pointer;">
            <div style="
              display:flex;align-items:center;gap:6px;
              padding:3px 9px;border-radius:9999px;
              box-shadow:0 2px 8px rgba(0,0,0,0.18);
              border:1px solid ${isSelected ? '#2563EB' : '#e7e5e4'};
              background:${isSelected ? '#1c1917' : 'rgba(255,255,255,0.96)'};
              color:${isSelected ? '#FFFFFF' : '#1c1917'};
              white-space:nowrap;
            ">
              <span style="width:9px;height:9px;border-radius:50%;background:${
                rel.fill
              };flex-shrink:0;"></span>
              <span style="font-weight:800;font-size:11px;">LD-${land.id}</span>
              <span style="font-size:10px;font-weight:600;opacity:0.8;">${Number(
                land.total_acres
              ).toFixed(1)} Ac</span>
              ${
                isSelected
                  ? '<span style="width:14px;height:14px;border-radius:50%;background:#2563EB;color:#fff;font-size:9px;display:flex;align-items:center;justify-content:center;font-weight:900;">✓</span>'
                  : ''
              }
            </div>
            ${
              land.observation_due
                ? '<div style="position:absolute;top:-3px;right:-3px;width:11px;height:11px;background:#EF4444;border-radius:50%;border:2px solid #fff;"></div>'
                : ''
            }
          </div>
        `,
        iconSize: [130, 30],
        iconAnchor: [65, 15],
      });

      const marker = L.marker([land.latitude, land.longitude], { icon });
      marker.on('click', () => {
        setActiveLandId(land.id);
        toggleLand(land.id);
      });
      layerGroup.addLayer(marker);
    });
  }, [
    filteredLands,
    selectedIds,
    showBoundaries,
    isReady,
    mapRef,
    layerGroupRef,
    toggleLand,
  ]);

  /* ── Actions ────────────────────────────────────────────────── */

  const activeLand = useMemo(
    () => lands.find((l) => String(l.id) === String(activeLandId)) || null,
    [lands, activeLandId]
  );

  const handleAttach = async () => {
    if (!selectedIds.length || !agentId) return;
    setSaving(true);
    try {
      // The primary link is one land → one agent, so these go one at a time.
      await Promise.all(selectedIds.map((landId) => agentService.linkLand(landId, agentId)));
      setToast({
        tone: 'ok',
        message: `${selectedIds.length} land(s) attached to ${agent.name}.`,
      });
      setSelectedIds([]);
      setDrawer(null);
      await load();
    } catch (err) {
      console.error('Attach lands failed:', err);
      setToast({
        tone: 'error',
        message: err.response?.data?.message || 'Could not attach the selected lands.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleObserve = async () => {
    if (!selectedIds.length || !agentId) return;
    setSaving(true);
    try {
      const data = await agentObservationService.assignBulk({
        landIds: selectedIds,
        agentIds: [agentId],
        frequency,
        notes: notes || undefined,
      });
      const result = data.result || {};
      const assigned = result.assigned?.length ?? selectedIds.length;
      const skipped = result.skipped?.length ?? 0;

      setToast({
        tone: skipped ? 'warn' : 'ok',
        message: skipped
          ? `${assigned} observation(s) assigned; ${skipped} skipped (already the primary agent).`
          : `${assigned} observation(s) assigned to ${agent.name}.`,
      });
      setSelectedIds([]);
      setNotes('');
      setDrawer(null);
      await load();
    } catch (err) {
      console.error('Assign observations failed:', err);
      setToast({
        tone: 'error',
        message: err.response?.data?.message || 'Could not assign the observations.',
      });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const counts = useMemo(() => {
    const tally = { attached: 0, observing: 0, available: 0, due: 0 };
    lands.forEach((land) => {
      const rel = relationshipOf(land);
      if (rel === 'ATTACHED_THIS' || rel === 'ATTACHED_AND_OBSERVATION') tally.attached += 1;
      if (rel === 'OBSERVATION_THIS' || rel === 'ATTACHED_AND_OBSERVATION') tally.observing += 1;
      if (rel === 'AVAILABLE') tally.available += 1;
      if (land.observation_due) tally.due += 1;
    });
    return tally;
  }, [lands]);

  return (
    <div
      className={`relative flex flex-col bg-[#f5f5f4] ${
        isFullscreen
          ? 'fixed inset-0 z-50 overflow-hidden h-screen w-screen'
          : 'min-h-[620px] h-[calc(100vh-330px)] rounded-2xl border border-[#e7e5e4] overflow-hidden'
      }`}
    >
      {/* Agent banner */}
      <div className="bg-[#1c1917] text-white px-5 py-3 flex flex-wrap items-center justify-between gap-3 shadow-md z-30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2563EB] text-white flex items-center justify-center font-black text-sm">
            {String(agent?.name || '?').charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-orange-300 uppercase tracking-wider">
                Agent workspace
              </span>
              <span className="text-gray-400">•</span>
              <strong className="text-sm font-extrabold">{agent?.name}</strong>
              <span className="px-2 py-0.5 rounded bg-white/10 text-orange-200 text-xs font-bold">
                AG{String(agent?.id).padStart(5, '0')}
              </span>
            </div>
            <div className="text-[11px] text-gray-300">
              {agent?.village || '—'}, {agent?.mandal || '—'} · {agent?.district || '—'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-bold">
          <span className="text-orange-300">{counts.attached} attached</span>
          <span className="text-teal-300">{counts.observing} observing</span>
          <span className="text-emerald-300">{counts.available} available</span>
          {counts.due > 0 && <span className="text-rose-300">{counts.due} info due</span>}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b border-[#e7e5e4] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 z-20 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={relationFilter}
            onChange={(e) => setRelationFilter(e.target.value)}
            className="text-xs bg-[#fafaf9] border border-[#e7e5e4] rounded-lg px-2.5 py-1.5 font-bold text-[#1c1917]"
          >
            {RELATION_FILTERS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowBoundaries((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              showBoundaries
                ? 'bg-[#2563EB]/10 border-[#2563EB] text-[#2563EB]'
                : 'bg-white border-[#e7e5e4] text-[#57534e]'
            }`}
          >
            {showBoundaries ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            Boundaries
          </button>

          <div className="inline-flex rounded-lg border border-[#e7e5e4] p-0.5 bg-[#f5f5f4]">
            <button
              type="button"
              onClick={() => setTileMode('STREET')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md ${
                tileMode === 'STREET' ? 'bg-white text-[#2563EB] shadow-sm' : 'text-[#78716c]'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" /> Street
            </button>
            <button
              type="button"
              onClick={() => setTileMode('SATELLITE')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md ${
                tileMode === 'SATELLITE' ? 'bg-white text-[#2563EB] shadow-sm' : 'text-[#78716c]'
              }`}
            >
              <Satellite className="w-3.5 h-3.5" /> Satellite
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.length > 0 && (
            <>
              <span className="text-xs font-bold text-[#1c1917]">
                {selectedIds.length} selected
              </span>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-xs text-[#78716c] hover:text-[#1c1917] font-semibold"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setDrawer('ATTACH')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2563EB] text-white text-xs font-bold hover:bg-[#1d4ed8]"
              >
                <Link2 className="w-3.5 h-3.5" /> Attach lands
              </button>
              <button
                type="button"
                onClick={() => setDrawer('OBSERVE')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D9488] text-white text-xs font-bold hover:bg-[#0F766E]"
              >
                <Eye className="w-3.5 h-3.5" /> Assign observation
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#e7e5e4] bg-white text-xs font-bold text-[#1c1917] hover:border-[#2563EB]"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" /> Exit
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-[#2563EB]" /> Full view
              </>
            )}
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="w-full h-full" />

        {loading && (
          <div className="absolute inset-0 z-[500] bg-white/70 flex items-center justify-center">
            <span className="flex items-center gap-2 text-xs font-bold text-[#1c1917]">
              <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" />
              Loading lands…
            </span>
          </div>
        )}

        {!loading && error && (
          <div className="absolute inset-x-4 top-4 z-[500] bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {!loading && !error && filteredLands.length === 0 && (
          <div className="absolute inset-0 z-[500] bg-white/80 flex items-center justify-center text-xs text-[#78716c] font-semibold px-6 text-center">
            No land in this territory matches the current filter.
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-[500] bg-white/95 backdrop-blur-xs rounded-xl border border-[#e7e5e4] shadow-md p-3 space-y-1.5">
          <div className="font-bold text-[#1c1917] text-[11px] uppercase tracking-wider mb-1">
            Land relationship
          </div>
          {Object.entries(RELATIONSHIPS).map(([key, rel]) => (
            <div key={key} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full border"
                style={{ backgroundColor: rel.fill, borderColor: rel.border }}
              />
              <span className="text-[11px] text-[#57534e]">{rel.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1 border-t border-[#e7e5e4]">
            <span className="w-3 h-3 rounded-full bg-rose-500 border-2 border-white shadow-sm" />
            <span className="text-[11px] text-[#57534e]">Information due</span>
          </div>
        </div>

        {/* Active land card */}
        {activeLand && (
          <div className="absolute top-4 right-4 z-[500] w-64 bg-white rounded-xl border border-[#e7e5e4] shadow-lg p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-extrabold text-sm text-[#1c1917]">LD-{activeLand.id}</div>
                <div className="text-[11px] text-[#78716c]">
                  {activeLand.village}, {activeLand.mandal}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveLandId(null)}
                className="text-[#78716c] hover:text-[#1c1917]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center pt-1">
              <div className="bg-[#fafaf9] rounded-lg py-1.5">
                <div className="text-sm font-black text-[#1c1917]">
                  {Number(activeLand.total_acres).toFixed(1)}
                </div>
                <div className="text-[10px] font-bold text-[#78716c] uppercase">Acres</div>
              </div>
              <div className="bg-[#fafaf9] rounded-lg py-1.5">
                <div className="text-sm font-black text-[#2563EB]">
                  {inr(activeLand.total_value)}
                </div>
                <div className="text-[10px] font-bold text-[#78716c] uppercase">Value</div>
              </div>
            </div>

            <div className="text-[11px] text-[#57534e] space-y-1 pt-1 border-t border-[#e7e5e4]">
              <div className="flex justify-between gap-2">
                <span>Farmer</span>
                <strong className="text-[#1c1917] truncate">
                  {activeLand.farmer_name || '—'}
                </strong>
              </div>
              <div className="flex justify-between gap-2">
                <span>Primary agent</span>
                <strong className="text-[#1c1917] truncate">
                  {activeLand.agent_name || 'Unassigned'}
                </strong>
              </div>
              <div className="flex justify-between gap-2">
                <span>Observers</span>
                <strong className="text-[#1c1917]">{activeLand.observation_count}</strong>
              </div>
              {activeLand.observation_next_due_date && (
                <div className="flex justify-between gap-2">
                  <span>Next report</span>
                  <strong
                    className={
                      activeLand.observation_due ? 'text-rose-600' : 'text-[#1c1917]'
                    }
                  >
                    {activeLand.observation_next_due_date}
                  </strong>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action drawer */}
      {drawer && (
        <div className="absolute inset-x-0 bottom-0 z-[600] bg-white border-t border-[#e7e5e4] shadow-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-sm text-[#1c1917] flex items-center gap-2">
              {drawer === 'ATTACH' ? (
                <>
                  <Link2 className="w-4 h-4 text-[#2563EB]" /> Attach {selectedIds.length}{' '}
                  land(s) to {agent?.name}
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 text-[#0D9488]" /> Assign {selectedIds.length}{' '}
                  observation(s) to {agent?.name}
                </>
              )}
            </h4>
            <button
              type="button"
              onClick={() => setDrawer(null)}
              className="text-[#78716c] hover:text-[#1c1917]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {drawer === 'ATTACH' ? (
            <p className="text-xs text-[#78716c]">
              Attaching makes this agent the parcel's primary link. A parcel already
              attached to another agent will be reassigned.
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs font-bold text-[#57534e] space-y-1">
                <span className="block">Reporting cadence</span>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="text-xs bg-[#fafaf9] border border-[#e7e5e4] rounded-lg px-2.5 py-1.5 font-bold text-[#1c1917]"
                >
                  {OBSERVATION_FREQUENCIES.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-bold text-[#57534e] space-y-1 flex-1 min-w-[200px]">
                <span className="block">Notes (optional)</span>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What should the agent watch for?"
                  className="w-full text-xs bg-[#fafaf9] border border-[#e7e5e4] rounded-lg px-2.5 py-1.5 font-medium"
                />
              </label>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setDrawer(null)}
              className="px-3 py-1.5 rounded-lg border border-[#e7e5e4] text-xs font-bold text-[#57534e]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={drawer === 'ATTACH' ? handleAttach : handleObserve}
              className={`px-4 py-1.5 rounded-lg text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 ${
                drawer === 'ATTACH'
                  ? 'bg-[#2563EB] hover:bg-[#1d4ed8]'
                  : 'bg-[#0D9488] hover:bg-[#0F766E]'
              }`}
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              Confirm
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`absolute bottom-4 right-4 z-[700] px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold flex items-center gap-2 ${
            toast.tone === 'error'
              ? 'bg-rose-600 text-white'
              : toast.tone === 'warn'
              ? 'bg-amber-500 text-white'
              : 'bg-[#2563EB] text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          {toast.message}
        </div>
      )}
    </div>
  );
}
