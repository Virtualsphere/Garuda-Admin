import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Sparkles,
  Search,
  X,
  RotateCcw,
  Calendar,
  Clock,
  Play,
  Pause,
  Phone,
  ShieldAlert,
  Building2,
  PanelRight,
  PanelRightClose,
  BarChart3,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

import PersonAvatar from '../common/PersonAvatar';
import ScheduleVisitModal from './ScheduleVisitModal';
import OnboardingWizard from './OnboardingWizard';
import { useRecruitmentDesk } from '../../../hooks/useRecruitmentDesk';
import useVillageLocations from '../../../hooks/useVillageLocations';
import useCallAudio from '../../../hooks/useCallAudio';
import agentLeadService from '../../../services/agentLeadService';
import { errorMessage } from '../../../utils/apiErrors';
import { REGIONAL_OFFICE_REGIONS, STAGE_LABELS } from './recruitmentConstants';
import { INTERESTED_STAGES, normaliseLead, sameId, stampOf } from './recruitmentModel';

const norm = (v) => String(v || '').trim().toLowerCase();

const selectClass =
  'text-xs bg-stone-50 border border-stone-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#2563EB]';

const clockOfSeconds = (seconds) => {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return '';
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * One row of the Interested table, in the shape the table reads.
 *
 * `/agent-lead/interested` returns the lead with three joins already attached —
 * the call that closed it with Proceed, any team-leader escalation, and the
 * booked office visit — so nothing here fetches per row.
 */
const toItem = (row, employeeById) => {
  const lead = normaliseLead(row, employeeById);
  const attempt = row.proceedAttempt || null;
  const escalation = row.escalation || null;
  const visit = row.scheduledVisit || null;

  const closer = attempt?.employee || row.assignedTelecaller || null;
  const tlWon = escalation?.tl_result === 'Proceed';

  // The row a team leader closed carries their name, not the telecaller's.
  const forwardedBy = attempt?.employee?.name || (tlWon ? escalation.teamLeader?.name : '');
  const forwardedAt = attempt?.called_at || (tlWon ? escalation.completed_at : null);

  return {
    id: row.id,
    lead,
    row,
    name: lead.name,
    phone: lead.phone,
    state: lead.state,
    district: lead.district,
    mandal: lead.mandal,
    nativeVillage: lead.nativeVillage,
    interestedVillages: [...new Set(lead.interestedVillages)],
    forwardedAt,
    forwardedBy,
    handledBy: closer?.name || '',
    handledByPhoto: closer?.id ? employeeById.get(String(closer.id))?.photo : undefined,
    recordingUrl: attempt?.recording_url || '',
    callDuration: clockOfSeconds(attempt?.duration_seconds),
    hasTlSupport: Boolean(escalation),
    tlSupportName: escalation?.teamLeader?.name || '',
    tlSupportDetails: escalation?.tl_note || escalation?.telecaller_note || '',
    office: visit?.regional_office || '',
    visit,
    status: STAGE_LABELS[lead.stage] || lead.stage || 'Interested',
  };
};

/**
 * Candidates who said yes on the call and are waiting to be booked in.
 *
 * The vacancy rule matters here: saying yes does NOT consume a village seat.
 * The seat only closes at onboarding, once the agreement is signed and the fee
 * taken — which is why the village cell shows how many seats are still open
 * rather than treating the candidate as having taken one.
 */
export default function InterestedTab({ refresh }) {
  const { employeeById, callLead, version } = useRecruitmentDesk();
  const { villages } = useVillageLocations({});
  const audio = useCallAudio();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('All');
  const [districtFilter, setDistrictFilter] = useState('All');
  const [mandalFilter, setMandalFilter] = useState('All');
  const [villageFilter, setVillageFilter] = useState('All');
  const [officeFilter, setOfficeFilter] = useState('All');

  const [scheduling, setScheduling] = useState(null);
  const [onboarding, setOnboarding] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let list;
      try {
        const data = await agentLeadService.getInterested();
        list = data.result || data.data || [];
      } catch (err) {
        // A backend that predates /interested still has the plain lead list:
        // fall back to it, losing the joined columns rather than the tab.
        if (err?.response?.status !== 404) throw err;
        const results = await Promise.all(
          INTERESTED_STAGES.map((status) => agentLeadService.getLeads({ status }))
        );
        const merged = new Map();
        results.forEach((data) =>
          (data.result || data.data || []).forEach((lead) => merged.set(lead.id, lead))
        );
        list = [...merged.values()];
      }
      setRows(Array.isArray(list) ? list : []);
      setError(null);
    } catch (err) {
      console.error('Failed to load interested candidates:', err);
      setRows([]);
      setError(errorMessage(err, 'Could not load interested candidates.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, version]);

  const items = useMemo(() => rows.map((row) => toItem(row, employeeById)), [rows, employeeById]);

  /* ── Filter choices cascade: each list narrows to the levels above it ─── */

  const choices = useMemo(() => {
    const uniq = (values) => ['All', ...[...new Set(values.filter(Boolean))].sort()];
    const inState = (i) => stateFilter === 'All' || i.state === stateFilter;
    const inDistrict = (i) => districtFilter === 'All' || i.district === districtFilter;
    const inMandal = (i) => mandalFilter === 'All' || i.mandal === mandalFilter;

    return {
      states: uniq(items.map((i) => i.state)),
      districts: uniq(items.filter(inState).map((i) => i.district)),
      mandals: uniq(items.filter((i) => inState(i) && inDistrict(i)).map((i) => i.mandal)),
      villages: uniq(
        items
          .filter((i) => inState(i) && inDistrict(i) && inMandal(i))
          .flatMap((i) => [i.nativeVillage, ...i.interestedVillages])
      ),
    };
  }, [items, stateFilter, districtFilter, mandalFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const office = norm(officeFilter);

    return items.filter((item) => {
      if (q) {
        const hit =
          item.name.toLowerCase().includes(q) ||
          item.phone.includes(q) ||
          item.nativeVillage.toLowerCase().includes(q) ||
          item.interestedVillages.some((v) => v.toLowerCase().includes(q)) ||
          item.mandal.toLowerCase().includes(q) ||
          item.district.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (stateFilter !== 'All' && item.state !== stateFilter) return false;
      if (districtFilter !== 'All' && item.district !== districtFilter) return false;
      if (mandalFilter !== 'All' && item.mandal !== mandalFilter) return false;

      if (villageFilter !== 'All') {
        const v = norm(villageFilter);
        const hit =
          norm(item.nativeVillage) === v || item.interestedVillages.some((iv) => norm(iv) === v);
        if (!hit) return false;
      }

      if (officeFilter !== 'All' && !norm(item.office).includes(office)) return false;
      return true;
    });
  }, [items, search, stateFilter, districtFilter, mandalFilter, villageFilter, officeFilter]);

  const hasActiveFilters =
    Boolean(search) ||
    stateFilter !== 'All' ||
    districtFilter !== 'All' ||
    mandalFilter !== 'All' ||
    villageFilter !== 'All' ||
    officeFilter !== 'All';

  const resetFilters = () => {
    setSearch('');
    setStateFilter('All');
    setDistrictFilter('All');
    setMandalFilter('All');
    setVillageFilter('All');
    setOfficeFilter('All');
  };

  const vacancyOf = useCallback(
    (name) => villages.find((v) => norm(v.name) === norm(name)),
    [villages]
  );

  /* ── Side-panel insights, over the filtered set ───────────────────────── */

  const tlAssisted = useMemo(() => filtered.filter((i) => i.hasTlSupport), [filtered]);

  const tlInvolvement = useMemo(() => {
    const counts = new Map();
    tlAssisted.forEach((i) => {
      if (!i.tlSupportName) return;
      counts.set(i.tlSupportName, (counts.get(i.tlSupportName) || 0) + 1);
    });
    return [...counts.entries()];
  }, [tlAssisted]);

  const officeDistribution = useMemo(
    () =>
      REGIONAL_OFFICE_REGIONS.map((region) => ({
        office: region,
        count: filtered.filter((i) => norm(i.office).includes(norm(region))).length,
      })).filter((x) => x.count > 0),
    [filtered]
  );

  return (
    <div className="space-y-3">
      {/* Vacancy rule + panel toggle */}
      <div className="p-3 bg-blue-50/90 border border-blue-200 rounded-lg flex flex-wrap items-center justify-between gap-2.5 text-xs text-blue-950">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#2563EB] shrink-0" />
          <span>
            <strong>Rule:</strong> Vacancy remains available while candidate is only{' '}
            <strong>INTERESTED</strong>. Vacancy officially reduces only upon document agreement,
            deposit fee payment, and official attachment in Onboarding.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-mono text-blue-700 bg-white px-2.5 py-1 rounded border border-blue-200 font-semibold">
            {filtered.length} of {items.length} Candidates
          </span>
          <button
            type="button"
            onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
            title={isSidePanelOpen ? 'Close Side Panel' : 'Open Insights Panel'}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
              isSidePanelOpen
                ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
            }`}
          >
            {isSidePanelOpen ? (
              <>
                <PanelRightClose className="w-3.5 h-3.5" />
                <span>Hide Insights</span>
              </>
            ) : (
              <>
                <PanelRight className="w-3.5 h-3.5" />
                <span>Pipeline Insights</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-3 rounded-lg border border-stone-200 shadow-2xs space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search name, phone, village, mandal..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:bg-white text-stone-800"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <label className="flex items-center gap-1">
            <span className="text-[11px] text-stone-500 font-medium">State:</span>
            <select
              value={stateFilter}
              onChange={(e) => {
                setStateFilter(e.target.value);
                setDistrictFilter('All');
                setMandalFilter('All');
                setVillageFilter('All');
              }}
              className={selectClass}
            >
              {choices.states.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1">
            <span className="text-[11px] text-stone-500 font-medium">District:</span>
            <select
              value={districtFilter}
              onChange={(e) => {
                setDistrictFilter(e.target.value);
                setMandalFilter('All');
                setVillageFilter('All');
              }}
              className={selectClass}
            >
              {choices.districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1">
            <span className="text-[11px] text-stone-500 font-medium">Mandal:</span>
            <select
              value={mandalFilter}
              onChange={(e) => {
                setMandalFilter(e.target.value);
                setVillageFilter('All');
              }}
              className={selectClass}
            >
              {choices.mandals.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1">
            <span className="text-[11px] text-stone-500 font-medium">Village:</span>
            <select
              value={villageFilter}
              onChange={(e) => setVillageFilter(e.target.value)}
              className={selectClass}
            >
              {choices.villages.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1">
            <span className="text-[11px] text-stone-500 font-medium">Office:</span>
            <select
              value={officeFilter}
              onChange={(e) => setOfficeFilter(e.target.value)}
              className={selectClass}
            >
              <option value="All">All {REGIONAL_OFFICE_REGIONS.length} Offices</option>
              {REGIONAL_OFFICE_REGIONS.map((off) => (
                <option key={off} value={off}>
                  {off}
                </option>
              ))}
            </select>
          </label>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              title="Reset all filters"
              className="px-2 py-1 text-[11px] text-stone-600 hover:text-stone-900 border border-stone-200 hover:bg-stone-50 rounded flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Table */}
        <div className="flex-1 bg-white rounded-lg border border-stone-200 overflow-hidden shadow-2xs min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
                  <th className="p-2.5 w-12 text-center">#</th>
                  <th className="p-2.5 min-w-[140px]">Candidate</th>
                  <th className="p-2.5 min-w-[130px]">Native Location</th>
                  <th className="p-2.5 min-w-[150px]">Interested Village(s)</th>
                  <th className="p-2.5 min-w-[130px]">Forwarded Info</th>
                  <th className="p-2.5 min-w-[140px]">Handled By</th>
                  <th className="p-2.5 min-w-[120px]">Recording</th>
                  <th className="p-2.5 min-w-[140px]">TL Support</th>
                  <th className="p-2.5 min-w-[100px]">Office</th>
                  <th className="p-2.5 min-w-[90px]">Status</th>
                  <th className="p-2.5 text-right min-w-[140px]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading && items.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-10 text-center text-stone-400">
                      <span className="inline-flex items-center gap-2 font-medium">
                        <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading…
                      </span>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-stone-400">
                      {items.length === 0
                        ? 'No candidates registered as interested yet. Mark a call as Proceed to add one!'
                        : 'No interested candidates match the selected filters.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((item, idx) => {
                    const isAudioPlaying = sameId(audio.playingId, item.id);
                    const firstVillage = item.interestedVillages[0];
                    const vil = firstVillage ? vacancyOf(firstVillage) : undefined;
                    const open = vil?.vacancy || 0;

                    return (
                      <tr key={item.id} className="hover:bg-stone-50/80 transition-colors">
                        <td className="p-2.5 text-center text-stone-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>

                        <td className="p-2.5">
                          <div className="font-bold text-stone-900">{item.name}</div>
                          <div className="text-stone-500 font-mono text-[11px] flex items-center gap-1">
                            <span>{item.phone}</span>
                          </div>
                          <div className="text-[10px] text-stone-400 font-mono">
                            {item.lead.code}
                          </div>
                        </td>

                        <td className="p-2.5">
                          <div className="font-medium text-stone-800">
                            {item.nativeVillage || '—'}
                          </div>
                          <div className="text-[11px] text-stone-500">
                            {item.mandal && `${item.mandal}, `}
                            {item.district}
                          </div>
                          {item.state && (
                            <div className="text-[10px] text-stone-400">{item.state}</div>
                          )}
                        </td>

                        <td className="p-2.5">
                          {item.interestedVillages.length === 0 ? (
                            <span className="text-[10px] text-stone-400 italic">None linked</span>
                          ) : (
                            <>
                              <div className="flex flex-wrap gap-1">
                                {item.interestedVillages.map((vName) => (
                                  <span
                                    key={vName}
                                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-[#2563EB] border border-blue-200"
                                  >
                                    {vName}
                                  </span>
                                ))}
                              </div>
                              <div className="mt-1">
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    open > 0
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      : 'bg-stone-100 text-stone-600 border border-stone-200'
                                  }`}
                                >
                                  {open > 0 ? `${open} Vacancy Available` : '0 Open Vacancies'}
                                </span>
                              </div>
                            </>
                          )}
                        </td>

                        <td className="p-2.5">
                          {item.forwardedAt || item.forwardedBy ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1 text-[11px] font-medium text-stone-700">
                                <Calendar className="w-3 h-3 text-stone-400" />
                                <span>{item.forwardedAt ? stampOf(item.forwardedAt) : 'Recent'}</span>
                              </div>
                              <div className="text-[10px] text-stone-500">
                                By:{' '}
                                <span className="font-semibold text-stone-800">
                                  {item.forwardedBy || 'Telecaller'}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-stone-400 italic">Direct Entry</span>
                          )}
                        </td>

                        <td className="p-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <PersonAvatar
                              name={item.handledBy || 'Telecaller'}
                              photo={item.handledByPhoto}
                              size={24}
                              className="shrink-0"
                            />
                            <div className="truncate">
                              <span className="font-semibold text-stone-900 block truncate">
                                {item.handledBy || 'Telecaller Executive'}
                              </span>
                              <span className="text-[9px] text-stone-400 block truncate">
                                Telecaller
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="p-2.5">
                          {item.recordingUrl ? (
                            <div className="space-y-1">
                              <button
                                type="button"
                                onClick={() => audio.toggle(item.id, item.recordingUrl)}
                                className={`px-2 py-1 rounded text-[11px] font-medium inline-flex items-center gap-1.5 border transition-colors cursor-pointer ${
                                  isAudioPlaying
                                    ? 'bg-amber-500 text-white border-amber-600 shadow-2xs animate-pulse'
                                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                                }`}
                              >
                                {isAudioPlaying ? (
                                  <Pause className="w-3 h-3 shrink-0" />
                                ) : (
                                  <Play className="w-3 h-3 shrink-0 text-[#2563EB]" />
                                )}
                                <span>{isAudioPlaying ? 'Playing' : 'Audio'}</span>
                              </button>
                              {item.callDuration && (
                                <div className="text-[10px] font-mono text-stone-400 flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>{item.callDuration}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-stone-400 italic">No audio</span>
                          )}
                        </td>

                        <td className="p-2.5">
                          {item.hasTlSupport ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                <ShieldAlert className="w-3 h-3 text-amber-700 shrink-0" />
                                <span>{item.tlSupportName || 'TL Assisted'}</span>
                              </span>
                              {item.tlSupportDetails && (
                                <span
                                  className="text-[10px] text-stone-500 block truncate max-w-[130px]"
                                  title={item.tlSupportDetails}
                                >
                                  {item.tlSupportDetails}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-stone-400">Direct (No TL)</span>
                          )}
                        </td>

                        <td className="p-2.5">
                          {/* Clicking books or moves the office visit, which is how a
                              candidate reaches the Onboarding schedule from here. */}
                          <button
                            type="button"
                            onClick={() => setScheduling({ ...item.row, officeVisits: item.visit ? [item.visit] : [] })}
                            title={item.office ? 'Reschedule office visit' : 'Book an office visit'}
                            className="text-left cursor-pointer"
                          >
                            {item.office ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 inline-flex items-center gap-1">
                                <Building2 className="w-2.5 h-2.5" />
                                {item.office}
                              </span>
                            ) : (
                              <span className="text-[10px] text-stone-400 italic hover:text-[#2563EB]">
                                Unassigned
                              </span>
                            )}
                          </button>
                        </td>

                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                            {item.status}
                          </span>
                        </td>

                        <td className="p-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => callLead(item.lead, 'follow-up')}
                              className="px-2 py-1 rounded border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Phone className="w-3 h-3 text-[#2563EB]" />
                              Call
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setOnboarding({
                                  ...item.row,
                                  officeVisits: item.visit ? [item.visit] : [],
                                })
                              }
                              className="px-2.5 py-1 rounded bg-stone-900 hover:bg-stone-800 text-white font-medium text-xs inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                            >
                              Onboard &amp; Attach
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pipeline insights */}
        {isSidePanelOpen && (
          <div className="w-80 shrink-0 bg-white rounded-lg border border-stone-200 p-3.5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#2563EB]" />
                <h4 className="font-bold text-xs text-stone-900">Pipeline Insights</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsSidePanelOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200/70">
                <div className="text-lg font-bold text-stone-900">{filtered.length}</div>
                <div className="text-[10px] text-stone-500 font-medium">Filtered Candidates</div>
              </div>
              <div className="bg-amber-50/60 p-2.5 rounded-lg border border-amber-200/70">
                <div className="text-lg font-bold text-amber-900">{tlAssisted.length}</div>
                <div className="text-[10px] text-amber-700 font-medium">TL Assisted Deals</div>
              </div>
            </div>

            <div>
              <h5 className="text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                <span>TL Involvement</span>
              </h5>
              <div className="space-y-1.5 text-xs">
                {tlInvolvement.map(([tlName, count]) => (
                  <div
                    key={tlName}
                    className="flex items-center justify-between p-2 rounded-md bg-stone-50 border border-stone-150"
                  >
                    <span className="font-medium text-stone-800 text-[11px]">{tlName}</span>
                    <span className="font-bold text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                      {count} {count === 1 ? 'case' : 'cases'}
                    </span>
                  </div>
                ))}
                {tlAssisted.length === 0 && (
                  <div className="text-stone-400 text-[11px] italic">
                    No TL assisted cases in filter
                  </div>
                )}
              </div>
            </div>

            <div>
              <h5 className="text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Regional Office Distribution</span>
              </h5>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {officeDistribution.map(({ office, count }) => (
                  <div
                    key={office}
                    className="flex items-center justify-between p-1.5 rounded bg-stone-50 text-[11px]"
                  >
                    <span className="text-stone-700">{office} Office</span>
                    <span className="font-bold text-stone-900 bg-white border border-stone-200 px-1.5 py-0.5 rounded">
                      {count}
                    </span>
                  </div>
                ))}
                {officeDistribution.length === 0 && (
                  <div className="text-stone-400 text-[11px] italic">No office visits booked</div>
                )}
              </div>
            </div>

            <div className="p-2.5 bg-blue-50/70 border border-blue-150 rounded-lg text-[10px] text-blue-900 space-y-1">
              <div className="font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#2563EB]" />
                <span>Village Vacancy Priority</span>
              </div>
              <p className="text-blue-800 leading-tight">
                Registration under Section 20-24 with ₹5,000 security deposit locks the exclusive
                vacancy for that village.
              </p>
            </div>
          </div>
        )}
      </div>

      {scheduling && (
        <ScheduleVisitModal
          lead={scheduling}
          onClose={() => setScheduling(null)}
          onDone={() => {
            load();
            refresh?.();
          }}
        />
      )}

      {onboarding && (
        <OnboardingWizard
          lead={onboarding}
          onClose={() => setOnboarding(null)}
          onDone={() => {
            load();
            refresh?.();
          }}
        />
      )}
    </div>
  );
}
