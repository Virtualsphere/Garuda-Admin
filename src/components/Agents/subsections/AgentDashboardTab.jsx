import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, Loader2, AlertTriangle, MapPin } from 'lucide-react';

import useAgentRecruitmentMap from '../../../hooks/useAgentRecruitmentMap';
import agentEnquiryService from '../../../services/agentEnquiryService';
import agentObservationService from '../../../services/agentObservationService';
import agentFinanceService from '../../../services/agentFinanceService';
import { PIPELINE_STAGES, STAGE_LABELS } from '../Recruitment/recruitmentConstants';
import { formatINR } from '../agentConstants';

const FUNNEL_TONES = {
  NEW_LEAD: 'bg-blue-500',
  FIRST_CALL: 'bg-sky-500',
  INTERESTED: 'bg-cyan-500',
  LOCATION_CHECK: 'bg-teal-500',
  VILLAGE_INTEREST: 'bg-amber-500',
  WAITING: 'bg-yellow-500',
  SELECTED: 'bg-orange-500',
  OFFICE_VISIT: 'bg-purple-500',
  JOINING_PROCESS: 'bg-emerald-500',
  JOINED: 'bg-[#2563EB]',
};

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/**
 * Operations control for the agents desk: how much of the territory is staffed,
 * where the recruitment funnel is thick, and what needs working today.
 */
export default function AgentDashboardTab({ agents = [] }) {
  const { nodes, positions, candidates, totals, loading, error } = useAgentRecruitmentMap({});

  const [enquiryStats, setEnquiryStats] = useState(null);
  const [dueObservations, setDueObservations] = useState([]);
  const [financeSummary, setFinanceSummary] = useState(null);
  const [sideLoading, setSideLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setSideLoading(true);
      // Each panel is independent; one failing endpoint should not blank the
      // whole dashboard, so they settle rather than race to a single reject.
      const [stats, due, finance] = await Promise.allSettled([
        agentEnquiryService.getStats(),
        agentObservationService.getAssignments({ dueOnly: true }),
        agentFinanceService.getSummary(),
      ]);

      if (cancelled) return;

      if (stats.status === 'fulfilled') {
        setEnquiryStats(stats.value.result || stats.value.data || null);
      }
      if (due.status === 'fulfilled') {
        const list = due.value.result || due.value.data || [];
        setDueObservations(Array.isArray(list) ? list : []);
      }
      if (finance.status === 'fulfilled') {
        setFinanceSummary(finance.value.result || finance.value.data || null);
      }
      setSideLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── Territory coverage ─────────────────────────────────────── */

  const coverage = useMemo(() => {
    // The seat table is the authority on how many agents a village needs; the
    // node list is the authority on how many are actually on the ground.
    const filled = positions.filter((p) => p.status === 'FILLED').length;
    const required = positions.length;
    const vacancies = required - filled;

    const gaps = [...nodes]
      .filter((n) => n.vacantPositions > 0)
      .sort((a, b) => b.vacantPositions - a.vacantPositions)
      .slice(0, 8);

    return { filled, required, vacancies, gaps };
  }, [nodes, positions]);

  const stageCounts = useMemo(() => {
    const counts = {};
    candidates.forEach((c) => {
      counts[c.status] = (counts[c.status] || 0) + 1;
    });
    return counts;
  }, [candidates]);

  const landStats = useMemo(() => {
    const totalLands = nodes.reduce((sum, n) => sum + (Number(n.land_count) || 0), 0);
    const linkedLands = nodes.reduce(
      (sum, n) => sum + (Number(n.linked_land_count) || 0),
      0
    );
    const totalAcres = nodes.reduce((sum, n) => sum + (Number(n.total_acres) || 0), 0);
    return { totalLands, linkedLands, totalAcres };
  }, [nodes]);

  const activeAgents = agents.filter((a) => a.status === 'ACTIVE').length;

  const kpis = [
    {
      label: 'Required agents',
      value: coverage.required,
      note: 'Across all mapped villages',
    },
    {
      label: 'Filled positions',
      value: coverage.filled,
      note: 'Appointed active agents',
      tone: 'emerald',
    },
    {
      label: 'Vacancies',
      value: coverage.vacancies,
      note: 'Open agent positions',
      tone: 'rose',
    },
    {
      label: 'Recruitment %',
      value: `${pct(coverage.filled, coverage.required)}%`,
      progress: pct(coverage.filled, coverage.required),
      tone: 'orange',
    },
    {
      label: 'New leads',
      value: stageCounts.NEW_LEAD || 0,
      note: 'Awaiting first call',
      valueTone: 'text-blue-600',
    },
    {
      label: 'Interested',
      value: stageCounts.INTERESTED || 0,
      note: 'Warm candidates',
      valueTone: 'text-cyan-600',
    },
    {
      label: 'Waiting outside',
      value: totals.waiting,
      note: 'Non-native applicants',
      valueTone: 'text-amber-700',
    },
    {
      label: 'Selected',
      value: stageCounts.SELECTED || 0,
      note: 'Chosen for a seat',
      valueTone: 'text-orange-600',
    },
    {
      label: 'Joined',
      value: stageCounts.JOINED || 0,
      note: 'Converted to agents',
      valueTone: 'text-[#2563EB]',
    },
    {
      label: 'Active agents',
      value: activeAgents,
      note: `${agents.length} on the registry`,
    },
    {
      label: 'Village nodes',
      value: totals.nodes,
      note: `${totals.fullyStaffed} fully staffed`,
    },
    {
      label: 'Lands mapped',
      value: landStats.totalLands,
      note: `${landStats.linkedLands} linked to an agent`,
    },
    {
      label: 'Acres covered',
      value: Math.round(landStats.totalAcres).toLocaleString('en-IN'),
      note: 'Total surveyed acreage',
    },
    {
      label: 'Open enquiries',
      value: enquiryStats?.open ?? '—',
      note: `${enquiryStats?.total ?? 0} logged in total`,
      valueTone: 'text-purple-600',
    },
    {
      label: 'Information due',
      value: dueObservations.length,
      note: 'Observation reports overdue',
      tone: dueObservations.length > 0 ? 'rose' : undefined,
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-4 rounded-2xl border border-[#e7e5e4] shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[#1c1917]">
              Agents Department Operations Control
            </h2>
            <p className="text-xs text-[#78716c]">
              Real-time recruitment funnel, territorial coverage and field ground-truth
              monitoring
            </p>
          </div>
        </div>

        {(loading || sideLoading) && (
          <span className="flex items-center gap-2 text-xs font-bold text-[#78716c]">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2563EB]" /> Loading…
          </span>
        )}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl px-4 py-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* KPIs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#57534e] flex items-center gap-1.5">
            <span>Primary operational metrics</span>
            <span className="px-2 py-0.5 rounded-full bg-orange-100 text-[#2563EB] text-[10px] font-bold">
              {kpis.length} KPIs
            </span>
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {kpis.map((kpi) => (
            <KpiTile key={kpi.label} {...kpi} />
          ))}
        </div>
      </div>

      {/* Funnel + gaps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="p-5 rounded-2xl bg-white border border-[#e7e5e4] shadow-sm space-y-4">
          <h3 className="font-extrabold text-sm text-[#1c1917]">
            Recruitment funnel progress
          </h3>

          <div className="space-y-2.5">
            {PIPELINE_STAGES.map((stage) => {
              const count = stageCounts[stage] || 0;
              const width = pct(count, candidates.length || 1);
              return (
                <div key={stage}>
                  <div className="flex justify-between text-xs font-semibold text-[#1c1917] mb-1">
                    <span>{STAGE_LABELS[stage] || stage}</span>
                    <strong className="text-[#57534e]">{count}</strong>
                  </div>
                  <div className="w-full bg-[#f5f5f4] h-2 rounded-full overflow-hidden">
                    <div
                      className={`${FUNNEL_TONES[stage] || 'bg-gray-400'} h-full rounded-full transition-all`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {candidates.length === 0 && !loading && (
              <p className="text-xs text-[#78716c] py-4 text-center">
                No candidates in the pipeline yet.
              </p>
            )}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#e7e5e4] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-[#1c1917]">
              Largest territorial gaps
            </h3>
            <span className="text-[11px] font-bold text-rose-700">
              {coverage.vacancies} open seats
            </span>
          </div>

          <div className="space-y-2">
            {coverage.gaps.length > 0 ? (
              coverage.gaps.map((node) => (
                <div
                  key={`${node.mandal}-${node.village}`}
                  className="flex items-center justify-between p-2.5 bg-[#fafaf9] rounded-xl border border-[#e7e5e4]"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#1c1917] flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 text-[#2563EB] shrink-0" />
                      {node.village}
                    </div>
                    <div className="text-[10px] text-[#78716c]">
                      {node.mandal}, {node.district} · {Math.round(node.total_acres)} acres
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="text-sm font-black text-rose-600">
                      {node.vacantPositions}
                    </div>
                    <div className="text-[10px] text-[#78716c] uppercase font-bold">
                      vacant
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-[#78716c] py-4 text-center">
                {loading ? 'Loading coverage…' : 'Every mapped village is fully staffed.'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Today's work */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <WorkPanel
          title="Information due"
          subtitle="Observation reports the desk is waiting on"
          count={dueObservations.length}
          tone="rose"
          items={dueObservations.slice(0, 5).map((obs) => ({
            id: obs.id,
            primary: obs.land ? `LD-${obs.land.id} · ${obs.land.village || ''}` : `Observation #${obs.id}`,
            secondary: `${obs.agent?.name || 'Unassigned'} · due ${obs.next_due_date || '—'}`,
          }))}
          emptyLabel="No observation reports are overdue."
        />

        <WorkPanel
          title="Open enquiries"
          subtitle="Inbound calls still being worked"
          count={enquiryStats?.open ?? 0}
          tone="purple"
          items={Object.entries(enquiryStats?.byStatus || {})
            .filter(([status]) => !['RESOLVED', 'CLOSED', 'CONVERTED_TO_LEAD'].includes(status))
            .map(([status, count]) => ({
              id: status,
              primary: status.replace(/_/g, ' '),
              secondary: `${count} enquir${count === 1 ? 'y' : 'ies'}`,
            }))}
          emptyLabel="No open enquiries on the desk."
        />

        <WorkPanel
          title="Finance position"
          subtitle="Commission owed against commission paid"
          count={financeSummary ? formatINR(financeSummary.commissionsPending) : '—'}
          tone="orange"
          items={
            financeSummary
              ? [
                  {
                    id: 'disbursed',
                    primary: 'Commissions disbursed',
                    secondary: formatINR(financeSummary.commissionsDisbursed),
                  },
                  {
                    id: 'pending',
                    primary: 'Pending approval',
                    secondary: formatINR(financeSummary.commissionsPending),
                  },
                  {
                    id: 'membership',
                    primary: 'Membership collected',
                    secondary: formatINR(financeSummary.membershipCollected),
                  },
                ]
              : []
          }
          emptyLabel="No transactions recorded yet."
        />
      </div>
    </div>
  );
}

/* ── Local pieces ─────────────────────────────────────────────── */

function KpiTile({ label, value, note, tone, valueTone, progress }) {
  const shell =
    tone === 'emerald'
      ? 'bg-emerald-50/60 border-emerald-200'
      : tone === 'rose'
      ? 'bg-rose-50/60 border-rose-200'
      : tone === 'orange'
      ? 'bg-orange-50/60 border-orange-200'
      : 'bg-white border-[#e7e5e4]';

  const labelTone =
    tone === 'emerald'
      ? 'text-emerald-800'
      : tone === 'rose'
      ? 'text-rose-800'
      : tone === 'orange'
      ? 'text-[#2563EB]'
      : 'text-[#78716c]';

  const numberTone =
    valueTone ||
    (tone === 'emerald'
      ? 'text-emerald-900'
      : tone === 'rose'
      ? 'text-rose-900'
      : tone === 'orange'
      ? 'text-[#2563EB]'
      : 'text-[#1c1917]');

  return (
    <div className={`p-3.5 rounded-xl border shadow-sm transition-all ${shell}`}>
      <div className={`text-[11px] font-bold uppercase ${labelTone}`}>{label}</div>
      <div className={`text-xl font-black mt-1 ${numberTone}`}>{value}</div>
      {progress !== undefined ? (
        <div className="w-full bg-orange-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
          <div
            className="bg-[#2563EB] h-full rounded-full"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      ) : (
        note && <div className="text-[10px] text-[#57534e] mt-0.5">{note}</div>
      )}
    </div>
  );
}

function WorkPanel({ title, subtitle, count, tone, items = [], emptyLabel }) {
  const accent =
    tone === 'rose'
      ? 'text-rose-700 bg-rose-50 border-rose-200'
      : tone === 'purple'
      ? 'text-purple-700 bg-purple-50 border-purple-200'
      : 'text-[#2563EB] bg-orange-50 border-orange-200';

  return (
    <div className="p-5 rounded-2xl bg-white border border-[#e7e5e4] shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-bold text-sm text-[#1c1917]">{title}</h4>
          <p className="text-[11px] text-[#78716c]">{subtitle}</p>
        </div>
        <span
          className={`px-2.5 py-1 rounded-lg border text-xs font-black whitespace-nowrap ${accent}`}
        >
          {count}
        </span>
      </div>

      <div className="space-y-1.5">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 p-2 bg-[#fafaf9] rounded-lg text-xs"
            >
              <span className="font-semibold text-[#1c1917] truncate capitalize">
                {item.primary}
              </span>
              <span className="text-[10px] text-[#78716c] shrink-0">{item.secondary}</span>
            </div>
          ))
        ) : (
          <p className="text-xs text-[#78716c] py-3 text-center">{emptyLabel}</p>
        )}
      </div>
    </div>
  );
}
