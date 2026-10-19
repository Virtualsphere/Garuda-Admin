import React, { useState, useEffect } from 'react';
import landService from '../../services/landService';
import LandForm from './LandForm';
import { landToForm, formToPayload, landCode } from '../../utils/landRecord';
import './AddLandForm.css';

// Values mirror the backend ENUMs — only phone verification can be rejected.
const STATUS_FIELDS = [
  { key: 'call_verification_status', label: 'Phone verification', values: ['pending', 'complete', 'rejected'] },
  { key: 'physcial_verification_status', label: 'Physical verification', values: ['pending', 'complete'] },
  { key: 'verification_status', label: 'Final verification', values: ['pending', 'complete'] },
];

/**
 * Edit one land from a verification queue.
 *
 * Always re-fetches `GET /land/:id`: queue endpoints omit relations (trees,
 * sheds), and saving without them would wipe them. Each queue passes its own
 * `actions`; an action's `overrides` set the verification statuses that move
 * the land to the next queue, and `via: 'callVerify'` routes the save through
 * the permission-gated call-verification endpoint.
 *
 * @param {{
 *   landId: number|string,
 *   heading: string,
 *   actions: {key: string, label: string, overrides?: object, via?: 'update'|'callVerify', primary?: boolean, successText: string}[],
 *   showStatusFields?: boolean,
 *   onBack: () => void,
 *   onDone: (actionKey: string) => void,
 *   onDelete?: () => void,
 * }} props
 */
export default function LandEditor({ landId, heading, actions, showStatusFields, onBack, onDone, onDelete }) {
  const [formData, setFormData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [busyAction, setBusyAction] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setFormData(null);
    setLoadError(null);
    landService
      .getById(landId)
      .then((data) => {
        if (cancelled) return;
        const land = data.data || data;
        setFormData(landToForm(land));
      })
      .catch((err) => {
        console.error('Failed to load land:', err);
        if (!cancelled) setLoadError(err.response?.data?.message || 'Could not load this land.');
      });
    return () => { cancelled = true; };
  }, [landId]);

  const runAction = async (action) => {
    setBusyAction(action.key);
    setMessage(null);
    try {
      const payload = formToPayload(formData, action.overrides || {});
      if (action.via === 'callVerify') await landService.callVerify(landId, payload);
      else await landService.update(landId, payload);
      onDone(action.key, action.successText);
    } catch (err) {
      console.error(`Land action "${action.key}" failed:`, err);
      const status = err.response?.status;
      const text = status === 403
        ? 'You do not have permission for this action.'
        : err.response?.data?.message || 'Failed to save the land.';
      setMessage({ type: 'error', text });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="add-land-form-container">
      <div className="add-land-header">
        <div className="add-land-title-group">
          <button type="button" className="land-editor-back" onClick={onBack}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back to list
          </button>
          <span className="add-land-title">{heading}</span>
          <span className="add-land-subtitle">
            {formData ? `${landCode({ id: landId })} • ${formData.farmerDetails?.name || 'Unnamed farmer'} • ${[formData.village, formData.mandal, formData.district].filter(Boolean).join(', ')}` : 'Loading record...'}
          </span>
        </div>
        <div className="add-land-header-actions">
          {onDelete && (
            <button type="button" className="save-draft-btn land-editor-delete" onClick={onDelete} disabled={!!busyAction}>
              DELETE
            </button>
          )}
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              className={action.primary ? 'commit-registry-btn' : 'save-draft-btn'}
              onClick={() => runAction(action)}
              disabled={!formData || !!busyAction}
            >
              {busyAction === action.key ? 'SAVING...' : action.label}
            </button>
          ))}
        </div>
      </div>

      {message && <div className={`add-land-alert ${message.type}`}>{message.text}</div>}
      {loadError && <div className="add-land-alert error">{loadError}</div>}
      {!formData && !loadError && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading land...</div>
      )}

      {formData && showStatusFields && (
        <div className="land-editor-status">
          {STATUS_FIELDS.map(({ key, label, values }) => (
            <div key={key} className="form-group">
              <label className="form-label">{label}</label>
              <select
                className="form-select"
                value={formData[key] || 'pending'}
                onChange={(e) => setFormData((prev) => ({ ...prev, [key]: e.target.value }))}
              >
                {values.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      {formData && (
        <LandForm value={formData} onChange={setFormData} onError={(text) => setMessage({ type: 'error', text })} />
      )}
    </div>
  );
}
