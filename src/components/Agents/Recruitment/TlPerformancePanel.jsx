import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import {
  TrendingUp,
  Award,
  HelpCircle,
  Sparkles,
  BarChart3,
  Table,
  PhoneCall,
} from 'lucide-react';

import PersonAvatar from '../common/PersonAvatar';
import { localDate, squadLabel, sameId } from './recruitmentModel';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const OUTCOME_COLORS = ['#2563EB', '#D97706', '#059669', '#7C3AED', '#0891B2', '#E11D48'];

const TOOLTIP_STYLE = {
  backgroundColor: '#1C1917',
  borderRadius: '6px',
  border: 'none',
  fontSize: '11px',
  color: '#FFFFFF',
  padding: '6px 10px',
};

/** "04:32", "1:02:03" or a bare number of seconds → seconds; NaN when it is none of those. */
const durationSeconds = (value) => {
  if (value === null || value === undefined || value === '') return NaN;
  const text = String(value).trim();
  if (/^\d+$/.test(text)) return Number(text);
  const parts = text.split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return NaN;
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0);
};

const clock = (seconds) => {
  if (!Number.isFinite(seconds)) return '—';
  const total = Math.round(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

const average = (numbers) => {
  const valid = numbers.filter(Number.isFinite);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : NaN;
};

const turnaround = (hours) => {
  if (!Number.isFinite(hours)) return '—';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  return `${hours.toFixed(1)} hrs`;
};

const isClosed = (esc) => esc.status !== 'Pending';
const isConverted = (esc) => esc.tl_result === 'Proceed';

/** The word a closed case is filed under in the outcome breakdown. */
const outcomeOf = (esc) => {
  if (esc.status === 'ReturnedToTelecaller') return 'Returned to Telecaller';
  if (esc.tl_result === 'Proceed') return 'Proceeded to Interested';
  return esc.tl_result || 'Closed';
};

/**
 * The team-leader analytics column beside the escalation queue: a Graphs view
 * and a Grid view over the same figures.
 *
 * Every number is derived from the escalations themselves. Where the design
 * mockup showed fixed placeholders — an SLA of "< 4 hrs", a list of escalation
 * *reasons*, three named callers — this panel shows what the data supports
 * instead: measured turnaround, how cases were concluded (the backend records an
 * outcome, not a reason), and the callers who actually escalated.
 */
export default function TlPerformancePanel({
  escalations,
  teams,
  employeeById,
  selectedLeader,
  onSelectLeader,
}) {
  const [activeView, setActiveView] = useState('graphs');
  const [chartType, setChartType] = useState('volume');

  const tlStats = useMemo(() => {
    const leaders = new Map();

    teams.forEach((team) => {
      leaders.set(String(team.teamLeaderId), {
        id: String(team.teamLeaderId),
        name: team.teamLeaderName,
        avatar: team.teamLeaderPhoto || employeeById.get(String(team.teamLeaderId))?.photo,
        team: squadLabel(team),
        callersCount: (team.memberIds || []).length,
      });
    });

    // A case can be with somebody who is not a squad leader (an admin who
    // took it over); they still belong in the analytics.
    escalations.forEach((esc) => {
      const id = esc.team_leader_id === null || esc.team_leader_id === undefined ? null : String(esc.team_leader_id);
      if (id && !leaders.has(id)) {
        leaders.set(id, {
          id,
          name: esc.teamLeader?.name || employeeById.get(id)?.name || `Employee #${id}`,
          avatar: employeeById.get(id)?.photo,
          team: 'No squad',
          callersCount: 0,
        });
      }
    });

    return [...leaders.values()].map((leader) => {
      const cases = escalations.filter((e) => sameId(e.team_leader_id, leader.id));
      const resolved = cases.filter((e) => e.status === 'Completed').length;
      const converted = cases.filter(isConverted).length;

      return {
        ...leader,
        totalCases: cases.length,
        resolvedCases: resolved,
        returnedCases: cases.filter((e) => e.status === 'ReturnedToTelecaller').length,
        pendingCases: cases.filter((e) => e.status === 'Pending').length,
        convertedCases: converted,
        conversionRate: resolved > 0 ? Math.round((converted / resolved) * 100) : 0,
        avgDuration: clock(average(cases.map((e) => durationSeconds(e.call_duration)))),
      };
    });
  }, [escalations, teams, employeeById]);

  const summary = useMemo(() => {
    const total = escalations.length;
    const resolved = escalations.filter((e) => e.status === 'Completed').length;

    const closedHours = escalations
      .filter((e) => isClosed(e) && e.forwarded_at && e.completed_at)
      .map((e) => (new Date(e.completed_at) - new Date(e.forwarded_at)) / 3600000);

    return {
      resolutionPct: total > 0 ? `${Math.round((resolved / total) * 100)}%` : '—',
      avgTalk: clock(average(escalations.map((e) => durationSeconds(e.call_duration)))),
      turnaround: turnaround(average(closedHours)),
    };
  }, [escalations]);

  // Last seven calendar days, oldest first, so the chart reads left to right.
  const weeklyTrendData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return { key: localDate(d), day: WEEKDAYS[d.getDay()], callsHandled: 0, resolved: 0, converted: 0 };
    });
    const byKey = new Map(days.map((d) => [d.key, d]));

    escalations.forEach((esc) => {
      if (!isClosed(esc) || !esc.completed_at) return;
      const bucket = byKey.get(localDate(esc.completed_at));
      if (!bucket) return;
      bucket.callsHandled += 1;
      if (esc.status === 'Completed') bucket.resolved += 1;
      if (isConverted(esc)) bucket.converted += 1;
    });

    return days;
  }, [escalations]);

  const outcomeBreakdown = useMemo(() => {
    const closed = escalations.filter(isClosed);
    const counts = new Map();
    closed.forEach((esc) => {
      const key = outcomeOf(esc);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count], i) => ({
        reason,
        count,
        percentage: Math.round((count / closed.length) * 100),
        color: OUTCOME_COLORS[i % OUTCOME_COLORS.length],
      }));
  }, [escalations]);

  const callerOrigins = useMemo(() => {
    const byCaller = new Map();
    escalations.forEach((esc) => {
      const id = esc.telecaller_id ?? esc.telecaller?.id;
      const key = id === null || id === undefined ? 'unattributed' : String(id);
      if (!byCaller.has(key)) {
        byCaller.set(key, {
          key,
          name: esc.telecaller?.name || employeeById.get(key)?.name || 'Unattributed',
          escalated: 0,
          converted: 0,
        });
      }
      const row = byCaller.get(key);
      row.escalated += 1;
      if (isConverted(esc)) row.converted += 1;
    });

    return [...byCaller.values()]
      .map((row) => ({ ...row, success: Math.round((row.converted / row.escalated) * 100) }))
      .sort((a, b) => b.escalated - a.escalated)
      .slice(0, 5);
  }, [escalations, employeeById]);

  const leaderboard = useMemo(
    () => [...tlStats].sort((a, b) => b.resolvedCases - a.resolvedCases),
    [tlStats]
  );

  const isLeaderSelected = (id) => selectedLeader !== 'All' && sameId(selectedLeader, id);
  const toggleLeader = (id) => onSelectLeader(isLeaderSelected(id) ? 'All' : String(id));

  return (
    <div className="space-y-3.5 text-xs">
      {/* Header card */}
      <div className="bg-white rounded-xl border border-amber-200/90 p-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-xs">Team Leader Performance Analytics</h3>
              <p className="text-[10px] text-stone-500">
                Supervisory intervention, calling graphs &amp; conversion rates
              </p>
            </div>
          </div>

          <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200 text-[11px]">
            <button
              type="button"
              onClick={() => setActiveView('graphs')}
              className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition-all ${
                activeView === 'graphs'
                  ? 'bg-white text-stone-900 shadow-2xs font-bold'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <BarChart3 className="w-3 h-3 text-amber-600" />
              <span>Graphs</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('grid')}
              className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition-all ${
                activeView === 'grid'
                  ? 'bg-white text-stone-900 shadow-2xs font-bold'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <Table className="w-3 h-3 text-blue-600" />
              <span>Grid Table</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-stone-50 border border-stone-200/70">
            <div className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">
              Resolution Rate
            </div>
            <div className="text-base font-bold font-mono text-emerald-800 mt-0.5">
              {summary.resolutionPct}
            </div>
            <div className="text-[9px] text-emerald-600 font-medium">Target: ≥70%</div>
          </div>

          <div className="p-2 rounded-lg bg-stone-50 border border-stone-200/70">
            <div className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">
              Avg Handover
            </div>
            <div className="text-base font-bold font-mono text-amber-800 mt-0.5">
              {summary.avgTalk}
            </div>
            <div className="text-[9px] text-stone-500 font-medium">Per escalation</div>
          </div>

          <div className="p-2 rounded-lg bg-stone-50 border border-stone-200/70">
            <div className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">
              SLA Turnaround
            </div>
            <div className="text-base font-bold font-mono text-blue-800 mt-0.5">
              {summary.turnaround}
            </div>
            <div className="text-[9px] text-blue-600 font-medium">Forward to close</div>
          </div>
        </div>
      </div>

      {/* VIEW 1 — graphs */}
      {activeView === 'graphs' && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-stone-200 p-3 shadow-2xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-stone-100">
              <div>
                <h4 className="font-bold text-stone-900 text-xs">
                  {chartType === 'volume'
                    ? 'Team Leader Case Resolution Graph'
                    : 'Weekly Calls Handled & Resolution Trend'}
                </h4>
                <p className="text-[10px] text-stone-500">
                  {chartType === 'volume'
                    ? 'Escalated cases handled vs. successfully converted'
                    : 'Daily senior interventions and completed closures'}
                </p>
              </div>

              <div className="flex items-center gap-1">
                {[
                  { key: 'volume', label: 'By Leader' },
                  { key: 'trend', label: 'Daily Trend' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setChartType(opt.key)}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                      chartType === opt.key
                        ? 'bg-amber-100 text-amber-900 font-bold border border-amber-300'
                        : 'text-stone-500 hover:bg-stone-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {chartType === 'volume' ? (
              <div className="h-48 w-full">
                {tlStats.length === 0 ? (
                  <EmptyChart text="No team leaders yet." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={tlStats}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      barGap={4}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10, fill: '#57534E' }}
                        axisLine={{ stroke: '#E7E5E4' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#A8A29E' }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} iconSize={8} />
                      <Bar name="Total Cases" dataKey="totalCases" fill="#CBD5E1" radius={[3, 3, 0, 0]} />
                      <Bar name="Resolved" dataKey="resolvedCases" fill="#2563EB" radius={[3, 3, 0, 0]} />
                      <Bar name="Converted" dataKey="convertedCases" fill="#059669" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            ) : (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tlColorCalls" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="tlColorConverted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10, fill: '#57534E' }}
                      axisLine={{ stroke: '#E7E5E4' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#A8A29E' }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} iconSize={8} />
                    <Area
                      type="monotone"
                      name="Calls Handled"
                      dataKey="callsHandled"
                      stroke="#2563EB"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#tlColorCalls)"
                    />
                    <Area
                      type="monotone"
                      name="Converted"
                      dataKey="converted"
                      stroke="#059669"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#tlColorConverted)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Outcome distribution */}
          <div className="bg-white rounded-xl border border-stone-200 p-3 shadow-2xs">
            <div className="flex items-center justify-between mb-2.5">
              <div>
                <h4 className="font-bold text-stone-900 text-xs">Escalation Outcome Distribution</h4>
                <p className="text-[10px] text-stone-500">
                  How senior interventions were concluded
                </p>
              </div>
              <HelpCircle className="w-3.5 h-3.5 text-stone-400" />
            </div>

            {outcomeBreakdown.length === 0 ? (
              <p className="text-[11px] text-stone-400 text-center py-3">
                No closed cases yet.
              </p>
            ) : (
              <div className="space-y-2">
                {outcomeBreakdown.map((item) => (
                  <div key={item.reason} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-stone-700">{item.reason}</span>
                      <span className="font-mono font-bold text-stone-900">{item.percentage}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Leaderboard */}
          <div className="bg-white rounded-xl border border-stone-200 p-3 shadow-2xs">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-stone-100">
              <div className="flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-600" />
                <h4 className="font-bold text-stone-900 text-xs">
                  Team Leader Conversion Leaderboard
                </h4>
              </div>
              <span className="text-[10px] text-stone-400 font-medium">Click to filter</span>
            </div>

            {leaderboard.length === 0 ? (
              <p className="text-[11px] text-stone-400 text-center py-3">No team leaders yet.</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((tl) => {
                  const selected = isLeaderSelected(tl.id);
                  return (
                    <div
                      key={tl.id}
                      onClick={() => toggleLeader(tl.id)}
                      className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        selected
                          ? 'border-amber-400 bg-amber-50/70 shadow-2xs'
                          : 'border-stone-200/80 bg-stone-50/50 hover:bg-stone-50 hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <PersonAvatar name={tl.name} photo={tl.avatar} size="sm" />
                        <div className="min-w-0">
                          <div className="font-bold text-stone-900 truncate flex items-center gap-1.5">
                            <span>{tl.name}</span>
                            {selected && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                          </div>
                          <div className="text-[10px] text-stone-500 truncate">{tl.team}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-right">
                        <div>
                          <div className="font-mono font-bold text-stone-800 text-xs">
                            {tl.resolvedCases} / {tl.totalCases}
                          </div>
                          <div className="text-[9px] text-stone-400">Resolved</div>
                        </div>

                        <div className="w-12 text-center py-0.5 px-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold font-mono text-[11px]">
                          {tl.conversionRate}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2 — grid */}
      {activeView === 'grid' && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-2xs">
            <div className="p-3 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
              <span className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
                <Table className="w-3.5 h-3.5 text-blue-600" />
                Team Leader Performance &amp; Calling Grid
              </span>
              <span className="text-[10px] text-stone-500">
                {tlStats.length} {tlStats.length === 1 ? 'Supervisor' : 'Supervisors'} Active
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-100/70 text-[10px] font-bold text-stone-600 uppercase">
                    <th className="py-2.5 px-3">Team Leader</th>
                    <th className="py-2.5 px-2 text-center">Squad</th>
                    <th className="py-2.5 px-2 text-center">Cases</th>
                    <th className="py-2.5 px-2 text-center">Resolved</th>
                    <th className="py-2.5 px-2 text-center">Pending</th>
                    <th className="py-2.5 px-2 text-center">Conv. %</th>
                    <th className="py-2.5 px-2 text-center">Avg Talk</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {tlStats.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-[11px] text-stone-400">
                        No team leaders yet.
                      </td>
                    </tr>
                  )}
                  {tlStats.map((tl) => {
                    const selected = isLeaderSelected(tl.id);
                    return (
                      <tr
                        key={tl.id}
                        className={`hover:bg-amber-50/40 transition-colors ${
                          selected ? 'bg-amber-50/70 font-semibold' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <PersonAvatar name={tl.name} photo={tl.avatar} size="xs" />
                            <div>
                              <span className="font-bold text-stone-900 block truncate">{tl.name}</span>
                              <span className="text-[10px] text-stone-500 block">{tl.team}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-stone-100 text-stone-700">
                            {tl.callersCount} Callers
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-stone-800">
                          {tl.totalCases}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono text-emerald-700 font-bold">
                          {tl.resolvedCases}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono text-amber-700 font-bold">
                          {tl.pendingCases}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {tl.conversionRate}%
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono text-stone-600 text-[11px]">
                          {tl.avgDuration}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => toggleLeader(tl.id)}
                            className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                              selected
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                            }`}
                          >
                            {selected ? 'Filtered' : 'Filter'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-3 shadow-2xs space-y-2">
            <span className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
              <PhoneCall className="w-3.5 h-3.5 text-amber-600" />
              Telecaller Escalation Origins
            </span>
            {callerOrigins.length === 0 ? (
              <p className="text-[11px] text-stone-400 text-center py-2">
                No escalations recorded yet.
              </p>
            ) : (
              <div className="space-y-1.5 text-[11px]">
                {callerOrigins.map((row) => (
                  <div
                    key={row.key}
                    className="p-2 rounded bg-stone-50 border border-stone-200/80 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-stone-800">{row.name}</span>
                      <span className="text-[10px] text-stone-500 block">
                        {row.escalated} escalated · {row.converted} converted
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {row.success}% Success
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Objection-handling guidance */}
      <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-950 space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>TL Objection Handling Protocol</span>
        </div>
        <p className="text-[11px] text-amber-800 leading-relaxed">
          For candidate concerns regarding the ₹5,000 refundable security deposit, clarify that the
          official receipt is generated immediately in our ERP with village territory exclusive
          lock.
        </p>
      </div>
    </div>
  );
}

function EmptyChart({ text }) {
  return (
    <div className="h-full flex items-center justify-center text-[11px] text-stone-400">{text}</div>
  );
}
