import React, { useState, useEffect } from 'react';
import callSignalService from '../../services/callSignalService';
import employeeService from '../../services/employeeService';
import './SignalAuditHub.css';

const formatDuration = (seconds) => {
  if (!seconds) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

export default function SignalAuditHub() {
  const [activeRole, setActiveRole] = useState('executive');
  const [toggleActive, setToggleActive] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [calls, setCalls] = useState([]);
  const [inboundSignalsData, setInboundSignalsData] = useState([]);
  const [metrics, setMetrics] = useState({ totalTalkTimeSeconds: 0, attendedCount: 0, missedCount: 0 });
  const [employeeMap, setEmployeeMap] = useState({});
  const [loading, setLoading] = useState(true);

  const isTeamLeader = activeRole === 'teamLeader';
  const tierText = isTeamLeader ? 'TL OVERSIGHT' : 'EXEC OVERSIGHT';

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

  const fetchCalls = async () => {
    setLoading(true);
    try {
      const [callsData, metricsData, inboundData] = await Promise.all([
        callSignalService.getAll({ department_type: 'callcenter' }),
        callSignalService.getMetrics({ department_type: 'callcenter' }),
        callSignalService.getAll({ department_type: 'callcenter', direction: 'inbound', status: 'pending' }),
      ]);
      setCalls(callsData.data || []);
      setMetrics(metricsData.data || { totalTalkTimeSeconds: 0, attendedCount: 0, missedCount: 0 });
      setInboundSignalsData(inboundData.data || []);
    } catch (err) {
      console.error('Failed to fetch call signals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, []);

  const handleSimulateSignal = async () => {
    try {
      await callSignalService.create({
        department_type: 'callcenter',
        direction: Math.random() > 0.5 ? 'inbound' : 'outbound',
        caller_name: 'SIMULATED CALLER',
        caller_phone: '9800000000',
        caller_type: 'farmer',
        mission_context: 'Simulated signal for testing',
        duration_seconds: Math.floor(Math.random() * 400),
        missed: Math.random() > 0.7,
      });
      fetchCalls();
    } catch (err) {
      console.error('Failed to simulate signal:', err);
    }
  };

  const handleInboundAction = async (id, status) => {
    try {
      await callSignalService.updateStatus(id, status);
      fetchCalls();
    } catch (err) {
      console.error('Failed to update inbound signal:', err);
    }
  };

  const signalData = calls
    .filter((c) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return c.caller_name?.toLowerCase().includes(q) || c.caller_phone?.includes(q) || c.mission_context?.toLowerCase().includes(q);
    })
    .map((c) => ({
      id: c.id,
      name: c.caller_name?.toUpperCase() || 'UNKNOWN',
      phone: c.caller_phone || 'N/A',
      code: `C${String(c.id).padStart(3, '0')}`,
      callerType: (c.caller_type || 'UNKNOWN').toUpperCase(),
      callerTag: (c.caller_type || 'unknown').toLowerCase(),
      dept: `DEPT: ${c.department_type?.toUpperCase() || 'GENERAL'}`,
      mission: c.mission_context || 'No context provided',
      executive: employeeMap[c.employee_id] || 'UNASSIGNED',
      duration: c.missed ? 'MISSED' : formatDuration(c.duration_seconds),
      timestamp: formatTime(c.created_at),
      missed: c.missed,
    }));

  const inboundSignals = inboundSignalsData.map((s) => ({
    id: s.id,
    name: s.caller_name?.toUpperCase() || 'UNKNOWN',
    location: s.department_type?.toUpperCase() || 'GENERAL',
    message: s.mission_context ? `"${s.mission_context}"` : 'No message provided.',
    badge: (s.caller_type || 'SIGNAL').toUpperCase(),
  }));

  return (
    <div className="signal-audit-page">
      {/* Header */}
      <div className="signal-header">
        {/* Role Tabs */}
        <div className="role-tabs">
          <button
            className={`role-tab${activeRole === 'head' ? ' active-blue' : ''}`}
            onClick={() => setActiveRole('head')}
          >
            Head
          </button>
          <button
            className={`role-tab${activeRole === 'teamLeader' ? ' active-blue' : ''}`}
            onClick={() => setActiveRole('teamLeader')}
          >
            Team Leader
          </button>
          <button
            className={`role-tab${activeRole === 'executive' ? ' active' : ''}`}
            onClick={() => setActiveRole('executive')}
          >
            Executive
          </button>
        </div>

        {/* Title Row */}
        <div className="title-row">
          <div className="title-left">
            <div className="title-main">
              <div className="title-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </div>
              <h2>SIGNAL AUDIT HUB</h2>
            </div>
            <div className="title-tier">TIER: {tierText}</div>
          </div>
          <div className="title-right">
            <div className="search-input">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input type="text" placeholder="Filter signals..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <button className="simulate-btn" onClick={handleSimulateSignal}>Simulate Signal</button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="content-area">
        {/* Signal Ledger */}
        <div className="signal-ledger">
          <div className="ledger-header">
            <span className="ledger-header-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </span>
            <h3>Inbound Signal Ledger</h3>
          </div>

          <div className="ledger-table-wrap">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Signal Identity</th>
                  <th>Caller Type</th>
                  <th>Mission Context</th>
                  {isTeamLeader && <th>Executive</th>}
                  <th>Duration</th>
                  <th>Voice Registry</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={isTeamLeader ? 5 : 4} style={{ textAlign: 'center', padding: '24px' }}>Loading...</td></tr>
                ) : signalData.length === 0 ? (
                  <tr><td colSpan={isTeamLeader ? 5 : 4} style={{ textAlign: 'center', padding: '24px' }}>No signals found.</td></tr>
                ) : signalData.map((signal) => (
                  <tr key={signal.id}>
                    <td>
                      <div className="signal-identity">
                        <span className="signal-name">{signal.name}</span>
                        <span className="signal-phone">{signal.phone}</span>
                        <span className="signal-code">{signal.code}</span>
                      </div>
                    </td>
                    <td>
                      <div className="caller-type">
                        <span className={`caller-tag ${signal.callerTag}`}>
                          <CallerIcon />
                          {signal.callerType}
                        </span>
                        <span className="caller-dept">{signal.dept}</span>
                      </div>
                    </td>
                    <td>
                      <span className="mission-context">{signal.mission}</span>
                    </td>
                    {isTeamLeader && (
                      <td>
                        <span className="executive-name">{signal.executive}</span>
                      </td>
                    )}
                    <td>
                      <div className="duration-cell">
                        <span className={`duration-time${signal.missed ? ' missed' : ''}`}>
                          {signal.duration}
                        </span>
                        <span className="duration-timestamp">{signal.timestamp}</span>
                      </div>
                    </td>
                    <td>
                      <div className="voice-registry">
                        {!signal.missed && (
                          <button className="voice-btn voice-play">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                          </button>
                        )}
                        <button className="voice-btn voice-call">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Panel */}
        <div className="right-panel">
          {/* Real-Time Metrics */}
          <div className="metrics-card">
            <div className="metrics-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <h3>Real-Time Signal Metrics</h3>
            </div>

            <div className="metrics-label">Global Talk Time (Today)</div>
            <div className="metrics-value">{formatDuration(metrics.totalTalkTimeSeconds).replace(':', 'm ')}s</div>

            <div className="metrics-stats">
              <div className="metric-stat">
                <span className="metric-stat-label">Attended</span>
                <span className="metric-stat-value attended">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="9 12 12 15 16 10" />
                  </svg>
                  {metrics.attendedCount}
                </span>
              </div>
              <div className="metric-stat">
                <span className="metric-stat-label">Missed</span>
                <span className="metric-stat-value missed">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  {metrics.missedCount}
                </span>
              </div>
            </div>
          </div>

          {/* 7-Day Performance Trend */}
          <div className="performance-section">
            <div className="performance-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              7-Day Performance Trend
            </div>
          </div>

          {/* Inbound Signals */}
          <div className="inbound-signals">
            <div className="inbound-signals-header">
              <div className="inbound-signals-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                Inbound Signals ({inboundSignals.length})
              </div>
              <div className="inbound-signals-actions">
                <button className="inbound-signal-action-btn">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </button>
                <div
                  className={`toggle-switch${toggleActive ? ' active' : ''}`}
                  onClick={() => setToggleActive(!toggleActive)}
                >
                  <div className="toggle-knob" />
                </div>
                <button className="inbound-signal-action-btn">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="signal-cards">
              {inboundSignals.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>No pending inbound signals.</div>
              ) : inboundSignals.map((signal) => (
                <div className="signal-card" key={signal.id}>
                  <span className="signal-card-badge">{signal.badge}</span>
                  <div className="signal-card-name">{signal.name}</div>
                  <div className="signal-card-location">
                    <span className="dot" />
                    {signal.location}
                  </div>
                  <div className="signal-card-message">{signal.message}</div>
                  <div className="signal-card-actions">
                    <button className="call-now-btn" onClick={() => handleInboundAction(signal.id, 'attended')}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      Call Now
                    </button>
                    <button className="signal-action-btn" onClick={() => handleInboundAction(signal.id, 'attended')}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </button>
                    <button className="signal-action-btn" onClick={() => handleInboundAction(signal.id, 'dismissed')}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CallerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
