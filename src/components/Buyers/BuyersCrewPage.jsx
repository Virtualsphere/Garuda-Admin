import React, { useState, useEffect } from 'react';
import employeeService from '../../services/employeeService';
import BuyerRegistryModal from './BuyerRegistryModal';
import './BuyersCrewPage.css';

const STATUS_FILTERS = ['ALL', 'ACTIVE', 'TRAINEE', 'DEACTIVE'];

export default function BuyersCrewPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const data = await employeeService.getAll();
        const empList = data.data || data.employees || data || [];
        setEmployees(Array.isArray(empList) ? empList : []);
      } catch (err) {
        console.error('Failed to fetch buyer crew:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  // Buyer department crew = employees whose role tags them into buyer coordination/field support
  const buyerCrew = employees.filter((emp) => (emp.role || '').toLowerCase().includes('buyer'));

  const filteredEmployees = buyerCrew.filter((emp) => {
    if (statusFilter !== 'ALL' && (emp.status || 'ACTIVE') !== statusFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return emp.name?.toLowerCase().includes(q) || String(emp.id).includes(q);
  });

  const squadData = filteredEmployees.filter((emp) => {
    const role = (emp.role || '').toLowerCase();
    return role.includes('manager') || role.includes('leader') || role.includes('head');
  });

  const forceData = filteredEmployees.filter((emp) => {
    const role = (emp.role || '').toLowerCase();
    return !role.includes('manager') && !role.includes('leader') && !role.includes('head');
  });

  const renderStatus = (status) => {
    const s = status || 'ACTIVE';
    return <span className={`b-crew-status ${s.toLowerCase()}`}>{s}</span>;
  };

  const renderTable = (title, rows, designationClass, defaultDesignation, icon) => (
    <div className="b-crew-section">
      <div className="b-crew-section-title">{title} ({rows.length})</div>
      <div className="b-crew-table-wrap">
        <table className="b-crew-table">
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
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '24px' }}>Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '24px' }}>No {title.toLowerCase()} found.</td></tr>
            ) : rows.map((row) => {
              const empId = `GTS${String(row.id).padStart(5, '0')}`;
              const designation = row.role || defaultDesignation;
              const avatar = row.photo || `https://i.pravatar.cc/150?u=${row.id}`;
              return (
                <tr key={row.id}>
                  <td>
                    <div className="b-crew-identity">
                      <div className="b-crew-avatar">
                        <img src={avatar} alt="Avatar" />
                      </div>
                      <div className="b-crew-name-group">
                        <span className="b-crew-name">{row.name}</span>
                        <span className="b-crew-id">{empId}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className={`b-crew-designation ${designationClass}`}>
                      {icon}
                      {designation}
                    </div>
                  </td>
                  <td>
                    <span className="b-crew-text">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                      {row.created_at ? new Date(row.created_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </td>
                  <td>
                    <span className="b-crew-text">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                      {row.work_state || 'H.Q.'}
                    </span>
                  </td>
                  <td>
                    <span className="b-crew-text">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
                      {row.phone || 'N/A'}
                    </span>
                  </td>
                  <td>{renderStatus(row.status)}</td>
                  <td>
                    <button className="b-crew-audit-btn" onClick={() => setSelectedEmployee(row)} title="Open registry">
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
  );

  const tlIcon = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
  );
  const execIcon = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="9" y1="3" x2="9" y2="21" /></svg>
  );

  return (
    <div className="buyers-crew-page">
      {/* Header */}
      <div className="b-crew-header">
        <div className="b-crew-title-group">
          <svg className="b-crew-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <div className="b-crew-title-texts">
            <span className="b-crew-title">BUYER DEPARTMENT CREW</span>
            <span className="b-crew-subtitle">REGISTRY OF COORDINATION &amp; FIELD SUPPORT PERSONNEL</span>
          </div>
        </div>
        <div className="b-crew-controls">
          <div className="b-crew-status-audit">
            <span className="b-crew-status-audit-label">STATUS AUDIT:</span>
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                className={`b-crew-status-chip${statusFilter === s ? ' active' : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="b-crew-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input type="text" placeholder="Search identity..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>
      </div>

      {renderTable('SQUAD COMMAND', squadData, 'tl', 'BUYER DEPARTMENT TEAM LEADER', tlIcon)}
      {renderTable('OPERATIONAL FORCE', forceData, 'exec', 'BUYER EXECUTIVE', execIcon)}

      {selectedEmployee && (
        <BuyerRegistryModal employee={selectedEmployee} onClose={() => setSelectedEmployee(null)} />
      )}
    </div>
  );
}
