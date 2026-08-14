import React, { useState, useEffect } from 'react';
import useLocations from '../../hooks/useLocations';
import landService from '../../services/landService';
import './FarmersRegistry.css';

export default function FarmersRegistry() {
  const {
    states, districts, mandals, villages,
    selectedState, selectedDistrict, selectedMandal, selectedVillage,
    setSelectedState, setSelectedDistrict, setSelectedMandal, setSelectedVillage,
    resetLocations, loading
  } = useLocations();

  const [lands, setLands] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [contactQuery, setContactQuery] = useState('');

  const fetchLands = async () => {
    setDataLoading(true);
    try {
      const data = await landService.getAll();
      setLands(data.data || []);
    } catch (err) {
      console.error('Failed to fetch lands:', err);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    fetchLands();
  }, []);

  const handleReset = () => {
    resetLocations();
    setSearchQuery('');
    setContactQuery('');
  };

  const filteredLands = lands.filter(land => {
    const farmer = land.farmerDetails || {};
    
    // Filter by location
    if (selectedState) {
       const stateName = states.find(s => String(s.id) === String(selectedState))?.name;
       if (stateName && land.state !== stateName) return false;
    }
    if (selectedDistrict) {
       const districtName = districts.find(d => String(d.id) === String(selectedDistrict))?.name;
       if (districtName && land.district !== districtName) return false;
    }
    if (selectedMandal) {
       const mandalName = mandals.find(m => String(m.id) === String(selectedMandal))?.name;
       if (mandalName && land.mandal !== mandalName) return false;
    }
    if (selectedVillage) {
       const villageName = villages.find(v => String(v.id) === String(selectedVillage))?.name;
       if (villageName && land.village !== villageName) return false;
    }

    // Filter by text inputs
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!farmer.farmer_name?.toLowerCase().includes(q) && !String(land.id).includes(q)) return false;
    }
    if (contactQuery) {
      if (!farmer.farmer_phone?.includes(contactQuery)) return false;
    }

    return true;
  });

  return (
    <div className="f-registry-page">
      {/* Header */}
      <div className="f-registry-header">
        <div className="f-registry-title-group">
          <svg className="f-registry-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="3" width="15" height="13" />
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
            <circle cx="5.5" cy="18.5" r="2.5" />
            <circle cx="18.5" cy="18.5" r="2.5" />
          </svg>
          <span className="f-registry-title">FARMER REGISTRY HUB</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="f-registry-filters">
        <div className="f-filters-group">
          <div className="f-filter-item">
            <span className="f-filter-label">PRINCIPAL IDENTITY</span>
            <div className="f-filter-input">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" placeholder="Name / ID..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
          </div>
          <div className="f-filter-item">
            <span className="f-filter-label">CONTACT REGISTRY</span>
            <div className="f-filter-input">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
              <input type="text" placeholder="98XXXXXXXX" value={contactQuery} onChange={e => setContactQuery(e.target.value)} />
            </div>
          </div>
          <div className="f-filter-item">
            <span className="f-filter-label">STATE</span>
            <select className="f-filter-select" style={{ appearance: 'auto', background: 'transparent', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', color: 'var(--text-primary)' }} value={selectedState} onChange={e => setSelectedState(e.target.value)} disabled={loading.states}>
              <option value="">{loading.states ? 'Loading...' : 'Global View'}</option>
              {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="f-filter-item">
            <span className="f-filter-label">DISTRICT</span>
            <select className="f-filter-select" style={{ appearance: 'auto', background: 'transparent', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', color: 'var(--text-primary)' }} value={selectedDistrict} onChange={e => setSelectedDistrict(e.target.value)} disabled={!selectedState || loading.districts}>
              <option value="">{loading.districts ? 'Loading...' : 'All Districts'}</option>
              {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="f-filter-item">
            <span className="f-filter-label">MANDAL</span>
            <select className="f-filter-select" style={{ appearance: 'auto', background: 'transparent', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', color: 'var(--text-primary)' }} value={selectedMandal} onChange={e => setSelectedMandal(e.target.value)} disabled={!selectedDistrict || loading.mandals}>
              <option value="">{loading.mandals ? 'Loading...' : 'All Mandals'}</option>
              {mandals.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="f-filter-item">
            <span className="f-filter-label">VILLAGE</span>
            <select className="f-filter-select" style={{ appearance: 'auto', background: 'transparent', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', color: 'var(--text-primary)' }} value={selectedVillage} onChange={e => setSelectedVillage(e.target.value)} disabled={!selectedMandal || loading.villages}>
              <option value="">{loading.villages ? 'Loading...' : 'All Villages'}</option>
              {villages.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
        </div>
        <button className="f-filter-reset" onClick={handleReset}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            <line x1="18" y1="9" x2="6" y2="21"/>
          </svg>
          RESET
        </button>
      </div>

      {/* Table Container */}
      <div className="f-registry-table-container">
        <div className="f-registry-table-header">
          PRINCIPAL REGISTRY ({filteredLands.length})
        </div>
        <div className="f-registry-table-wrap">
          <table className="f-reg-table">
            <thead>
              <tr>
                <th>FARMER IDENTITY</th>
                <th>ADDRESS CONTEXT</th>
                <th>PORTFOLIO</th>
                <th>MISSIONS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {dataLoading ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '24px' }}>Loading...</td>
                </tr>
              ) : filteredLands.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '24px' }}>No farmer records found.</td>
                </tr>
              ) : filteredLands.map((land) => {
                const farmer = land.farmerDetails || {};
                const name = farmer.farmer_name || 'UNKNOWN';
                const phone = farmer.farmer_phone || 'N/A';
                const code = `FRM${String(land.id).padStart(3, '0')}`;
                
                // Form address string
                const addressParts = [];
                if (land.village) addressParts.push(land.village);
                if (land.mandal) addressParts.push(land.mandal);
                if (land.district) addressParts.push(land.district);
                if (land.state) addressParts.push(land.state);
                const address = addressParts.length > 0 ? addressParts.join(', ') : 'N/A';
                
                // Mock units and visits as they might require aggregated queries
                const units = '1 UNITS';
                const visits = '0 VISITS';

                return (
                  <tr key={land.id}>
                    <td>
                      <div className="f-reg-identity">
                        <span className="f-reg-name">{name}</span>
                        <div className="f-reg-sub">
                          <span className="f-reg-badge-light">{code}</span>
                          <span>{phone}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="f-reg-address">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        {address}
                      </span>
                    </td>
                    <td>
                      <span className="f-reg-portfolio">{units}</span>
                    </td>
                    <td>
                      <span className="f-reg-missions">{visits}</span>
                    </td>
                    <td>
                      <button className="f-reg-action">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
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
  );
}
