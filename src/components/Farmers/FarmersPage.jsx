import React, { useState } from 'react';
import './FarmersPage.css';
import FarmersRegistry from './FarmersRegistry';
import FarmersOnboard from './FarmersOnboard';

export default function FarmersPage() {
  const [activeTab, setActiveTab] = useState('onboard');

  return (
    <div className="f-main-page">
      {/* Sub Tabs */}
      <div className="f-main-sub-tabs">
        <button
          className={`f-main-sub-tab${activeTab === 'registry' ? ' active' : ''}`}
          onClick={() => setActiveTab('registry')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          Registry
        </button>
        <button
          className={`f-main-sub-tab${activeTab === 'farmer-info' ? ' active' : ''}`}
          onClick={() => setActiveTab('farmer-info')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          Farmer info
        </button>
        <button
          className={`f-main-sub-tab${activeTab === 'onboard' ? ' active' : ''}`}
          onClick={() => setActiveTab('onboard')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
          Onboard farmer
        </button>
      </div>

      {/* Content Area */}
      <div className="f-main-content">
        {activeTab === 'registry' && <FarmersRegistry />}
        {activeTab === 'onboard' && <FarmersOnboard />}
        {activeTab === 'farmer-info' && (
          <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Farmer info page coming soon...</div>
        )}
      </div>
    </div>
  );
}
