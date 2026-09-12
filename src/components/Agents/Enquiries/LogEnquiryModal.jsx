import { useState, useEffect, useMemo } from 'react';
import { UserCheck, Loader2 } from 'lucide-react';

import Modal, {
  ModalError,
  ModalCallout,
  Field,
  inputClass,
  GhostButton,
  PrimaryButton,
} from '../common/Modal';
import useLocations from '../../../hooks/useLocations';
import agentEnquiryService from '../../../services/agentEnquiryService';
import { ENQUIRY_CALLER_TYPES, ENQUIRY_TYPES } from '../agentConstants';

const nameById = (list, id) => list.find((x) => String(x.id) === String(id))?.name || '';

/**
 * Log an inbound call to the agents desk.
 *
 * As soon as a full number is typed the desk is told who is calling — the same
 * lookup the server runs on save, surfaced early so a known agent or candidate
 * is never re-entered as a new person.
 */
export default function LogEnquiryModal({ onClose, onSaved }) {
  const [callerName, setCallerName] = useState('');
  const [callerPhone, setCallerPhone] = useState('');
  const [callerType, setCallerType] = useState('NEW_CANDIDATE');
  const [enquiryType, setEnquiryType] = useState('BECOME_AGENT');
  const [preferredVillage, setPreferredVillage] = useState('');
  const [notes, setNotes] = useState('');

  const [match, setMatch] = useState(null);
  const [matching, setMatching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const {
    states,
    districts,
    mandals,
    villages,
    selectedState,
    selectedDistrict,
    selectedMandal,
    selectedVillage,
    setSelectedState,
    setSelectedDistrict,
    setSelectedMandal,
    setSelectedVillage,
    loading: locationsLoading,
  } = useLocations();

  // Only the last 10 digits identify a caller, so the lookup waits for them.
  const digits = callerPhone.replace(/\D/g, '');

  useEffect(() => {
    if (digits.length < 10) {
      setMatch(null);
      return undefined;
    }

    let cancelled = false;
    // Debounced so typing the last digits does not fire a request each keystroke.
    const timer = setTimeout(async () => {
      setMatching(true);
      try {
        const data = await agentEnquiryService.matchCaller(digits);
        if (cancelled) return;
        const result = data.result ?? data.data ?? null;
        setMatch(result);

        // Pre-fill from whoever we already know, without overwriting typing.
        if (result?.matched_record) {
          setCallerName((prev) => prev || result.matched_record.name || '');
          setCallerType(
            result.matched_record_type === 'MASTER_AGENT'
              ? 'EXISTING_AGENT'
              : 'EXISTING_CANDIDATE'
          );
        }
      } catch (err) {
        // A failed lookup must not block logging the call.
        console.error('Caller lookup failed:', err);
        if (!cancelled) setMatch(null);
      } finally {
        if (!cancelled) setMatching(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [digits]);

  const payload = useMemo(
    () => ({
      callerName: callerName.trim(),
      callerPhone: callerPhone.trim(),
      callerType,
      enquiryType,
      state: nameById(states, selectedState) || undefined,
      district: nameById(districts, selectedDistrict) || undefined,
      mandal: nameById(mandals, selectedMandal) || undefined,
      village: nameById(villages, selectedVillage) || undefined,
      preferredVillage: preferredVillage.trim() || undefined,
      notes: notes.trim() || undefined,
    }),
    [
      callerName,
      callerPhone,
      callerType,
      enquiryType,
      preferredVillage,
      notes,
      states,
      districts,
      mandals,
      villages,
      selectedState,
      selectedDistrict,
      selectedMandal,
      selectedVillage,
    ]
  );

  const canSave = payload.callerName && payload.callerPhone && !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;

    setSaving(true);
    setError(null);
    try {
      await agentEnquiryService.create(payload);
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not log this enquiry. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Log incoming enquiry"
      subtitle="Capture the call before it leaves the desk"
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" form="log-enquiry-form" disabled={!canSave}>
            {saving ? 'Saving…' : 'Log enquiry'}
          </PrimaryButton>
        </>
      }
    >
      <form id="log-enquiry-form" onSubmit={handleSubmit} className="space-y-4">
        <ModalError>{error}</ModalError>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Caller phone" htmlFor="enq-phone">
            <div className="relative">
              <input
                id="enq-phone"
                type="tel"
                value={callerPhone}
                onChange={(e) => setCallerPhone(e.target.value)}
                placeholder="10-digit mobile"
                className={inputClass}
              />
              {matching && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2563EB] absolute right-3 top-1/2 -translate-y-1/2" />
              )}
            </div>
          </Field>

          <Field label="Caller name" htmlFor="enq-name">
            <input
              id="enq-name"
              type="text"
              value={callerName}
              onChange={(e) => setCallerName(e.target.value)}
              placeholder="Who is calling?"
              className={inputClass}
            />
          </Field>
        </div>

        {match?.matched_record && (
          <ModalCallout>
            <span className="flex items-start gap-2">
              <UserCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                This number belongs to{' '}
                <strong>{match.matched_record.name}</strong> —{' '}
                {match.matched_record_type === 'MASTER_AGENT'
                  ? 'an appointed agent'
                  : 'an existing recruitment candidate'}
                {match.matched_record.village ? ` from ${match.matched_record.village}` : ''}.
                {match.matched_record_type === 'MASTER_AGENT' &&
                  ' This enquiry cannot be converted into a new lead.'}
              </span>
            </span>
          </ModalCallout>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Caller type" htmlFor="enq-caller-type">
            <select
              id="enq-caller-type"
              value={callerType}
              onChange={(e) => setCallerType(e.target.value)}
              className={inputClass}
            >
              {ENQUIRY_CALLER_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="What do they want?" htmlFor="enq-type">
            <select
              id="enq-type"
              value={enquiryType}
              onChange={(e) => setEnquiryType(e.target.value)}
              className={inputClass}
            >
              {ENQUIRY_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="State" htmlFor="enq-state">
            <select
              id="enq-state"
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              disabled={locationsLoading.states}
              className={inputClass}
            >
              <option value="">{locationsLoading.states ? 'Loading…' : 'Select'}</option>
              {states.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="District" htmlFor="enq-district">
            <select
              id="enq-district"
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              disabled={!selectedState || locationsLoading.districts}
              className={inputClass}
            >
              <option value="">{locationsLoading.districts ? 'Loading…' : 'Select'}</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Mandal" htmlFor="enq-mandal">
            <select
              id="enq-mandal"
              value={selectedMandal}
              onChange={(e) => setSelectedMandal(e.target.value)}
              disabled={!selectedDistrict || locationsLoading.mandals}
              className={inputClass}
            >
              <option value="">{locationsLoading.mandals ? 'Loading…' : 'Select'}</option>
              {mandals.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Village" htmlFor="enq-village">
            <select
              id="enq-village"
              value={selectedVillage}
              onChange={(e) => setSelectedVillage(e.target.value)}
              disabled={!selectedMandal || locationsLoading.villages}
              className={inputClass}
            >
              <option value="">{locationsLoading.villages ? 'Loading…' : 'Select'}</option>
              {villages.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          label="Preferred village"
          htmlFor="enq-pref"
          hint="Where they want to work, if it differs from where they live"
        >
          <input
            id="enq-pref"
            type="text"
            value={preferredVillage}
            onChange={(e) => setPreferredVillage(e.target.value)}
            placeholder="Optional"
            className={inputClass}
          />
        </Field>

        <Field label="Notes" htmlFor="enq-notes">
          <textarea
            id="enq-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What was said on the call?"
            className={`${inputClass} resize-y`}
          />
        </Field>
      </form>
    </Modal>
  );
}
