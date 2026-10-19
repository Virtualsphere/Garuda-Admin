import React, { useState, useEffect } from 'react';
import landService from '../../services/landService';
import useFieldExecutiveFilter from '../../hooks/useFieldExecutiveFilter';
import { landCode, landAddress, landUnitProfile, matchesLandSearch } from '../../utils/landRecord';

export default function TraineeLandsList({ onView, onEdit, onDelete }) {
  const [lands, setLands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const {
    executives, dateFrom, setDateFrom, dateTo, setDateTo,
    executiveId, setExecutiveId, matchesFilters, hasActiveFilters, resetFilters,
  } = useFieldExecutiveFilter();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    landService
      .getTraineeLands()
      .then((data) => { if (!cancelled) setLands(data.data || []); })
      .catch((err) => {
        console.error('Failed to fetch trainee lands:', err);
        if (!cancelled) {
          setLands([]);
          setLoadError('Could not load trainee lands.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleDelete = async (land) => {
    if (await onDelete(land)) setLands((prev) => prev.filter((l) => l.id !== land.id));
  };

  const executiveName = (id) => executives.find((e) => String(e.id) === String(id))?.name || '—';

  const filteredLands = lands.filter((land) => matchesFilters(land) && matchesLandSearch(land, searchQuery));

  return (
    <div className="ledger-card">
      <div className="ledger-header">
        <div className="ledger-title-group">
          <span className="ledger-title">TRAINEE OBSERVATION</span>
          <span className="ledger-subtitle">LANDS SUBMITTED BY TRAINEE EMPLOYEES ({filteredLands.length})</span>
        </div>
        <div className="ledger-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Search farmer, phone, village..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
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
              <th>ADDRESS CONTEXT</th>
              <th>UNIT PROFILE</th>
              <th>ADDED BY</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '24px' }}>Loading...</td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: '#991b1b' }}>{loadError}</td>
              </tr>
            ) : filteredLands.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '24px' }}>No trainee lands found.</td>
              </tr>
            ) : filteredLands.map((land) => {
              const farmer = land.farmerDetails || {};
              const name = farmer.name || 'UNKNOWN';
              const code = landCode(land);

              return (
              <tr key={land.id}>
                <td>
                  <div className="farmer-identity">
                    <span className="farmer-name">{name}</span>
                    <span className="farmer-code">{code}{farmer.phone ? ` • ${farmer.phone}` : ''}</span>
                  </div>
                </td>
                <td>
                  <div className="node-hub">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                    {landAddress(land)}
                  </div>
                </td>
                <td>
                  <span className="unit-profile">{landUnitProfile(land)}</span>
                </td>
                <td>
                  <span className="unit-profile">{land.creator?.name || executiveName(land.created_by)}</span>
                </td>
                <td>
                  <div className="ledger-row-actions">
                    <button className="action-btn view" onClick={() => onView(land)}>VIEW</button>
                    <button className="action-btn start" onClick={() => onEdit(land)}>
                      EDIT
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                    </button>
                    <button className="action-btn delete" onClick={() => handleDelete(land)} title="Delete land" aria-label="Delete land">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                    </button>
                  </div>
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
