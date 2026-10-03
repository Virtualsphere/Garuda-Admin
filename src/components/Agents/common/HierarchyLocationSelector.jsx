import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  MapPin,
  Building2,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  Map as MapIcon,
  Search,
  ChevronRight,
  Home,
  Compass,
  Edit3,
  Check,
  Sparkles,
} from 'lucide-react';

import useLocationTree from '../../../hooks/useLocationTree';

const norm = (v) => String(v || '').trim().toLowerCase();
const uniqueSorted = (list) => [...new Set(list.filter(Boolean))].sort((a, b) => a.localeCompare(b));

/**
 * A village the map has no seat data for — present in the location tree but
 * never synced into the recruitment map. It can still be chosen as a native or
 * interested village; it just cannot claim to have vacancy either way.
 */
const unmappedVillage = ({ name, state, district, mandal }) => ({
  id: `unmapped::${norm(state)}::${norm(district)}::${norm(mandal)}::${norm(name)}`,
  name,
  state,
  district,
  mandal,
  requiredAgents: 0,
  attachedAgentsCount: 0,
  interestedAgentsCount: 0,
  vacancy: 0,
  centerCoordinates: {},
  boundaryPolygon: [],
  isUnmapped: true,
});

/** 'open' | 'full' | 'unmapped' — what a village's seat state allows us to say. */
const seatState = (village) => {
  if (!village || village.isUnmapped) return 'unmapped';
  return (village.vacancy ?? 0) > 0 ? 'open' : 'full';
};

/**
 * Pick the villages a candidate lives in and would work in.
 *
 * Section 1 is the candidate's native village and whether it still has a seat;
 * Section 2 browses State → District → Mandal → Village to add other villages of
 * interest. Villages come from the recruitment map (they carry seat counts); the
 * location tree fills in the districts, mandals and villages the map has not
 * been synced for, so the cascade is complete without a hard-coded list.
 *
 * The component only reports choices — it holds no candidate state of its own.
 * The caller persists them.
 */
export default function HierarchyLocationSelector({
  villages = [],
  candidateState = 'Telangana',
  candidateDistrict = '',
  candidateMandal = '',
  candidateNativeVillage,
  selectedVillage,
  onSelectVillage,
  onAddInterest,
  interestedVillages = [],
  onRemoveInterest,
  onViewOnMap,
  onSetNativeVillage,
}) {
  const tree = useLocationTree();

  /* ── Section 1: native village ────────────────────────────── */

  const [nativeVillageName, setNativeVillageName] = useState(
    candidateNativeVillage || candidateMandal || ''
  );
  const [isEditingNative, setIsEditingNative] = useState(false);
  const [nativeSearchInput, setNativeSearchInput] = useState('');
  const [nativeVillageConfirmed, setNativeVillageConfirmed] = useState(false);

  useEffect(() => {
    if (candidateNativeVillage) setNativeVillageName(candidateNativeVillage);
  }, [candidateNativeVillage]);

  const nativeVillageObj = useMemo(() => {
    if (!nativeVillageName) return null;
    const found = villages.find((v) => norm(v.name) === norm(nativeVillageName));
    if (found) return found;
    return unmappedVillage({
      name: nativeVillageName,
      state: candidateState,
      district: candidateDistrict,
      mandal: candidateMandal,
    });
  }, [villages, nativeVillageName, candidateState, candidateDistrict, candidateMandal]);

  const nativeSeats = seatState(nativeVillageObj);

  /* ── Section 2: browsing the hierarchy ────────────────────── */

  const [activeState, setActiveState] = useState(candidateState || '');
  const [activeDistrict, setActiveDistrict] = useState(candidateDistrict || '');
  const [activeMandal, setActiveMandal] = useState(candidateMandal || '');
  const [villageSearchQuery, setVillageSearchQuery] = useState('');

  useEffect(() => {
    if (candidateState) setActiveState(candidateState);
  }, [candidateState]);
  useEffect(() => {
    if (candidateDistrict) setActiveDistrict(candidateDistrict);
  }, [candidateDistrict]);
  useEffect(() => {
    if (candidateMandal) setActiveMandal(candidateMandal);
  }, [candidateMandal]);

  const stateList = useMemo(
    () =>
      uniqueSorted([
        ...tree.states.map((s) => s.name),
        ...villages.map((v) => v.state),
        candidateState,
      ]),
    [tree.states, villages, candidateState]
  );

  const districtList = useMemo(
    () =>
      uniqueSorted([
        ...tree.districtsOf(activeState).map((d) => d.name),
        ...villages.filter((v) => norm(v.state) === norm(activeState)).map((v) => v.district),
        // Keep the candidate's own district choosable even if neither source lists it.
        norm(activeState) === norm(candidateState) ? candidateDistrict : '',
      ]),
    [tree, villages, activeState, candidateState, candidateDistrict]
  );

  const mandalList = useMemo(
    () =>
      uniqueSorted([
        ...tree.mandalsOf(activeState, activeDistrict).map((m) => m.name),
        ...villages
          .filter((v) => norm(v.state) === norm(activeState) && norm(v.district) === norm(activeDistrict))
          .map((v) => v.mandal),
        norm(activeDistrict) === norm(candidateDistrict) ? candidateMandal : '',
      ]),
    [tree, villages, activeState, activeDistrict, candidateDistrict, candidateMandal]
  );

  const firstDistrictOf = useCallback(
    (stateName) =>
      uniqueSorted([
        ...tree.districtsOf(stateName).map((d) => d.name),
        ...villages.filter((v) => norm(v.state) === norm(stateName)).map((v) => v.district),
      ])[0] || '',
    [tree, villages]
  );

  const firstMandalOf = useCallback(
    (stateName, districtName) =>
      uniqueSorted([
        ...tree.mandalsOf(stateName, districtName).map((m) => m.name),
        ...villages
          .filter((v) => norm(v.state) === norm(stateName) && norm(v.district) === norm(districtName))
          .map((v) => v.mandal),
      ])[0] || '',
    [tree, villages]
  );

  const handleStateChange = (next) => {
    const district = firstDistrictOf(next);
    setActiveState(next);
    setActiveDistrict(district);
    setActiveMandal(firstMandalOf(next, district));
  };

  const handleDistrictChange = (next) => {
    setActiveDistrict(next);
    setActiveMandal(firstMandalOf(activeState, next));
  };

  // Every village of the active mandal: the map's (with seats) first, then any
  // the location tree knows that the map does not.
  const mandalVillages = useMemo(() => {
    const mapped = villages.filter(
      (v) => norm(v.district) === norm(activeDistrict) && norm(v.mandal) === norm(activeMandal)
    );
    const mappedNames = new Set(mapped.map((v) => norm(v.name)));
    const extra = tree
      .villagesOf(activeState, activeDistrict, activeMandal)
      .filter((v) => !mappedNames.has(norm(v.name)))
      .map((v) =>
        unmappedVillage({
          name: v.name,
          state: activeState,
          district: activeDistrict,
          mandal: activeMandal,
        })
      );
    return [...mapped, ...extra];
  }, [villages, tree, activeState, activeDistrict, activeMandal]);

  const handleMandalChange = (next) => {
    setActiveMandal(next);
    setVillageSearchQuery('');
    const first = villages.find(
      (v) => norm(v.district) === norm(activeDistrict) && norm(v.mandal) === norm(next)
    );
    if (first) onSelectVillage?.(first);
  };

  const villagesInMandal = useMemo(() => {
    const q = norm(villageSearchQuery);
    return q ? mandalVillages.filter((v) => norm(v.name).includes(q)) : mandalVillages;
  }, [mandalVillages, villageSearchQuery]);

  const activeVillageObj = useMemo(
    () => selectedVillage || villagesInMandal[0] || null,
    [selectedVillage, villagesInMandal]
  );

  const isInterested = (name) => interestedVillages.some((v) => norm(v) === norm(name));
  const isCurrentBrowsedInterested = Boolean(activeVillageObj && isInterested(activeVillageObj.name));

  // Open seats nearby, offered as one-click additions.
  const suggestedNeighboringVacancies = useMemo(() => {
    const nativeMandal = norm(nativeVillageObj?.mandal);
    const mandal = norm(activeMandal);
    const chosen = new Set(interestedVillages.map(norm));
    return villages
      .filter((v) => {
        const inScope = (mandal && norm(v.mandal) === mandal) || (nativeMandal && norm(v.mandal) === nativeMandal);
        return (
          inScope &&
          norm(v.name) !== norm(nativeVillageName) &&
          !chosen.has(norm(v.name)) &&
          (v.vacancy ?? 0) > 0
        );
      })
      .slice(0, 4);
  }, [villages, activeMandal, nativeVillageObj, nativeVillageName, interestedVillages]);

  // Native-village search: the map first, then the whole tree.
  const nativeSuggestions = useMemo(() => {
    const q = norm(nativeSearchInput);
    if (!q) return [];
    const found = new Map();
    villages
      .filter((v) => norm(v.name).includes(q))
      .forEach((v) => found.set(`${norm(v.name)}|${norm(v.mandal)}`, { name: v.name, mandal: v.mandal }));

    if (found.size < 10) {
      tree.states.forEach((s) =>
        tree.districtsOf(s.name).forEach((d) =>
          tree.mandalsOf(s.name, d.name).forEach((m) =>
            tree.villagesOf(s.name, d.name, m.name).forEach((v) => {
              if (norm(v.name).includes(q)) {
                const key = `${norm(v.name)}|${norm(m.name)}`;
                if (!found.has(key)) found.set(key, { name: v.name, mandal: m.name });
              }
            })
          )
        )
      );
    }
    return [...found.values()].slice(0, 10);
  }, [nativeSearchInput, villages, tree]);

  const chooseNative = (name) => {
    setNativeVillageName(name);
    onSetNativeVillage?.(name);
    setIsEditingNative(false);
  };

  return (
    <div className="space-y-4">
      {/* ── Section 1 ──────────────────────────────────────── */}
      <div className="rounded-xl border-2 border-blue-200/90 bg-linear-to-b from-blue-50/60 via-white to-white p-3.5 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-blue-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-2xs shrink-0">
              <Home className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-blue-600 text-white uppercase tracking-wider">
                  Section 1
                </span>
                <h3 className="text-xs font-bold text-stone-900 tracking-tight">
                  Candidate Native Village &amp; Vacancy Details
                </h3>
              </div>
              <p className="text-[10px] text-stone-500">
                Candidate native residence and live vacancy status
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditingNative ? (
              <button
                type="button"
                onClick={() => {
                  setIsEditingNative(true);
                  setNativeSearchInput('');
                }}
                title="Change candidate native village"
                className="px-2.5 py-1 rounded bg-white hover:bg-stone-50 text-blue-700 font-semibold text-xs border border-blue-300 shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Edit3 className="w-3 h-3 text-blue-600" />
                <span>Change Native Village</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingNative(false)}
                className="px-2.5 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {isEditingNative && (
          <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-200 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-stone-800">
              <span>Select or Search Native Village:</span>
              <span className="text-[10px] text-stone-500">Fast Lookup</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-8 relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Type village name (e.g. Kandi, Sadasivpet, Aloor)..."
                  value={nativeSearchInput}
                  onChange={(e) => setNativeSearchInput(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white rounded-lg border border-blue-300 focus:ring-2 focus:ring-blue-500 text-stone-900"
                />
              </div>
              <div className="sm:col-span-4 flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={!nativeSearchInput.trim()}
                  onClick={() => chooseNative(nativeSearchInput.trim())}
                  className="w-full py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-stone-300 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>

            {nativeSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {nativeSuggestions.map((v) => (
                  <button
                    key={`${v.name}|${v.mandal}`}
                    type="button"
                    onClick={() => chooseNative(v.name)}
                    className="px-2 py-0.5 rounded text-xs bg-white hover:bg-blue-100 border border-blue-200 text-stone-800 flex items-center gap-1 cursor-pointer"
                  >
                    <span className="font-semibold">{v.name}</span>
                    <span className="text-[10px] text-stone-500">({v.mandal})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {nativeVillageObj ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-6 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-extrabold text-stone-900 tracking-tight flex items-center gap-1.5">
                  <span>{nativeVillageName}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-900 border border-blue-300">
                    Native Village
                  </span>
                </span>
              </div>
              <p className="text-xs text-stone-600 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span>
                  {nativeVillageObj.mandal || candidateMandal || '—'} Mandal ·{' '}
                  {nativeVillageObj.district || candidateDistrict || '—'} District ·{' '}
                  {nativeVillageObj.state || candidateState || '—'}
                </span>
              </p>

              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <div className="bg-stone-50 rounded-lg p-1.5 border border-stone-200 text-center">
                  <span className="text-[9px] text-stone-500 block uppercase font-bold">Total Quota</span>
                  <span className="text-xs font-bold text-stone-800">
                    {nativeSeats === 'unmapped' ? '—' : `${nativeVillageObj.requiredAgents} Agents`}
                  </span>
                </div>
                <div className="bg-stone-50 rounded-lg p-1.5 border border-stone-200 text-center">
                  <span className="text-[9px] text-stone-500 block uppercase font-bold">Attached</span>
                  <span className="text-xs font-bold text-stone-800">
                    {nativeSeats === 'unmapped' ? '—' : nativeVillageObj.attachedAgentsCount}
                  </span>
                </div>
                <div
                  className={`rounded-lg p-1.5 border text-center ${
                    nativeSeats === 'open'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : nativeSeats === 'full'
                      ? 'bg-amber-50 border-amber-300 text-amber-900'
                      : 'bg-stone-50 border-stone-200 text-stone-700'
                  }`}
                >
                  <span className="text-[9px] block uppercase font-bold">Vacancies</span>
                  <span className="text-xs font-extrabold">
                    {nativeSeats === 'unmapped'
                      ? '—'
                      : `${nativeVillageObj.vacancy} ${nativeSeats === 'open' ? 'Open' : 'Full'}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="md:col-span-6">
              {nativeSeats === 'open' ? (
                <div className="p-3 bg-emerald-50/90 border border-emerald-300 rounded-xl space-y-2 shadow-2xs">
                  <div className="flex items-center gap-2 text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-bold">
                      ✓ Native Village Has Vacancy ({nativeVillageObj.vacancy} Open Slot)
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Candidate native village <strong>&quot;{nativeVillageName}&quot;</strong> has
                    open slots. They can be recruited directly as primary agent here.
                  </p>
                  <div className="pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setNativeVillageConfirmed(true);
                        onSetNativeVillage?.(nativeVillageName);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer ${
                        nativeVillageConfirmed
                          ? 'bg-emerald-700 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        {nativeVillageConfirmed
                          ? 'Native Village Confirmed ✓'
                          : 'Assign Native Village as Primary'}
                      </span>
                    </button>
                  </div>
                </div>
              ) : nativeSeats === 'full' ? (
                <div className="p-3 bg-amber-50/90 border border-amber-300 rounded-xl space-y-2 shadow-2xs">
                  <div className="flex items-center gap-2 text-amber-900">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-xs font-bold">✕ Native Village Quota Full (0 Slots)</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    <strong>&quot;{nativeVillageName}&quot;</strong> quota is already full. Please
                    select neighboring villages from{' '}
                    <strong>Section 2 (Other Interested Villages)</strong> below.
                  </p>
                  <div className="text-[10px] text-amber-700 font-semibold flex items-center gap-1">
                    <span>Select neighboring villages from section below</span>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1 shadow-2xs">
                  <div className="flex items-center gap-2 text-stone-800">
                    <AlertCircle className="w-4 h-4 text-stone-500 shrink-0" />
                    <span className="text-xs font-bold">No seat data for this village yet</span>
                  </div>
                  <p className="text-[11px] text-stone-600 leading-relaxed">
                    <strong>&quot;{nativeVillageName}&quot;</strong> has not been set up on the
                    recruitment map, so its vacancy is unknown. Sync its seats from the map first,
                    or pick a mapped village in Section 2.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-stone-500 py-2">
            No native village recorded yet — use &quot;Change Native Village&quot; to set one.
          </p>
        )}
      </div>

      {/* ── Section 2 ──────────────────────────────────────── */}
      <div className="rounded-xl border border-purple-200 bg-white p-3.5 space-y-3.5 shadow-2xs">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-purple-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-2xs shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-purple-600 text-white uppercase tracking-wider">
                  Section 2
                </span>
                <h3 className="text-xs font-bold text-stone-900 tracking-tight">
                  Other / Additional Interested Villages
                </h3>
                <span className="text-[10px] px-2 py-0.2 rounded-full font-bold bg-purple-100 text-purple-900 border border-purple-300">
                  {interestedVillages.length} Selected
                </span>
              </div>
              <p className="text-[10px] text-stone-500">
                Select other villages or neighboring mandals the candidate is interested in working
              </p>
            </div>
          </div>

          {onViewOnMap && (
            <button
              type="button"
              onClick={onViewOnMap}
              className="px-2.5 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold flex items-center gap-1.5 border border-stone-300 transition-colors cursor-pointer"
            >
              <MapIcon className="w-3 h-3 text-purple-600" />
              <span>Map View</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-stone-700 flex items-center justify-between">
              <span>1. State</span>
            </label>
            <select
              value={activeState}
              onChange={(e) => handleStateChange(e.target.value)}
              className="w-full text-xs font-medium bg-stone-50 hover:bg-white border border-stone-300 rounded-lg py-1.5 px-2.5 text-stone-900 focus:ring-1 focus:ring-purple-500 cursor-pointer"
            >
              {stateList.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-stone-700 flex items-center justify-between">
              <span>2. District</span>
            </label>
            <select
              value={activeDistrict}
              onChange={(e) => handleDistrictChange(e.target.value)}
              className="w-full text-xs font-medium bg-stone-50 hover:bg-white border border-stone-300 rounded-lg py-1.5 px-2.5 text-stone-900 focus:ring-1 focus:ring-purple-500 cursor-pointer"
            >
              {districtList.map((dist) => (
                <option key={dist} value={dist}>
                  {dist}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-stone-700 flex items-center justify-between">
              <span>3. Mandal</span>
              <span className="text-[9px] text-stone-400">{mandalList.length} mandals</span>
            </label>
            <select
              value={activeMandal}
              onChange={(e) => handleMandalChange(e.target.value)}
              className="w-full text-xs font-medium bg-stone-50 hover:bg-white border border-stone-300 rounded-lg py-1.5 px-2.5 text-stone-900 focus:ring-1 focus:ring-purple-500 cursor-pointer"
            >
              {mandalList.map((m) => (
                <option key={m} value={m}>
                  {m} Mandal
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-stone-700 flex items-center justify-between">
              <span>4. Village</span>
              <span className="text-[9px] text-purple-700 font-bold">
                {villagesInMandal.length} in {activeMandal || '—'}
              </span>
            </label>
            <select
              value={activeVillageObj?.name || ''}
              onChange={(e) => {
                const target = villagesInMandal.find((v) => norm(v.name) === norm(e.target.value));
                if (target) onSelectVillage?.(target);
              }}
              className="w-full text-xs font-semibold bg-stone-50 hover:bg-white border border-purple-300 text-purple-950 rounded-lg py-1.5 px-2.5 focus:ring-1 focus:ring-purple-500 cursor-pointer"
            >
              {villagesInMandal.length === 0 && <option value="">No villages here</option>}
              {villagesInMandal.map((v) => (
                <option key={v.id} value={v.name}>
                  {v.name}{' '}
                  {v.isUnmapped
                    ? '(not on map)'
                    : v.vacancy > 0
                    ? `(✓ Open: ${v.vacancy} vacant)`
                    : '(Filled · 0 slots)'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-stone-50/90 rounded-lg border border-stone-200/90 p-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs">
              <Building2 className="w-3.5 h-3.5 text-stone-600" />
              <span className="font-bold text-stone-800">
                Villages in {activeMandal || '—'} ({activeDistrict || '—'}):
              </span>
            </div>

            <div className="relative w-48">
              <Search className="w-3 h-3 text-stone-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={`Filter in ${activeMandal || 'mandal'}...`}
                value={villageSearchQuery}
                onChange={(e) => setVillageSearchQuery(e.target.value)}
                className="w-full pl-6 pr-2 py-0.5 text-xs rounded border border-stone-300 bg-white placeholder-stone-400 focus:ring-1 focus:ring-purple-500"
              />
              {villageSearchQuery && (
                <button
                  type="button"
                  onClick={() => setVillageSearchQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-0.5">
            {villagesInMandal.length > 0 ? (
              villagesInMandal.map((v) => {
                const isSelected = Boolean(activeVillageObj && norm(activeVillageObj.name) === norm(v.name));
                const interested = isInterested(v.name);
                const seats = seatState(v);

                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onSelectVillage?.(v)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-purple-600 text-white border-purple-700 shadow-2xs ring-2 ring-purple-300'
                        : interested
                        ? 'bg-purple-100 text-purple-900 border-purple-300'
                        : 'bg-white text-stone-800 border-stone-200 hover:border-purple-300 hover:bg-purple-50/50'
                    }`}
                  >
                    <span>{v.name}</span>
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                        isSelected
                          ? 'bg-purple-500 text-white'
                          : seats === 'open'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {seats === 'open' ? `${v.vacancy} Vacant` : seats === 'full' ? 'Filled' : 'Not on map'}
                    </span>
                    {interested && !isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                    )}
                  </button>
                );
              })
            ) : (
              <div className="w-full text-center py-2 text-stone-500 text-xs">
                No villages recorded for &quot;{activeMandal || 'this mandal'}&quot;.
              </div>
            )}
          </div>
        </div>

        {activeVillageObj && (
          <div className="p-3 bg-linear-to-r from-purple-50/60 via-stone-50 to-blue-50/40 rounded-xl border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-stone-900 text-sm">{activeVillageObj.name}</span>
                <span className="text-xs text-stone-500">
                  ({activeVillageObj.mandal} Mandal, {activeVillageObj.district} Dist)
                </span>

                {seatState(activeVillageObj) === 'open' ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Available ({activeVillageObj.vacancy} Open Slot)
                  </span>
                ) : seatState(activeVillageObj) === 'full' ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-200 text-stone-800 border border-stone-300 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-stone-600" />
                    Full (0 Slots)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-600 border border-stone-300 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-stone-500" />
                    Not on the map yet
                  </span>
                )}
              </div>

              {seatState(activeVillageObj) !== 'unmapped' && (
                <div className="flex items-center gap-3 text-[11px] text-stone-600">
                  <span>
                    Quota Required: <strong className="text-stone-900">{activeVillageObj.requiredAgents}</strong>
                  </span>
                  <span>·</span>
                  <span>
                    Filled: <strong className="text-stone-900">{activeVillageObj.attachedAgentsCount}</strong>
                  </span>
                  <span>·</span>
                  <span>
                    Vacancies: <strong className="text-stone-900">{activeVillageObj.vacancy}</strong>
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onAddInterest?.(activeVillageObj.name)}
                disabled={isCurrentBrowsedInterested}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors ${
                  isCurrentBrowsedInterested
                    ? 'bg-purple-100 text-purple-800 border border-purple-300 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700 text-white border border-purple-700 cursor-pointer'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>
                  {isCurrentBrowsedInterested ? 'Already Added ✓' : 'Add to Interested Villages'}
                </span>
              </button>
            </div>
          </div>
        )}

        {suggestedNeighboringVacancies.length > 0 && (
          <div className="p-2 bg-emerald-50/70 rounded-lg border border-emerald-200 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-emerald-900 font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Neighboring Vacancies in {activeMandal}:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {suggestedNeighboringVacancies.map((sv) => (
                <button
                  key={sv.id}
                  type="button"
                  onClick={() => onAddInterest?.(sv.name)}
                  title={`Click to add ${sv.name} (${sv.vacancy} vacant) to interested villages`}
                  className="px-2 py-0.5 rounded bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-emerald-600" />
                  <span>{sv.name}</span>
                  <span className="text-[10px] text-emerald-700 font-normal">
                    ({sv.vacancy} vacant)
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-stone-100 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-600" />
              <span>Candidate Interested Villages</span>
              <span className="text-[10px] text-stone-500 font-normal">
                ({interestedVillages.length} villages)
              </span>
            </span>
            <span className="text-[10px] text-stone-400">Click × to remove</span>
          </div>

          {interestedVillages.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {interestedVillages.map((vName) => {
                const match = villages.find((v) => norm(v.name) === norm(vName));
                const seats = seatState(match);

                return (
                  <span
                    key={vName}
                    className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-md bg-purple-50 text-purple-900 border border-purple-200 text-xs font-semibold shadow-2xs"
                  >
                    <MapPin className="w-3 h-3 text-purple-600" />
                    <span>{vName}</span>
                    {match && <span className="text-[10px] text-stone-500">({match.mandal})</span>}
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                        seats === 'open' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'
                      }`}
                    >
                      {seats === 'open' ? 'Available' : seats === 'full' ? 'Full' : 'Not on map'}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveInterest?.(vName)}
                      title={`Remove ${vName}`}
                      className="p-0.5 text-purple-400 hover:text-purple-700 hover:bg-purple-200/60 rounded-full transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          ) : (
            <div className="p-2.5 bg-stone-50 border border-dashed border-stone-200 rounded-lg text-center text-xs text-stone-400">
              No other villages added yet. Select a village from the hierarchy above and click
              &quot;+ Add to Interested Villages&quot;.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
