import React, { useState, useEffect } from 'react';
import landService from '../../services/landService';
import useFieldExecutiveFilter from '../../hooks/useFieldExecutiveFilter';

export default function VerifiedLandsList() {
  const [lands, setLands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const {
    executives, dateFrom, setDateFrom, dateTo, setDateTo,
    executiveId, setExecutiveId, matchesFilters, hasActiveFilters, resetFilters,
  } = useFieldExecutiveFilter();

  useEffect(() => {
    const fetchLands = async () => {
      try {
        const data = await landService.getByVerificationStatus('complete');
        setLands(data.data || []);
      } catch (err) {
        console.error('Failed to fetch verified lands:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLands();
  }, []);

  const filteredLands = lands.filter(land => {
    if (!matchesFilters(land)) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const farmerName = land.farmerDetails?.farmer_name?.toLowerCase() || '';
    return farmerName.includes(q) || String(land.id).includes(q);
  });

  return (
    <div className="ledger-card">
      <div className="ledger-header">
        <div className="ledger-title-group">
          <span className="ledger-title">VERIFIED LANDS MASTER LEDGER</span>
          <span className="ledger-subtitle">FINALIZED ORGANIZATIONAL PROPERTIES</span>
        </div>
        <div className="ledger-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Search Identity..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>
      <div className="ledger-filters">
        <div className="ledger-filter-group">
          <span className="ledger-filter-label">From</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} max={dateTo || undefined} />
        </div>
        <div className="ledger-filter-group">
          <span className="ledger-filter-label">To</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} min={dateFrom || undefined} />
        </div>
        <div className="ledger-filter-group">
          <span className="ledger-filter-label">Field executive</span>
          <select value={executiveId} onChange={(e) => setExecutiveId(e.target.value)}>
            <option value="">All executives</option>
            {executives.map((exec) => (
              <option key={exec.id} value={exec.id}>{exec.name}</option>
            ))}
          </select>
        </div>
        {hasActiveFilters && (
          <button type="button" className="ledger-filter-clear" onClick={resetFilters}>
            Clear filters
          </button>
        )}
      </div>
      <div className="ledger-table-wrap">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>FARMER IDENTITY</th>
              <th>NODE HUB</th>
              <th>UNIT PROFILE</th>
              <th>PUBLISH IN-APP</th>
              <th>AUDIT</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '24px' }}>Loading...</td>
              </tr>
            ) : filteredLands.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '24px' }}>No verified lands found.</td>
              </tr>
            ) : filteredLands.map((land) => {
              const farmer = land.farmerDetails || {};
              const name = farmer.farmer_name || 'UNKNOWN';
              const code = `L${String(land.id).padStart(3, '0')}`;
              const location = land.village || land.mandal || 'N/A';
              const unit = 'N/A'; // Mock for now until land units logic exists
              const published = false;

              return (
              <tr key={land.id}>
                <td>
                  <div className="farmer-identity">
                    <span className="farmer-name">{name}</span>
                    <span className="farmer-code">{code}</span>
                  </div>
                </td>
                <td>
                  <div className="node-hub">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                    {location}
                  </div>
                </td>
                <td>
                  <span className="unit-profile">{unit}</span>
                </td>
                <td>
                  <div className={`publish-dropdown ${published ? 'published' : 'empty'}`}>
                    {published ? 'Published' : ''}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                  </div>
                </td>
                <td>
                  <button className="action-btn open-file">
                    OPEN FILE
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
