import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, AlertTriangle, RefreshCw, TrendingUp } from 'lucide-react';

import agentLeadService from '../../../services/agentLeadService';

const formatTalkTime = (seconds) => {
  const total = Number(seconds) || 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const daysAgoISO = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

const RANGES = [
  { key: 7, label: 'Last 7 days' },
  { key: 30, label: 'Last 30 days' },
  { key: 0, label: 'All time' },
];

/**
 * How the calling floor is performing: attempts, connect rate and conversions
 * per telecaller, computed from the recorded call attempts rather than from
 * anything the desk types in.
 */
export default function TelecallerPerformanceTab() {
  const [rows, setRows] = useState([]);
  const [range, setRange] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await agentLeadService.getPerformance(
        range ? { dateFrom: daysAgoISO(range) } : {}
      );
      const list = data.result || data.data || [];
      setRows(Array.isArray(list) ? list : []);
      setError(null);
    } catch (err) {
      console.error('Failed to load telecaller performance:', err);
      setRows([]);
      setError('Could not load telecaller performance.');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          attempts: acc.attempts + r.attempts,
          answered: acc.answered + r.answered,
          proceeded: acc.proceeded + r.proceeded,
          talk: acc.talk + r.talk_seconds,
        }),
        { attempts: 0, answered: 0, proceeded: 0, talk: 0 }
      ),
    [rows]
  );

  const maxAttempts = Math.max(1, ...rows.map((r) => r.attempts));

  return (
    <div className="space-y-3">
      <div className="bg-white border border-stone-200 rounded-lg p-2.5 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-stone-200 p-0.5 bg-stone-100">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                range === r.key ? 'bg-white text-[#2563EB] shadow-2xs' : 'text-stone-600'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>

        <span className="text-xs text-stone-500 font-medium ml-auto">
          {totals.attempts} attempts · {totals.answered} answered ·{' '}
          {totals.attempts ? Math.round((totals.answered / totals.attempts) * 100) : 0}% connect
        </span>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-stone-200 rounded-lg py-14 flex items-center justify-center">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-stone-500">
            <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading performance…
          </span>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-lg py-14 text-center text-xs text-stone-400">
          <TrendingUp className="w-5 h-5 mx-auto mb-1.5 text-stone-300" />
          No calls recorded in this period.
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-stone-100 text-stone-700 font-semibold border-b border-stone-200">
                  <th className="p-2.5">Telecaller</th>
                  <th className="p-2.5">Attempts</th>
                  <th className="p-2.5">Answered</th>
                  <th className="p-2.5">Connect rate</th>
                  <th className="p-2.5">Proceeded</th>
                  <th className="p-2.5">Rejected</th>
                  <th className="p-2.5">Talk time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows
                  .slice()
                  .sort((a, b) => b.attempts - a.attempts)
                  .map((row) => (
                    <tr key={row.employee_id ?? row.employee_name} className="hover:bg-stone-50">
                      <td className="p-2.5 font-semibold text-stone-900">
                        {row.employee_name}
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-900 w-6">{row.attempts}</span>
                          <div className="flex-1 min-w-[60px] bg-stone-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-[#2563EB] h-full rounded-full"
                              style={{ width: `${(row.attempts / maxAttempts) * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-2.5 text-stone-700">{row.answered}</td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            row.connect_rate >= 60
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : row.connect_rate >= 30
                              ? 'bg-amber-50 text-amber-900 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {row.connect_rate}%
                        </span>
                      </td>
                      <td className="p-2.5 font-bold text-emerald-700">{row.proceeded}</td>
                      <td className="p-2.5 text-stone-600">{row.rejected}</td>
                      <td className="p-2.5 text-stone-600">
                        {formatTalkTime(row.talk_seconds)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
