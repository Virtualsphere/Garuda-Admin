import React, { useState, useEffect } from 'react';
import employeeService from '../../services/employeeService';
import './HRAllEmployees.css';

export default function HRAllEmployees() {
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');

  // Fetch employees on mount
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        const data = await employeeService.getAll();
        const empList = data.data || data.employees || data || [];
        setEmployees(Array.isArray(empList) ? empList : []);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch employees:', err);
        setError('Failed to load employees');
        setEmployees([]);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  // Apply filters
  useEffect(() => {
    let result = [...employees];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (emp) =>
          emp.name?.toLowerCase().includes(q) ||
          emp.email?.toLowerCase().includes(q) ||
          emp.phone?.includes(q) ||
          String(emp.id).includes(q)
      );
    }

    // Department filter
    if (deptFilter !== 'all') {
      result = result.filter(
        (emp) => emp.role?.toLowerCase().includes(deptFilter.toLowerCase())
      );
    }

    setFilteredEmployees(result);
  }, [employees, searchQuery, deptFilter]);

  // Helper to derive display fields
  const getDesigType = (role) => {
    if (!role) return 'executive';
    const r = role.toLowerCase();
    if (r.includes('ceo') || r.includes('director')) return 'leadership';
    if (r.includes('head')) return 'lands-head';
    if (r.includes('team leader') || r.includes('tl')) return 'team-leader';
    return 'executive';
  };

  const getEnv = (role) => {
    if (!role) return 'FIELD';
    const r = role.toLowerCase();
    if (r.includes('ceo') || r.includes('director') || r.includes('head') || r.includes('team leader') || r.includes('tl')) return 'OFFICE';
    return 'FIELD';
  };

  const getBU = (role) => {
    if (!role) return 'GENERAL';
    const r = role.toLowerCase();
    if (r.includes('ceo') || r.includes('director')) return 'LEADERSHIP';
    if (r.includes('land')) return 'LANDS';
    if (r.includes('farmer')) return 'FARMERS';
    if (r.includes('agent')) return 'AGENTS';
    return 'GENERAL';
  };

  const getEmpId = (emp) => {
    return `GTS${String(emp.id).padStart(5, '0')}`;
  };
  return (
    <div className="hr-emp-page">
      {/* Header */}
      <div className="hr-emp-header">
        <div className="hr-emp-title-group">
          <svg className="hr-emp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <div className="hr-emp-title-texts">
            <span className="hr-emp-title">MASTER PERSONNEL REGISTRY</span>
            <span className="hr-emp-subtitle">GLOBAL ORGANIZATIONAL RESOURCE POOL ({filteredEmployees.length} PERSONNEL)</span>
          </div>
        </div>
        <div className="hr-emp-actions">
          <div className="hr-emp-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input type="text" placeholder="Identity Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <select className="hr-emp-select-native" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="all">All Departments</option>
            <option value="land">Lands</option>
            <option value="farmer">Farmers</option>
            <option value="agent">Agents</option>
            <option value="ceo">Leadership</option>
          </select>
          <div className="hr-emp-filter-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
          </div>
          <button className="hr-emp-global-btn">
            GLOBAL ROSTER
          </button>
        </div>
      </div>

      {/* Table Container */}
      {/* Loading / Error states */}
      {loading && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading employees...</div>
      )}
      {error && (
        <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626' }}>{error}</div>
      )}

      {/* Table Container */}
      {!loading && !error && (
       <div className="hr-emp-table-container">
        <div className="hr-emp-table-wrap">
          <table className="hr-emp-table">
            <thead>
              <tr>
                <th>PERSONNEL IDENTITY</th>
                <th>BUSINESS UNIT</th>
                <th>CADRE / DESIGNATION</th>
                <th>ENVIRONMENT</th>
                <th>OPERATIONAL NODE</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => {
                const empId = getEmpId(emp);
                const bu = getBU(emp.role);
                const desigType = getDesigType(emp.role);
                const env = getEnv(emp.role);
                const node = emp.work_state ? `${emp.work_state}` : 'N/A';
                const avatarUrl = emp.photo || `https://i.pravatar.cc/150?u=${emp.id}`;

                return (
                <tr key={emp.id}>
                  <td>
                    <div className="hr-emp-identity">
                      <div className="hr-emp-avatar">
                        <img src={avatarUrl} alt={emp.name} />
                      </div>
                      <div className="hr-emp-name-group">
                        <span className="hr-emp-name">{emp.name}</span>
                        <span className="hr-emp-id">{empId}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="hr-emp-bu">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
                      {bu}
                    </span>
                  </td>
                  <td>
                    <span className={`hr-emp-badge ${desigType}`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                      {emp.role || 'N/A'}
                    </span>
                  </td>
                  <td>
                    <span className={`hr-emp-env ${env.toLowerCase()}`}>
                      {env === 'OFFICE' ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" /></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                      )}
                      {env}
                    </span>
                  </td>
                  <td>
                    <span className="hr-emp-node">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                      {node}
                    </span>
                  </td>
                  <td>
                    <button className="hr-emp-action-btn">
                      VIEW / EDIT FILE
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                  </td>
                </tr>
                );
              })}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No employees found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}
