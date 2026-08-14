import React, { useState, useEffect } from 'react';
import employeeService from '../../services/employeeService';
import departmentLeaderService from '../../services/departmentLeaderService';
import './HierarchyPage.css';

const DEPARTMENT_TYPE = 'callcenter';

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #4facfe, #00f2fe)',
  'linear-gradient(135deg, #43e97b, #38f9d7)',
  'linear-gradient(135deg, #fa709a, #fee140)',
  'linear-gradient(135deg, #a18cd1, #fbc2eb)',
  'linear-gradient(135deg, #fccb90, #d57eeb)',
];

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
};

export default function HierarchyPage() {
  const [employees, setEmployees] = useState([]);
  const [roster, setRoster] = useState([]);
  const [selectedLeaderId, setSelectedLeaderId] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [committing, setCommitting] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [dragOverZone, setDragOverZone] = useState(null);
  const [actionError, setActionError] = useState('');

  const leader = employees.find((emp) => String(emp.id) === String(selectedLeaderId));
  const sortedEmployees = [...employees].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const rosterIds = new Set(roster.map((r) => r.employee_id));
  const rosterEmployees = employees.filter((emp) => rosterIds.has(emp.id));
  const stagedEmployees = employees.filter((emp) => selectedIds.includes(emp.id));
  const forcePool = employees.filter(
    (emp) => String(emp.id) !== String(selectedLeaderId) && !rosterIds.has(emp.id) && !selectedIds.includes(emp.id)
  );
  const totalAllotted = rosterEmployees.length + stagedEmployees.length;
  const fillPercent = employees.length > 0 ? Math.round((totalAllotted / employees.length) * 100) : 0;

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
        console.error('Failed to fetch call center employees:', err);
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
    <div className="hierarchy-page">
      {/* Header */}
      <div className="hierarchy-header">
        <div className="hierarchy-title-section">
          <div className="hierarchy-title-main">
            <div className="hierarchy-title-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
            </div>
            <h2>FORCE ALLOTMENT REGISTRY</h2>
          </div>
          <div className="hierarchy-subtitle">
            Strategic Command Linking: Call Center Department
          </div>
        </div>
        <button className="commit-btn" onClick={handleCommit} disabled={committing || !selectedLeaderId || selectedIds.length === 0} style={{ opacity: committing || !selectedLeaderId || selectedIds.length === 0 ? 0.5 : 1 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          {committing ? 'Committing...' : `Commit Allotment (${selectedIds.length})`}
        </button>
      </div>

      {actionError && <div className="hierarchy-error-banner">{actionError}</div>}

      {/* Content */}
      <div className="hierarchy-content">
        {/* Command Roster */}
        <div className="command-roster">
          <div className="section-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            1. Command Roster
          </div>

          <div className="roster-card">
            <div className="roster-card-header">
              <div className="roster-avatar">{leader ? getInitials(leader.name) : '??'}</div>
              <div className="roster-info">
                <select
                  className="roster-leader-select"
                  value={selectedLeaderId}
                  onChange={(e) => handleLeaderChange(e.target.value)}
                >
                  <option value="">SELECT DEPARTMENT LEAD</option>
                  {sortedEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name?.toUpperCase()}</option>
                  ))}
                </select>
                <span className="roster-role">{leader ? (leader.role || 'EMPLOYEE') : 'No lead selected'}</span>
              </div>
            </div>
            <div className="roster-card-body">
              <div className="reporting-line">
                <span className="reporting-label">Active Reporting Line</span>
                <span className="reporting-badge">{totalAllotted} Allotted</span>
              </div>
              <div className="reporting-bar">
                <div className="reporting-bar-fill" style={{ width: `${fillPercent}%` }} />
              </div>
              <div
                className={`roster-drop-zone${dragOverZone === 'roster' ? ' drag-over' : ''}${totalAllotted > 0 ? ' has-items' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOverZone('roster'); }}
                onDragLeave={() => setDragOverZone((z) => (z === 'roster' ? null : z))}
                onDrop={handleRosterDrop}
              >
                {!selectedLeaderId ? (
                  <span>Select a department lead to begin allotment.</span>
                ) : totalAllotted === 0 ? (
                  <span>Drag executives from the Force Pool here, or click one to allot.</span>
                ) : (
                  <>
                    {rosterEmployees.map((person, idx) => (
                      <div
                        className="force-pool-item roster-item"
                        key={person.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, person, 'committed')}
                      >
                        <div className="pool-avatar" style={{ background: AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length] }}>
                          {getInitials(person.name)}
                        </div>
                        <div className="pool-info">
                          <span className="pool-name">{person.name}</span>
                          <span className="pool-role">{person.role}</span>
                        </div>
                        <button
                          type="button"
                          className="pool-remove-btn"
                          onClick={() => handleRemove(person.id)}
                          disabled={removingId === person.id}
                          title="Remove from roster"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {stagedEmployees.map((person, idx) => (
                      <div
                        className="force-pool-item roster-item pending"
                        key={person.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, person, 'staged')}
                      >
                        <div className="pool-avatar" style={{ background: AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length] }}>
                          {getInitials(person.name)}
                        </div>
                        <div className="pool-info">
                          <span className="pool-name">{person.name}</span>
                          <span className="pool-role">{person.role} · Pending Commit</span>
                        </div>
                        <button type="button" className="pool-remove-btn" onClick={() => unstage(person.id)} title="Unstage">×</button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Force Pool */}
        <div className="force-pool">
          <div className="section-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            2. Force Pool
          </div>

          <div
            className={`force-pool-list${dragOverZone === 'pool' ? ' drag-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOverZone('pool'); }}
            onDragLeave={() => setDragOverZone((z) => (z === 'pool' ? null : z))}
            onDrop={handlePoolDrop}
          >
            {forcePool.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No available force pool.</div>
            ) : forcePool.map((person, idx) => (
              <div
                className="force-pool-item"
                key={person.id}
                draggable
                onDragStart={(e) => handleDragStart(e, person, 'pool')}
                onClick={() => stage(person.id)}
                style={{ cursor: 'pointer' }}
              >
                <div
                  className="pool-avatar"
                  style={{ background: AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length] }}
                >
                  {getInitials(person.name)}
                </div>
                <div className="pool-info">
                  <span className="pool-name">{person.name}</span>
                  <span className="pool-role">{person.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
