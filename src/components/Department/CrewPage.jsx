import React, { useState, useEffect } from 'react';
import employeeService from '../../services/employeeService';
import './CrewPage.css';

const avatarGradients = [
  'linear-gradient(135deg, #667eea, #764ba2)',
  'linear-gradient(135deg, #f093fb, #f5576c)',
  'linear-gradient(135deg, #4facfe, #00f2fe)',
  'linear-gradient(135deg, #43e97b, #38f9d7)',
  'linear-gradient(135deg, #fa709a, #fee140)',
  'linear-gradient(135deg, #a18cd1, #fbc2eb)',
  'linear-gradient(135deg, #fccb90, #d57eeb)',
  'linear-gradient(135deg, #e0c3fc, #8ec5fc)',
  'linear-gradient(135deg, #f5576c, #ff6a88)',
  'linear-gradient(135deg, #0ba360, #3cba92)',
];

const getDesignationType = (role) => {
  const r = (role || '').toLowerCase();
  if (r.includes('manager')) return 'manager';
  if (r.includes('team leader') || r.includes('tl')) return 'team-leader';
  return 'executive';
};

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
};

export default function CrewPage() {
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
        console.error('Failed to fetch call center crew:', err);
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
      code: `GTS${String(emp.id).padStart(5, '0')}`,
      initials: getInitials(emp.name),
      designation: (emp.role || 'CALL CENTER EXECUTIVE').toUpperCase(),
      designationType: getDesignationType(emp.role),
      joiningDate: emp.created_at ? new Date(emp.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : 'N/A',
      node: emp.work_state || 'H.Q.',
      contact: emp.phone || 'N/A',
      status: emp.status || 'ACTIVE',
      statusType: (emp.status || 'active').toLowerCase(),
    }));

  return (
    <div className="crew-page">
      {/* Header */}
      <div className="crew-header">
        <div className="crew-title-section">
          <div className="crew-title-main">
            <div className="crew-title-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h2>CALL CENTER CREW</h2>
          </div>
          <div className="crew-subtitle">
            Registry of Signal Synchronization &amp; Verification Personnel
          </div>
        </div>
        <div className="crew-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Search identity..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="crew-table-container">
        <div className="crew-table-scroll">
          <table className="crew-table">
            <thead>
              <tr>
                <th>Personnel Identity</th>
                <th>Cadre / Designation</th>
                <th>Joining Date</th>
                <th>Operational Node</th>
                <th>Contact Registry</th>
                <th>Employee Status</th>
                <th>Audit</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '24px' }}>Loading...</td></tr>
              ) : crewData.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '24px' }}>No call center crew found.</td></tr>
              ) : crewData.map((person, idx) => (
                <tr key={person.code}>
                  {/* Personnel Identity */}
                  <td>
                    <div className="personnel-identity">
                      <div
                        className="personnel-avatar"
                        style={{ background: avatarGradients[idx % avatarGradients.length] }}
                      >
                        {person.initials}
                      </div>
                      <div className="personnel-info">
                        <span className="personnel-name">{person.name}</span>
                        <span className="personnel-code">{person.code}</span>
                      </div>
                    </div>
                  </td>

                  {/* Cadre */}
                  <td>
                    <span className={`cadre-tag ${person.designationType}`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      {person.designation}
                    </span>
                  </td>

                  {/* Joining Date */}
                  <td>
                    <div className="date-cell">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      {person.joiningDate}
                    </div>
                  </td>

                  {/* Operational Node */}
                  <td>
                    <div className="node-cell">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="3" y1="9" x2="21" y2="9" />
                        <line x1="9" y1="21" x2="9" y2="9" />
                      </svg>
                      {person.node}
                    </div>
                  </td>

                  {/* Contact */}
                  <td>
                    <div className="contact-cell">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      {person.contact}
                    </div>
                  </td>

                  {/* Status */}
                  <td>
                    <span className={`status-badge ${person.statusType}`}>
                      {person.status}
                    </span>
                  </td>

                  {/* Audit */}
                  <td>
                    <button className="audit-chevron">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
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
