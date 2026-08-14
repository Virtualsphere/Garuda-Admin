import React, { useState, useEffect } from 'react';
import buyerService from '../../services/buyerService';
import callingService from '../../services/callingService';
import employeeService from '../../services/employeeService';
import './BuyerEnquiry.css';

const COMMERCIAL_OPTIONS = ['AVAILABLE FOR SALE', 'UNDER NEGOTIATION', 'SOLD', 'RESERVED'];
const MORTGAGE_OPTIONS   = ['AVAILABLE FOR...', 'MORTGAGE CLEAR', 'UNDER MORTGAGE', 'DISPUTED'];

const formatLandCode = (id) => `L${String(id).padStart(3, '0')}`;
const formatAcres = (acres) => acres ? `${acres} AC` : 'N/A';
const formatVal = (val) => {
  if (!val) return 'N/A';
  const l = (val / 100000).toFixed(0);
  return `₹${l}L`;
};

export default function BuyerEnquiry() {
  const [buyers, setBuyers] = useState([]);
  const [selectedBuyer, setSelectedBuyer] = useState(null);
  const [lands, setLands]  = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cartIds, setCartIds] = useState(new Set());
  const [addingId, setAddingId] = useState(null);
  const [dialingPhone, setDialingPhone] = useState(null);
  const [statuses, setStatuses] = useState({});
  const [mortgages, setMortgages] = useState({});

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const [landRes, empRes, buyerRes] = await Promise.all([
          buyerService.getLands({ verification_status: 'verified' }),
          employeeService.getAll(),
          buyerService.getBuyersAdmin()
        ]);
        const landList = landRes.data || [];
        setLands(landList);
        const empList = empRes.data || empRes.employees || empRes || [];
        const buyerList = buyerRes.data || [];
        setBuyers(buyerList);
        if (buyerList.length > 0) setSelectedBuyer(buyerList[0]);
        setEmployees(Array.isArray(empList) ? empList : []);
        // init dropdowns
        const s = {}; const m = {};
        landList.forEach(l => { s[l.id] = COMMERCIAL_OPTIONS[0]; m[l.id] = MORTGAGE_OPTIONS[0]; });
        setStatuses(s); setMortgages(m);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
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

  const handleAddToCart = async (landId) => {
    setAddingId(landId);
    try {
      await buyerService.addToCart([landId]);
      setCartIds(prev => new Set([...prev, landId]));
    } catch {}
    finally { setAddingId(null); }
  };

  const getMediator = (land) => {
    if (!land.created_by) return null;
    return employees.find(e => e.id === land.created_by);
  };

  const rows = lands.slice(0, 20).map((land) => ({
    id: land.id,
    code: formatLandCode(land.id),
    name: land.farmerDetails?.farmer_name?.toUpperCase() || 'UNKNOWN',
    phone: land.farmerDetails?.farmer_phone || 'N/A',
    town: land.village || land.mandal || 'TOWN CENTER',
    acres: formatAcres(land.total_acres),
    valuation: formatVal(land.total_value),
    mediator: getMediator(land),
  }));

  return (
    <div className="beq-page">
      {/* Header */}
      <div className="beq-header">
        <div className="beq-title-group">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <div>
            <div className="beq-title">BUYER ENQUIRY REGISTRY</div>
            <div className="beq-subtitle">TACTICAL INVESTOR-PARCEL LINKAGE AND SOURCING AUDIT</div>
          </div>
        </div>
        <div className="beq-investor-sel">
          <span className="beq-sel-label">ACTIVE INVESTOR IDENTITY:</span>
          {selectedBuyer && (
            <select
              className="be-sel-dropdown"
              value={selectedBuyer.id}
              onChange={(e) => setSelectedBuyer(buyers.find(b => b.id === Number(e.target.value)))}
            >
              {buyers.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Buyer Hero Card */}
      {selectedBuyer && (
        <div className="beq-hero-card">
          <div className="beq-hero-left">
            <div className="beq-hero-avatar">{selectedBuyer.name.charAt(0)}</div>
            <div className="beq-hero-info">
              <div className="beq-hero-name">{selectedBuyer.name}</div>
              <div className="beq-hero-contact">
                <span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
                  </svg>
                  {selectedBuyer.phone || 'N/A'}
                </span>
                <span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  {selectedBuyer.address || 'N/A'}
                </span>
              </div>
            </div>
          </div>
          <div className="beq-hero-actions">
            <button className={`beq-call-btn${dialingPhone ? ' calling' : ''}`} onClick={handleCall} disabled={!!dialingPhone}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              {dialingPhone ? 'CONNECTING...' : 'INITIATE OUTBOUND CALL'}
            </button>
            <button className="beq-mic-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </button>
            <div className="beq-hero-stats">
              <span className="beq-parcels">{selectedBuyer.cartBuyer?.length || 0} LINKED PARCELS</span>
              <button className="beq-first-visit-btn">FIRST VISIT</button>
            </div>
          </div>
        </div>
      )}

      {/* Portfolio Audit Table */}
      <div className="beq-table-card">
        <div className="beq-table-header">SHORTLISTED PORTFOLIO AUDIT</div>
        <div className="beq-table-wrap">
          <table className="beq-table">
            <thead>
              <tr>
                <th>FARMER &amp; TOWN IDENTITY</th>
                <th>COMMERCIAL STATUS</th>
                <th>MORTGAGE STATUS</th>
                <th>VALUATION</th>
                <th>SYNC AUDIT</th>
                <th>MEDIATOR HUB</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}><div className="beq-state">Loading parcels...</div></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7}><div className="beq-state">No parcels found.</div></td></tr>
              ) : rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="beq-farmer-id">
                      <div className="beq-farmer-icon">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                      </div>
                      <div>
                        <div className="beq-farmer-name">{row.name}</div>
                        <div className="beq-farmer-contacts">
                          <span>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                            </svg>
                            {row.phone}
                          </span>
                          <span>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                            </svg>
                          </span>
                        </div>
                        <div className="beq-farmer-tags">
                          <span className="beq-tag town">TOWN CENTER</span>
                          <span className="beq-tag acres">{row.acres}</span>
                          <span className="beq-tag code">{row.code}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="beq-select-wrap">
                      <select
                        className="beq-dropdown"
                        value={statuses[row.id] || COMMERCIAL_OPTIONS[0]}
                        onChange={e => setStatuses(prev => ({...prev, [row.id]: e.target.value}))}
                      >
                        {COMMERCIAL_OPTIONS.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  </td>
                  <td>
                    <div className="beq-select-wrap">
                      <select
                        className="beq-dropdown"
                        value={mortgages[row.id] || MORTGAGE_OPTIONS[0]}
                        onChange={e => setMortgages(prev => ({...prev, [row.id]: e.target.value}))}
                      >
                        {MORTGAGE_OPTIONS.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  </td>
                  <td>
                    <div className="beq-valuation">
                      <span className="beq-val-amount">{row.valuation}</span>
                    </div>
                  </td>
                  <td>
                    <div className="beq-sync">
                      <span className="beq-sync-days">1 Days</span>
                      <span className="beq-sync-label">SEND RANK</span>
                      <span className="beq-sync-date">25 AUG</span>
                    </div>
                  </td>
                  <td>
                    <div className="beq-mediator-hub">
                      <span className="beq-mediator-label">LOCAL MEDIATOR</span>
                      <div className="beq-mediator-actions">
                        <button className="beq-icon-btn call">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                          </svg>
                        </button>
                        <button className="beq-icon-btn mic">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </td>
                  <td>
                    <button
                      className={`beq-cart-btn${cartIds.has(row.id) ? ' added' : ''}${addingId === row.id ? ' loading' : ''}`}
                      disabled={cartIds.has(row.id) || addingId === row.id}
                      onClick={() => handleAddToCart(row.id)}
                    >
                      {cartIds.has(row.id) ? (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          IN CART
                        </>
                      ) : addingId === row.id ? 'ADDING...' : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                          </svg>
                          ADD TO CART
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
