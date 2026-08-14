import React, { useState, useMemo } from 'react';
import useLocations from '../../hooks/useLocations';
import landService from '../../services/landService';
import './AddLandForm.css';

const OWNERSHIP_TYPES = ['Ancestral', 'Purchased'];
const LOCALITIES = ['Local', 'Non-local'];
const OWNERSHIP_STATUSES = ['Own', 'Joint'];
const AGE_GROUPS = ['Upto 30', '30-50', '50+'];
const LITERACY_LEVELS = ['Illiterate', 'Literate', 'High School', 'Graduate'];
const NATURES = ['Calm', 'Polite', 'Normal', 'Rude'];
const SALE_STATUSES = ['Token Received', 'Agreement Made', 'Sold'];
const ROAD_TYPES = ['Tar Road', 'Mud Road', 'Highway', 'No Road Access'];

const DRAFT_STORAGE_KEY = 'garuda_land_draft';

const initialFormData = {
  farmerName: '',
  primaryPhone: '',
  whatsappSame: true,
  whatsapp: '',
  ownershipType: '',
  locality: '',
  ownershipStatus: '',
  ageGroup: '',
  literacy: '',
  nature: '',
  gps: '',
  acres: '',
  guntas: '',
  pricePerAcre: '',
  town1: '',
  town1Distance: '',
  town2: '',
  town2Distance: '',
  town3: '',
  town3Distance: '',
  saleStatus: '',
  availableForSale: true,
  mortgaged: false,
  availableForMortgage: true,
  nearestRoadType: '',
  landAttachedToRoad: true,
  entryPointGps: '',
  boundaryPoints: [''],
};

export default function AddLandForm() {
  const {
    states, districts, mandals, villages, towns,
    selectedState, selectedDistrict, selectedMandal, selectedVillage,
    setSelectedState, setSelectedDistrict, setSelectedMandal, setSelectedVillage,
    resetLocations,
    loading
  } = useLocations();

  const [formData, setFormData] = useState(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState(null);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const totalCalculatedValue = useMemo(() => {
    const acres = parseFloat(formData.acres) || 0;
    const guntas = parseFloat(formData.guntas) || 0;
    const pricePerAcre = parseFloat(formData.pricePerAcre) || 0;
    const totalAcres = acres + guntas / 40;
    const value = totalAcres * pricePerAcre;
    return Number.isFinite(value) ? value : 0;
  }, [formData.acres, formData.guntas, formData.pricePerAcre]);

  const handleLocate = () => {
    if (!navigator.geolocation) {
      setSubmitMsg({ type: 'error', text: 'Geolocation is not supported on this device.' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        handleInputChange('gps', `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
      },
      () => {
        setSubmitMsg({ type: 'error', text: 'Unable to fetch GPS coordinates.' });
      }
    );
  };

  const handleLocateEntryPoint = () => {
    if (!navigator.geolocation) {
      setSubmitMsg({ type: 'error', text: 'Geolocation is not supported on this device.' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        handleInputChange('entryPointGps', `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
      },
      () => {
        setSubmitMsg({ type: 'error', text: 'Unable to fetch GPS coordinates.' });
      }
    );
  };

  const handleBoundaryPointChange = (index, value) => {
    setFormData((prev) => {
      const boundaryPoints = [...prev.boundaryPoints];
      boundaryPoints[index] = value;
      return { ...prev, boundaryPoints };
    });
  };

  const handleAddBoundaryPoint = () => {
    setFormData((prev) => ({ ...prev, boundaryPoints: [...prev.boundaryPoints, ''] }));
  };

  const handleLocateBoundaryPoint = (index) => {
    if (!navigator.geolocation) {
      setSubmitMsg({ type: 'error', text: 'Geolocation is not supported on this device.' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        handleBoundaryPointChange(index, `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
      },
      () => {
        setSubmitMsg({ type: 'error', text: 'Unable to fetch GPS coordinates.' });
      }
    );
  };

  const buildLocationNames = () => ({
    stateName: states.find((s) => String(s.id) === String(selectedState))?.name || '',
    districtName: districts.find((d) => String(d.id) === String(selectedDistrict))?.name || '',
    mandalName: mandals.find((m) => String(m.id) === String(selectedMandal))?.name || '',
    villageName: villages.find((v) => String(v.id) === String(selectedVillage))?.name || '',
  });

  const handleSaveDraft = () => {
    const { stateName, districtName, mandalName, villageName } = buildLocationNames();
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
      formData,
      selectedState, selectedDistrict, selectedMandal, selectedVillage,
      stateName, districtName, mandalName, villageName,
      savedAt: new Date().toISOString(),
    }));
    setSubmitMsg({ type: 'success', text: 'Draft saved locally.' });
  };

  const handleSubmit = async () => {
    if (!selectedState || !selectedDistrict || !selectedMandal || !selectedVillage) {
      setSubmitMsg({ type: 'error', text: 'Address & Territory is required.' });
      return;
    }
    if (!formData.farmerName || !formData.primaryPhone) {
      setSubmitMsg({ type: 'error', text: 'Full Legal Name and Phone No are required.' });
      return;
    }

    const { stateName, districtName, mandalName, villageName } = buildLocationNames();
    const town1Name = towns.find((t) => String(t.id) === String(formData.town1))?.name || '';
    const town2Name = towns.find((t) => String(t.id) === String(formData.town2))?.name || '';
    const town3Name = towns.find((t) => String(t.id) === String(formData.town3))?.name || '';
    const [latitude, longitude] = formData.gps.split(',').map((v) => v.trim());

    setSubmitting(true);
    setSubmitMsg(null);
    try {
      await landService.create({
        state: stateName,
        district: districtName,
        mandal: mandalName,
        village: villageName,
        farmer_name: formData.farmerName,
        farmer_phone: formData.primaryPhone,
        farmer_whatsapp: formData.whatsappSame ? formData.primaryPhone : formData.whatsapp,
        ownership_type: formData.ownershipType,
        locality: formData.locality,
        ownership_status: formData.ownershipStatus,
        age: formData.ageGroup,
        literacy: formData.literacy,
        nature: formData.nature,
        latitude: latitude || undefined,
        longitude: longitude || undefined,
        total_acres: formData.acres || 0,
        total_guntas: formData.guntas || 0,
        price_per_acre: formData.pricePerAcre || 0,
        total_value: totalCalculatedValue,
        nearest_town_1: town1Name,
        nearest_town_1_distance_km: formData.town1Distance || undefined,
        nearest_town_2: town2Name,
        nearest_town_2_distance_km: formData.town2Distance || undefined,
        nearest_town_3: town3Name,
        nearest_town_3_distance_km: formData.town3Distance || undefined,
        sale_status: formData.saleStatus || undefined,
        available_for_sale: formData.availableForSale,
        mortgaged: formData.mortgaged,
        available_for_mortgage: formData.availableForMortgage,
        nearest_road_type: formData.nearestRoadType || undefined,
        land_attached_to_road: formData.landAttachedToRoad,
        entry_point_gps: formData.entryPointGps || undefined,
        boundary_points: formData.boundaryPoints.filter(Boolean),
      });
      setSubmitMsg({ type: 'success', text: 'Land parcel registered successfully!' });
      setFormData(initialFormData);
      resetLocations();
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to register land.';
      setSubmitMsg({ type: 'error', text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const formatValue = (value) => {
    if (!value) return '0';
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  };

  return (
    <div className="add-land-form-container">
      {/* Header */}
      <div className="add-land-header">
        <div className="add-land-title-group">
          <span className="add-land-title">ONBOARD NEW PARCEL</span>
          <span className="add-land-subtitle">REGISTRY TIER: INITIAL ACQUISITION ENTRY</span>
        </div>
        <div className="add-land-header-actions">
          <button className="save-draft-btn" onClick={handleSaveDraft} disabled={submitting}>
            SAVE DRAFT
          </button>
          <button
            className="commit-registry-btn"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'COMMITTING...' : 'COMMIT FINAL REGISTRY'}
          </button>
        </div>
      </div>

      {submitMsg && (
        <div className={`add-land-alert ${submitMsg.type}`}>
          {submitMsg.text}
        </div>
      )}

      {/* Two-column card layout */}
      <div className="form-columns">
        {/* Left column */}
        <div className="form-column">
          <div className="form-card">
            <div className="form-card-header blue">
              <div className="form-card-icon-badge blue">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div className="form-card-header-title">1. ADDRESS &amp; TERRITORY</div>
            </div>
            <div className="form-card-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">STATE</label>
                  <select className="form-select" value={selectedState} onChange={(e) => setSelectedState(e.target.value)} disabled={loading.states}>
                    <option value="">{loading.states ? 'Loading...' : 'Select state'}</option>
                    {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">DISTRICT</label>
                  <select className="form-select" value={selectedDistrict} onChange={(e) => setSelectedDistrict(e.target.value)} disabled={!selectedState || loading.districts}>
                    <option value="">{loading.districts ? 'Loading...' : 'Select district'}</option>
                    {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">MANDAL</label>
                  <select className="form-select" value={selectedMandal} onChange={(e) => setSelectedMandal(e.target.value)} disabled={!selectedDistrict || loading.mandals}>
                    <option value="">{loading.mandals ? 'Loading...' : 'Select mandal'}</option>
                    {mandals.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">VILLAGE</label>
                  <select className="form-select" value={selectedVillage} onChange={(e) => setSelectedVillage(e.target.value)} disabled={!selectedMandal || loading.villages}>
                    <option value="">{loading.villages ? 'Loading...' : 'Select village'}</option>
                    {villages.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div className="form-group full-width">
                  <label className="form-label">GPS COORDINATES</label>
                  <div className="gps-input-wrapper">
                    <input
                      type="text"
                      placeholder="lat, lng"
                      value={formData.gps}
                      onChange={(e) => handleInputChange('gps', e.target.value)}
                    />
                    <button type="button" className="gps-locate-btn" onClick={handleLocate} title="Get current location">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="form-card">
            <div className="form-card-header brown">
              <div className="form-card-icon-badge brown">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div className="form-card-header-title">2. FARMER IDENTITY</div>
            </div>
            <div className="form-card-body">
              <div className="form-grid">
                <div className="form-group full-width">
                  <label className="form-label">FULL LEGAL NAME</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Farmer's Name"
                    value={formData.farmerName}
                    onChange={(e) => handleInputChange('farmerName', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">PHONE NO</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="10-digit mobile"
                    value={formData.primaryPhone}
                    onChange={(e) => handleInputChange('primaryPhone', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">WHATSAPP NUMBER</label>
                  <div className="pill-toggle">
                    <button
                      type="button"
                      className={`pill-option ${formData.whatsappSame ? 'active' : ''}`}
                      onClick={() => handleInputChange('whatsappSame', true)}
                    >
                      <span className="pill-dot" />
                      SAME
                    </button>
                    <button
                      type="button"
                      className={`pill-option ${!formData.whatsappSame ? 'active' : ''}`}
                      onClick={() => handleInputChange('whatsappSame', false)}
                    >
                      <span className="pill-dot" />
                      DIFF
                    </button>
                  </div>
                </div>
                {!formData.whatsappSame && (
                  <div className="form-group full-width">
                    <label className="form-label">WHATSAPP ALIAS</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="10-digit mobile"
                      value={formData.whatsapp}
                      onChange={(e) => handleInputChange('whatsapp', e.target.value)}
                    />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">OWNERSHIP TYPE</label>
                  <select className="form-select" value={formData.ownershipType} onChange={(e) => handleInputChange('ownershipType', e.target.value)}>
                    <option value="">Type</option>
                    {OWNERSHIP_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">LOCALITY</label>
                  <select className="form-select" value={formData.locality} onChange={(e) => handleInputChange('locality', e.target.value)}>
                    <option value="">Locality</option>
                    {LOCALITIES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">STATUS</label>
                  <select className="form-select" value={formData.ownershipStatus} onChange={(e) => handleInputChange('ownershipStatus', e.target.value)}>
                    <option value="">Status</option>
                    {OWNERSHIP_STATUSES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">AGE GROUP</label>
                  <select className="form-select" value={formData.ageGroup} onChange={(e) => handleInputChange('ageGroup', e.target.value)}>
                    <option value="">Group</option>
                    {AGE_GROUPS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">LITERACY</label>
                  <select className="form-select" value={formData.literacy} onChange={(e) => handleInputChange('literacy', e.target.value)}>
                    <option value="">Level</option>
                    {LITERACY_LEVELS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">NATURE</label>
                  <select className="form-select" value={formData.nature} onChange={(e) => handleInputChange('nature', e.target.value)}>
                    <option value="">Nature</option>
                    {NATURES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="status-card-row">
            <div className="form-card">
              <div className="form-card-header green">
                <div className="form-card-icon-badge green">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                </div>
                <div className="form-card-header-title">3. SALE STATUS</div>
              </div>
              <div className="form-card-body">
                <div className="status-option-list">
                  {SALE_STATUSES.map((status) => (
                    <button
                      type="button"
                      key={status}
                      className={`pill-option ${formData.saleStatus === status ? 'active' : ''}`}
                      onClick={() => handleInputChange('saleStatus', status)}
                    >
                      <span className="pill-dot" />
                      {status.toUpperCase()}
                    </button>
                  ))}
                </div>
                <hr className="status-divider" />
                <div className="form-group">
                  <label className="form-label">AVAILABLE FOR SALE?</label>
                  <div className="pill-toggle">
                    <button
                      type="button"
                      className={`pill-option ${formData.availableForSale ? 'active' : ''}`}
                      onClick={() => handleInputChange('availableForSale', true)}
                    >
                      <span className="pill-dot" />
                      YES
                    </button>
                    <button
                      type="button"
                      className={`pill-option ${!formData.availableForSale ? 'active' : ''}`}
                      onClick={() => handleInputChange('availableForSale', false)}
                    >
                      <span className="pill-dot" />
                      NO
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="form-card">
              <div className="form-card-header red">
                <div className="form-card-icon-badge red">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div className="form-card-header-title">4. MORTGAGE STATUS</div>
              </div>
              <div className="form-card-body">
                <div className="status-option-list">
                  <button
                    type="button"
                    className={`pill-option ${formData.mortgaged ? 'active' : ''}`}
                    onClick={() => handleInputChange('mortgaged', !formData.mortgaged)}
                  >
                    <span className="pill-dot" />
                    MORTGAGED
                  </button>
                </div>
                <hr className="status-divider" />
                <div className="form-group">
                  <label className="form-label">AVAILABLE FOR MORTGAGE?</label>
                  <div className="pill-toggle">
                    <button
                      type="button"
                      className={`pill-option ${formData.availableForMortgage ? 'active' : ''}`}
                      onClick={() => handleInputChange('availableForMortgage', true)}
                    >
                      <span className="pill-dot" />
                      YES
                    </button>
                    <button
                      type="button"
                      className={`pill-option ${!formData.availableForMortgage ? 'active' : ''}`}
                      onClick={() => handleInputChange('availableForMortgage', false)}
                    >
                      <span className="pill-dot" />
                      NO
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="form-column">
          <div className="form-card">
            <div className="form-card-header green">
              <div className="form-card-icon-badge green">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v18" />
                  <path d="M3 7h7" />
                  <path d="M14 7h7" />
                  <path d="M3 7l-2 5a3 3 0 0 0 6 0l-2-5" />
                  <path d="M18 7l-2 5a3 3 0 0 0 6 0l-2-5" />
                </svg>
              </div>
              <div className="form-card-header-title">6. ACRES &amp; PRICE</div>
            </div>
            <div className="form-card-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">ACRES</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    placeholder="0"
                    value={formData.acres}
                    onChange={(e) => handleInputChange('acres', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">GUNTAS (0-39)</label>
                  <input
                    type="number"
                    min="0"
                    max="39"
                    className="form-input"
                    placeholder="0"
                    value={formData.guntas}
                    onChange={(e) => handleInputChange('guntas', e.target.value)}
                  />
                </div>
                <div className="form-group full-width">
                  <label className="form-label">PRICE PER ACRE (LAKHS)</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    placeholder="0"
                    value={formData.pricePerAcre}
                    onChange={(e) => handleInputChange('pricePerAcre', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="total-value-box">
            <div className="total-value-label">TOTAL CALCULATED VALUE</div>
            <div className="total-value-amount">₹{formatValue(totalCalculatedValue)}L</div>
          </div>

          <div className="form-card">
            <div className="form-card-header blue">
              <div className="form-card-icon-badge blue">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="2" width="16" height="20" rx="1" />
                  <line x1="9" y1="6" x2="9" y2="6.01" />
                  <line x1="15" y1="6" x2="15" y2="6.01" />
                  <line x1="9" y1="10" x2="9" y2="10.01" />
                  <line x1="15" y1="10" x2="15" y2="10.01" />
                  <line x1="9" y1="14" x2="9" y2="14.01" />
                  <line x1="15" y1="14" x2="15" y2="14.01" />
                  <line x1="9" y1="18" x2="15" y2="18" />
                </svg>
              </div>
              <div className="form-card-header-title">7. NEAREST TOWNS</div>
            </div>
            <div className="form-card-body">
              <div className="form-grid">
                {[1, 2, 3].map((n) => (
                  <React.Fragment key={n}>
                    <div className="form-group">
                      <label className="form-label">TOWN {n}</label>
                      <select
                        className="form-select"
                        value={formData[`town${n}`]}
                        onChange={(e) => handleInputChange(`town${n}`, e.target.value)}
                        disabled={!selectedDistrict || loading.towns}
                      >
                        <option value="">{loading.towns ? 'Loading...' : 'Town...'}</option>
                        {towns.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">DISTANCE</label>
                      <div className="distance-input-wrapper">
                        <input
                          type="number"
                          min="0"
                          value={formData[`town${n}Distance`]}
                          onChange={(e) => handleInputChange(`town${n}Distance`, e.target.value)}
                          placeholder="0"
                        />
                        <span className="distance-unit">KM</span>
                      </div>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          <div className="form-card">
            <div className="form-card-header red">
              <div className="form-card-icon-badge red">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 22V4h11l-2 4 2 4H4" />
                  <line x1="4" y1="22" x2="4" y2="12" />
                </svg>
              </div>
              <div className="form-card-header-title">8. PATH DETAILS</div>
            </div>
            <div className="form-card-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">NEAREST ROAD TYPE</label>
                  <select className="form-select" value={formData.nearestRoadType} onChange={(e) => handleInputChange('nearestRoadType', e.target.value)}>
                    <option value="">Road</option>
                    {ROAD_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">LAND ATTACHED TO ROAD?</label>
                  <div className="pill-toggle">
                    <button
                      type="button"
                      className={`pill-option ${formData.landAttachedToRoad ? 'active' : ''}`}
                      onClick={() => handleInputChange('landAttachedToRoad', true)}
                    >
                      <span className="pill-dot" />
                      YES
                    </button>
                    <button
                      type="button"
                      className={`pill-option ${!formData.landAttachedToRoad ? 'active' : ''}`}
                      onClick={() => handleInputChange('landAttachedToRoad', false)}
                    >
                      <span className="pill-dot" />
                      NO
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="form-card">
            <div className="form-card-header blue">
              <div className="form-card-icon-badge blue">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </div>
              <div className="form-card-header-title">9. LAND GPS</div>
            </div>
            <div className="form-card-body">
              <div className="form-group">
                <label className="form-label">ENTRY POINT</label>
                <div className="gps-point-wrapper">
                  <input
                    type="text"
                    placeholder="Coordinates"
                    value={formData.entryPointGps}
                    onChange={(e) => handleInputChange('entryPointGps', e.target.value)}
                  />
                  <button type="button" className="gps-point-btn" onClick={handleLocateEntryPoint} title="Get current location">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="form-group" style={{ marginTop: '20px' }}>
                <div className="boundary-points-label-row">
                  <label className="form-label">BOUNDARY POINTS</label>
                  <button type="button" className="add-boundary-btn" onClick={handleAddBoundaryPoint}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    ADD
                  </button>
                </div>
                {formData.boundaryPoints.map((point, index) => (
                  <div className="gps-point-wrapper" key={index} style={{ marginTop: index === 0 ? 0 : '10px' }}>
                    <input
                      type="text"
                      placeholder={`Point ${index + 1}`}
                      value={point}
                      onChange={(e) => handleBoundaryPointChange(index, e.target.value)}
                    />
                    <button type="button" className="gps-point-btn" onClick={() => handleLocateBoundaryPoint(index)} title="Mark boundary point">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
