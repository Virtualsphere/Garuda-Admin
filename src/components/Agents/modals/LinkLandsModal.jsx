import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Search,
  MapPin,
  Map as MapIcon,
  Table as TableIcon,
  Link2,
  Unlink,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Building,
  RefreshCw,
} from 'lucide-react';

import PersonAvatar from '../common/PersonAvatar';
import InteractiveMap from '../maps/InteractiveMap';
import useVillageLocations, { toMapLands } from '../../../hooks/useVillageLocations';
import landService from '../../../services/landService';
import agentService from '../../../services/agentService';
import { AGENT_CODE } from '../agentConstants';

const norm = (v) => String(v || '').trim().toLowerCase();

const LINK_FILTERS = [
  { key: 'unlinked', label: 'Unlinked' },
  { key: 'mine', label: 'Linked to this agent' },
  { key: 'others', label: 'Linked to others' },
  { key: 'all', label: 'All' },
];

const ACRE_BANDS = [
  { key: 'all', label: 'Any size', test: () => true },
  { key: '<2', label: '< 2 ac', test: (a) => a < 2 },
  { key: '2-5', label: '2–5 ac', test: (a) => a >= 2 && a <= 5 },
  { key: '5-10', label: '5–10 ac', test: (a) => a > 5 && a <= 10 },
  { key: '>10', label: '> 10 ac', test: (a) => a > 10 },
];

const PRICE_BANDS = [
  { key: 'all', label: 'Any value', test: () => true },
  { key: '<25L', label: '< ₹25L', test: (v) => v < 2500000 },
  { key: '25L-50L', label: '₹25L–50L', test: (v) => v >= 2500000 && v <= 5000000 },
  { key: '50L-1Cr', label: '₹50L–1Cr', test: (v) => v > 5000000 && v <= 10000000 },
  { key: '>1Cr', label: '> ₹1Cr', test: (v) => v > 10000000 },
];

const acresOf = (land) => Number(land.landDetails?.total_acres) || 0;
const valueOf = (land) => Number(land.landDetails?.total_value) || 0;

const money = (v) => {
  const n = Number(v) || 0;
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
};

/**
 * Link land parcels to an agent, restricted to the villages they actually hold.
 *
 * The village list is the agent's own territory rather than the whole map,
 * because linking a parcel outside it would make the agent responsible for
 * ground they have no franchise over. Lands already linked to *another* agent
 * are shown but reassigning one is a separate, explicit confirm — a silent
 * takeover is the mistake this screen has to prevent.
 */
export default function LinkLandsModal({ agent, onClose, onChanged }) {
  const { villages } = useVillageLocations({});

  const [lands, setLands] = useState([]);
  const [agents, setAgents] = useState([]);
  const [territory, setTerritory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [viewMode, setViewMode] = useState('table');
  const [selectedVillage, setSelectedVillage] = useState('');
  const [linkFilter, setLinkFilter] = useState('unlinked');
  const [acreBand, setAcreBand] = useState('all');
  const [priceBand, setPriceBand] = useState('all');
  const [query, setQuery] = useState('');

  const [picked, setPicked] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [reassigning, setReassigning] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeMapLand, setActiveMapLand] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !confirming && !reassigning && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, confirming, reassigning]);

  const load = useCallback(async () => {
    setLoading(true);
    const [landResult, agentResult, territoryResult] = await Promise.allSettled([
      landService.getAll(),
      agentService.getAll(),
      agent?.id ? agentService.getTerritory(agent.id) : Promise.resolve({ result: [] }),
    ]);

    if (landResult.status === 'fulfilled') {
      const data = landResult.value;
      const rows = data.result || data.data || [];
      setLands(Array.isArray(rows) ? rows : []);
      setError(null);
    } else {
      console.error('Failed to load lands:', landResult.reason);
      setLands([]);
      setError('Could not load the land list.');
    }

    if (agentResult.status === 'fulfilled') {
      const data = agentResult.value;
      const rows = data.result || data.data || [];
      setAgents(Array.isArray(rows) ? rows : []);
    }

    if (territoryResult.status === 'fulfilled') {
      const data = territoryResult.value;
      setTerritory(data.result || data.data || []);
    }

    setLoading(false);
  }, [agent?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const say = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  // Their primary village plus every extra territory row — the only villages
  // whose lands this agent may be given.
  const territoryVillages = useMemo(() => {
    const names = new Set();
    if (agent?.village) names.add(agent.village);
    territory.forEach((row) => row.village && names.add(row.village));
    return [...names];
  }, [agent, territory]);

  useEffect(() => {
    if (!selectedVillage && territoryVillages.length) {
      setSelectedVillage(territoryVillages[0]);
    }
  }, [territoryVillages, selectedVillage]);

  const agentById = useMemo(() => {
    const map = new Map();
    agents.forEach((a) => map.set(String(a.id), a));
    return map;
  }, [agents]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const acre = ACRE_BANDS.find((b) => b.key === acreBand) || ACRE_BANDS[0];
    const price = PRICE_BANDS.find((b) => b.key === priceBand) || PRICE_BANDS[0];

    return lands.filter((land) => {
      if (selectedVillage && norm(land.village) !== norm(selectedVillage)) return false;

      const linkedTo = land.agent_id ? String(land.agent_id) : null;
      const isMine = linkedTo && String(linkedTo) === String(agent?.id);
      if (linkFilter === 'unlinked' && linkedTo) return false;
      if (linkFilter === 'mine' && !isMine) return false;
      if (linkFilter === 'others' && (!linkedTo || isMine)) return false;

      if (!acre.test(acresOf(land))) return false;
      if (!price.test(valueOf(land))) return false;

      if (!q) return true;
      return (
        String(land.id).includes(q) ||
        String(land.village || '').toLowerCase().includes(q) ||
        String(land.mandal || '').toLowerCase().includes(q)
      );
    });
  }, [lands, selectedVillage, linkFilter, acreBand, priceBand, query, agent?.id]);

  const toggle = (id) =>
    setPicked((prev) =>
      prev.some((p) => String(p) === String(id))
        ? prev.filter((p) => String(p) !== String(id))
        : [...prev, id]
    );

  const selectable = visible.filter((l) => !l.agent_id || String(l.agent_id) === String(agent?.id));
  const allPicked = selectable.length > 0 && selectable.every((l) => picked.some((p) => String(p) === String(l.id)));

  const linkPicked = async () => {
    setSaving(true);
    setError(null);
    try {
      // The API links one land at a time; do them in sequence so a failure
      // part-way names the land that failed rather than leaving it ambiguous.
      for (const id of picked) {
        await landService.linkToAgent(id, agent.id);
      }
      say(`Linked ${picked.length} land(s) to ${agent.name}`);
      setPicked([]);
      setConfirming(false);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not link every land. Some may have saved.');
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  };

  const reassign = async (land, toAgentId) => {
    setSaving(true);
    setError(null);
    try {
      await landService.linkToAgent(land.id, toAgentId || null);
      say(
        toAgentId
          ? `LD-${land.id} reassigned to ${agentById.get(String(toAgentId))?.name || 'agent'}`
          : `LD-${land.id} unlinked`
      );
      setReassigning(null);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reassign that land.');
    } finally {
      setSaving(false);
    }
  };

  if (!agent) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden text-xs relative"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-stone-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <PersonAvatar name={agent.name} photo={agent.photo} size={40} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-stone-900">{agent.name}</h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
                  {AGENT_CODE(agent.id)}
                </span>
                <span className="text-stone-300">•</span>
                <span className="text-[11px] text-stone-500 font-medium">Link lands to agent</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="text-[11px] text-stone-500">Attached territory:</span>
                {territoryVillages.length === 0 ? (
                  <span className="text-[11px] text-amber-700 font-semibold">
                    none — attach a village first
                  </span>
                ) : (
                  territoryVillages.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setSelectedVillage(name)}
                      className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${
                        norm(name) === norm(selectedVillage)
                          ? 'bg-blue-600 text-white'
                          : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200'
                      }`}
                    >
                      <MapPin className="w-3 h-3" />
                      {name}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="p-1 rounded-xl bg-stone-100 border border-stone-200 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewMode('map')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  viewMode === 'map'
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5 text-blue-600" />
                MAP VIEW
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5 text-emerald-600" />
                TABLE VIEW
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-9 h-9 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-5 py-2.5 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-stone-400 uppercase font-bold text-[10px] tracking-wider">
              Territory:
            </span>
            <span className="px-2 py-1 rounded bg-white border border-stone-200 font-medium text-stone-700">
              {agent.state || '—'}
            </span>
            <span className="text-stone-300">/</span>
            <span className="px-2 py-1 rounded bg-white border border-stone-200 font-medium text-stone-700">
              {agent.district || '—'}
            </span>
            <span className="text-stone-300">/</span>
            <select
              value={selectedVillage}
              onChange={(e) => setSelectedVillage(e.target.value)}
              disabled={territoryVillages.length === 0}
              className="px-2.5 py-1 rounded-lg bg-white border-2 border-[#2563EB] font-bold text-[#2563EB] disabled:opacity-50 disabled:border-stone-200 disabled:text-stone-400"
            >
              {territoryVillages.map((v) => (
                <option key={v} value={v}>
                  {v} (official village)
                </option>
              ))}
              {territoryVillages.length === 0 && <option value="">No territory</option>}
            </select>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search land ID, village, mandal…"
                className="pl-8 pr-3 py-1 rounded-lg border border-stone-200 bg-white text-xs w-52"
              />
            </div>

            <select
              value={linkFilter}
              onChange={(e) => setLinkFilter(e.target.value)}
              className="px-2 py-1 rounded-lg border border-stone-200 bg-white text-stone-700"
            >
              {LINK_FILTERS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>

            <select
              value={acreBand}
              onChange={(e) => setAcreBand(e.target.value)}
              className="px-2 py-1 rounded-lg border border-stone-200 bg-white text-stone-700"
            >
              {ACRE_BANDS.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
            </select>

            <select
              value={priceBand}
              onChange={(e) => setPriceBand(e.target.value)}
              className="px-2 py-1 rounded-lg border border-stone-200 bg-white text-stone-700"
            >
              {PRICE_BANDS.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={load}
              className="px-2 py-1 rounded-lg border border-stone-200 bg-white text-stone-700 font-semibold inline-flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-3 bg-rose-50 border border-rose-200 text-rose-700 font-semibold rounded-lg px-3 py-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* Workspace */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-20 flex items-center justify-center">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-stone-500">
                <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading lands…
              </span>
            </div>
          ) : territoryVillages.length === 0 ? (
            <div className="py-20 text-center px-6">
              <MapPin className="w-9 h-9 text-stone-300 mx-auto mb-2" />
              <p className="font-semibold text-stone-600">
                {agent.name} has no attached village yet
              </p>
              <p className="text-[11px] text-stone-400 mt-1">
                Lands are linked within an agent's own territory. Attach a village to them
                first, then come back here.
              </p>
            </div>
          ) : viewMode === 'map' ? (
            <div className="p-4 space-y-2">
              <InteractiveMap
                height="440px"
                villages={villages}
                lands={toMapLands(visible)}
                showAllotmentColors
                selectedLandId={activeMapLand?.id}
                onSelectLand={(l) => setActiveMapLand(l.raw || l)}
              />
              <div className="flex items-center justify-between gap-2 text-[11px] text-stone-500">
                <span>
                  {visible.length} parcel(s) in {selectedVillage} matching the filters.
                </span>
                {activeMapLand && (
                  <span className="text-stone-700 font-semibold">
                    Selected LD-{activeMapLand.id} ·{' '}
                    {acresOf(activeMapLand) || '—'} ac · {money(valueOf(activeMapLand))}
                    <button
                      type="button"
                      onClick={() => toggle(activeMapLand.id)}
                      className="ml-2 px-2 py-0.5 rounded bg-[#2563EB] text-white font-bold"
                    >
                      {picked.some((p) => String(p) === String(activeMapLand.id))
                        ? 'Remove from selection'
                        : 'Add to selection'}
                    </button>
                  </span>
                )}
              </div>
            </div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200 sticky top-0 z-10">
                <tr>
                  <th className="p-3 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={allPicked}
                      onChange={() =>
                        setPicked(allPicked ? [] : selectable.map((l) => l.id))
                      }
                      className="accent-[#2563EB]"
                      aria-label="Select all"
                    />
                  </th>
                  <th className="p-3">Land ID</th>
                  <th className="p-3">Village</th>
                  <th className="p-3">Mandal</th>
                  <th className="p-3">Acres</th>
                  <th className="p-3 text-right">Price (total)</th>
                  <th className="p-3">Current agent</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {visible.map((land) => {
                  const linkedTo = land.agent_id ? agentById.get(String(land.agent_id)) : null;
                  const isMine = land.agent_id && String(land.agent_id) === String(agent.id);
                  const isPicked = picked.some((p) => String(p) === String(land.id));
                  const blocked = Boolean(land.agent_id) && !isMine;

                  return (
                    <tr
                      key={land.id}
                      className={`hover:bg-stone-50/70 ${isPicked ? 'bg-blue-50/60' : ''}`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isPicked}
                          disabled={blocked}
                          onChange={() => toggle(land.id)}
                          className="accent-[#2563EB] disabled:opacity-30"
                          aria-label={`Select LD-${land.id}`}
                        />
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-stone-900 inline-flex items-center gap-1.5">
                          <Building className="w-3 h-3 text-stone-400" />
                          LD-{land.id}
                        </span>
                      </td>
                      <td className="p-3 text-stone-700 font-medium">{land.village || '—'}</td>
                      <td className="p-3 text-stone-600">{land.mandal || '—'}</td>
                      <td className="p-3 font-semibold text-stone-800">
                        {acresOf(land) ? `${acresOf(land)} ac` : '—'}
                      </td>
                      <td className="p-3 text-right font-semibold text-stone-800">
                        {valueOf(land) ? money(valueOf(land)) : '—'}
                      </td>
                      <td className="p-3">
                        {linkedTo ? (
                          <span
                            className={`inline-flex items-center gap-1.5 ${
                              isMine ? 'text-emerald-800 font-bold' : 'text-stone-700'
                            }`}
                          >
                            <PersonAvatar name={linkedTo.name} photo={linkedTo.photo} size="xs" />
                            {linkedTo.name}
                            {isMine && (
                              <span className="px-1.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                                this agent
                              </span>
                            )}
                          </span>
                        ) : land.agent_id ? (
                          <span className="text-stone-500">#{land.agent_id}</span>
                        ) : (
                          <span className="italic text-stone-400">Unlinked</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {isMine ? (
                          <button
                            type="button"
                            onClick={() => reassign(land, null)}
                            disabled={saving}
                            className="px-2.5 py-1 rounded-lg border border-stone-200 bg-white text-stone-600 hover:text-rose-700 hover:border-rose-200 font-semibold inline-flex items-center gap-1 disabled:opacity-40"
                          >
                            <Unlink className="w-3 h-3" />
                            Unlink
                          </button>
                        ) : land.agent_id ? (
                          <button
                            type="button"
                            onClick={() => setReassigning(land)}
                            className="px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 font-semibold hover:bg-amber-100"
                          >
                            Reassign…
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggle(land.id)}
                            className="px-2.5 py-1 rounded-lg border border-stone-200 bg-white text-[#2563EB] font-bold hover:bg-blue-50"
                          >
                            {isPicked ? 'Selected' : 'Select'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {visible.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-stone-400">
                      No land in {selectedVillage || 'this village'} matches the filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-stone-600">
            <strong className="text-stone-900">{picked.length}</strong> selected ·{' '}
            {visible.length} shown
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 font-semibold"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={picked.length === 0 || saving}
              className="px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-stone-300 disabled:cursor-not-allowed text-white font-bold inline-flex items-center gap-1.5"
            >
              <Link2 className="w-3.5 h-3.5" />
              Link {picked.length || ''} land{picked.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>

        {/* Confirm link */}
        {confirming && (
          <div className="absolute inset-0 z-20 bg-stone-900/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-md w-full p-5 space-y-3">
              <h3 className="font-bold text-stone-900 text-sm">Confirm land linking</h3>
              <p className="text-[11px] text-stone-600">
                {picked.length} parcel(s) in {selectedVillage} will be officially linked to{' '}
                <strong>{agent.name}</strong>. They become responsible for reporting on them.
              </p>
              <div className="max-h-32 overflow-y-auto border border-stone-200 rounded-lg divide-y divide-stone-100">
                {picked.map((id) => {
                  const l = lands.find((x) => String(x.id) === String(id));
                  return (
                    <div key={id} className="px-2.5 py-1.5 flex justify-between gap-2">
                      <span className="font-bold text-stone-800">LD-{id}</span>
                      <span className="text-stone-500">
                        {l ? `${acresOf(l) || '—'} ac · ${money(valueOf(l))}` : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={linkPicked}
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-[#2563EB] text-white font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reassign */}
        {reassigning && (
          <div className="absolute inset-0 z-20 bg-stone-900/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-md w-full p-5 space-y-3">
              <h3 className="font-bold text-stone-900 text-sm">Reassign land to agent</h3>
              <p className="text-[11px] text-stone-600">
                LD-{reassigning.id} is currently linked to{' '}
                <strong>
                  {agentById.get(String(reassigning.agent_id))?.name ||
                    `#${reassigning.agent_id}`}
                </strong>
                . Moving it makes {agent.name} responsible instead.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReassigning(null)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => reassign(reassigning, agent.id)}
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Reassign to {agent.name}
                </button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className="absolute bottom-20 right-5 px-3 py-2 bg-stone-900 text-white rounded-lg text-[11px] font-semibold shadow-xl inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
