import React, { useState } from 'react';
import './BuyerRegistryModal.css';

const TABS = [
  { key: 'bio', label: '1. Bio data' },
  { key: 'kyc', label: '2. KYC & bank' },
  { key: 'address', label: '3. Address' },
  { key: 'work', label: '4. Work area' },
];

const na = (v) => (v === null || v === undefined || v === '' ? 'N/A' : v);

const formatDateBadge = (d) => {
  if (!d) return 'N/A';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return 'N/A';
  return dt
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase()
    .replace(/ /g, '-');
};

const maskTail = (value) => {
  if (!value) return null;
  const str = String(value);
  if (str.length <= 4) return str;
  const last4 = str.slice(-4);
  const maskedGroups = Math.max(1, Math.ceil((str.length - 4) / 4));
  return `${Array(maskedGroups).fill('****').join(' ')} ${last4}`;
};

const isDesignationLeadership = (role) => {
  const r = (role || '').toLowerCase();
  return r.includes('leader') || r.includes('manager') || r.includes('head');
};

export default function BuyerRegistryModal({ employee, onClose }) {
  const [activeTab, setActiveTab] = useState('bio');
  if (!employee) return null;

  const empId = `GTS${String(employee.id).padStart(5, '0')}`;
  const avatar = employee.photo || `https://i.pravatar.cc/150?u=${employee.id}`;
  const status = employee.status || 'ACTIVE';

  const territorialNodes = [
    ...(Array.isArray(employee.work_district) ? employee.work_district.map((d) => `${d} DIST.`) : []),
    ...(Array.isArray(employee.work_mandal) ? employee.work_mandal.map((m) => `${m} MANDAL`) : []),
  ];

  const contractActive =
    employee.contract_end_date ? new Date(employee.contract_end_date) >= new Date() : null;

  return (
    <div className="brm-overlay" onClick={onClose}>
      <div className="brm-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="brm-header">
          <div className="brm-header-left">
            <div className="brm-avatar-wrap">
              <img className="brm-avatar" src={avatar} alt={employee.name} />
              <span className={`brm-status-badge ${status.toLowerCase()}`}>{status}</span>
            </div>
            <div className="brm-header-info">
              <span className="brm-name">{employee.name}</span>
              <div className="brm-badges">
                <span className="brm-role-badge">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
                  {employee.role || 'N/A'}
                </span>
                <span className="brm-dept-badge">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="9" y1="3" x2="9" y2="21" /></svg>
                  Buyer department
                </span>
              </div>
              <span className="brm-emp-id">EMPLOYEE ID: {empId}</span>
            </div>
          </div>
          <button className="brm-close-x" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="brm-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`brm-tab${activeTab === t.key ? ' active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="brm-content">
          {activeTab === 'bio' && (
            <div className="brm-card-grid one-col">
              <div className="brm-info-card">
                <div className="brm-info-card-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  Identity profile
                </div>
                <div className="brm-field-grid">
                  <div className="brm-field"><span className="brm-field-label">Name</span><span className="brm-field-value">{na(employee.name)?.toUpperCase?.() || na(employee.name)}</span></div>
                  <div className="brm-field"><span className="brm-field-label">Email</span><span className="brm-field-value">{na(employee.email)}</span></div>
                  <div className="brm-field"><span className="brm-field-label">Blood group</span><span className="brm-field-value">{na(employee.blood_group)}</span></div>
                  <div className="brm-field"><span className="brm-field-label">Gender</span><span className="brm-field-value">{na(employee.gender)}</span></div>
                  <div className="brm-field"><span className="brm-field-label">Joining date</span><span className="brm-field-value">{formatDateBadge(employee.created_at)}</span></div>
                  <div className="brm-field"><span className="brm-field-label">Date of birth</span><span className="brm-field-value">{formatDateBadge(employee.date_of_birth)}</span></div>
                  <div className="brm-field full"><span className="brm-field-label">About</span><span className="brm-field-value">{na(employee.about)}</span></div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'kyc' && (
            <div className="brm-card-grid two-col">
              <div className="brm-info-card">
                <div className="brm-info-card-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><line x1="15" y1="8" x2="18" y2="8" /><line x1="15" y1="12" x2="18" y2="12" /></svg>
                  Identity details
                </div>
                <div className="brm-field-grid">
                  <div className="brm-field full"><span className="brm-field-label">Aadhar number</span><span className="brm-field-value">{maskTail(employee.aadhar_number) || 'N/A'}</span></div>
                </div>
                {employee.aadhar_photo ? (
                  <a className="brm-proof-thumb" href={employee.aadhar_photo} target="_blank" rel="noreferrer">
                    <img src={employee.aadhar_photo} alt="Aadhar proof" />
                  </a>
                ) : (
                  <div className="brm-proof-placeholder">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                    No proof uploaded
                  </div>
                )}
              </div>
              <div className="brm-info-card">
                <div className="brm-info-card-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                  Bank &amp; disbursement
                </div>
                <div className="brm-field-grid">
                  <div className="brm-field"><span className="brm-field-label">Bank name</span><span className="brm-field-value">{na(employee.bank_name)}</span></div>
                  <div className="brm-field"><span className="brm-field-label">IFSC code</span><span className="brm-field-value">{na(employee.ifsc_code)}</span></div>
                  <div className="brm-field full"><span className="brm-field-label">Account number</span><span className="brm-field-value">{maskTail(employee.account_number) || 'N/A'}</span></div>
                  <div className="brm-field"><span className="brm-field-label">PhonePe</span><span className="brm-field-value">{na(employee.phone_pe_number)}</span></div>
                  <div className="brm-field"><span className="brm-field-label">Google Pay</span><span className="brm-field-value">{na(employee.google_pay_number)}</span></div>
                  <div className="brm-field full"><span className="brm-field-label">UPI ID</span><span className="brm-field-value">{na(employee.upi_id)}</span></div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'address' && (
            <div className="brm-card-grid two-col">
              <div className="brm-info-card">
                <div className="brm-info-card-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
                  Contact hub
                </div>
                <div className="brm-contact-row">
                  <div className="brm-contact-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg></div>
                  <div>
                    <span className="brm-field-label">Mobile number</span>
                    <span className="brm-field-value block">{na(employee.phone)}</span>
                  </div>
                </div>
                <div className="brm-contact-row">
                  <div className="brm-contact-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg></div>
                  <div>
                    <span className="brm-field-label">Other contact</span>
                    <span className="brm-field-value block">{na(employee.other_phone)}</span>
                  </div>
                </div>
              </div>
              <div className="brm-info-card">
                <div className="brm-info-card-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                  Structured address
                </div>
                <div className="brm-field-grid">
                  <div className="brm-field"><span className="brm-field-label">H.No</span><span className="brm-field-value">{na(employee.house_no)}</span></div>
                  <div className="brm-field"><span className="brm-field-label">Colony</span><span className="brm-field-value">{na(employee.colony)}</span></div>
                  <div className="brm-field"><span className="brm-field-label">Village</span><span className="brm-field-value">{na(employee.home_village)}</span></div>
                  <div className="brm-field"><span className="brm-field-label">Mandal</span><span className="brm-field-value">{na(employee.home_mandal)}</span></div>
                  <div className="brm-field"><span className="brm-field-label">Town</span><span className="brm-field-value">{na(employee.home_town)}</span></div>
                  <div className="brm-field"><span className="brm-field-label">District</span><span className="brm-field-value">{na(employee.home_district)}</span></div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'work' && (
            <div className="brm-card-grid two-col">
              <div className="brm-info-card">
                <div className="brm-info-card-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                  Territorial scope
                </div>
                <div className="brm-field-grid">
                  <div className="brm-field full"><span className="brm-field-label">Target state</span><span className="brm-field-value">{na(employee.work_state)}</span></div>
                </div>
                <div className="brm-field full" style={{ marginTop: 12 }}>
                  <span className="brm-field-label">Assigned territorial nodes</span>
                  <div className="brm-chip-row">
                    {territorialNodes.length === 0 ? (
                      <span className="brm-field-value">N/A</span>
                    ) : territorialNodes.map((node) => (
                      <span key={node} className="brm-chip">{node}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="brm-info-card">
                <div className="brm-info-card-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /></svg>
                  Administrative base
                </div>
                <div className="brm-field-grid">
                  <div className="brm-field full"><span className="brm-field-label">Assigned hub</span><span className="brm-field-value">{na(employee.assigned_hub)}</span></div>
                  <div className="brm-field full"><span className="brm-field-label">Functional cadre</span><span className={`brm-field-value cadre${isDesignationLeadership(employee.role) ? ' lead' : ''}`}>{na(employee.role)}</span></div>
                </div>
              </div>
              <div className="brm-info-card full-width">
                <div className="brm-info-card-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  Contractual period
                </div>
                <div className="brm-contract-row">
                  <div>
                    <span className="brm-field-label">Contract duration</span>
                    <span className="brm-field-value block">{formatDateBadge(employee.contract_start_date)} TO {formatDateBadge(employee.contract_end_date)}</span>
                  </div>
                  {contractActive !== null && (
                    <span className={`brm-contract-status${contractActive ? ' active' : ' expired'}`}>
                      {contractActive ? 'ACTIVE' : 'EXPIRED'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="brm-footer">
          <button className="brm-close-btn" onClick={onClose}>Close registry</button>
        </div>
      </div>
    </div>
  );
}
