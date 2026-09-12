import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Plus,
  Layers,
  Filter,
  Building2,
  TrendingUp,
  PanelRight,
  PanelRightClose,
  CheckCircle2,
  Check,
  Phone,
  Loader2,
  AlertTriangle,
  UserRound,
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
import AddLeadModal from './AddLeadModal';
import AddMultipleLeadsModal from './AddMultipleLeadsModal';
import CallWorkspaceModal from './CallWorkspaceModal';
import useAgentTeams from '../../../hooks/useAgentTeams';
import agentLeadService from '../../../services/agentLeadService';
import {
  LEAD_SOURCES,
  LEAD_SOURCE_TONES as SOURCE_TONES,
  normaliseLeadSource,
} from '../agentConstants';

/**
 * Level 1 of the recruitment desk: every live lead, and which squad it belongs
 * to.
 *
 * Attaching is done inline — one avatar per squad on every row, click to
 * attach, click again to detach. That is the whole job of this page; dialling
 * happens in Calls, distribution to individual callers in Allot Leads.
 */
export default function LeadsTab({ refresh }) {
  const { teams, employeeById, loading: teamsLoading } = useAgentTeams();

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [districtFilter, setDistrictFilter] = useState('All');
  const [mandalFilter, setMandalFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [teamFilter, setTeamFilter] = useState('All');

  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);
  const [showTeamsLineGraph, setShowTeamsLineGraph] = useState(true);

  const [showAddLead, setShowAddLead] = useState(false);
  const [showAddMultiple, setShowAddMultiple] = useState(false);

  // The shell`s universal Quick Add routes here and then asks this tab to open
  // its own create form, so the two stay in step without the shell needing to
  // know anything about lead fields.
  useEffect(() => {
    const onQuickAdd = (e) => {
      if (e.detail?.type === "agent") setShowAddLead(true);
    };
    window.addEventListener("garuda:quick-add", onQuickAdd);
    return () => window.removeEventListener("garuda:quick-add", onQuickAdd);
  }, []);
  const [callLead, setCallLead] = useState(null);
  const [notice, setNotice] = useState(null);
  const [attachingId, setAttachingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await agentLeadService.getLeads({});
      const list = data.result || data.data || [];
      setLeads(Array.isArray(list) ? list : []);
      setError(null);
    } catch (err) {
      console.error('Failed to load leads:', err);
      setLeads([]);
      setError('Could not load the lead pipeline.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Toast clears itself; it is confirmation, not something to dismiss.
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  /* ── Distribution ─────────────────────────────────────────── */

  const distribution = useMemo(() => {
    const unattached = leads.filter((l) => !l.assigned_team_id).length;
    const teamStats = teams.map((team) => ({
      team,
      leader: employeeById.get(String(team.teamLeaderId)),
      teamLeadCount: leads.filter(
        (l) => String(l.assigned_team_id) === String(team.id)
      ).length,
    }));

    return {
      unattachedCount: unattached,
      totalLeads: leads.length,
      teamStats,
      maxLeads: Math.max(1, unattached, ...teamStats.map((t) => t.teamLeadCount)),
    };
  }, [leads, teams, employeeById]);

  const chartData = useMemo(
    () =>
      distribution.teamStats.map(({ team, teamLeadCount, leader }) => ({
        name: team.shortName,
        fullName: team.name,
        leader: (leader?.name || team.teamLeaderName).split(' ')[0],
        photo: leader?.photo || team.teamLeaderPhoto || '',
        leads: teamLeadCount,
        teamId: team.id,
      })),
    [distribution]
  );

  /* ── Filtering ────────────────────────────────────────────── */

  const districts = useMemo(
    () => [...new Set(leads.map((l) => l.district).filter(Boolean))].sort(),
    [leads]
  );
  const mandals = useMemo(
    () =>
      [...new Set(
        leads
          .filter((l) => districtFilter === 'All' || l.district === districtFilter)
          .map((l) => l.mandal)
          .filter(Boolean)
      )].sort(),
    [leads, districtFilter]
  );

  const filteredLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesSearch =
        !q ||
        String(lead.name || '').toLowerCase().includes(q) ||
        String(lead.phone || '').includes(q) ||
        String(lead.village || '').toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (districtFilter !== 'All' && lead.district !== districtFilter) return false;
      if (mandalFilter !== 'All' && lead.mandal !== mandalFilter) return false;
      if (sourceFilter !== 'All' && normaliseLeadSource(lead.lead_source) !== sourceFilter)
        return false;

      if (teamFilter === 'Unattached') return !lead.assigned_team_id;
      if (teamFilter !== 'All')
        return String(lead.assigned_team_id) === String(teamFilter);

      return true;
    });
  }, [leads, searchQuery, districtFilter, mandalFilter, sourceFilter, teamFilter]);

  /* ── Attach / detach ──────────────────────────────────────── */

  const handleToggleTeam = async (lead, team) => {
    const isAttached = String(lead.assigned_team_id) === String(team.id);
    setAttachingId(lead.id);
    setError(null);
    try {
      if (isAttached) {
        // Detaching returns it to the unallotted pool, which clears the
        // telecaller too — a lead cannot belong to a caller but no squad.
        await agentLeadService.unallot([lead.id]);
        setNotice(`${lead.name} detached from ${team.name}.`);
      } else {
        await agentLeadService.allot({
          leadIds: [lead.id],
          employeeId: Number(team.teamLeaderId),
          teamLeaderId: Number(team.teamLeaderId),
          teamId: Number(team.id),
          teamName: team.name,
        });
        setNotice(`${lead.name} attached to ${team.name}.`);
      }
      await load();
      refresh?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change the squad attachment.');
    } finally {
      setAttachingId(null);
    }
  };

  const selectClass =
    'px-2 py-1 bg-stone-50 rounded border border-stone-200 text-xs font-medium text-stone-700 focus:bg-white';

  return (
    <div className="space-y-4">
      {/* Floating toast — fixed, so it never shifts the table */}
      {notice && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-2.5 bg-stone-900 text-white rounded-lg text-xs font-semibold flex items-center gap-2.5 shadow-xl border border-stone-700">
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        {/* ── Workspace ───────────────────────────────────── */}
        <div
          className={`${isSidePanelOpen ? 'lg:col-span-9' : 'lg:col-span-12'} space-y-3.5 transition-all`}
        >
          {/* Search + actions */}
          <div className="bg-white p-3 rounded-lg border border-stone-200 shadow-2xs space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-md bg-stone-50 px-2.5 py-1.5 rounded-md border border-stone-200">
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

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setIsSidePanelOpen((p) => !p)}
                  title={isSidePanelOpen ? 'Hide graph panel' : 'Show graph panel'}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    isSidePanelOpen
                      ? 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                      : 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100 shadow-2xs'
                  }`}
                >
                  {isSidePanelOpen ? (
                    <>
                      <PanelRightClose className="w-3.5 h-3.5 text-stone-500" />
                      <span className="hidden sm:inline">Hide Graph</span>
                    </>
                  ) : (
                    <>
                      <PanelRight className="w-3.5 h-3.5 text-blue-600" />
                      <span>Show Graph</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddLead(true)}
                  className="px-3 py-1.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />+ Add Lead
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddMultiple(true)}
                  className="px-3 py-1.5 rounded bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
                >
                  <Layers className="w-3.5 h-3.5 text-blue-400" />+ Add Multiple
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-stone-100 text-xs text-stone-700">
              <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider flex items-center gap-1">
                <Filter className="w-3 h-3" /> Filters:
              </span>

              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className={selectClass}
              >
                <option value="All">All Teams ({distribution.totalLeads})</option>
                <option value="Unattached">
                  Unattached Leads ({distribution.unattachedCount})
                </option>
                {distribution.teamStats.map(({ team, teamLeadCount }) => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({teamLeadCount})
                  </option>
                ))}
              </select>

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
                value={districtFilter}
                onChange={(e) => {
                  setDistrictFilter(e.target.value);
                  setMandalFilter('All');
                }}
                className={selectClass}
              >
                <option value="All">All Districts</option>
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
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
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-lg border border-stone-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto max-h-[calc(100vh-420px)]">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 z-20 shadow-2xs">
                  <tr className="bg-stone-100 text-stone-700 font-semibold border-b border-stone-200 select-none">
                    <th className="p-2.5 w-10 text-center bg-stone-100">Photo</th>
                    <th className="p-2.5 bg-stone-100">Name</th>
                    <th className="p-2.5 bg-stone-100">Phone</th>
                    <th className="p-2.5 bg-stone-100">Village</th>
                    <th className="p-2.5 bg-stone-100">Mandal</th>
                    <th className="p-2.5 bg-stone-100">District</th>
                    <th className="p-2.5 bg-stone-100">Source</th>
                    <th className="p-2.5 text-center bg-stone-100 min-w-[240px] w-64">
                      Attach to Team ({teams.length} Squad{teams.length === 1 ? '' : 's'})
                    </th>
                    <th className="p-2.5 text-right w-16 bg-stone-100">Call</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-stone-100">
                  {loading || teamsLoading ? (
                    <tr>
                      <td colSpan={9} className="p-10 text-center text-stone-400">
                        <span className="inline-flex items-center gap-2 font-medium">
                          <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading
                          leads…
                        </span>
                      </td>
                    </tr>
                  ) : filteredLeads.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-stone-400">
                        No leads match these filters.
                      </td>
                    </tr>
                  ) : (
                    filteredLeads.map((lead) => (
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

                        <td className="p-2.5 font-semibold text-stone-900">{lead.name}</td>
                        <td className="p-2.5 text-stone-700">{lead.phone}</td>
                        <td className="p-2.5 text-stone-800 font-medium">
                          {lead.village || '—'}
                        </td>
                        <td className="p-2.5 text-stone-600">{lead.mandal || '—'}</td>
                        <td className="p-2.5 text-stone-600">{lead.district || '—'}</td>

                        <td className="p-2.5">
                          {(() => {
                            const source = normaliseLeadSource(lead.lead_source);
                            return (
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                                  SOURCE_TONES[source] || SOURCE_TONES.MyOperator
                                }`}
                                title={
                                  source === lead.lead_source
                                    ? undefined
                                    : `Stored as "${lead.lead_source}"`
                                }
                              >
                                {source}
                              </span>
                            );
                          })()}
                        </td>

                        {/* Inline squad attachment */}
                        <td
                          className="p-2 text-center min-w-[240px] w-64"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {teams.length === 0 ? (
                            <span className="text-[10px] text-stone-400">
                              No squads configured
                            </span>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 justify-center px-2 py-1 bg-stone-50/80 rounded-lg border border-stone-200">
                              {teams.map((team, idx) => {
                                const isAttached =
                                  String(lead.assigned_team_id) === String(team.id);
                                const leader = employeeById.get(String(team.teamLeaderId));
                                const leaderName = leader?.name || team.teamLeaderName;

                                return (
                                  <button
                                    key={team.id}
                                    type="button"
                                    disabled={String(attachingId) === String(lead.id)}
                                    title={`Squad ${idx + 1}: ${team.name}\nTeam leader: ${leaderName}\n${
                                      isAttached
                                        ? '✓ Attached (click to detach)'
                                        : 'Click to attach this lead to the squad'
                                    }`}
                                    onClick={() => handleToggleTeam(lead, team)}
                                    className={`relative p-0.5 rounded-full transition-all duration-150 disabled:opacity-50 ${
                                      isAttached
                                        ? 'ring-2 ring-blue-600 ring-offset-1 scale-110 shadow-2xs z-10 bg-blue-50'
                                        : 'opacity-75 hover:opacity-100 hover:scale-110 border border-stone-200 hover:border-blue-400 bg-white'
                                    }`}
                                  >
                                    <PersonAvatar
                                      name={leaderName}
                                      photo={leader?.photo || team.teamLeaderPhoto}
                                      size="xs"
                                    />
                                    {isAttached && (
                                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-blue-600 border border-white rounded-full flex items-center justify-center shadow-2xs">
                                        <Check className="w-2 h-2 text-white stroke-[3]" />
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </td>

                        <td
                          className="p-2.5 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => setCallLead(lead)}
                            className="px-2.5 py-1 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-medium text-xs inline-flex items-center gap-1 shadow-2xs transition-colors"
                          >
                            <Phone className="w-3 h-3" />
                            Call
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-3 py-2 border-t border-stone-200 bg-stone-50/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500">
              <span>
                Showing {filteredLeads.length} of {leads.length} total agent leads
              </span>
              <span>
                Level 1: Leads attached to teams move to “Allot Leads” for caller
                distribution.
              </span>
            </div>
          </div>
        </div>

        {/* ── Distribution panel ──────────────────────────── */}
        {isSidePanelOpen && (
          <div className="lg:col-span-3 space-y-3 lg:sticky lg:top-0 lg:self-start transition-all">
            <div className="bg-white rounded-lg border border-stone-200 p-2.5 shadow-2xs space-y-2">
              <div className="border-b border-stone-100 pb-1.5 flex items-center justify-between">
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">Team Distribution</span>
                  </h3>
                  <p className="text-[10px] text-stone-500 mt-0.5 truncate">
                    {teams.length} Team{teams.length === 1 ? '' : 's'} Allotment
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] font-bold text-stone-600 px-1.5 py-0.5 bg-stone-100 rounded border border-stone-200">
                    {distribution.totalLeads}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsSidePanelOpen(false)}
                    title="Close panel"
                    className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                  >
                    <PanelRightClose className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Unattached */}
              <button
                type="button"
                onClick={() =>
                  setTeamFilter((prev) => (prev === 'Unattached' ? 'All' : 'Unattached'))
                }
                className={`w-full text-left p-2 rounded-lg border transition-all ${
                  teamFilter === 'Unattached'
                    ? 'bg-amber-100/80 border-amber-400 ring-1 ring-amber-400 shadow-2xs'
                    : 'bg-amber-50/60 border-amber-200 hover:bg-amber-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    Unattached Leads
                  </span>
                  <span className="text-xs font-bold text-amber-900 px-1.5 py-0.5 rounded bg-amber-100 border border-amber-300">
                    {distribution.unattachedCount}
                  </span>
                </div>
                <div className="w-full bg-amber-200/70 rounded-full h-1 mt-1.5 overflow-hidden">
                  <div
                    className="bg-amber-500 h-1 rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        distribution.totalLeads > 0
                          ? Math.min(
                              100,
                              (distribution.unattachedCount / distribution.totalLeads) * 100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </button>

              {/* Trend graph */}
              {showTeamsLineGraph && chartData.length > 0 && (
                <div className="p-2.5 rounded-lg border border-blue-200 bg-linear-to-b from-blue-50/50 to-white space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-stone-900 flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                      <span>Team Lead Allotment Trends</span>
                    </span>
                    <span className="text-[9px] text-stone-500">
                      {teams.length} Team{teams.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="h-42 w-full pt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartData}
                        margin={{ top: 5, right: 12, left: -24, bottom: 4 }}
                        onClick={(e) => {
                          const payload = e?.activePayload?.[0]?.payload;
                          if (payload?.teamId) {
                            setTeamFilter((prev) =>
                              prev === payload.teamId ? 'All' : payload.teamId
                            );
                          }
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={<GraphXAxisPhotoTick data={chartData} showBadge />}
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
                          formatter={(value) => [`${value} leads`, 'Attached leads']}
                          labelFormatter={(label, payload) => {
                            const item = payload?.[0]?.payload;
                            return item ? `${item.fullName} · TL: ${item.leader}` : label;
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="leads"
                          name="leads"
                          stroke="#2563eb"
                          strokeWidth={2.5}
                          dot={{ r: 3.5, fill: '#2563eb', stroke: '#fff', strokeWidth: 1.5 }}
                          activeDot={{ r: 5, fill: '#1d4ed8' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Squad cards */}
              <div className="pt-0.5">
                <div className="flex items-center justify-between mb-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  <span>Recruitment Teams ({teams.length})</span>
                  {chartData.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowTeamsLineGraph((p) => !p)}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 transition-colors"
                    >
                      <TrendingUp className="w-3 h-3" />
                      <span>{showTeamsLineGraph ? 'Hide Graph' : 'Line Graph'}</span>
                    </button>
                  )}
                </div>

                {teams.length === 0 ? (
                  <p className="text-[11px] text-stone-400 py-3 text-center">
                    No recruitment squads yet. Allot employees to a team leader in
                    Management → Crew.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {distribution.teamStats.map(({ team, teamLeadCount, leader }, idx) => {
                      const isFiltered = String(teamFilter) === String(team.id);
                      const percentage =
                        distribution.totalLeads > 0
                          ? Math.round((teamLeadCount / distribution.totalLeads) * 100)
                          : 0;

                      return (
                        <button
                          key={team.id}
                          type="button"
                          onClick={() => setTeamFilter(isFiltered ? 'All' : team.id)}
                          title={`${team.name}\nTL: ${leader?.name || team.teamLeaderName} (${teamLeadCount} leads)`}
                          className={`p-2 rounded-lg border transition-all flex flex-col justify-between text-left select-none ${
                            isFiltered
                              ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-300 shadow-2xs'
                              : 'bg-stone-50/60 hover:bg-stone-100/90 border-stone-200 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-start gap-1.5 min-w-0">
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
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-[11px] text-stone-900 truncate">
                                  {team.shortName}
                                </span>
                                <span className="text-[11px] font-bold text-[#2563EB] shrink-0 bg-white px-1 rounded border border-blue-200">
                                  {teamLeadCount}
                                </span>
                              </div>
                              <div className="text-[10px] text-stone-500 truncate mt-0.5">
                                TL: {(leader?.name || team.teamLeaderName).split(' ')[0]}
                              </div>
                            </div>
                          </div>

                          <div className="mt-1.5 space-y-0.5">
                            <div className="w-full bg-stone-200 rounded-full h-1 overflow-hidden">
                              <div
                                className="bg-[#2563EB] h-1 rounded-full transition-all duration-300"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    (teamLeadCount / distribution.maxLeads) * 100
                                  )}%`,
                                }}
                              />
                            </div>
                            <div className="flex justify-between text-[8px] text-stone-400">
                              <span>{percentage}% leads</span>
                              <span>{team.memberIds.length} mem</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showAddLead && (
        <AddLeadModal
          onClose={() => setShowAddLead(false)}
          onSaved={(name) => {
            setShowAddLead(false);
            setNotice(`New lead “${name}” created successfully.`);
            load();
            refresh?.();
          }}
        />
      )}

      {showAddMultiple && (
        <AddMultipleLeadsModal
          onClose={() => setShowAddMultiple(false)}
          onSaved={(count) => {
            setShowAddMultiple(false);
            setNotice(`${count} lead(s) created successfully.`);
            load();
            refresh?.();
          }}
        />
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
