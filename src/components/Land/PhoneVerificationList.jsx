import React, { useState, useEffect } from 'react';
import landService from '../../services/landService';
import callingService from '../../services/callingService';
import useFieldExecutiveFilter from '../../hooks/useFieldExecutiveFilter';

export default function PhoneVerificationList() {
  const [lands, setLands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialingLandId, setDialingLandId] = useState(null);
  const [callError, setCallError] = useState(null);
  const {
    executives, dateFrom, setDateFrom, dateTo, setDateTo,
    executiveId, setExecutiveId, matchesFilters, hasActiveFilters, resetFilters,
  } = useFieldExecutiveFilter();

  const handleCall = async (land, name, code) => {
    const phone = land.farmerDetails?.farmer_phone;
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
    const fetchLands = async () => {
      try {
        const data = await landService.getByCallVerificationStatus('pending');
        setLands(data.data || []);
      } catch (err) {
        console.error('Failed to fetch pending phone verifications:', err);
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
          <span className="ledger-title">PHONE VERIFICATION QUEUE</span>
          <span className="ledger-subtitle">INBOUND PARCELS AWAITING TELEPHONIC VETTING</span>
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
              <th>ADDRESS CONTEXT</th>
              <th>UNIT PROFILE</th>
              <th>PUBLISH IN-APP</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '24px' }}>Loading...</td>
              </tr>
            ) : filteredLands.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '24px' }}>No pending phone verifications found.</td>
              </tr>
            ) : filteredLands.map((land) => {
              const farmer = land.farmerDetails || {};
              const name = farmer.farmer_name || 'UNKNOWN';
              const code = `L${String(land.id).padStart(3, '0')}`;
              
              const addressParts = [];
              if (land.village) addressParts.push(land.village);
              if (land.mandal) addressParts.push(land.mandal);
              if (land.district) addressParts.push(land.district);
              const address = addressParts.length > 0 ? addressParts.join(', ') : 'N/A';
              
              const unit = 'N/A'; // Mock
              const published = false;

              return (
              <tr key={land.id}>
                <td>
                  <div className="farmer-identity">
                    <span className="farmer-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                      </svg>
                      {name}
                    </span>
                    <span className="farmer-code">{code}</span>
                  </div>
                </td>
                <td>
                  <div className="node-hub">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                    {address}
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
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="action-btn call"
                      disabled={!land.farmerDetails?.farmer_phone || dialingLandId === land.id}
                      onClick={() => handleCall(land, name, code)}
                    >
                      {dialingLandId === land.id ? 'CALLING...' : 'CALL'}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                    </button>
                    <button className="action-btn start">
                      START VETTING
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
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
