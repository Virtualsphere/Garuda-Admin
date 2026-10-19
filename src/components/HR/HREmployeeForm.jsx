import React, { useState, useEffect } from 'react';
import employeeService from '../../services/employeeService';
import uploadService from '../../services/uploadService';
import useLocationLevels from '../../hooks/useLocationLevels';
import mediaUrl from '../../utils/mediaUrl';

const BLOOD_GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const STATUSES = ['ACTIVE', 'DEACTIVE', 'TRAINEE'];
const FALLBACK_ROLES = ['FIELD_AGENT', 'FIELD_EXECUTIVE', 'MANAGER', 'SUPERVISOR', 'ADMIN'];

const EMPTY_EMPLOYEE = {
  name: '', email: '', password: '', phone: '', other_phone: '',
  role: 'FIELD_AGENT', status: 'ACTIVE', blood_group: 'O+', shirt_size: 'M',
  address: '', about: '',
  aadhar_number: '', aadhar_photo: '',
  bank_name: '', account_number: '', ifsc_code: '', upi_id: '', phone_pe_number: '', google_pay_number: '',
  work_state: '', work_district: '', work_mandal: '', work_village: '',
  new_land_price: 250, verification_price: 40, buyer_visit_price: 100, referal_price: 50,
};

// The employee row stores district/mandal/village as name arrays; the form edits one of each.
const firstOf = (value) => (Array.isArray(value) ? value[0] || '' : value || '');

const toForm = (employee) => {
  if (!employee) return { ...EMPTY_EMPLOYEE };
  const form = { ...EMPTY_EMPLOYEE };
  Object.keys(EMPTY_EMPLOYEE).forEach((key) => {
    if (employee[key] !== null && employee[key] !== undefined) form[key] = employee[key];
  });
  form.password = '';
  form.work_district = firstOf(employee.work_district);
  form.work_mandal = firstOf(employee.work_mandal);
  form.work_village = firstOf(employee.work_village);
  return form;
};

const toPayload = (form, isCreate) => {
  const payload = {
    ...form,
    work_district: form.work_district ? [form.work_district] : [],
    work_mandal: form.work_mandal ? [form.work_mandal] : [],
    work_village: form.work_village ? [form.work_village] : [],
  };
  ['new_land_price', 'verification_price', 'buyer_visit_price', 'referal_price'].forEach((key) => {
    payload[key] = parseFloat(payload[key]) || 0;
  });
  if (!isCreate) delete payload.password;
  return payload;
};

const findByName = (list, name) =>
  name ? list.find((item) => String(item.name).trim().toLowerCase() === String(name).trim().toLowerCase()) : undefined;

function Section({ title, children }) {
  return (
    <div className="hr-form-section">
      <div className="hr-form-section-title">{title}</div>
      <div className="hr-form-grid">{children}</div>
    </div>
  );
}

function Input({ label, name, value, onChange, type = 'text', placeholder, required, full }) {
  return (
    <label className={`hr-form-field${full ? ' full' : ''}`}>
      <span>{label}{required && ' *'}</span>
      <input type={type} value={value ?? ''} onChange={(e) => onChange(name, e.target.value)} placeholder={placeholder} required={required} />
    </label>
  );
}

function Choice({ label, name, value, onChange, options, placeholder, disabled }) {
  return (
    <label className="hr-form-field">
      <span>{label}</span>
      <select value={value ?? ''} onChange={(e) => onChange(name, e.target.value)} disabled={disabled}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </label>
  );
}

/** Create (`employee` null) or edit an employee. Calls `onSaved(message)` on success. */
export default function HREmployeeForm({ employee, roles, onCancel, onSaved }) {
  const isCreate = !employee;
  const [form, setForm] = useState(() => toForm(employee));
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const { states, loadDistricts, loadMandals, loadVillages, districtsOf, mandalsOf, villagesOf } = useLocationLevels();

  const set = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const stateObj = findByName(states, form.work_state);
  const districtObj = findByName(districtsOf(stateObj?.id), form.work_district);
  const mandalObj = findByName(mandalsOf(districtObj?.id), form.work_mandal);
  useEffect(() => { if (stateObj) loadDistricts(stateObj.id); }, [stateObj, loadDistricts]);
  useEffect(() => { if (districtObj) loadMandals(districtObj.id); }, [districtObj, loadMandals]);
  useEffect(() => { if (mandalObj) loadVillages(mandalObj.id); }, [mandalObj, loadVillages]);

  const setLocation = (name, value) => {
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'work_state') Object.assign(next, { work_district: '', work_mandal: '', work_village: '' });
      if (name === 'work_district') Object.assign(next, { work_mandal: '', work_village: '' });
      if (name === 'work_mandal') next.work_village = '';
      return next;
    });
  };

  const handleAadharUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadService.upload(file, 'photo');
      if (!url) throw new Error('No URL returned');
      set('aadhar_photo', url);
    } catch (err) {
      console.error('Aadhar upload failed:', err);
      setError('Failed to upload the Aadhar photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = toPayload(form, isCreate);
      if (isCreate) await employeeService.create(payload);
      else await employeeService.update(employee.id, payload);
      onSaved(isCreate ? 'Employee created.' : 'Employee updated.');
    } catch (err) {
      console.error('Failed to save employee:', err);
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to save employee.');
    } finally {
      setSaving(false);
    }
  };

  const roleNames = roles.length ? roles.map((r) => r.name) : FALLBACK_ROLES;
  // Keep a role the employee already has selectable even if it was since deleted.
  const roleOptions = form.role && !roleNames.includes(form.role) ? [form.role, ...roleNames] : roleNames;
  const names = (list) => list.map((item) => String(item.name).trim());

  return (
    <form className="hr-form" onSubmit={handleSubmit}>
      <div className="hr-emp-header">
        <div className="hr-emp-title-texts">
          <button type="button" className="hr-back-btn" onClick={onCancel}>‹ Back to registry</button>
          <span className="hr-emp-title">{isCreate ? 'ADD EMPLOYEE' : `EDIT EMPLOYEE • ${employee.name}`}</span>
          <span className="hr-emp-subtitle">PERSONNEL FILE</span>
        </div>
        <div className="hr-emp-actions">
          <button type="button" className="hr-emp-global-btn" onClick={onCancel} disabled={saving}>Cancel</button>
          <button type="submit" className="hr-primary-btn" disabled={saving || uploading}>
            {saving ? 'Saving...' : isCreate ? 'Create employee' : 'Update employee'}
          </button>
        </div>
      </div>

      {error && <div className="hr-alert error">{error}</div>}

      <Section title="Personal information">
        <Input label="Name" name="name" value={form.name} onChange={set} placeholder="Full name" required />
        <Input label="Email" name="email" type="email" value={form.email} onChange={set} placeholder="email@example.com" required />
        {isCreate && (
          <label className="hr-form-field">
            <span>Password *</span>
            <div className="hr-password">
              <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => set('password', e.target.value)} required />
              <button type="button" onClick={() => setShowPassword((v) => !v)}>{showPassword ? 'Hide' : 'Show'}</button>
            </div>
          </label>
        )}
        <Input label="Phone" name="phone" type="tel" value={form.phone} onChange={set} placeholder="10-digit phone" />
        <Input label="Other phone" name="other_phone" type="tel" value={form.other_phone} onChange={set} placeholder="Alternative phone" />
        <Choice label="Blood group" name="blood_group" value={form.blood_group} onChange={set} options={BLOOD_GROUPS} />
        <Choice label="Shirt size" name="shirt_size" value={form.shirt_size} onChange={set} options={SHIRT_SIZES} />
        <Input label="Address" name="address" value={form.address} onChange={set} placeholder="Full address" full />
        <Input label="About" name="about" value={form.about} onChange={set} placeholder="Brief description" full />
      </Section>

      <Section title="Role & status">
        <Choice label="Role" name="role" value={form.role} onChange={set} options={roleOptions} />
        <Choice label="Status" name="status" value={form.status} onChange={set} options={STATUSES} />
      </Section>

      <Section title="Work location">
        <Choice label="State" name="work_state" value={stateObj ? String(stateObj.name).trim() : form.work_state} onChange={setLocation} options={names(states)} placeholder="Select state" />
        <Choice label="District" name="work_district" value={form.work_district} onChange={setLocation} options={names(districtsOf(stateObj?.id))} placeholder="Select district" disabled={!form.work_state} />
        <Choice label="Mandal" name="work_mandal" value={form.work_mandal} onChange={setLocation} options={names(mandalsOf(districtObj?.id))} placeholder="Select mandal" disabled={!form.work_district} />
        <Choice label="Village" name="work_village" value={form.work_village} onChange={setLocation} options={names(villagesOf(mandalObj?.id))} placeholder="Select village" disabled={!form.work_mandal} />
      </Section>

      <Section title="Bank & payment">
        <Input label="Bank name" name="bank_name" value={form.bank_name} onChange={set} placeholder="e.g. SBI" />
        <Input label="Account number" name="account_number" value={form.account_number} onChange={set} />
        <Input label="IFSC code" name="ifsc_code" value={form.ifsc_code} onChange={set} placeholder="e.g. SBIN0001234" />
        <Input label="UPI ID" name="upi_id" value={form.upi_id} onChange={set} placeholder="user@upi" />
        <Input label="PhonePe number" name="phone_pe_number" type="tel" value={form.phone_pe_number} onChange={set} />
        <Input label="Google Pay number" name="google_pay_number" type="tel" value={form.google_pay_number} onChange={set} />
      </Section>

      <Section title="Aadhar">
        <Input label="Aadhar number" name="aadhar_number" value={form.aadhar_number} onChange={set} placeholder="12-digit Aadhar" />
        <div className="hr-form-field">
          <span>Aadhar photo</span>
          <div className="hr-upload-row">
            <label className={`hr-upload-btn${uploading ? ' disabled' : ''}`}>
              {uploading ? 'Uploading...' : form.aadhar_photo ? 'Replace photo' : 'Upload photo'}
              <input type="file" accept="image/*" onChange={handleAadharUpload} disabled={uploading} />
            </label>
            {form.aadhar_photo && <a href={mediaUrl(form.aadhar_photo)} target="_blank" rel="noopener noreferrer">View</a>}
          </div>
        </div>
      </Section>

      <Section title="Salary package (₹)">
        <Input label="New land price" name="new_land_price" type="number" value={form.new_land_price} onChange={set} />
        <Input label="Verification price" name="verification_price" type="number" value={form.verification_price} onChange={set} />
        <Input label="Buyer visit price" name="buyer_visit_price" type="number" value={form.buyer_visit_price} onChange={set} />
        <Input label="Referral price" name="referal_price" type="number" value={form.referal_price} onChange={set} />
      </Section>
    </form>
  );
}
