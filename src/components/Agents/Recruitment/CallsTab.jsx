import { useMemo, useState } from 'react';
import {
  Phone,
  PhoneCall,
  PhoneForwarded,
  Clock,
  Users,
  CheckCircle2,
  Calendar,
  Search,
  ExternalLink,
  Eye,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

import PersonAvatar from '../common/PersonAvatar';
import { useRecruitmentDesk } from '../../../hooks/useRecruitmentDesk';
import useAgentLeads from '../../../hooks/useAgentLeads';
import {
  squadLabel,
  firstName,
  sameId,
  isFirstCall,
  isNotLifted,
  todayISO,
  tomorrowISO,
} from './recruitmentModel';

const SUB_TABS = [
  { key: 'first-calls', label: 'First Calls' },
  { key: 'follow-ups', label: 'Follow-ups' },
  { key: 'not-lifted', label: 'Not Lifted' },
  { key: 'all', label: 'All Calls' },
];

const STRIP_TITLES = {
  'first-calls': 'Fresh Leads Waiting for First Contact',
  'follow-ups': 'Scheduled Follow-up Calls',
  'not-lifted': 'Ringing Unanswered Calls (Re-attempt Queue)',
  all: 'All Inquiries in Scope',
};

const EMPTY_HINTS = {
  'first-calls': 'All fresh first calls have been initiated. Check follow-ups or not-lifted queues.',
  'follow-ups': 'No follow-up calls scheduled for the selected date.',
  'not-lifted': 'No unanswered calls currently pending retry.',
  all: 'No candidate records match the active search and filter criteria.',
};

/** Which queue a dial came from, so the attempt history can say so later. */
const queueOf = (subTab, lead) => {
  if (subTab === 'first-calls') return 'first-call';
  if (subTab === 'follow-ups') return 'follow-up';
  if (subTab === 'not-lifted') return 'not-lifted';
  if (lead.followUpDate) return 'follow-up';
  if (isNotLifted(lead)) return 'not-lifted';
  return 'first-call';
};

/**
 * The calling floor: pick a squad, pick a caller (or neither), work a queue.
 *
 * The queues deliberately overlap — a lead never lifted with a call-back booked
 * is in both — because that is how the desk counts them. The Calls badge is
 * the sum of the first three for the same reason.
 */
export default function CallsTab() {
  const { teams, employeeById, rosterLoading, rosterError, callLead, openLead } =
    useRecruitmentDesk();
  const { leads, loading, error: loadError } = useAgentLeads();

  const [selectedTeamId, setSelectedTeamId] = useState('All');
  const [selectedExecutiveId, setSelectedExecutiveId] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [callsSubTab, setCallsSubTab] = useState('first-calls');
  const [followUpFilter, setFollowUpFilter] = useState('all');
  const [followUpCustomDate, setFollowUpCustomDate] = useState('');

  const todayStr = todayISO();
  const tomorrowStr = tomorrowISO();

  const currentTeam = useMemo(
    () => (selectedTeamId === 'All' ? null : teams.find((t) => sameId(t.id, selectedTeamId)) || null),
    [teams, selectedTeamId]
  );

  /* ── Who can be dialling ──────────────────────────────────── */

  // Every squad's leader and members, plus anyone who has been handed leads even
  // if they have since left a squad — their leads still need working.
  const allCallingExecutives = useMemo(() => {
    const ids = new Set();
    teams.forEach((t) => {
      if (t.teamLeaderId) ids.add(String(t.teamLeaderId));
      (t.memberIds || []).forEach((id) => ids.add(String(id)));
    });
    leads.forEach((l) => l.assignedTelecallerId && ids.add(String(l.assignedTelecallerId)));

    return [...ids].map((id) => employeeById.get(id)).filter(Boolean);
  }, [teams, leads, employeeById]);

  const displayExecutives = useMemo(() => {
    if (!currentTeam) return allCallingExecutives;

    const ids = new Set([String(currentTeam.teamLeaderId), ...(currentTeam.memberIds || [])]);
    leads.forEach((l) => {
      if (sameId(l.assignedTeamId, currentTeam.id) && l.assignedTelecallerId) {
        ids.add(String(l.assignedTelecallerId));
      }
    });
    return allCallingExecutives.filter((e) => ids.has(String(e.id)));
  }, [currentTeam, allCallingExecutives, leads]);

  const selectedExecutive = useMemo(
    () =>
      selectedExecutiveId === 'All' ? null : employeeById.get(String(selectedExecutiveId)) || null,
    [employeeById, selectedExecutiveId]
  );

  const allTeamsSummary = useMemo(
    () =>
      teams.map((team) => ({
        team,
        leader: employeeById.get(String(team.teamLeaderId)),
        leadsCount: leads.filter((l) => sameId(l.assignedTeamId, team.id)).length,
        shortName: squadLabel(team),
      })),
    [teams, leads, employeeById]
  );

  const handleTeamLeaderClick = (team) => {
    setSelectedExecutiveId('All');
    setSelectedTeamId((prev) => (sameId(prev, team.id) ? 'All' : String(team.id)));
  };

  /* ── Scope, then queues ───────────────────────────────────── */

  const scopedLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return leads.filter((lead) => {
      // The squad filter only applies while no caller is picked — a caller is
      // already a narrower scope than the squad they sit in.
      if (selectedExecutiveId === 'All') {
        if (selectedTeamId !== 'All' && !sameId(lead.assignedTeamId, selectedTeamId)) return false;
      } else {
        // "Their" calls: leads they own, owe a call-back on, or dialled last.
        const mine =
          sameId(lead.assignedTelecallerId, selectedExecutiveId) ||
          sameId(lead.followUpBy, selectedExecutiveId) ||
          sameId(lead.lastAttemptBy, selectedExecutiveId);
        if (!mine) return false;
      }

      if (!q) return true;
      return (
        lead.name.toLowerCase().includes(q) ||
        lead.phone.includes(q) ||
        lead.nativeVillage.toLowerCase().includes(q) ||
        lead.mandal.toLowerCase().includes(q) ||
        lead.district.toLowerCase().includes(q)
      );
    });
  }, [leads, selectedTeamId, selectedExecutiveId, searchQuery]);

  const firstCallsQueue = useMemo(() => scopedLeads.filter(isFirstCall), [scopedLeads]);

  const followUpsQueue = useMemo(
    () =>
      scopedLeads.filter((lead) => {
        if (!lead.followUpDate) return false;
        if (followUpFilter === 'today') return lead.followUpDate === todayStr;
        if (followUpFilter === 'tomorrow') return lead.followUpDate === tomorrowStr;
        if (followUpFilter === 'custom' && followUpCustomDate) {
          return lead.followUpDate === followUpCustomDate;
        }
        return true;
      }),
    [scopedLeads, followUpFilter, followUpCustomDate, todayStr, tomorrowStr]
  );

  const notLiftedQueue = useMemo(() => scopedLeads.filter(isNotLifted), [scopedLeads]);

  const currentDisplayedLeads =
    callsSubTab === 'follow-ups'
      ? followUpsQueue
      : callsSubTab === 'not-lifted'
      ? notLiftedQueue
      : callsSubTab === 'all'
      ? scopedLeads
      : firstCallsQueue;

  const countOf = { 'first-calls': firstCallsQueue.length, 'follow-ups': followUpsQueue.length, 'not-lifted': notLiftedQueue.length, all: scopedLeads.length };

  const error = loadError || rosterError;

  return (
    <div className="space-y-3">
      {/* ── Header & filter bar ─────────────────────────── */}
      <div className="bg-white rounded-xl border border-stone-200 p-2.5 shadow-2xs space-y-2">
        {/* Row 1: title + squads in one line + search */}
        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <PhoneCall className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-stone-900 whitespace-nowrap">
              Agent Calling Workspace
            </h2>
          </div>

          <div className="hidden lg:block w-px h-6 bg-stone-200 shrink-0" />

          <div className="flex items-center gap-1.5 overflow-x-auto min-w-0 flex-1 py-0.5">
            <button
              type="button"
              onClick={() => {
                setSelectedTeamId('All');
                setSelectedExecutiveId('All');
              }}
              title="Show all squads together"
              className={`text-[11px] px-2 py-1 rounded-md shrink-0 transition-colors border ${
                selectedTeamId === 'All'
                  ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-2xs'
                  : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100 font-medium'
              }`}
            >
              All Squads
            </button>

            {allTeamsSummary.map(({ team, leader, leadsCount, shortName }) => {
              const isSelected = sameId(team.id, selectedTeamId);
              const leaderName = leader?.name || team.teamLeaderName;

              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => handleTeamLeaderClick(team)}
                  title={`${team.name}\nLeader: ${leaderName}\n${leadsCount} total leads`}
                  className={`p-1 px-2 rounded-lg border text-left flex items-center gap-1.5 transition-all shrink-0 ${
                    isSelected
                      ? 'bg-blue-50 text-blue-900 border-blue-500 ring-2 ring-blue-400/40 shadow-2xs font-bold'
                      : 'bg-stone-50/80 hover:bg-stone-100 text-stone-700 border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="relative shrink-0">
                    <PersonAvatar
                      name={leaderName}
                      photo={leader?.photo || team.teamLeaderPhoto}
                      size={24}
                    />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-white ${
                        isSelected ? 'bg-blue-600' : 'bg-emerald-500'
                      }`}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] truncate font-semibold leading-tight">
                      {shortName}
                    </div>
                    <div className="text-[9px] text-stone-500 font-normal truncate leading-tight">
                      {firstName(leaderName)} ·{' '}
                      <span className="text-blue-700 font-bold">{leadsCount}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="relative min-w-[170px] max-w-[220px] shrink-0">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate, phone..."
              className="w-full text-xs bg-stone-50/80 border border-stone-200 rounded-lg pl-7 pr-6 py-1 text-stone-800 placeholder-stone-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                title="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs px-1"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Row 2: callers */}
        <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-stone-700 flex items-center gap-1 shrink-0 mr-1">
            <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>
              {currentTeam
                ? `${squadLabel(currentTeam)} Telecallers (${displayExecutives.length}):`
                : `All Telecallers (${displayExecutives.length}):`}
            </span>
          </span>

          <button
            type="button"
            onClick={() => setSelectedExecutiveId('All')}
            title="View calls for all telecallers in this team"
            className={`px-2 py-1 rounded-lg border flex items-center gap-1.5 transition-all text-left shrink-0 ${
              selectedExecutiveId === 'All'
                ? 'bg-blue-100 text-blue-900 border-blue-500 ring-2 ring-blue-400 font-bold shadow-2xs'
                : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100 shadow-2xs'
            }`}
          >
            <div className="w-4 h-4 rounded-full bg-stone-200 flex items-center justify-center text-stone-700 shrink-0">
              <Users className="w-2.5 h-2.5" />
            </div>
            <span className="text-xs font-semibold">All Callers</span>
            <span className="px-1.5 rounded-full text-[10px] font-mono font-bold bg-blue-100 text-blue-800 border border-blue-200 shrink-0">
              {currentTeam
                ? leads.filter((l) => sameId(l.assignedTeamId, currentTeam.id)).length
                : leads.length}
            </span>
          </button>

          {displayExecutives.map((exec) => {
            const isSelected = sameId(selectedExecutiveId, exec.id);
            const leadCount = leads.filter(
              (l) => sameId(l.assignedTelecallerId, exec.id) || sameId(l.followUpBy, exec.id)
            ).length;

            return (
              <button
                key={exec.id}
                type="button"
                onClick={() => setSelectedExecutiveId(isSelected ? 'All' : String(exec.id))}
                title={`${exec.name} (${leadCount} leads)`}
                className={`px-2 py-1 rounded-lg border flex items-center gap-1.5 transition-all text-left shrink-0 ${
                  isSelected
                    ? 'bg-blue-100 text-blue-900 border-blue-500 ring-2 ring-blue-400 font-bold shadow-2xs'
                    : 'bg-stone-50 border-stone-200 text-stone-800 hover:bg-stone-100 shadow-2xs'
                }`}
              >
                <PersonAvatar name={exec.name} photo={exec.photo} size="xs" />
                <span className="text-xs font-semibold text-stone-800 truncate max-w-[120px]">
                  {exec.name}
                </span>
                <span className="px-1.5 rounded-full text-[10px] font-mono font-bold bg-blue-100 text-blue-800 border border-blue-200 shrink-0">
                  {leadCount} leads
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* ── Queues ──────────────────────────────────────── */}
      <div className="w-full space-y-3">
        {/* Sub-tab navigation */}
        <div className="flex flex-wrap items-center justify-between bg-stone-50 p-1.5 rounded-lg border border-stone-200 gap-2">
          <div className="flex items-center gap-1 text-xs">
            {SUB_TABS.map((tab) => {
              const active = callsSubTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setCallsSubTab(tab.key)}
                  className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-all ${
                    active
                      ? 'bg-white text-stone-900 shadow-2xs border border-stone-200/80'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {tab.key === 'follow-ups' && <Clock className="w-3.5 h-3.5 text-amber-500" />}
                  {tab.key === 'not-lifted' && (
                    <PhoneForwarded className="w-3.5 h-3.5 text-red-500" />
                  )}
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 rounded-full text-[10px] font-bold font-mono ${
                      tab.key === 'first-calls'
                        ? 'bg-blue-100 text-blue-700'
                        : tab.key === 'follow-ups'
                        ? 'bg-amber-100 text-amber-800'
                        : tab.key === 'not-lifted'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-stone-200 text-stone-800'
                    }`}
                  >
                    {countOf[tab.key]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-stone-500 hidden sm:flex items-center gap-1 pr-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>
              Clicking <strong>CALL</strong> triggers the Agent Call Workspace
            </span>
          </div>
        </div>

        {/* Follow-up date filter */}
        {callsSubTab === 'follow-ups' && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-amber-50/50 rounded-lg border border-amber-200/80 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-amber-900 mr-1">Date Filter:</span>
              {[
                { key: 'all', label: 'All Dates', on: 'bg-stone-900 text-white' },
                { key: 'today', label: `Today (${todayStr})`, on: 'bg-blue-600 text-white' },
                { key: 'tomorrow', label: `Tomorrow (${tomorrowStr})`, on: 'bg-blue-600 text-white' },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFollowUpFilter(f.key)}
                  className={`px-2.5 py-1 rounded text-xs font-medium ${
                    followUpFilter === f.key
                      ? f.on
                      : 'bg-white border border-stone-200 text-stone-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <div className="flex items-center gap-1 bg-white border border-stone-200 rounded px-2 py-0.5">
                <Calendar className="w-3 h-3 text-stone-400" />
                <input
                  type="date"
                  value={followUpCustomDate}
                  onChange={(e) => {
                    setFollowUpCustomDate(e.target.value);
                    setFollowUpFilter('custom');
                  }}
                  className="text-xs bg-transparent"
                />
              </div>
            </div>

            <span className="text-[11px] text-amber-800 font-medium">
              {followUpsQueue.length} follow-up calls scheduled
            </span>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-2xs">
          <div className="p-2.5 bg-stone-50 border-b border-stone-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-stone-800">{STRIP_TITLES[callsSubTab]}</span>
              <span className="px-2 rounded-full text-[10px] font-mono font-bold bg-white text-stone-700 border border-stone-200">
                {currentDisplayedLeads.length} Candidates
              </span>
            </div>

            {selectedExecutive && (
              <div className="flex items-center gap-1.5 text-stone-500 text-[11px]">
                <span>Caller:</span>
                <span className="font-semibold text-blue-700">{selectedExecutive.name}</span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
                  <th className="p-2.5 w-10 text-center">Photo</th>
                  <th className="p-2.5">Candidate Name &amp; ID</th>
                  <th className="p-2.5">Phone</th>
                  <th className="p-2.5">Village / Mandal</th>
                  <th className="p-2.5">Assigned Caller &amp; Team</th>
                  <th className="p-2.5">
                    {callsSubTab === 'follow-ups'
                      ? 'Follow-up Time & Date'
                      : callsSubTab === 'not-lifted'
                      ? 'Attempts & Last Time'
                      : 'Call Status / Notes'}
                  </th>
                  <th className="p-2.5 text-right w-28">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-stone-100">
                {loading || rosterLoading ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-stone-400">
                      <span className="inline-flex items-center gap-2 font-medium">
                        <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading…
                      </span>
                    </td>
                  </tr>
                ) : currentDisplayedLeads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center">
                      <div className="max-w-sm mx-auto space-y-2">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                        <p className="font-semibold text-stone-800 text-sm">
                          No pending calls in this queue!
                        </p>
                        <p className="text-xs text-stone-500">{EMPTY_HINTS[callsSubTab]}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentDisplayedLeads.map((lead) => {
                    const assignedEmp = lead.assignedTelecallerId
                      ? employeeById.get(String(lead.assignedTelecallerId))
                      : null;
                    const callerName = assignedEmp?.name || lead.assignedTelecallerName;

                    return (
                      <tr key={lead.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="p-2 text-center">
                          <PersonAvatar
                            photo={lead.photo}
                            name={lead.name}
                            size={30}
                            className="mx-auto"
                          />
                        </td>

                        <td className="p-2.5">
                          <div className="flex flex-col">
                            <button
                              type="button"
                              onClick={() => openLead(lead)}
                              className="font-bold text-stone-900 hover:text-blue-600 transition-colors text-left flex items-center gap-1"
                            >
                              <span>{lead.name}</span>
                              <ExternalLink className="w-2.5 h-2.5 text-stone-400" />
                            </button>
                            <span className="text-[10px] font-mono text-stone-400">
                              {lead.code}
                            </span>
                          </div>
                        </td>

                        <td className="p-2.5">
                          <span className="font-mono text-stone-700 font-medium">{lead.phone}</span>
                        </td>

                        <td className="p-2.5 text-stone-800">
                          <span className="font-medium text-stone-900 block truncate max-w-[130px]">
                            {lead.nativeVillage || '—'}
                          </span>
                          <span className="text-[10px] text-stone-500 block truncate max-w-[130px]">
                            {lead.mandal ? `${lead.mandal}, ` : ''}
                            {lead.district}
                          </span>
                        </td>

                        <td className="p-2.5">
                          <div className="flex items-center gap-1.5">
                            <PersonAvatar
                              name={callerName || 'Unassigned'}
                              photo={assignedEmp?.photo}
                              size="xs"
                            />
                            <div className="min-w-0">
                              <span className="font-medium text-stone-900 block truncate text-[11px]">
                                {callerName || 'Unassigned'}
                              </span>
                              <span className="text-[9.5px] text-stone-500 block truncate">
                                {lead.assignedTeamName
                                  ? squadLabel({ name: lead.assignedTeamName })
                                  : 'Unattached'}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="p-2.5 text-stone-600">
                          {callsSubTab === 'follow-ups' ? (
                            <div>
                              <div className="flex items-center gap-1">
                                <span
                                  className={`px-1.5 rounded text-[10px] font-semibold ${
                                    lead.followUpDate === todayStr
                                      ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                      : 'bg-stone-100 text-stone-700'
                                  }`}
                                >
                                  {lead.followUpDate}
                                </span>
                                <span className="text-[10px] text-stone-500 font-medium">
                                  {lead.followUpTime || '10:00 AM'}
                                </span>
                              </div>
                              <span className="text-[10.5px] text-stone-500 block truncate max-w-[160px] mt-0.5">
                                {lead.lastCallNote || 'Follow-up scheduled'}
                              </span>
                            </div>
                          ) : callsSubTab === 'not-lifted' ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="px-1.5 rounded-full text-[10px] font-mono font-bold bg-red-100 text-red-700">
                                  {lead.callAttempts || 1}x attempts
                                </span>
                                <span className="text-[10px] text-stone-500">
                                  {lead.lastAttemptTime || 'Earlier today'}
                                </span>
                              </div>
                              <span className="text-[10.5px] text-stone-500 block truncate max-w-[160px] mt-0.5">
                                {lead.lastCallNote || 'Rang unanswered'}
                              </span>
                            </div>
                          ) : (
                            <div>
                              {lead.lastCallStatus ? (
                                <span
                                  className={`inline-block px-1.5 rounded text-[10px] font-medium ${
                                    lead.lastCallStatus === 'Answered'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : lead.lastCallStatus === 'Not Lifted'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {lead.lastCallStatus}
                                </span>
                              ) : (
                                <span className="px-1.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                  Fresh Inquiry
                                </span>
                              )}
                              <span className="text-[10.5px] text-stone-500 block truncate max-w-[160px] mt-0.5">
                                {lead.lastCallNote || 'Pending initial contact'}
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="p-2.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => callLead(lead, queueOf(callsSubTab, lead))}
                              title="Call Candidate (Open Call Workspace)"
                              className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs inline-flex items-center gap-1 shadow-2xs transition-colors"
                            >
                              <Phone className="w-3 h-3" />
                              <span>CALL</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openLead(lead)}
                              title="View Candidate Details"
                              className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
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

          <div className="p-2.5 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
            <span>
              Showing leads: <strong>{currentDisplayedLeads.length}</strong> / Total Scope:{' '}
              {scopedLeads.length}
            </span>
            <div className="flex items-center gap-3">
              <span>
                First Calls: <strong className="text-blue-700">{firstCallsQueue.length}</strong>
              </span>
              <span>
                Follow-ups: <strong className="text-amber-700">{followUpsQueue.length}</strong>
              </span>
              <span>
                Not Lifted: <strong className="text-red-700">{notLiftedQueue.length}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
