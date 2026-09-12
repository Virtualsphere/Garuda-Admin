import { useState, useEffect, useMemo } from 'react';
import agentService from '../../services/agentService';
import useLocations from '../../hooks/useLocations';
import Modal, {
  ModalError,
  Field,
  inputClass,
  GhostButton,
  PrimaryButton,
} from './common/Modal';
import { AGENT_CODE } from './agentConstants';

// The agent table stores location *names*, while the selects hold ids —
// resolve one to the other before every read and write.
const nameById = (list, id) => list.find((x) => String(x.id) === String(id))?.name || '';
const idByName = (list, name) =>
  name
    ? String(
        list.find((x) => (x.name || '').toLowerCase() === String(name).toLowerCase())?.id || ''
      )
    : '';

export default function AgentFormModal({ agent, onClose, onSaved }) {
  const isEdit = Boolean(agent?.id);

  const [name, setName] = useState(agent?.name || '');
  const [phone, setPhone] = useState(agent?.phone || '');
  const [photo, setPhoto] = useState(agent?.photo || '');
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

  // Seed the cascade from the agent's stored names, one level at a time as
  // each list arrives. Each effect is a no-op once its level is already set.
  useEffect(() => {
    if (!isEdit || selectedState || !states.length) return;
    const id = idByName(states, agent.state);
    if (id) setSelectedState(id);
  }, [isEdit, agent, states, selectedState, setSelectedState]);

  useEffect(() => {
    if (!isEdit || selectedDistrict || !districts.length) return;
    const id = idByName(districts, agent.district);
    if (id) setSelectedDistrict(id);
  }, [isEdit, agent, districts, selectedDistrict, setSelectedDistrict]);

  useEffect(() => {
    if (!isEdit || selectedMandal || !mandals.length) return;
    const id = idByName(mandals, agent.mandal);
    if (id) setSelectedMandal(id);
  }, [isEdit, agent, mandals, selectedMandal, setSelectedMandal]);

  useEffect(() => {
    if (!isEdit || selectedVillage || !villages.length) return;
    const id = idByName(villages, agent.village);
    if (id) setSelectedVillage(id);
  }, [isEdit, agent, villages, selectedVillage, setSelectedVillage]);

  const payload = useMemo(
    () => ({
      name: name.trim(),
      phone: phone.trim(),
      photo: photo.trim() || undefined,
      state: nameById(states, selectedState),
      district: nameById(districts, selectedDistrict),
      mandal: nameById(mandals, selectedMandal),
      village: nameById(villages, selectedVillage),
    }),
    [
      name,
      phone,
      photo,
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

  // Mandal is the backend's required field — it rejects the create without one.
  const canSave = payload.name && payload.phone && payload.mandal && !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;

    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await agentService.update(agent.id, payload);
      } else {
        await agentService.create(payload);
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      // The backend returns its refusal reason in `message` — e.g. the
      // "Mandal is FULL" capacity rule. Show it rather than a generic failure.
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          (isEdit
            ? 'Could not save this agent. Try again.'
            : 'Could not create this agent. Try again.')
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isEdit ? 'Edit agent' : 'Enlist agent'}
      subtitle={
        isEdit ? `${AGENT_CODE(agent.id)} — personnel record` : 'New personnel record'
      }
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" form="agent-form" disabled={!canSave}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Enlist agent'}
          </PrimaryButton>
        </>
      }
    >
      <form id="agent-form" onSubmit={handleSubmit} className="space-y-4">
        <ModalError>{error}</ModalError>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Full name" htmlFor="afm-name">
            <input
              id="afm-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Agent name"
              autoComplete="off"
              className={inputClass}
            />
          </Field>

          <Field label="Phone" htmlFor="afm-phone">
            <input
              id="afm-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit number"
              inputMode="numeric"
              autoComplete="off"
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="State" htmlFor="afm-state">
            <select
              id="afm-state"
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              disabled={locationsLoading.states}
              className={inputClass}
            >
              <option value="">
                {locationsLoading.states ? 'Loading…' : 'Select state'}
              </option>
              {states.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="District" htmlFor="afm-district">
            <select
              id="afm-district"
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              disabled={!selectedState || locationsLoading.districts}
              className={inputClass}
            >
              <option value="">
                {locationsLoading.districts ? 'Loading…' : 'Select district'}
              </option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            label="Mandal"
            htmlFor="afm-mandal"
            hint="Required — the backend rejects an agent without one"
          >
            <select
              id="afm-mandal"
              value={selectedMandal}
              onChange={(e) => setSelectedMandal(e.target.value)}
              disabled={!selectedDistrict || locationsLoading.mandals}
              className={inputClass}
            >
              <option value="">
                {locationsLoading.mandals ? 'Loading…' : 'Select mandal'}
              </option>
              {mandals.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Home village" htmlFor="afm-village">
            <select
              id="afm-village"
              value={selectedVillage}
              onChange={(e) => setSelectedVillage(e.target.value)}
              disabled={!selectedMandal || locationsLoading.villages}
              className={inputClass}
            >
              <option value="">
                {locationsLoading.villages ? 'Loading…' : 'Select village'}
              </option>
              {villages.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Photo URL" htmlFor="afm-photo" hint="Optional — shown on the map's identity bubbles">
          <input
            id="afm-photo"
            value={photo}
            onChange={(e) => setPhoto(e.target.value)}
            placeholder="https://…"
            autoComplete="off"
            className={inputClass}
          />
        </Field>
      </form>
    </Modal>
  );
}
