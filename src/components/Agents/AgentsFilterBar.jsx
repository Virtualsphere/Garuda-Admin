import { Search, Plus, MapPin, Table as TableIcon, X } from 'lucide-react';
import useLocations from '../../hooks/useLocations';

/**
 * Territory + search filter bar shared by the Map View and Recruitment tabs.
 *
 * The cascading selects hold location *ids*, but every agent API filters on
 * location *names*, so the resolved names are handed back through `onChange`
 * rather than the raw select values.
 */
export default function AgentsFilterBar({
  filters,
  onChange,
  search,
  onSearchChange,
  view,
  onViewChange,
  onAddCandidate,
  addLabel = 'Add candidate',
}) {
  const {
    states,
    districts,
    mandals,
    villages,
    selectedState,
    selectedDistrict,
    selectedMandal,
    selectedVillage,
    setSelectedState,
    setSelectedDistrict,
    setSelectedMandal,
    setSelectedVillage,
    resetLocations,
    loading,
  } = useLocations();

  const nameById = (list, id) => list.find((x) => String(x.id) === String(id))?.name;

  // Every select reports the *names* upward, resolved from the list it owns —
  // the child lists have not reloaded yet at the moment of the change.
  const emit = (patch) => {
    onChange({
      state: nameById(states, selectedState),
      district: nameById(districts, selectedDistrict),
      mandal: nameById(mandals, selectedMandal),
      village: nameById(villages, selectedVillage),
      ...patch,
    });
  };

  const hasFilters =
    Boolean(selectedState || search) || Object.values(filters || {}).some(Boolean);

  const clearAll = () => {
    resetLocations();
    onSearchChange('');
    onChange({ state: undefined, district: undefined, mandal: undefined, village: undefined });
  };

  return (
    <div className="bg-white p-3 rounded-2xl border border-[#e7e5e4] shadow-sm flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={selectedState}
          onChange={(e) => {
            setSelectedState(e.target.value);
            emit({
              state: nameById(states, e.target.value),
              district: undefined,
              mandal: undefined,
              village: undefined,
            });
          }}
          disabled={loading.states}
          className="text-xs bg-[#fafaf9] border border-[#e7e5e4] rounded-xl px-2.5 py-2 font-semibold text-[#1c1917]"
          aria-label="State"
        >
          <option value="">{loading.states ? 'Loading…' : 'All states'}</option>
          {states.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={selectedDistrict}
          onChange={(e) => {
            setSelectedDistrict(e.target.value);
            emit({
              district: nameById(districts, e.target.value),
              mandal: undefined,
              village: undefined,
            });
          }}
          disabled={!selectedState || loading.districts}
          className="text-xs bg-[#fafaf9] border border-[#e7e5e4] rounded-xl px-2.5 py-2 font-semibold text-[#1c1917] disabled:opacity-50"
          aria-label="District"
        >
          <option value="">{loading.districts ? 'Loading…' : 'All districts'}</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          value={selectedMandal}
          onChange={(e) => {
            setSelectedMandal(e.target.value);
            emit({ mandal: nameById(mandals, e.target.value), village: undefined });
          }}
          disabled={!selectedDistrict || loading.mandals}
          className="text-xs bg-[#fafaf9] border border-[#e7e5e4] rounded-xl px-2.5 py-2 font-semibold text-[#1c1917] disabled:opacity-50"
          aria-label="Mandal"
        >
          <option value="">{loading.mandals ? 'Loading…' : 'All mandals'}</option>
          {mandals.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        <select
          value={selectedVillage}
          onChange={(e) => {
            setSelectedVillage(e.target.value);
            emit({ village: nameById(villages, e.target.value) });
          }}
          disabled={!selectedMandal || loading.villages}
          className="text-xs bg-[#fafaf9] border border-[#e7e5e4] rounded-xl px-2.5 py-2 font-semibold text-[#1c1917] disabled:opacity-50"
          aria-label="Village"
        >
          <option value="">{loading.villages ? 'Loading…' : 'All villages'}</option>
          {villages.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#78716c] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Name, phone, village…"
            className="pl-8 pr-3 py-2 text-xs rounded-xl border border-[#e7e5e4] bg-[#fafaf9] font-medium w-52"
          />
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-1 text-xs font-bold text-[#78716c] hover:text-[#1c1917] px-2"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onViewChange && (
          <div className="inline-flex rounded-lg border border-[#e7e5e4] p-0.5 bg-[#f5f5f4]">
            <button
              type="button"
              onClick={() => onViewChange('MAP')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md ${
                view === 'MAP' ? 'bg-white text-[#2563EB] shadow-sm' : 'text-[#78716c]'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" /> Map
            </button>
            <button
              type="button"
              onClick={() => onViewChange('TABLE')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md ${
                view === 'TABLE' ? 'bg-white text-[#2563EB] shadow-sm' : 'text-[#78716c]'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" /> Table
            </button>
          </div>
        )}

        {onAddCandidate && (
          <button
            type="button"
            onClick={onAddCandidate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-bold hover:bg-[#1d4ed8] shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> {addLabel}
          </button>
        )}
      </div>
    </div>
  );
}
