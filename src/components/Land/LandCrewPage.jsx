import React from 'react';
import './LandCrewPage.css';

const avatarGradients = [
  'linear-gradient(135deg, #2f9e44, #40c463)',
  'linear-gradient(135deg, #1a7a30, #2f9e44)',
  'linear-gradient(135deg, #43b55f, #69d383)',
  'linear-gradient(135deg, #166534, #22874a)',
  'linear-gradient(135deg, #0ba360, #3cba92)',
  'linear-gradient(135deg, #2d8a4e, #4ade80)',
  'linear-gradient(135deg, #15803d, #22c55e)',
  'linear-gradient(135deg, #0d9488, #2dd4bf)',
  'linear-gradient(135deg, #059669, #34d399)',
  'linear-gradient(135deg, #047857, #10b981)',
  'linear-gradient(135deg, #065f46, #059669)',
];

const crewData = [
  { name: 'Akash rao', code: 'GTS00003', initials: 'AR', designation: 'LANDS DEPARTMENT HEAD', designationType: 'head', joiningDate: '04-FEB-2026', node: 'H.Q.', contact: '+91 98765 43003', status: 'ACTIVE', statusType: 'active' },
  { name: 'Anil kumar', code: 'GTS00004', initials: 'AK', designation: 'LAND VERIFICATION TEAM LEADER', designationType: 'team-leader', joiningDate: '04-FEB-2026', node: 'H.Q.', contact: '+91 98765 43004', status: 'TRAINEE', statusType: 'trainee' },
  { name: 'Ankit singh', code: 'GTS00005', initials: 'AS', designation: 'LAND VERIFICATION TEAM LEADER', designationType: 'team-leader', joiningDate: '04-FEB-2026', node: 'H.Q.', contact: '+91 98765 43005', status: 'APPLIED', statusType: 'applied' },
  { name: 'Arjun patel', code: 'GTS00006', initials: 'AP', designation: 'LAND VERIFICATION TEAM LEADER', designationType: 'team-leader', joiningDate: '04-FEB-2026', node: 'H.Q.', contact: '+91 98765 43006', status: 'ACTIVE', statusType: 'active' },
  { name: 'Arun sharma', code: 'GTS00007', initials: 'AS', designation: 'LAND VERIFICATION EXECUTIVE', designationType: 'executive', joiningDate: '04-FEB-2026', node: 'H.Q.', contact: '+91 98765 43007', status: 'TRAINEE', statusType: 'trainee' },
  { name: 'Babu varma', code: 'GTS00008', initials: 'BV', designation: 'LAND VERIFICATION EXECUTIVE', designationType: 'executive', joiningDate: '04-FEB-2026', node: 'H.Q.', contact: '+91 98765 43008', status: 'ACTIVE', statusType: 'active' },
  { name: 'Balaji naidu', code: 'GTS00009', initials: 'BN', designation: 'LAND VERIFICATION EXECUTIVE', designationType: 'executive', joiningDate: '04-FEB-2026', node: 'H.Q.', contact: '+91 98765 43009', status: 'TRAINEE', statusType: 'trainee' },
  { name: 'Bharat reddy', code: 'GTS00010', initials: 'BR', designation: 'LAND VERIFICATION EXECUTIVE', designationType: 'executive', joiningDate: '04-FEB-2026', node: 'H.Q.', contact: '+91 98765 43010', status: 'ACTIVE', statusType: 'active' },
  { name: 'Chaitanya goud', code: 'GTS00011', initials: 'CG', designation: 'LAND VERIFICATION EXECUTIVE', designationType: 'executive', joiningDate: '04-FEB-2026', node: 'H.Q.', contact: '+91 98765 43011', status: 'TRAINEE', statusType: 'trainee' },
  { name: 'Chandra yadav', code: 'GTS00012', initials: 'CY', designation: 'LAND VERIFICATION EXECUTIVE', designationType: 'executive', joiningDate: '04-FEB-2026', node: 'H.Q.', contact: '+91 98765 43012', status: 'ACTIVE', statusType: 'active' },
];

export default function LandCrewPage() {
  return (
    <div className="land-crew-page">
      <div className="land-crew-header">
        <div className="land-crew-title-section">
          <div className="land-crew-title-main">
            <div className="land-crew-title-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h2>LANDS DEPARTMENT CREW</h2>
          </div>
          <div className="land-crew-subtitle">Registry of Verification and Field Personnel</div>
        </div>
        <div className="land-crew-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Search identity..." />
        </div>
      </div>

      <div className="land-crew-table-container">
        <div className="team-section-header">Verification &amp; Data Team (114)</div>
        <div className="land-crew-table-scroll">
          <table className="land-crew-table">
            <thead>
              <tr>
                <th>Personnel Identity</th>
                <th>Cadre / Designation</th>
                <th>Joining Date</th>
                <th>Operational Node</th>
                <th>Contact</th>
                <th>Employee Status</th>
                <th>Audit</th>
              </tr>
            </thead>
            <tbody>
              {crewData.map((p, idx) => (
                <tr key={idx}>
                  <td>
                    <div className="land-personnel-identity">
                      <div className="land-personnel-avatar" style={{ background: avatarGradients[idx % avatarGradients.length] }}>{p.initials}</div>
                      <div className="land-personnel-info">
                        <span className="land-personnel-name">{p.name}</span>
                        <span className="land-personnel-code">{p.code}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`land-cadre-tag ${p.designationType}`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                      {p.designation}
                    </span>
                  </td>
                  <td><div className="land-date-cell"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>{p.joiningDate}</div></td>
                  <td><div className="land-node-cell"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>{p.node}</div></td>
                  <td><div className="land-contact-cell"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>{p.contact}</div></td>
                  <td><span className={`land-status-badge ${p.statusType}`}>{p.status}</span></td>
                  <td><button className="land-audit-chevron"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
