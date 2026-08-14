import React, { useState, useEffect } from 'react';
import buyerService from '../../services/buyerService';
import employeeService from '../../services/employeeService';
import callingService from '../../services/callingService';
import './BuyerVisits.css';

const STAGES = ['PRIMARY VISIT', 'SHORTLIST', 'FINAL PROCESS'];
const VISIT_STATUSES = ['Scheduled', 'Complete', 'Cancelled', 'Postponed'];
const formatLandCode = (id) => `L${String(id).padStart(3, '0')}`;
const formatBudget = (val) => val ? `₹${(val / 100000).toFixed(0)}L` : '—';

export default function BuyerVisits() {
  const [buyers, setBuyers] = useState([]);
  const [selectedBuyer, setSelectedBuyer] = useState(null);
  const [stage, setStage] = useState(0);
  const [lands, setLands] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [visitStatuses, setVisitStatuses] = useState({});
  const [dialingPhone, setDialingPhone] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const [landRes, empRes, buyerRes] = await Promise.all([
          buyerService.getLands({ verification_status: 'verified' }),
          employeeService.getAll(),
          buyerService.getBuyersAdmin()
        ]);
        const ll = landRes.data || [];
        setLands(ll);
        const el = empRes.data || empRes.employees || empRes || [];
        setEmployees(Array.isArray(el) ? el : []);
        const bList = buyerRes.data || [];
        setBuyers(bList);
        if (bList.length > 0) setSelectedBuyer(bList[0]);
        const s = {};
        ll.forEach(l => { s[l.id] = 'Scheduled'; });
        setVisitStatuses(s);
      } catch {}
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const handleCall = async () => {
    if (!selectedBuyer?.phone || dialingPhone) return;
    setDialingPhone(selectedBuyer.phone);
    try {
      await callingService.clickToCall({ customerNumber: selectedBuyer.phone, departmentType: 'buyers', callerName: selectedBuyer.name });
    } catch {}
    finally { setDialingPhone(null); }
  };

  const filteredLands = lands.filter(l => {
    const name = l.farmerDetails?.farmer_name || '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const getEmployee = (idx) => employees[idx % employees.length];

  return (
    <div className="bvi-page">
      {/* Header */}
      <div className="bvi-header">
        <div className="bvi-title-group">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <div>
            <div className="bvi-title">MISSION VISIT PIPELINE</div>
            <div className="bvi-subtitle">STRATEGIC AUDIT • STAGE-BASED WORKFLOW</div>
          </div>
        </div>
        <div className="bvi-investor-sel">
          <span className="bvi-sel-label">ACTIVE INVESTOR:</span>
          {selectedBuyer && (
            <select
              className="bvi-sel-dropdown"
              value={selectedBuyer.id}
              onChange={e => setSelectedBuyer(buyers.find(b => b.id === Number(e.target.value)))}
            >
              {buyers.map(b => (
                <option key={b.id} value={b.id}>{b.name}  {b.buyer_code}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Buyer Hero */}
      {selectedBuyer && (
        <div className="bvi-hero-card">
          <div className="bvi-hero-left">
            <div className="bvi-hero-avatar">{selectedBuyer.name.charAt(0)}</div>
            <div className="bvi-hero-info">
              <div className="bvi-hero-name">{selectedBuyer.name}</div>
              <div className="bvi-hero-contact">
                <span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
                  </svg>
                  {selectedBuyer.phone || 'N/A'}
                </span>
                <span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  {selectedBuyer.address || 'N/A'}
                </span>
              </div>
            </div>
          </div>
          <div className="bvi-hero-actions">
            <button className={`bvi-call-btn${dialingPhone ? ' calling' : ''}`} onClick={handleCall} disabled={!!dialingPhone}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              {dialingPhone ? 'CALLING...' : 'CALL'}
            </button>
            <div className="bvi-search">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                placeholder="Quick mission search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}
      {/* Stage tabs */}
      <div className="bvi-stages">
        {STAGES.map((s, i) => (
          <button
            key={i}
            className={`bvi-stage-tab${stage === i ? ' active' : ''}`}
            onClick={() => setStage(i)}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>

      {/* Visit Table */}
      <div className="bvi-table-card">
        <div className="bvi-table-border" />
        <div className="bvi-table-wrap">
          <table className="bvi-table">
            <thead>
              <tr>
                <th>{stage === 2 ? 'PRIMARY (BROWN)' : 'FARMER REGISTRY (BROWN)'}</th>
                <th>ACRES / BUDGET</th>
                <th>MEDIATOR (BLUE)</th>
                <th>ASSISTANT (ORANGE)</th>
                <th>VISIT SITUATION</th>
                <th>EVIDENCE</th>
                {stage === 2 && <th>SALE STATUS</th>}
                <th>MISSION STATE</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5}><div className="bvi-state">Loading pipeline...</div></td></tr>
              ) : filteredLands.slice(0, 20).map((land, idx) => {
                const mediator = getEmployee(idx);
                const assistant = getEmployee(idx + 1);
                const visitDate = new Date();
                visitDate.setDate(visitDate.getDate() + idx + 1);
                const dateStr = visitDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
                return (
                  <tr key={land.id}>
                    <td>
                      <div className="bvi-farmer">
                        <div className="bvi-farmer-icon brown">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                          </svg>
                        </div>
                        <div>
                          <div className="bvi-farmer-name brown">
                            {land.farmerDetails?.farmer_name?.toUpperCase() || 'FARMER'}
                          </div>
                          <div className="bvi-farmer-node">
                            {land.village || land.mandal || 'NODE'}
                          </div>
                          <div className="bvi-farmer-actions">
                            <button className="bvi-small-btn brown">
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                              </svg>
                            </button>
                            <button className="bvi-small-btn brown">
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="bvi-budget">
                        <div className="bvi-acres">{land.total_acres ? `${land.total_acres} Ac` : '—'}</div>
                        <div className="bvi-budget-val">{formatBudget(land.total_value)}</div>
                      </div>
                    </td>
                    <td>
                      {mediator && (
                        <div className="bvi-role-cell blue">
                          <div className="bvi-role-name blue">{mediator.name?.toUpperCase() || 'MEDIATOR'}</div>
                          <div className="bvi-role-actions">
                            <button className="bvi-small-btn blue">
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                              </svg>
                            </button>
                            <button className="bvi-small-btn blue">
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                    <td>
                      {assistant && (
                        <div className="bvi-role-cell orange">
                          <div className="bvi-role-name orange">{assistant.name?.toUpperCase() || 'ASSISTANT'}</div>
                          <div className="bvi-role-actions">
                            <button className="bvi-small-btn orange">
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                              </svg>
                            </button>
                            <button className="bvi-small-btn orange">
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="bvi-visit-situation">
                        <div className="bvi-visit-date">{dateStr}  10:30</div>
                        <div className="bvi-visit-status-wrap">
                          <select
                            className={`bvi-status-dropdown ${(visitStatuses[land.id] || 'Scheduled').toLowerCase()}`}
                            value={visitStatuses[land.id] || 'Scheduled'}
                            onChange={e => setVisitStatuses(prev => ({...prev, [land.id]: e.target.value}))}
                          >
                            {VISIT_STATUSES.map(s => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="bvi-evidence-icons">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                        </svg>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                        </svg>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                        </svg>
                      </div>
                    </td>
                    {stage === 2 && (
                      <td>
                        <div className="bvi-sale-status-wrap">
                          <select className="bvi-sale-dropdown">
                            <option>NEGOTIATING</option>
                            <option>FINALIZED</option>
                            <option>DROPPED</option>
                          </select>
                        </div>
                      </td>
                    )}
                    <td>
                      <div className="bvi-mission-state">
                        {stage === 0 && (
                          <button className="bvi-mission-btn green">SHORT LIST <span className="arrow">→</span></button>
                        )}
                        {stage === 1 && (
                          <>
                            <span className="bvi-shortlisted-text">SHORT LISTED</span>
                            <button className="bvi-mission-btn-outline green">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                              </svg>
                              UNDO
                            </button>
                            <button className="bvi-mission-btn green">FINALIZE <span className="arrow">→</span></button>
                          </>
                        )}
                        {stage === 2 && (
                          <button className="bvi-mission-btn-outline gray">
                            <span className="arrow">←</span> BACK
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
