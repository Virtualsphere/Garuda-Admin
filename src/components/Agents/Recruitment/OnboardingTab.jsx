import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2,
  AlertTriangle,
  MapPin,
  Table as TableIcon,
  Map as MapIcon,
} from 'lucide-react';

import OnboardingWizard from './OnboardingWizard';
import ScheduleVisitModal from './ScheduleVisitModal';
import InteractiveMap from '../maps/InteractiveMap';
import { useRecruitmentDesk } from '../../../hooks/useRecruitmentDesk';
import useVillageLocations from '../../../hooks/useVillageLocations';
import { getProgressMap } from './onboardingProgress';
import agentLeadService from '../../../services/agentLeadService';
import agentService from '../../../services/agentService';
import { errorMessage } from '../../../utils/apiErrors';
import { localDate } from './recruitmentModel';

const norm = (v) => String(v || '').trim().toLowerCase();

const initialsOf = (name) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

/** A candidate's photo as a rounded square, falling back to initials. */
function CandidatePhoto({ name, photo, className }) {
  const [failed, setFailed] = useState(false);
  if (photo && !failed) {
    return (
      <img
        src={photo}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`rounded-lg object-cover border border-stone-200 shadow-2xs shrink-0 ${className}`}
      />
    );
  }
  return (
    <div
      className={`rounded-lg border border-stone-200 bg-blue-50 text-[#2563EB] text-[11px] font-bold flex items-center justify-center shadow-2xs shrink-0 ${className}`}
    >
      {initialsOf(name)}
    </div>
  );
}

/**
 * One office visit, in the shape the tables read. Cancelled visits are not part
 * of the worklist (a cancelled booking sends the candidate back to Interested),
 * and neither is anyone already appointed.
 */
const toVisit = (row) => {
  const candidate = row.candidate || {};
  return {
    id: row.id,
    raw: row,
    candidate,
    candidateId: candidate.id ?? row.candidate_id,
    candidateName: candidate.name || 'Unknown lead',
    phone: candidate.phone || '',
    photo: candidate.photo || '',
    nativeVillage: candidate.village || '',
    interestedVillage: row.interested_village || candidate.village || '',
    visitDate: row.visit_date || '',
    visitTime: row.visit_time || '',
    regionalOffice: row.regional_office || '',
    status: row.status,
  };
};

/**
 * The onboarding desk: candidates booked in to a regional office, and the
 * wizard that turns them into agents.
 *
 * Village-wise groups the schedule by the seat being competed for, so the desk
 * sees two candidates booked against one open slot before walking either of them
 * through an agreement; Agent-wise is the flat list. The map shows the same
 * schedule geographically, with a drawer for whichever village is clicked.
 *
 * "Resume" appears on a row once the wizard has been opened for that candidate:
 * progress is a browser-local draft (see onboardingProgress.js), because nothing
 * reaches the server until the final Complete Attachment.
 */
export default function OnboardingTab({ refresh }) {
  const { version } = useRecruitmentDesk();
  const { villages } = useVillageLocations({});

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [onboardingSubTab, setOnboardingSubTab] = useState('all');
  const [onboardingViewMode, setOnboardingViewMode] = useState('list');
  const [onboardingGroupBy, setOnboardingGroupBy] = useState('agent');
  const [onboardingOfficeFilter, setOnboardingOfficeFilter] = useState('All');
  const [selectedVillage, setSelectedVillage] = useState(null);

  const [onboarding, setOnboarding] = useState(null);
  const [rescheduling, setRescheduling] = useState(null);
  const [progress, setProgress] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await agentLeadService.getOfficeVisits({});
      const list = data.result || data.data || [];
      setRows(Array.isArray(list) ? list : []);
      setProgress(getProgressMap());
      setError(null);
    } catch (err) {
      console.error('Failed to load office visits:', err);
      setRows([]);
      setError(errorMessage(err, 'Could not load the onboarding schedule.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, version]);

  const todayStr = localDate();

  // One live visit per candidate: a booked one wins over an attended one.
  const visits = useMemo(() => {
    const best = new Map();
    rows
      .filter((r) => r.status !== 'Cancelled')
      .map(toVisit)
      .filter((v) => v.candidate.status !== 'JOINED' && !v.candidate.converted_agent_id)
      .forEach((v) => {
        const key = String(v.candidateId);
        const current = best.get(key);
        if (!current || (current.status !== 'Scheduled' && v.status === 'Scheduled')) {
          best.set(key, v);
        }
      });
    return [...best.values()];
  }, [rows]);

  const offices = useMemo(
    () => [...new Set(visits.map((v) => v.regionalOffice).filter(Boolean))].sort(),
    [visits]
  );

  const filteredVisits = useMemo(
    () =>
      visits.filter((visit) => {
        if (onboardingOfficeFilter !== 'All' && visit.regionalOffice !== onboardingOfficeFilter)
          return false;
        if (onboardingSubTab === 'today' && visit.visitDate !== todayStr) return false;
        if (onboardingSubTab === 'upcoming' && visit.visitDate <= todayStr) return false;
        return true;
      }),
    [visits, onboardingOfficeFilter, onboardingSubTab, todayStr]
  );

  const vacancyOf = useCallback(
    (name) => villages.find((v) => norm(v.name) === norm(name)),
    [villages]
  );

  const villageWiseVisits = useMemo(() => {
    const map = new Map();
    filteredVisits.forEach((visit) => {
      const name = visit.interestedVillage || visit.nativeVillage || 'Unassigned village';
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(visit);
    });

    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([villageName, list]) => {
        const village = vacancyOf(villageName);
        return {
          villageName,
          mandal: village?.mandal || '',
          district: village?.district || '',
          requiredAgents: village?.requiredAgents || 0,
          attachedAgentsCount: village?.attachedAgentsCount || 0,
          vacancy: village?.vacancy || 0,
          // Interest counts the whole pipeline, not only the booked visits.
          interestedCount: Math.max(village?.interestedAgentsCount || 0, list.length),
          visits: list,
        };
      });
  }, [filteredVisits, vacancyOf]);

  const stepOf = (visit) => progress[String(visit.candidateId)] || 0;

  const openWizard = (visit) => {
    // The visit that brought them in rides along: the office-visit endpoint
    // carries the candidate, not the candidate's other visits.
    setOnboarding({ ...visit.candidate, officeVisits: [visit.raw] });
  };

  const candidatePins = useMemo(
    () =>
      filteredVisits
        .map((visit) => {
          const village = vacancyOf(visit.interestedVillage);
          if (!village?.centerCoordinates?.lat) return null;
          return {
            id: visit.id,
            name: visit.candidateName,
            village: village.name,
            coordinates: village.centerCoordinates,
          };
        })
        .filter(Boolean),
    [filteredVisits, vacancyOf]
  );

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-stone-50 p-2.5 rounded-xl border border-stone-200 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-stone-200/80 p-0.5 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setOnboardingGroupBy('village')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                onboardingGroupBy === 'village'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Village-wise
            </button>
            <button
              type="button"
              onClick={() => setOnboardingGroupBy('agent')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                onboardingGroupBy === 'agent'
                  ? 'bg-white text-[#2563EB] shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Agent-wise
            </button>
          </div>

          <div className="flex items-center bg-stone-200/80 p-0.5 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setOnboardingViewMode('list')}
              className={`px-3 py-1 rounded-md font-semibold flex items-center gap-1.5 transition-all ${
                onboardingViewMode === 'list'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              List
            </button>
            <button
              type="button"
              onClick={() => setOnboardingViewMode('map')}
              className={`px-3 py-1 rounded-md font-semibold flex items-center gap-1.5 transition-all ${
                onboardingViewMode === 'map'
                  ? 'bg-white text-[#2563EB] shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5 text-[#2563EB]" />
              Map
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-stone-200">
            <button
              type="button"
              onClick={() => setOnboardingSubTab('all')}
              className={`px-2.5 py-0.5 rounded font-semibold text-[11px] transition-all ${
                onboardingSubTab === 'all'
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              All Visits ({visits.length})
            </button>
            <button
              type="button"
              onClick={() => setOnboardingSubTab('today')}
              className={`px-2.5 py-0.5 rounded font-semibold text-[11px] transition-all ${
                onboardingSubTab === 'today'
                  ? 'bg-blue-600 text-white'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setOnboardingSubTab('upcoming')}
              className={`px-2.5 py-0.5 rounded font-semibold text-[11px] transition-all ${
                onboardingSubTab === 'upcoming'
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Upcoming
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-stone-500">Office:</span>
            <select
              value={onboardingOfficeFilter}
              onChange={(e) => setOnboardingOfficeFilter(e.target.value)}
              className="px-2 py-1 bg-white rounded border border-stone-200 text-xs text-stone-800"
            >
              <option value="All">All Offices</option>
              {offices.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {loading && visits.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl py-14 flex items-center justify-center">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-stone-500">
            <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading schedule…
          </span>
        </div>
      ) : onboardingViewMode === 'list' ? (
        onboardingGroupBy === 'agent' ? (
          /* ── Agent-wise table ─────────────────────────────── */
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-2xs">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
                  <th className="p-3 w-14">Photo</th>
                  <th className="p-3">Candidate</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Interested Village</th>
                  <th className="p-3">Visit Date</th>
                  <th className="p-3">Office</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredVisits.map((visit) => {
                  const village = vacancyOf(visit.interestedVillage);
                  const isToday = visit.visitDate === todayStr;

                  return (
                    <tr key={visit.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="p-3">
                        <CandidatePhoto
                          name={visit.candidateName}
                          photo={visit.photo}
                          className="w-9 h-9"
                        />
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-stone-900">{visit.candidateName}</p>
                        <p className="text-[10px] text-stone-500">
                          Native: {visit.nativeVillage || '—'}
                        </p>
                      </td>
                      <td className="p-3 font-mono text-stone-700">{visit.phone}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[11px]">
                            {visit.interestedVillage || '—'}
                          </span>
                          {village && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                village.vacancy > 0
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-red-50 text-red-700 border border-red-200'
                              }`}
                            >
                              {village.vacancy > 0 ? `${village.vacancy} Open` : 'Full'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              isToday
                                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                : 'bg-stone-100 text-stone-700'
                            }`}
                          >
                            {visit.visitDate}
                          </span>
                          <span className="text-stone-500 text-[11px] font-medium">
                            {visit.visitTime}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-stone-700">{visit.regionalOffice}</td>
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {visit.status === 'Scheduled' && (
                            <button
                              type="button"
                              onClick={() => setRescheduling({ ...visit.candidate, officeVisits: [visit.raw] })}
                              title="Move this booking to another date or office"
                              className="px-2 py-1.5 rounded-lg border border-stone-200 bg-white text-[11px] font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
                            >
                              Move
                            </button>
                          )}
                          <OnboardButton step={stepOf(visit)} onClick={() => openWizard(visit)} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredVisits.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-stone-400">
                      No candidate visits matching current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* ── Village-wise groups ──────────────────────────── */
          <div className="space-y-3">
            {villageWiseVisits.map((group) => (
              <div
                key={group.villageName}
                className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden"
              >
                <div className="p-3.5 bg-stone-50/90 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-stone-900 text-sm">{group.villageName}</h3>
                      {(group.mandal || group.district) && (
                        <span className="text-[11px] text-stone-500">
                          ({[group.mandal, group.district].filter(Boolean).join(', ')})
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      Attached Agents: {group.attachedAgentsCount} of {group.requiredAgents} required
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                        group.vacancy > 0
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-stone-100 text-stone-600 border-stone-200'
                      }`}
                    >
                      Vacancy: {group.vacancy} / {group.requiredAgents}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                      {group.interestedCount} Interested
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-stone-50/50 text-stone-500 font-semibold border-b border-stone-100 text-[11px]">
                        <th className="p-2.5 w-12">Photo</th>
                        <th className="p-2.5">Candidate</th>
                        <th className="p-2.5">Phone</th>
                        <th className="p-2.5">Native Village</th>
                        <th className="p-2.5">Visit Date / Time</th>
                        <th className="p-2.5">Office</th>
                        <th className="p-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {group.visits.map((visit) => (
                        <tr key={visit.id} className="hover:bg-stone-50/60 transition-colors">
                          <td className="p-2.5">
                            <CandidatePhoto
                              name={visit.candidateName}
                              photo={visit.photo}
                              className="w-8 h-8"
                            />
                          </td>
                          <td className="p-2.5 font-bold text-stone-900">{visit.candidateName}</td>
                          <td className="p-2.5 font-mono text-stone-700">{visit.phone}</td>
                          <td className="p-2.5 text-stone-600">{visit.nativeVillage || '—'}</td>
                          <td className="p-2.5 text-stone-700 font-medium">
                            {visit.visitDate} @ {visit.visitTime}
                          </td>
                          <td className="p-2.5 text-stone-700">{visit.regionalOffice}</td>
                          <td className="p-2.5 text-right">
                            <OnboardButton step={stepOf(visit)} onClick={() => openWizard(visit)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {villageWiseVisits.length === 0 && (
              <div className="p-8 text-center text-stone-400 bg-white rounded-xl border border-stone-200">
                No villages with scheduled visits found for the selected filter.
              </div>
            )}
          </div>
        )
      ) : (
        /* ── Map with click-to-inspect drawer ────────────────── */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-8 bg-white rounded-xl border border-stone-200 p-2.5 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between text-xs px-3 py-1.5 bg-stone-50 rounded-lg border border-stone-200">
              <span className="font-semibold text-stone-800">
                Click any village polygon to inspect candidate interest &amp; vacancy:
              </span>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Vacant
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" /> Interest Exists
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-stone-400" /> Filled
                </span>
              </div>
            </div>
            <InteractiveMap
              height="480px"
              villages={villages}
              candidatePins={candidatePins}
              showAllotmentColors
              agentMapMode
              selectedVillageId={selectedVillage?.id}
              onSelectVillage={(v) => setSelectedVillage(v)}
            />
          </div>

          <div className="lg:col-span-4 bg-white rounded-xl border border-stone-200 p-4 space-y-3.5 shadow-2xs">
            {selectedVillage ? (
              <VillageDrawer
                village={selectedVillage}
                visits={visits}
                progress={progress}
                onOpen={openWizard}
              />
            ) : (
              <div className="py-12 text-center text-stone-400 text-xs space-y-2">
                <MapPin className="w-6 h-6 mx-auto text-stone-300" />
                <p>Select any village polygon on the map to inspect vacancy and candidates.</p>
              </div>
            )}
          </div>
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

/** "Open Onboarding", or "Resume · Step n" once the wizard has been started for them. */
function OnboardButton({ step, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg font-semibold text-xs inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer text-white ${
        step > 0 ? 'bg-amber-500 hover:bg-amber-600' : 'bg-[#2563EB] hover:bg-[#1D4ED8]'
      }`}
    >
      {step > 0 ? (
        <>
          <span>Resume</span>
          <span className="bg-amber-700/60 px-1 py-0.2 rounded text-[10px]">Step {step}</span>
        </>
      ) : (
        'Open Onboarding'
      )}
    </button>
  );
}

/** What the map drawer shows for one village: seats, lands in the zone, candidates. */
function VillageDrawer({ village, visits, progress, onOpen }) {
  const [lands, setLands] = useState([]);
  const [landsLoading, setLandsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLandsLoading(true);
    agentService
      .getLandNodes({
        state: village.state,
        district: village.district,
        mandal: village.mandal,
        village: village.name,
      })
      .then((data) => {
        const list = data.result || data.data || [];
        if (!cancelled) setLands(Array.isArray(list) ? list : []);
      })
      .catch((err) => {
        console.error('Failed to load lands in zone:', err);
        if (!cancelled) setLands([]);
      })
      .finally(() => {
        if (!cancelled) setLandsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [village.state, village.district, village.mandal, village.name]);

  const candidates = visits.filter(
    (v) =>
      norm(v.interestedVillage) === norm(village.name) ||
      (v.candidate.interests || []).some((i) => norm(i.village) === norm(village.name))
  );

  const totalAcres = lands.reduce((acc, l) => acc + (Number(l.total_acres) || 0), 0);

  return (
    <div className="space-y-3">
      <div className="pb-2 border-b border-stone-200">
        <span className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">
          Village Allotment Status
        </span>
        <h3 className="font-bold text-base text-stone-900">{village.name}</h3>
        <p className="text-xs text-stone-500">
          {village.mandal}, {village.district}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="p-2 bg-stone-50 rounded-lg border border-stone-200">
          <span className="text-[10px] text-stone-500 block">Required</span>
          <span className="font-bold text-stone-900 text-sm">{village.requiredAgents}</span>
        </div>
        <div className="p-2 bg-stone-50 rounded-lg border border-stone-200">
          <span className="text-[10px] text-stone-500 block">Attached</span>
          <span className="font-bold text-stone-900 text-sm">{village.attachedAgentsCount}</span>
        </div>
        <div className="p-2 bg-stone-50 rounded-lg border border-stone-200">
          <span className="text-[10px] text-stone-500 block">Vacancy</span>
          <span
            className={`font-bold text-sm ${
              village.vacancy > 0 ? 'text-emerald-600' : 'text-stone-400'
            }`}
          >
            {village.vacancy}
          </span>
        </div>
      </div>

      <div className="space-y-1.5 pt-1 border-t border-stone-100">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-stone-800 text-xs uppercase tracking-wider flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
            <span>Lands in Zone ({lands.length})</span>
          </h4>
          <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
            {Math.round(totalAcres * 10) / 10} Ac Total
          </span>
        </div>
        <div className="space-y-1.5 max-h-36 overflow-y-auto">
          {landsLoading ? (
            <p className="text-[11px] text-stone-400 py-1 inline-flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading lands…
            </p>
          ) : lands.length > 0 ? (
            lands.map((land) => {
              const acres = Number(land.total_acres) || 0;
              const perAcre = acres > 0 ? (Number(land.total_value) || 0) / acres : 0;
              return (
                <div
                  key={land.id}
                  className="p-2 rounded-lg border border-stone-200 bg-stone-50/70 text-[11px] space-y-0.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-900">LD-{land.id}</span>
                    <span className="font-bold text-emerald-700 font-mono">
                      {Math.round(acres * 10) / 10} Ac
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-stone-500 text-[10px]">
                    <span>Farmer: {land.farmer_name || '—'}</span>
                    {perAcre > 0 && <span>₹{(perAcre / 100000).toFixed(1)}L/Ac</span>}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-[11px] text-stone-400 italic py-1">
              No lands registered yet in {village.name}.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2 pt-1 border-t border-stone-100">
        <h4 className="font-bold text-stone-800 text-xs uppercase tracking-wider flex items-center justify-between">
          <span>Interested Candidates</span>
          <span className="text-[#2563EB] font-mono">{candidates.length}</span>
        </h4>

        <div className="space-y-2 max-h-72 overflow-y-auto">
          {candidates.map((visit) => {
            const step = progress[String(visit.candidateId)] || 0;
            return (
              <div
                key={visit.id}
                className="p-2.5 rounded-lg border border-stone-200 bg-stone-50/80 space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-900">{visit.candidateName}</span>
                  <span className="font-mono text-stone-600">{visit.phone}</span>
                </div>
                <p className="text-[11px] text-stone-500">Native: {visit.nativeVillage || '—'}</p>
                <p className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
                  Visit: {visit.visitDate} @ {visit.visitTime} ({visit.regionalOffice})
                </p>
                <button
                  type="button"
                  onClick={() => onOpen(visit)}
                  className={`w-full py-1.5 rounded-lg font-semibold text-xs shadow-2xs transition-colors text-white cursor-pointer ${
                    step > 0 ? 'bg-amber-500 hover:bg-amber-600' : 'bg-[#2563EB] hover:bg-[#1D4ED8]'
                  }`}
                >
                  {step > 0 ? `Resume Step ${step}` : 'Open Onboarding'}
                </button>
              </div>
            );
          })}

          {candidates.length === 0 && (
            <p className="text-stone-400 text-xs text-center py-4">
              No candidates interested in this village yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
