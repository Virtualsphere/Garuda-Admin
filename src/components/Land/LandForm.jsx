import React, { useState, useEffect, useRef } from 'react';
import useLocationLevels from '../../hooks/useLocationLevels';
import uploadService from '../../services/uploadService';
import mediaUrl, { IMAGE_NOT_FOUND_PLACEHOLDER } from '../../utils/mediaUrl';
import {
  OWNERSHIP_TYPE_OPTIONS, LOCALITY_OPTIONS, OWNERSHIP_STATUS_OPTIONS, AGE_OPTIONS,
  LITERACY_OPTIONS, NATURE_OPTIONS, ELECTRICITY_OPTIONS, RESIDENCE_OPTIONS,
  WATER_SOURCE_OPTIONS, ROAD_TYPE_OPTIONS, SOIL_TYPE_OPTIONS, FENCING_OPTIONS,
  COMPLAINT_OPTIONS, SALE_STATUS_OPTIONS, DOC_TYPES, MEDIA_CATEGORIES, TREE_FIELDS,
  computeTotalValue, formatLakhs,
} from '../../utils/landRecord';
import './AddLandForm.css';
import './LandForm.css';

/**
 * Every field of a land record, as one controlled form. Used by Add Land and
 * by the verification queues' editor, so the two can never drift apart (the
 * old panel kept five hand-synced copies of this form).
 *
 * `value` is the shape from `createEmptyLand()` / `landToForm()`; `onChange`
 * receives an updater `(prev) => next`. Location fields hold *names* (that is
 * what the land row stores); ids are looked up to fetch the next level.
 */

const CARD_ICONS = {
  pin: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>,
  user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  rupee: <><path d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3a5 5 0 0 0 0-10" /></>,
  layers: <><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>,
  home: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
  drop: <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />,
  compass: <><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></>,
  tree: <><path d="M12 22v-7" /><path d="M5 15h14l-4-5h3l-6-8-6 8h3z" /></>,
  alert: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
  flag: <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></>,
  bank: <><line x1="3" y1="22" x2="21" y2="22" /><line x1="6" y1="18" x2="6" y2="11" /><line x1="10" y1="18" x2="10" y2="11" /><line x1="14" y1="18" x2="14" y2="11" /><line x1="18" y1="18" x2="18" y2="11" /><polygon points="12 2 20 7 4 7" /></>,
  camera: <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>,
};

// Defined outside the form: a component declared inside would remount (and
// drop input focus) on every keystroke.
function Card({ color = 'green', icon, title, children }) {
  return (
    <div className="form-card">
      <div className={`form-card-header ${color}`}>
        <div className={`form-card-icon-badge ${color}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {CARD_ICONS[icon]}
          </svg>
        </div>
        <div className="form-card-header-title">{title}</div>
      </div>
      <div className="form-card-body">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="lf-toggle-row">
      <span>
        <span className="lf-toggle-label">{label}</span>
        {hint && <span className="lf-toggle-hint">{hint}</span>}
      </span>
      <span className="lf-switch">
        <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="lf-switch-slider" />
      </span>
    </label>
  );
}

function Select({ label, value, onChange, options, placeholder = 'Select', disabled, full }) {
  return (
    <div className={`form-group${full ? ' full-width' : ''}`}>
      <label className="form-label">{label}</label>
      <select className="form-select" value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        <option value="">{placeholder}</option>
        {options.map((opt) => {
          const optValue = typeof opt === 'object' ? opt.value : opt;
          const optLabel = typeof opt === 'object' ? opt.label : opt;
          return <option key={optValue} value={optValue}>{optLabel}</option>;
        })}
      </select>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, full, readOnly, step }) {
  return (
    <div className={`form-group${full ? ' full-width' : ''}`}>
      <label className="form-label">{label}</label>
      <input
        type={type}
        step={step}
        className="form-input"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
      />
    </div>
  );
}

function CheckGroup({ options, selected, onToggle }) {
  return (
    <div className="lf-check-grid">
      {options.map((opt) => (
        <label key={opt} className="lf-check">
          <input type="checkbox" checked={(selected || []).includes(opt)} onChange={(e) => onToggle(opt, e.target.checked)} />
          <span>{opt}</span>
        </label>
      ))}
    </div>
  );
}

/** Mutually-exclusive "available / NOT AVAILABLE" flag stored inside a status array. */
function YesNo({ label, list, yesValue, onChange, name }) {
  const yes = (list || []).includes(yesValue);
  const no = (list || []).includes('NOT AVAILABLE');
  const pick = (isYes) => {
    const rest = (list || []).filter((x) => x !== yesValue && x !== 'NOT AVAILABLE');
    onChange([...rest, isYes ? yesValue : 'NOT AVAILABLE']);
  };
  return (
    <div className="lf-yesno">
      <span className="form-label">{label}</span>
      <div className="lf-yesno-options">
        <label className="lf-check"><input type="radio" name={name} checked={yes} onChange={() => pick(true)} /><span>Yes</span></label>
        <label className="lf-check"><input type="radio" name={name} checked={no} onChange={() => pick(false)} /><span>No</span></label>
      </div>
    </div>
  );
}

const findByName = (list, name) =>
  name ? list.find((item) => String(item.name).trim().toLowerCase() === String(name).trim().toLowerCase()) : undefined;

const setIn = (obj, path, value) => {
  const keys = path.split('.');
  const next = { ...obj };
  let cursor = next;
  keys.slice(0, -1).forEach((key) => {
    cursor[key] = { ...(cursor[key] || {}) };
    cursor = cursor[key];
  });
  cursor[keys[keys.length - 1]] = value;
  return next;
};

const getIn = (obj, path) => path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), obj);

const PRICE_FIELDS = ['landDetails.total_acres', 'landDetails.guntas', 'landDetails.price_per_acres'];

export default function LandForm({ value, onChange, onError }) {
  const levels = useLocationLevels();
  const { states, loadDistricts, loadMandals, loadVillages, loadTowns, districtsOf, mandalsOf, villagesOf, townsOf } = levels;
  const details = value.landDetails || {};
  const farmer = value.farmerDetails || {};

  const [whatsappSame, setWhatsappSame] = useState(() => !farmer.whatsapp || farmer.whatsapp === farmer.phone);
  const [uploading, setUploading] = useState(false);
  const [mediaCategory, setMediaCategory] = useState('');
  const mediaInputRef = useRef(null);

  // ─── Field updates ─────────────────────────────────────────────
  const set = (path, fieldValue) => {
    onChange((prev) => {
      let next = setIn(prev, path, fieldValue);
      if (PRICE_FIELDS.includes(path)) {
        const d = next.landDetails;
        next = setIn(next, 'landDetails.total_value', computeTotalValue(d.total_acres, d.guntas, d.price_per_acres));
      }
      if (path === 'farmerDetails.phone' && whatsappSame) {
        next = setIn(next, 'farmerDetails.whatsapp', fieldValue);
      }
      return next;
    });
  };

  const toggleIn = (path, item, checked) => {
    onChange((prev) => {
      const current = getIn(prev, path) || [];
      const next = checked ? Array.from(new Set([...current, item])) : current.filter((x) => x !== item);
      return setIn(prev, path, next);
    });
  };

  // Changing a parent clears everything below it.
  const setLocation = (field, name) => {
    onChange((prev) => {
      const next = { ...prev, [field]: name };
      if (field === 'state') Object.assign(next, { district: '', mandal: '', village: '' });
      if (field === 'district') Object.assign(next, { mandal: '', village: '' });
      if (field === 'mandal') next.village = '';
      return next;
    });
  };

  const setNearestTownState = (name) => {
    onChange((prev) => ({
      ...prev,
      landDetails: {
        ...prev.landDetails,
        nearest_town_state: name,
        nearest_town_district: '', nearest_town_district_2: '', nearest_town_district_3: '',
        nearest_town_1: '', nearest_town_2: '', nearest_town_3: '',
      },
    }));
  };

  // ─── Resolve names → ids and fetch the next level ─────────────
  const stateObj = findByName(states, value.state);
  const districtObj = findByName(districtsOf(stateObj?.id), value.district);
  const mandalObj = findByName(mandalsOf(districtObj?.id), value.mandal);
  const villageObj = findByName(villagesOf(mandalObj?.id), value.village);
  const shown = (obj, raw) => (obj ? String(obj.name).trim() : raw);
  const ntStateObj = findByName(states, details.nearest_town_state);
  const ntDistricts = districtsOf(ntStateObj?.id);
  const ntDistrictObjs = [
    findByName(ntDistricts, details.nearest_town_district),
    findByName(ntDistricts, details.nearest_town_district_2),
    findByName(ntDistricts, details.nearest_town_district_3),
  ];

  useEffect(() => { if (stateObj) loadDistricts(stateObj.id); }, [stateObj, loadDistricts]);
  useEffect(() => { if (districtObj) loadMandals(districtObj.id); }, [districtObj, loadMandals]);
  useEffect(() => { if (mandalObj) loadVillages(mandalObj.id); }, [mandalObj, loadVillages]);
  useEffect(() => { if (ntStateObj) loadDistricts(ntStateObj.id); }, [ntStateObj, loadDistricts]);
  const [nt1, nt2, nt3] = ntDistrictObjs;
  useEffect(() => {
    [nt1, nt2, nt3].forEach((d) => { if (d) loadTowns(d.id); });
  }, [nt1, nt2, nt3, loadTowns]);

  // ─── GPS ───────────────────────────────────────────────────────
  const fetchPosition = (apply) => {
    if (!navigator.geolocation) {
      onError?.('Geolocation is not supported on this device.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => apply(String(pos.coords.latitude), String(pos.coords.longitude)),
      (err) => onError?.(`Unable to fetch location: ${err.message}`)
    );
  };

  // ─── Uploads ───────────────────────────────────────────────────
  const pickMedia = (category) => {
    setMediaCategory(category);
    mediaInputRef.current?.click();
  };

  const handleMediaFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !mediaCategory) return;
    const isImage = file.type.startsWith('image/');
    setUploading(true);
    try {
      const url = await uploadService.upload(file, isImage ? 'photo' : 'video');
      if (!url) throw new Error('No URL returned');
      const category = mediaCategory;
      onChange((prev) => ({ ...prev, media: [...(prev.media || []), { category, type: isImage ? 'image' : 'video', url }] }));
    } catch (err) {
      console.error('Media upload failed:', err);
      onError?.('Failed to upload file.');
    } finally {
      setUploading(false);
      setMediaCategory('');
    }
  };

  const toggleMediaPublic = (index) => {
    onChange((prev) => ({
      ...prev,
      media: (prev.media || []).map((m, i) => (i === index ? { ...m, public: !m.public } : m)),
    }));
  };

  const removeMedia = (index) => {
    onChange((prev) => ({ ...prev, media: (prev.media || []).filter((_, i) => i !== index) }));
  };

  const handleDocumentFile = async (docType, e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadService.upload(file, 'document');
      if (!url) throw new Error('No URL returned');
      onChange((prev) => ({ ...prev, documents: [...(prev.documents || []), { doc_type: docType, file_url: url }] }));
    } catch (err) {
      console.error('Document upload failed:', err);
      onError?.('Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  const removeDocument = (index) => {
    onChange((prev) => ({ ...prev, documents: (prev.documents || []).filter((_, i) => i !== index) }));
  };

  const media = value.media || [];
  const documents = value.documents || [];
  const names = (list) => list.map((item) => String(item.name).trim());

  return (
    <div className="form-columns lf-columns">
      <input ref={mediaInputRef} type="file" accept="image/*,video/*" onChange={handleMediaFile} style={{ display: 'none' }} />

      {/* ── Column 1 ── */}
      <div className="form-column">
        <Card color="blue" icon="pin" title="1. Land address">
          <div className="form-grid">
            <Select label="State" value={shown(stateObj, value.state)} onChange={(v) => setLocation('state', v)} options={names(states)} />
            <Select label="District" value={shown(districtObj, value.district)} onChange={(v) => setLocation('district', v)} options={names(districtsOf(stateObj?.id))} disabled={!value.state} />
            <Select label="Mandal" value={shown(mandalObj, value.mandal)} onChange={(v) => setLocation('mandal', v)} options={names(mandalsOf(districtObj?.id))} disabled={!value.district} />
            <Select label="Village" value={shown(villageObj, value.village)} onChange={(v) => setLocation('village', v)} options={names(villagesOf(mandalObj?.id))} disabled={!value.mandal} />
            <Field label="Latitude" value={value.location_latitude} onChange={(v) => set('location_latitude', v)} placeholder="e.g. 17.385" />
            <Field label="Longitude" value={value.location_longitude} onChange={(v) => set('location_longitude', v)} placeholder="e.g. 78.486" />
            <div className="form-group full-width">
              <button type="button" className="lf-fetch-btn" onClick={() => fetchPosition((lat, lng) => onChange((prev) => ({ ...prev, location_latitude: lat, location_longitude: lng })))}>
                Use current location
              </button>
            </div>
          </div>
        </Card>

        <Card color="brown" icon="user" title="2. Farmer details">
          <div className="form-grid">
            <Field label="Name" value={farmer.name} onChange={(v) => set('farmerDetails.name', v)} placeholder="Farmer name" full />
            <Field label="Phone no" type="tel" value={farmer.phone} onChange={(v) => set('farmerDetails.phone', v)} placeholder="98XXXXXXXX" />
            <div className="form-group">
              <label className="form-label">WhatsApp same as phone</label>
              <div className="pill-toggle">
                <button
                  type="button"
                  className={`pill-option ${whatsappSame ? 'active' : ''}`}
                  onClick={() => { setWhatsappSame(true); set('farmerDetails.whatsapp', farmer.phone || ''); }}
                >
                  <span className="pill-dot" />YES
                </button>
                <button type="button" className={`pill-option ${!whatsappSame ? 'active' : ''}`} onClick={() => setWhatsappSame(false)}>
                  <span className="pill-dot" />NO
                </button>
              </div>
            </div>
            {!whatsappSame && (
              <Field label="WhatsApp no" type="tel" value={farmer.whatsapp} onChange={(v) => set('farmerDetails.whatsapp', v)} placeholder="98XXXXXXXX" full />
            )}
            <Select label="Land ownership" value={farmer.ownership_type} onChange={(v) => set('farmerDetails.ownership_type', v)} options={OWNERSHIP_TYPE_OPTIONS} />
            <Select label="Locality" value={farmer.locality} onChange={(v) => set('farmerDetails.locality', v)} options={LOCALITY_OPTIONS} />
            <Select label="Ownership status" value={farmer.ownership_status} onChange={(v) => set('farmerDetails.ownership_status', v)} options={OWNERSHIP_STATUS_OPTIONS} />
            <Select label="Age" value={farmer.age} onChange={(v) => set('farmerDetails.age', v)} options={AGE_OPTIONS} />
            <Select label="Literacy" value={farmer.literacy} onChange={(v) => set('farmerDetails.literacy', v)} options={LITERACY_OPTIONS} />
            <Select label="Nature" value={farmer.nature} onChange={(v) => set('farmerDetails.nature', v)} options={NATURE_OPTIONS} />
          </div>
        </Card>

        <Card color="blue" icon="drop" title="3. Water source">
          <CheckGroup options={WATER_SOURCE_OPTIONS} selected={details.water_source} onToggle={(opt, checked) => toggleIn('landDetails.water_source', opt, checked)} />
          {(details.water_source || []).includes('borewell') && (
            <div className="lf-spaced">
              <Field label="No of borewells" type="number" value={details.number_of_bores} onChange={(v) => set('landDetails.number_of_bores', v)} placeholder="0" />
            </div>
          )}
          <Toggle label="Farm pond" checked={details.farm_pond} onChange={(v) => set('landDetails.farm_pond', v)} />
        </Card>

        <Card color="green" icon="compass" title="4. Path details">
          <div className="form-grid">
            <Select label="Nearest road type" value={details.nearest_road_type} onChange={(v) => set('landDetails.nearest_road_type', v)} options={ROAD_TYPE_OPTIONS} />
            <Select
              label="Land attached to road"
              value={details.land_attached_to_road}
              onChange={(v) => set('landDetails.land_attached_to_road', v)}
              options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
            />
            <Field label="Path ownership" value={details.path_ownership} onChange={(v) => set('landDetails.path_ownership', v)} placeholder="e.g. Government / Private" full />
          </div>
        </Card>

        <Card color="blue" icon="file" title="5. Documents">
          {DOC_TYPES.map((docType) => (
            <div key={docType} className="lf-doc-row">
              <div className="lf-doc-head">
                <span className="form-label">{docType.replace('_', ' ')}</span>
                <label className={`lf-upload-btn${uploading ? ' disabled' : ''}`}>
                  Upload
                  <input type="file" accept="image/*,application/pdf" disabled={uploading} onChange={(e) => handleDocumentFile(docType, e)} />
                </label>
              </div>
              {documents.map((doc, index) => doc.doc_type === docType && (
                <div key={`${doc.file_url}-${index}`} className="lf-doc-chip">
                  <a href={mediaUrl(doc.file_url)} target="_blank" rel="noopener noreferrer">View file</a>
                  <button type="button" onClick={() => removeDocument(index)} aria-label="Remove document">×</button>
                </div>
              ))}
            </div>
          ))}
        </Card>
      </div>

      {/* ── Column 2 ── */}
      <div className="form-column">
        <Card color="brown" icon="rupee" title="6. Acres & price">
          <div className="form-grid">
            <Field label="Acres" type="number" value={details.total_acres} onChange={(v) => set('landDetails.total_acres', v)} placeholder="0" />
            <Field label="Guntas" type="number" value={details.guntas} onChange={(v) => set('landDetails.guntas', v)} placeholder="0" />
            <Field label="Price per acre (lakhs)" type="number" step="0.01" value={details.price_per_acres} onChange={(v) => set('landDetails.price_per_acres', v)} placeholder="e.g. 5 for 5 lakhs" full />
          </div>
          <div className="total-value-box lf-spaced">
            <span className="total-value-label">Total value</span>
            <span className="total-value-amount">{formatLakhs(details.total_value)}</span>
          </div>
        </Card>

        <Card color="green" icon="layers" title="7. Land details">
          <div className="form-grid">
            <Select label="Soil type" value={details.soil_type} onChange={(v) => set('landDetails.soil_type', v)} options={SOIL_TYPE_OPTIONS} />
            <Select label="Fencing status" value={details.fencing_status} onChange={(v) => set('landDetails.fencing_status', v)} options={FENCING_OPTIONS} />
          </div>
          <div className="lf-spaced">
            <span className="form-label">Electricity</span>
            <CheckGroup options={ELECTRICITY_OPTIONS} selected={details.electricity} onToggle={(opt, checked) => toggleIn('landDetails.electricity', opt, checked)} />
          </div>
        </Card>

        <Card color="blue" icon="home" title="8. Residences & sheds">
          <span className="form-label">Residence</span>
          <CheckGroup options={RESIDENCE_OPTIONS} selected={details.residence} onToggle={(opt, checked) => toggleIn('landDetails.residence', opt, checked)} />
          {[
            { key: 'poultry', label: 'Poultry shed' },
            { key: 'cow', label: 'Cow shed' },
          ].map(({ key, label }) => {
            const count = Number(details[`${key}_shed_number`]) || 0;
            return (
              <div key={key} className="lf-spaced">
                <Toggle label={label} checked={count > 0} onChange={(on) => set(`landDetails.${key}_shed_number`, on ? 1 : 0)} />
                {count > 0 && (
                  <div className="lf-shed-grid">
                    <Field label="Number" type="number" value={details[`${key}_shed_number`]} onChange={(v) => set(`landDetails.${key}_shed_number`, parseInt(v, 10) || 0)} />
                    <Field label="Length (ft)" type="number" value={details[`${key}_shed_length`]} onChange={(v) => set(`landDetails.${key}_shed_length`, v)} />
                    <Field label="Width (ft)" type="number" value={details[`${key}_shed_width`]} onChange={(v) => set(`landDetails.${key}_shed_width`, v)} />
                  </div>
                )}
              </div>
            );
          })}
        </Card>

        <Card color="blue" icon="pin" title="9. GPS coordinates">
          {[
            { key: 'entry', label: 'Entry point' },
            { key: 'boundary', label: 'Boundary' },
          ].map(({ key, label }) => (
            <div key={key} className="lf-gps-block">
              <div className="lf-doc-head">
                <span className="form-label">{label}</span>
                <button
                  type="button"
                  className="lf-fetch-btn small"
                  onClick={() => fetchPosition((lat, lng) => onChange((prev) => ({
                    ...prev,
                    landDetails: { ...prev.landDetails, [`land_${key}_latitude`]: lat, [`land_${key}_longitude`]: lng },
                  })))}
                >
                  Fetch location
                </button>
              </div>
              <div className="form-grid">
                <Field label="Latitude" value={details[`land_${key}_latitude`]} onChange={(v) => set(`landDetails.land_${key}_latitude`, v)} placeholder="e.g. 17.123456" />
                <Field label="Longitude" value={details[`land_${key}_longitude`]} onChange={(v) => set(`landDetails.land_${key}_longitude`, v)} placeholder="e.g. 78.123456" />
              </div>
            </div>
          ))}
        </Card>

        <Card color="green" icon="tree" title="10. Trees">
          <div className="lf-tree-grid">
            {TREE_FIELDS.map(({ field, label }) => (
              <Field key={field} label={label} type="number" value={details[field]} onChange={(v) => set(`landDetails.${field}`, v)} placeholder="0" />
            ))}
          </div>
        </Card>

        <Card color="red" icon="alert" title="11. Complaints">
          <div className="lf-check-list">
            {COMPLAINT_OPTIONS.map((opt) => (
              <label key={opt} className="lf-check">
                <input type="checkbox" checked={(details.complaints || []).includes(opt)} onChange={(e) => toggleIn('landDetails.complaints', opt, e.target.checked)} />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Column 3 ── */}
      <div className="form-column">
        <Card color="red" icon="clock" title="12. Urgency & listing">
          <Toggle label="Urgent sale" checked={(value.urgency_listing || []).includes('urgent sale')} onChange={(on) => toggleIn('urgency_listing', 'urgent sale', on)} />
          <Toggle label="Premium listing" checked={(value.urgency_listing || []).includes('premium listing')} onChange={(on) => toggleIn('urgency_listing', 'premium listing', on)} />
          <Toggle label="Verification package" hint="Opt for land verification" checked={value.verification_package} onChange={(on) => set('verification_package', on)} />
        </Card>

        <Card color="blue" icon="flag" title="13. Land sale status">
          <div className="lf-check-grid">
            {SALE_STATUS_OPTIONS.map((opt) => (
              <label key={opt.value} className="lf-check">
                <input
                  type="checkbox"
                  checked={(value.land_sale_available_status || []).includes(opt.value)}
                  onChange={(e) => toggleIn('land_sale_available_status', opt.value, e.target.checked)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
          <hr className="status-divider" />
          <YesNo
            name="available_for_sale"
            label="Available for sale"
            list={value.land_sale_available_status}
            yesValue="AVAILABLE FOR SALE"
            onChange={(list) => set('land_sale_available_status', list)}
          />
        </Card>

        <Card color="brown" icon="bank" title="14. Mortgage status">
          <label className="lf-check">
            <input
              type="checkbox"
              checked={(value.mortage_availability_status || []).includes('CURRENTLY MORTGAGED')}
              onChange={(e) => toggleIn('mortage_availability_status', 'CURRENTLY MORTGAGED', e.target.checked)}
            />
            <span>Currently mortgaged</span>
          </label>
          <hr className="status-divider" />
          <YesNo
            name="available_for_mortgage"
            label="Available for mortgage"
            list={value.mortage_availability_status}
            yesValue="AVAILABLE FOR MORTGAGE"
            onChange={(list) => set('mortage_availability_status', list)}
          />
        </Card>

        <Card color="blue" icon="pin" title="15. Nearest towns">
          <div className="form-grid">
            <Select
              label="State"
              value={shown(ntStateObj, details.nearest_town_state)}
              onChange={setNearestTownState}
              options={names(states)}
              full
            />
          </div>
          {[
            { n: 1, label: 'Primary town', districtKey: 'nearest_town_district' },
            { n: 2, label: 'Secondary town', districtKey: 'nearest_town_district_2' },
            { n: 3, label: 'Tertiary town', districtKey: 'nearest_town_district_3' },
          ].map(({ n, label, districtKey }, i) => (
            <div key={n} className="lf-town-block">
              <span className="lf-town-title">{label}</span>
              <div className="form-grid">
                <Select
                  label="District"
                  value={details[districtKey]}
                  onChange={(v) => onChange((prev) => ({ ...prev, landDetails: { ...prev.landDetails, [districtKey]: v, [`nearest_town_${n}`]: '' } }))}
                  options={names(ntDistricts)}
                  disabled={!details.nearest_town_state}
                />
                <Select
                  label="Town"
                  value={details[`nearest_town_${n}`]}
                  onChange={(v) => set(`landDetails.nearest_town_${n}`, v)}
                  options={names(townsOf(ntDistrictObjs[i]?.id))}
                  disabled={!details[districtKey]}
                />
                <Field
                  label="Distance (km)"
                  type="number"
                  step="0.1"
                  value={details[`nearest_town_distance_${n}`]}
                  onChange={(v) => set(`landDetails.nearest_town_distance_${n}`, v)}
                  placeholder="e.g. 10.5"
                  full
                />
              </div>
            </div>
          ))}
        </Card>

        <Card color="brown" icon="camera" title="16. Photos & video">
          <div className="lf-media-grid">
            {MEDIA_CATEGORIES.map(({ key, label }) => {
              const count = media.filter((m) => m.category === key).length;
              return (
                <button
                  key={key}
                  type="button"
                  className={`lf-media-tile${count ? ' has-media' : ''}${mediaCategory === key ? ' active' : ''}`}
                  onClick={() => pickMedia(key)}
                  disabled={uploading}
                >
                  {count > 0 && <span className="lf-media-count">{count}</span>}
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
          {uploading && <div className="lf-uploading">Uploading...</div>}
          {media.length > 0 && (
            <div className="lf-gallery">
              {media.map((item, index) => (
                <div key={`${item.url}-${index}`} className="lf-gallery-item">
                  {item.type === 'video' ? (
                    <video src={mediaUrl(item.url)} controls />
                  ) : (
                    <img src={mediaUrl(item.url)} alt={item.category} onError={(e) => { e.currentTarget.src = IMAGE_NOT_FOUND_PLACEHOLDER; }} />
                  )}
                  <span className="lf-gallery-caption">{String(item.category || '').replace(/_/g, ' ')}</span>
                  <button
                    type="button"
                    className={`lf-gallery-public${item.public ? ' is-public' : ''}`}
                    onClick={() => toggleMediaPublic(index)}
                    title={item.public ? 'Public (click to make private)' : 'Private (click to make public)'}
                  >
                    {item.public ? '✓ Public' : 'Private'}
                  </button>
                  <button type="button" className="lf-gallery-remove" onClick={() => removeMedia(index)} aria-label="Remove">×</button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
