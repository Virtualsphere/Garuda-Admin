import { useState, useEffect, useMemo, useCallback } from 'react';
import L from 'leaflet';
import {
  Layers,
  CheckSquare,
  Square,
  Maximize2,
  Minimize2,
  Building2,
  UserCheck,
  Clock,
  ShieldAlert,
  Plus,
  ChevronRight,
  ExternalLink,
  Loader2,
} from 'lucide-react';

import useLeafletMap from '../../../hooks/useLeafletMap';
import useAgentRecruitmentMap from '../../../hooks/useAgentRecruitmentMap';
import Badge from '../common/Badge';
import CallButton from '../common/CallButton';
import AgentAttachLandMap from './AgentAttachLandMap';

const norm = (value) => String(value || '').trim().toLowerCase();

// Marker tones per metric layer. Kept beside the legend that explains them so
// the two can never drift apart.
const VACANCY_COLORS = {
  staffed: '#2563EB',
  openToWaiting: '#F59E0B',
  nativeSearch: '#EA4335',
};

const METRIC_MODES = [
  { key: 'VACANCIES', label: 'Agent Vacancies', tone: 'text-[#2563EB]' },
  { key: 'PIPELINE', label: 'Candidate Pipeline', tone: 'text-[#2563EB]' },
  { key: 'WAITING', label: 'Waiting (Outside)', tone: 'text-[#B45309]' },
];

/**
 * Territorial recruitment map: every village node the operation touches, drawn
 * on a real basemap and coloured by whichever pressure the desk is working —
 * open seats, native leads, or applicants waiting from outside.
 *
 * Ported from the Garuda Firebase design and wired to the live backend:
 * coordinates and deployed agents come from /fieldwork/agent/map-nodes, seats
 * and candidates from /recruitment/*.
 */
export default function AgentsRecruitmentMap({
  state,
  district,
  mandal,
  agents = [],
  onOpenCandidate,
  onAddCandidate,
  onOpenToWaiting,
  onSelectCandidate,
  onInspectVillage,
}) {
  const { nodes, totals, loading, error, refresh } = useAgentRecruitmentMap({
    state,
    district,
    mandal,
  });

  const [metricMode, setMetricMode] = useState('VACANCIES');
  const [selectedVillage, setSelectedVillage] = useState(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedVillages, setSelectedVillages] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Attach-lands workspace, opened for one agent from the toolbar or a seat.
  const [attachAgent, setAttachAgent] = useState(null);

  const { containerRef, mapRef, layerGroupRef, isReady, invalidateSize, panTo, fitBounds } =
    useLeafletMap({ tileMode: 'STREET' });

  /* ── Fullscreen ─────────────────────────────────────────────── */

  useEffect(() => {
    if (!isFullscreen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

  // The map must re-measure after the container resizes, or it paints grey.
  useEffect(() => invalidateSize(220), [isFullscreen, invalidateSize]);

  /* ── Framing ────────────────────────────────────────────────── */

  // Frame the territory once the nodes for a new filter arrive.
  useEffect(() => {
    if (!isReady || loading || !nodes.length) return;
    fitBounds(nodes);
  }, [isReady, loading, nodes, fitBounds]);

  const toggleVillageSelection = useCallback((village) => {
    setSelectedVillages((prev) =>
      prev.some((v) => norm(v) === norm(village))
        ? prev.filter((v) => norm(v) !== norm(village))
        : [...prev, village]
    );
  }, []);

  /* ── Markers ────────────────────────────────────────────────── */

  const markerStyleFor = useCallback(
    (node) => {
      if (metricMode === 'PIPELINE') {
        return {
          color: node.nativeCount > 0 ? VACANCY_COLORS.staffed : '#78716c',
          count: node.nativeCount,
        };
      }
      if (metricMode === 'WAITING') {
        return {
          color: node.outsideCount > 0 ? '#B45309' : '#78716c',
          count: node.outsideCount,
        };
      }
      // VACANCIES
      if (node.vacantPositions === 0) {
        return { color: VACANCY_COLORS.staffed, count: 0 };
      }
      return {
        color: node.isOpenToWaiting
          ? VACANCY_COLORS.openToWaiting
          : VACANCY_COLORS.nativeSearch,
        count: node.vacantPositions,
      };
    },
    [metricMode]
  );

  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    nodes.forEach((node) => {
      const isSelected = norm(selectedVillage) === norm(node.village);
      const isMultiSelected = selectedVillages.some((v) => norm(v) === norm(node.village));
      const highlighted = isSelected || isMultiSelected;

      const { color, count } = markerStyleFor(node);
      const radius = highlighted ? 18 : 14;

      const icon = L.divIcon({
        className: 'custom-village-recruitment-pin',
        html: `
          <div style="position:relative;cursor:pointer;display:flex;align-items:center;justify-content:center;">
            <div style="
              width:${radius * 2}px;
              height:${radius * 2}px;
              border-radius:50%;
              background-color:${color};
              border:${highlighted ? '3px solid #FFFFFF' : '2px solid #FFFFFF'};
              box-shadow:${
                isSelected
                  ? '0 0 0 3px #2563EB, 0 4px 12px rgba(0,0,0,0.3)'
                  : '0 2px 6px rgba(0,0,0,0.2)'
              };
              display:flex;align-items:center;justify-content:center;
              color:#FFFFFF;font-weight:800;font-size:11px;
            ">${count}</div>
            <div style="
              position:absolute;bottom:-22px;white-space:nowrap;
              background-color:${isSelected ? '#1c1917' : 'rgba(255,255,255,0.95)'};
              color:${isSelected ? '#FFFFFF' : '#1c1917'};
              font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;
              box-shadow:0 1px 3px rgba(0,0,0,0.2);pointer-events:none;
            ">${node.village}</div>
          </div>
        `,
        iconSize: [radius * 2, radius * 2],
        iconAnchor: [radius, radius],
      });

      const marker = L.marker([node.latitude, node.longitude], { icon });

      marker.on('click', () => {
        if (multiSelectMode) toggleVillageSelection(node.village);
        else setSelectedVillage(node.village);
      });

      layerGroup.addLayer(marker);
    });
  }, [
    nodes,
    selectedVillage,
    selectedVillages,
    multiSelectMode,
    markerStyleFor,
    isReady,
    mapRef,
    layerGroupRef,
    toggleVillageSelection,
  ]);

  // Centre on the village whose detail panel is open.
  useEffect(() => {
    if (!selectedVillage) return;
    const node = nodes.find((n) => norm(n.village) === norm(selectedVillage));
    if (node) panTo(node.latitude, node.longitude);
  }, [selectedVillage, nodes, panTo]);

  /* ── Active village ─────────────────────────────────────────── */

  const activeNode = useMemo(() => {
    if (selectedVillage) {
      return nodes.find((n) => norm(n.village) === norm(selectedVillage)) || null;
    }
    return null;
  }, [nodes, selectedVillage]);

  const activePositions = useMemo(() => activeNode?.positions || [], [activeNode]);
  const filledCount = activePositions.filter((p) => p.status === 'FILLED').length;
  const openCount = activePositions.length - filledCount;

  // Selecting a candidate fills a *seat*, so the panel's Select/Allocate
  // buttons need one to act on. The lowest-numbered open seat is the one the
  // desk fills next.
  const nextOpenSeat = useMemo(
    () =>
      activePositions.find((p) =>
        ['VACANT', 'NATIVE_SEARCH', 'WAITING_CANDIDATES_AVAILABLE', 'OPEN_TO_WAITING_CANDIDATES'].includes(
          p.status
        )
      ) || null,
    [activePositions]
  );

  /* ── Attach-lands workspace ─────────────────────────────────── */

  if (attachAgent) {
    return (
      <div className="space-y-3">
        <div className="p-3 bg-[#1c1917] text-white rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <span className="font-extrabold text-sm">ATTACH LANDS MODE ACTIVE</span>
              <span className="text-xs text-gray-300 ml-2">
                Agent: <strong>{attachAgent.name}</strong> · Native: {attachAgent.village || '—'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAttachAgent(null)}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-colors"
          >
            Exit Attach Mode
          </button>
        </div>

        <AgentAttachLandMap agent={attachAgent} onClose={() => setAttachAgent(null)} />
      </div>
    );
  }

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 bg-[#f5f5f4] p-3 sm:p-4 flex flex-col h-screen w-screen overflow-hidden space-y-3'
          : 'space-y-4'
      }
    >
      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#e7e5e4] p-3 shadow-sm flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          {isFullscreen && (
            <div className="flex items-center gap-2 pr-3 border-r border-[#e7e5e4]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB] animate-ping" />
              <span className="text-xs font-black text-[#2563EB] tracking-wide uppercase">
                Recruitment Map Full View
              </span>
            </div>
          )}

          <span className="text-xs font-bold text-[#78716c] uppercase tracking-wider flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" />
            Heatmap:
          </span>

          <div className="inline-flex rounded-lg border border-[#e7e5e4] p-0.5 bg-[#f5f5f4]">
            {METRIC_MODES.map((mode) => (
              <button
                key={mode.key}
                type="button"
                onClick={() => setMetricMode(mode.key)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                  metricMode === mode.key
                    ? `bg-white ${mode.tone} shadow-sm`
                    : 'text-[#78716c] hover:text-[#1c1917]'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Attach-lands agent picker */}
          <div className="flex items-center gap-1.5 bg-[#EFF6FF] border border-orange-200 px-2 py-1 rounded-lg">
            <span className="text-[11px] font-bold text-orange-900 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-[#2563EB]" /> Attach Lands:
            </span>
            <select
              value=""
              onChange={(e) => {
                const found = agents.find((a) => String(a.id) === String(e.target.value));
                if (found) setAttachAgent(found);
              }}
              className="text-xs bg-white border border-orange-200 rounded px-2 py-0.5 font-bold text-[#1c1917]"
            >
              <option value="">Select Agent to Attach Lands...</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({agent.village || 'Unassigned'})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setMultiSelectMode((prev) => !prev);
              if (multiSelectMode) setSelectedVillages([]);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
              multiSelectMode
                ? 'bg-[#2563EB]/10 border-[#2563EB] text-[#2563EB]'
                : 'bg-white border-[#e7e5e4] text-[#57534e] hover:bg-[#fafaf9]'
            }`}
          >
            {multiSelectMode ? (
              <CheckSquare className="w-4 h-4" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            <span>Multi-Select Villages</span>
            {selectedVillages.length > 0 && (
              <span className="px-1.5 rounded-full bg-[#2563EB] text-white text-[10px] font-extrabold ml-1">
                {selectedVillages.length}
              </span>
            )}
          </button>

          {multiSelectMode && selectedVillages.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedVillages([])}
              className="text-xs text-[#78716c] hover:text-[#1c1917] font-semibold px-2"
            >
              Clear ({selectedVillages.length})
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            title={isFullscreen ? 'Exit full screen (ESC)' : 'Expand map to full screen'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all shadow-sm ${
              isFullscreen
                ? 'bg-[#2563EB] text-white border-[#2563EB]'
                : 'bg-white border-[#e7e5e4] text-[#1c1917] hover:bg-[#f5f5f4] hover:border-[#2563EB]'
            }`}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-4 h-4 text-emerald-300" />
                <span>Exit Full View (ESC)</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4 text-[#2563EB]" />
                <span>Full Map View</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Territory totals ────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 shrink-0">
        {[
          { label: 'Village nodes', value: totals.nodes },
          { label: 'Agents deployed', value: totals.agents },
          { label: 'Open seats', value: totals.vacancies, alert: true },
          { label: 'Fully staffed', value: totals.fullyStaffed },
          { label: 'Native leads', value: totals.nativeLeads },
          { label: 'Waiting outside', value: totals.waiting },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-lg border border-[#e7e5e4] px-3 py-2 shadow-sm"
          >
            <div
              className={`text-lg font-black leading-none ${
                stat.alert && stat.value > 0 ? 'text-[#EA4335]' : 'text-[#1c1917]'
              }`}
            >
              {stat.value}
            </div>
            <div className="text-[10px] font-bold text-[#78716c] uppercase tracking-wider mt-1">
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Map + village panel ─────────────────────────────── */}
      <div
        className={`grid grid-cols-1 lg:grid-cols-3 gap-4 ${
          isFullscreen ? 'flex-1 min-h-0' : ''
        }`}
      >
        <div
          className={`lg:col-span-2 bg-white rounded-xl border border-[#e7e5e4] shadow-sm overflow-hidden flex flex-col relative ${
            isFullscreen ? 'h-full min-h-0 flex-1' : 'min-h-[580px] h-[calc(100vh-330px)]'
          }`}
        >
          <div ref={containerRef} className="w-full h-full" />

          {loading && (
            <div className="absolute inset-0 z-[500] bg-white/70 flex items-center justify-center">
              <span className="flex items-center gap-2 text-xs font-bold text-[#1c1917]">
                <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" />
                Loading territory…
              </span>
            </div>
          )}

          {!loading && error && (
            <div className="absolute inset-x-4 top-4 z-[500] bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-center justify-between gap-3">
              <span>{error}</span>
              <button
                type="button"
                onClick={refresh}
                className="px-2 py-0.5 rounded bg-rose-600 text-white text-[11px] font-bold"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && nodes.length === 0 && (
            <div className="absolute inset-0 z-[500] bg-white/80 flex items-center justify-center text-xs text-[#78716c] font-semibold px-6 text-center">
              No village in this territory has a coordinate yet, so nothing can be
              plotted.
            </div>
          )}

          {/* Legend */}
          <div className="absolute bottom-4 left-4 z-[500] bg-white/95 backdrop-blur-xs rounded-xl border border-[#e7e5e4] shadow-md p-3 text-xs space-y-1.5">
            <div className="font-bold text-[#1c1917] text-[11px] uppercase tracking-wider mb-1">
              {metricMode === 'VACANCIES'
                ? 'Vacancy status legend'
                : metricMode === 'PIPELINE'
                ? 'Pipeline density'
                : 'Waiting outside density'}
            </div>

            {metricMode === 'VACANCIES' ? (
              <>
                <LegendRow color={VACANCY_COLORS.nativeSearch} label="Native search priority (vacant)" />
                <LegendRow color={VACANCY_COLORS.openToWaiting} label="Open to waiting candidates" />
                <LegendRow color={VACANCY_COLORS.staffed} label="Fully staffed (0 vacancies)" />
              </>
            ) : metricMode === 'PIPELINE' ? (
              <>
                <LegendRow color={VACANCY_COLORS.staffed} label="Active native applicants" />
                <LegendRow color="#78716c" label="No native applicants yet" />
              </>
            ) : (
              <>
                <LegendRow color="#B45309" label="Outside waiting applicants" />
                <LegendRow color="#78716c" label="Nobody waiting" />
              </>
            )}
          </div>
        </div>

        {/* ── Village detail panel ──────────────────────────── */}
        <div
          className={`bg-white rounded-xl border border-[#e7e5e4] shadow-sm p-5 flex flex-col overflow-y-auto space-y-5 ${
            isFullscreen ? 'h-full min-h-0' : 'min-h-[580px] h-[calc(100vh-330px)]'
          }`}
        >
          {activeNode ? (
            <>
              <div className="flex items-start justify-between pb-3 border-b border-[#e7e5e4]">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-extrabold text-[#1c1917]">
                      {activeNode.village}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2563EB]/10 text-[#2563EB]">
                      {activeNode.mandal} Mandal
                    </span>
                  </div>
                  <p className="text-xs text-[#78716c] mt-0.5">
                    District: {activeNode.district || '—'} • GPS:{' '}
                    {Number(activeNode.latitude).toFixed(4)},{' '}
                    {Number(activeNode.longitude).toFixed(4)}
                    {activeNode.coord_source ? ` (${activeNode.coord_source})` : ''}
                  </p>
                </div>

                {onInspectVillage && (
                  <button
                    type="button"
                    title="View in table"
                    onClick={() => onInspectVillage(activeNode.village)}
                    className="p-1.5 rounded-lg text-[#78716c] hover:text-[#1c1917] hover:bg-[#f5f5f4] transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Node facts */}
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Deployed', value: activeNode.deployedAgents },
                  { label: 'Required', value: activeNode.requiredAgents },
                  { label: 'Lands', value: activeNode.land_count },
                ].map((fact) => (
                  <div key={fact.label} className="bg-[#fafaf9] rounded-lg py-2">
                    <div className="text-base font-black text-[#1c1917]">{fact.value}</div>
                    <div className="text-[10px] font-bold text-[#78716c] uppercase tracking-wider">
                      {fact.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Seats */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[#1c1917] uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Agent positions ({activePositions.length} target)</span>
                  </h4>
                  <span className="text-[11px] font-bold text-[#2563EB]">
                    {filledCount} filled / {openCount} open
                  </span>
                </div>

                <div className="space-y-2">
                  {activePositions.length > 0 ? (
                    activePositions.map((position) => (
                      <PositionCard
                        key={position.id}
                        position={position}
                        onAttachLands={() => {
                          const agent =
                            position.agent ||
                            agents.find((a) => String(a.id) === String(position.agent_id));
                          if (agent) setAttachAgent(agent);
                        }}
                        onOpenToWaiting={() => onOpenToWaiting?.(position)}
                      />
                    ))
                  ) : (
                    <EmptyNote>
                      No seats have been synced for {activeNode.village} yet.
                    </EmptyNote>
                  )}
                </div>
              </div>

              {/* Native candidates — Garuda gives these priority on a seat */}
              <VillageCandidateSection
                title={`Native candidates (${activeNode.nativeCount})`}
                icon={UserCheck}
                accent="text-[#2563EB]"
                badge="Garuda priority"
                village={activeNode.village}
                candidates={activeNode.nativeCandidates}
                emptyLabel={`No native candidates currently registered for ${activeNode.village}.`}
                onOpenCandidate={onOpenCandidate}
                onSelectCandidate={onSelectCandidate}
                seat={nextOpenSeat}
                actionLabel="Select"
              />

              {/* Applicants from elsewhere, waiting for native priority to lapse */}
              <VillageCandidateSection
                title={`Outside waiting applicants (${activeNode.outsideCount})`}
                icon={Clock}
                accent="text-[#B45309]"
                village={activeNode.village}
                candidates={activeNode.outsideInterests.map((interest) => ({
                  id: interest.candidate_id,
                  name: interest.candidate_name,
                  phone: interest.candidate_phone,
                  status: interest.status,
                  homeVillage: interest.home_village,
                }))}
                emptyLabel="No outside candidates currently linked to this village."
                onOpenCandidate={onOpenCandidate}
                onSelectCandidate={onSelectCandidate}
                seat={nextOpenSeat}
                actionLabel="Allocate"
                tone="outside"
              />

              <div className="pt-2 border-t border-[#e7e5e4]">
                <button
                  type="button"
                  onClick={() => onAddCandidate?.(activeNode.village)}
                  className="w-full py-2 bg-[#2563EB] text-white rounded-lg text-xs font-bold hover:bg-[#1d4ed8] flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add / link candidate to {activeNode.village}</span>
                </button>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-[#78716c] text-xs">
              Select a village pin on the map to inspect its recruitment pipeline and
              positions.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Local presentational pieces ──────────────────────────────── */

function LegendRow({ color, label }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[11px] text-[#57534e]">{label}</span>
    </div>
  );
}

function EmptyNote({ children }) {
  return (
    <div className="p-4 text-center bg-[#fafaf9] rounded-xl border border-[#e7e5e4] text-xs text-[#78716c]">
      {children}
    </div>
  );
}

function PositionCard({ position, onAttachLands, onOpenToWaiting }) {
  const isFilled = position.status === 'FILLED';
  const isSelected = position.status === 'CANDIDATE_SELECTED';
  const isOpenToWaiting = position.status === 'OPEN_TO_WAITING_CANDIDATES';

  const tone = isFilled
    ? 'bg-[#E6F4EA]/50 border-[#34A853]'
    : isSelected
    ? 'bg-[#EFF6FF] border-[#3B82F6]'
    : isOpenToWaiting
    ? 'bg-[#FFFBEB] border-[#F59E0B]'
    : 'bg-[#fafaf9] border-[#e7e5e4]';

  return (
    <div className={`p-3 rounded-xl border text-xs space-y-1.5 transition-all ${tone}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-[#1c1917]">
          Position #{position.position_number}
        </span>
        <Badge
          variant={isFilled ? 'green' : isSelected ? 'blue' : isOpenToWaiting ? 'yellow' : 'red'}
        >
          {String(position.status).replace(/_/g, ' ')}
        </Badge>
      </div>

      {isFilled && position.agent && (
        <div className="pt-1 border-t border-emerald-200/60 flex items-center justify-between gap-2">
          <div className="text-[11px] text-[#2563EB] font-semibold truncate">
            Appointed: <strong>{position.agent.name}</strong> ({position.agent.phone})
          </div>
          <button
            type="button"
            onClick={onAttachLands}
            className="px-2 py-0.5 rounded bg-[#2563EB] text-white text-[10px] font-bold hover:bg-[#1d4ed8] flex items-center gap-1 shadow-sm shrink-0"
          >
            <Layers className="w-3 h-3" /> Attach lands
          </button>
        </div>
      )}

      {isSelected && position.selectedCandidate && (
        <div className="text-[11px] text-[#1D4ED8] font-semibold">
          Selected: <strong>{position.selectedCandidate.name}</strong> (
          {position.is_native ? 'Native resident' : 'Outside candidate'})
        </div>
      )}

      {!isFilled && !isSelected && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-[#78716c]">
            {isOpenToWaiting
              ? 'Unlocked for outside waiting candidates'
              : 'Searching for native village resident'}
          </span>

          {!isOpenToWaiting && (
            <button
              type="button"
              onClick={onOpenToWaiting}
              className="px-2.5 py-1 bg-[#F59E0B] text-white rounded-md text-[11px] font-bold hover:bg-[#D97706] transition-colors flex items-center gap-1 shadow-sm shrink-0"
            >
              <ShieldAlert className="w-3 h-3" />
              <span>Open to waiting</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function VillageCandidateSection({
  title,
  icon: Icon,
  accent,
  badge,
  candidates = [],
  emptyLabel,
  onOpenCandidate,
  onSelectCandidate,
  village,
  seat,
  actionLabel = 'Select',
  tone = 'native',
}) {
  const isOutside = tone === 'outside';
  return (
    <div className="space-y-2.5 pt-2 border-t border-[#e7e5e4]">
      <div className="flex items-center justify-between gap-2">
        <h4
          className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${accent}`}
        >
          <Icon className="w-3.5 h-3.5" />
          <span>{title}</span>
        </h4>
        {badge && (
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#2563EB]/10 text-[#2563EB]">
            {badge}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {candidates.length > 0 ? (
          candidates.map((candidate) => (
            <div
              key={candidate.id}
              className={`p-3 bg-white rounded-xl border shadow-sm text-xs space-y-2 ${
                isOutside ? 'border-[#e7e5e4]' : 'border-[#2563EB]/30'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onOpenCandidate?.(candidate.id)}
                    className="font-bold text-[#1c1917] hover:text-[#2563EB] text-left block truncate"
                  >
                    {candidate.name}
                  </button>
                  <span className="text-[10px] text-[#78716c]">
                    {candidate.homeVillage ? `Home: ${candidate.homeVillage} • ` : ''}
                    {candidate.phone}
                  </span>
                </div>
                <Badge
                  variant={
                    isOutside
                      ? candidate.status === 'VACANCY_AVAILABLE'
                        ? 'green'
                        : candidate.status === 'WAITING'
                        ? 'yellow'
                        : 'gray'
                      : 'green'
                  }
                >
                  {String(candidate.status || '').replace(/_/g, ' ')}
                </Badge>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-[#e7e5e4]">
                <CallButton
                  phone={candidate.phone}
                  recordName={candidate.name}
                  recordId={candidate.id}
                  recordType="AGENT_CANDIDATE"
                  variant="outline"
                />
                <div className="flex items-center gap-1.5">
                  {candidate.status !== 'JOINED' && (
                    <button
                      type="button"
                      onClick={() => onSelectCandidate?.(candidate, seat, village)}
                      className={`px-2.5 py-1 text-white rounded-md text-[11px] font-bold ${
                        isOutside
                          ? 'bg-[#2563EB] hover:bg-[#1d4ed8]'
                          : 'bg-[#1c1917] hover:bg-[#292524]'
                      }`}
                    >
                      {actionLabel}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenCandidate?.(candidate.id)}
                    className="p-1 rounded-md text-[#78716c] hover:bg-[#f5f5f4]"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <EmptyNote>{emptyLabel}</EmptyNote>
        )}
      </div>
    </div>
  );
}
