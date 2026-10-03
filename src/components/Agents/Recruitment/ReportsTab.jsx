import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  PhoneCall,
  Users,
  CheckCircle2,
  Calendar,
  Building2,
  Search,
  Download,
  Clock,
  ChevronRight,
  Headphones,
  Sparkles,
  UserCheck,
  X,
  BadgeAlert,
  TrendingUp,
  Award,
  ChevronDown,
  ChevronUp,
  BarChart2,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

import PersonAvatar from '../common/PersonAvatar';
import { useRecruitmentDesk } from '../../../hooks/useRecruitmentDesk';
import agentLeadService from '../../../services/agentLeadService';
import { errorMessage, isMissingEndpoint, BACKEND_UPDATE_HINT } from '../../../utils/apiErrors';
import { squadLabel, firstName, sameId, stampOf } from './recruitmentModel';

const empCode = (id) => `EMP-${String(id).padStart(3, '0')}`;
const minutesLabel = (mins) => `${Math.floor(mins / 60)}h ${mins % 60}m`;

const SORTS = [
  { key: 'connected', label: 'Connected' },
  { key: 'interested', label: 'Interested' },
  { key: 'visits', label: 'Visits' },
  { key: 'onboarded', label: 'Onboarded' },
];

const SORT_VALUE = {
  connected: (m) => m.connectedCallsCount,
  interested: (m) => m.interestedCount,
  visits: (m) => m.visitsScheduledCount,
  onboarded: (m) => m.onboardedCount,
};

const CADENCES = [
  { key: 'daily', label: 'Daily (7 Days)' },
  { key: 'weekly', label: 'Weekly (4 Weeks)' },
  { key: 'monthly', label: 'Monthly (6 Months)' },
];

const CADENCE_TITLES = {
  daily: 'Daily Calling & Conversion Volume (Last 7 Days)',
  weekly: 'Weekly Productivity Trend (Last 4 Weeks)',
  monthly: 'Monthly Aggregate Trajectory (Last 6 Months)',
};

const AXIS_TICK = { fill: '#4B5563', fontSize: 11, fontWeight: 500 };

/** Module-level so Recharts is not handed a new component type on every render. */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white p-3 rounded-lg border border-stone-200 shadow-lg text-xs space-y-1.5 min-w-[170px]">
      <p className="font-bold text-stone-900 border-b border-stone-100 pb-1">{label}</p>
      {payload.map((item) => (
        <div key={item.dataKey} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-stone-600">
            <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: item.color }} />
            <span>{item.name}:</span>
          </span>
          <span className="font-mono font-bold text-stone-900">{item.value}</span>
        </div>
      ))}
      <p className="text-[10px] text-stone-400 pt-1 border-t border-stone-100 mt-1">
        *Answered / connected only
      </p>
    </div>
  );
}

/**
 * Reports: every recruitment squad member's working numbers on one page.
 *
 * Only *answered* calls count as productive — a dial nobody picked up is left
 * out of "connected" and of talk time, on the server as well as in the labels.
 * The figures are aggregated in SQL (`GET /agent-lead/report`), so this page
 * receives one row per person plus the daily / weekly / monthly cadence rather
 * than every call attempt.
 *
 * The squads come from the desk, the numbers from the report, and the two are
 * joined here: somebody who has worked leads but sits in no squad still gets a
 * row, under "Unassigned".
 */
export default function ReportsTab() {
  const { teams, employeeById, version } = useRecruitmentDesk();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedTeamFilter, setSelectedTeamFilter] = useState('All');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('connected');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedMember, setSelectedMember] = useState(null);

  const [chartsOpen, setChartsOpen] = useState(true);
  const [activeChartView, setActiveChartView] = useState('team-comparison');
  const [cadenceView, setCadenceView] = useState('daily');
  const [metricFocus, setMetricFocus] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await agentLeadService.getReport();
      setReport(data.result || data.data || null);
      setError(null);
    } catch (err) {
      console.error('Failed to load recruitment report:', err);
      setReport(null);
      setError(
        isMissingEndpoint(err)
          ? BACKEND_UPDATE_HINT
          : errorMessage(err, 'Could not load the working reports.')
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, version]);

  /* ── One row per person ───────────────────────────────────── */

  const membersReports = useMemo(() => {
    const stats = new Map((report?.members || []).map((m) => [String(m.employee_id), m]));
    const people = new Map();

    teams.forEach((team) => {
      if (team.teamLeaderId && !people.has(String(team.teamLeaderId))) {
        people.set(String(team.teamLeaderId), { team, isTL: true });
      }
      (team.memberIds || []).forEach((id) => {
        if (!people.has(String(id))) people.set(String(id), { team, isTL: false });
      });
    });

    // Worked leads but belongs to no squad: still report them.
    stats.forEach((_, id) => {
      if (!people.has(id)) people.set(id, { team: null, isTL: false });
    });

    const rows = [];
    people.forEach(({ team, isTL }, id) => {
      const employee = employeeById.get(id);
      const s = stats.get(id) || {};
      const connected = s.connected || 0;
      const interested = s.interested || 0;

      rows.push({
        id,
        name: employee?.name || s.employee_name || `Employee #${id}`,
        photo: employee?.photo,
        role: isTL ? 'Team Leader' : employee?.role || 'Calling Executive',
        isTeamLeader: isTL,
        teamId: team ? String(team.id) : 'unassigned',
        teamName: team ? team.name : 'Unassigned',
        // A team leader's workload is the squad's leads, not just their own.
        assignedLeadsCount: isTL ? s.team_leads || 0 : s.assigned_leads || 0,
        connectedCallsCount: connected,
        totalTalkMinutes: Math.round((s.talk_seconds || 0) / 60),
        interestedCount: interested,
        tlEscalationsCount: isTL ? s.escalations_handled || 0 : s.escalations_raised || 0,
        visitsScheduledCount: s.visits || 0,
        onboardedCount: s.onboarded || 0,
        conversionRate: connected > 0 ? Math.min(100, Math.round((interested / connected) * 100)) : 0,
      });
    });

    return rows;
  }, [report, teams, employeeById]);

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const valueOf = SORT_VALUE[sortBy] || SORT_VALUE.connected;

    return membersReports
      .filter((m) => {
        if (selectedTeamFilter !== 'All' && !sameId(m.teamId, selectedTeamFilter)) return false;
        if (selectedRoleFilter === 'telecaller' && m.isTeamLeader) return false;
        if (selectedRoleFilter === 'leader' && !m.isTeamLeader) return false;
        if (!q) return true;
        return (
          m.name.toLowerCase().includes(q) ||
          empCode(m.id).toLowerCase().includes(q) ||
          m.teamName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (sortOrder === 'desc' ? valueOf(b) - valueOf(a) : valueOf(a) - valueOf(b)));
  }, [membersReports, selectedTeamFilter, selectedRoleFilter, searchQuery, sortBy, sortOrder]);

  const totals = useMemo(() => {
    const sum = (pick) => filteredMembers.reduce((acc, m) => acc + pick(m), 0);
    const mins = sum((m) => m.totalTalkMinutes);
    return {
      connected: sum((m) => m.connectedCallsCount),
      talk: `${Math.floor(mins / 60)}h ${mins % 60}m`,
      interested: sum((m) => m.interestedCount),
      visits: sum((m) => m.visitsScheduledCount),
      onboarded: sum((m) => m.onboardedCount),
    };
  }, [filteredMembers]);

  /* ── Chart data ───────────────────────────────────────────── */

  const teamComparisonChartData = useMemo(
    () =>
      teams.map((team) => {
        const squad = membersReports.filter((m) => sameId(m.teamId, team.id));
        const sum = (pick) => squad.reduce((acc, m) => acc + pick(m), 0);
        return {
          id: team.id,
          label: `${squadLabel(team)} (${firstName(team.teamLeaderName)})`,
          connectedCalls: sum((m) => m.connectedCallsCount),
          interested: sum((m) => m.interestedCount),
          visits: sum((m) => m.visitsScheduledCount),
          onboarded: sum((m) => m.onboardedCount),
        };
      }),
    [teams, membersReports]
  );

  const cadenceChartData = useMemo(
    () => report?.cadence?.[cadenceView] || [],
    [report, cadenceView]
  );

  const topMembersChartData = useMemo(
    () =>
      filteredMembers.slice(0, 8).map((m) => {
        const parts = m.name.split(' ');
        return {
          name: `${parts[0]}${parts[1] ? ` ${parts[1][0]}.` : ''}`,
          connectedCalls: m.connectedCallsCount,
          interested: m.interestedCount,
          onboarded: m.onboardedCount,
        };
      }),
    [filteredMembers]
  );

  /* ── Actions ──────────────────────────────────────────────── */

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(key);
      setSortOrder('desc');
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Employee ID',
      'Member Name',
      'Role',
      'Squad / Team',
      'Assigned Leads',
      'Connected Calls (Answered Only)',
      'Talk Time (Mins)',
      'Pitch Interested',
      'TL Escalations',
      'Visits Scheduled',
      'Onboarded Franchise Agents',
      'Connect-to-Interest %',
    ];
    const quote = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = filteredMembers.map((m) => [
      empCode(m.id),
      quote(m.name),
      quote(m.role),
      quote(m.teamName),
      m.assignedLeadsCount,
      m.connectedCallsCount,
      m.totalTalkMinutes,
      m.interestedCount,
      m.tlEscalationsCount,
      m.visitsScheduledCount,
      m.onboardedCount,
      `${m.conversionRate}%`,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `Agents_Recruitment_Working_Reports_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const squadCount = teams.length;
  const showMetric = (key) => metricFocus === 'all' || metricFocus === key;

  return (
    <div className="space-y-4 text-xs font-sans text-stone-900 pb-12">
      {/* Header */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-stone-900 tracking-tight">
              Recruitment Team Working Reports &amp; Analytics
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-blue-600" />
              <span>
                {filteredMembers.length} Members Across {squadCount}{' '}
                {squadCount === 1 ? 'Squad' : 'Squads'}
              </span>
            </span>
          </div>
          <p className="text-stone-500 text-xs mt-0.5">
            Real-time individual performance across all recruitment squads. Strictly tracking
            productive, connected interactions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-50 text-stone-600 border border-stone-200 text-[11px] font-medium">
            <BadgeAlert className="w-3.5 h-3.5 text-stone-400" />
            <span>Unanswered &amp; Not Connected Dials Ignored</span>
          </div>

          <button
            type="button"
            onClick={() => setChartsOpen(!chartsOpen)}
            title="Toggle analytics charts"
            className="px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <BarChart2 className="w-3.5 h-3.5 text-blue-600" />
            <span>{chartsOpen ? 'Hide Charts' : 'Show Charts'}</span>
            {chartsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            title="Download CSV report"
            className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <div className="bg-white p-3 rounded-lg border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-semibold mb-1">
            <span>Connected Calls</span>
            <PhoneCall className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-stone-900">{totals.connected}</div>
          <div className="text-[10px] text-stone-400 mt-0.5">Answered interactions</div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-semibold mb-1">
            <span>Productive Talk Time</span>
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-800">{totals.talk}</div>
          <div className="text-[10px] text-stone-400 mt-0.5">Total conversation duration</div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-semibold mb-1">
            <span>Interested Candidates</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-blue-700">{totals.interested}</div>
          <div className="text-[10px] text-stone-400 mt-0.5">Franchise pitch accepted</div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-semibold mb-1">
            <span>Visits Scheduled</span>
            <Calendar className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-800">{totals.visits}</div>
          <div className="text-[10px] text-stone-400 mt-0.5">Branch interviews booked</div>
        </div>

        <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/20 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-emerald-800 text-[11px] font-semibold mb-1">
            <span>Agents Onboarded</span>
            <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-800">{totals.onboarded}</div>
          <div className="text-[10px] text-emerald-600 mt-0.5">Franchise deposit collected</div>
        </div>
      </div>

      {/* Charts */}
      {chartsOpen && (
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
            <div className="flex items-center gap-1 bg-stone-100 p-0.5 rounded-lg">
              {[
                { key: 'team-comparison', label: 'Team-Wise Comparison', icon: Building2 },
                { key: 'time-cadence', label: 'Daily / Weekly / Monthly', icon: TrendingUp },
                { key: 'top-members', label: 'Top Performers', icon: Award },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveChartView(key)}
                  className={`px-3 py-1.5 rounded-md font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
                    activeChartView === key
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {activeChartView === 'time-cadence' && (
                <div className="flex items-center gap-1 bg-stone-50 border border-stone-200 p-0.5 rounded-md">
                  {CADENCES.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setCadenceView(c.key)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                        cadenceView === c.key
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1 bg-stone-50 border border-stone-200 rounded-md px-2 py-1">
                <span className="text-[11px] font-medium text-stone-500">Metric:</span>
                <select
                  value={metricFocus}
                  onChange={(e) => setMetricFocus(e.target.value)}
                  className="bg-transparent text-stone-800 text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="all">All Productive Metrics</option>
                  <option value="connected">Connected Calls Only</option>
                  <option value="interested">Pitch Accepted Only</option>
                  <option value="onboarded">Onboarded Agents Only</option>
                </select>
              </div>
            </div>
          </div>

          {loading && !report ? (
            <div className="h-72 flex items-center justify-center text-stone-400 font-medium gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading analytics…
            </div>
          ) : (
            <>
              {activeChartView === 'team-comparison' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-stone-600">
                    <span className="font-semibold text-xs flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>
                        Squad-by-Squad Output Comparison (All {squadCount} Recruitment{' '}
                        {squadCount === 1 ? 'Squad' : 'Squads'})
                      </span>
                    </span>
                    <span className="text-[11px] text-stone-400">
                      Excludes not lifted &amp; invalid attempts
                    </span>
                  </div>

                  <div className="h-72 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={teamComparisonChartData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis
                          dataKey="label"
                          tick={AXIS_TICK}
                          interval={0}
                          angle={-15}
                          textAnchor="end"
                        />
                        <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} allowDecimals={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                        {showMetric('connected') && (
                          <Bar
                            dataKey="connectedCalls"
                            name="Connected Calls (Answered)"
                            fill="#2563EB"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={40}
                          />
                        )}
                        {showMetric('interested') && (
                          <Bar
                            dataKey="interested"
                            name="Pitch Accepted / Interested"
                            fill="#059669"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={40}
                          />
                        )}
                        {metricFocus === 'all' && (
                          <Bar
                            dataKey="visits"
                            name="Office Visits Fixed"
                            fill="#7C3AED"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={40}
                          />
                        )}
                        {showMetric('onboarded') && (
                          <Bar
                            dataKey="onboarded"
                            name="Onboarded Franchise Agents"
                            fill="#D97706"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={40}
                          />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {activeChartView === 'time-cadence' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-stone-600">
                    <span className="font-semibold text-xs flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{CADENCE_TITLES[cadenceView]}</span>
                    </span>
                    <span className="text-[11px] text-stone-400">
                      Focusing strictly on productive candidate discussions
                    </span>
                  </div>

                  <div className="h-72 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={cadenceChartData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="label" tick={AXIS_TICK} />
                        <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} allowDecimals={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                        {showMetric('connected') && (
                          <Bar
                            dataKey="connected"
                            name="Connected Calls (Answered)"
                            fill="#2563EB"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={45}
                          />
                        )}
                        {showMetric('interested') && (
                          <Bar
                            dataKey="interested"
                            name="Pitch Accepted / Interested"
                            fill="#059669"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={45}
                          />
                        )}
                        {metricFocus === 'all' && (
                          <Bar
                            dataKey="visits"
                            name="Visits Fixed"
                            fill="#7C3AED"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={45}
                          />
                        )}
                        {showMetric('onboarded') && (
                          <Bar
                            dataKey="onboarded"
                            name="Onboarded Agents"
                            fill="#D97706"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={45}
                          />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {activeChartView === 'top-members' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-stone-600">
                    <span className="font-semibold text-xs flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-amber-600" />
                      <span>Top Productive Members Comparison</span>
                    </span>
                    <span className="text-[11px] text-stone-400">
                      Ranked by verified answered discussions and conversions
                    </span>
                  </div>

                  <div className="h-72 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={topMembersChartData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: '#4B5563', fontSize: 11, fontWeight: 600 }}
                        />
                        <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} allowDecimals={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                        <Bar
                          dataKey="connectedCalls"
                          name="Connected Calls"
                          fill="#2563EB"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={35}
                        />
                        <Bar
                          dataKey="interested"
                          name="Interested Converted"
                          fill="#059669"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={35}
                        />
                        <Bar
                          dataKey="onboarded"
                          name="Onboarded Agents"
                          fill="#D97706"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={35}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Table controls */}
      <div className="bg-white border border-stone-200 rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2.5 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search member name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-md border border-stone-200 bg-stone-50/60 text-stone-900 text-xs w-52 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1 bg-stone-50/60 border border-stone-200 rounded-md px-2 py-1">
            <span className="text-[11px] font-medium text-stone-500">Squad:</span>
            <select
              value={selectedTeamFilter}
              onChange={(e) => setSelectedTeamFilter(e.target.value)}
              className="bg-transparent text-stone-800 text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="All">All Squads ({squadCount})</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 bg-stone-50/60 border border-stone-200 rounded-md px-2 py-1">
            <span className="text-[11px] font-medium text-stone-500">Role:</span>
            <select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              className="bg-transparent text-stone-800 text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all">All Members ({membersReports.length})</option>
              <option value="telecaller">Calling Executives Only</option>
              <option value="leader">Team Leaders Only</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-stone-500">
          <span className="font-medium">Sort by:</span>
          <div className="inline-flex rounded-md border border-stone-200 bg-stone-50/60 p-0.5">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => handleSort(s.key)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  sortBy === s.key
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {s.label} {sortBy === s.key && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Members table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold select-none">
                <th className="py-2.5 px-3.5">Member</th>
                <th className="py-2.5 px-3">Squad / Team</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3 text-center">Assigned</th>
                <th className="py-2.5 px-3 text-center bg-blue-50/40 text-blue-900 font-bold border-x border-blue-100/60">
                  <span className="block">Connected Calls</span>
                  <span className="text-[10px] font-normal text-blue-600 block">Answered Only</span>
                </th>
                <th className="py-2.5 px-3 text-center">Talk Time</th>
                <th className="py-2.5 px-3 text-center text-emerald-800 font-bold">Interested</th>
                <th className="py-2.5 px-3 text-center text-amber-800">TL Escalation</th>
                <th className="py-2.5 px-3 text-center text-purple-800">Visits Fixed</th>
                <th className="py-2.5 px-3 text-center text-emerald-900 font-bold">Onboarded</th>
                <th className="py-2.5 px-3 text-right">Connect-to-Int %</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading && !report ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-stone-400">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading working
                      reports…
                    </span>
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-stone-400">
                    <Users className="w-8 h-8 mx-auto text-stone-300 mb-1.5" />
                    <p className="font-semibold text-stone-600">No recruitment members found</p>
                    <p className="text-[11px] text-stone-400">
                      Adjust the filters or search terms above
                    </p>
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => (
                  <tr
                    key={member.id}
                    onClick={() => setSelectedMember(member)}
                    className="hover:bg-stone-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-2.5 px-3.5">
                      <div className="flex items-center gap-2.5">
                        <PersonAvatar name={member.name} photo={member.photo} size="sm" />
                        <div>
                          <span className="font-bold text-stone-900 group-hover:text-blue-600 transition-colors block">
                            {member.name}
                          </span>
                          <span className="text-[10px] text-stone-400 font-mono">
                            {empCode(member.id)}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td
                      className="py-2.5 px-3 text-stone-700 max-w-[160px] truncate"
                      title={member.teamName}
                    >
                      {member.teamName}
                    </td>

                    <td className="py-2.5 px-3">
                      {member.isTeamLeader ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Headphones className="w-3 h-3 text-amber-600" />
                          Team Leader
                        </span>
                      ) : (
                        <span className="text-stone-600 font-medium">{member.role}</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-center font-mono font-medium text-stone-600">
                      {member.assignedLeadsCount}
                    </td>
                    <td className="py-2.5 px-3 text-center bg-blue-50/30 font-mono font-bold text-blue-700 border-x border-blue-100/60 text-[13px]">
                      {member.connectedCallsCount}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-stone-700">
                      {minutesLabel(member.totalTalkMinutes)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-700">
                      {member.interestedCount}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-amber-800">
                      {member.tlEscalationsCount}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-purple-700">
                      {member.visitsScheduledCount}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-800">
                      {member.onboardedCount}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-stone-100 text-stone-800 border border-stone-200">
                        {member.conversionRate}%
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setSelectedMember(member)}
                        className="px-2 py-1 rounded text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-stone-50/80 border-t border-stone-200 flex flex-wrap items-center justify-between text-[11px] text-stone-500">
          <span>
            Showing <strong>{filteredMembers.length}</strong> active members across {squadCount}{' '}
            recruitment {squadCount === 1 ? 'squad' : 'squads'}
          </span>
          <span className="font-medium text-stone-600">
            Total Connected Calls Logged:{' '}
            <strong className="font-mono text-blue-700">{totals.connected}</strong> (Unanswered
            calls filtered out)
          </span>
        </div>
      </div>

      {selectedMember && (
        <MemberCallsModal member={selectedMember} onClose={() => setSelectedMember(null)} />
      )}
    </div>
  );
}

/** One person's answered calls — fetched on open, so the page load stays light. */
function MemberCallsModal({ member, onClose }) {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await agentLeadService.getCallAttempts({
          employeeId: member.id,
          answerStatus: 'Answered',
        });
        const list = data.result || data.data || [];
        if (!cancelled) {
          setCalls(Array.isArray(list) ? list : []);
          setError(null);
        }
      } catch (err) {
        console.error('Failed to load connected calls:', err);
        if (!cancelled) setError(errorMessage(err, 'Could not load this member’s calls.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [member.id]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl border border-stone-200 shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="p-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PersonAvatar name={member.name} photo={member.photo} size="md" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-stone-900 text-sm">{member.name}</h3>
                {member.isTeamLeader && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    Team Leader
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-500 font-mono">
                {empCode(member.id)} · {member.teamName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 bg-stone-100/60 border-b border-stone-200 grid grid-cols-4 gap-2 text-center text-xs">
          <div className="p-2 bg-white rounded-lg border border-stone-200 shadow-2xs">
            <span className="text-[10px] text-stone-500 block">Connected Calls</span>
            <span className="font-bold font-mono text-blue-700 text-sm">
              {member.connectedCallsCount}
            </span>
          </div>
          <div className="p-2 bg-white rounded-lg border border-stone-200 shadow-2xs">
            <span className="text-[10px] text-stone-500 block">Talk Time</span>
            <span className="font-bold font-mono text-emerald-800 text-sm">
              {minutesLabel(member.totalTalkMinutes)}
            </span>
          </div>
          <div className="p-2 bg-white rounded-lg border border-stone-200 shadow-2xs">
            <span className="text-[10px] text-stone-500 block">Interested</span>
            <span className="font-bold font-mono text-blue-700 text-sm">
              {member.interestedCount}
            </span>
          </div>
          <div className="p-2 bg-white rounded-lg border border-stone-200 shadow-2xs">
            <span className="text-[10px] text-stone-500 block">Onboarded</span>
            <span className="font-bold font-mono text-emerald-800 text-sm">
              {member.onboardedCount}
            </span>
          </div>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <PhoneCall className="w-4 h-4 text-emerald-600" />
              <h4 className="font-bold text-stone-800 text-xs">
                Connected Conversations Log ({calls.length})
              </h4>
            </div>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Strictly Answered Calls
            </span>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div className="space-y-2">
            {loading ? (
              <div className="py-8 text-center text-stone-400 text-xs inline-flex items-center justify-center gap-2 w-full">
                <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading calls…
              </div>
            ) : (
              calls.map((call) => (
                <div
                  key={call.id}
                  className="p-3 rounded-lg border border-stone-200 bg-stone-50/70 hover:bg-stone-50 space-y-1.5 transition-colors text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900">
                        {call.candidate?.name || 'Unknown lead'}
                      </span>
                      <span className="font-mono text-stone-500 text-[11px]">
                        {call.candidate?.phone}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-stone-400">
                      {stampOf(call.called_at)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {call.answer_status}
                    </span>
                    {call.result && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                        {call.result}
                      </span>
                    )}
                  </div>

                  <p className="text-stone-600 text-[11px] bg-white p-2 rounded border border-stone-200/80">
                    {call.note || 'No note recorded for this call.'}
                  </p>
                </div>
              ))
            )}

            {!loading && !error && calls.length === 0 && (
              <div className="py-8 text-center text-stone-400 text-xs">
                No answered calls recorded for this member.
              </div>
            )}
          </div>
        </div>

        <div className="p-3 bg-stone-50 border-t border-stone-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-800 font-semibold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
