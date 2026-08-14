import React, { useState, useEffect } from 'react';
import employeeService from '../../services/employeeService';
import departmentLeaderService from '../../services/departmentLeaderService';
import './FarmersExecutiveAllotment.css';

const DEPARTMENT_TYPE = 'farmers';

export default function FarmersExecutiveAllotment() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roster, setRoster] = useState([]);
  const [selectedLeaderId, setSelectedLeaderId] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [committing, setCommitting] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [dragOverZone, setDragOverZone] = useState(null);
  const [actionError, setActionError] = useState('');

  const activeManager = employees.find((emp) => String(emp.id) === String(selectedLeaderId));
  const sortedEmployees = [...employees].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const rosterIds = new Set(roster.map((r) => r.employee_id));
  const rosterEmployees = employees.filter((emp) => rosterIds.has(emp.id));
  const stagedEmployees = employees.filter((emp) => selectedIds.includes(emp.id));
  const forcePool = employees.filter(
    (emp) => String(emp.id) !== String(selectedLeaderId) && !rosterIds.has(emp.id) && !selectedIds.includes(emp.id)
  );
  const totalAllotted = rosterEmployees.length + stagedEmployees.length;

  const fetchRoster = async (leaderId) => {
    if (!leaderId) return;
    try {
      const data = await departmentLeaderService.getRoster(leaderId, DEPARTMENT_TYPE);
      setRoster(data.data || []);
    } catch (err) {
      console.error('Failed to fetch roster:', err);
    }
  };

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const data = await employeeService.getAll();
        const empList = data.data || data.employees || data || [];
        setEmployees(Array.isArray(empList) ? empList : []);
      } catch (err) {
        console.error('Failed to fetch pool data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (selectedLeaderId) {
      fetchRoster(selectedLeaderId);
    } else {
      setRoster([]);
    }
  }, [selectedLeaderId]);

  const handleLeaderChange = (leaderId) => {
    setSelectedLeaderId(leaderId);
    setSelectedIds([]);
  };

  const stage = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const unstage = (id) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const handleRemove = async (employeeId) => {
    setRemovingId(employeeId);
    setActionError('');
    try {
      await departmentLeaderService.removeAllotment(employeeId, DEPARTMENT_TYPE);
      await fetchRoster(selectedLeaderId);
    } catch (err) {
      console.error('Failed to remove allotment:', err);
      setActionError('Could not remove this executive from the roster. The allotment service may be unavailable.');
    } finally {
      setRemovingId(null);
    }
  };

  const handleCommit = async () => {
    if (!selectedLeaderId || selectedIds.length === 0) return;
    setCommitting(true);
    setActionError('');
    try {
      await Promise.all(
        selectedIds.map((employeeId) => departmentLeaderService.setAllotment(employeeId, selectedLeaderId, DEPARTMENT_TYPE))
      );
      setSelectedIds([]);
      await fetchRoster(selectedLeaderId);
    } catch (err) {
      console.error('Failed to commit allotment:', err);
      setActionError('Could not save the allotment. The allotment service may be unavailable — your selections are still staged.');
    } finally {
      setCommitting(false);
    }
  };

  const handleDragStart = (e, person, source) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ id: person.id, source }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleRosterDrop = (e) => {
    e.preventDefault();
    setDragOverZone(null);
    if (!selectedLeaderId) return;
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    const { id, source } = JSON.parse(raw);
    if (source === 'pool') stage(id);
  };

  const handlePoolDrop = (e) => {
    e.preventDefault();
    setDragOverZone(null);
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    const { id, source } = JSON.parse(raw);
    if (source === 'staged') unstage(id);
    else if (source === 'committed') handleRemove(id);
  };

  return (
    <div className="f-exec-page">
      {/* Header */}
      <div className="f-exec-header">
        <div className="f-exec-title-group">
          <svg className="f-exec-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <div className="f-exec-title-texts">
            <span className="f-exec-title">FORCE ALLOTMENT REGISTRY</span>
            <span className="f-exec-subtitle">STRATEGIC COMMAND LINKING: FARMERS DEPARTMENT</span>
          </div>
        </div>
        <button className="f-exec-commit-btn" onClick={handleCommit} disabled={committing || !selectedLeaderId || selectedIds.length === 0} style={{ opacity: committing || !selectedLeaderId || selectedIds.length === 0 ? 0.5 : 1 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          {committing ? 'COMMITTING...' : `COMMIT ALLOTMENT (${selectedIds.length})`}
        </button>
      </div>

      {actionError && <div className="f-exec-error-banner">{actionError}</div>}

      {/* Main Layout */}
      <div className="f-exec-layout">
        {/* Column 1: Command Roster */}
        <div className="f-exec-column">
          <div className="f-exec-column-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
            1. COMMAND ROSTER
          </div>
          <div className="f-roster-card">
            <div className="f-roster-header">
              <div className="f-roster-avatar">
                <img src={activeManager?.photo || `https://i.pravatar.cc/150?u=${activeManager?.id || 0}`} alt={activeManager?.name || 'No manager'} />
              </div>
              <div className="f-roster-info">
                <select
                  className="f-roster-leader-select"
                  value={selectedLeaderId}
                  onChange={(e) => handleLeaderChange(e.target.value)}
                >
                  <option value="">SELECT MANAGER</option>
                  {sortedEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name?.toUpperCase()}</option>
                  ))}
                </select>
                <span className="f-roster-role">{activeManager ? (activeManager.role ? activeManager.role.toUpperCase() : 'EMPLOYEE') : 'NO MANAGER SELECTED'}</span>
              </div>
            </div>
            <div className="f-roster-status-bar">
              <span className="f-roster-status-label">ACTIVE REPORTING LINE</span>
              <span className="f-roster-badge">{totalAllotted} Allotted</span>
            </div>
            <div
              className={`f-roster-body${dragOverZone === 'roster' ? ' drag-over' : ''}${totalAllotted > 0 ? ' has-items' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOverZone('roster'); }}
              onDragLeave={() => setDragOverZone((z) => (z === 'roster' ? null : z))}
              onDrop={handleRosterDrop}
            >
              {!selectedLeaderId ? (
                <div className="f-roster-empty-hint">Select a manager to begin allotment.</div>
              ) : totalAllotted === 0 ? (
                <div className="f-roster-empty-hint">Drag executives from the Force Pool here, or click one to allot.</div>
              ) : (
                <>
                  {rosterEmployees.map((person) => (
                    <div
                      key={person.id}
                      className="f-force-card roster-item"
                      draggable
                      onDragStart={(e) => handleDragStart(e, person, 'committed')}
                    >
                      <div className="f-force-avatar">
                        <img src={person.photo || `https://i.pravatar.cc/150?u=${person.id}`} alt={person.name} />
                      </div>
                      <div className="f-force-info">
                        <span className="f-force-name">{person.name}</span>
                        <span className="f-force-role">{person.role ? person.role.toUpperCase() : 'EXECUTIVE'}</span>
                      </div>
                      <button
                        type="button"
                        className="f-pool-remove-btn"
                        onClick={() => handleRemove(person.id)}
                        disabled={removingId === person.id}
                        title="Remove from roster"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {stagedEmployees.map((person) => (
                    <div
                      key={person.id}
                      className="f-force-card roster-item pending"
                      draggable
                      onDragStart={(e) => handleDragStart(e, person, 'staged')}
                    >
                      <div className="f-force-avatar">
                        <img src={person.photo || `https://i.pravatar.cc/150?u=${person.id}`} alt={person.name} />
                      </div>
                      <div className="f-force-info">
                        <span className="f-force-name">{person.name}</span>
                        <span className="f-force-role">{person.role ? person.role.toUpperCase() : 'EXECUTIVE'} · PENDING</span>
                      </div>
                      <button type="button" className="f-pool-remove-btn" onClick={() => unstage(person.id)} title="Unstage">×</button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Column 2: Force Pool */}
        <div className="f-exec-column">
          <div className="f-exec-column-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            2. FORCE POOL
          </div>
          <div
            className={`f-force-pool${dragOverZone === 'pool' ? ' drag-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOverZone('pool'); }}
            onDragLeave={() => setDragOverZone((z) => (z === 'pool' ? null : z))}
            onDrop={handlePoolDrop}
          >
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading force pool...</div>
            ) : forcePool.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No available force pool.</div>
            ) : forcePool.map((person) => (
              <div
                key={person.id}
                className="f-force-card"
                draggable
                onDragStart={(e) => handleDragStart(e, person, 'pool')}
                onClick={() => stage(person.id)}
                style={{ cursor: 'pointer' }}
              >
                <div className="f-force-avatar">
                  <img src={person.photo || `https://i.pravatar.cc/150?u=${person.id}`} alt={person.name} />
                </div>
                <div className="f-force-info">
                  <span className="f-force-name">{person.name}</span>
                  <span className="f-force-role">{person.role ? person.role.toUpperCase() : 'EXECUTIVE'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
