import { useState, useMemo } from 'react';
import recruitmentService from '../../../services/recruitmentService';
import useLocations from '../../../hooks/useLocations';
import { LEAD_SOURCES } from './recruitmentConstants';
import Modal, {
  ModalError,
  ModalCallout,
  Field,
  inputClass,
  GhostButton,
  PrimaryButton,
} from '../common/Modal';

const nameById = (list, id) => list.find((x) => String(x.id) === String(id))?.name || '';

/**
 * Log a new recruitment candidate.
 *
 * `initialVillage` is the village the map was sitting on when Add was pressed.
 * The cascading selects hold ids, so it cannot preselect them — it is carried
 * through as the candidate's village unless the operator picks one, which is
 * what makes "add a candidate for THIS village" work straight off the map.
 */
export default function AddCandidateModal({ initialVillage, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [leadSource, setLeadSource] = useState('DIRECT');
  const [notes, setNotes] = useState('');
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

  const payload = useMemo(
    () => ({
      name: name.trim(),
      phone: phone.trim(),
      alternate_phone: altPhone.trim() || undefined,
      lead_source: leadSource,
      notes: notes.trim() || undefined,
      state: nameById(states, selectedState),
      district: nameById(districts, selectedDistrict),
      mandal: nameById(mandals, selectedMandal),
      // An explicit pick always wins over the village the map came in on.
      village: nameById(villages, selectedVillage) || initialVillage || '',
    }),
    [
      name,
      phone,
      altPhone,
      leadSource,
      notes,
      states,
      districts,
      mandals,
      villages,
      selectedState,
      selectedDistrict,
      selectedMandal,
      selectedVillage,
      initialVillage,
    ]
  );

  const canSave = payload.name && payload.phone && !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;

    setSaving(true);
    setError(null);
    try {
      await recruitmentService.createCandidate(payload);
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create this candidate. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Add candidate"
      subtitle="New lead for the agent recruitment pipeline"
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" form="add-candidate-form" disabled={!canSave}>
            {saving ? 'Saving…' : 'Add candidate'}
          </PrimaryButton>
        </>
      }
    >
      <form id="add-candidate-form" onSubmit={handleSubmit} className="space-y-4">
        <ModalError>{error}</ModalError>

        {initialVillage && !nameById(villages, selectedVillage) && (
          <ModalCallout>
            This candidate will be registered as native to <strong>{initialVillage}</strong>.
            Pick a village below to change that.
          </ModalCallout>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Full name" htmlFor="cand-name">
            <input
              id="cand-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Candidate name"
              className={inputClass}
            />
          </Field>

          <Field label="Phone" htmlFor="cand-phone">
            <input
              id="cand-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit mobile"
              className={inputClass}
            />
          </Field>

          <Field label="Alternate phone" htmlFor="cand-alt">
            <input
              id="cand-alt"
              type="tel"
              value={altPhone}
              onChange={(e) => setAltPhone(e.target.value)}
              placeholder="Optional"
              className={inputClass}
            />
          </Field>

          <Field label="Lead source" htmlFor="cand-source">
            <select
              id="cand-source"
              value={leadSource}
              onChange={(e) => setLeadSource(e.target.value)}
              className={inputClass}
            >
              {LEAD_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {source.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="State" htmlFor="cand-state">
            <select
              id="cand-state"
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

          <Field label="District" htmlFor="cand-district">
            <select
              id="cand-district"
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

          <Field label="Mandal" htmlFor="cand-mandal">
            <select
              id="cand-mandal"
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

          <Field label="Village" htmlFor="cand-village">
            <select
              id="cand-village"
              value={selectedVillage}
              onChange={(e) => setSelectedVillage(e.target.value)}
              disabled={!selectedMandal || locationsLoading.villages}
              className={inputClass}
            >
              <option value="">
                {locationsLoading.villages ? 'Loading…' : initialVillage || 'Select'}
              </option>
              {villages.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Notes" htmlFor="cand-notes">
          <textarea
            id="cand-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything the desk should know on the first call"
            className={`${inputClass} resize-y`}
          />
        </Field>
      </form>
    </Modal>
  );
}
