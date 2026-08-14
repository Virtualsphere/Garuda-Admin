import React, { useState } from 'react';
import useLocations from '../../hooks/useLocations';
import apiClient from '../../services/apiClient';
import './FarmersOnboard.css';

export default function FarmersOnboard() {
  const {
    states, districts, mandals, villages,
    selectedState, selectedDistrict, selectedMandal, selectedVillage,
    setSelectedState, setSelectedDistrict, setSelectedMandal, setSelectedVillage,
    loading,
  } = useLocations();

  // Farmer form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    whatsapp: '',
    ownership_type: '',
    locality: '',
    ownership_status: '',
    age: '',
    literacy: '',
    nature: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState(null);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.phone) {
      setSubmitMsg({ type: 'error', text: 'Name and Phone are required.' });
      return;
    }

    // Find names from selected IDs
    const stateName = states.find((s) => String(s.id) === String(selectedState))?.name || '';
    const districtName = districts.find((d) => String(d.id) === String(selectedDistrict))?.name || '';
    const mandalName = mandals.find((m) => String(m.id) === String(selectedMandal))?.name || '';
    const villageName = villages.find((v) => String(v.id) === String(selectedVillage))?.name || '';

    setSubmitting(true);
    setSubmitMsg(null);
    try {
      await apiClient.post('/land', {
        state: stateName,
        district: districtName,
        mandal: mandalName,
        village: villageName,
        farmer_name: formData.name,
        farmer_phone: formData.phone,
        farmer_whatsapp: formData.whatsapp,
        ownership_type: formData.ownership_type,
        locality: formData.locality,
        ownership_status: formData.ownership_status,
        age: formData.age,
        literacy: formData.literacy,
        nature: formData.nature,
      });
      setSubmitMsg({ type: 'success', text: 'Farmer onboarded successfully!' });
      // Reset form
      setFormData({ name: '', phone: '', whatsapp: '', ownership_type: '', locality: '', ownership_status: '', age: '', literacy: '', nature: '' });
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to onboard farmer.';
      setSubmitMsg({ type: 'error', text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const RadioOption = ({ group, value, label }) => (
    <div
      className={`f-radio-option ${formData[group] === value ? 'selected' : ''}`}
      onClick={() => handleInputChange(group, value)}
    >
      <div className={`f-radio-circle ${formData[group] === value ? 'active' : ''}`}></div>
      {label}
    </div>
  );

  return (
    <div className="f-onboard-page">
      {/* Header */}
      <div className="f-onboard-header">
        <div className="f-onboard-title-group">
          <svg className="f-onboard-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
          <div className="f-onboard-title-texts">
            <span className="f-onboard-title">Onboard New Farmer</span>
            <span className="f-onboard-subtitle">Register a new farmer and their primary land asset.</span>
          </div>
        </div>
        <button
          className="f-onboard-commit-btn"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? 'Submitting...' : 'Complete Onboarding'}
        </button>
      </div>

      {/* Success / Error Message */}
      {submitMsg && (
        <div className={`f-onboard-message ${submitMsg.type}`}>
          {submitMsg.text}
        </div>
      )}

      {/* Address Section */}
      <div className="f-onboard-section">
        <div className="f-onboard-section-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          Address
        </div>
        
        <div className="f-form-grid-4">
          <div className="f-form-group">
            <label className="f-form-label">State</label>
            <select
              className="f-form-select-native"
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              disabled={loading.states}
            >
              <option value="">
                {loading.states ? 'Loading...' : 'Select a state'}
              </option>
              {states.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="f-form-group">
            <label className="f-form-label">District</label>
            <select
              className="f-form-select-native"
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              disabled={!selectedState || loading.districts}
            >
              <option value="">
                {loading.districts ? 'Loading...' : 'Select a district'}
              </option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="f-form-group">
            <label className="f-form-label">Mandal</label>
            <select
              className="f-form-select-native"
              value={selectedMandal}
              onChange={(e) => setSelectedMandal(e.target.value)}
              disabled={!selectedDistrict || loading.mandals}
            >
              <option value="">
                {loading.mandals ? 'Loading...' : 'Select a mandal'}
              </option>
              {mandals.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="f-form-group">
            <label className="f-form-label">Village</label>
            <select
              className="f-form-select-native"
              value={selectedVillage}
              onChange={(e) => setSelectedVillage(e.target.value)}
              disabled={!selectedMandal || loading.villages}
            >
              <option value="">
                {loading.villages ? 'Loading...' : 'Select a village'}
              </option>
              {villages.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="f-form-group">
          <label className="f-form-label">Location</label>
          <div className="f-location-row">
            <button className="f-location-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
              Get Current Location
            </button>
            <span className="f-location-hint">Click to fetch GPS and get nearest village suggestions.</span>
          </div>
        </div>
      </div>

      {/* Farmer Details Section */}
      <div className="f-onboard-section" style={{ paddingBottom: '80px' }}>
        <div className="f-onboard-section-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          Farmer Details
        </div>

        <div className="f-form-grid-3">
          <div className="f-form-group">
            <label className="f-form-label">Full Name</label>
            <input
              type="text"
              className="f-form-input"
              placeholder="Enter farmer's name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
            />
          </div>
          <div className="f-form-group">
            <label className="f-form-label">Phone Number</label>
            <input
              type="text"
              className="f-form-input"
              placeholder="98XXXXXXXX"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
            />
          </div>
          <div className="f-form-group">
            <label className="f-form-label">Whatsapp Number (Optional)</label>
            <input
              type="text"
              className="f-form-input"
              placeholder="98XXXXXXXX"
              value={formData.whatsapp}
              onChange={(e) => handleInputChange('whatsapp', e.target.value)}
            />
          </div>
        </div>

        <div className="f-form-grid-3">
          <div className="f-form-group">
            <label className="f-form-label">Land Ownership Type</label>
            <div className="f-radio-group">
              <RadioOption group="ownership_type" value="Ancestral" label="Ancestral" />
              <RadioOption group="ownership_type" value="Purchased" label="Purchased" />
            </div>
          </div>
          <div className="f-form-group">
            <label className="f-form-label">Locality</label>
            <div className="f-radio-group">
              <RadioOption group="locality" value="Local" label="Local" />
              <RadioOption group="locality" value="Non-local" label="Non-local" />
            </div>
          </div>
          <div className="f-form-group">
            <label className="f-form-label">Ownership Status</label>
            <div className="f-radio-group">
              <RadioOption group="ownership_status" value="Own" label="Own" />
              <RadioOption group="ownership_status" value="Joint" label="Joint" />
            </div>
          </div>
        </div>

        <div className="f-form-grid-3">
          <div className="f-form-group">
            <label className="f-form-label">Age Group</label>
            <div className="f-radio-group">
              <RadioOption group="age" value="Upto 30" label="Upto 30" />
              <RadioOption group="age" value="30-50" label="30-50" />
              <RadioOption group="age" value="50+" label="50+" />
            </div>
          </div>
          <div className="f-form-group">
            <label className="f-form-label">Literacy</label>
            <div className="f-radio-group">
              <RadioOption group="literacy" value="Illiterate" label="Illiterate" />
              <RadioOption group="literacy" value="Literate" label="Literate" />
              <RadioOption group="literacy" value="High School" label="High School" />
              <RadioOption group="literacy" value="Graduate" label="Graduate" />
            </div>
          </div>
          <div className="f-form-group">
            <label className="f-form-label">Nature</label>
            <div className="f-radio-group">
              <RadioOption group="nature" value="Calm" label="Calm" />
              <RadioOption group="nature" value="Polite" label="Polite" />
              <RadioOption group="nature" value="Normal" label="Normal" />
              <RadioOption group="nature" value="Rude" label="Rude" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

