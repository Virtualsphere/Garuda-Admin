import { useState, useEffect, useMemo } from 'react';
import {
  X,
  ShieldCheck,
  PhoneCall,
  PhoneOff,
  Play,
  Pause,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  CalendarClock,
  Building2,
  MapPin,
  Map as MapIcon,
  Table as TableIcon,
} from 'lucide-react';

import PersonAvatar from '../common/PersonAvatar';
import InteractiveMap from '../maps/InteractiveMap';
import useVillageLocations from '../../../hooks/useVillageLocations';
import agentLeadService from '../../../services/agentLeadService';
import callingService from '../../../services/callingService';

const REGIONAL_OFFICES = [
  'Sangareddy Regional Office',
  'Kalwakurthy Regional Office',
  'Nagarkurnool Regional Office',
  'Achampet Regional Office',
  'Hyderabad Head Office',
];

const RESULTS = [
  {
    key: 'Proceed',
    label: 'Interested / Proceed',
    tone: 'border-emerald-500 bg-emerald-50 text-emerald-900',
    hint: 'Closes the escalation and promotes the candidate to Interested.',
  },
  {
    key: 'Follow Up',
    label: 'Follow-up (TL queue)',
    tone: 'border-amber-500 bg-amber-50 text-amber-900',
    hint: 'Books a call-back and leaves the escalation open in your queue.',
  },
  {
    key: 'Return to Telecaller',
    label: 'Return to telecaller',
    tone: 'border-blue-500 bg-blue-50 text-blue-900',
    hint: 'Hands the lead back with your note attached.',
  },
  {
    key: 'Not Interested',
    label: 'Not interested',
    tone: 'border-stone-500 bg-stone-100 text-stone-800',
    hint: 'Closes the escalation and the candidate.',
  },
];

const norm = (v) => String(v || '').trim().toLowerCase();
const addDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Where a team leader works an escalated lead.
 *
 * The escalation carries what the telecaller already did — their note, the
 * recording, when they called — so the TL is not starting cold. Each outcome
 * writes to a different place, which is why they are not one dropdown:
 * Follow Up books a call-back and deliberately leaves the escalation open, so
 * the lead stays in the TL's queue rather than vanishing into a "completed"
 * state nobody is working.
 */
export default function TeamLeaderCallModal({ escalation, onClose, onDone }) {
  const { villages } = useVillageLocations({});

  const lead = escalation?.candidate || {};
  const telecaller = escalation?.telecaller || {};

  const [dialState, setDialState] = useState('idle');
  const [audioPlaying, setAudioPlaying] = useState(false);

  const [result, setResult] = useState('Proceed');
  const [note, setNote] = useState('');
  const [followUpDate, setFollowUpDate] = useState(() => addDays(1));
  const [followUpTime, setFollowUpTime] = useState('11:00 AM');

  const [scheduleVisit, setScheduleVisit] = useState(false);
  const [visitOffice, setVisitOffice] = useState(REGIONAL_OFFICES[0]);
  const [visitDate, setVisitDate] = useState(() => addDays(2));
  const [visitTime, setVisitTime] = useState('11:30 AM');

  const [villageView, setVillageView] = useState('list');
  const [interestedVillage, setInterestedVillage] = useState(lead.village || '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Keyed on the two fields actually read, because `lead` is a fresh `{}` on
  // every render when the escalation carries no candidate.
  const candidateVillages = useMemo(() => {
    const names = new Set();
    if (lead.village) names.add(lead.village);
    (lead.interests || []).forEach((i) => i.village && names.add(i.village));
    return [...names];
  }, [lead.village, lead.interests]);

  const villageByName = useMemo(() => {
    const map = new Map();
    villages.forEach((v) => map.set(norm(v.name), v));
    return map;
  }, [villages]);

  const handleDial = async () => {
    if (!lead.phone) return;
    if (dialState === 'active') {
      setDialState('idle');
      return;
    }
    setDialState('dialing');
    try {
      await callingService.clickToCall({
        customerNumber: lead.phone,
        departmentType: 'agents',
        callerName: lead.name,
        missionContext: `TL escalation — ${lead.name}`,
      });
      setDialState('active');
    } catch {
      setDialState('failed');
    }
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      if (result === 'Follow Up') {
        // The escalation stays Pending on purpose — a booked call-back is
        // still the TL's to work.
        await agentLeadService.logCall({
          leadId: lead.id,
          answerStatus: 'Answered',
          result: 'Follow Up',
          note: note.trim() || undefined,
          followUpDate,
          followUpTime,
        });
        setDone('Call-back booked. The escalation stays in your queue.');
      } else if (result === 'Return to Telecaller') {
        await agentLeadService.resolveEscalation(escalation.id, {
          status: 'ReturnedToTelecaller',
          tlResult: 'Return to Telecaller',
          tlNote: note.trim() || undefined,
        });
        setDone('Returned to the telecaller with your note.');
      } else if (result === 'Not Interested') {
        await agentLeadService.resolveEscalation(escalation.id, {
          status: 'Completed',
          tlResult: 'Not Interested',
          tlNote: note.trim() || undefined,
        });
        await agentLeadService.logCall({
          leadId: lead.id,
          answerStatus: 'Answered',
          result: 'Not Interested',
          note: note.trim() || undefined,
        });
        setDone('Escalation closed and the candidate marked not interested.');
      } else {
        await agentLeadService.resolveEscalation(escalation.id, {
          status: 'Completed',
          tlResult: 'Proceed',
          tlNote: note.trim() || undefined,
        });

        if (scheduleVisit) {
          await agentLeadService.scheduleOfficeVisit({
            candidateId: lead.id,
            regionalOffice: visitOffice,
            visitDate,
            visitTime,
            interestedVillage: interestedVillage || undefined,
          });
          setDone(`Promoted to Interested and booked in to ${visitOffice}.`);
        } else {
          setDone('Promoted to Interested.');
        }
      }

      onDone?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not record that outcome.');
    } finally {
      setSaving(false);
    }
  };

  if (!escalation) return null;

  const canSubmit = result !== 'Follow Up' || Boolean(followUpDate);

  return (
    <div
      className="fixed inset-0 z-[1000] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl border border-stone-200 shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-stone-900 px-5 py-3 text-white flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm">Team leader call workspace</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-stone-900">
                  TL senior support
                </span>
              </div>
              <p className="text-[11px] text-stone-400 truncate">
                Candidate: <strong className="text-white">{lead.name}</strong> ({lead.phone}) ·
                Native: {lead.village || '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleDial}
              disabled={!lead.phone || dialState === 'dialing'}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 ${
                dialState === 'active'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {dialState === 'dialing' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : dialState === 'active' ? (
                <PhoneOff className="w-3.5 h-3.5" />
              ) : (
                <PhoneCall className="w-3.5 h-3.5" />
              )}
              <span>
                {dialState === 'active'
                  ? 'End call'
                  : dialState === 'failed'
                  ? 'Retry call'
                  : 'CALL CANDIDATE'}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-stone-400 hover:text-white p-1 rounded-md hover:bg-stone-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* What the telecaller already did */}
        <div className="bg-amber-50/70 px-5 py-2.5 border-b border-amber-200 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <PersonAvatar
              name={telecaller.name || 'Telecaller'}
              photo={telecaller.photo}
              size="sm"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-stone-900">
                  {telecaller.name || 'Telecaller'}
                </span>
                {telecaller.id && (
                  <span className="text-[10px] px-1.5 rounded bg-amber-200/70 text-amber-900">
                    EMP-{String(telecaller.id).padStart(3, '0')}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-600">
                Escalated{' '}
                <strong>
                  {escalation.forwarded_at
                    ? new Date(escalation.forwarded_at).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                </strong>
                {escalation.call_duration ? ` | Duration: ${escalation.call_duration}` : ''}
              </p>
            </div>
          </div>

          {escalation.call_recording_url ? (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-amber-300">
              <button
                type="button"
                onClick={() => setAudioPlaying(!audioPlaying)}
                className="p-1 rounded bg-amber-500 hover:bg-amber-600 text-stone-900 transition-colors"
              >
                {audioPlaying ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
              </button>
              <div className="text-[11px]">
                <span className="font-semibold text-stone-800 block">
                  {audioPlaying ? 'Playing recording…' : 'Play telecaller call'}
                </span>
                <a
                  href={escalation.call_recording_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-blue-700 hover:underline"
                >
                  Open recording
                </a>
              </div>
              {audioPlaying && (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <audio src={escalation.call_recording_url} autoPlay controls className="h-7" />
              )}
            </div>
          ) : (
            <span className="text-[11px] bg-white/80 px-2.5 py-1 rounded border border-amber-200 text-stone-500">
              No recording attached
            </span>
          )}

          <div
            className="max-w-md text-[11px] bg-white/80 px-2.5 py-1 rounded border border-amber-200 text-stone-700 italic truncate"
            title={escalation.telecaller_note || ''}
          >
            <strong>Note:</strong>{' '}
            {escalation.telecaller_note || 'No note left by the telecaller.'}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {done ? (
            <div className="py-10 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <p className="font-bold text-sm text-stone-900">{done}</p>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-stone-900 text-white font-semibold text-xs"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
              {/* Left: outcome */}
              <div className="lg:col-span-5 space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider block">
                    Team leader call result
                  </label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {RESULTS.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setResult(opt.key)}
                        className={`px-3 py-2 rounded-lg border-2 text-left font-bold transition-all ${
                          result === opt.key
                            ? opt.tone
                            : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                        }`}
                      >
                        <span className="block">{opt.label}</span>
                        <span className="block text-[10px] font-normal opacity-80 mt-0.5">
                          {opt.hint}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {result === 'Follow Up' && (
                  <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/60 space-y-2">
                    <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                      <CalendarClock className="w-3.5 h-3.5" /> Book the call-back
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-stone-500 block mb-0.5">Date</label>
                        <input
                          type="date"
                          value={followUpDate}
                          onChange={(e) => setFollowUpDate(e.target.value)}
                          className="w-full text-xs bg-white border border-stone-200 rounded-lg px-2 py-1.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-stone-500 block mb-0.5">
                          Time slot
                        </label>
                        <input
                          value={followUpTime}
                          onChange={(e) => setFollowUpTime(e.target.value)}
                          placeholder="e.g. 11:00 AM"
                          className="w-full text-xs bg-white border border-stone-200 rounded-lg px-2 py-1.5"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider block mb-1">
                    Team leader note
                  </label>
                  <textarea
                    rows={5}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Summary of the conversation, agreed terms, regional office guidance…"
                    className="w-full text-xs bg-white border border-stone-200 rounded-lg px-2.5 py-2 resize-y"
                  />
                </div>
              </div>

              {/* Right: village + visit */}
              <div className="lg:col-span-7 space-y-3.5">
                <div className="p-3 rounded-xl border border-stone-200 bg-white space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#2563EB]" />
                      Village of interest
                    </span>
                    <div className="inline-flex rounded-lg border border-stone-200 p-0.5 bg-stone-100">
                      <button
                        type="button"
                        onClick={() => setVillageView('list')}
                        className={`px-2 py-0.5 text-[11px] font-semibold rounded-md inline-flex items-center gap-1 ${
                          villageView === 'list'
                            ? 'bg-white text-[#2563EB] shadow-2xs'
                            : 'text-stone-600'
                        }`}
                      >
                        <TableIcon className="w-3 h-3" /> List
                      </button>
                      <button
                        type="button"
                        onClick={() => setVillageView('map')}
                        className={`px-2 py-0.5 text-[11px] font-semibold rounded-md inline-flex items-center gap-1 ${
                          villageView === 'map'
                            ? 'bg-white text-[#2563EB] shadow-2xs'
                            : 'text-stone-600'
                        }`}
                      >
                        <MapIcon className="w-3 h-3" /> Map
                      </button>
                    </div>
                  </div>

                  {villageView === 'map' ? (
                    <InteractiveMap
                      height="260px"
                      villages={villages}
                      showAllotmentColors
                      selectedVillageId={villageByName.get(norm(interestedVillage))?.id}
                      onSelectVillage={(v) => setInterestedVillage(v.name)}
                    />
                  ) : candidateVillages.length === 0 ? (
                    <p className="text-[11px] text-stone-400 py-3 text-center">
                      No village of interest recorded for this candidate.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {candidateVillages.map((name) => {
                        const data = villageByName.get(norm(name));
                        const vac = data?.vacancy ?? 0;
                        const picked = norm(interestedVillage) === norm(name);
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => setInterestedVillage(name)}
                            className={`p-2.5 rounded-lg border text-left transition-all ${
                              picked
                                ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-300'
                                : 'bg-white border-stone-200 hover:border-stone-300'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-xs text-stone-900">{name}</span>
                              <span
                                className={`px-1.5 rounded text-[10px] font-bold ${
                                  vac > 0
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {vac > 0 ? `${vac} open` : 'Full'}
                              </span>
                            </div>
                            <span className="text-[10px] text-stone-500">
                              {data?.mandal || '—'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {result === 'Proceed' && (
                  <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={scheduleVisit}
                        onChange={(e) => setScheduleVisit(e.target.checked)}
                        className="accent-[#2563EB]"
                      />
                      <span className="text-[11px] font-bold text-emerald-900 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        Also book them in to a regional office
                      </span>
                    </label>

                    {scheduleVisit && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="sm:col-span-3">
                          <label className="text-[10px] text-stone-500 block mb-0.5">
                            Office
                          </label>
                          <select
                            value={visitOffice}
                            onChange={(e) => setVisitOffice(e.target.value)}
                            className="w-full text-xs bg-white border border-stone-200 rounded-lg px-2 py-1.5"
                          >
                            {REGIONAL_OFFICES.map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[10px] text-stone-500 block mb-0.5">Date</label>
                          <input
                            type="date"
                            value={visitDate}
                            onChange={(e) => setVisitDate(e.target.value)}
                            className="w-full text-xs bg-white border border-stone-200 rounded-lg px-2 py-1.5"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-stone-500 block mb-0.5">Time</label>
                          <input
                            value={visitTime}
                            onChange={(e) => setVisitTime(e.target.value)}
                            placeholder="11:30 AM"
                            className="w-full text-xs bg-white border border-stone-200 rounded-lg px-2 py-1.5"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {!done && (
          <div className="px-4 py-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-2 shrink-0">
            <span className="text-[11px] text-stone-500 truncate">
              {RESULTS.find((r) => r.key === result)?.hint}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit || saving}
                className="px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-stone-300 disabled:cursor-not-allowed text-white font-bold text-xs inline-flex items-center gap-1.5"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save outcome
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
