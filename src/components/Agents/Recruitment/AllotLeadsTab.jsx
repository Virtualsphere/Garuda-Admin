import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  CheckSquare,
  Square,
  Sparkles,
  Users,
  Building2,
  Check,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

import PersonAvatar from '../common/PersonAvatar';
import { useRecruitmentDesk } from '../../../hooks/useRecruitmentDesk';
import useAgentLeads from '../../../hooks/useAgentLeads';
import agentLeadService from '../../../services/agentLeadService';
import { squadLabel, firstName, sameId } from './recruitmentModel';
import { LEAD_SOURCES, LEAD_SOURCE_TONES } from '../agentConstants';
import { errorMessage } from '../../../utils/apiErrors';

/**
 * Level 2: handing one squad's leads to the callers inside it.
 *
 * Level 1 (the Leads tab) decides which squad owns a lead; this decides who in
 * that squad dials it. The workspace is scoped to one squad at a time, chosen
 * from the leader buttons across the top.
 *
 * Both halves of the top panel double as controls. With nothing ticked, clicking
 * a leader switches squad and clicking a caller filters to their leads. With
 * leads ticked the same clicks become actions — a leader *moves* the ticked leads
 * to that squad, a caller is *given* them — so allotting is a tick and a click.
 * There is no confirmation step: moving a lead between callers is routine here.
 */
export default function AllotLeadsTab() {
  const { teams, employeeById, rosterLoading, rosterError, notifyChanged, openLead } =
    useRecruitmentDesk();
  const { leads: allLeads, loading, error: loadError } = useAgentLeads();

  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [statusFilter, setStatusFilter] = useState('Unallotted');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [mandalFilter, setMandalFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Open on the first squad once the roster arrives.
  useEffect(() => {
    if (!selectedTeamId && teams.length) setSelectedTeamId(String(teams[0].id));
  }, [teams, selectedTeamId]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const currentTeam = useMemo(
    () => teams.find((t) => sameId(t.id, selectedTeamId)) || null,
    [teams, selectedTeamId]
  );

  // The squad's callers. The leader supervises, so is not a caller — matching
  // the prototype's "only members of this team can receive allotments".
  const teamMembers = useMemo(
    () => (currentTeam ? (currentTeam.members || []).filter((m) => !sameId(m.id, currentTeam.teamLeaderId)) : []),
    [currentTeam]
  );

  // Leads attached to THIS squad only — a squad never sees another's leads.
  const teamLeads = useMemo(
    () => (currentTeam ? allLeads.filter((l) => sameId(l.assignedTeamId, currentTeam.id)) : []),
    [allLeads, currentTeam]
  );

  const teamStats = useMemo(() => {
    const unallotted = teamLeads.filter((l) => !l.assignedTelecallerId).length;
    return { total: teamLeads.length, unallotted, allotted: teamLeads.length - unallotted };
  }, [teamLeads]);

  const allTeamsSummary = useMemo(
    () =>
      teams.map((team) => {
        const leads = allLeads.filter((l) => sameId(l.assignedTeamId, team.id));
        const unallotted = leads.filter((l) => !l.assignedTelecallerId).length;
        return {
          team,
          leader: employeeById.get(String(team.teamLeaderId)),
          leadsCount: leads.length,
          unallotted,
          shortName: squadLabel(team),
        };
      }),
    [teams, allLeads, employeeById]
  );

  const mandals = useMemo(
    () => [...new Set(teamLeads.map((l) => l.mandal).filter(Boolean))].sort(),
    [teamLeads]
  );

  const filteredTeamLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return teamLeads.filter((lead) => {
      const matchesSearch =
        !q ||
        lead.name.toLowerCase().includes(q) ||
        lead.phone.includes(q) ||
        lead.nativeVillage.toLowerCase().includes(q);
      if (!matchesSearch) return false;

      if (sourceFilter !== 'All' && lead.source !== sourceFilter) return false;
      if (mandalFilter !== 'All' && lead.mandal !== mandalFilter) return false;

      if (statusFilter === 'Unallotted') return !lead.assignedTelecallerId;
      if (statusFilter === 'Allotted') return Boolean(lead.assignedTelecallerId);
      if (statusFilter !== 'All') return sameId(lead.assignedTelecallerId, statusFilter);
      return true;
    });
  }, [teamLeads, searchQuery, sourceFilter, mandalFilter, statusFilter]);

  /* ── Selection ────────────────────────────────────────────── */

  const someSelected = selectedIds.size > 0;
  const allInViewSelected =
    filteredTeamLeads.length > 0 && filteredTeamLeads.every((l) => selectedIds.has(l.id));

  const toggleSelectAll = () =>
    setSelectedIds(allInViewSelected ? new Set() : new Set(filteredTeamLeads.map((l) => l.id)));

  const toggleSelectLead = (id) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleSelectAllUnallotted = () => {
    setSelectedIds(new Set(teamLeads.filter((l) => !l.assignedTelecallerId).map((l) => l.id)));
    setStatusFilter('Unallotted');
  };

  /* ── Actions ──────────────────────────────────────────────── */

  const run = async (fn, failure) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      notifyChanged();
    } catch (err) {
      setActionError(errorMessage(err, failure));
    } finally {
      setBusy(false);
    }
  };

  const teamPayload = (team) => ({
    teamId: Number(team.id),
    teamLeaderId: Number(team.teamLeaderId),
    teamName: team.name,
  });

  /** Give leads to a caller — or, with no member, take them off their caller. */
  const executeAllotment = (leadIds, member) =>
    run(async () => {
      await agentLeadService.allot({
        leadIds,
        // No employeeId keeps the squad but frees the lead for someone else.
        ...(member ? { employeeId: Number(member.id) } : {}),
        ...teamPayload(currentTeam),
      });
      setSelectedIds(new Set());
      setNotice(
        member
          ? `${leadIds.length} lead${leadIds.length === 1 ? '' : 's'} allotted to ${member.name}.`
          : `${leadIds.length} lead${leadIds.length === 1 ? '' : 's'} returned to the squad pool.`
      );
    }, 'Could not allot these leads.');

  const handleTeamLeaderClick = (team) => {
    if (someSelected) {
      const ids = [...selectedIds];
      run(async () => {
        await agentLeadService.allot({ leadIds: ids, ...teamPayload(team) });
        setNotice(`Successfully moved ${ids.length} lead(s) to ${team.name}!`);
        setSelectedIds(new Set());
        setSelectedTeamId(String(team.id));
      }, 'Could not move the selected leads.');
    } else {
      setSelectedTeamId(String(team.id));
      setSelectedIds(new Set());
      setStatusFilter('Unallotted');
    }
  };

  const handleMemberClick = (member) => {
    if (someSelected) executeAllotment([...selectedIds], member);
    else setStatusFilter((prev) => (sameId(prev, member.id) ? 'All' : String(member.id)));
  };

  /** Round-robin whatever is still unallotted across the squad's callers. */
  const handleAllotEvenly = () => {
    const pool = teamLeads.filter((l) => !l.assignedTelecallerId);
    if (!pool.length || !teamMembers.length) return;

    run(async () => {
      // Grouped per caller so it is one request each rather than one per lead.
      const buckets = new Map();
      pool.forEach((lead, i) => {
        const member = teamMembers[i % teamMembers.length];
        if (!buckets.has(member.id)) buckets.set(member.id, []);
        buckets.get(member.id).push(lead.id);
      });

      for (const [memberId, ids] of buckets) {
        await agentLeadService.allot({
          leadIds: ids,
          employeeId: Number(memberId),
          ...teamPayload(currentTeam),
        });
      }

      setSelectedIds(new Set());
      setNotice(`${pool.length} lead(s) distributed evenly across ${buckets.size} caller(s).`);
    }, 'Could not distribute the leads.');
  };

  const selectClass =
    'px-2 py-1 bg-stone-50 rounded border border-stone-200 text-xs font-medium text-stone-700';

  if (rosterLoading) {
    return (
      <div className="bg-white border border-stone-200 rounded-lg py-16 flex items-center justify-center">
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-stone-500">
          <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading squads…
        </span>
      </div>
    );
  }

  if (!currentTeam) {
    return (
      <div className="p-8 bg-white rounded-lg border border-stone-200 text-center text-stone-500 text-xs">
        No recruitment squads found. Allot employees to a team leader in Agents → Management → Crew
        &amp; hierarchy.
      </div>
    );
  }

  const error = actionError || loadError || rosterError;
  const currentLabel = squadLabel(currentTeam);

  return (
    <div className="space-y-4">
      {/* Floating toast — fixed, so it never shifts the table */}
      {notice && (
        <div className="fixed bottom-5 right-5 z-[1300] px-4 py-2.5 bg-stone-900 text-white rounded-lg text-xs font-semibold flex items-center gap-2.5 shadow-xl border border-stone-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-stone-400 hover:text-white font-bold ml-1"
          >
            ✕
          </button>
        </div>
      )}

      <div className="w-full space-y-2.5">
        {/* ── Team leaders + the selected squad's callers ── */}
        <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs space-y-2.5">
          <div className="flex flex-col lg:flex-row items-stretch gap-3">
            {/* LEFT: team leaders */}
            <div className="shrink-0 space-y-1.5 lg:max-w-[420px]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-stone-700 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Team Leaders ({allTeamsSummary.length} Squads):</span>
                </span>
                <span className="text-[10px] text-stone-400 font-medium">Click to select</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {allTeamsSummary.map(({ team, leader, leadsCount, unallotted, shortName }) => {
                  const isSelected = sameId(team.id, currentTeam.id);
                  const leaderName = leader?.name || team.teamLeaderName;

                  return (
                    <button
                      key={team.id}
                      type="button"
                      disabled={busy}
                      onClick={() => handleTeamLeaderClick(team)}
                      className={`p-1.5 rounded-lg border text-left flex items-center gap-2 transition-all disabled:opacity-60 ${
                        isSelected
                          ? 'bg-blue-50/90 text-blue-900 border-blue-500 ring-2 ring-blue-400/40 shadow-2xs font-bold'
                          : 'bg-stone-50/80 hover:bg-stone-100 text-stone-700 border-stone-200/90 hover:border-stone-300'
                      }`}
                      title={`${team.name}\nLeader: ${leaderName}\n${unallotted} open of ${leadsCount} leads`}
                    >
                      <div className="relative shrink-0">
                        <PersonAvatar
                          name={leaderName}
                          photo={leader?.photo || team.teamLeaderPhoto}
                          size="sm"
                        />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${
                            isSelected ? 'bg-blue-600' : 'bg-emerald-500'
                          }`}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-xs truncate font-semibold leading-tight">
                          {shortName}
                        </div>
                        <div className="text-[10px] text-stone-500 font-normal truncate leading-tight">
                          {firstName(leaderName)} ·{' '}
                          <span
                            className={
                              unallotted > 0
                                ? 'text-blue-700 font-bold'
                                : 'text-emerald-700 font-medium'
                            }
                          >
                            {unallotted} open
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="hidden lg:flex flex-col items-center justify-center px-1">
              <div className="w-px h-full min-h-[64px] bg-stone-200" />
            </div>
            <div className="w-full h-px bg-stone-200 lg:hidden my-1" />

            {/* RIGHT: callers of the selected squad */}
            <div className="flex-1 min-w-0 space-y-1.5 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-bold text-stone-800 flex items-center gap-1.5 truncate">
                  <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>
                    {currentLabel} Executives ({teamMembers.length}):
                  </span>
                </span>
                <div className="flex items-center gap-1.5 text-[11px] font-mono shrink-0">
                  <span className="text-stone-500">
                    Total: <b className="text-stone-800">{teamStats.total}</b>
                  </span>
                  <span className="text-stone-300">|</span>
                  <span className="text-blue-700 font-bold">{teamStats.unallotted} Open</span>
                  <span className="text-stone-300">|</span>
                  <span className="text-emerald-700 font-semibold">
                    {teamStats.allotted} Allotted
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {teamMembers.length === 0 && (
                  <span className="text-[11px] text-stone-400">
                    This squad has no callers yet — add members in Management → Crew.
                  </span>
                )}

                {teamMembers.map((member) => {
                  const assignedCount = teamLeads.filter((l) =>
                    sameId(l.assignedTelecallerId, member.id)
                  ).length;
                  const isMemberFiltered = sameId(statusFilter, member.id);

                  return (
                    <button
                      key={member.id}
                      type="button"
                      disabled={busy}
                      onClick={() => handleMemberClick(member)}
                      className={`px-2 py-1 rounded-lg border flex items-center gap-1.5 transition-all text-left disabled:opacity-60 ${
                        someSelected
                          ? 'bg-blue-50/90 hover:bg-blue-100 border-blue-300 ring-2 ring-blue-300/60 shadow-2xs'
                          : isMemberFiltered
                          ? 'bg-blue-100 text-blue-900 border-blue-500 ring-2 ring-blue-400 font-bold shadow-2xs'
                          : 'bg-stone-50/80 border-stone-200 text-stone-800 hover:bg-stone-100 shadow-2xs'
                      }`}
                      title={
                        someSelected
                          ? `Click to allot ${selectedIds.size} lead(s) to ${member.name}`
                          : isMemberFiltered
                          ? `Filtering by ${member.name} (${assignedCount} leads). Click to show all.`
                          : `Click to view ${member.name}'s allotted leads (${assignedCount} leads)`
                      }
                    >
                      <PersonAvatar name={member.name} photo={member.photo} size="xs" />
                      <span className="text-xs font-semibold text-stone-800 truncate max-w-[120px]">
                        {member.name}
                      </span>
                      <span className="px-1.5 rounded-full text-[10px] font-mono font-bold bg-blue-100 text-blue-800 border border-blue-200 shrink-0">
                        {assignedCount} leads
                      </span>
                    </button>
                  );
                })}

                {teamStats.unallotted > 0 && teamMembers.length > 0 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleAllotEvenly}
                    title="Distribute unallotted team leads evenly across these executives"
                    className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold flex items-center gap-1 transition-colors shrink-0 ml-auto shadow-2xs disabled:opacity-60"
                  >
                    {busy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    )}
                    <span>Allot Evenly</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Leads workspace ─────────────────────────────── */}
        <div className="w-full space-y-3">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
          )}

          {/* Batch bar — only while something is ticked */}
          {someSelected && (
            <div className="p-2 px-3 rounded-lg bg-blue-50 border border-blue-300 flex items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-bold text-xs flex items-center gap-1 shadow-2xs">
                  <CheckSquare className="w-3.5 h-3.5" />
                  {selectedIds.size} Selected
                </span>
                <span className="text-stone-600 text-xs font-medium">Allot to:</span>
                <div className="flex items-center gap-1 flex-wrap">
                  {teamMembers.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      disabled={busy}
                      onClick={() => handleMemberClick(member)}
                      title={`Allot ${selectedIds.size} lead(s) to ${member.name}`}
                      className="inline-flex items-center gap-1 pl-1 pr-2 py-0.5 rounded-full bg-white hover:bg-blue-600 hover:text-white text-stone-800 border border-stone-200 text-xs font-medium shadow-2xs transition-colors disabled:opacity-50"
                    >
                      <PersonAvatar name={member.name} photo={member.photo} size="xs" />
                      <span>{firstName(member.name)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {teamStats.unallotted > 0 && teamMembers.length > 0 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleAllotEvenly}
                    title="Distribute unallotted team leads evenly in round-robin order"
                    className="px-2 py-0.5 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs flex items-center gap-1 border border-stone-200 shadow-2xs disabled:opacity-50"
                  >
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    Allot Evenly
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-xs text-stone-500 hover:text-stone-800 underline font-medium"
                >
                  Deselect all
                </button>
              </div>
            </div>
          )}

          {/* Search + quick tab filters */}
          <div className="bg-white p-3 rounded-lg border border-stone-200 shadow-2xs space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md bg-stone-50 px-2.5 py-1.5 rounded-md border border-stone-200">
                <Search className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search candidate name, phone, village..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-xs text-stone-800 placeholder-stone-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-stone-400 hover:text-stone-600 text-[10px]"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setStatusFilter('Unallotted')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                    statusFilter === 'Unallotted'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                  }`}
                >
                  <span>Unallotted</span>
                  <span
                    className={`px-1.5 rounded-full text-[10px] font-mono ${
                      statusFilter === 'Unallotted'
                        ? 'bg-blue-800 text-white'
                        : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    {teamStats.unallotted}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('All')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                    statusFilter === 'All'
                      ? 'bg-stone-900 text-white shadow-2xs'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                  }`}
                >
                  <span>All Team Leads</span>
                  <span
                    className={`px-1.5 rounded-full text-[10px] font-mono ${
                      statusFilter === 'All'
                        ? 'bg-stone-700 text-stone-200'
                        : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    {teamStats.total}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('Allotted')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                    statusFilter === 'Allotted'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                  }`}
                >
                  <span>Allotted</span>
                  <span
                    className={`px-1.5 rounded-full text-[10px] font-mono ${
                      statusFilter === 'Allotted'
                        ? 'bg-emerald-900 text-white'
                        : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    {teamStats.allotted}
                  </span>
                </button>

                {statusFilter !== 'Unallotted' &&
                  statusFilter !== 'All' &&
                  statusFilter !== 'Allotted' && (
                    <button
                      type="button"
                      onClick={() => setStatusFilter('All')}
                      title="Click to clear executive filter"
                      className="px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors bg-blue-600 text-white shadow-2xs"
                    >
                      <span>
                        Caller:{' '}
                        {teamMembers.find((m) => sameId(m.id, statusFilter))?.name || 'Filtered'}
                      </span>
                      <span className="text-[10px] bg-blue-800 rounded-full w-4 h-4 flex items-center justify-center">
                        ✕
                      </span>
                    </button>
                  )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-stone-100 text-xs text-stone-700">
              <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider flex items-center gap-1">
                <Filter className="w-3 h-3" /> Filters:
              </span>

              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className={selectClass}
              >
                <option value="All">All Sources</option>
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                value={mandalFilter}
                onChange={(e) => setMandalFilter(e.target.value)}
                className={selectClass}
              >
                <option value="All">All Mandals</option>
                {mandals.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              {teamStats.unallotted > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllUnallotted}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold ml-auto flex items-center gap-1"
                >
                  <CheckSquare className="w-3 h-3" /> Select All Unallotted ({teamStats.unallotted})
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg border border-stone-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto max-h-[calc(100vh-210px)] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 z-20 shadow-2xs">
                  <tr className="bg-stone-100 text-stone-700 font-semibold border-b border-stone-200 select-none">
                    <th className="p-2.5 w-10 text-center bg-stone-100">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="p-1 hover:bg-stone-200 rounded text-stone-600"
                        title={allInViewSelected ? 'Deselect all' : 'Select all'}
                      >
                        {allInViewSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : someSelected ? (
                          <div className="w-4 h-4 bg-blue-600 text-white rounded flex items-center justify-center text-[10px] font-bold">
                            -
                          </div>
                        ) : (
                          <Square className="w-4 h-4 text-stone-400" />
                        )}
                      </button>
                    </th>
                    <th className="p-2.5 w-10 text-center bg-stone-100">Photo</th>
                    <th className="p-2.5 bg-stone-100">Name</th>
                    <th className="p-2.5 bg-stone-100">Phone</th>
                    <th className="p-2.5 bg-stone-100">Village</th>
                    <th className="p-2.5 bg-stone-100">Mandal</th>
                    <th className="p-2.5 bg-stone-100">District</th>
                    <th className="p-2.5 bg-stone-100">Source</th>
                    <th className="p-2.5 text-center bg-stone-100 min-w-[270px]">
                      Allotted Member ({teamMembers.length} Telecallers)
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-stone-100">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="p-10 text-center text-stone-400">
                        <span className="inline-flex items-center gap-2 font-medium">
                          <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading…
                        </span>
                      </td>
                    </tr>
                  ) : filteredTeamLeads.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-stone-400">
                        {teamLeads.length === 0
                          ? 'No leads are attached to this squad yet — attach some in the Leads tab.'
                          : `No leads found matching current filter (${
                              statusFilter === 'Unallotted'
                                ? 'All leads in this team are currently allotted!'
                                : 'No matching leads'
                            }).`}
                      </td>
                    </tr>
                  ) : (
                    filteredTeamLeads.map((lead) => {
                      const isSelected = selectedIds.has(lead.id);

                      return (
                        <tr
                          key={lead.id}
                          onClick={() => openLead(lead)}
                          className={`hover:bg-stone-50/80 cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/40' : ''
                          }`}
                        >
                          <td
                            className="p-2.5 text-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectLead(lead.id);
                            }}
                          >
                            <button
                              type="button"
                              aria-label={`Select ${lead.name}`}
                              className="p-1 hover:bg-stone-200/60 rounded text-stone-600"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-blue-600" />
                              ) : (
                                <Square className="w-4 h-4 text-stone-300" />
                              )}
                            </button>
                          </td>

                          <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <PersonAvatar
                              name={lead.name}
                              photo={lead.photo}
                              size="xs"
                              className="mx-auto"
                            />
                          </td>

                          <td className="p-2.5 font-semibold text-stone-900">
                            <div className="flex items-center gap-1.5">
                              <span>{lead.name}</span>
                              {!lead.assignedTelecallerId && (
                                <span
                                  className="px-1.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800"
                                  title="Unallotted in team"
                                >
                                  New
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2.5 font-mono text-stone-700">{lead.phone}</td>
                          <td className="p-2.5 text-stone-800 font-medium">
                            {lead.nativeVillage || '—'}
                          </td>
                          <td className="p-2.5 text-stone-600">{lead.mandal || '—'}</td>
                          <td className="p-2.5 text-stone-600">{lead.district || '—'}</td>

                          <td className="p-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                                LEAD_SOURCE_TONES[lead.source] || LEAD_SOURCE_TONES.MyOperator
                              }`}
                            >
                              {lead.source}
                            </span>
                          </td>

                          {/* One avatar per caller: click to allot, click again to release */}
                          <td className="p-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex items-center gap-1 justify-center">
                              {teamMembers.map((member) => {
                                const isAllotted = sameId(lead.assignedTelecallerId, member.id);

                                return (
                                  <button
                                    key={member.id}
                                    type="button"
                                    disabled={busy}
                                    title={`${member.name} (Telecaller)${
                                      isAllotted
                                        ? ' — Allotted · Click to unallot back to pool'
                                        : ' — Click photo to allot'
                                    }`}
                                    onClick={() =>
                                      executeAllotment([lead.id], isAllotted ? null : member)
                                    }
                                    className={`relative p-0.5 rounded-full transition-all duration-150 disabled:opacity-50 ${
                                      isAllotted
                                        ? 'ring-2 ring-emerald-600 ring-offset-1 scale-110 shadow-xs z-10 bg-emerald-50'
                                        : 'opacity-75 hover:opacity-100 hover:scale-110 border border-stone-200 hover:border-emerald-400 bg-white'
                                    }`}
                                  >
                                    <PersonAvatar
                                      name={member.name}
                                      photo={member.photo}
                                      size="xs"
                                    />
                                    {isAllotted && (
                                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-600 border border-white rounded-full flex items-center justify-center shadow-2xs">
                                        <Check className="w-2 h-2 text-white stroke-[3]" />
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-2.5 bg-stone-50 border-t border-stone-200 text-xs text-stone-500 flex items-center justify-between">
              <span>
                Showing {filteredTeamLeads.length} of {teamLeads.length} leads in {currentTeam.name}
              </span>
              <span>Only members of this team can receive allotments.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
