import { useMemo } from 'react';
import { FileText, Download, Loader2 } from 'lucide-react';

import useAgentRecruitmentMap from '../../../hooks/useAgentRecruitmentMap';
import StatCard from '../common/StatCard';
import { LEAD_SOURCES } from '../Recruitment/recruitmentConstants';

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/**
 * Analytical reports for the agents desk.
 *
 * Every figure here is computed from the same endpoints the rest of the section
 * reads — the Firebase original hardcoded these panels, which meant the numbers
 * could not be acted on.
 */
export default function AgentReportsTab({ agents = [] }) {
  const { nodes, positions, candidates, totals, loading } = useAgentRecruitmentMap({});

  /* ── Sourcing efficiency ────────────────────────────────────── */

  const sourcing = useMemo(() => {
    const counts = {};
    candidates.forEach((c) => {
      const source = c.lead_source || 'DIRECT';
      counts[source] = (counts[source] || 0) + 1;
    });

    // Show every configured source, so a channel producing nothing is visible
    // as a zero rather than silently missing.
    const keys = [...new Set([...LEAD_SOURCES, ...Object.keys(counts)])];

    return keys
      .map((key) => ({
        channel: key.replace(/_/g, ' '),
        count: counts[key] || 0,
        pct: pct(counts[key] || 0, candidates.length),
      }))
      .sort((a, b) => b.count - a.count);
  }, [candidates]);

  /* ── Coverage ───────────────────────────────────────────────── */

  const coverage = useMemo(() => {
    const filled = positions.filter((p) => p.status === 'FILLED').length;
    const villagesWithAgent = nodes.filter((n) => n.deployedAgents > 0).length;

    return {
      filled,
      required: positions.length,
      fulfillment: pct(filled, positions.length),
      villagesWithAgent,
      villageCoverage: pct(villagesWithAgent, nodes.length),
    };
  }, [nodes, positions]);

  /* ── Mandal rollup ──────────────────────────────────────────── */

  const byMandal = useMemo(() => {
    const map = new Map();
    nodes.forEach((node) => {
      const key = node.mandal || 'Unassigned';
      if (!map.has(key)) {
        map.set(key, {
          mandal: key,
          district: node.district,
          villages: 0,
          agents: 0,
          vacancies: 0,
          acres: 0,
          lands: 0,
        });
      }
      const row = map.get(key);
      row.villages += 1;
      row.agents += node.deployedAgents;
      row.vacancies += node.vacantPositions;
      row.acres += Number(node.total_acres) || 0;
      row.lands += Number(node.land_count) || 0;
    });

    return [...map.values()].sort((a, b) => b.vacancies - a.vacancies);
  }, [nodes]);

  const exportCSV = () => {
    const headers = [
      'Mandal',
      'District',
      'Villages',
      'Agents deployed',
      'Open seats',
      'Lands',
      'Acres',
    ];
    const rows = byMandal.map((row) =>
      [
        row.mandal,
        row.district || '',
        row.villages,
        row.agents,
        row.vacancies,
        row.lands,
        Math.round(row.acres),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );

    const blob = new Blob([[headers.join(','), ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'garuda-agent-territory-report.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="bg-white p-5 rounded-2xl border border-[#e7e5e4] shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[#1c1917]">
              Agents department analytical reports
            </h2>
            <p className="text-xs text-[#78716c] mt-0.5">
              Recruitment conversion, village vacancy fulfilment, sourcing channel
              efficiency and territorial coverage
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={exportCSV}
          disabled={loading || byMandal.length === 0}
          className="px-3.5 py-2 rounded-xl border border-[#e7e5e4] hover:bg-gray-100 text-xs font-bold text-[#1c1917] flex items-center gap-1.5 disabled:opacity-40"
        >
          <Download className="w-3.5 h-3.5 text-[#2563EB]" /> Export CSV
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-[#e7e5e4] py-16 flex items-center justify-center">
          <span className="flex items-center gap-2 text-xs font-bold text-[#78716c]">
            <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Computing reports…
          </span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              title="Seat fulfilment"
              value={`${coverage.fulfillment}%`}
              subtext={`${coverage.filled} of ${coverage.required} seats filled`}
              variant="green"
            />
            <StatCard
              title="Village coverage"
              value={`${coverage.villageCoverage}%`}
              subtext={`${coverage.villagesWithAgent} of ${nodes.length} villages have an agent`}
              variant="orange"
            />
            <StatCard
              title="Candidates in pipeline"
              value={candidates.length}
              subtext={`${totals.waiting} waiting from outside`}
            />
            <StatCard
              title="Agents on roster"
              value={agents.length}
              subtext={`${agents.filter((a) => a.status === 'ACTIVE').length} active`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="p-5 rounded-2xl bg-white border border-[#e7e5e4] shadow-sm space-y-4">
              <h4 className="font-extrabold text-sm text-[#1c1917]">
                Recruitment sourcing efficiency
              </h4>

              <div className="space-y-3 text-xs">
                {candidates.length > 0 ? (
                  sourcing.map((item) => (
                    <div key={item.channel}>
                      <div className="flex justify-between font-semibold text-[#1c1917] mb-1 gap-2">
                        <span className="capitalize truncate">{item.channel}</span>
                        <strong className="text-[#2563EB] shrink-0">
                          {item.count} leads ({item.pct}%)
                        </strong>
                      </div>
                      <div className="w-full bg-[#f5f5f4] h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-[#2563EB] h-full rounded-full transition-all"
                          style={{ width: `${item.pct}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[#78716c] py-4 text-center">
                    No candidates yet, so no sourcing data to report.
                  </p>
                )}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#e7e5e4] shadow-sm space-y-4">
              <h4 className="font-extrabold text-sm text-[#1c1917]">
                Territorial vacancy coverage
              </h4>

              <div className="p-6 bg-[#fafaf9] rounded-xl text-center space-y-2">
                <div className="text-4xl font-black text-[#2563EB]">
                  {coverage.fulfillment}%
                </div>
                <div className="text-xs font-bold text-[#1c1917]">
                  Village position fulfilment
                </div>
                <p className="text-[11px] text-[#78716c]">
                  {coverage.villagesWithAgent} of {nodes.length} mapped villages have an
                  active appointed agent on the ground
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl py-2.5">
                  <div className="text-lg font-black text-emerald-800">
                    {totals.fullyStaffed}
                  </div>
                  <div className="text-[10px] font-bold text-emerald-700 uppercase">
                    Fully staffed
                  </div>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-xl py-2.5">
                  <div className="text-lg font-black text-rose-800">{totals.vacancies}</div>
                  <div className="text-[10px] font-bold text-rose-700 uppercase">
                    Open seats
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mandal rollup */}
          <div className="bg-white rounded-2xl border border-[#e7e5e4] shadow-sm overflow-hidden">
            <div className="p-5 border-b border-[#e7e5e4]">
              <h4 className="font-extrabold text-sm text-[#1c1917]">
                Coverage by mandal
              </h4>
              <p className="text-xs text-[#78716c] mt-0.5">
                Ordered by open seats, so the mandals needing recruitment are first
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f5f5f4]/75 border-b border-[#e7e5e4] text-[11px] font-bold text-[#78716c] uppercase tracking-wider">
                    <th className="py-3 px-4">Mandal</th>
                    <th className="py-3 px-4">District</th>
                    <th className="py-3 px-4">Villages</th>
                    <th className="py-3 px-4">Agents</th>
                    <th className="py-3 px-4">Open seats</th>
                    <th className="py-3 px-4">Lands</th>
                    <th className="py-3 px-4">Acres</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e7e5e4] text-xs font-medium text-[#1c1917]">
                  {byMandal.length > 0 ? (
                    byMandal.map((row) => (
                      <tr key={row.mandal} className="hover:bg-[#f5f5f4]/50">
                        <td className="py-3 px-4 font-bold">{row.mandal}</td>
                        <td className="py-3 px-4 text-[#57534e]">{row.district || '—'}</td>
                        <td className="py-3 px-4">{row.villages}</td>
                        <td className="py-3 px-4 font-bold text-[#2563EB]">{row.agents}</td>
                        <td
                          className={`py-3 px-4 font-bold ${
                            row.vacancies > 0 ? 'text-rose-600' : 'text-[#78716c]'
                          }`}
                        >
                          {row.vacancies}
                        </td>
                        <td className="py-3 px-4">{row.lands}</td>
                        <td className="py-3 px-4">
                          {Math.round(row.acres).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#78716c]">
                        No territory data to report yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
