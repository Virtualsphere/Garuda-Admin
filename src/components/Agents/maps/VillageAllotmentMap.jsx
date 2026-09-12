import { useState, useMemo } from 'react';
import { Loader2, AlertTriangle, MapPin, Users2, Building2 } from 'lucide-react';

import InteractiveMap from './InteractiveMap';
import useVillageLocations from '../../../hooks/useVillageLocations';

/**
 * The schematic allotment view: every village in the territory coloured by
 * whether its seats are open, wanted, or filled — with the selected village's
 * detail beside it.
 *
 * `candidatePins` lets a caller scatter the people it cares about (interested
 * candidates, say) across the villages they want, which is what makes this
 * more useful than a plain list.
 */
export default function VillageAllotmentMap({
  filters = {},
  candidatePins = [],
  height = '480px',
  onSelectVillage,
  selectable = true,
}) {
  const { villages, totals, loading, error } = useVillageLocations(filters);
  const [selectedId, setSelectedId] = useState(null);

  const selected = useMemo(
    () => villages.find((v) => String(v.id) === String(selectedId)) || null,
    [villages, selectedId]
  );

  const handleSelect = (village) => {
    if (!selectable) return;
    setSelectedId(village.id);
    onSelectVillage?.(village);
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-8 relative">
          {loading && (
            <div className="absolute inset-0 z-20 bg-white/70 rounded-lg flex items-center justify-center">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-stone-600">
                <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading territory…
              </span>
            </div>
          )}

          <InteractiveMap
            height={height}
            villages={villages}
            candidatePins={candidatePins}
            showAllotmentColors
            selectedVillageId={selectedId}
            onSelectVillage={handleSelect}
          />
        </div>

        {/* Village detail */}
        <div className="lg:col-span-4 bg-white rounded-lg border border-stone-200 p-4 space-y-3">
          {selected ? (
            <>
              <div className="pb-2 border-b border-stone-200">
                <span className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">
                  Village allotment status
                </span>
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-[#2563EB]" />
                  {selected.name}
                </h3>
                <p className="text-[11px] text-stone-500">
                  {selected.mandal} Mandal · {selected.district}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Attached" value={selected.attachedAgentsCount} tone="slate" />
                <Stat label="Interested" value={selected.interestedAgentsCount} tone="sky" />
                <Stat
                  label="Vacancy"
                  value={selected.vacancy}
                  tone={selected.vacancy > 0 ? 'emerald' : 'slate'}
                />
              </div>

              <div className="p-2.5 bg-stone-50 border border-stone-200 rounded-lg space-y-1.5 text-[11px]">
                <Row label="Required agents" value={selected.requiredAgents} />
                <Row label="Lands mapped" value={selected.node?.land_count ?? 0} />
                <Row
                  label="Acres"
                  value={Math.round(Number(selected.node?.total_acres) || 0).toLocaleString('en-IN')}
                />
                <Row
                  label="Coordinate"
                  value={
                    selected.centerCoordinates?.lat != null
                      ? `${Number(selected.centerCoordinates.lat).toFixed(3)}, ${Number(
                          selected.centerCoordinates.lng
                        ).toFixed(3)}`
                      : '—'
                  }
                />
              </div>

              {selected.node?.agents?.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-stone-500 flex items-center gap-1">
                    <Users2 className="w-3 h-3" /> Agents deployed here
                  </span>
                  {selected.node.agents.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center justify-between gap-2 p-1.5 bg-white border border-stone-200 rounded text-[11px]"
                    >
                      <span className="font-semibold text-stone-800 truncate">{agent.name}</span>
                      <span className="text-stone-400">{agent.phone}</span>
                    </div>
                  ))}
                </div>
              )}

              {selected.vacancy > 0 && (
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-900 font-semibold flex items-start gap-1.5">
                  <Building2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {selected.vacancy} seat{selected.vacancy === 1 ? '' : 's'} still open in{' '}
                  {selected.name}.
                </div>
              )}
            </>
          ) : (
            <div className="py-10 text-center space-y-2">
              <MapPin className="w-6 h-6 text-stone-300 mx-auto" />
              <p className="text-xs text-stone-400">
                Click a village on the map to see its allotment status.
              </p>
              <div className="pt-2 grid grid-cols-3 gap-2 text-center">
                <Stat label="Villages" value={totals.nodes} tone="slate" />
                <Stat label="Agents" value={totals.agents} tone="slate" />
                <Stat label="Open seats" value={totals.vacancies} tone="emerald" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Local pieces ─────────────────────────────────────────────── */

const TONES = {
  slate: 'bg-slate-50 border-slate-200 text-slate-800',
  sky: 'bg-sky-50 border-sky-200 text-sky-800',
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
};

function Stat({ label, value, tone = 'slate' }) {
  return (
    <div className={`rounded-lg border py-2 ${TONES[tone]}`}>
      <div className="text-base font-black leading-none">{value ?? 0}</div>
      <div className="text-[9px] font-bold uppercase tracking-wider mt-1 opacity-70">
        {label}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-stone-500">{label}</span>
      <strong className="text-stone-900">{value}</strong>
    </div>
  );
}
