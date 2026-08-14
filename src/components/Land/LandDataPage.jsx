import React, { useState } from 'react';
import './LandDataPage.css';
import VerifiedLandsList from './VerifiedLandsList';
import PhysicalVerificationList from './PhysicalVerificationList';
import PhoneVerificationList from './PhoneVerificationList';
import AddLandForm from './AddLandForm';

export default function LandDataPage() {
  const [activeLevel1, setActiveLevel1] = useState('verification');
  const [activeLevel2, setActiveLevel2] = useState('verified');

  return (
    <div className="land-data-page">
      {/* Level 1 Sub Tabs */}
      <div className="land-data-sub-tabs">
        <button
          className={`ld-sub-tab${activeLevel1 === 'add-land' ? ' active' : ''}`}
          onClick={() => setActiveLevel1('add-land')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          Add land
        </button>
        <button
          className={`ld-sub-tab${activeLevel1 === 'verification' ? ' active' : ''}`}
          onClick={() => setActiveLevel1('verification')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          Verification
        </button>
      </div>

      {/* Level 2 Sub Tabs (only show if Verification is selected) */}
      {activeLevel1 === 'verification' && (
        <div className="verification-sub-tabs">
          <button
            className={`ver-sub-tab${activeLevel2 === 'phone' ? ' active' : ''}`}
            onClick={() => setActiveLevel2('phone')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
            Phone list
          </button>
          <button
            className={`ver-sub-tab${activeLevel2 === 'verify-details' ? ' active' : ''}`}
            onClick={() => setActiveLevel2('verify-details')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            Verify details
          </button>
          <button
            className={`ver-sub-tab${activeLevel2 === 'physical' ? ' active' : ''}`}
            onClick={() => setActiveLevel2('physical')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Physical list
          </button>
          <button
            className={`ver-sub-tab${activeLevel2 === 'review' ? ' active' : ''}`}
            onClick={() => setActiveLevel2('review')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12h3l3-9 5 18 3-9h5" />
            </svg>
            Review details
          </button>
          <button
            className={`ver-sub-tab${activeLevel2 === 'verified' ? ' active-green' : ''}`}
            onClick={() => setActiveLevel2('verified')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            Verified lands
          </button>
        </div>
      )}

      {/* Content Area */}
      <div className="land-data-content">
        {activeLevel1 === 'add-land' && <AddLandForm />}
        {activeLevel1 === 'verification' && activeLevel2 === 'verified' && <VerifiedLandsList />}
        {activeLevel1 === 'verification' && activeLevel2 === 'physical' && <PhysicalVerificationList />}
        {activeLevel1 === 'verification' && activeLevel2 === 'phone' && <PhoneVerificationList />}
        {activeLevel1 === 'verification' && (activeLevel2 === 'verify-details' || activeLevel2 === 'review') && (
          <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Page coming soon...</div>
        )}
      </div>
    </div>
  );
}
