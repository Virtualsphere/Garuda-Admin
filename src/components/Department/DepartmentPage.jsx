import React, { useState } from 'react';
import CrewPage from './CrewPage';
import HierarchyPage from './HierarchyPage';
import AttendancePage from './AttendancePage';
import './DepartmentPage.css';

const subTabs = [
  { key: 'crew', label: 'Crew', icon: 'users' },
  { key: 'attendance', label: 'Attendance', icon: 'clock' },
  { key: 'budget', label: 'Budget', icon: 'budget' },
  { key: 'hierarchy', label: 'Hierarchy', icon: 'hierarchy' },
];

const tabIcons = {
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  budget: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  hierarchy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
};

export default function DepartmentPage() {
  const [activeSubTab, setActiveSubTab] = useState('crew');

  return (
    <div className="department-page">
      {/* Sub Tabs */}
      <div className="dept-sub-tabs">
        {subTabs.map((tab) => (
          <button
            key={tab.key}
            className={`dept-sub-tab${activeSubTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveSubTab(tab.key)}
          >
            {tabIcons[tab.icon]}
            {tab.label}
          </button>
        ))}
      </div>
      <div className="dept-divider" />

      {/* Content */}
      <div className="dept-content">
        {activeSubTab === 'crew' && <CrewPage />}
        {activeSubTab === 'hierarchy' && <HierarchyPage />}
        {activeSubTab === 'attendance' && (
          <AttendancePage roleFilter="call center" departmentLabel="Call Center Department" />
        )}
        {activeSubTab === 'budget' && (
          <div style={{ padding: '24px', color: 'var(--text-muted)', fontSize: '14px' }}>
            Budget page coming soon...
          </div>
        )}
      </div>
    </div>
  );
}
