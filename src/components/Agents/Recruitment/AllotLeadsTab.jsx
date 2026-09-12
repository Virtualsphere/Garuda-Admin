import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Filter,
  CheckSquare,
  Sparkles,
  Users2,
  Phone,
  Check,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  PanelRight,
  PanelRightClose,
  TrendingUp,
  UserRound,
  ArrowRightLeft,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import PersonAvatar from '../common/PersonAvatar';
import GraphXAxisPhotoTick from '../common/GraphXAxisPhotoTick';
import Modal, { ModalCallout, GhostButton } from '../common/Modal';
import CallWorkspaceModal from './CallWorkspaceModal';
import useAgentTeams from '../../../hooks/useAgentTeams';
import agentLeadService from '../../../services/agentLeadService';
import { LEAD_SOURCES, LEAD_SOURCE_TONES, normaliseLeadSource } from '../agentConstants';

/**
 * Level 2: distributing one squad's leads to the callers inside it.
 *
 * Level 1 (the Leads tab) decides which squad owns a lead; this decides who in
 * that squad dials it. The workspace is therefore scoped to a single team at a
 * time — switching teams switches the whole page.
 */
export default function AllotLeadsTab({ refresh }) {
  const { teams, employeeById, loading: teamsLoading } = useAgentTeams();

  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [leads, setLeads] = useState([]);
  const [allLeads, setAllLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const [selectedIds, setSelectedIds] = useState([]);
  const [statusFilter, setStatusFilter] = useState('Unallotted');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [mandalFilter, setMandalFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);
  const [workloadTab, setWorkloadTab] = useState('callers');
  const [busy, setBusy] = useState(false);
  const [callLead, setCallLead] = useState(null);
  const [moveConfirm, setMoveConfirm] = useState(null);

  // Default to the first squad once teams arrive.
  useEffect(() => {
    if (!selectedTeamId && teams.length) setSelectedTeamId(teams[0].id);
  }, [teams, selectedTeamId]);

  const currentTeam = useMemo(
    () => teams.find((t) => String(t.id) === String(selectedTeamId)) || null,
    [teams, selectedTeamId]
  );

  // The squad's callers. The leader is included — they dial too.
  const teamMembers = useMemo(() => {
    if (!currentTeam) return [];
    const leader = employeeById.get(String(currentTeam.teamLeaderId));
    const members = currentTeam.members || [];
    return leader && !members.some((m) => String(m.id) === String(leader.id))
      ? [leader, ...members]
      : members;
  }, [currentTeam, employeeById]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // The whole active pipeline, so the right-hand panel can compare squads
      // while the table shows only the selected one.
      const data = await agentLeadService.getLeads({});
      const list = data.result || data.data || [];
      setAllLeads(Array.isArray(list) ? list : []);
      setError(null);
    } catch (err) {
      console.error('Failed to load leads:', err);
      setAllLeads([]);
      setError('Could not load the allotment workspace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setLeads(
      allLeads.filter((l) => String(l.assigned_team_id) === String(selectedTeamId))
    );
    setSelectedIds([]);
  }, [allLeads, selectedTeamId]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  /* ── Stats ────────────────────────────────────────────────── */

  const teamStats = useMemo(() => {
    const unallotted = leads.filter((l) => !l.assigned_employee_id).length;
    return {
      total: leads.length,
      unallotted,
      allotted: leads.length - unallotted,
      byMember: teamMembers.map((m) => ({
        member: m,
        count: leads.filter((l) => String(l.assigned_employee_id) === String(m.id)).length,
      })),
    };
  }, [leads, teamMembers]);

  const allTeamsSummary = useMemo(
    () =>
      teams.map((team) => {
        const teamLeads = allLeads.filter(
          (l) => String(l.assigned_team_id) === String(team.id)
        );
        return {
          team,
          leader: employeeById.get(String(team.teamLeaderId)),
          total: teamLeads.length,
          unallotted: teamLeads.filter((l) => !l.assigned_employee_id).length,
        };
      }),
    [teams, allLeads, employeeById]
  );

  const leadersChartData = useMemo(
    () =>
      allTeamsSummary.map(({ team, leader, total }) => ({
        name: team.shortName,
        fullName: team.name,
        leader: (leader?.name || team.teamLeaderName).split(' ')[0],
        photo: leader?.photo || team.teamLeaderPhoto || '',
        leads: total,
        teamId: team.id,
      })),
    [allTeamsSummary]
  );

  const callersChartData = useMemo(
    () =>
      teamStats.byMember.map(({ member, count }) => ({
        name: member.name.split(' ')[0],
        fullName: member.name,
        leader: member.name.split(' ')[0],
        photo: member.photo || '',
        leads: count,
        memberId: member.id,
      })),
    [teamStats]
  );

  /* ── Filtering ────────────────────────────────────────────── */

  const mandals = useMemo(
    () => [...new Set(leads.map((l) => l.mandal).filter(Boolean))].sort(),
    [leads]
  );

  const filteredLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return leads.filter((lead) => {
      if (
        q &&
        !String(lead.name || '').toLowerCase().includes(q) &&
        !String(lead.phone || '').includes(q) &&
        !String(lead.village || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      if (sourceFilter !== 'All' && normaliseLeadSource(lead.lead_source) !== sourceFilter)
        return false;
      if (mandalFilter !== 'All' && lead.mandal !== mandalFilter) return false;

      if (statusFilter === 'Unallotted') return !lead.assigned_employee_id;
      if (statusFilter === 'Allotted') return Boolean(lead.assigned_employee_id);
      if (statusFilter !== 'All')
        return String(lead.assigned_employee_id) === String(statusFilter);
      return true;
    });
  }, [leads, searchQuery, sourceFilter, mandalFilter, statusFilter]);

  /* ── Allotment ────────────────────────────────────────────── */

  const runAllot = useCallback(
    async (leadIds, member) => {
      setBusy(true);
      setError(null);
      try {
        if (member) {
          await agentLeadService.allot({
            leadIds,
            employeeId: Number(member.id),
            teamId: Number(currentTeam.id),
            teamLeaderId: Number(currentTeam.teamLeaderId),
            teamName: currentTeam.name,
          });
          setNotice(`${leadIds.length} lead(s) allotted to ${member.name}.`);
        } else {
          // Unallot the caller but keep the squad — the lead stays at Level 2.
          await agentLeadService.allot({
            leadIds,
            teamId: Number(currentTeam.id),
            teamLeaderId: Number(currentTeam.teamLeaderId),
            teamName: currentTeam.name,
          });
          setNotice(`${leadIds.length} lead(s) returned to the squad pool.`);
        }
        setSelectedIds([]);
        setMoveConfirm(null);
        await load();
        refresh?.();
      } catch (err) {
        setError(err.response?.data?.message || 'Could not allot these leads.');
      } finally {
        setBusy(false);
      }
    },
    [currentTeam, load, refresh]
  );

  /** Moving leads that already have a caller is confirmed; fresh ones are not. */
  const handleMemberClick = (member) => {
    if (!selectedIds.length) {
      setStatusFilter((prev) => (prev === member.id ? 'All' : member.id));
      return;
    }

    const moving = leads.filter(
      (l) =>
        selectedIds.some((id) => String(id) === String(l.id)) &&
        l.assigned_employee_id &&
        String(l.assigned_employee_id) !== String(member.id)
    );

    if (moving.length) setMoveConfirm({ member, moving });
    else runAllot(selectedIds, member);
  };

  /** Round-robin whatever is still unallotted across the squad's callers. */
  const handleAllotEvenly = async () => {
    const pool = leads.filter((l) => !l.assigned_employee_id);
    if (!pool.length || !teamMembers.length) return;

    setBusy(true);
    setError(null);
    try {
      // Grouped per member so it is one request each rather than one per lead.
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
          teamId: Number(currentTeam.id),
          teamLeaderId: Number(currentTeam.teamLeaderId),
          teamName: currentTeam.name,
        });
      }

      setNotice(`${pool.length} lead(s) distributed evenly across ${buckets.size} caller(s).`);
      setSelectedIds([]);
      await load();
      refresh?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not distribute the leads.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id) =>
    setSelectedIds((prev) =>
      prev.some((x) => String(x) === String(id))
        ? prev.filter((x) => String(x) !== String(id))
        : [...prev, id]
    );

  const selectClass =
    'px-2 py-1 bg-stone-50 rounded border border-stone-200 text-xs font-medium text-stone-700 focus:bg-white';

  if (teamsLoading) {
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
        No recruitment squads found. Allot employees to a team leader in Agents →
        Management → Crew &amp; hierarchy.
      </div>
    );
  }

  const teamLeader = employeeById.get(String(currentTeam.teamLeaderId));

  return (
    <div className="space-y-4">
      {notice && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-2.5 bg-stone-900 text-white rounded-lg text-xs font-semibold flex items-center gap-2.5 shadow-xl border border-stone-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{notice}</span>
        </div>
      )}

      {/* Workspace header */}
      <div className="bg-white p-3 rounded-lg border border-stone-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 block">
              Level 2 · Team Telecaller Distribution Workspace:
            </span>
            <h2 className="text-xs font-bold text-stone-900 mt-0.5">
              Distribute this squad&apos;s leads to its callers
            </h2>
          </div>

          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="px-2 py-1 text-xs rounded bg-stone-100 hover:bg-stone-200/80 border border-stone-300 font-semibold text-stone-800"
          >
            {allTeamsSummary.map(({ team, total }) => (
              <option key={team.id} value={team.id}>
                {team.name} ({total})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-stone-50 border border-stone-200">
            <PersonAvatar
              name={teamLeader?.name || currentTeam.teamLeaderName}
              photo={teamLeader?.photo || currentTeam.teamLeaderPhoto}
              size="lg"
            />
            <div className="text-xs">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-stone-900 text-xs">
                  {teamLeader?.name || currentTeam.teamLeaderName}
                </span>
                <span className="text-[9px] px-1.5 rounded bg-amber-100 text-amber-900 font-bold border border-amber-300 shrink-0">
                  Team Leader
                </span>
              </div>
              <div className="text-[11px] text-stone-600 mt-0.5">
                <span className="font-bold text-stone-800">{teamMembers.length} Members</span> ·
                Total {teamStats.total} ·{' '}
                <span className="text-blue-700 font-bold">
                  Unallotted {teamStats.unallotted}
                </span>{' '}
                ·{' '}
                <span className="text-emerald-700 font-semibold">
                  Allotted {teamStats.allotted}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsSidePanelOpen((p) => !p)}
            title={isSidePanelOpen ? 'Hide workload panel' : 'Show workload panel'}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              isSidePanelOpen
                ? 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                : 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
            }`}
          >
            {isSidePanelOpen ? (
              <>
                <PanelRightClose className="w-3.5 h-3.5 text-stone-500" />
                <span className="hidden sm:inline">Hide Workload</span>
              </>
            ) : (
              <>
                <PanelRight className="w-3.5 h-3.5 text-blue-600" />
                <span>Show Workload</span>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        <div
          className={`${isSidePanelOpen ? 'lg:col-span-9' : 'lg:col-span-12'} space-y-3 transition-all`}
        >
          {/* Batch bar */}
          {selectedIds.length > 0 && (
            <div className="p-2 px-3 rounded-lg bg-blue-50 border border-blue-300 flex items-center justify-between gap-2 shadow-2xs flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-bold text-xs flex items-center gap-1 shadow-2xs">
                  <CheckSquare className="w-3.5 h-3.5" />
                  {selectedIds.length} Selected
                </span>
                <span className="text-stone-600 text-xs font-medium">Allot to:</span>
                <div className="flex items-center gap-1 flex-wrap">
                  {teamMembers.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      disabled={busy}
                      onClick={() => handleMemberClick(member)}
                      title={`Allot ${selectedIds.length} lead(s) to ${member.name}`}
                      className="inline-flex items-center gap-1 pl-1 pr-2 py-0.5 rounded-full bg-white hover:bg-blue-600 hover:text-white text-stone-800 border border-stone-200 text-xs font-medium shadow-2xs transition-colors disabled:opacity-50"
                    >
                      <PersonAvatar name={member.name} photo={member.photo} size="xs" />
                      <span>{member.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {teamStats.unallotted > 0 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleAllotEvenly}
                    title="Distribute unallotted squad leads evenly, round-robin"
                    className="px-2 py-0.5 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs flex items-center gap-1 border border-stone-200 disabled:opacity-50"
                  >
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    Allot Evenly
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="text-xs text-stone-500 hover:text-stone-800 underline font-medium"
                >
                  Deselect all
                </button>
              </div>
            </div>
          )}

          {/* Search + status chips */}
          <div className="bg-white p-3 rounded-lg border border-stone-200 shadow-2xs space-y-2.5">
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md bg-stone-50 px-2.5 py-1.5 rounded-md border border-stone-200">
                <Search className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search candidate name, phone, village..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-xs text-stone-800 placeholder-stone-400"
                />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <Chip
                  active={statusFilter === 'Unallotted'}
                  onClick={() => setStatusFilter('Unallotted')}
                  tone="blue"
                  count={teamStats.unallotted}
                >
                  Unallotted
                </Chip>
                <Chip
                  active={statusFilter === 'All'}
                  onClick={() => setStatusFilter('All')}
                  tone="stone"
                  count={teamStats.total}
                >
                  All Team Leads
                </Chip>
                <Chip
                  active={statusFilter === 'Allotted'}
                  onClick={() => setStatusFilter('Allotted')}
                  tone="emerald"
                  count={teamStats.allotted}
                >
                  Allotted
                </Chip>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-stone-100 text-xs">
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
                  onClick={() =>
                    setSelectedIds(
                      leads.filter((l) => !l.assigned_employee_id).map((l) => l.id)
                    )
                  }
                  className="ml-auto px-2 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100"
                >
                  Select all {teamStats.unallotted} unallotted
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg border border-stone-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto max-h-[calc(100vh-460px)]">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 z-20 shadow-2xs">
                  <tr className="bg-stone-100 text-stone-700 font-semibold border-b border-stone-200 select-none">
                    <th className="p-2.5 w-10 text-center bg-stone-100">
                      <input
                        type="checkbox"
                        checked={
                          filteredLeads.length > 0 &&
                          selectedIds.length === filteredLeads.length
                        }
                        onChange={() =>
                          setSelectedIds((prev) =>
                            prev.length === filteredLeads.length
                              ? []
                              : filteredLeads.map((l) => l.id)
                          )
                        }
                        aria-label="Select all"
                        className="accent-[#2563EB] cursor-pointer"
                      />
                    </th>
                    <th className="p-2.5 w-10 text-center bg-stone-100">Photo</th>
                    <th className="p-2.5 bg-stone-100">Name</th>
                    <th className="p-2.5 bg-stone-100">Phone</th>
                    <th className="p-2.5 bg-stone-100">Village</th>
                    <th className="p-2.5 bg-stone-100">Mandal</th>
                    <th className="p-2.5 bg-stone-100">Source</th>
                    <th className="p-2.5 text-center bg-stone-100 min-w-[200px]">
                      Allot to caller ({teamMembers.length})
                    </th>
                    <th className="p-2.5 text-right w-16 bg-stone-100">Call</th>
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
                  ) : filteredLeads.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-stone-400">
                        {leads.length === 0
                          ? 'No leads attached to this squad yet — attach some in the Leads tab.'
                          : 'No leads match these filters.'}
                      </td>
                    </tr>
                  ) : (
                    filteredLeads.map((lead) => {
                      const isSelected = selectedIds.some(
                        (id) => String(id) === String(lead.id)
                      );
                      const source = normaliseLeadSource(lead.lead_source);

                      return (
                        <tr
                          key={lead.id}
                          className={`transition-colors ${
                            isSelected ? 'bg-blue-50/60' : 'hover:bg-stone-50'
                          }`}
                        >
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggle(lead.id)}
                              aria-label={`Select ${lead.name}`}
                              className="accent-[#2563EB] cursor-pointer"
                            />
                          </td>

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

                          <td className="p-2.5 font-semibold text-stone-900">{lead.name}</td>
                          <td className="p-2.5 text-stone-700">{lead.phone}</td>
                          <td className="p-2.5 text-stone-800 font-medium">
                            {lead.village || '—'}
                          </td>
                          <td className="p-2.5 text-stone-600">{lead.mandal || '—'}</td>

                          <td className="p-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                                LEAD_SOURCE_TONES[source] || LEAD_SOURCE_TONES.MyOperator
                              }`}
                            >
                              {source}
                            </span>
                          </td>

                          <td
                            className="p-1.5 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center gap-1 justify-center">
                              {teamMembers.map((member) => {
                                const isAllotted =
                                  String(lead.assigned_employee_id) === String(member.id);
                                return (
                                  <button
                                    key={member.id}
                                    type="button"
                                    disabled={busy}
                                    title={`${member.name} (telecaller)${
                                      isAllotted
                                        ? ' — allotted · click to return to the squad pool'
                                        : ' — click to allot'
                                    }`}
                                    onClick={() =>
                                      runAllot([lead.id], isAllotted ? null : member)
                                    }
                                    className={`relative p-0.5 rounded-full transition-all duration-150 disabled:opacity-50 ${
                                      isAllotted
                                        ? 'ring-2 ring-emerald-600 ring-offset-1 scale-110 shadow-2xs z-10 bg-emerald-50'
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

                          <td
                            className="p-2.5 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
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

            <div className="px-3 py-2 border-t border-stone-200 bg-stone-50/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500">
              <span>
                Showing {filteredLeads.length} of {leads.length} leads in{' '}
                {currentTeam.name}
              </span>
              <span>Level 2: Allotted leads appear in that caller&apos;s Calls queue.</span>
            </div>
          </div>
        </div>

        {/* ── Workload panel ─────────────────────────────── */}
        {isSidePanelOpen && (
          <div className="lg:col-span-3 space-y-3 lg:sticky lg:top-0 lg:self-start">
            <div className="bg-white rounded-lg border border-stone-200 p-2.5 shadow-2xs space-y-2">
              <div className="border-b border-stone-100 pb-1.5 flex items-center justify-between">
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Users2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="truncate">Team Workload</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsSidePanelOpen(false)}
                  title="Close panel"
                  className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                >
                  <PanelRightClose className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* View switcher */}
              <div className="inline-flex rounded-lg border border-stone-200 p-0.5 bg-stone-100 w-full">
                {[
                  { key: 'leaders', label: 'Leaders' },
                  { key: 'callers', label: 'Callers' },
                  { key: 'graph', label: 'Graph' },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setWorkloadTab(t.key)}
                    className={`flex-1 px-2 py-1 text-[11px] font-semibold rounded-md ${
                      workloadTab === t.key
                        ? 'bg-white text-[#2563EB] shadow-2xs'
                        : 'text-stone-600'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Leaders */}
              {workloadTab === 'leaders' && (
                <div className="space-y-1.5">
                  {allTeamsSummary.map(({ team, leader, total, unallotted }, idx) => (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => setSelectedTeamId(team.id)}
                      className={`w-full text-left p-2 rounded-lg border transition-all flex items-center gap-2 ${
                        String(selectedTeamId) === String(team.id)
                          ? 'bg-blue-50/90 border-blue-500 ring-1 ring-blue-300'
                          : 'bg-stone-50/60 hover:bg-stone-100 border-stone-200'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <PersonAvatar
                          name={leader?.name || team.teamLeaderName}
                          photo={leader?.photo || team.teamLeaderPhoto}
                          size="sm"
                        />
                        <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-stone-100 border border-stone-300 rounded-full flex items-center justify-center text-[7px] font-bold text-stone-700">
                          {idx + 1}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-[11px] text-stone-900 truncate">
                          {team.shortName} · {(leader?.name || team.teamLeaderName).split(' ')[0]}
                        </div>
                        <div className="text-[10px] text-stone-500">
                          {total} leads · {unallotted} unallotted
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-[#2563EB] shrink-0">
                        {total}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Callers */}
              {workloadTab === 'callers' && (
                <div className="space-y-1.5">
                  {teamMembers.length === 0 ? (
                    <p className="text-[11px] text-stone-400 py-3 text-center">
                      This squad has no members yet.
                    </p>
                  ) : (
                    teamStats.byMember.map(({ member, count }) => {
                      const share =
                        teamStats.total > 0 ? Math.round((count / teamStats.total) * 100) : 0;
                      const isFiltered = String(statusFilter) === String(member.id);
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => handleMemberClick(member)}
                          title={
                            selectedIds.length
                              ? `Allot ${selectedIds.length} selected lead(s) to ${member.name}`
                              : `Show only ${member.name}'s leads`
                          }
                          className={`w-full text-left p-2 rounded-lg border transition-all ${
                            isFiltered
                              ? 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-300'
                              : 'bg-stone-50/60 hover:bg-stone-100 border-stone-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <PersonAvatar name={member.name} photo={member.photo} size="sm" />
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-[11px] text-stone-900 truncate">
                                {member.name}
                              </div>
                              <div className="text-[10px] text-stone-500">
                                {member.role || 'Telecaller'}
                              </div>
                            </div>
                            <span className="text-[11px] font-bold text-emerald-700 shrink-0">
                              {count}
                            </span>
                          </div>
                          <div className="w-full bg-stone-200 rounded-full h-1 mt-1.5 overflow-hidden">
                            <div
                              className="bg-emerald-600 h-1 rounded-full transition-all"
                              style={{ width: `${share}%` }}
                            />
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {/* Graph */}
              {workloadTab === 'graph' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <MiniMetric label="Total" value={teamStats.total} />
                    <MiniMetric label="Unallot." value={teamStats.unallotted} tone="blue" />
                    <MiniMetric label="Allotted" value={teamStats.allotted} tone="emerald" />
                  </div>

                  <div className="p-2 rounded-lg border border-blue-200 bg-linear-to-b from-blue-50/50 to-white">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-stone-900 mb-1">
                      <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                      Caller allotment
                    </div>
                    <div className="h-40 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={callersChartData.length ? callersChartData : leadersChartData}
                          margin={{ top: 5, right: 12, left: -24, bottom: 4 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#f1f5f9"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="name"
                            tick={
                              <GraphXAxisPhotoTick
                                data={
                                  callersChartData.length
                                    ? callersChartData
                                    : leadersChartData
                                }
                              />
                            }
                            interval={0}
                            height={44}
                            tickLine={false}
                            axisLine={{ stroke: '#cbd5e1' }}
                          />
                          <YAxis
                            tick={{ fontSize: 9, fill: '#64748b' }}
                            tickLine={false}
                            axisLine={{ stroke: '#cbd5e1' }}
                            allowDecimals={false}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#0f172a',
                              borderColor: '#334155',
                              borderRadius: '0.5rem',
                              color: '#fff',
                              fontSize: '11px',
                              padding: '6px 10px',
                            }}
                            formatter={(value) => [`${value} leads`, 'Allotted']}
                          />
                          <Line
                            type="monotone"
                            dataKey="leads"
                            stroke="#2563eb"
                            strokeWidth={2.5}
                            dot={{ r: 3.5, fill: '#2563eb', stroke: '#fff', strokeWidth: 1.5 }}
                            activeDot={{ r: 5, fill: '#1d4ed8' }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* Allot evenly */}
              {teamStats.unallotted > 0 && teamMembers.length > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleAllotEvenly}
                  className="w-full px-2.5 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  Allot {teamStats.unallotted} evenly
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Move confirmation */}
      {moveConfirm && (
        <Modal
          title="Move allotted leads?"
          subtitle={`${moveConfirm.moving.length} lead(s) already have a caller`}
          size="sm"
          onClose={() => setMoveConfirm(null)}
          footer={
            <>
              <GhostButton onClick={() => setMoveConfirm(null)}>Cancel</GhostButton>
              <button
                type="button"
                disabled={busy}
                onClick={() => runAllot(selectedIds, moveConfirm.member)}
                className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-bold hover:bg-[#1D4ED8] disabled:opacity-40 inline-flex items-center gap-1.5"
              >
                {busy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                )}
                Move to {moveConfirm.member.name.split(' ')[0]}
              </button>
            </>
          }
        >
          <ModalCallout tone="amber">
            These leads are already being worked by another caller. Moving them
            transfers the work — their call history stays with the lead.
          </ModalCallout>

          <div className="max-h-56 overflow-y-auto border border-stone-200 rounded-lg divide-y divide-stone-100">
            {moveConfirm.moving.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
              >
                <span className="font-semibold text-stone-900 truncate">{lead.name}</span>
                <span className="text-stone-500 shrink-0">
                  {lead.assignedTelecaller?.name || 'Unknown'} →{' '}
                  <strong className="text-[#2563EB]">
                    {moveConfirm.member.name.split(' ')[0]}
                  </strong>
                </span>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {callLead && (
        <CallWorkspaceModal
          lead={callLead}
          queue="first-call"
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

const CHIP_TONES = {
  blue: 'bg-[#2563EB] text-white border-[#2563EB]',
  stone: 'bg-stone-800 text-white border-stone-800',
  emerald: 'bg-emerald-700 text-white border-emerald-700',
};

function Chip({ active, onClick, tone, count, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
        active ? CHIP_TONES[tone] : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
      }`}
    >
      <span>{children}</span>
      <span
        className={`px-1.5 rounded-full text-[10px] font-bold ${
          active ? 'bg-white/25 text-white' : 'bg-stone-200 text-stone-700'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function MiniMetric({ label, value, tone }) {
  const tones = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  };
  return (
    <div className={`rounded-lg border py-1.5 ${tones[tone] || 'bg-stone-50 border-stone-200 text-stone-800'}`}>
      <div className="text-sm font-black leading-none">{value}</div>
      <div className="text-[8px] font-bold uppercase tracking-wider mt-1 opacity-70">
        {label}
      </div>
    </div>
  );
}
