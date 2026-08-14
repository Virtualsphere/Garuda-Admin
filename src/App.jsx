import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import LoginPage from './components/Auth/LoginPage';
import Sidebar from './components/Sidebar/Sidebar';
import SignalAuditHub from './components/SignalAuditHub/SignalAuditHub';
import DepartmentPage from './components/Department/DepartmentPage';
import InboundSignals from './components/InboundSignals/InboundSignals';
import LandPage from './components/Land/LandPage';
import LandDataPage from './components/Land/LandDataPage';
import LandWorkAllotmentPage from './components/Land/LandWorkAllotmentPage';
import LandCallsPage from './components/Land/LandCallsPage';
import LandWalletPage from './components/Land/LandWalletPage';
import FarmersDepartmentPage from './components/Farmers/FarmersDepartmentPage';
import FarmersCallsPage from './components/Farmers/FarmersCallsPage';
import FarmersPage from './components/Farmers/FarmersPage';
import AgentsDepartmentPage from './components/Agents/AgentsDepartmentPage';
import AgentsPage from './components/Agents/AgentsPage';
import AgentsProcessPage from './components/Agents/AgentsProcessPage';
import HRPage from './components/HR/HRPage';
import SettingsPage from './components/Settings/SettingsPage';
import BuyersPage from './components/Buyers/BuyersPage';
import BuyersDepartmentPage from './components/Buyers/BuyersDepartmentPage';
import './App.css';

const callCenterTopTabs = [
  { key: 'calls', label: 'Calls', icon: 'phone' },
  { key: 'department', label: 'Department', icon: 'grid' },
  { key: 'report', label: 'Report', icon: 'file' },
  { key: 'dashboard', label: 'Dashboard', icon: 'chart' },
];

const landTopTabs = [
  { key: 'land-data', label: 'Land data', icon: 'map' },
  { key: 'work-allotment', label: 'Work allotment', icon: 'send' },
  { key: 'wallet', label: 'Wallet', icon: 'wallet' },
  { key: 'department', label: 'Department', icon: 'grid' },
  { key: 'calls', label: 'Calls', icon: 'phone' },
  { key: 'boards', label: 'Boards', icon: 'board' },
  { key: 'dashboard', label: 'Dashboard', icon: 'chart' },
];

const farmersTopTabs = [
  { key: 'farmers', label: 'Farmers', icon: 'truck' },
  { key: 'department', label: 'Department', icon: 'grid' },
  { key: 'calls', label: 'Calls', icon: 'phone' },
  { key: 'dashboard', label: 'Dashboard', icon: 'chart' },
];

const buyersTopTabs = [
  { key: 'process', label: 'Process', icon: 'file' },
  { key: 'department', label: 'Department', icon: 'grid' },
  { key: 'calls', label: 'Calls', icon: 'phone' },
  { key: 'dashboard', label: 'Dashboard', icon: 'chart' },
];

const agentsTopTabs = [
  { key: 'agents', label: 'Agents', icon: 'user' },
  { key: 'process', label: 'Process', icon: 'file' },
  { key: 'department', label: 'Department', icon: 'grid' },
  { key: 'calls', label: 'Calls', icon: 'phone' },
  { key: 'dashboard', label: 'Dashboard', icon: 'chart' },
];

const hrTopTabs = [
  { key: 'map', label: 'Recruitment map', icon: 'map' },
  { key: 'department', label: 'Department', icon: 'grid' },
  { key: 'allemployees', label: 'All employees', icon: 'users' },
  { key: 'academy', label: 'Training academy', icon: 'video' },
  { key: 'dashboard', label: 'Dashboard', icon: 'chart' },
];

const settingsTopTabs = [
  { key: 'petrol', label: 'Petrol charges', icon: 'file' },
  { key: 'landstarget', label: 'Lands target', icon: 'map' },
  { key: 'agents', label: 'Required agents', icon: 'users' },
  { key: 'enquiry', label: 'Enquiry charges', icon: 'file' },
  { key: 'visiting', label: 'Visiting charges', icon: 'file' },
  { key: 'security', label: 'Agent security deposit', icon: 'file' },
  { key: 'offices', label: 'Regional offices', icon: 'grid' },
];

function TopTabIcon({ type }) {
  switch (type) {
    case 'phone':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      );
    case 'grid':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      );
    case 'file':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    case 'chart':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="9" />
          <rect x="14" y="3" width="7" height="5" />
          <rect x="14" y="12" width="7" height="9" />
          <rect x="3" y="16" width="7" height="5" />
        </svg>
      );
    case 'map':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
          <line x1="8" y1="2" x2="8" y2="18" />
          <line x1="16" y1="6" x2="16" y2="22" />
        </svg>
      );
    case 'user':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'users':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'video':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
      );
    case 'send':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      );
    case 'wallet':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
          <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
          <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
        </svg>
      );
    case 'board':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </svg>
      );
    case 'truck':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      );
    default:
      return null;
  }
}

export default function App() {
  const { isAuthenticated } = useAuth();
  const [activeSection, setActiveSection] = useState('farmers'); // Default to farmers for testing
  const [activeTabCallCenter, setActiveTabCallCenter] = useState('calls');
  const [activeTabLand, setActiveTabLand] = useState('data');
  const [activeTabFarmers, setActiveTabFarmers] = useState('department');
  const [activeTabBuyers, setActiveTabBuyers] = useState('process');
  const [activeTabAgents, setActiveTabAgents] = useState('process');
  const [activeTabHR, setActiveTabHR] = useState('allemployees');
  const [activeTabSettings, setActiveTabSettings] = useState('visiting');

  // Handle theme switching
  useEffect(() => {
    if (activeSection === 'callcenter') {
      document.documentElement.setAttribute('data-theme', 'callcenter');
    } else if (activeSection === 'land') {
      document.documentElement.setAttribute('data-theme', 'land');
    } else if (activeSection === 'farmers') {
      document.documentElement.setAttribute('data-theme', 'farmers');
    } else if (activeSection === 'buyers') {
      document.documentElement.setAttribute('data-theme', 'buyers');
    } else if (activeSection === 'agents') {
      document.documentElement.setAttribute('data-theme', 'agents');
    } else if (activeSection === 'hr') {
      document.documentElement.setAttribute('data-theme', 'hr');
    } else if (activeSection === 'settings') {
      document.documentElement.setAttribute('data-theme', 'settings');
    } else {
      document.documentElement.setAttribute('data-theme', 'callcenter');
    }
  }, [activeSection]);

  let topTabs = callCenterTopTabs;
  let activeTab = activeTabCallCenter;
  
  if (activeSection === 'land') {
    topTabs = landTopTabs;
    activeTab = activeTabLand;
  } else if (activeSection === 'farmers') {
    topTabs = farmersTopTabs;
    activeTab = activeTabFarmers;
  } else if (activeSection === 'buyers') {
    topTabs = buyersTopTabs;
    activeTab = activeTabBuyers;
  } else if (activeSection === 'agents') {
    topTabs = agentsTopTabs;
    activeTab = activeTabAgents;
  } else if (activeSection === 'hr') {
    topTabs = hrTopTabs;
    activeTab = activeTabHR;
  } else if (activeSection === 'settings') {
    topTabs = settingsTopTabs;
    activeTab = activeTabSettings;
  }
  
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const handleTabChange = (key) => {
    if (activeSection === 'land') {
      setActiveTabLand(key);
    } else if (activeSection === 'farmers') {
      setActiveTabFarmers(key);
    } else if (activeSection === 'buyers') {
      setActiveTabBuyers(key);
    } else if (activeSection === 'agents') {
      setActiveTabAgents(key);
    } else if (activeSection === 'hr') {
      setActiveTabHR(key);
    } else if (activeSection === 'settings') {
      setActiveTabSettings(key);
    } else {
      setActiveTabCallCenter(key);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      <div className="main-content">
        {/* Shared Top Tab Bar */}
        <div className="main-top-bar">
          <div className="main-top-tabs">
            {topTabs.map((tab) => (
              <button
                key={tab.key}
                className={`main-top-tab${activeTab === tab.key ? ' active' : ''}`}
                onClick={() => handleTabChange(tab.key)}
              >
                <TopTabIcon type={tab.icon} />
                {tab.label}
              </button>
            ))}
          </div>
          <button className="main-fullscreen-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>
        </div>

        {/* Page Content */}
        <div className="page-container">
          {activeSection === 'callcenter' && (
            <>
              {activeTab === 'calls' && <SignalAuditHub />}
              {activeTab === 'department' && <DepartmentPage />}
              {activeTab === 'report' && (
                <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Report page coming soon...</div>
              )}
              {activeTab === 'dashboard' && (
                <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Dashboard page coming soon...</div>
              )}
            </>
          )}

          {activeSection === 'land' && (
            <>
              {activeTab === 'wallet' && <LandWalletPage />}
              {activeTab === 'land-data' && <LandDataPage />}
              {activeTab === 'work-allotment' && <LandWorkAllotmentPage />}
              {activeTab === 'department' && <LandPage />}
              {activeTab === 'calls' && <LandCallsPage />}
              {activeTab !== 'wallet' && activeTab !== 'department' && activeTab !== 'land-data' && activeTab !== 'work-allotment' && activeTab !== 'calls' && (
                <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Page coming soon...</div>
              )}
            </>
          )}

          {activeSection === 'farmers' && (
            <>
              {activeTab === 'department' && <FarmersDepartmentPage />}
              {activeTab === 'calls' && <FarmersCallsPage />}
              {activeTab === 'farmers' && <FarmersPage />}
              {activeTab !== 'department' && activeTab !== 'calls' && activeTab !== 'farmers' && (
                <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Page coming soon...</div>
              )}
            </>
          )}
          
          {activeSection === 'buyers' && (
            <>
              {activeTab === 'process' && <BuyersPage />}
              {activeTab === 'department' && <BuyersDepartmentPage />}
              {activeTab !== 'process' && activeTab !== 'department' && (
                <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Page coming soon...</div>
              )}
            </>
          )}

          {/* For other sections, show placeholder */}
          {activeSection !== 'callcenter' && activeSection !== 'land' && activeSection !== 'farmers' && activeSection !== 'buyers' && activeSection !== 'agents' && activeSection !== 'hr' && activeSection !== 'settings' && (
            <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Section coming soon...</div>
          )}
          {activeSection === 'agents' && (
            <>
              {activeTab === 'department' && <AgentsDepartmentPage />}
              {activeTab === 'agents' && <AgentsPage />}
              {activeTab === 'process' && <AgentsProcessPage />}
              {activeTab !== 'department' && activeTab !== 'agents' && activeTab !== 'process' && (
                <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Page coming soon...</div>
              )}
            </>
          )}
          {activeSection === 'hr' && (
            <HRPage activeTab={activeTab} />
          )}
          {activeSection === 'settings' && (
            <SettingsPage activeTab={activeTab} />
          )}
        </div>

        {/* Shared Inbound Signals (floating) — hidden on Call Center > Calls since it has its own inline version */}
        {!(activeSection === 'callcenter' && activeTab === 'calls') && <InboundSignals />}
      </div>
    </div>
  );
}
