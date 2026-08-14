import React, { useState, useEffect, useRef } from 'react';
import callSignalService from '../../services/callSignalService';
import employeeService from '../../services/employeeService';
import callingService from '../../services/callingService';
import departmentLeaderService from '../../services/departmentLeaderService';
import { useAuth } from '../../context/AuthContext';
import { computeTier, isTierEnabled } from '../../utils/departmentTier';
import './LandCallsPage.css';

const formatDuration = (seconds) => {
  if (!seconds) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const formatTalkTime = (seconds) => {
  if (!seconds) return '0m 0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
};

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const formatLandCode = (landId) =>
  landId ? `LC${String(landId).padStart(3, '0')}` : null;

export default function LandCallsPage() {
  const { user } = useAuth();

  const [userTier, setUserTier] = useState('executive');
  const [activeTab, setActiveTab] = useState('executive');
  const [searchQuery, setSearchQuery] = useState('');

  const [calls, setCalls] = useState([]);
  const [metrics, setMetrics] = useState({ totalTalkTimeSeconds: 0, attendedCount: 0, missedCount: 0 });
  const [squadAudit, setSquadAudit] = useState([]);
  const [empById, setEmpById] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [dialingNumber, setDialingNumber] = useState(null);
  const [callError, setCallError] = useState(null);
  const errorTimer = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [callsData, metricsData, treeData, employeesData] = await Promise.all([
          callSignalService.getAll({ department_type: 'land' }),
          callSignalService.getMetrics({ department_type: 'land' }),
          departmentLeaderService.getTree('land'),
          employeeService.getAll(),
        ]);

        setCalls(callsData.data || []);
        setMetrics(metricsData.data || { totalTalkTimeSeconds: 0, attendedCount: 0, missedCount: 0 });

        const tree = treeData.data || [];
        const tier = computeTier(tree, user?.id);
        setUserTier(tier);
        setActiveTab(tier);

        const empList = employeesData.data || employeesData.employees || employeesData || [];
        const empMap = new Map((Array.isArray(empList) ? empList : []).map((e) => [e.id, e]));
        setEmpById(empMap);

        if (tier === 'team_leader' || tier === 'head') {
          const rosterData = await departmentLeaderService.getRoster(user.id, 'land');
          const roster = rosterData.data || [];

          const squadMetrics = await Promise.all(
            roster.map((r) => callSignalService.getMetrics({ department_type: 'land', employee_id: r.employee_id }))
          );

          setSquadAudit(
            roster.map((r, i) => {
              const emp = empMap.get(r.employee_id);
              const m = squadMetrics[i]?.data || { totalTalkTimeSeconds: 0, missedCount: 0 };
              const hours = Math.floor(m.totalTalkTimeSeconds / 3600);
              const mins = Math.floor((m.totalTalkTimeSeconds % 3600) / 60);
              return {
                name: (emp?.name || `EMP #${r.employee_id}`).toUpperCase(),
                time: `${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`,
                msd: String(m.missedCount),
                danger: m.missedCount >= 2,
                avatar: emp?.photo || `https://i.pravatar.cc/150?u=${r.employee_id}`,
              };
            })
          );
        }
      } catch (err) {
        console.error('Failed to fetch land call signals:', err);
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) fetchData();
  }, [user?.id]);

  const handleDial = async (customerNumber, { callerName, missionContext, landId } = {}) => {
    if (!customerNumber || dialingNumber) return;
    setCallError(null);
    setDialingNumber(customerNumber);
    try {
      await callingService.clickToCall({
        customerNumber,
        departmentType: 'land',
        callerName,
        missionContext,
        landId,
      });
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to place call.';
      setCallError(message);
      clearTimeout(errorTimer.current);
      errorTimer.current = setTimeout(() => setCallError(null), 4000);
    } finally {
      setDialingNumber(null);
    }
  };

  const filteredCalls = calls.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.caller_name?.toLowerCase().includes(q) ||
      c.caller_phone?.includes(q) ||
      c.mission_context?.toLowerCase().includes(q)
    );
  });

  const ledgerRows = filteredCalls.map((c) => {
    const emp = empById.get(c.employee_id);
    return {
      phone: c.caller_phone || 'N/A',
      name: c.caller_name?.toUpperCase() || 'UNKNOWN',
      landCode: formatLandCode(c.land_id),
      context: c.mission_context || 'No context provided',
      execName: emp?.name?.toUpperCase() || (c.employee_id ? `EMP #${c.employee_id}` : 'UNASSIGNED'),
      execId: c.employee_id,
      time: c.missed ? 'MISSED' : formatDuration(c.duration_seconds),
      subTime: formatTime(c.created_at),
      missed: c.missed,
      landId: c.land_id,
    };
  });

  const showExecutiveCol = activeTab === 'team_leader' || activeTab === 'head';
  const colSpan = showExecutiveCol ? 5 : 4;
  const tierLabel = activeTab === 'head' ? 'HEAD' : activeTab === 'team_leader' ? 'TL' : 'EXEC';

  const TIER_LABELS = { head: 'HEAD', team_leader: 'TEAM LEADER', executive: 'EXECUTIVE' };

  return (
    <div className="lc-page">
      {/* ── Tier Tabs ── */}
      <div className="lc-sub-tabs">
        {['head', 'team_leader', 'executive'].map((tier) => {
          const enabled = isTierEnabled(tier, userTier);
          return (
            <div
              key={tier}
              className={`lc-sub-tab${activeTab === tier ? ' active' : ''}${!enabled ? ' disabled' : ''}`}
              onClick={() => enabled && setActiveTab(tier)}
            >
              {TIER_LABELS[tier]}
            </div>
          );
        })}
      </div>

      {/* ── Page Header ── */}
      <div className="lc-header">
        <div className="lc-title-group">
          <div className="lc-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </div>
          <div className="lc-title-texts">
            <span className="lc-title">LANDS SIGNAL HUB</span>
            <span className="lc-subtitle">TIER: {tierLabel} OVERSIGHT</span>
          </div>
        </div>
        <div className="lc-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Filter signals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* ── Two-Column Layout ── */}
      <div className="lc-layout">

        {/* ── Left: Signal Ledger ── */}
        <div className="lc-main-col">
          <div className="lc-card-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            LANDS MISSION SIGNAL LEDGER
          </div>

          <div className="lc-ledger-wrap">
            <table className="lc-ledger-table">
              <thead>
                <tr>
                  <th>SIGNAL IDENTITY</th>
                  <th>MISSION CONTEXT</th>
                  {showExecutiveCol && <th>EXECUTIVE</th>}
                  <th>DURATION</th>
                  <th>VOICE REGISTRY</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={colSpan}>
                      <div className="lc-state-row">
                        <div className="lc-spinner" />
                        Loading signals...
                      </div>
                    </td>
                  </tr>
                ) : ledgerRows.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan}>
                      <div className="lc-state-row">No signals found.</div>
                    </td>
                  </tr>
                ) : (
                  ledgerRows.map((row, idx) => (
                    <tr key={idx} className={row.missed ? 'missed-row' : ''}>
                      <td>
                        <div className="lc-identity">
                          <span className="lc-caller-name">{row.name}</span>
                          <span className="lc-caller-phone">{row.phone}</span>
                          {row.landCode && (
                            <span className="lc-land-badge">{row.landCode}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="lc-context">{row.context}</span>
                      </td>
                      {showExecutiveCol && (
                        <td>
                          <span className="lc-exec-name">{row.execName}</span>
                        </td>
                      )}
                      <td>
                        <div className="lc-duration">
                          <span className={`lc-dur-time${row.missed ? ' missed' : ''}`}>{row.time}</span>
                          <span className="lc-dur-sub">{row.subTime}</span>
                        </div>
                      </td>
                      <td>
                        <div className="lc-voice-btns">
                          {!row.missed && (
                            <button className="lc-voice-btn play" disabled title="Recording not available">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                                <polygon points="5 3 19 12 5 21 5 3" />
                              </svg>
                            </button>
                          )}
                          <button
                            className={`lc-voice-btn call${dialingNumber === row.phone ? ' dialing' : ''}`}
                            title={`Call ${row.phone}`}
                            disabled={row.phone === 'N/A' || dialingNumber === row.phone}
                            onClick={() => handleDial(row.phone, {
                              callerName: row.name,
                              missionContext: row.context,
                              landId: row.landId,
                            })}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Right: Sidebar ── */}
        <div className="lc-side-col">

          {/* Metrics Card */}
          <div className="lc-card">
            <div className="lc-card-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              LANDS SIGNAL METRICS
            </div>
            <div className="lc-metrics-body">
              <div className="lc-metric-label">LANDS TALK TIME (TODAY)</div>
              <div className="lc-metric-talk">{formatTalkTime(metrics.totalTalkTimeSeconds)}</div>
              <div className="lc-metrics-row">
                <div className="lc-metric-box">
                  <div className="lc-metric-label">ATTENDED</div>
                  <div className="lc-metric-stat success">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="9 12 11 14 15 10" />
                    </svg>
                    <span>{metrics.attendedCount}</span>
                  </div>
                </div>
                <div className="lc-metric-divider" />
                <div className="lc-metric-box">
                  <div className="lc-metric-label">MISSED</div>
                  <div className="lc-metric-stat danger">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                    <span>{metrics.missedCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Squad Performance Audit — TL / Head only */}
          {showExecutiveCol && (
            <div className="lc-card">
              <div className="lc-card-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                SQUAD PERFORMANCE AUDIT
              </div>
              <table className="lc-squad-table">
                <thead>
                  <tr>
                    <th>STAFF</th>
                    <th>TALK TIME</th>
                    <th>MSD.</th>
                  </tr>
                </thead>
                <tbody>
                  {squadAudit.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '11px' }}>
                        No direct reports found.
                      </td>
                    </tr>
                  ) : (
                    squadAudit.map((row, idx) => (
                      <tr key={idx}>
                        <td>
                          <div className="lc-squad-staff">
                            <div className="lc-squad-avatar">
                              <img src={row.avatar} alt={row.name} />
                            </div>
                            <span className="lc-squad-name">{row.name}</span>
                          </div>
                        </td>
                        <td><span className="lc-squad-val">{row.time}</span></td>
                        <td>
                          <span className={`lc-squad-badge ${row.danger ? 'danger' : 'safe'}`}>
                            {row.msd}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* 7-Day Trend */}
          <div className="lc-card lc-trend-card">
            <div className="lc-card-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              7-DAY TREND (M)
            </div>
            <div className="lc-trend-body">
              <svg className="lc-trend-svg" viewBox="0 0 300 70" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,55 Q50,55 80,38 T160,28 T230,42 T300,18"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M0,55 Q50,55 80,38 T160,28 T230,42 T300,18 L300,70 L0,70 Z"
                  fill="url(#trendGrad)"
                />
                {/* Day dots */}
                {[
                  [0, 55], [50, 50], [100, 38], [150, 30], [200, 36], [250, 25], [300, 18]
                ].map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r="3" fill="var(--accent)" opacity="0.7" />
                ))}
              </svg>
              <div className="lc-trend-labels">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <span key={i}>{d}</span>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Error toast */}
      {callError && (
        <div className="lc-toast error">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {callError}
        </div>
      )}
    </div>
  );
}
