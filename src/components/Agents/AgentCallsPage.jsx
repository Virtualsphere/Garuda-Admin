import React, { useState, useEffect, useCallback, useMemo } from 'react';
import callSignalService from '../../services/callSignalService';
import callingService from '../../services/callingService';
import agentService from '../../services/agentService';
import employeeService from '../../services/employeeService';
import './AgentCallsPage.css';

const DEPARTMENT = 'agents';

const FILTERS = [
  { key: 'all', label: 'All signals' },
  { key: 'inbound', label: 'Inbound' },
  { key: 'outbound', label: 'Outbound' },
  { key: 'missed', label: 'Missed' },
  { key: 'pending', label: 'Needs follow-up' },
];

const formatDuration = (seconds) => {
  if (!seconds) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const formatWhen = (dateStr) => {
  if (!dateStr) return '—';
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) return '—';
  return `${dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} · ${dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
};

const formatTalkTime = (seconds) => {
  const total = Number(seconds) || 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const phoneKey = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);

export default function AgentCallsPage() {
  const [calls, setCalls] = useState([]);
  const [metrics, setMetrics] = useState({ totalTalkTimeSeconds: 0, attendedCount: 0, missedCount: 0 });
  const [agentsByPhone, setAgentsByPhone] = useState({});
  const [employeeMap, setEmployeeMap] = useState({});
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialingId, setDialingId] = useState(null);

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [callsData, metricsData] = await Promise.all([
        callSignalService.getAll({ department_type: DEPARTMENT }),
        callSignalService.getMetrics({ department_type: DEPARTMENT }),
      ]);
      const list = callsData.data || callsData.result || [];
      setCalls(Array.isArray(list) ? list : []);
      setMetrics(metricsData.data || { totalTalkTimeSeconds: 0, attendedCount: 0, missedCount: 0 });
    } catch (err) {
      console.error('Failed to fetch agent call signals:', err);
      setError('Could not load call signals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCalls(); }, [fetchCalls]);

  // Call rows store only a phone number. Resolve it against the agent roster so
  // a known caller shows their name and code instead of a bare number.
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const data = await agentService.getAll();
        const list = data.result || data.data || [];
        const map = {};
        (Array.isArray(list) ? list : []).forEach((a) => {
          const key = phoneKey(a.phone);
          if (key) map[key] = a;
        });
        setAgentsByPhone(map);
      } catch (err) {
        console.error('Failed to fetch agents for call matching:', err);
      }
    };
    fetchAgents();
  }, []);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const data = await employeeService.getAll();
        const list = data.data || data.employees || data || [];
        const map = {};
        (Array.isArray(list) ? list : []).forEach((emp) => { map[emp.id] = emp.name; });
        setEmployeeMap(map);
      } catch (err) {
        console.error('Failed to fetch employees:', err);
      }
    };
    fetchEmployees();
  }, []);

  const visibleCalls = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return calls.filter((call) => {
      if (activeFilter === 'inbound' && call.direction !== 'inbound') return false;
      if (activeFilter === 'outbound' && call.direction !== 'outbound') return false;
      if (activeFilter === 'missed' && !call.missed) return false;
      if (activeFilter === 'pending' && call.status !== 'pending') return false;

      if (!q) return true;
      const agent = agentsByPhone[phoneKey(call.caller_phone)];
      return [call.caller_name, call.caller_phone, call.mission_context, agent?.name]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q));
    });
  }, [calls, activeFilter, searchQuery, agentsByPhone]);

  const handleRedial = async (call) => {
    if (!call.caller_phone) return;
    setDialingId(call.id);
    try {
      await callingService.clickToCall({
        customerNumber: call.caller_phone,
        departmentType: DEPARTMENT,
        callerName: call.caller_name || 'Agent',
        missionContext: `Redial — ${call.mission_context || 'agent follow-up'}`,
      });
      await fetchCalls();
    } catch (err) {
      console.error('Redial failed:', err);
      setError('Could not place the call. Check the number and try again.');
    } finally {
      setDialingId(null);
    }
  };

  const handleResolve = async (call) => {
    try {
      await callSignalService.updateStatus(call.id, 'resolved');
      await fetchCalls();
    } catch (err) {
      console.error('Failed to update call status:', err);
      setError('Could not update that signal.');
    }
  };

  const pendingCount = calls.filter((c) => c.status === 'pending').length;

  return (
    <div className="acp-page">
      {/* Header */}
      <div className="acp-header">
        <div className="acp-title-group">
          <svg className="acp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          <div className="acp-title-texts">
            <span className="acp-title">AGENT SIGNAL LOG</span>
            <span className="acp-subtitle">CALL TRAFFIC AND FOLLOW-UP QUEUE</span>
          </div>
        </div>
        <button type="button" className="acp-refresh" onClick={fetchCalls} disabled={loading}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Metric tiles */}
      <div className="acp-metrics">
        <div className="acp-metric">
          <span className="acp-metric-label">Total talk time</span>
          <span className="acp-metric-value">{formatTalkTime(metrics.totalTalkTimeSeconds)}</span>
        </div>
        <div className="acp-metric">
          <span className="acp-metric-label">Attended</span>
          <span className="acp-metric-value">{metrics.attendedCount || 0}</span>
        </div>
        <div className="acp-metric acp-metric-warn">
          <span className="acp-metric-label">Missed</span>
          <span className="acp-metric-value">{metrics.missedCount || 0}</span>
        </div>
        <div className="acp-metric acp-metric-accent">
          <span className="acp-metric-label">Needs follow-up</span>
          <span className="acp-metric-value">{pendingCount}</span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="acp-toolbar">
        <div className="acp-filters">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`acp-filter${activeFilter === f.key ? ' active' : ''}`}
              onClick={() => setActiveFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="acp-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            id="acp-search-input"
            type="text"
            placeholder="Name, number or context…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {error && <div className="acp-error">{error}</div>}

      {/* Call list */}
      <div className="acp-list-wrap">
        {loading ? (
          <div className="acp-empty">Loading call signals…</div>
        ) : visibleCalls.length === 0 ? (
          <div className="acp-empty">
            {calls.length === 0
              ? 'No agent calls recorded yet. Calls placed from an agent profile appear here.'
              : 'No signals match this filter.'}
          </div>
        ) : (
          <table className="acp-table">
            <thead>
              <tr>
                <th>Caller</th>
                <th>Context</th>
                <th>Handled by</th>
                <th>When</th>
                <th className="acp-num">Duration</th>
                <th>Status</th>
                <th aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              {visibleCalls.map((call) => {
                const agent = agentsByPhone[phoneKey(call.caller_phone)];
                return (
                  <tr key={call.id}>
                    <td>
                      <div className="acp-caller">
                        <span className="acp-caller-name">
                          {agent?.name || call.caller_name || 'Unknown caller'}
                        </span>
                        <span className="acp-caller-sub">
                          {agent && <span className="acp-known">AG{String(agent.id).padStart(5, '0')}</span>}
                          {call.caller_phone || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="acp-context">{call.mission_context || '—'}</td>
                    <td>{employeeMap[call.employee_id] || '—'}</td>
                    <td className="acp-when">{formatWhen(call.created_at)}</td>
                    <td className="acp-num">{formatDuration(call.duration_seconds)}</td>
                    <td>
                      <span className={`acp-pill acp-pill-${call.direction || 'outbound'}`}>
                        {call.direction === 'inbound' ? 'In' : 'Out'}
                      </span>
                      {call.missed && <span className="acp-pill acp-pill-missed">Missed</span>}
                      {call.status === 'pending' && <span className="acp-pill acp-pill-pending">Pending</span>}
                    </td>
                    <td>
                      <div className="acp-row-actions">
                        <button
                          type="button"
                          className="acp-row-btn"
                          onClick={() => handleRedial(call)}
                          disabled={dialingId === call.id || !call.caller_phone}
                        >
                          {dialingId === call.id ? 'Dialling…' : 'Call back'}
                        </button>
                        {call.status === 'pending' && (
                          <button
                            type="button"
                            className="acp-row-btn acp-row-btn-ghost"
                            onClick={() => handleResolve(call)}
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
