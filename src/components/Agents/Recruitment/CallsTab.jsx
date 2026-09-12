import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Grid,
  Phone,
  PhoneOff,
  PhoneForwarded,
  PhoneIncoming,
  ArrowUpRight,
  Layers,
  Loader2,
  AlertTriangle,
  PanelRight,
  PanelRightClose,
  TrendingUp,
  UserRound,
  RefreshCw,
} from 'lucide-react';

import PersonAvatar from '../common/PersonAvatar';
import CallWorkspaceModal from './CallWorkspaceModal';
import useAgentTeams from '../../../hooks/useAgentTeams';
import agentLeadService from '../../../services/agentLeadService';

const todayISO = () => new Date().toISOString().slice(0, 10);
const tomorrowISO = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * The calling floor.
 *
 * The stage grid across the top doubles as the queue switcher, because the
 * numbers and the tabs are the same thing — an operator reading "12 first
 * calls" should be able to click it and be in that queue.
 *
 * The queues deliberately overlap: a lead never lifted, with a call-back
 * booked, is in both. That mirrors how the desk counts them.
 */
export default function CallsTab({ counts = {}, refresh, onNavigate }) {
  const { teams, employeeById, loading: teamsLoading } = useAgentTeams();

  const [leads, setLeads] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [subTab, setSubTab] = useState('first-calls');
  const [followUpFilter, setFollowUpFilter] = useState('all');
  const [customDate, setCustomDate] = useState(todayISO());
  const [teamFilter, setTeamFilter] = useState('All');
  const [callerFilter, setCallerFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showReportPanel, setShowReportPanel] = useState(true);
  const [callLead, setCallLead] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsData, perfData] = await Promise.all([
        agentLeadService.getLeads({}),
        agentLeadService.getPerformance({}),
      ]);
      const list = leadsData.result || leadsData.data || [];
      setLeads(Array.isArray(list) ? list : []);
      setPerformance(perfData.result || perfData.data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load the calling floor:', err);
      setLeads([]);
      setError('Could not load the call queues.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* ── Callers ──────────────────────────────────────────────── */

  // Everyone who can be dialling: every squad's leader plus their members.
  const callers = useMemo(() => {
    const map = new Map();
    teams.forEach((team) => {
      const leader = employeeById.get(String(team.teamLeaderId));
      if (leader) map.set(String(leader.id), { ...leader, teamName: team.shortName });
      (team.members || []).forEach((m) =>
        map.set(String(m.id), { ...m, teamName: team.shortName })
      );
    });
    return [...map.values()];
  }, [teams, employeeById]);

  const visibleCallers = useMemo(
    () =>
      teamFilter === 'All'
        ? callers
        : callers.filter((c) => {
            const team = teams.find((t) => String(t.id) === String(teamFilter));
            if (!team) return false;
            return (
              String(team.teamLeaderId) === String(c.id) ||
              (team.memberIds || []).some((id) => String(id) === String(c.id))
            );
          }),
    [callers, teamFilter, teams]
  );

  /* ── Queues ───────────────────────────────────────────────── */

  const scoped = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return leads.filter((lead) => {
      if (teamFilter !== 'All' && String(lead.assigned_team_id) !== String(teamFilter))
        return false;
      if (
        callerFilter !== 'All' &&
        String(lead.assigned_employee_id) !== String(callerFilter)
      )
        return false;
      if (
        q &&
        !String(lead.name || '').toLowerCase().includes(q) &&
        !String(lead.phone || '').includes(q) &&
        !String(lead.village || '').toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [leads, teamFilter, callerFilter, searchQuery]);

  const queues = useMemo(() => {
    const firstCalls = scoped.filter((l) => (Number(l.call_attempts) || 0) === 0);
    const notLifted = scoped.filter((l) =>
      ['Not Lifted', 'No Answer'].includes(l.last_call_status)
    );

    const followUps = scoped.filter((l) => {
      if (!l.follow_up_date) return false;
      if (followUpFilter === 'today') return l.follow_up_date === todayISO();
      if (followUpFilter === 'tomorrow') return l.follow_up_date === tomorrowISO();
      if (followUpFilter === 'custom') return l.follow_up_date === customDate;
      return true;
    });

    return { firstCalls, followUps, notLifted, all: scoped };
  }, [scoped, followUpFilter, customDate]);

  const activeQueue =
    subTab === 'first-calls'
      ? queues.firstCalls
      : subTab === 'follow-ups'
      ? queues.followUps
      : subTab === 'not-lifted'
      ? queues.notLifted
      : queues.all;

  /* ── Report panel ─────────────────────────────────────────── */

  const report = useMemo(() => {
    const allotted = scoped.filter((l) => l.assigned_employee_id).length;
    const connected = scoped.filter((l) => l.last_call_status === 'Answered').length;
    const interested = scoped.filter((l) =>
      ['INTERESTED', 'VILLAGE_INTEREST', 'SELECTED', 'OFFICE_VISIT'].includes(l.status)
    ).length;
    const joined = leads.filter((l) => l.status === 'JOINED').length;

    const perf =
      callerFilter === 'All'
        ? null
        : performance.find((p) => String(p.employee_id) === String(callerFilter));

    return {
      allotted,
      connected,
      interested,
      joined,
      interestedRate: connected ? Math.round((interested / connected) * 100) : 0,
      onboardedRate: interested ? Math.round((joined / interested) * 100) : 0,
      perf,
    };
  }, [scoped, leads, performance, callerFilter]);

  const selectedCaller =
    callerFilter === 'All' ? null : callers.find((c) => String(c.id) === String(callerFilter));

  const STAGES = [
    {
      key: 'first-calls',
      label: 'First Calls',
      sub: 'Never dialled',
      icon: PhoneIncoming,
      count: queues.firstCalls.length,
      tone: 'blue',
    },
    {
      key: 'follow-ups',
      label: 'Follow-ups',
      sub: 'Call-back booked',
      icon: PhoneForwarded,
      count: queues.followUps.length,
      tone: 'amber',
    },
    {
      key: 'not-lifted',
      label: 'Not Lifted',
      sub: 'Nobody picked up',
      icon: PhoneOff,
      count: queues.notLifted.length,
      tone: 'rose',
    },
    {
      key: 'tl',
      label: 'TL Escalation',
      sub: 'With a team leader',
      icon: ArrowUpRight,
      count: counts['team-leader'] || 0,
      tone: 'purple',
      navigate: 'team-leader',
    },
    {
      key: 'all',
      label: 'Total Scoped',
      sub: 'Everything in view',
      icon: Layers,
      count: scoped.length,
      tone: 'stone',
    },
  ];

  const selectClass =
    'px-2 py-1 bg-stone-50 rounded border border-stone-200 text-xs font-medium text-stone-700 focus:bg-white';

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-white p-3 rounded-lg border border-stone-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 block">
            Calling Floor
          </span>
          <h2 className="text-xs font-bold text-stone-900 mt-0.5">
            Work the queues in order: first calls, then call-backs, then retries
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowReportPanel((p) => !p)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 ${
              showReportPanel
                ? 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                : 'bg-blue-50 border-blue-300 text-blue-700'
            }`}
          >
            {showReportPanel ? (
              <>
                <PanelRightClose className="w-3.5 h-3.5 text-stone-500" /> Hide Report
              </>
            ) : (
              <>
                <PanelRight className="w-3.5 h-3.5 text-blue-600" /> Show Report
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Filters + caller picker */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-7 bg-white p-3 rounded-lg border border-stone-200 shadow-2xs space-y-2.5">
          <div className="flex items-center gap-2 bg-stone-50 px-2.5 py-1.5 rounded-md border border-stone-200">
            <Search className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <input
              type="text"
              placeholder="Search candidate name, phone, village..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs text-stone-800 placeholder-stone-400"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            <select
              value={teamFilter}
              onChange={(e) => {
                setTeamFilter(e.target.value);
                setCallerFilter('All');
              }}
              className={selectClass}
            >
              <option value="All">All Teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <select
              value={callerFilter}
              onChange={(e) => setCallerFilter(e.target.value)}
              className={selectClass}
            >
              <option value="All">All Callers</option>
              {visibleCallers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <span className="text-[11px] text-stone-500 ml-auto">
              {scoped.length} lead(s) in scope
            </span>
          </div>
        </div>

        {/* Quick pick callers */}
        <div className="lg:col-span-5 bg-white p-3 rounded-lg border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Quick pick caller
            </span>
            {callerFilter !== 'All' && (
              <button
                type="button"
                onClick={() => setCallerFilter('All')}
                className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold"
              >
                Reset
              </button>
            )}
          </div>

          {teamsLoading ? (
            <div className="py-4 text-center">
              <Loader2 className="w-4 h-4 animate-spin text-[#2563EB] mx-auto" />
            </div>
          ) : visibleCallers.length === 0 ? (
            <p className="text-[11px] text-stone-400 py-3 text-center">
              No callers in this squad yet.
            </p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              <button
                type="button"
                onClick={() => setCallerFilter('All')}
                className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-all ${
                  callerFilter === 'All'
                    ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-300'
                    : 'bg-stone-50/60 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-stone-200 text-stone-600 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <span className="text-[9px] font-semibold text-stone-700 text-center leading-tight">
                  All
                </span>
                <span className="text-[9px] font-bold text-[#2563EB]">{leads.length}</span>
              </button>

              {visibleCallers.map((caller) => {
                const count = leads.filter(
                  (l) => String(l.assigned_employee_id) === String(caller.id)
                ).length;
                const isActive = String(callerFilter) === String(caller.id);
                return (
                  <button
                    key={caller.id}
                    type="button"
                    onClick={() =>
                      setCallerFilter((prev) =>
                        String(prev) === String(caller.id) ? 'All' : caller.id
                      )
                    }
                    title={`${caller.name} · ${caller.teamName} · ${count} leads`}
                    className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-all ${
                      isActive
                        ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-300'
                        : 'bg-stone-50/60 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <PersonAvatar name={caller.name} photo={caller.photo} size={36} />
                    <span className="text-[9px] font-semibold text-stone-700 text-center leading-tight line-clamp-2">
                      {caller.name.split(' ')[0]}
                    </span>
                    <span
                      className={`text-[9px] font-bold ${
                        count > 0 ? 'text-[#2563EB]' : 'text-stone-400'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Lifecycle grid */}
      <div className="bg-white p-3 rounded-lg border border-stone-200 shadow-2xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold">
              <Grid className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-bold text-stone-900 text-xs">
                Calling Lifecycle Operations Grid
              </span>
              <p className="text-[10px] text-stone-500">
                Structured workflow stages: Ingestion → Dialing → Callback → Senior
                escalation
              </p>
            </div>
          </div>
          <span className="text-[10px] text-stone-500 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
            Interactive stage switcher
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
          {STAGES.map((stage) => (
            <StageCard
              key={stage.key}
              {...stage}
              active={subTab === stage.key}
              onClick={() =>
                stage.navigate ? onNavigate?.(stage.navigate) : setSubTab(stage.key)
              }
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        <div className={`${showReportPanel ? 'lg:col-span-9' : 'lg:col-span-12'} space-y-3`}>
          {/* Follow-up sub-filter */}
          {subTab === 'follow-ups' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-amber-900">Call-backs due:</span>
              {[
                { key: 'all', label: 'All' },
                { key: 'today', label: 'Today' },
                { key: 'tomorrow', label: 'Tomorrow' },
                { key: 'custom', label: 'On date' },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFollowUpFilter(f.key)}
                  className={`px-2.5 py-1 rounded-lg font-semibold border transition-colors ${
                    followUpFilter === f.key
                      ? 'bg-amber-600 border-amber-600 text-white'
                      : 'bg-white border-amber-200 text-amber-900 hover:bg-amber-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
              {followUpFilter === 'custom' && (
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="px-2 py-1 rounded-lg border border-amber-200 bg-white text-xs font-medium"
                />
              )}
            </div>
          )}

          {/* Queue table */}
          <div className="bg-white rounded-lg border border-stone-200 shadow-2xs overflow-hidden">
            <div className="px-3 py-2 border-b border-stone-200 bg-stone-50/60 flex items-center justify-between">
              <span className="text-xs font-bold text-stone-900">
                {STAGES.find((s) => s.key === subTab)?.label || 'Queue'} ·{' '}
                {activeQueue.length} lead(s)
              </span>
              {selectedCaller && (
                <span className="text-[11px] text-stone-500">
                  Filtered to {selectedCaller.name}
                </span>
              )}
            </div>

            <div className="overflow-x-auto max-h-[calc(100vh-560px)]">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 z-20 shadow-2xs">
                  <tr className="bg-stone-100 text-stone-700 font-semibold border-b border-stone-200">
                    <th className="p-2.5 w-10 text-center bg-stone-100">Photo</th>
                    <th className="p-2.5 bg-stone-100">Candidate name &amp; ID</th>
                    <th className="p-2.5 bg-stone-100">Phone</th>
                    <th className="p-2.5 bg-stone-100">Village / Mandal</th>
                    <th className="p-2.5 bg-stone-100">Assigned caller &amp; team</th>
                    <th className="p-2.5 bg-stone-100">Last outcome</th>
                    <th className="p-2.5 text-right w-20 bg-stone-100">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-stone-400">
                        <span className="inline-flex items-center gap-2 font-medium">
                          <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading…
                        </span>
                      </td>
                    </tr>
                  ) : activeQueue.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-stone-400">
                        Nothing in this queue.
                      </td>
                    </tr>
                  ) : (
                    activeQueue.map((lead) => {
                      const caller = employeeById.get(String(lead.assigned_employee_id));
                      return (
                        <tr key={lead.id} className="hover:bg-stone-50 transition-colors">
                          <td className="p-2 text-center">
                            {lead.photo ? (
                              <img
                                src={lead.photo}
                                alt={lead.name}
                                className="w-7 h-7 rounded-full object-cover mx-auto"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-stone-200 text-stone-600 flex items-center justify-center mx-auto">
                                <UserRound className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </td>

                          <td className="p-2.5">
                            <div className="font-semibold text-stone-900">{lead.name}</div>
                            <div className="text-[10px] text-stone-400">
                              LD-{String(lead.id).padStart(4, '0')}
                              {Number(lead.call_attempts) > 0 && (
                                <> · {lead.call_attempts} attempt(s)</>
                              )}
                            </div>
                          </td>

                          <td className="p-2.5 text-stone-700">{lead.phone}</td>

                          <td className="p-2.5">
                            <div className="text-stone-800 font-medium">
                              {lead.village || '—'}
                            </div>
                            <div className="text-[10px] text-stone-500">
                              {lead.mandal || '—'}
                            </div>
                          </td>

                          <td className="p-2.5">
                            {caller ? (
                              <div className="flex items-center gap-1.5">
                                <PersonAvatar name={caller.name} photo={caller.photo} size="xs" />
                                <div className="min-w-0">
                                  <div className="text-stone-800 font-medium truncate">
                                    {caller.name}
                                  </div>
                                  <div className="text-[10px] text-stone-400 truncate">
                                    {lead.assigned_team_name || '—'}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-[#2563EB] text-[10px] font-bold border border-blue-200">
                                Unallotted
                              </span>
                            )}
                          </td>

                          <td className="p-2.5">
                            {lead.last_call_status ? (
                              <div>
                                <div className="text-stone-700 font-medium">
                                  {lead.last_call_status}
                                </div>
                                {lead.follow_up_date && (
                                  <div className="text-[10px] text-amber-700 font-semibold">
                                    Call back {lead.follow_up_date}
                                    {lead.follow_up_time ? ` · ${lead.follow_up_time}` : ''}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-stone-400">Never called</span>
                            )}
                          </td>

                          <td className="p-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => setCallLead(lead)}
                              className="px-2.5 py-1 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-medium text-xs inline-flex items-center gap-1 shadow-2xs"
                            >
                              <Phone className="w-3 h-3" />
                              Call
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-3 py-2 border-t border-stone-200 bg-stone-50/60 text-[11px] text-stone-500">
              Recording an outcome moves the lead on: Proceed → Interested, Follow up →
              call-back queue, Not interested → closed.
            </div>
          </div>
        </div>

        {/* Report panel */}
        {showReportPanel && (
          <div className="lg:col-span-3 space-y-3 lg:sticky lg:top-0 lg:self-start">
            <div className="bg-white rounded-lg border border-stone-200 p-2.5 shadow-2xs space-y-2.5">
              <div className="border-b border-stone-100 pb-1.5 flex items-center justify-between">
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                  <span className="truncate">Conversion Report</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowReportPanel(false)}
                  className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                >
                  <PanelRightClose className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Who the report is about */}
              <div className="flex items-center gap-2 p-2 bg-stone-50 border border-stone-200 rounded-lg">
                {selectedCaller ? (
                  <>
                    <PersonAvatar
                      name={selectedCaller.name}
                      photo={selectedCaller.photo}
                      size="md"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-stone-900 truncate">
                        {selectedCaller.name}
                      </div>
                      <div className="text-[10px] text-stone-500">
                        {selectedCaller.teamName} ·{' '}
                        {report.perf ? `${report.perf.connect_rate}% connect` : 'no calls yet'}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-9 h-9 rounded-full bg-blue-50 text-[#2563EB] border border-blue-200 flex items-center justify-center">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-stone-900">
                        Whole department
                      </div>
                      <div className="text-[10px] text-stone-500">
                        Pick a caller to scope this
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Rates */}
              <div className="grid grid-cols-2 gap-2">
                <RateCard
                  label="Interested rate"
                  value={`${report.interestedRate}%`}
                  sub={`${report.interested} of ${report.connected} connected`}
                  tone="blue"
                />
                <RateCard
                  label="Onboarded rate"
                  value={`${report.onboardedRate}%`}
                  sub={`${report.joined} joined`}
                  tone="emerald"
                />
              </div>

              {/* Funnel */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Conversion funnel
                </span>
                {[
                  { label: 'Allotted leads', value: report.allotted, tone: 'bg-stone-400' },
                  { label: 'Connected calls', value: report.connected, tone: 'bg-blue-500' },
                  { label: 'Interested', value: report.interested, tone: 'bg-emerald-500' },
                  { label: 'Joined as agent', value: report.joined, tone: 'bg-emerald-700' },
                ].map((step) => {
                  const base = Math.max(1, report.allotted);
                  return (
                    <div key={step.label}>
                      <div className="flex justify-between text-[11px] font-semibold text-stone-700 mb-0.5">
                        <span>{step.label}</span>
                        <strong className="text-stone-900">{step.value}</strong>
                      </div>
                      <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`${step.tone} h-1.5 rounded-full transition-all`}
                          style={{ width: `${Math.min(100, (step.value / base) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {report.perf && (
                <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-[11px] space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-stone-600">Attempts</span>
                    <strong className="text-stone-900">{report.perf.attempts}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-600">Answered</span>
                    <strong className="text-stone-900">{report.perf.answered}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-600">Proceeded</span>
                    <strong className="text-emerald-700">{report.perf.proceeded}</strong>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {callLead && (
        <CallWorkspaceModal
          lead={callLead}
          queue={subTab === 'all' ? 'first-call' : subTab.replace(/s$/, '')}
          onClose={() => setCallLead(null)}
          onDone={() => {
            load();
            refresh?.();
          }}
        />
      )}
    </div>
  );
}

/* ── Local pieces ─────────────────────────────────────────────── */

const STAGE_TONES = {
  blue: { on: 'bg-blue-600 border-blue-600 text-white', off: 'bg-blue-50/60 border-blue-200 text-blue-900' },
  amber: { on: 'bg-amber-600 border-amber-600 text-white', off: 'bg-amber-50/60 border-amber-200 text-amber-900' },
  rose: { on: 'bg-rose-600 border-rose-600 text-white', off: 'bg-rose-50/60 border-rose-200 text-rose-900' },
  purple: { on: 'bg-purple-600 border-purple-600 text-white', off: 'bg-purple-50/60 border-purple-200 text-purple-900' },
  stone: { on: 'bg-stone-800 border-stone-800 text-white', off: 'bg-stone-50/60 border-stone-200 text-stone-800' },
};

function StageCard({ label, sub, icon: Icon, count, tone, active, onClick }) {
  const tones = STAGE_TONES[tone] || STAGE_TONES.stone;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-2.5 rounded-lg border transition-all flex flex-col justify-between text-left ${
        active ? tones.on : `${tones.off} hover:brightness-95`
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="text-lg font-black leading-none">{count}</span>
      </div>
      <div className="mt-1.5">
        <div className="text-[11px] font-bold leading-tight">{label}</div>
        <div className={`text-[9px] leading-tight ${active ? 'opacity-80' : 'opacity-70'}`}>
          {sub}
        </div>
      </div>
    </button>
  );
}

function RateCard({ label, value, sub, tone }) {
  const tones = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  };
  return (
    <div className={`p-2 rounded-lg border ${tones[tone]}`}>
      <div className="text-[9px] font-bold uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-lg font-black leading-none mt-1">{value}</div>
      <div className="text-[9px] opacity-70 mt-0.5">{sub}</div>
    </div>
  );
}
