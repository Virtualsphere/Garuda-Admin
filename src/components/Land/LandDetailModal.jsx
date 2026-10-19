import React, { useState, useEffect } from 'react';
import landService from '../../services/landService';
import mediaUrl, { IMAGE_NOT_FOUND_PLACEHOLDER } from '../../utils/mediaUrl';
import { landToForm, landCode, formatLakhs } from '../../utils/landRecord';
import './LandDetailModal.css';

const TABS = [
  { key: 'basic', label: 'Basic' },
  { key: 'farmer', label: 'Farmer' },
  { key: 'land', label: 'Land' },
  { key: 'media', label: 'Media' },
  { key: 'documents', label: 'Documents' },
];

const show = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

function Row({ label, value }) {
  return (
    <div className="ldm-row">
      <span className="ldm-label">{label}</span>
      <span className="ldm-value">{show(value)}</span>
    </div>
  );
}

function StatusPill({ status }) {
  const s = String(status || 'pending').toLowerCase();
  return <span className={`ldm-status ${s}`}>{s}</span>;
}

/** Read-only view of one land. Fetches the full record (queues omit relations). */
export default function LandDetailModal({ landId, onClose, onEdit }) {
  const [land, setLand] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('basic');

  useEffect(() => {
    let cancelled = false;
    landService
      .getById(landId)
      .then((data) => {
        if (cancelled) return;
        const record = data.data || data;
        setLand(record);
        setForm(landToForm(record));
      })
      .catch((err) => {
        console.error('Failed to load land:', err);
        if (!cancelled) setError('Could not load this land.');
      });
    return () => { cancelled = true; };
  }, [landId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const farmer = form?.farmerDetails || {};
  const details = form?.landDetails || {};
  const media = form?.media || [];
  const documents = form?.documents || [];

  return (
    <div className="ldm-overlay" onClick={onClose}>
      <div className="ldm-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="ldm-header">
          <div>
            <span className="ldm-title">{farmer.name || 'Land record'}</span>
            <span className="ldm-subtitle">
              {landCode({ id: landId })}{form ? ` • ${[form.village, form.mandal, form.district, form.state].filter(Boolean).join(', ')}` : ''}
            </span>
          </div>
          <div className="ldm-header-actions">
            {onEdit && form && <button type="button" className="ldm-edit-btn" onClick={onEdit}>Edit</button>}
            <button type="button" className="ldm-close" onClick={onClose} aria-label="Close">×</button>
          </div>
        </div>

        <div className="ldm-tabs">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={`ldm-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
              {t.key === 'media' && media.length > 0 && <span className="ldm-tab-count">{media.length}</span>}
              {t.key === 'documents' && documents.length > 0 && <span className="ldm-tab-count">{documents.length}</span>}
            </button>
          ))}
        </div>

        <div className="ldm-body">
          {error && <div className="ldm-empty">{error}</div>}
          {!form && !error && <div className="ldm-empty">Loading...</div>}

          {form && tab === 'basic' && (
            <div className="ldm-grid">
              <section>
                <h4>Address</h4>
                <Row label="State" value={form.state} />
                <Row label="District" value={form.district} />
                <Row label="Mandal" value={form.mandal} />
                <Row label="Village" value={form.village} />
                <Row label="GPS" value={form.location_latitude && form.location_longitude ? `${form.location_latitude}, ${form.location_longitude}` : ''} />
              </section>
              <section>
                <h4>Pipeline</h4>
                <div className="ldm-row"><span className="ldm-label">Phone verification</span><StatusPill status={land.call_verification_status} /></div>
                <div className="ldm-row"><span className="ldm-label">Physical verification</span><StatusPill status={land.physcial_verification_status} /></div>
                <div className="ldm-row"><span className="ldm-label">Final verification</span><StatusPill status={land.verification_status} /></div>
                <Row label="Created by" value={land.creator?.name} />
                <Row label="Created on" value={land.created_at ? new Date(land.created_at).toLocaleString() : ''} />
              </section>
              <section>
                <h4>Listing</h4>
                <Row label="Sale status" value={form.land_sale_available_status} />
                <Row label="Mortgage" value={form.mortage_availability_status} />
                <Row label="Urgency" value={form.urgency_listing} />
                <Row label="Verification package" value={!!form.verification_package} />
              </section>
              <section>
                <h4>Nearest towns</h4>
                {[1, 2, 3].map((n) => (
                  <Row
                    key={n}
                    label={`Town ${n}`}
                    value={details[`nearest_town_${n}`]
                      ? `${details[`nearest_town_${n}`]}${details[`nearest_town_distance_${n}`] ? ` (${details[`nearest_town_distance_${n}`]} km)` : ''}`
                      : ''}
                  />
                ))}
              </section>
            </div>
          )}

          {form && tab === 'farmer' && (
            <div className="ldm-grid">
              <section>
                <h4>Contact</h4>
                <Row label="Name" value={farmer.name} />
                <Row label="Phone" value={farmer.phone} />
                <Row label="WhatsApp" value={farmer.whatsapp} />
              </section>
              <section>
                <h4>Profile</h4>
                <Row label="Ownership type" value={farmer.ownership_type} />
                <Row label="Ownership status" value={farmer.ownership_status} />
                <Row label="Locality" value={farmer.locality} />
                <Row label="Age" value={farmer.age} />
                <Row label="Literacy" value={farmer.literacy} />
                <Row label="Nature" value={farmer.nature} />
              </section>
            </div>
          )}

          {form && tab === 'land' && (
            <div className="ldm-grid">
              <section>
                <h4>Area & price</h4>
                <Row label="Acres" value={details.total_acres} />
                <Row label="Guntas" value={details.guntas} />
                <Row label="Price per acre" value={details.price_per_acres !== '' ? formatLakhs(details.price_per_acres) : ''} />
                <Row label="Total value" value={formatLakhs(details.total_value)} />
              </section>
              <section>
                <h4>Land</h4>
                <Row label="Soil type" value={details.soil_type} />
                <Row label="Fencing" value={details.fencing_status} />
                <Row label="Electricity" value={details.electricity} />
                <Row label="Road type" value={details.nearest_road_type} />
                <Row label="Attached to road" value={details.land_attached_to_road} />
                <Row label="Path ownership" value={details.path_ownership} />
              </section>
              <section>
                <h4>Water & structures</h4>
                <Row label="Water source" value={details.water_source} />
                <Row label="Borewells" value={details.number_of_bores} />
                <Row label="Farm pond" value={!!details.farm_pond} />
                <Row label="Residence" value={details.residence} />
                <Row label="Poultry sheds" value={details.poultry_shed_number} />
                <Row label="Cow sheds" value={details.cow_shed_number} />
              </section>
              <section>
                <h4>Trees & risks</h4>
                <Row
                  label="Trees"
                  value={(land.tree || []).map((t) => `${t.type} ${t.count}`)}
                />
                <Row label="Complaints" value={details.complaints} />
                <Row label="Entry GPS" value={details.land_entry_latitude ? `${details.land_entry_latitude}, ${details.land_entry_longitude}` : ''} />
                <Row label="Boundary GPS" value={details.land_boundary_latitude ? `${details.land_boundary_latitude}, ${details.land_boundary_longitude}` : ''} />
              </section>
            </div>
          )}

          {form && tab === 'media' && (
            media.length === 0 ? <div className="ldm-empty">No media uploaded.</div> : (
              <div className="ldm-media-grid">
                {media.map((item, index) => (
                  <a key={`${item.url}-${index}`} className="ldm-media" href={mediaUrl(item.url)} target="_blank" rel="noopener noreferrer">
                    {item.type === 'video' ? (
                      <video src={mediaUrl(item.url)} controls onClick={(e) => e.preventDefault()} />
                    ) : (
                      <img src={mediaUrl(item.url)} alt={item.category} onError={(e) => { e.currentTarget.src = IMAGE_NOT_FOUND_PLACEHOLDER; }} />
                    )}
                    <span>{String(item.category || '').replace(/_/g, ' ')}</span>
                  </a>
                ))}
              </div>
            )
          )}

          {form && tab === 'documents' && (
            documents.length === 0 ? <div className="ldm-empty">No documents uploaded.</div> : (
              <div className="ldm-doc-list">
                {documents.map((doc, index) => (
                  <a key={`${doc.file_url}-${index}`} className="ldm-doc" href={mediaUrl(doc.file_url)} target="_blank" rel="noopener noreferrer">
                    <span>{String(doc.doc_type || 'Document').replace('_', ' ')}</span>
                    <span className="ldm-doc-open">Open ›</span>
                  </a>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
