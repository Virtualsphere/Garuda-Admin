import React, { useState, useEffect } from 'react';
import employeeService from '../../services/employeeService';
import './HRRecruitmentMap.css';

export default function HRRecruitmentMap() {
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
        console.error('Failed to fetch employees for recruitment map:', err);
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
  const renderMapNodes = () => {
    const rows = 12;
    const cols = 20;
    const mapContent = [];
    for (let r = 0; r < rows; r++) {
      const rowContent = [];
      for (let c = 0; c < cols; c++) {
        // Randomize status for visualization
        let status = 'applied';
        if ((r + c) % 5 === 0) status = 'trainee';
        if ((r * c) % 7 === 0) status = 'allotted';
        
        rowContent.push(
          <div key={`${r}-${c}`} className={`hr-node-icon ${status}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        );
      }
      mapContent.push(<div key={r} className="hr-map-node-row">{rowContent}</div>);
    }
    return mapContent;
  };

  return (
    <div className="hr-map-page">
      {/* Header */}
      <div className="hr-map-header">
        <div className="hr-map-title-group">
          <svg className="hr-map-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
          <div className="hr-map-title-texts">
            <span className="hr-map-title">RECRUITMENT TACTICAL MAP</span>
            <span className="hr-map-subtitle">SPATIAL REGISTRY AUDIT • FIELD FORCE DISTRIBUTION</span>
          </div>
        </div>
        <div className="hr-map-badge">
          {filteredEmployees.length} FORCE SIGNALS ACTIVE
        </div>
      </div>

      {/* Layout */}
      <div className="hr-map-layout">
        {/* Sidebar */}
        <div className="hr-map-sidebar">
          <div className="hr-map-sidebar-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            MAP PARAMETERS
          </div>
          
          <div className="hr-map-sidebar-content">
            <div className="hr-map-filter-group">
              <label className="hr-map-filter-label">MISSION IDENTITY</label>
              <div className="hr-map-input">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input type="text" placeholder="Search name or ID..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
            </div>
            
            <div className="hr-map-filter-group">
              <label className="hr-map-filter-label">FORCE SECTION</label>
              <div className="hr-map-select">
                Unified Force
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
              </div>
            </div>
            
            <div className="hr-map-filter-group">
              <label className="hr-map-filter-label">MISSION STAGE</label>
              <div className="hr-map-select">
                All Stages
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
              </div>
            </div>
          </div>
          
          <div className="hr-map-list-header">
            SIGNALS IN VIEW ({filteredEmployees.length})
          </div>
          
          <div className="hr-map-signals-list">
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
            ) : filteredEmployees.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No signals found.</div>
            ) : filteredEmployees.map((emp) => {
              const empId = `GTS${String(emp.id).padStart(5, '0')}`;
              const displayRole = emp.role ? emp.role.toUpperCase() : 'FIELD';
              const node = emp.work_state || 'N/A';
              const status = ['applied', 'allotted', 'trainee'][emp.id % 3]; // mock status
              const avatar = emp.photo || `https://i.pravatar.cc/150?u=${emp.id}`;
              
              return (
              <div key={emp.id} className="hr-signal-card">
                <div className="hr-signal-avatar">
                  <img src={avatar} alt={emp.name} />
                </div>
                <div className="hr-signal-info">
                  <span className="hr-signal-name">{emp.name}</span>
                  <div className="hr-signal-sub">
                    {empId} • {displayRole} <span>NODE: {node}</span>
                  </div>
                </div>
                <div className={`hr-signal-dot ${status}`}></div>
              </div>
              );
            })}
          </div>
        </div>

        {/* Main Map */}
        <div className="hr-map-content">
          <div className="hr-map-floating-header">
            OPERATIONAL FORCE INTELLIGENCE
          </div>
          
          <div className="hr-map-visual">
            <div className="hr-map-nodes">
              {renderMapNodes()}
            </div>
          </div>
          
          {/* Zoom controls */}
          <div className="hr-map-zoom">
            <div className="hr-zoom-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
            </div>
            <div className="hr-zoom-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
            </div>
            <div className="hr-zoom-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></svg>
            </div>
          </div>

          {/* Force Legend */}
          <div className="hr-map-legend">
            <div className="hr-legend-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              FORCE LEGEND
            </div>
            <div className="hr-legend-items">
              <div className="hr-legend-item">
                <div className="hr-legend-dot applied"></div>
                APPLIED (VETTING QUEUE)
              </div>
              <div className="hr-legend-item">
                <div className="hr-legend-dot trainee"></div>
                TRAINEE (IN-INDUCTION)
              </div>
              <div className="hr-legend-item">
                <div className="hr-legend-dot allotted"></div>
                ALLOTTED (ACTIVE FORCE)
              </div>
            </div>
            <div className="hr-legend-icons">
              <div className="hr-legend-icon-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                EXECUTIVE
              </div>
              <div className="hr-legend-icon-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><polyline points="17 11 19 13 23 9" /></svg>
                ASSISTANT
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
