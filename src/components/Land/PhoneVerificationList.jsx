import React, { useState, useEffect } from 'react';
import landService from '../../services/landService';
import callingService from '../../services/callingService';
import useFieldExecutiveFilter from '../../hooks/useFieldExecutiveFilter';
import { landCode, landAddress, landUnitProfile, matchesLandSearch } from '../../utils/landRecord';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'complete', label: 'Complete' },
  { value: 'rejected', label: 'Rejected' },
];

export default function PhoneVerificationList({ onView, onVet, onDelete }) {
  const [lands, setLands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [dialingLandId, setDialingLandId] = useState(null);
  const [callError, setCallError] = useState(null);
  const {
    executives, dateFrom, setDateFrom, dateTo, setDateTo,
    executiveId, setExecutiveId, matchesFilters, hasActiveFilters, resetFilters,
  } = useFieldExecutiveFilter();

  const handleCall = async (land, name, code) => {
    const phone = land.farmerDetails?.phone;
    if (!phone || dialingLandId) return;
    setCallError(null);
    setDialingLandId(land.id);
    try {
      await callingService.clickToCall({
        customerNumber: phone,
        departmentType: 'land',
        callerName: name,
        missionContext: `Inquiry about ${code} verification status`,
        landId: land.id,
      });
    } catch (err) {
      setCallError(err.response?.data?.message || 'Failed to place call.');
    } finally {
      setDialingLandId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    landService
      .getByCallVerificationStatus(statusFilter)
      .then((data) => { if (!cancelled) setLands(data.data || []); })
      .catch((err) => {
        console.error('Failed to fetch phone verification queue:', err);
        if (!cancelled) {
          setLands([]);
          setLoadError('Could not load the phone verification queue.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [statusFilter]);

  const handleDelete = async (land) => {
    if (await onDelete(land)) setLands((prev) => prev.filter((l) => l.id !== land.id));
  };

  const executiveName = (id) => executives.find((e) => String(e.id) === String(id))?.name || '—';

  const filteredLands = lands.filter((land) => matchesFilters(land) && matchesLandSearch(land, searchQuery));

  return (
    <div className="ledger-card">
      <div className="ledger-header">
        <div className="ledger-title-group">
          <span className="ledger-title">PHONE VERIFICATION QUEUE</span>
          <span className="ledger-subtitle">INBOUND PARCELS AWAITING TELEPHONIC VETTING ({filteredLands.length})</span>
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
          <span className="ledger-filter-label">Status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
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
                <td colSpan="5" style={{ textAlign: 'center', padding: '24px' }}>No {statusFilter} phone verifications found.</td>
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
                    <button
                      className="action-btn call"
                      disabled={!farmer.phone || dialingLandId === land.id}
                      onClick={() => handleCall(land, name, code)}
                    >
                      {dialingLandId === land.id ? 'CALLING...' : 'CALL'}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                    </button>
                    <button className="action-btn view" onClick={() => onView(land)}>VIEW</button>
                    <button className="action-btn start" onClick={() => onVet(land)}>
                      {statusFilter === 'pending' ? 'START VETTING' : 'EDIT'}
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
      {callError && (
        <div style={{ padding: '12px 24px', color: '#991b1b', fontSize: '12px' }}>
          {callError}
        </div>
      )}
    </div>
  );
}
