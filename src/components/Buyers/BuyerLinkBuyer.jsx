import React, { useState, useEffect } from 'react';
import employeeService from '../../services/employeeService';
import './BuyerLinkBuyer.css';

export default function BuyerLinkBuyer() {
  const [buyers, setBuyers] = useState([]);
  const [executives, setExecutives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allotments, setAllotments] = useState({});
  const [unassigned, setUnassigned] = useState([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const [empRes, buyerRes] = await Promise.all([
          employeeService.getAll(),
          import('../../services/buyerService').then(m => m.default.getBuyersAdmin())
        ]);
        const list = empRes.data || empRes.employees || empRes || [];
        const execs = (Array.isArray(list) ? list : []).slice(0, 6);
        setExecutives(execs);
        
        const bList = buyerRes.data || [];
        setBuyers(bList);
        
        const init = {};
        execs.forEach(e => { init[e.id] = []; });
        const unass = [];
        
        bList.forEach(b => {
          if (b.executive_id && init[b.executive_id] !== undefined) {
            init[b.executive_id].push(b.id);
          } else {
            unass.push(b.id);
          }
        });
        setAllotments(init);
        setUnassigned(unass);
      } catch {
        setExecutives([]);
        setBuyers([]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const handleAssign = (buyerId, execId) => {
    setAllotments(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        next[k] = next[k].filter(b => b !== buyerId);
      });
      if (execId !== null) {
        next[execId] = [...(next[execId] || []), buyerId];
      }
      return next;
    });
    if (execId !== null) {
      setUnassigned(prev => prev.filter(id => id !== buyerId));
    } else {
      setUnassigned(prev => [...prev, buyerId]);
    }
  };

  const handleSave = async () => {
    try {
      const buyerService = (await import('../../services/buyerService')).default;
      const promises = [];
      Object.keys(allotments).forEach(execId => {
        allotments[execId].forEach(buyerId => {
          promises.push(buyerService.assignExecutive(buyerId, parseInt(execId)));
        });
      });
      unassigned.forEach(buyerId => {
        promises.push(buyerService.assignExecutive(buyerId, null));
      });
      await Promise.all(promises);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save allotments', error);
    }
  };

  const getBuyer = (id) => buyers.find(b => b.id === id);

  return (
    <div className="blb-page">
      {/* Header */}
      <div className="blb-header">
        <div className="blb-title-group">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          <div>
            <div className="blb-title">LINK INVESTORS TO EXECUTIVES</div>
            <div className="blb-subtitle">STRATEGIC MISSION ALLOTMENT HUB</div>
          </div>
        </div>
        <button className={`blb-save-btn${saved ? ' saved' : ''}`} onClick={handleSave}>
          {saved ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              SAVED
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              SAVE ROSTER
            </>
          )}
        </button>
      </div>

      <div className="blb-layout">
        {/* Executive Grid */}
        <div className="blb-grid">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="blb-exec-card skeleton" />
            ))
          ) : executives.map((exec) => {
            const assigned = (allotments[exec.id] || []).map(getBuyer).filter(Boolean);
            return (
              <div key={exec.id} className="blb-exec-card">
                <div className="blb-exec-top">
                  <div className="blb-exec-avatar">
                    {exec.photo ? (
                      <img src={exec.photo} alt={exec.name} />
                    ) : (
                      exec.name?.charAt(0)?.toUpperCase() || '?'
                    )}
                  </div>
                  <div className="blb-exec-info">
                    <div className="blb-exec-name">{exec.name?.toUpperCase() || 'EXECUTIVE'}</div>
                    <div className="blb-exec-role">BUYER EXECUTIVE</div>
                  </div>
                  <div className="blb-exec-count">{assigned.length}</div>
                </div>

                {/* Assigned buyers */}
                <div className="blb-assigned-list">
                  {assigned.map(buyer => (
                    <div key={buyer.id} className="blb-assigned-item">
                      <div className="blb-assigned-avatar">{buyer.initial}</div>
                      <div className="blb-assigned-name">{buyer.name}</div>
                      <button
                        className="blb-unassign-btn"
                        onClick={() => handleAssign(buyer.id, null)}
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                {/* Drop zone */}
                <div className="blb-drop-zone">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  DROP TO ALLOT
                </div>
              </div>
            );
          })}
        </div>

        {/* Unassigned Pool */}
        <div className="blb-pool">
          <div className="blb-pool-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            UNASSIGNED POOL
          </div>
          <div className="blb-pool-list">
            {unassigned.length === 0 ? (
              <div className="blb-pool-empty">All investors assigned</div>
            ) : unassigned.map(id => {
              const buyer = getBuyer(id);
              if (!buyer) return null;
              return (
                <div key={buyer.id} className="blb-pool-item">
                  <div className="blb-pool-avatar">{buyer.initial}</div>
                  <div className="blb-pool-info">
                    <div className="blb-pool-name">{buyer.name}</div>
                    <div className="blb-pool-code">
                      <span className={`blb-code-badge ${buyer.code.startsWith('BUY') ? 'buy' : 'pl'}`}>
                        {buyer.code.startsWith('BUY') ? '🟢' : '🟡'} ID: {buyer.code}
                      </span>
                    </div>
                  </div>
                  {/* Quick-assign to first exec */}
                  {executives.length > 0 && (
                    <select
                      className="blb-assign-select"
                      defaultValue=""
                      onChange={e => { if (e.target.value) handleAssign(buyer.id, Number(e.target.value)); }}
                    >
                      <option value="">Assign →</option>
                      {executives.map(ex => (
                        <option key={ex.id} value={ex.id}>{ex.name?.toUpperCase()}</option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
