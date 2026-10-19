import React, { useState } from 'react';
import landService from '../../services/landService';
import LandForm from './LandForm';
import { createEmptyLand, formToPayload } from '../../utils/landRecord';
import './AddLandForm.css';

const DRAFT_STORAGE_KEY = 'garuda_land_draft_v2';

const readDraft = () => {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default function AddLandForm() {
  const [draft] = useState(readDraft);
  const [formData, setFormData] = useState(() => draft?.formData || createEmptyLand());
  const [formKey, setFormKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState(
    draft ? { type: 'success', text: `Restored your draft from ${new Date(draft.savedAt).toLocaleString()}.` } : null
  );

  const showError = (text) => setSubmitMsg({ type: 'error', text });

  const handleSaveDraft = () => {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ formData, savedAt: new Date().toISOString() }));
      setSubmitMsg({ type: 'success', text: 'Draft saved on this device.' });
    } catch {
      showError('Could not save the draft on this device.');
    }
  };

  const handleReset = () => {
    if (!window.confirm('Clear every field on this form?')) return;
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setFormData(createEmptyLand());
    // Remount so the form's local state (e.g. WhatsApp toggle) resets too.
    setFormKey((k) => k + 1);
    setSubmitMsg(null);
  };

  const handleSubmit = async () => {
    if (!formData.state || !formData.district || !formData.mandal || !formData.village) {
      showError('Land address (state, district, mandal, village) is required.');
      return;
    }
    if (!formData.farmerDetails.name?.trim() || !formData.farmerDetails.phone?.trim()) {
      showError('Farmer name and phone number are required.');
      return;
    }

    setSubmitting(true);
    setSubmitMsg(null);
    try {
      // Lands added from the admin panel skip phone verification and go
      // straight to the physical audit queue (same as the old panel).
      await landService.create(formToPayload(formData, {
        form_status: 'complete',
        call_verification_status: 'complete',
        physcial_verification_status: 'pending',
      }));
      setSubmitMsg({ type: 'success', text: 'Land saved. It is now in the Physical list for audit.' });
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setFormData(createEmptyLand());
      setFormKey((k) => k + 1);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to save land.';
      showError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="add-land-form-container">
      <div className="add-land-header">
        <div className="add-land-title-group">
          <span className="add-land-title">ADD NEW LAND</span>
          <span className="add-land-subtitle">REGISTRY CORE • FARMER, PARCEL, MEDIA &amp; DOCUMENTS</span>
        </div>
        <div className="add-land-header-actions">
          <button type="button" className="save-draft-btn" onClick={handleReset} disabled={submitting}>
            RESET
          </button>
          <button type="button" className="save-draft-btn" onClick={handleSaveDraft} disabled={submitting}>
            SAVE DRAFT
          </button>
          <button type="button" className="commit-registry-btn" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'SAVING...' : 'SAVE LAND'}
          </button>
        </div>
      </div>

      {submitMsg && <div className={`add-land-alert ${submitMsg.type}`}>{submitMsg.text}</div>}

      <LandForm key={formKey} value={formData} onChange={setFormData} onError={showError} />
    </div>
  );
}
