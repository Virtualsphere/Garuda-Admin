import React, { useState, useEffect } from 'react';
import buyerService from '../../services/buyerService';
import './BuyerEnquiryFee.css';

export default function BuyerEnquiryFee() {
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openProcess, setOpenProcess] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await buyerService.getBuyersAdmin();
        setBuyers(res.data || []);
      } catch {
        setBuyers([]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const rows = buyers.map((b) => {
    // Determine paid status based on nested paymentBuyer
    const hasPaid = b.paymentBuyer?.some(p => p.payment_status === 'paid' || p.payment_status === 'completed');
    return { ...b, paid: hasPaid, locked: !hasPaid };
  });

  return (
    <div className="bef-page">
      <div className="bef-header">
        <div className="bef-title-group">
          <div className="bef-icon-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2"/>
              <line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
          </div>
          <div>
            <div className="bef-title">ENQUIRY FEE COMPLIANCE</div>
            <div className="bef-subtitle">PHASE 1: FINANCIAL VETTING GATEWAY FOR ALL POTENTIAL INVESTORS</div>
          </div>
        </div>
      </div>

      <div className="bef-table-wrap">
        <table className="bef-table">
          <thead>
            <tr>
              <th>INVESTOR IDENTITY</th>
              <th>REQUIREMENT CONTEXT</th>
              <th>ACREAGE SCOPE</th>
              <th>ENQUIRY FEE</th>
              <th>COMPLIANCE STATUS</th>
              <th>MISSION GATEWAY</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6}><div className="bef-state">Loading...</div></td></tr>
            ) : rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="bef-investor">
                    <div className="bef-avatar">{row.name.charAt(0)}</div>
                    <div className="bef-investor-info">
                      <span className="bef-investor-name">{row.name}</span>
                      <span className="bef-investor-code">{row.code}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="bef-context">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    <div>
                      <div className="bef-cluster">{row.cluster}</div>
                      <div className="bef-city">{row.city}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="bef-acreage">{row.acreage}</span>
                </td>
                <td>
                  <span className="bef-fee">₹{row.fee.toLocaleString('en-IN')}</span>
                </td>
                <td>
                  <div className="bef-status-badges">
                    <span className={`bef-badge paid${row.paid ? '' : ' dim'}`}>PAID</span>
                    <span className={`bef-badge pending${row.locked ? ' active' : ''}`}>PENDING</span>
                  </div>
                </td>
                <td>
                  {row.locked ? (
                    <span className="bef-locked">LOCKED</span>
                  ) : (
                    <button
                      className={`bef-open-btn${openProcess === row.id ? ' active' : ''}`}
                      onClick={() => setOpenProcess(row.id === openProcess ? null : row.id)}
                    >
                      OPEN PROCESS
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                      </svg>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
