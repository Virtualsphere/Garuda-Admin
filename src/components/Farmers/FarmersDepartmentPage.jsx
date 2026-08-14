import React, { useState } from 'react';
import './FarmersDepartmentPage.css';
import FarmersCrewPage from './FarmersCrewPage';
import FarmersHierarchyPage from './FarmersHierarchyPage';
import AttendancePage from '../Department/AttendancePage';

export default function FarmersDepartmentPage() {
  const [activeTab, setActiveTab] = useState('hierarchy');

  return (
    <div className="f-dept-page">
      {/* Sub Tabs */}
      <div className="f-dept-sub-tabs">
        <button
          className={`f-dept-sub-tab${activeTab === 'crew' ? ' active' : ''}`}
          onClick={() => setActiveTab('crew')}
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
          className={`f-dept-sub-tab${activeTab === 'attendance' ? ' active' : ''}`}
          onClick={() => setActiveTab('attendance')}
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
          className={`f-dept-sub-tab${activeTab === 'budget' ? ' active' : ''}`}
          onClick={() => setActiveTab('budget')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          Budget
        </button>
        <button
          className={`f-dept-sub-tab${activeTab === 'hierarchy' ? ' active' : ''}`}
          onClick={() => setActiveTab('hierarchy')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="18" width="6" height="6" />
            <rect x="3" y="3" width="6" height="6" />
            <rect x="15" y="3" width="6" height="6" />
            <polyline points="6 9 6 12 18 12 18 9" />
            <line x1="12" y1="12" x2="12" y2="18" />
          </svg>
          Hierarchy
        </button>
      </div>

      {/* Content Area */}
      <div className="f-dept-content">
        {activeTab === 'crew' && <FarmersCrewPage />}
        {activeTab === 'hierarchy' && <FarmersHierarchyPage />}
        {activeTab === 'attendance' && (
          <AttendancePage roleFilter="farmers" departmentLabel="Farmers Department" />
        )}
        {activeTab !== 'crew' && activeTab !== 'hierarchy' && activeTab !== 'attendance' && (
          <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Page coming soon...</div>
        )}
      </div>
    </div>
  );
}
