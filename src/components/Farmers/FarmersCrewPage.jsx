import React, { useState, useEffect } from 'react';
import employeeService from '../../services/employeeService';
import './FarmersCrewPage.css';

export default function FarmersCrewPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const data = await employeeService.getAll();
        const empList = data.data || data.employees || data || [];
        setEmployees(Array.isArray(empList) ? empList : []);
      } catch (err) {
        console.error('Failed to fetch crew:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  const filteredEmployees = employees.filter(emp => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return emp.name?.toLowerCase().includes(q) || String(emp.id).includes(q);
  });

  const squadData = filteredEmployees.filter(emp => {
    const role = (emp.role || '').toLowerCase();
    return role.includes('manager') || role.includes('leader') || role.includes('head');
  });

  const forceData = filteredEmployees.filter(emp => {
    const role = (emp.role || '').toLowerCase();
    return !role.includes('manager') && !role.includes('leader') && !role.includes('head');
  });

  return (
    <div className="farmers-crew-page">
      {/* Header */}
      <div className="f-crew-header">
        <div className="f-crew-title-group">
          <svg className="f-crew-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <div className="f-crew-title-texts">
            <span className="f-crew-title">FARMER RELATIONS CREW</span>
            <span className="f-crew-subtitle">REGISTRY OF SOURCING & REGIONAL SUPPORT PERSONNEL</span>
          </div>
        </div>
        <div className="f-crew-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Search identity..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {/* Squad Command Table */}
      <div className="f-crew-section">
        <div className="f-crew-section-title">SQUAD COMMAND ({squadData.length})</div>
        <div className="f-crew-table-wrap">
          <table className="f-crew-table">
            <thead>
              <tr>
                <th>PERSONNEL IDENTITY</th>
                <th>CADRE / DESIGNATION</th>
                <th>JOINING DATE</th>
                <th>OPERATIONAL HUB</th>
                <th>CONTACT REGISTRY</th>
                <th>EMPLOYEE STATUS</th>
                <th>AUDIT</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px' }}>Loading...</td>
                </tr>
              ) : squadData.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px' }}>No command crew found.</td>
                </tr>
              ) : squadData.map((row) => {
                const empId = `GTS${String(row.id).padStart(5, '0')}`;
                const designation = row.role || 'LEADER';
                const avatar = row.photo || `https://i.pravatar.cc/150?u=${row.id}`;
                return (
                <tr key={row.id}>
                  <td>
                    <div className="f-crew-identity">
                      <div className="f-crew-avatar">
                        <img src={avatar} alt="Avatar" />
                      </div>
                      <div className="f-crew-name-group">
                        <span className="f-crew-name">{row.name}</span>
                        <span className="f-crew-id">{empId}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className={`f-crew-designation tl`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                      {designation}
                    </div>
                  </td>
                  <td>
                    <span className="f-crew-text">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                      {row.created_at ? new Date(row.created_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </td>
                  <td>
                    <span className="f-crew-text">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                      {row.work_state || 'N/A'}
                    </span>
                  </td>
                  <td>
                    <span className="f-crew-text">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
                      {row.phone || 'N/A'}
                    </span>
                  </td>
                  <td>
                    <span className={`f-crew-status active`}>ACTIVE</span>
                  </td>
                  <td>
                    <button className="f-crew-audit-btn">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Operational Force Table */}
      <div className="f-crew-section" style={{ flex: 1 }}>
        <div className="f-crew-section-title">OPERATIONAL FORCE ({forceData.length})</div>
        <div className="f-crew-table-wrap">
          <table className="f-crew-table">
            <thead>
              <tr>
                <th>PERSONNEL IDENTITY</th>
                <th>CADRE / DESIGNATION</th>
                <th>JOINING DATE</th>
                <th>OPERATIONAL HUB</th>
                <th>CONTACT REGISTRY</th>
                <th>EMPLOYEE STATUS</th>
                <th>AUDIT</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px' }}>Loading...</td>
                </tr>
              ) : forceData.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px' }}>No operational force found.</td>
                </tr>
              ) : forceData.map((row) => {
                const empId = `GTS${String(row.id).padStart(5, '0')}`;
                const designation = row.role || 'EXECUTIVE';
                const avatar = row.photo || `https://i.pravatar.cc/150?u=${row.id}`;
                
                return (
                <tr key={row.id}>
                  <td>
                    <div className="f-crew-identity">
                      <div className="f-crew-avatar">
                        <img src={avatar} alt="Avatar" />
                      </div>
                      <div className="f-crew-name-group">
                        <span className="f-crew-name">{row.name}</span>
                        <span className="f-crew-id">{empId}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className={`f-crew-designation exec`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="9" y1="3" x2="9" y2="21" /></svg>
                      {designation}
                    </div>
                  </td>
                  <td>
                    <span className="f-crew-text">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                      {row.created_at ? new Date(row.created_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </td>
                  <td>
                    <span className="f-crew-text">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                      {row.work_state || 'N/A'}
                    </span>
                  </td>
                  <td>
                    <span className="f-crew-text">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
                      {row.phone || 'N/A'}
                    </span>
                  </td>
                  <td>
                    <span className={`f-crew-status active`}>ACTIVE</span>
                  </td>
                  <td>
                    <button className="f-crew-audit-btn">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
