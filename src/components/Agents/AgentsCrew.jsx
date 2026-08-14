import React, { useState, useEffect } from 'react';
import employeeService from '../../services/employeeService';
import './AgentsCrew.css';

export default function AgentsCrew() {
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
        console.error('Failed to fetch agent crew:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  const crewData = employees
    .filter((emp) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return emp.name?.toLowerCase().includes(q) || String(emp.id).includes(q);
    })
    .map((emp) => ({
      name: emp.name,
      id: `GTS${String(emp.id).padStart(5, '0')}`,
      designation: (emp.role || 'AGENT EXECUTIVE').toUpperCase(),
      isTL: (emp.role || '').toLowerCase().includes('team leader') || (emp.role || '').toLowerCase().includes('tl'),
      date: emp.created_at ? new Date(emp.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : 'N/A',
      node: emp.work_state || 'H.Q.',
      phone: emp.phone || 'N/A',
      avatar: emp.photo || `https://i.pravatar.cc/150?u=${emp.id}`,
    }));

  return (
    <div className="a-crew-page">
      {/* Header */}
      <div className="a-crew-header">
        <div className="a-crew-title-group">
          <svg className="a-crew-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <div className="a-crew-title-texts">
            <span className="a-crew-title">AGENT DEPARTMENT CREW</span>
            <span className="a-crew-subtitle">REGISTRY OF AGENT SOURCING & NETWORK MANAGEMENT PERSONNEL</span>
          </div>
        </div>
        <div className="a-crew-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Search identity..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {/* Table Section */}
      <div className="a-crew-section">
        <div className="a-crew-table-wrap">
          <table className="a-crew-table">
            <thead>
              <tr>
                <th>PERSONNEL IDENTITY</th>
                <th>CADRE / DESIGNATION</th>
                <th>JOINING DATE</th>
                <th>OPERATIONAL NODE</th>
                <th>CONTACT REGISTRY</th>
                <th>AUDIT</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '24px' }}>Loading...</td></tr>
              ) : crewData.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '24px' }}>No agent department crew found.</td></tr>
              ) : crewData.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="a-crew-identity">
                      <div className="a-crew-avatar">
                        <img src={row.avatar} alt="Avatar" />
                      </div>
                      <div className="a-crew-name-group">
                        <span className="a-crew-name">{row.name}</span>
                        <span className="a-crew-id">{row.id}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className={`a-crew-designation ${row.isTL ? 'tl' : 'exec'}`}>
                      {row.isTL ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                      )}
                      {row.designation}
                    </div>
                  </td>
                  <td>
                    <span className="a-crew-text">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                      {row.date}
                    </span>
                  </td>
                  <td>
                    <span className="a-crew-text">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                      {row.node}
                    </span>
                  </td>
                  <td>
                    <span className="a-crew-text">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
                      {row.phone}
                    </span>
                  </td>
                  <td>
                    <button className="a-crew-audit-btn">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
