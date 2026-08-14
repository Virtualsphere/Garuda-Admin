import React from 'react';
import './SettingsPage.css';
import SettingsVisiting from './SettingsVisiting';
import SettingsEnquiry from './SettingsEnquiry';
import SettingsLandsTarget from './SettingsLandsTarget';
import SettingsRequiredAgents from './SettingsRequiredAgents';
import SettingsPetrol from './SettingsPetrol';

export default function SettingsPage({ activeTab }) {
  const renderContent = () => {
    switch (activeTab) {
      case 'visiting':
        return <SettingsVisiting />;
      case 'enquiry':
        return <SettingsEnquiry />;
      case 'landstarget':
        return <SettingsLandsTarget />;
      case 'agents':
        return <SettingsRequiredAgents />;
      case 'petrol':
        return <SettingsPetrol />;
      default:
        return <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Page coming soon...</div>;
    }
  };

  return (
    <div className="settings-page-container">
      {renderContent()}
    </div>
  );
}
