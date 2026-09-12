import { useState, useMemo } from 'react';
import { Loader2 } from 'lucide-react';

import Modal, { ModalError, Field, inputClass, GhostButton } from '../common/Modal';
import useLocations from '../../../hooks/useLocations';
import recruitmentService from '../../../services/recruitmentService';
import { LEAD_SOURCES } from '../agentConstants';

const nameById = (list, id) => list.find((x) => String(x.id) === String(id))?.name || '';

/**
 * Add one recruitment lead.
 *
 * A lead starts unattached — no squad, no telecaller — so it lands in the
 * Allot Leads queue rather than silently becoming somebody's work.
 */
export default function AddLeadModal({ onClose, onSaved }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState(LEAD_SOURCES[0]);
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
      lead_source: source,
      notes: notes.trim() || undefined,
      state: nameById(states, selectedState),
      district: nameById(districts, selectedDistrict),
      mandal: nameById(mandals, selectedMandal),
      village: nameById(villages, selectedVillage),
    }),
    [
      name,
      phone,
      source,
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

  const canSave = payload.name && payload.phone && !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;

    setSaving(true);
    setError(null);
    try {
      await recruitmentService.createCandidate(payload);
      onSaved?.(payload.name);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create this lead. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Add lead"
      subtitle="New candidate for the agent recruitment pipeline"
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <button
            type="submit"
            form="add-lead-form"
            disabled={!canSave}
            className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-bold hover:bg-[#1D4ED8] disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Add lead
          </button>
        </>
      }
    >
      <form id="add-lead-form" onSubmit={handleSubmit} className="space-y-4">
        <ModalError>{error}</ModalError>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Candidate name" htmlFor="al-name">
            <input
              id="al-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              autoComplete="off"
              className={inputClass}
            />
          </Field>

          <Field label="Phone" htmlFor="al-phone">
            <input
              id="al-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit mobile"
              inputMode="numeric"
              autoComplete="off"
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Source" htmlFor="al-source">
          <div className="flex flex-wrap gap-1.5">
            {LEAD_SOURCES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSource(s)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  source === s
                    ? 'bg-[#2563EB] border-[#2563EB] text-white'
                    : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="State" htmlFor="al-state">
            <select
              id="al-state"
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

          <Field label="District" htmlFor="al-district">
            <select
              id="al-district"
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

          <Field label="Mandal" htmlFor="al-mandal">
            <select
              id="al-mandal"
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

          <Field label="Native village" htmlFor="al-village">
            <select
              id="al-village"
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

        <Field label="Notes" htmlFor="al-notes">
          <textarea
            id="al-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything the caller should know"
            className={`${inputClass} resize-y`}
          />
        </Field>
      </form>
    </Modal>
  );
}
