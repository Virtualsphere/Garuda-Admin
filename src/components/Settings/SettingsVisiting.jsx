import React, { useState, useEffect } from 'react';
import settingsService from '../../services/settingsService';
import './SettingsVisiting.css';

const DEFAULT_SLABS = [
  { from: '0', to: '1', rate: '500' },
  { from: '1', to: '2', rate: '1000' },
  { from: '2', to: '5', rate: '2000' },
  { from: '5', to: '10', rate: '5000' },
  { from: '10', to: '20', rate: '10000' },
  { from: '20', to: '50', rate: '20000' },
  { from: '50', to: '100', rate: '50000' },
];

export default function SettingsVisiting() {
  const [slabs, setSlabs] = useState(DEFAULT_SLABS);
  const [savedSlabs, setSavedSlabs] = useState(DEFAULT_SLABS);
  const [saving, setSaving] = useState(false);
  const [simInput, setSimInput] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await settingsService.get('visiting_slabs');
        const value = data.data?.value ?? DEFAULT_SLABS;
        setSlabs(value);
        setSavedSlabs(value);
      } catch (err) {
        console.error('Failed to load visiting slabs:', err);
      }
    };
    load();
  }, []);

  const handleFieldChange = (idx, field, value) => {
    setSlabs((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const handleDelete = (idx) => {
    setSlabs((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAdd = () => {
    setSlabs((prev) => [...prev, { from: '', to: '', rate: '' }]);
  };

  const handleReset = () => setSlabs(savedSlabs);

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsService.set('visiting_slabs', slabs);
      setSavedSlabs(slabs);
    } catch (err) {
      console.error('Failed to save visiting slabs:', err);
    } finally {
      setSaving(false);
    }
  };

  const simulatedFee = (() => {
    const valuation = Number(simInput);
    if (!valuation || valuation <= 0) return 0;
    const matched = slabs.find((s) => valuation >= Number(s.from) && valuation < Number(s.to));
    const rate = matched ? Number(matched.rate) : Number(slabs[slabs.length - 1]?.rate || 0);
    return Math.round(valuation * rate);
  })();

  return (
    <div className="settings-visiting-page">
      {/* Header */}
      <div className="settings-header">
        <div className="settings-title-group">
          <div className="settings-title-icon">₹</div>
          <div className="settings-title-texts">
            <span className="settings-title">SERVICE CHARGE MATRIX: VISITING</span>
            <span className="settings-subtitle">PROGRESSIVE SLAB-BASED VISIT FEES</span>
          </div>
        </div>
        <div className="settings-actions">
          <div className="settings-btn outline" onClick={handleReset}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
            RESET
          </div>
          <div className="settings-btn solid" onClick={handleSave} style={{ opacity: saving ? 0.6 : 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
            {saving ? 'SAVING...' : 'SAVE PROTOCOL'}
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="settings-content-layout">
        {/* Left Panel */}
        <div className="settings-left-panel">
          <div className="settings-panel-header">
            <div className="settings-panel-title-row">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
              PROGRESSIVE VISIT FEE REGISTRY
            </div>
            <div className="settings-panel-subtitle">
              DEFINED CUMULATIVELY ACROSS PROPERTY VALUATION TIERS.
            </div>
          </div>
          
          <div className="settings-table-header">
            <span>VALUATION RANGE (CRORES)</span>
            <span>RATE PER CRORE (₹)</span>
          </div>

          <div className="settings-slab-list">
            {slabs.map((slab, index) => (
              <div key={index} className="settings-slab-item">
                <div className="settings-slab-range">
                  <div className="settings-slab-index">{index + 1}</div>
                  <div className="settings-input-group">
                    <span className="settings-input-label">FROM</span>
                    <input type="text" className="settings-input" value={slab.from} onChange={(e) => handleFieldChange(index, 'from', e.target.value)} />
                  </div>
                  <span className="settings-range-sep">-</span>
                  <div className="settings-input-group">
                    <span className="settings-input-label">TO</span>
                    <input type="text" className="settings-input" value={slab.to} onChange={(e) => handleFieldChange(index, 'to', e.target.value)} />
                  </div>
                  <span className="settings-range-unit">CR</span>
                </div>
                <div className="settings-slab-rate">
                  <div className="settings-rate-input-wrap">
                    <span className="settings-rate-symbol">₹</span>
                    <input type="text" className="settings-rate-input" value={slab.rate} onChange={(e) => handleFieldChange(index, 'rate', e.target.value)} />
                  </div>
                  <div className="settings-slab-delete" onClick={() => handleDelete(index)} style={{ cursor: 'pointer' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="settings-add-slab" onClick={handleAdd} style={{ cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            REGISTER NEW SLAB TIER
          </div>
        </div>

        {/* Right Panel */}
        <div className="settings-right-panel">
          <div className="settings-simulator-card">
            <div className="settings-card-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><path d="M7 14h.01" /><path d="M11 14h.01" /><path d="M15 14h.01" /><path d="M7 18h.01" /><path d="M11 18h.01" /><path d="M15 18h.01" /></svg>
              MISSION FEE SIMULATOR
            </div>

            <div className="settings-simulator-input-group">
              <label className="settings-simulator-label">INPUT VALUATION (CR)</label>
              <div className="settings-simulator-input-wrap">
                <input type="text" className="settings-simulator-input" placeholder="e.g. 15.5" value={simInput} onChange={(e) => setSimInput(e.target.value)} />
                <span className="settings-simulator-unit">CR</span>
              </div>
            </div>

            <div className="settings-result-card">
              <span className="settings-result-label">CALCULATED TOTAL FEE</span>
              <span className="settings-result-value">₹{simulatedFee}</span>
              <div className="settings-result-bg-icon">₹</div>
            </div>
          </div>

          <div className="settings-info-card">
            <svg className="settings-info-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
            <div className="settings-info-texts">
              <span className="settings-info-title">REGISTRY CALCULATION NOTE</span>
              <span className="settings-info-desc">VISIT FEES ARE CUMULATIVE. THE RATE FOR EACH TIER IS APPLIED TO THE VALUE FALLING WITHIN THAT SPECIFIC RANGE, ENSURING EQUITABLE PRICING FOR HIGH-VALUE PROPERTIES.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
