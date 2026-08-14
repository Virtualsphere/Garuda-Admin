import React, { useState, useEffect } from 'react';
import callSignalService from '../../services/callSignalService';
import employeeService from '../../services/employeeService';
import callingService from '../../services/callingService';
import './FarmersCallsPage.css';

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

export default function FarmersCallsPage() {
  const [activeTab, setActiveTab] = useState('team_leader');
  const [searchQuery, setSearchQuery] = useState('');

  const [calls, setCalls] = useState([]);
  const [metrics, setMetrics] = useState({ totalTalkTimeSeconds: 0, attendedCount: 0, missedCount: 0 });
  const [squadAudit, setSquadAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialingNumber, setDialingNumber] = useState(null);
  const [callError, setCallError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [callsData, metricsData, employeesData] = await Promise.all([
          callSignalService.getAll({ department_type: 'farmers' }),
          callSignalService.getMetrics({ department_type: 'farmers' }),
          employeeService.getAll(),
        ]);
        setCalls(callsData.data || []);
        setMetrics(metricsData.data || { totalTalkTimeSeconds: 0, attendedCount: 0, missedCount: 0 });

        const empList = employeesData.data || employeesData.employees || employeesData || [];
        const squad = (Array.isArray(empList) ? empList : [])
          .filter((emp) => (emp.role || '').toLowerCase().includes('farmer') && !(emp.role || '').toLowerCase().includes('manager') && !(emp.role || '').toLowerCase().includes('head'));

        const squadMetrics = await Promise.all(
          squad.map((emp) => callSignalService.getMetrics({ department_type: 'farmers', employee_id: emp.id }))
        );

        setSquadAudit(squad.map((emp, i) => {
          const m = squadMetrics[i]?.data || { totalTalkTimeSeconds: 0, missedCount: 0 };
          const hours = Math.floor(m.totalTalkTimeSeconds / 3600);
          const mins = Math.floor((m.totalTalkTimeSeconds % 3600) / 60);
          return {
            name: emp.name?.toUpperCase(),
            time: `${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`,
            msd: String(m.missedCount),
            danger: m.missedCount >= 2,
            avatar: emp.photo || `https://i.pravatar.cc/150?u=${emp.id}`,
          };
        }));
      } catch (err) {
        console.error('Failed to fetch farmer call signals:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleDial = async (customerNumber, { callerName, missionContext, landId } = {}) => {
    if (!customerNumber || dialingNumber) return;
    setCallError(null);
    setDialingNumber(customerNumber);
    try {
      await callingService.clickToCall({
        customerNumber,
        departmentType: 'farmers',
        callerName,
        missionContext,
        landId,
      });
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to place call.';
      setCallError(message);
    } finally {
      setDialingNumber(null);
    }
  };

  const handleFabDial = () => {
    const number = window.prompt('Enter phone number to dial:');
    if (number) handleDial(number.trim(), { missionContext: 'Manual outbound dial' });
  };

  const filteredCalls = calls.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.caller_name?.toLowerCase().includes(q) || c.caller_phone?.includes(q) || c.mission_context?.toLowerCase().includes(q);
  });

  const tlData = filteredCalls.map((c) => ({
    id: c.caller_phone || 'N/A',
    name: c.caller_name?.toUpperCase() || 'UNKNOWN',
    context: c.mission_context || 'No context provided',
    exec: c.employee_id ? `EMP #${c.employee_id}` : 'UNASSIGNED',
    time: c.missed ? 'MISSED' : formatDuration(c.duration_seconds),
    subTime: formatTime(c.created_at),
    missed: c.missed,
  }));

  const execData = filteredCalls.map((c) => ({
    id: c.caller_phone || 'N/A',
    name: c.caller_name?.toUpperCase() || 'UNKNOWN',
    context: c.mission_context || 'No context provided',
    tl: 'N/A',
    exec: c.employee_id ? `EMP #${c.employee_id}` : 'UNASSIGNED',
    time: c.missed ? 'MISSED' : formatDuration(c.duration_seconds),
    subTime: formatTime(c.created_at),
    missed: c.missed,
  }));

  return (
    <div className="f-calls-page">
      {/* Sub Tabs */}
      <div className="f-calls-sub-tabs">
        <div 
          className={`f-calls-sub-tab${activeTab === 'head' ? ' active' : ''}`}
          onClick={() => setActiveTab('head')}
        >
          HEAD
        </div>
        <div 
          className={`f-calls-sub-tab${activeTab === 'team_leader' ? ' active' : ''}`}
          onClick={() => setActiveTab('team_leader')}
        >
          TEAM LEADER
        </div>
        <div 
          className={`f-calls-sub-tab${activeTab === 'executive' ? ' active' : ''}`}
          onClick={() => setActiveTab('executive')}
        >
          EXECUTIVE
        </div>
      </div>

      {/* Header */}
      <div className="f-calls-header">
        <div className="f-calls-title-group">
          <svg className="f-calls-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          <div className="f-calls-title-texts">
            <span className="f-calls-title">FARMER SIGNAL HUB</span>
            <span className="f-calls-subtitle">
              TIER: {activeTab === 'head' ? 'HEAD' : activeTab === 'team_leader' ? 'TL' : 'EXEC'} OVERSIGHT
            </span>
          </div>
        </div>
        <div className="f-calls-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Filter signals..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {/* Main Layout */}
      <div className="f-calls-layout">
        {/* Left Column */}
        <div className="f-calls-main-col">
          <div className="f-calls-card-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            SUPPORT MISSION SIGNAL LEDGER
          </div>
          <div className="f-ledger-table-wrap">
            <table className="f-ledger-table">
              <thead>
                <tr>
                  <th>SIGNAL IDENTITY</th>
                  <th>MISSION CONTEXT</th>
                  {activeTab === 'executive' && <th>TL AUDIT</th>}
                  <th>EXECUTIVE</th>
                  <th>DURATION</th>
                  <th>VOICE REGISTRY</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={activeTab === 'executive' ? 5 : 4} style={{ textAlign: 'center', padding: '24px' }}>Loading...</td></tr>
                ) : (activeTab === 'executive' ? execData : tlData).length === 0 ? (
                  <tr><td colSpan={activeTab === 'executive' ? 5 : 4} style={{ textAlign: 'center', padding: '24px' }}>No signals found.</td></tr>
                ) : (activeTab === 'executive' ? execData : tlData).map((row, idx) => (
                  <tr key={idx}>
                    <td>
                      <div className="f-ledger-identity">
                        <span className="f-ledger-name">{row.name}</span>
                        <div className="f-ledger-phone">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                            <line x1="12" y1="18" x2="12.01" y2="18" />
                          </svg>
                          {row.id}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="f-ledger-context">{row.context}</span>
                    </td>
                    {activeTab === 'executive' && (
                      <td>
                        <span className="f-ledger-tl">{row.tl}</span>
                      </td>
                    )}
                    <td>
                      <span className="f-ledger-exec">{row.exec}</span>
                    </td>
                    <td>
                      <div className="f-ledger-duration">
                        <span className={`f-ledger-dur-time ${row.missed ? 'missed' : ''}`}>{row.time}</span>
                        <span className="f-ledger-dur-sub">{row.subTime}</span>
                      </div>
                    </td>
                    <td>
                      <div className="f-ledger-voice">
                        {!row.missed && (
                          <button className="f-voice-btn play">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                          </button>
                        )}
                        <button
                          className="f-voice-btn"
                          title={`Call ${row.id}`}
                          disabled={row.id === 'N/A' || dialingNumber === row.id}
                          onClick={() => handleDial(row.id, { callerName: row.name, missionContext: row.context })}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

        {/* Right Column */}
        <div className="f-calls-side-col">
          {/* Metrics Card */}
          <div className="f-calls-card">
            <div className="f-calls-card-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              REAL-TIME SIGNAL METRICS
            </div>
            <div className="f-metrics-content">
              <div className="f-metric-label">TOTAL TALK TIME (TODAY)</div>
              <div className="f-metric-val">{formatDuration(metrics.totalTalkTimeSeconds).replace(':', 'm ')}s</div>
              <div className="f-metrics-split">
                <div className="f-metric-box">
                  <div className="f-metric-label">ATTENDED</div>
                  <div className="f-metric-stat success">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    {metrics.attendedCount}
                  </div>
                </div>
                <div className="f-metric-box">
                  <div className="f-metric-label">MISSED</div>
                  <div className="f-metric-stat danger">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                    {metrics.missedCount}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Squad Performance Audit - Only show for Team Leader / Head */}
          {(activeTab === 'team_leader' || activeTab === 'head') && (
            <div className="f-calls-card">
              <div className="f-calls-card-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                SQUAD PERFORMANCE AUDIT
              </div>
              <table className="f-squad-table">
                <thead>
                  <tr>
                    <th>STAFF</th>
                    <th>TALK TIME</th>
                    <th>MSD.</th>
                  </tr>
                </thead>
                <tbody>
                  {squadAudit.map((row, idx) => (
                    <tr key={idx}>
                      <td>
                        <div className="f-squad-staff">
                          <div className="f-squad-avatar">
                            <img src={row.avatar} alt={row.name} />
                          </div>
                          <span className="f-squad-name">{row.name}</span>
                        </div>
                      </td>
                      <td><span className="f-squad-val">{row.time}</span></td>
                      <td>
                        <span className={`f-squad-badge ${row.danger ? 'danger' : 'safe'}`}>
                          {row.msd}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Trend Chart */}
          <div className="f-calls-card" style={{ flex: 1 }}>
            <div className="f-calls-card-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              7-DAY TREND (M)
            </div>
            <div className="f-trend-content">
              <svg className="f-trend-line" viewBox="0 0 300 60" preserveAspectRatio="none">
                <path 
                  d="M0,50 Q40,50 60,35 T120,30 T180,40 T220,20 T280,50 L300,55" 
                  fill="none" 
                  stroke="var(--accent)" 
                  strokeWidth="3" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Call error toast */}
      {callError && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '24px',
            zIndex: 20,
            padding: '10px 16px',
            borderRadius: '6px',
            background: '#fee2e2',
            color: '#991b1b',
            border: '1px solid #fecaca',
          }}
        >
          {callError}
        </div>
      )}

      {/* Floating Action Button (Only in Executive view) */}
      {activeTab === 'executive' && (
        <div className="f-calls-fab" onClick={handleFabDial} style={{ cursor: dialingNumber ? 'wait' : 'pointer' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        </div>
      )}
    </div>
  );
}
