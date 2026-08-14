import React, { useState, useEffect } from 'react';
import employeeService from '../../services/employeeService';
import './LandWalletPage.css';

export default function LandWalletPage() {
  const [activeTrack, setActiveTrack] = useState('travel');
  const [activeAudit, setActiveAudit] = useState('daily');
  const [activeRoleView, setActiveRoleView] = useState('executive'); // 'tl' or 'executive'
  
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
        console.error('Failed to fetch employees for wallet:', err);
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

  return (
    <div className="land-wallet-page">
      {/* Header */}
      <div className="wallet-header">
        <svg className="wallet-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
          <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
          <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
        </svg>
        <div className="wallet-title-group">
          <span className="wallet-title">MISSION WALLET REGISTRY</span>
          <span className="wallet-subtitle">LANDS DEPARTMENT • HIERARCHICAL EXPENDITURE AUDIT</span>
        </div>
      </div>

      {/* Track Switcher & Search */}
      <div className="wallet-controls">
        <div className="track-switcher">
          <button
            className={`track-btn${activeTrack === 'travel' ? ' active' : ''}`}
            onClick={() => setActiveTrack('travel')}
          >
            TRAVEL TRACK
          </button>
          <button
            className={`track-btn${activeTrack === 'work' ? ' active' : ''}`}
            onClick={() => setActiveTrack('work')}
          >
            WORK TRACK
          </button>
        </div>
        <div className="wallet-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Search personnel..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {/* View Switcher & Month */}
      <div className="wallet-sub-controls">
        <div className="audit-tabs">
          <button
            className={`audit-tab${activeAudit === 'daily' ? ' active' : ''}`}
            onClick={() => setActiveAudit('daily')}
          >
            DAILY AUDIT
          </button>
          <button
            className={`audit-tab${activeAudit === 'monthly' ? ' active' : ''}`}
            onClick={() => setActiveAudit('monthly')}
          >
            MONTHLY CALCULATION
          </button>
        </div>
        <div className="month-selector">
          <button className="month-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <span className="month-label">AUGUST 2024</span>
          <button className="month-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="wallet-content">
        {activeAudit === 'daily' && (
          <>
            <div className="role-toggles">
              <button
                className={`role-toggle${activeRoleView === 'tl' ? ' active' : ''}`}
                onClick={() => setActiveRoleView('tl')}
              >
                TEAM LEADER VIEW
              </button>
              <button
                className={`role-toggle${activeRoleView === 'executive' ? ' active' : ''}`}
                onClick={() => setActiveRoleView('executive')}
              >
                VERIFICATION EXECUTIVE VIEW
              </button>
            </div>

            <div className="daily-audit-card">
              <div className="daily-audit-header">
                <div className="person-info">
                  <div className="person-avatar">
                    <img src="https://i.pravatar.cc/150?u=a042581f4e29026704d" alt="Avatar" />
                  </div>
                  <div className="person-details">
                    <span className="person-role">
                      {activeRoleView === 'executive' ? (
                        <>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                          VERIFICATION LEAD
                        </>
                      ) : (
                        'COMMAND CLUSTER: TL'
                      )}
                    </span>
                    <div className="person-name-row">
                      <span className="person-name">{activeRoleView === 'executive' ? 'ARUN SHARMA' : 'ANIL KUMAR'}</span>
                      <span className="person-code">{activeRoleView === 'executive' ? 'GTS00007' : 'GTS00004'}</span>
                    </div>
                  </div>
                </div>
                <div className="header-actions">
                  <span className="active-dropdown-label">
                    {activeRoleView === 'executive' ? 'ACTIVE VERIFICATION EXECUTIVE' : 'ACTIVE TEAM LEADER'}
                  </span>
                  <div className="active-dropdown">
                    {activeRoleView === 'executive' ? 'Arun Sharma' : 'Anil Kumar'}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                  </div>
                  {activeRoleView === 'tl' && (
                    <button className="sync-btn" style={{ marginTop: '4px' }}>SYNC REGISTRY</button>
                  )}
                </div>
              </div>
              <div className="daily-audit-body">
                {activeRoleView === 'executive' && (
                  <>
                    <svg className="vacant-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span className="vacant-text">REGISTRY VACANT</span>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {activeAudit === 'monthly' && (
          <div className="monthly-table-container">
            <div className="monthly-table-wrap">
              <table className="monthly-table">
                <thead>
                  <tr>
                    <th>PERSONNEL IDENTITY</th>
                    <th>KM TRAVELLED</th>
                    <th>PETROL (₹)</th>
                    <th>BUS (₹)</th>
                    <th>CYCLE TOTAL (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '24px' }}>Loading...</td>
                    </tr>
                  ) : filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '24px' }}>No personnel records found.</td>
                    </tr>
                  ) : filteredEmployees.map((emp) => {
                    const empId = `GTS${String(emp.id).padStart(5, '0')}`;
                    const displayRole = emp.role ? emp.role.toUpperCase() : 'VERIFICATION EXECUTIVE';
                    
                    // Mock data values for wallet tracking
                    const km = '1,240.5 KM';
                    const petrol = '₹3,101';
                    const bus = '₹450';
                    const total = '₹3,551';

                    return (
                    <tr key={emp.id}>
                      <td>
                        <div className="monthly-person-identity">
                          <span className="monthly-person-name">{emp.name}</span>
                          <span className="monthly-person-role">{empId} • {displayRole}</span>
                        </div>
                      </td>
                      <td><span className="monthly-val-text">{km}</span></td>
                      <td><span className="monthly-val-green">{petrol}</span></td>
                      <td><span className="monthly-val-text">{bus}</span></td>
                      <td><span className="monthly-val-bold">{total}</span></td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Protocol Box */}
        <div className="protocol-box">
          <svg className="protocol-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div className="protocol-text-group">
            <span className="protocol-title">REGISTRY VETTING PROTOCOL</span>
            <span className="protocol-desc">
              WORK TRACKS ARE LOCKED ON THE 28TH OF EVERY MONTH. ENSURE ALL <span>Pending Audits</span> ARE VERIFIED AND MOVED TO <span>Mission History</span> BEFORE THE CYCLE FINALIZE TO TRIGGER PAYMENTS.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
