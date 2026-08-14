import React, { useState, useEffect } from 'react';
import buyerService from '../../services/buyerService';
import employeeService from '../../services/employeeService';
import './BuyerAttachLand.css';

const formatLandCode = (id) => `L${String(id).padStart(3, '0')}`;
const formatVal = (val) => val ? `₹${(val / 100000).toFixed(1)}L` : '—';

export default function BuyerAttachLand() {
  const [executives, setExecutives] = useState([]);
  const [selectedExec, setSelectedExec] = useState(null);
  const [lands, setLands] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listMode, setListMode] = useState('list');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const [landRes, empRes] = await Promise.all([
          buyerService.getLands(),
          employeeService.getAll(),
        ]);
        const landList = landRes.data || [];
        setLands(landList);
        const empList = empRes.data || empRes.employees || empRes || [];
        const execs = (Array.isArray(empList) ? empList : []).slice(0, 6);
        setExecutives(execs);
        if (execs.length) setSelectedExec(execs[0]);
      } catch {}
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const filteredLands = lands.filter(l => {
    const name = l.farmerDetails?.farmer_name || '';
    return name.toLowerCase().includes(search.toLowerCase()) ||
           formatLandCode(l.id).toLowerCase().includes(search.toLowerCase());
  });

  const handleAttach = (land) => {
    if (portfolio.find(p => p.id === land.id)) return;
    setPortfolio(prev => [...prev, land]);
  };

  const handleRemove = (landId) => {
    setPortfolio(prev => prev.filter(p => p.id !== landId));
  };

  return (
    <div className="bal-page">
      <div className="bal-layout">
        {/* Left panel — Executive selector */}
        <div className="bal-exec-panel">
          <div className="bal-exec-card">
            <div className="bal-exec-avatar">
              {selectedExec?.photo ? (
                <img src={selectedExec.photo} alt={selectedExec.name} />
              ) : (
                <span>{selectedExec?.name?.charAt(0)?.toUpperCase() || '?'}</span>
              )}
            </div>
            <div className="bal-exec-name">
              {selectedExec ? selectedExec.name?.toUpperCase().split(' ')[0] + '...' : 'SELECT EXECUTIVE'}
            </div>
            <div className="bal-exec-role">BUYER EXECUTIVE</div>
            <select
              className="bal-exec-select"
              value={selectedExec?.id || ''}
              onChange={e => setSelectedExec(executives.find(ex => ex.id === Number(e.target.value)))}
            >
              {executives.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.name?.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Center — Land pool + buyer picker placeholder */}
        <div className="bal-center">
          {!selectedExec ? (
            <div className="bal-placeholder">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              PICK BUYER FROM EXECUTIVE ROSTER TO INITIATE MISSION
            </div>
          ) : null}

          {/* Controls row */}
          <div className="bal-controls">
            <div className="bal-mode-tabs">
              <button
                className={`bal-mode-tab${listMode === 'list' ? ' active' : ''}`}
                onClick={() => setListMode('list')}
              >
                LIST REGISTRY
              </button>
              <button
                className={`bal-mode-tab${listMode === 'map' ? ' active' : ''}`}
                onClick={() => setListMode('map')}
              >
                TACTICAL MAP
              </button>
            </div>
            <div className="bal-search">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                placeholder="Filter parcels..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="bal-pool-count">POOL: {filteredLands.length} LEADS</div>
          </div>

          {/* Land Table */}
          <div className="bal-table-card">
            <div className="bal-table-top-border" />
            <div className="bal-table-wrap">
              <table className="bal-table">
                <thead>
                  <tr>
                    <th>FARMER IDENTITY</th>
                    <th>ACRES</th>
                    <th>PRICE / AC</th>
                    <th>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4}><div className="bal-state">Loading land pool...</div></td></tr>
                  ) : filteredLands.slice(0, 30).map((land) => {
                    const alreadyAttached = portfolio.some(p => p.id === land.id);
                    return (
                      <tr key={land.id}>
                        <td>
                          <div className="bal-farmer">
                            <div className="bal-farmer-icon">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                              </svg>
                            </div>
                            <div>
                              <div className="bal-farmer-name">
                                {land.farmerDetails?.farmer_name?.toUpperCase() || 'FARMER'}
                              </div>
                              <div className="bal-farmer-sub">
                                {formatLandCode(land.id)} • {land.village || land.mandal || 'NODE'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="bal-acres">{land.total_acres ? `${land.total_acres} Ac` : '—'}</td>
                        <td className="bal-price">{formatVal(land.price_per_acre)}</td>
                        <td>
                          <button
                            className={`bal-attach-btn${alreadyAttached ? ' attached' : ''}`}
                            onClick={() => handleAttach(land)}
                            disabled={alreadyAttached}
                          >
                            {alreadyAttached ? (
                              <>✓ ATTACHED</>
                            ) : (
                              <>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                </svg>
                                ATTACH
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right panel — Portfolio */}
        <div className="bal-portfolio">
          <div className="bal-portfolio-header">
            PORTFOLIO
            <span className="bal-portfolio-count">{portfolio.length}</span>
          </div>
          <div className="bal-portfolio-list">
            {portfolio.length === 0 ? (
              <div className="bal-portfolio-empty">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                DRAFT EMPTY
              </div>
            ) : portfolio.map(land => (
              <div key={land.id} className="bal-portfolio-item">
                <div>
                  <div className="bal-portfolio-name">
                    {land.farmerDetails?.farmer_name?.toUpperCase() || 'FARMER'}
                  </div>
                  <div className="bal-portfolio-meta">
                    {formatLandCode(land.id)} • {land.total_acres ? `${land.total_acres} Ac` : '—'} • {formatVal(land.price_per_acre)}
                  </div>
                </div>
                <button className="bal-remove-btn" onClick={() => handleRemove(land.id)}>×</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
