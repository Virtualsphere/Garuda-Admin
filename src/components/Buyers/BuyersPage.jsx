import React, { useState } from 'react';
import BuyerEnquiryFee from './BuyerEnquiryFee';
import BuyerEnquiry from './BuyerEnquiry';
import BuyerLinkBuyer from './BuyerLinkBuyer';
import BuyerAttachLand from './BuyerAttachLand';
import BuyerVisits from './BuyerVisits';
import './BuyersPage.css';

const SUB_TABS = [
  { key: 'enquiry-fee',    label: 'Enquiry fee',     icon: 'card' },
  { key: 'enquiry',        label: 'Enquiry',          icon: 'users' },
  { key: 'link-buyer',     label: 'Link buyer',       icon: 'link' },
  { key: 'attach-land',    label: 'Attach land',      icon: 'map' },
  { key: 'attach-schedule',label: 'Attach & schedule',icon: 'calendar' },
  { key: 'visits',         label: 'Visits',           icon: 'location' },
];

function SubTabIcon({ type }) {
  switch (type) {
    case 'card':
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
        </svg>
      );
    case 'users':
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      );
    case 'link':
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
      );
    case 'map':
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
          <line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
        </svg>
      );
    case 'calendar':
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      );
    case 'location':
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      );
    default:
      return null;
  }
}

export default function BuyersPage() {
  const [activeSubTab, setActiveSubTab] = useState('enquiry-fee');

  return (
    <div className="bp-page">
      {/* Sub-tab bar */}
      <div className="bp-sub-tabs">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`bp-sub-tab${activeSubTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveSubTab(tab.key)}
          >
            <SubTabIcon type={tab.icon} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="bp-content">
        {activeSubTab === 'enquiry-fee'     && <BuyerEnquiryFee />}
        {activeSubTab === 'enquiry'         && <BuyerEnquiry />}
        {activeSubTab === 'link-buyer'      && <BuyerLinkBuyer />}
        {activeSubTab === 'attach-land'     && <BuyerAttachLand />}
        {activeSubTab === 'attach-schedule' && (
          <div className="bp-coming-soon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            ATTACH & SCHEDULE — COMING SOON
          </div>
        )}
        {activeSubTab === 'visits'          && <BuyerVisits />}
      </div>
    </div>
  );
}
