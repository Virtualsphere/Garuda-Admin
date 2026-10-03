import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import Modal, {
  ModalError,
  ModalCallout,
  Field,
  inputClass,
  GhostButton,
} from '../common/Modal';
import agentLeadService from '../../../services/agentLeadService';
import {
  REGIONAL_OFFICES,
  DEFAULT_REGIONAL_OFFICE,
  VISIT_TIME_SLOTS as TIME_SLOTS,
} from './recruitmentConstants';

const tomorrowISO = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Book an interested candidate in to a regional office.
 *
 * Re-booking somebody who already has a scheduled visit moves that visit
 * rather than creating a second one — the server does this, so the form says
 * so instead of pretending to create a new booking.
 */
export default function ScheduleVisitModal({ lead, onClose, onDone }) {
  const existing = (lead.officeVisits || []).find((v) => v.status === 'Scheduled');

  const [regionalOffice, setRegionalOffice] = useState(
    existing?.regional_office || DEFAULT_REGIONAL_OFFICE
  );
  const [visitDate, setVisitDate] = useState(existing?.visit_date || tomorrowISO());
  const [visitTime, setVisitTime] = useState(existing?.visit_time || TIME_SLOTS[0]);
  const [interestedVillage, setInterestedVillage] = useState(
    existing?.interested_village || lead.selected_village || ''
  );
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const villageOptions = (lead.interests || []).map((i) => i.village).filter(Boolean);
  const canSave = regionalOffice && visitDate && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await agentLeadService.scheduleOfficeVisit({
        candidateId: lead.id,
        regionalOffice,
        visitDate,
        visitTime: visitTime || undefined,
        interestedVillage: interestedVillage || undefined,
        notes: notes.trim() || undefined,
      });
      onDone?.();
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not schedule this visit.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={existing ? 'Reschedule office visit' : 'Schedule office visit'}
      subtitle={`${lead.name} · ${lead.phone}`}
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-bold hover:bg-[#1d4ed8] disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {existing ? 'Move visit' : 'Schedule visit'}
          </button>
        </>
      }
    >
      <ModalError>{error}</ModalError>

      {existing && (
        <ModalCallout tone="amber">
          This candidate is already booked for{' '}
          <strong>
            {existing.visit_date}
            {existing.visit_time ? ` at ${existing.visit_time}` : ''}
          </strong>{' '}
          at {existing.regional_office}. Saving moves that booking rather than adding a
          second one.
        </ModalCallout>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Regional office" htmlFor="ov-office">
          <select
            id="ov-office"
            value={regionalOffice}
            onChange={(e) => setRegionalOffice(e.target.value)}
            className={inputClass}
          >
            {/* A visit booked before the shared list existed may name an office
                that is not in it; keep it selectable rather than silently swapping it. */}
            {(REGIONAL_OFFICES.includes(regionalOffice)
              ? REGIONAL_OFFICES
              : [regionalOffice, ...REGIONAL_OFFICES]
            ).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Village they want" htmlFor="ov-village">
          {villageOptions.length > 0 ? (
            <select
              id="ov-village"
              value={interestedVillage}
              onChange={(e) => setInterestedVillage(e.target.value)}
              className={inputClass}
            >
              <option value="">Not decided yet</option>
              {villageOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="ov-village"
              type="text"
              value={interestedVillage}
              onChange={(e) => setInterestedVillage(e.target.value)}
              placeholder="No villages linked yet"
              className={inputClass}
            />
          )}
        </Field>

        <Field label="Visit date" htmlFor="ov-date">
          <input
            id="ov-date"
            type="date"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Time slot" htmlFor="ov-time">
          <select
            id="ov-time"
            value={visitTime}
            onChange={(e) => setVisitTime(e.target.value)}
            className={inputClass}
          >
            {TIME_SLOTS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Notes" htmlFor="ov-notes">
        <textarea
          id="ov-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What should they bring? Anything the office should know?"
          className={`${inputClass} resize-y`}
        />
      </Field>
    </Modal>
  );
}
