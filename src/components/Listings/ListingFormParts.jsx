import React from 'react';
import mediaUrl from '../../utils/mediaUrl';
import { CONTACT_TYPE_OPTIONS, MEDIA_SLOTS } from '../../utils/listingRecord';

/**
 * Building blocks for the four listing forms.
 *
 * A deliberate exception to the duplicate-markup convention (like LandForm):
 * fields 01, 14, 15 and 16-20 are identical on all four Garuda listing forms
 * and must stay in lock-step with utils/listingRecord.js and the backend
 * schema, so they live here once. Each form's own section A (02-13) is written
 * out in its own file.
 */

/* ── Primitives ─────────────────────────────────────────────── */

export function FormSection({ title, children }) {
  return (
    <section className="lst-section">
      <h3 className="lst-section-title">{title}</h3>
      <div className="lst-section-body">{children}</div>
    </section>
  );
}

/** One numbered row of the form: "07. Bedrooms  [NUMBER]". */
export function FieldRow({ num, label, required, hint, children }) {
  return (
    <div className="lst-row">
      <div className="lst-row-head">
        <span className="lst-row-label">
          <span className="lst-row-num">{num}.</span> {label}
          {required && <span className="lst-required">*</span>}
        </span>
        {hint && <span className="lst-row-hint">{hint}</span>}
      </div>
      <div className="lst-row-body">{children}</div>
    </div>
  );
}

/** Single-choice pills (radio). Clicking the selected pill clears it unless `required`. */
export function OptionPills({ options, value, onChange, required }) {
  return (
    <div className="lst-pills" role="radiogroup">
      {options.map((o) => {
        const active = String(value) === String(o.value);
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={`lst-pill${active ? ' active' : ''}`}
            onClick={() => onChange(active && !required ? '' : o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Multi-choice pills (checkboxes). */
export function CheckPills({ options, values = [], onToggle }) {
  return (
    <div className="lst-pills">
      {options.map((o) => {
        const active = values.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            role="checkbox"
            aria-checked={active}
            className={`lst-pill check${active ? ' active' : ''}`}
            onClick={() => onToggle(o.value)}
          >
            <span className="lst-pill-box">{active ? '✓' : ''}</span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Yes / No / unset for nullable booleans (e.g. "Negotiable"). */
export function YesNo({ label, value, onChange }) {
  return (
    <div className="lst-inline">
      <span className="lst-inline-label">{label}</span>
      <OptionPills
        options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
        value={value === true ? 'yes' : value === false ? 'no' : ''}
        onChange={(v) => onChange(v === 'yes' ? true : v === 'no' ? false : null)}
      />
    </div>
  );
}

/** Number input with a unit suffix ("sq. ft.", "BHK"). */
export function NumberInput({ value, onChange, unit, placeholder, step = 'any', min = 0, disabled, prefix }) {
  return (
    <div className={`lst-input-wrap${disabled ? ' disabled' : ''}`}>
      {prefix && <span className="lst-input-prefix">{prefix}</span>}
      <input
        type="number"
        className="lst-input"
        value={value}
        min={min}
        step={step}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onWheel={(e) => e.currentTarget.blur()}
      />
      {unit && <span className="lst-input-unit">{unit}</span>}
    </div>
  );
}

export function TextInput({ value, onChange, placeholder, maxLength }) {
  return (
    <input
      type="text"
      className="lst-input lst-input-full"
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Indian-format hint under a rupee amount, e.g. "₹45.5 Lakh". */
export function RupeeHint({ value }) {
  const n = Number(value);
  if (!value || !Number.isFinite(n) || n <= 0) return null;
  let text = `₹${n.toLocaleString('en-IN')}`;
  if (n >= 1e7) text += ` (${(n / 1e7).toFixed(2).replace(/\.?0+$/, '')} Cr)`;
  else if (n >= 1e5) text += ` (${(n / 1e5).toFixed(2).replace(/\.?0+$/, '')} Lakh)`;
  return <span className="lst-hint">{text}</span>;
}

/** Road width presets (20/30/40/60 ft …) plus an "Other" free value. */
export function RoadWidthPicker({ presets, value, onChange }) {
  const isPreset = presets.includes(String(value));
  const [otherMode, setOtherMode] = React.useState(value !== '' && !isPreset);
  return (
    <div className="lst-inline wrap">
      <OptionPills
        options={[...presets.map((p) => ({ value: p, label: `${p} ft` })), { value: '__other', label: 'Other' }]}
        value={otherMode ? '__other' : value}
        onChange={(v) => {
          if (v === '__other') {
            setOtherMode(true);
            onChange('');
          } else {
            setOtherMode(false);
            onChange(v);
          }
        }}
      />
      {otherMode && (
        <NumberInput value={value} onChange={onChange} unit="ft" placeholder="Width" />
      )}
    </div>
  );
}

/* ── 01. Location ───────────────────────────────────────────── */

export function LocationFields({ f, num = '01', label }) {
  const { locations, form, setField, changeState, changeDistrict } = f;
  return (
    <FieldRow num={num} label={label} required hint="Dropdown">
      <div className="lst-grid-3">
        <label className="lst-sub">
          <span>State</span>
          <select className="lst-input" value={locations.selectedState} onChange={(e) => changeState(e.target.value)}>
            <option value="">{locations.loading.states ? 'Loading…' : 'Select state'}</option>
            {locations.states.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="lst-sub">
          <span>District</span>
          <select
            className="lst-input"
            value={locations.selectedDistrict}
            disabled={!locations.selectedState}
            onChange={(e) => changeDistrict(e.target.value)}
          >
            <option value="">{locations.loading.districts ? 'Loading…' : 'Select district'}</option>
            {locations.districts.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>
        <label className="lst-sub">
          <span>Town</span>
          <select
            className="lst-input"
            value={form.town_id}
            disabled={!locations.selectedDistrict}
            onChange={(e) => setField('town_id', e.target.value)}
          >
            <option value="">{locations.loading.towns ? 'Loading…' : 'Select town'}</option>
            {locations.towns.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="lst-sub lst-spaced">
        <span>Area / locality</span>
        <TextInput value={form.town_area} onChange={(v) => setField('town_area', v)} placeholder="e.g. Kompally, Phase 2" maxLength={200} />
      </label>
    </FieldRow>
  );
}

/* ── 14. GPS ────────────────────────────────────────────────── */

export function GpsFields({ f, num = '14' }) {
  const { form, setField, locating, fetchCurrentLocation } = f;
  const hasCoords = form.latitude !== '' && form.longitude !== '';
  return (
    <FieldRow num={num} label="GPS Location" hint="Map / GPS · private">
      <label className="lst-sub">
        <span>Google Maps link or coordinates</span>
        <TextInput
          value={form.maps_link}
          onChange={(v) => setField('maps_link', v)}
          placeholder="https://maps.google.com/… or 17.3850, 78.4867"
        />
      </label>
      <div className="lst-grid-3 lst-spaced">
        <label className="lst-sub">
          <span>Latitude</span>
          <NumberInput value={form.latitude} onChange={(v) => setField('latitude', v)} min={-90} placeholder="17.3850" />
        </label>
        <label className="lst-sub">
          <span>Longitude</span>
          <NumberInput value={form.longitude} onChange={(v) => setField('longitude', v)} min={-180} placeholder="78.4867" />
        </label>
        <div className="lst-sub lst-gps-actions">
          <button type="button" className="lst-btn secondary" onClick={fetchCurrentLocation} disabled={locating}>
            {locating ? 'Locating…' : 'Use current location'}
          </button>
          {hasCoords && (
            <a
              className="lst-link"
              href={`https://www.google.com/maps?q=${form.latitude},${form.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              Open in Maps ↗
            </a>
          )}
        </div>
      </div>
      <span className="lst-hint">If latitude/longitude are left empty, they are read from the Maps link when it contains coordinates.</span>
    </FieldRow>
  );
}

/* ── 15. Media ──────────────────────────────────────────────── */

const isImage = (url = '') => /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(url);
const isVideo = (url = '') => /\.(mp4|mov|webm)(\?|$)/i.test(url);

export function MediaFields({ f, type, num = '15', label }) {
  const { form, uploading, uploadMedia, removeMedia } = f;
  return (
    <FieldRow num={num} label={label} hint="Image / Video">
      <div className="lst-media-slots">
        {MEDIA_SLOTS[type].map((slot) => {
          const items = form.media.filter((m) => m.kind === slot.kind);
          return (
            <div key={slot.kind} className="lst-media-slot">
              <div className="lst-media-head">
                <span>{slot.label}</span>
                <label className={`lst-btn secondary small${uploading[slot.kind] ? ' disabled' : ''}`}>
                  {uploading[slot.kind] ? 'Uploading…' : items.length && !slot.multiple ? 'Replace' : 'Upload'}
                  <input
                    type="file"
                    hidden
                    accept={slot.accept}
                    multiple={slot.multiple}
                    disabled={uploading[slot.kind]}
                    onChange={(e) => {
                      uploadMedia(slot.kind, e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
              {items.length === 0 ? (
                <span className="lst-media-empty">Nothing uploaded</span>
              ) : (
                <div className="lst-media-list">
                  {items.map((m) => (
                    <div key={m.url} className="lst-media-item">
                      <a href={mediaUrl(m.url)} target="_blank" rel="noreferrer" className="lst-media-thumb">
                        {isImage(m.url) ? (
                          <img src={mediaUrl(m.url)} alt={m.name || slot.label} />
                        ) : (
                          <span className="lst-media-icon">{isVideo(m.url) ? '▶' : 'PDF'}</span>
                        )}
                      </a>
                      <span className="lst-media-name" title={m.name}>{m.name || 'File'}</span>
                      <button type="button" className="lst-media-remove" onClick={() => removeMedia(m.url)} aria-label="Remove file">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </FieldRow>
  );
}

/* ── 16-20. Contact / listing details ───────────────────────── */

export function ContactSection({ f, type }) {
  const { form, setField } = f;
  return (
    <FormSection title="B. Contact / Listing Details (16-20)">
      <FieldRow num="16" label="Contact Person Name" required hint="Text">
        <TextInput value={form.contact_name} onChange={(v) => setField('contact_name', v)} placeholder="Full name" maxLength={120} />
      </FieldRow>

      <FieldRow num="17" label="Mobile Number" required hint="Phone · private">
        <div className="lst-input-wrap phone">
          <span className="lst-input-prefix">+91</span>
          <input
            type="tel"
            inputMode="numeric"
            className="lst-input"
            value={form.mobile}
            maxLength={10}
            placeholder="10-digit mobile"
            onChange={(e) => setField('mobile', e.target.value.replace(/\D/g, ''))}
          />
        </div>
      </FieldRow>

      <FieldRow num="18" label="WhatsApp Number" hint="Phone">
        <div className="lst-inline wrap">
          <OptionPills
            required
            options={[{ value: 'same', label: 'Same as Mobile' }, { value: 'different', label: 'Different' }]}
            value={form.whatsapp_same_as_mobile ? 'same' : 'different'}
            onChange={(v) => setField('whatsapp_same_as_mobile', v === 'same')}
          />
          {!form.whatsapp_same_as_mobile && (
            <div className="lst-input-wrap phone">
              <span className="lst-input-prefix">+91</span>
              <input
                type="tel"
                inputMode="numeric"
                className="lst-input"
                value={form.whatsapp_number}
                maxLength={10}
                placeholder="WhatsApp number"
                onChange={(e) => setField('whatsapp_number', e.target.value.replace(/\D/g, ''))}
              />
            </div>
          )}
        </div>
      </FieldRow>

      <FieldRow num="19" label="Contact Person Type" required hint="Dropdown">
        <OptionPills
          required
          options={CONTACT_TYPE_OPTIONS[type]}
          value={form.contact_type}
          onChange={(v) => setField('contact_type', v)}
        />
      </FieldRow>

      <FieldRow num="20" label="Listing Agent ID" hint="Text / Auto">
        <div className="lst-inline wrap">
          <OptionPills
            required
            options={[{ value: 'direct', label: 'Direct Listing' }, { value: 'agent', label: 'Via Garuda Agent' }]}
            value={form.is_direct_listing ? 'direct' : 'agent'}
            onChange={(v) => setField('is_direct_listing', v === 'direct')}
          />
          {!form.is_direct_listing && (
            <input
              type="text"
              className="lst-input"
              value={form.agent_code}
              placeholder="Garuda Agent ID"
              maxLength={60}
              onChange={(e) => setField('agent_code', e.target.value)}
            />
          )}
        </div>
      </FieldRow>
    </FormSection>
  );
}

/* ── Frame: header, error banner and actions ────────────────── */

export function ListingFormFrame({ f, title, subtitle, onCancel, children }) {
  return (
    <form className="lst-form" onSubmit={f.submit} noValidate>
      <div className="lst-form-header">
        <div>
          <h2 className="lst-form-title">{title}</h2>
          <p className="lst-form-subtitle">{subtitle}</p>
        </div>
        <button type="button" className="lst-btn secondary" onClick={onCancel}>← Back to list</button>
      </div>

      {children}

      <p className="lst-privacy">Private: contact details and exact GPS. Approval and property claims require verification.</p>

      {f.error && <div className="lst-error" role="alert">{f.error}</div>}

      <div className="lst-form-actions">
        <button type="button" className="lst-btn secondary" onClick={onCancel} disabled={f.saving}>Cancel</button>
        <button type="submit" className="lst-btn primary" disabled={f.saving}>
          {f.saving ? 'Saving…' : f.isEdit ? 'Save changes' : 'Submit listing'}
        </button>
      </div>
    </form>
  );
}
