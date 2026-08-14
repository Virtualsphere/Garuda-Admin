import React, { useState, useEffect } from 'react';
import employeeService from '../../services/employeeService';
import departmentLeaderService from '../../services/departmentLeaderService';
import assignedVillageService from '../../services/assignedVillageService';
import useLocations from '../../hooks/useLocations';
import './FarmersAreaAllotment.css';

const DEPARTMENT_TYPE = 'farmers';

export default function FarmersAreaAllotment() {
  const [activeTab, setActiveTab] = useState('relations');
  const [leaders, setLeaders] = useState([]);
  const [selectedLeaderId, setSelectedLeaderId] = useState('');
  const [forceLoad, setForceLoad] = useState(0);

  const [assignments, setAssignments] = useState([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [executives, setExecutives] = useState([]);

  const {
    states, districts, mandals, villages,
    selectedState, selectedDistrict, selectedMandal,
    setSelectedState, setSelectedDistrict, setSelectedMandal,
    loading: locationsLoading,
  } = useLocations();
  const [newAssignment, setNewAssignment] = useState({ village: '', target: '', executiveId: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const data = await employeeService.getAll();
        const empList = data.data || data.employees || data || [];
        const allEmployees = Array.isArray(empList) ? empList : [];
        // Employee role text has no reliable department tag (e.g. most are just "FIELD_EXECUTIVE"),
        // so any employee can be picked as mission lead or assigned executive here.
        setLeaders(allEmployees);
        setExecutives(allEmployees);
      } catch (err) {
        console.error('Failed to fetch farmers department employees:', err);
      }
    };
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (!selectedLeaderId) {
      setForceLoad(0);
      return;
    }
    const fetchForceLoad = async () => {
      try {
        const data = await departmentLeaderService.getRoster(selectedLeaderId, DEPARTMENT_TYPE);
        setForceLoad((data.data || []).length);
      } catch (err) {
        console.error('Failed to fetch force load:', err);
      }
    };
    fetchForceLoad();
  }, [selectedLeaderId]);

  const fetchAssignments = async () => {
    setAssignmentsLoading(true);
    try {
      const data = await assignedVillageService.getAll();
      setAssignments(data.result || data.data || []);
    } catch (err) {
      console.error('Failed to fetch village assignments:', err);
    } finally {
      setAssignmentsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const handleCreateAssignment = async () => {
    if (!selectedMandal || !newAssignment.village || !newAssignment.executiveId) return;
    setCreating(true);
    try {
      const mandalName = mandals.find((m) => String(m.id) === String(selectedMandal))?.name || '';
      await assignedVillageService.create({
        target: Number(newAssignment.target) || 0,
        assignedEmployeeId: newAssignment.executiveId,
        village: newAssignment.village,
        mandal: mandalName,
        assignedStatus: 'ongoing',
      });
      setNewAssignment({ village: '', target: '', executiveId: '' });
      await fetchAssignments();
    } catch (err) {
      console.error('Failed to create village assignment:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="f-area-page">
      {/* Green Block: Mission Lead */}
      <div className="f-area-mission-lead">
        <div className="f-area-ml-content">
          <span className="f-area-ml-label">MISSION LEAD</span>
          <select
            className="f-area-ml-dropdown"
            style={{ appearance: 'auto' }}
            value={selectedLeaderId}
            onChange={(e) => setSelectedLeaderId(e.target.value)}
          >
            <option value="">Identify Team Lead</option>
            {leaders.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div className="f-area-ml-force">
          FORCE LOAD: {forceLoad} EXECUTIVES
        </div>
      </div>

      {/* Team Tabs */}
      <div className="f-area-tabs">
        <div 
          className={`f-area-tab ${activeTab === 'relations' ? 'active' : ''}`}
          onClick={() => setActiveTab('relations')}
        >
          RELATIONS TEAM
        </div>
        <div 
          className={`f-area-tab ${activeTab === 'area' ? 'active' : ''}`}
          onClick={() => setActiveTab('area')}
        >
          AREA ALLOTMENT
        </div>
      </div>

      {activeTab === 'relations' ? (
        /* Protocol Box */
        <div className="f-area-protocol-box">
          <svg className="f-area-protocol-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div className="f-area-protocol-text-group">
            <span className="f-area-protocol-title">TERRITORIAL ALLOTMENT PROTOCOL</span>
            <span className="f-area-protocol-desc">
              FARMER RELATIONS EXECUTIVES ARE ASSIGNED TO ENTIRE <span>Mandals</span> OR <span>Townships</span>. THEY INHERIT ADMINISTRATIVE CONTROL OVER ALL VILLAGE NODES AND FARMER REGISTRIES WITHIN THEIR ASSIGNED TERRITORY. USE THE <strong>AREA ALLOTMENT</strong> TAB TO ASSIGN AN EXECUTIVE TO A SPECIFIC VILLAGE.
            </span>
          </div>
        </div>
      ) : (
        <div className="f-area-protocol-box" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <select style={{ appearance: 'auto' }} value={selectedState} onChange={(e) => setSelectedState(e.target.value)} disabled={locationsLoading.states}>
              <option value="">{locationsLoading.states ? 'Loading...' : 'Select State'}</option>
              {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select style={{ appearance: 'auto' }} value={selectedDistrict} onChange={(e) => setSelectedDistrict(e.target.value)} disabled={!selectedState || locationsLoading.districts}>
              <option value="">{locationsLoading.districts ? 'Loading...' : 'Select District'}</option>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select style={{ appearance: 'auto' }} value={selectedMandal} onChange={(e) => setSelectedMandal(e.target.value)} disabled={!selectedDistrict || locationsLoading.mandals}>
              <option value="">{locationsLoading.mandals ? 'Loading...' : 'Select Mandal'}</option>
              {mandals.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <select style={{ appearance: 'auto' }} value={newAssignment.village} onChange={(e) => setNewAssignment((prev) => ({ ...prev, village: e.target.value }))} disabled={!selectedMandal}>
              <option value="">Select Village</option>
              {villages.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
            </select>
            <input
              type="text"
              placeholder="Land target (e.g. 100)"
              value={newAssignment.target}
              onChange={(e) => setNewAssignment((prev) => ({ ...prev, target: e.target.value }))}
            />
            <select style={{ appearance: 'auto' }} value={newAssignment.executiveId} onChange={(e) => setNewAssignment((prev) => ({ ...prev, executiveId: e.target.value }))}>
              <option value="">Assign Executive</option>
              {executives.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <button onClick={handleCreateAssignment} disabled={creating} className="f-exec-commit-btn">
              {creating ? 'ASSIGNING...' : 'ASSIGN TERRITORY'}
            </button>
          </div>

          <div>
            <span className="f-area-protocol-title">ACTIVE TERRITORIAL ASSIGNMENTS ({assignments.length})</span>
            {assignmentsLoading ? (
              <div style={{ padding: '12px', color: 'var(--text-muted)' }}>Loading...</div>
            ) : assignments.length === 0 ? (
              <div style={{ padding: '12px', color: 'var(--text-muted)' }}>No territories assigned yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                {assignments.map((a) => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px' }}>
                    <span>{a.village}, {a.mandal}</span>
                    <span>Target: {a.target}</span>
                    <span>{a.assigned_status?.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
