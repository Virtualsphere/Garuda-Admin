import React, { useState, useEffect } from 'react';
import settingsService from '../../services/settingsService';
import './SettingsVisiting.css'; // Reusing header classes
import './SettingsPetrol.css';

const DEFAULT_PETROL = {
  currentRate: '2.5',
  history: [
    { date: '22 AUG', rate: '2.5', status: 'active' },
    { date: '15 JUL', rate: '2.2', status: 'archived' },
    { date: '04 FEB', rate: '2.0', status: 'archived' },
  ],
};

export default function SettingsPetrol() {
  const [rate, setRate] = useState(DEFAULT_PETROL.currentRate);
  const [history, setHistory] = useState(DEFAULT_PETROL.history);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await settingsService.get('petrol_rate');
        const value = data.data?.value ?? DEFAULT_PETROL;
        setRate(value.currentRate);
        setHistory(value.history || []);
      } catch (err) {
        console.error('Failed to load petrol rate:', err);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
      const newHistory = [
        { date: today, rate, status: 'active' },
        ...history.map((h) => ({ ...h, status: 'archived' })),
      ];
      await settingsService.set('petrol_rate', { currentRate: rate, history: newHistory });
      setHistory(newHistory);
    } catch (err) {
      console.error('Failed to save petrol rate:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-petrol-page">
      {/* Header */}
      <div className="settings-header">
        <div className="settings-title-group">
          <div className="settings-title-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 22v-8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v8" /><path d="M14 22V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v18" /><path d="M14 13h8" /><path d="M3 22h18" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /><path d="M11 12H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" /></svg>
          </div>
          <div className="settings-title-texts">
            <span className="settings-title">REIMBURSEMENT SETTINGS</span>
            <span className="settings-subtitle">MANAGE GLOBAL TRANSPORT CONSTANTS</span>
          </div>
        </div>
        <div className="settings-actions">
          <div className="settings-btn solid" onClick={handleSave} style={{ opacity: saving ? 0.6 : 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
            {saving ? 'SAVING...' : 'SAVE RATE'}
          </div>
        </div>
      </div>

      <div className="settings-petrol-layout">
        {/* Left Panel */}
        <div className="settings-petrol-left">
          <div className="settings-petrol-card-header">
            <div className="settings-petrol-card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="8" rx="2" ry="2" /><circle cx="7" cy="19" r="2" /><circle cx="17" cy="19" r="2" /><path d="M3 11V7a2 2 0 0 1 2-2h10l4 6" /></svg>
              TRAVEL & TRANSPORT
            </div>
            <div className="settings-petrol-card-subtitle">
              STANDARDIZED REIMBURSEMENT RATES FOR ALL FIELD PERSONNEL.
            </div>
          </div>

          <div className="settings-petrol-input-group">
            <label className="settings-petrol-label">PETROL REIMBURSEMENT RATE (₹ PER KM)</label>
            <div className="settings-petrol-input-row">
              <div className="settings-petrol-input-wrap">
                <svg className="settings-petrol-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 22v-8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v8" /><path d="M14 22V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v18" /><path d="M14 13h8" /><path d="M3 22h18" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /><path d="M11 12H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" /></svg>
                <input type="text" className="settings-petrol-input" value={rate} onChange={(e) => setRate(e.target.value)} />
              </div>
              <div className="settings-petrol-active-badge">
                ACTIVE RATE
              </div>
            </div>
          </div>

          <div className="settings-petrol-info-box">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
            <span className="settings-petrol-info-text">
              CHANGES TO THE REIMBURSEMENT RATE WILL IMMEDIATELY UPDATE ALL PENDING DAILY AMOUNT RECORDINGS IN THE FIELD WORK WALLETS.
            </span>
          </div>
        </div>

        {/* Right Panel */}
        <div className="settings-petrol-right">
          <div className="settings-petrol-card-header">
            <div className="settings-petrol-card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /><path d="M21.17 8A9 9 0 0 0 3.1 8" /><path d="M12 2v4" /></svg>
              RATE ADJUSTMENT HISTORY
            </div>
          </div>

          <div className="settings-petrol-history-list">
            {history.map((h, idx) => (
              <div key={idx} className="settings-petrol-history-item">
                <span className="settings-petrol-date">{h.date}</span>
                <span className="settings-petrol-rate-val">₹{h.rate}</span>
                <span className={`settings-petrol-status ${h.status}`}>
                  {h.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
