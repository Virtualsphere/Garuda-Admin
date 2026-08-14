import React from 'react';
import './HRPage.css';
import HRAllEmployees from './HRAllEmployees';
import HRRecruitmentMap from './HRRecruitmentMap';

export default function HRPage({ activeTab }) {
  return (
    <div className="hr-main-page">
      <div className="hr-main-content">
        {activeTab === 'allemployees' && <HRAllEmployees />}
        {activeTab === 'map' && <HRRecruitmentMap />}
        {activeTab !== 'allemployees' && activeTab !== 'map' && (
          <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Page coming soon...</div>
        )}
      </div>
    </div>
  );
}
