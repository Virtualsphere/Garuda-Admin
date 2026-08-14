import React, { useState, useEffect } from 'react';
import settingsService from '../../services/settingsService';
import './SettingsVisiting.css'; // Reusing header classes
import './SettingsLandsTarget.css';

const DEFAULT_TARGETS = [
  { from: '0', to: '500', goal: '5' },
  { from: '501', to: '1000', goal: '12' },
  { from: '1001', to: '2000', goal: '25' },
  { from: '2001', to: '5000', goal: '50' },
];

export default function SettingsLandsTarget() {
  const [targets, setTargets] = useState(DEFAULT_TARGETS);
  const [savedTargets, setSavedTargets] = useState(DEFAULT_TARGETS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await settingsService.get('lands_target_slabs');
        const value = data.data?.value ?? DEFAULT_TARGETS;
        setTargets(value);
        setSavedTargets(value);
      } catch (err) {
        console.error('Failed to load land targets:', err);
      }
    };
    load();
  }, []);

  const handleFieldChange = (idx, field, value) => {
    setTargets((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  };

  const handleDelete = (idx) => {
    setTargets((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAdd = () => {
    setTargets((prev) => [...prev, { from: '', to: '', goal: '' }]);
  };

  const handleReset = () => setTargets(savedTargets);

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsService.set('lands_target_slabs', targets);
      setSavedTargets(targets);
    } catch (err) {
      console.error('Failed to save land targets:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-lands-page">
      {/* Header */}
      <div className="settings-header">
        <div className="settings-title-group">
          <div className="settings-title-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
          </div>
          <div className="settings-title-texts">
            <span className="settings-title">LAND COLLECTION TARGETS</span>
            <span className="settings-subtitle">VILLAGE AREA-BASED UNIT BENCHMARKS</span>
          </div>
        </div>
        <div className="settings-actions">
          <div className="settings-btn outline" onClick={handleReset}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
            RESET REGISTRY
          </div>
          <div className="settings-btn solid" onClick={handleSave} style={{ opacity: saving ? 0.6 : 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
            {saving ? 'SAVING...' : 'SAVE TARGETS'}
          </div>
        </div>
      </div>

      <div className="settings-lands-content">
        <div className="settings-lands-table-header">
          <div>AREA FROM (ACRES)</div>
          <div>AREA TO (ACRES)</div>
          <div>COLLECTION GOAL (UNITS)</div>
          <div>ACTION</div>
        </div>

        <div className="settings-lands-list">
          {targets.map((t, idx) => (
            <div key={idx} className="settings-lands-row">
              <input type="text" className="settings-lands-input" value={t.from} onChange={(e) => handleFieldChange(idx, 'from', e.target.value)} />
              <input type="text" className="settings-lands-input" value={t.to} onChange={(e) => handleFieldChange(idx, 'to', e.target.value)} />
              <div className="settings-lands-goal-wrap">
                <input type="text" className="settings-lands-goal-input" value={t.goal} onChange={(e) => handleFieldChange(idx, 'goal', e.target.value)} />
                <svg className="settings-lands-goal-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
              </div>
              <div className="settings-lands-action" onClick={() => handleDelete(idx)} style={{ cursor: 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
              </div>
            </div>
          ))}
        </div>

        <div className="settings-lands-add-btn" onClick={handleAdd} style={{ cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          ADD NEW TARGET SLAB
        </div>
      </div>

      <div className="settings-lands-info-card">
        <svg className="settings-lands-info-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
        <div className="settings-lands-info-texts">
          <span className="settings-lands-info-title">BENCHMARKING PROTOCOL</span>
          <span className="settings-lands-info-desc">LAND COLLECTION TARGETS ARE USED TO MONITOR TERRITORIAL SATURATION. THE PROGRESS LOGIC IN THE <strong>Trainee Observation</strong> AND <strong>Village Abstract</strong> HUBS IS DYNAMICALLY CALCULATED BASED ON THESE AREA-SLAB DEFINITIONS.</span>
        </div>
      </div>
    </div>
  );
}
