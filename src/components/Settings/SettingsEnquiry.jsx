import React, { useState, useEffect } from 'react';
import settingsService from '../../services/settingsService';
import './SettingsVisiting.css'; // Reuse common layout classes
import './SettingsEnquiry.css';

const DEFAULT_FEE = 1500;

export default function SettingsEnquiry() {
  const [fee, setFee] = useState(DEFAULT_FEE);
  const [savedFee, setSavedFee] = useState(DEFAULT_FEE);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await settingsService.get('enquiry_fee');
        const value = data.data?.value ?? DEFAULT_FEE;
        setFee(value);
        setSavedFee(value);
      } catch (err) {
        console.error('Failed to load enquiry fee:', err);
      }
    };
    load();
  }, []);

  const handleReset = () => setFee(savedFee);

  const handleSave = async () => {
    setSaving(true);
    try {
      const numericFee = Number(fee) || 0;
      await settingsService.set('enquiry_fee', numericFee);
      setFee(numericFee);
      setSavedFee(numericFee);
    } catch (err) {
      console.error('Failed to save enquiry fee:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-enquiry-page">
      {/* Header */}
      <div className="settings-header">
        <div className="settings-title-group">
          <div className="settings-title-icon">₹</div>
          <div className="settings-title-texts">
            <span className="settings-title">SERVICE CHARGE MATRIX: ENQUIRY</span>
            <span className="settings-subtitle">STANDARDIZED FIXED VETTING FEES</span>
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
        <div className="settings-enquiry-left">
          <div className="settings-enquiry-panel-header">
            <div className="settings-enquiry-title-row">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              STANDARD ENQUIRY VETTING FEE
            </div>
            <div className="settings-enquiry-subtitle">
              ONE-TIME REGISTRATION AND MISSION VETTING CHARGE.
            </div>
          </div>

          <div className="settings-enquiry-content">
            <div className="settings-enquiry-rate-group">
              <span className="settings-enquiry-rate-label">GLOBAL STANDARD RATE (₹)</span>
              <div className="settings-enquiry-rate-input-wrap">
                <span className="settings-enquiry-rate-symbol">₹</span>
                <input type="text" className="settings-enquiry-rate-input" value={fee} onChange={(e) => setFee(e.target.value)} />
              </div>
            </div>

            <div className="settings-enquiry-info-banner">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
              <span className="settings-enquiry-info-text">
                APPLIED UNIVERSALLY TO ALL NEW INVESTOR INQUIRIES REGARDLESS OF TARGET BUDGET OR TERRITORIAL RANGE.
              </span>
            </div>
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
              <label className="settings-simulator-label">STANDARD PROTOCOL</label>
              {/* No input box needed as per design Image 2, it's just empty space here */}
              <div style={{ height: '48px' }}></div> 
            </div>

            <div className="settings-result-card">
              <span className="settings-result-label">CALCULATED TOTAL FEE</span>
              <span className="settings-result-value">₹0</span>
              <div className="settings-result-bg-icon">₹</div>
            </div>
          </div>

          <div className="settings-info-card">
            <svg className="settings-info-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
            <div className="settings-info-texts">
              <span className="settings-info-title">REGISTRY CALCULATION NOTE</span>
              <span className="settings-info-desc">ENQUIRY VETTING FEES ARE FIXED AND COVERS THE ADMINISTRATIVE OVERHEAD OF REQUIREMENT VALIDATION AND BUYER PROFILING.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
