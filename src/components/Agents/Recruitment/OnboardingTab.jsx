import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  Building2,
  CheckCircle2,
  XCircle,
  Phone,
  UserPlus,
  MapPin,
  Users,
  Table as TableIcon,
  Map as MapIcon,
  Search,
  CalendarDays,
  PlayCircle,
} from 'lucide-react';

import ScheduleVisitModal from './ScheduleVisitModal';
import OnboardingWizard from './OnboardingWizard';
import PersonAvatar from '../common/PersonAvatar';
import InteractiveMap from '../maps/InteractiveMap';
import useVillageLocations from '../../../hooks/useVillageLocations';
import { getProgressMap } from './onboardingProgress';
import agentLeadService from '../../../services/agentLeadService';

const GROUPINGS = [
  { key: 'village', label: 'Village-wise', icon: MapPin },
  { key: 'agent', label: 'Agent-wise', icon: Users },
];

const STATUS_TONES = {
  Scheduled: 'bg-blue-50 text-[#2563EB] border-blue-200',
  Completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Cancelled: 'bg-stone-100 text-stone-600 border-stone-300',
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const norm = (v) => String(v || '').trim().toLowerCase();

const prettyDate = (iso) => {
  if (!iso) return '—';
  const dt = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return iso;
  if (iso === todayISO()) return 'Today';
  return dt.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
};

/**
 * The onboarding desk: candidates booked in to a regional office, and the
 * wizard that turns them into agents.
 *
 * Village-wise is the default because the seat, not the person, is the scarce
 * thing — the desk needs to see two candidates booked against one open slot
 * before it walks either of them through an agreement.
 *
 * Marking a visit Cancelled drops the candidate back into Interested so they
 * reappear in that queue rather than disappearing — the server does that, and
 * this tab relies on it.
 */
export default function OnboardingTab({ refresh }) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scope, setScope] = useState('all');
  const [grouping, setGrouping] = useState('village');
  const [view, setView] = useState('list');
  const [office, setOffice] = useState('all');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [rescheduling, setRescheduling] = useState(null);
  const [onboarding, setOnboarding] = useState(null);
  const [progress, setProgress] = useState({});

  const { villages } = useVillageLocations({});

  const vacancyOf = useCallback(
    (name) => villages.find((v) => norm(v.name) === norm(name))?.vacancy,
    [villages]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await agentLeadService.getOfficeVisits({});
      const list = data.result || data.data || [];
      setVisits(Array.isArray(list) ? list : []);
      setProgress(getProgressMap());
      setError(null);
    } catch (err) {
      console.error('Failed to load office visits:', err);
      setVisits([]);
      setError('Could not load the onboarding schedule.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatus = async (visit, status) => {
    setBusyId(visit.id);
    setError(null);
    try {
      await agentLeadService.updateOfficeVisitStatus(visit.id, { status });
      await load();
      refresh?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update this visit.');
    } finally {
      setBusyId(null);
    }
  };

  const offices = useMemo(
    () => [...new Set(visits.map((v) => v.regional_office).filter(Boolean))].sort(),
    [visits]
  );

  // Scope counts come from the unfiltered set so the pills read as totals.
  const counts = useMemo(() => {
    const stamp = todayISO();
    return {
      all: visits.length,
      today: visits.filter((v) => v.visit_date === stamp).length,
      upcoming: visits.filter((v) => v.visit_date > stamp && v.status === 'Scheduled').length,
    };
  }, [visits]);

  const filtered = useMemo(() => {
    const stamp = todayISO();
    const q = query.trim().toLowerCase();

    return visits.filter((visit) => {
      if (scope === 'today' && visit.visit_date !== stamp) return false;
      if (scope === 'upcoming' && !(visit.visit_date > stamp && visit.status === 'Scheduled'))
        return false;
      if (office !== 'all' && visit.regional_office !== office) return false;

      if (!q) return true;
      const lead = visit.candidate || {};
      return (
        String(lead.name || '').toLowerCase().includes(q) ||
        String(lead.phone || '').includes(q) ||
        String(visit.interested_village || lead.village || '').toLowerCase().includes(q)
      );
    });
  }, [visits, scope, office, query]);

  const villageOf = (visit) =>
    visit.interested_village || visit.candidate?.village || 'Unassigned village';

  // Village-wise groups by the seat being competed for; agent-wise is flat.
  const groups = useMemo(() => {
    if (grouping === 'agent') return [['All candidates', filtered]];
    const map = new Map();
    filtered.forEach((visit) => {
      const key = villageOf(visit);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(visit);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, grouping]);

  const openWizard = (visit) => {
    // The office-visit endpoint does not include the candidate's own visits,
    // so hand the wizard the one that brought them in.
    setOnboarding({ ...(visit.candidate || {}), officeVisits: [visit] });
  };

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="bg-white border border-stone-200 rounded-lg p-2.5 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-stone-200 p-0.5 bg-stone-100">
          {GROUPINGS.map((g) => {
            const Icon = g.icon;
            return (
              <button
                key={g.key}
                type="button"
                onClick={() => setGrouping(g.key)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md inline-flex items-center gap-1.5 ${
                  grouping === g.key ? 'bg-white text-[#2563EB] shadow-2xs' : 'text-stone-600'
                }`}
              >
                <Icon className="w-3 h-3" />
                {g.label}
              </button>
            );
          })}
        </div>

        <div className="inline-flex rounded-lg border border-stone-200 p-0.5 bg-stone-100">
          <button
            type="button"
            onClick={() => setView('list')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md inline-flex items-center gap-1.5 ${
              view === 'list' ? 'bg-white text-[#2563EB] shadow-2xs' : 'text-stone-600'
            }`}
          >
            <TableIcon className="w-3 h-3" /> List
          </button>
          <button
            type="button"
            onClick={() => setView('map')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md inline-flex items-center gap-1.5 ${
              view === 'map' ? 'bg-white text-[#2563EB] shadow-2xs' : 'text-stone-600'
            }`}
          >
            <MapIcon className="w-3 h-3" /> Map
          </button>
        </div>

        <div className="inline-flex rounded-lg border border-stone-200 p-0.5 bg-stone-100">
          {[
            { key: 'all', label: `All Visits (${counts.all})` },
            { key: 'today', label: `Today (${counts.today})` },
            { key: 'upcoming', label: `Upcoming (${counts.upcoming})` },
          ].map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setScope(s.key)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                scope === s.key ? 'bg-white text-[#2563EB] shadow-2xs' : 'text-stone-600'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <select
          value={office}
          onChange={(e) => setOffice(e.target.value)}
          className="text-xs bg-white border border-stone-200 rounded-lg px-2 py-1.5 text-stone-700"
        >
          <option value="all">All offices</option>
          {offices.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-lg px-2 py-1.5 min-w-[180px]">
          <Search className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search candidate, phone, village…"
            className="w-full bg-transparent text-xs"
          />
        </div>

        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 ml-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-stone-200 rounded-lg py-14 flex items-center justify-center">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-stone-500">
            <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading schedule…
          </span>
        </div>
      ) : view === 'map' ? (
        <div className="bg-white border border-stone-200 rounded-lg p-2.5">
          <InteractiveMap
            height="520px"
            villages={villages}
            showAllotmentColors
            agentMapMode
            candidatePins={filtered
              .map((visit) => {
                const vil = villages.find((v) => norm(v.name) === norm(villageOf(visit)));
                if (!vil?.centerCoordinates?.lat) return null;
                return {
                  id: visit.id,
                  name: visit.candidate?.name || 'Candidate',
                  village: vil.name,
                  coordinates: vil.centerCoordinates,
                };
              })
              .filter(Boolean)}
          />
          <p className="text-[11px] text-stone-500 mt-2">
            {filtered.length} booked visit(s) plotted against their interested village.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-lg py-14 text-center text-xs text-stone-400">
          Nothing booked. Schedule a visit from the Interested tab.
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(([groupName, rows]) => {
            const vac = grouping === 'village' ? vacancyOf(groupName) : undefined;
            return (
              <div
                key={groupName}
                className="bg-white border border-stone-200 rounded-lg overflow-hidden"
              >
                <div className="px-3 py-2 border-b border-stone-200 bg-stone-50/60 flex flex-wrap items-center gap-2">
                  {grouping === 'village' ? (
                    <MapPin className="w-3.5 h-3.5 text-[#2563EB]" />
                  ) : (
                    <Users className="w-3.5 h-3.5 text-[#2563EB]" />
                  )}
                  <h3 className="text-xs font-bold text-stone-900">{groupName}</h3>
                  <span className="px-1.5 rounded-full bg-stone-200 text-stone-700 text-[10px] font-bold">
                    {rows.length} candidate(s)
                  </span>
                  {vac !== undefined && (
                    <span
                      className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                        vac > 0
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {vac > 0 ? `${vac} Open` : 'Full'}
                    </span>
                  )}
                  {vac === 0 && rows.length > 0 && (
                    <span className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                      No seat here — these candidates need the waiting queue or another village
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-white border-b border-stone-200 text-[10px] uppercase tracking-wider text-stone-500">
                        <th className="text-left font-bold px-3 py-2">Candidate</th>
                        <th className="text-left font-bold px-3 py-2">Phone</th>
                        <th className="text-left font-bold px-3 py-2">Interested village</th>
                        <th className="text-left font-bold px-3 py-2">Visit date</th>
                        <th className="text-left font-bold px-3 py-2">Office</th>
                        <th className="text-left font-bold px-3 py-2">Status</th>
                        <th className="text-right font-bold px-3 py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {rows.map((visit) => {
                        const lead = visit.candidate || {};
                        const isBusy = String(busyId) === String(visit.id);
                        const vil = villageOf(visit);
                        const v = vacancyOf(vil);
                        const step = progress[String(lead.id)] || 0;

                        return (
                          <tr key={visit.id} className="hover:bg-stone-50/60">
                            <td className="px-3 py-2">
                              <PersonAvatar
                                name={lead.name}
                                photo={lead.photo}
                                size="sm"
                                showDetails
                                subtext={lead.mandal || lead.district}
                              />
                            </td>
                            <td className="px-3 py-2 text-stone-700 whitespace-nowrap">
                              {lead.phone || '—'}
                            </td>
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="font-semibold text-stone-800">{vil}</span>
                                {v !== undefined && (
                                  <span
                                    className={`px-1.5 rounded text-[10px] font-bold ${
                                      v > 0
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}
                                  >
                                    {v > 0 ? `${v} Open` : 'Full'}
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5 text-stone-700">
                                <CalendarDays className="w-3 h-3 text-stone-400" />
                                {prettyDate(visit.visit_date)}
                                {visit.visit_time && (
                                  <span className="text-stone-400">· {visit.visit_time}</span>
                                )}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center gap-1.5 text-stone-600">
                                <Building2 className="w-3 h-3 text-stone-400" />
                                {visit.regional_office || '—'}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                                  STATUS_TONES[visit.status] || STATUS_TONES.Cancelled
                                }`}
                              >
                                {visit.status}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-end gap-1.5">
                                <a
                                  href={lead.phone ? `tel:${lead.phone}` : undefined}
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-stone-200 bg-white text-[#2563EB] hover:bg-stone-50"
                                  title="Call"
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                </a>

                                {visit.status === 'Scheduled' && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => openWizard(visit)}
                                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-white whitespace-nowrap ${
                                        step > 0
                                          ? 'bg-amber-500 hover:bg-amber-600'
                                          : 'bg-[#2563EB] hover:bg-[#1D4ED8]'
                                      }`}
                                    >
                                      {step > 0 ? (
                                        <>
                                          <PlayCircle className="w-3 h-3" />
                                          Resume · Step {step}
                                        </>
                                      ) : (
                                        <>
                                          <UserPlus className="w-3 h-3" />
                                          Open Onboarding
                                        </>
                                      )}
                                    </button>

                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() => handleStatus(visit, 'Completed')}
                                      title="Mark attended without onboarding yet"
                                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 disabled:opacity-40"
                                    >
                                      {isBusy ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                      )}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setRescheduling(lead)}
                                      className="px-2 py-1 rounded-lg border border-stone-200 bg-white text-[11px] font-semibold text-stone-700 hover:bg-stone-50"
                                    >
                                      Move
                                    </button>

                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() => handleStatus(visit, 'Cancelled')}
                                      title="Cancel — returns them to Interested"
                                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-stone-200 bg-white text-stone-500 hover:text-rose-600 hover:border-rose-200 disabled:opacity-40"
                                    >
                                      <XCircle className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {onboarding && (
        <OnboardingWizard
          lead={onboarding}
          onClose={() => {
            setOnboarding(null);
            setProgress(getProgressMap());
          }}
          onDone={() => {
            load();
            refresh?.();
          }}
        />
      )}

      {rescheduling && (
        <ScheduleVisitModal
          lead={rescheduling}
          onClose={() => setRescheduling(null)}
          onDone={() => {
            load();
            refresh?.();
          }}
        />
      )}
    </div>
  );
}
