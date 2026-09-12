import { useState, useEffect, useCallback, useMemo } from 'react';
import { PhoneCall, Loader2, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';

import DataTable from '../common/DataTable';
import Badge from '../common/Badge';
import CallButton from '../common/CallButton';
import StatCard from '../common/StatCard';
import callSignalService from '../../../services/callSignalService';
import employeeService from '../../../services/employeeService';

const DEPARTMENT = 'agents';

const formatDuration = (seconds) => {
  const total = Number(seconds) || 0;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const formatTalkTime = (seconds) => {
  const total = Number(seconds) || 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const formatWhen = (dateStr) => {
  if (!dateStr) return '—';
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) return '—';
  return `${dt.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  })} · ${dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
};

const phoneKey = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);

/**
 * Calls and follow-ups: the agents department's call traffic, with the
 * follow-up queue surfaced first. Callers already on the agent roster are
 * resolved by phone so a signal reads as a person rather than a number.
 */
export default function AgentCallsTab({ agents = [] }) {
  const [calls, setCalls] = useState([]);
  const [metrics, setMetrics] = useState({
    totalTalkTimeSeconds: 0,
    attendedCount: 0,
    missedCount: 0,
  });
  const [employeeMap, setEmployeeMap] = useState({});
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const agentsByPhone = useMemo(() => {
    const map = {};
    agents.forEach((agent) => {
      const key = phoneKey(agent.phone);
      if (key) map[key] = agent;
    });
    return map;
  }, [agents]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [callsData, metricsData] = await Promise.all([
        callSignalService.getAll({ department_type: DEPARTMENT }),
        callSignalService.getMetrics({ department_type: DEPARTMENT }),
      ]);

      const list = callsData.result || callsData.data || [];
      setCalls(Array.isArray(list) ? list : []);
      setMetrics(metricsData.result || metricsData.data || metricsData || {});
      setError(null);
    } catch (err) {
      console.error('Failed to fetch call signals:', err);
      setCalls([]);
      setError('Could not load the call log.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    const loadEmployees = async () => {
      try {
        const data = await employeeService.getAll();
        const list = data.data || data.employees || data || [];
        if (cancelled) return;
        const map = {};
        (Array.isArray(list) ? list : []).forEach((emp) => {
          map[String(emp.id)] = emp;
        });
        setEmployeeMap(map);
      } catch (err) {
        // The log still reads without executive names attached.
        console.error('Failed to fetch employees:', err);
      }
    };
    loadEmployees();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleCalls = useMemo(
    () =>
      calls.filter((call) => {
        if (filter === 'inbound') return call.direction === 'inbound';
        if (filter === 'outbound') return call.direction === 'outbound';
        if (filter === 'missed') return Boolean(call.missed);
        if (filter === 'pending') return call.status === 'pending';
        return true;
      }),
    [calls, filter]
  );

  const handleResolve = async (call) => {
    setBusyId(call.id);
    try {
      await callSignalService.updateStatus(call.id, 'resolved');
      await load();
    } catch (err) {
      console.error('Failed to update call status:', err);
      setError('Could not update that signal.');
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = calls.filter((c) => c.status === 'pending').length;

  const columns = [
    {
      header: 'Date & time',
      accessorKey: 'created_at',
      sortable: true,
      cell: (row) => (
        <span className="text-xs font-semibold text-[#1c1917]">
          {formatWhen(row.created_at || row.started_at)}
        </span>
      ),
    },
    {
      header: 'Contact',
      accessorKey: 'caller_name',
      sortable: true,
      cell: (row) => {
        const agent = agentsByPhone[phoneKey(row.caller_phone)];
        return (
          <div>
            <div className="font-bold text-xs text-[#1c1917]">
              {agent?.name || row.caller_name || 'Unknown caller'}
            </div>
            <div className="text-[10px] text-[#78716c]">{row.caller_phone || '—'}</div>
            {agent && (
              <div className="text-[10px] text-[#2563EB] font-bold">On the agent roster</div>
            )}
          </div>
        );
      },
    },
    {
      header: 'Direction',
      accessorKey: 'direction',
      sortable: true,
      cell: (row) => (
        <Badge variant={row.direction === 'outbound' ? 'blue' : 'green'}>
          {String(row.direction || 'unknown').toUpperCase()}
        </Badge>
      ),
    },
    {
      header: 'Executive',
      cell: (row) => (
        <span className="text-xs text-[#57534e] font-semibold">
          {employeeMap[String(row.employee_id)]?.name || '—'}
        </span>
      ),
    },
    {
      header: 'Duration',
      accessorKey: 'duration_seconds',
      sortable: true,
      cell: (row) => (
        <span className="text-xs font-semibold text-[#1c1917]">
          {formatDuration(row.duration_seconds)}
        </span>
      ),
    },
    {
      header: 'Context',
      accessorKey: 'mission_context',
      cell: (row) => (
        <span className="text-[11px] text-[#57534e] line-clamp-2">
          {row.mission_context || '—'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      sortable: true,
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <Badge
            variant={
              row.status === 'resolved' ? 'green' : row.status === 'pending' ? 'yellow' : 'gray'
            }
          >
            {String(row.status || 'logged').replace(/_/g, ' ')}
          </Badge>
          {row.missed && (
            <span className="text-[10px] font-bold text-rose-600">Missed</span>
          )}
        </div>
      ),
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <CallButton
            phone={row.caller_phone}
            recordName={row.caller_name}
            recordId={row.id}
            recordType="CALL_SIGNAL"
            variant="outline"
            onCallPlaced={load}
          />
          {row.status === 'pending' && (
            <button
              type="button"
              disabled={String(busyId) === String(row.id)}
              onClick={() => handleResolve(row)}
              className="px-2 py-1 rounded-lg bg-[#2563EB] text-white text-[11px] font-bold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-1"
            >
              {String(busyId) === String(row.id) ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3 h-3" />
              )}
              Resolve
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white p-5 rounded-2xl border border-[#e7e5e4] shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[#1c1917]">
              Calls &amp; follow-ups
            </h2>
            <p className="text-xs text-[#78716c] mt-0.5">
              Audit trail of candidate recruitment calls, onboarding follow-ups and agent
              coordination traffic
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#e7e5e4] bg-white text-xs font-bold text-[#1c1917] hover:border-[#2563EB]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          title="Total talk time"
          value={formatTalkTime(metrics.totalTalkTimeSeconds)}
          subtext="Across the department"
          variant="orange"
        />
        <StatCard
          title="Attended"
          value={metrics.attendedCount ?? 0}
          subtext="Calls connected"
          variant="green"
        />
        <StatCard title="Missed" value={metrics.missedCount ?? 0} subtext="Never connected" />
        <StatCard
          title="Needs follow-up"
          value={pendingCount}
          subtext="Still open on the queue"
        />
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl px-4 py-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-[#e7e5e4] py-16 flex items-center justify-center">
          <span className="flex items-center gap-2 text-xs font-bold text-[#78716c]">
            <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading call log…
          </span>
        </div>
      ) : (
        <DataTable
          data={visibleCalls}
          columns={columns}
          searchPlaceholder="Search by caller, number or context…"
          searchFilterKeys={['caller_name', 'caller_phone', 'mission_context']}
          emptyMessage="No call signals recorded for this filter."
          exportFileName="garuda-agent-calls.csv"
          filters={
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="p-2 rounded-lg border border-[#e7e5e4] bg-[#fafaf9] text-xs font-semibold text-[#1c1917]"
            >
              <option value="all">All signals</option>
              <option value="inbound">Inbound</option>
              <option value="outbound">Outbound</option>
              <option value="missed">Missed</option>
              <option value="pending">Needs follow-up</option>
            </select>
          }
        />
      )}
    </div>
  );
}
