import React, { useState, useEffect, useMemo } from 'react';
import employeeService from '../../services/employeeService';
import departmentLeaderService from '../../services/departmentLeaderService';
import './LandHierarchyPage.css';

const DEPARTMENT_TYPE = 'land';

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
};

export default function LandHierarchyPage() {
  const [activeAllotTab, setActiveAllotTab] = useState('lve');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rosters, setRosters] = useState({}); // { [leaderId]: [{ employee_id }, ...] }
  const [staged, setStaged] = useState({}); // { [leaderId]: [employeeId, ...] }
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [dragOverZone, setDragOverZone] = useState(null); // 'pool' | `leader-${id}`
  const [actionError, setActionError] = useState('');

  const teamLeaders = useMemo(
    () => employees.filter((emp) => (emp.role || '').toLowerCase().includes('team leader')),
    [employees]
  );
  const teamLeaderIds = useMemo(() => teamLeaders.map((tl) => tl.id).join(','), [teamLeaders]);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const data = await employeeService.getAll();
        const empList = data.data || data.employees || data || [];
        setEmployees(Array.isArray(empList) ? empList : []);
      } catch (err) {
        console.error('Failed to fetch land department employees:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  const fetchRosters = async () => {
    if (!teamLeaderIds) {
      setRosters({});
      return;
    }
    try {
      const ids = teamLeaderIds.split(',');
      const results = await Promise.all(
        ids.map((id) => departmentLeaderService.getRoster(id, DEPARTMENT_TYPE))
      );
      const next = {};
      ids.forEach((id, idx) => {
        next[id] = results[idx].data || [];
      });
      setRosters(next);
    } catch (err) {
      console.error('Failed to fetch land team leader rosters:', err);
    }
  };

  useEffect(() => {
    fetchRosters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamLeaderIds]);

  const rosteredIds = new Set(Object.values(rosters).flat().map((r) => r.employee_id));
  const stagedIds = new Set(Object.values(staged).flat());
  const teamLeaderIdSet = new Set(teamLeaders.map((tl) => tl.id));

  const poolExecutives = employees.filter(
    (emp) => !teamLeaderIdSet.has(emp.id) && !rosteredIds.has(emp.id) && !stagedIds.has(emp.id)
  );

  const totalStaged = Object.values(staged).reduce((sum, arr) => sum + arr.length, 0);

  const stage = (leaderId, employeeId) => {
    setStaged((prev) => {
      const current = prev[leaderId] || [];
      if (current.includes(employeeId)) return prev;
      return { ...prev, [leaderId]: [...current, employeeId] };
    });
  };

  const unstage = (leaderId, employeeId) => {
    setStaged((prev) => ({
      ...prev,
      [leaderId]: (prev[leaderId] || []).filter((id) => id !== employeeId),
    }));
  };

  const handleRemove = async (leaderId, employeeId) => {
    setRemovingId(employeeId);
    setActionError('');
    try {
      await departmentLeaderService.removeAllotment(employeeId, DEPARTMENT_TYPE);
      await fetchRosters();
    } catch (err) {
      console.error('Failed to remove allotment:', err);
      setActionError('Could not remove this executive from the roster. The allotment service may be unavailable.');
    } finally {
      setRemovingId(null);
    }
  };

  const handleSaveAllotment = async () => {
    if (totalStaged === 0 || saving) return;
    setSaving(true);
    setActionError('');
    try {
      const jobs = [];
      Object.entries(staged).forEach(([leaderId, employeeIds]) => {
        employeeIds.forEach((employeeId) => {
          jobs.push(departmentLeaderService.setAllotment(employeeId, leaderId, DEPARTMENT_TYPE));
        });
      });
      await Promise.all(jobs);
      setStaged({});
      await fetchRosters();
    } catch (err) {
      console.error('Failed to save land allotment:', err);
      setActionError('Could not save the allotment. The allotment service may be unavailable — your selections are still staged.');
    } finally {
      setSaving(false);
    }
  };

  const handleDragStart = (e, employeeId, source, leaderId) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ id: employeeId, source, leaderId }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleLeaderDrop = (e, leaderId) => {
    e.preventDefault();
    setDragOverZone(null);
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    const { id, source } = JSON.parse(raw);
    if (source === 'pool') stage(leaderId, id);
  };

  const handlePoolDrop = (e) => {
    e.preventDefault();
    setDragOverZone(null);
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    const { id, source, leaderId } = JSON.parse(raw);
    if (source === 'staged') unstage(leaderId, id);
    else if (source === 'committed') handleRemove(leaderId, id);
  };

  return (
    <div className="land-hierarchy-page">
      {/* Allotment Sub-tabs */}
      <div className="allotment-sub-tabs">
        <button
          className={`allotment-sub-tab${activeAllotTab === 'lve' ? ' active' : ''}`}
          onClick={() => setActiveAllotTab('lve')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          LVE Allotment
        </button>
        <button
          className={`allotment-sub-tab${activeAllotTab === 'field' ? ' active' : ''}`}
          onClick={() => setActiveAllotTab('field')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          Field Allotment
        </button>
      </div>

      {activeAllotTab !== 'lve' ? (
        <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Field allotment coming soon...</div>
      ) : (
        <>
          {/* Header */}
          <div className="land-hier-header">
            <div className="land-hier-title-section">
              <div className="land-hier-title-main">
                <div className="land-hier-title-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                </div>
                <h2>LAND FORCE ALLOTMENT REGISTRY</h2>
              </div>
              <div className="land-hier-subtitle">Strategic Command Linking: Lands Department</div>
            </div>
          </div>

          {/* Command Hub Bar */}
          <div className="command-hub-bar">
            <div className="command-hub-info">
              <span className="command-hub-title">TEAM LEADER COMMAND HUB</span>
              <span className="command-hub-desc">Attach Verification Executives to Team Leaders</span>
            </div>
            <button
              type="button"
              className="save-allotment-btn"
              onClick={handleSaveAllotment}
              disabled={saving || totalStaged === 0}
              style={{ opacity: saving || totalStaged === 0 ? 0.5 : 1 }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              {saving ? 'Saving...' : totalStaged ? `Save Allotment (${totalStaged})` : 'Save Allotment'}
            </button>
          </div>

          {actionError && <div className="land-hier-error-banner">{actionError}</div>}

          {/* Content */}
          <div className="land-hier-content">
            {/* Team Leader Cards */}
            <div className="tl-cards-area">
              {loading ? (
                <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Loading team leaders...</div>
              ) : teamLeaders.length === 0 ? (
                <div style={{ padding: '20px', color: 'var(--text-muted)' }}>No land verification team leaders found.</div>
              ) : teamLeaders.map((tl) => {
                const rosterEmployees = (rosters[tl.id] || [])
                  .map((r) => employees.find((e) => e.id === r.employee_id))
                  .filter(Boolean);
                const stagedEmployees = (staged[tl.id] || [])
                  .map((id) => employees.find((e) => e.id === id))
                  .filter(Boolean);
                const activeCount = rosterEmployees.length + stagedEmployees.length;
                const zoneKey = `leader-${tl.id}`;
                return (
                  <div className="tl-card" key={tl.id}>
                    <div className="tl-card-header">
                      <div className="tl-avatar">{getInitials(tl.name)}</div>
                      <div className="tl-info">
                        <div className="tl-name-row">
                          <span className="tl-name-icon">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                            </svg>
                          </span>
                          <span className="tl-name">{tl.name}</span>
                        </div>
                        <span className="tl-role">{tl.role}</span>
                      </div>
                    </div>
                    <div className="tl-card-body">
                      <div className="tl-reporting-row">
                        <span className="tl-reporting-label">Active Reporting Line</span>
                        <span className="tl-reporting-badge">{activeCount} Active</span>
                      </div>
                      <div className="tl-reporting-bar">
                        <div className="tl-reporting-bar-fill" style={{ width: activeCount > 0 ? '100%' : '0%' }} />
                      </div>
                      <div
                        className={`tl-drop-zone${dragOverZone === zoneKey ? ' drag-over' : ''}${activeCount > 0 ? ' has-items' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setDragOverZone(zoneKey); }}
                        onDragLeave={() => setDragOverZone((z) => (z === zoneKey ? null : z))}
                        onDrop={(e) => handleLeaderDrop(e, tl.id)}
                      >
                        {activeCount === 0 ? (
                          <>
                            <div className="tl-drop-icon">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                              </svg>
                            </div>
                            <span className="tl-drop-text">Drop to Allot</span>
                          </>
                        ) : (
                          <>
                            {rosterEmployees.map((person) => (
                              <div
                                className="tl-roster-item"
                                key={person.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, person.id, 'committed', tl.id)}
                              >
                                <div className="tl-roster-avatar">{getInitials(person.name)}</div>
                                <div className="tl-roster-info">
                                  <span className="tl-roster-name">{person.name}</span>
                                  <span className="tl-roster-role">{person.role}</span>
                                </div>
                                <button
                                  type="button"
                                  className="tl-roster-remove"
                                  onClick={() => handleRemove(tl.id, person.id)}
                                  disabled={removingId === person.id}
                                  title="Remove from roster"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            {stagedEmployees.map((person) => (
                              <div
                                className="tl-roster-item pending"
                                key={person.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, person.id, 'staged', tl.id)}
                              >
                                <div className="tl-roster-avatar">{getInitials(person.name)}</div>
                                <div className="tl-roster-info">
                                  <span className="tl-roster-name">{person.name}</span>
                                  <span className="tl-roster-role">{person.role} · Pending</span>
                                </div>
                                <button
                                  type="button"
                                  className="tl-roster-remove"
                                  onClick={() => unstage(tl.id, person.id)}
                                  title="Unstage"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Force Pool */}
            <div className="land-pool-section">
              <div className="land-pool-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Pool: LVEs
              </div>
              <div
                className={`land-pool-list${dragOverZone === 'pool' ? ' drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOverZone('pool'); }}
                onDragLeave={() => setDragOverZone((z) => (z === 'pool' ? null : z))}
                onDrop={handlePoolDrop}
              >
                {loading ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading pool...</div>
                ) : poolExecutives.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No available force pool.</div>
                ) : poolExecutives.map((exec) => (
                  <div
                    className="land-pool-card"
                    key={exec.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, exec.id, 'pool')}
                  >
                    <div className="land-pool-avatar">{getInitials(exec.name)}</div>
                    <div className="land-pool-info">
                      <div className="land-pool-name-row">
                        <span className="land-pool-name-icon">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          </svg>
                        </span>
                        <span className="land-pool-name">{exec.name}</span>
                      </div>
                      <span className="land-pool-role">{exec.role}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
