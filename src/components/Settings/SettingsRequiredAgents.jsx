import React, { useState, useEffect } from 'react';
import settingsService from '../../services/settingsService';
import './SettingsVisiting.css'; // Reusing header classes
import './SettingsRequiredAgents.css';

const DEFAULT_AGENTS_DATA = [
  { from: '0', to: '500', agents: '5' },
  { from: '501', to: '1000', agents: '12' },
  { from: '1001', to: '2000', agents: '25' },
  { from: '2001', to: '5000', agents: '50' },
];

export default function SettingsRequiredAgents() {
  const [agentsData, setAgentsData] = useState(DEFAULT_AGENTS_DATA);
  const [savedData, setSavedData] = useState(DEFAULT_AGENTS_DATA);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await settingsService.get('required_agents_slabs');
        const value = data.data?.value ?? DEFAULT_AGENTS_DATA;
        setAgentsData(value);
        setSavedData(value);
      } catch (err) {
        console.error('Failed to load required agents slabs:', err);
      }
    };
    load();
  }, []);

  const handleFieldChange = (idx, field, value) => {
    setAgentsData((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  };

  const handleDelete = (idx) => {
    setAgentsData((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAdd = () => {
    setAgentsData((prev) => [...prev, { from: '', to: '', agents: '' }]);
  };

  const handleReset = () => setAgentsData(savedData);

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsService.set('required_agents_slabs', agentsData);
      setSavedData(agentsData);
    } catch (err) {
      console.error('Failed to save required agents slabs:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-agents-page">
      {/* Header */}
      <div className="settings-header">
        <div className="settings-title-group">
          <div className="settings-title-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
          </div>
          <div className="settings-title-texts">
            <span className="settings-title">REQUIRED AGENTS</span>
            <span className="settings-subtitle">SLAB-BASED TERRITORIAL BENCHMARKING</span>
          </div>
        </div>
        <div className="settings-actions">
          <div className="settings-btn outline" onClick={handleReset}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
            RESET REGISTRY
          </div>
          <div className="settings-btn solid" onClick={handleSave} style={{ opacity: saving ? 0.6 : 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
            {saving ? 'SAVING...' : 'SAVE ALL CHANGES'}
          </div>
        </div>
      </div>

      <div className="settings-agents-content">
        <div className="settings-agents-table-header">
          <div>FROM (ACRES)</div>
          <div>TO (ACRES)</div>
          <div>NO. OF AGENTS REQUIRED</div>
          <div>ACTION</div>
        </div>

        <div className="settings-agents-list">
          {agentsData.map((t, idx) => (
            <div key={idx} className="settings-agents-row">
              <input type="text" className="settings-agents-input" value={t.from} onChange={(e) => handleFieldChange(idx, 'from', e.target.value)} />
              <input type="text" className="settings-agents-input" value={t.to} onChange={(e) => handleFieldChange(idx, 'to', e.target.value)} />
              <div className="settings-agents-goal-wrap">
                <input type="text" className="settings-agents-goal-input" value={t.agents} onChange={(e) => handleFieldChange(idx, 'agents', e.target.value)} />
              </div>
              <div className="settings-agents-action" onClick={() => handleDelete(idx)} style={{ cursor: 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
              </div>
            </div>
          ))}
        </div>

        <div className="settings-agents-add-btn" onClick={handleAdd} style={{ cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          ADD NEW SLAB TIER
        </div>
      </div>
    </div>
  );
}
