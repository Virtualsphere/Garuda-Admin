import { useState } from 'react';
import { Phone, Loader2, ArrowUpRight, UserRound } from 'lucide-react';

import Modal, {
  ModalError,
  ModalCallout,
  Field,
  inputClass,
  GhostButton,
} from '../common/Modal';
import agentLeadService from '../../../services/agentLeadService';
import callingService from '../../../services/callingService';

const ANSWER_STATUSES = [
  'Answered',
  'Not Lifted',
  'No Answer',
  'Busy / Call Later',
  'Invalid Number',
];

// Where a lead can be handed on when the agents desk is not the right home
// for them. The server records the choice on the candidate, so it has to be a
// real department name rather than free text.
const DIVERT_DEPARTMENTS = ['Farmers', 'Land', 'Buyers', 'Call Center'];

const RESULTS = [
  { key: 'Proceed', label: 'Proceed — interested', tone: 'emerald' },
  { key: 'Follow Up', label: 'Follow up — call back', tone: 'amber' },
  { key: 'Not Interested', label: 'Not interested — close', tone: 'rose' },
  { key: 'Divert', label: 'Divert — wrong department', tone: 'stone' },
];

const RESULT_TONES = {
  emerald: 'bg-emerald-50 border-emerald-300 text-emerald-800',
  amber: 'bg-amber-50 border-amber-300 text-amber-900',
  rose: 'bg-rose-50 border-rose-300 text-rose-800',
  stone: 'bg-stone-50 border-stone-300 text-stone-700',
};

const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * The call workspace: place the call, then record what happened.
 *
 * The result is what moves the lead — Proceed promotes it to Interested,
 * Not Interested closes it, Follow Up schedules the call-back (the server
 * requires a date for that, so the form does too). Escalating instead hands
 * the lead to a team leader without recording an outcome.
 */
export default function CallWorkspaceModal({ lead, queue = 'first-call', onClose, onDone }) {
  const [answerStatus, setAnswerStatus] = useState('Answered');
  const [result, setResult] = useState('');
  const [note, setNote] = useState('');
  const [followUpDate, setFollowUpDate] = useState(todayISO());
  const [followUpTime, setFollowUpTime] = useState('');
  const [divertTo, setDivertTo] = useState(DIVERT_DEPARTMENTS[0]);

  const [dialState, setDialState] = useState('idle');
  const [saving, setSaving] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [error, setError] = useState(null);

  // Only a connected call has an outcome to record; the rest are just attempts.
  const connected = answerStatus === 'Answered';
  const needsFollowUpDate = result === 'Follow Up';
  const isDivert = result === 'Divert';
  const canSave =
    answerStatus &&
    (!needsFollowUpDate || followUpDate) &&
    (!isDivert || divertTo) &&
    !saving;

  const handleDial = async () => {
    if (!lead.phone) return;
    setDialState('dialing');
    try {
      await callingService.clickToCall({
        customerNumber: lead.phone,
        departmentType: 'agents',
        callerName: lead.name,
        missionContext: `Agent lead — ${lead.name} (${lead.village || 'unknown village'})`,
      });
      setDialState('placed');
    } catch (err) {
      console.error('Click-to-call failed:', err);
      setDialState('failed');
    }
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await agentLeadService.logCall({
        leadId: lead.id,
        queue,
        answerStatus,
        result: connected ? result || undefined : undefined,
        note: note.trim() || undefined,
        followUpDate: needsFollowUpDate ? followUpDate : undefined,
        followUpTime: needsFollowUpDate ? followUpTime || undefined : undefined,
        divertToDepartment: isDivert ? divertTo : undefined,
      });
      onDone?.();
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not record this call. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEscalate = async () => {
    setEscalating(true);
    setError(null);
    try {
      await agentLeadService.escalate({
        leadId: lead.id,
        note: note.trim() || 'Escalated from the call workspace',
      });
      onDone?.();
      onClose?.();
    } catch (err) {
      // 409 when the lead is already with a team leader — worth saying plainly.
      setError(err.response?.data?.message || 'Could not escalate this lead.');
    } finally {
      setEscalating(false);
    }
  };

  return (
    <Modal
      title="Call workspace"
      subtitle={`${lead.name} · ${lead.phone}`}
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <button
            type="button"
            onClick={handleEscalate}
            disabled={escalating || saving}
            className="px-3.5 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-xs font-bold hover:bg-amber-100 disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            {escalating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowUpRight className="w-3.5 h-3.5" />
            )}
            Escalate to TL
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-bold hover:bg-[#1d4ed8] disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save outcome'}
          </button>
        </>
      }
    >
      <ModalError>{error}</ModalError>

      {/* Who we are calling */}
      <div className="flex items-center gap-3 p-3 bg-stone-50 border border-stone-200 rounded-lg">
        {lead.photo ? (
          <img src={lead.photo} alt={lead.name} className="w-11 h-11 rounded-full object-cover" />
        ) : (
          <div className="w-11 h-11 rounded-full bg-stone-200 text-stone-600 flex items-center justify-center">
            <UserRound className="w-5 h-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm text-stone-900">{lead.name}</div>
          <div className="text-xs text-stone-500">
            {lead.village || '—'}, {lead.mandal || '—'} · {lead.district || '—'}
          </div>
          {lead.last_call_note && (
            <div className="text-[11px] text-stone-500 mt-1 italic">
              Last note: {lead.last_call_note}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleDial}
          disabled={!lead.phone || dialState === 'dialing'}
          className={`px-3 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 border transition-colors disabled:opacity-40 ${
            dialState === 'placed'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : dialState === 'failed'
              ? 'bg-rose-50 border-rose-300 text-rose-700'
              : 'bg-[#2563EB] border-[#2563EB] text-white hover:bg-[#1d4ed8]'
          }`}
        >
          {dialState === 'dialing' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Phone className="w-3.5 h-3.5" />
          )}
          {dialState === 'dialing'
            ? 'Dialling…'
            : dialState === 'placed'
            ? 'Call placed'
            : dialState === 'failed'
            ? 'Retry'
            : 'Call now'}
        </button>
      </div>

      {/* Outcome */}
      <Field label="Did they answer?" htmlFor="cw-answer">
        <div className="flex flex-wrap gap-1.5">
          {ANSWER_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                setAnswerStatus(status);
                if (status !== 'Answered') setResult('');
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                answerStatus === status
                  ? 'bg-[#2563EB] border-[#2563EB] text-white'
                  : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </Field>

      {connected ? (
        <Field label="What was decided?" htmlFor="cw-result">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {RESULTS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setResult(r.key)}
                className={`px-2.5 py-2 rounded-lg text-xs font-semibold border text-left transition-colors ${
                  result === r.key
                    ? RESULT_TONES[r.tone]
                    : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </Field>
      ) : (
        <ModalCallout tone="amber">
          An unanswered call is still recorded as an attempt — the lead stays in the
          queue and its attempt count goes up.
        </ModalCallout>
      )}

      {needsFollowUpDate && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Call back on" htmlFor="cw-fu-date">
            <input
              id="cw-fu-date"
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="At (optional)" htmlFor="cw-fu-time">
            <input
              id="cw-fu-time"
              type="text"
              value={followUpTime}
              onChange={(e) => setFollowUpTime(e.target.value)}
              placeholder="e.g. 11:00 AM"
              className={inputClass}
            />
          </Field>
        </div>
      )}

      {isDivert && (
        <Field label="Divert this lead to" htmlFor="cw-divert">
          <select
            id="cw-divert"
            value={divertTo}
            onChange={(e) => setDivertTo(e.target.value)}
            className={inputClass}
          >
            {DIVERT_DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-[#78716c] mt-1">
            The agents desk closes the lead as diverted and records where it went — the
            receiving department picks it up from their own queue.
          </p>
        </Field>
      )}

      <Field label="Call note" htmlFor="cw-note">
        <textarea
          id="cw-note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What did they say?"
          className={`${inputClass} resize-y`}
        />
      </Field>
    </Modal>
  );
}
