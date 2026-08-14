import React, { useState } from 'react';
import LandCrewPage from './LandCrewPage';
import LandHierarchyPage from './LandHierarchyPage';
import AttendancePage from '../Department/AttendancePage';
import './LandPage.css';

export default function LandPage() {
  const [activeSubTab, setActiveSubTab] = useState('crew');

  return (
    <div className="land-page">
      {/* Sub Tabs */}
      <div className="land-sub-tabs">
        <button
          className={`land-sub-tab${activeSubTab === 'crew' ? ' active' : ''}`}
          onClick={() => setActiveSubTab('crew')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          Crew
        </button>
        <button
          className={`land-sub-tab${activeSubTab === 'attendance' ? ' active' : ''}`}
          onClick={() => setActiveSubTab('attendance')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Attendance
        </button>
        <button
          className={`land-sub-tab${activeSubTab === 'budget' ? ' active' : ''}`}
          onClick={() => setActiveSubTab('budget')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <circle cx="12" cy="12" r="2" />
            <path d="M6 12h.01M18 12h.01" />
          </svg>
          Budget
        </button>
        <button
          className={`land-sub-tab${activeSubTab === 'hierarchy' ? ' active' : ''}`}
          onClick={() => setActiveSubTab('hierarchy')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          Hierarchy
        </button>
      </div>

      {/* Content Area */}
      <div className="land-page-content">
        {activeSubTab === 'crew' && <LandCrewPage />}
        {activeSubTab === 'hierarchy' && <LandHierarchyPage />}
        {activeSubTab === 'attendance' && (
          <AttendancePage roleFilter="land" departmentLabel="Lands Department" />
        )}
        {activeSubTab === 'budget' && (
          <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Budget coming soon...</div>
        )}
      </div>
    </div>
  );
}
