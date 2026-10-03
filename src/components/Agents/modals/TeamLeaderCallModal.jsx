import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  PhoneCall,
  PhoneOff,
  Clock,
  Play,
  Pause,
  Building2,
  X,
  ShieldCheck,
  Check,
  RotateCcw,
  Calendar,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

import PersonAvatar from '../common/PersonAvatar';
import HierarchyLocationSelector from '../common/HierarchyLocationSelector';
import InteractiveMap from '../maps/InteractiveMap';
import useVillageLocations from '../../../hooks/useVillageLocations';
import useCallAudio from '../../../hooks/useCallAudio';
import { useAuth } from '../../../context/AuthContext';
import agentLeadService from '../../../services/agentLeadService';
import recruitmentService from '../../../services/recruitmentService';
import callingService from '../../../services/callingService';
import { errorMessage } from '../../../utils/apiErrors';
import { stampOf } from '../Recruitment/recruitmentModel';
import {
  REGIONAL_OFFICES,
  DEFAULT_REGIONAL_OFFICE,
} from '../Recruitment/recruitmentConstants';

const RESULTS = [
  {
    key: 'Proceed',
    label: 'Interested / Proceed',
    tone: 'border-emerald-500 bg-emerald-50 text-emerald-900',
    hint: 'Closes the escalation and promotes the candidate to Interested.',
  },
  {
    key: 'Follow Up',
    label: 'Follow-up (TL Queue)',
    tone: 'border-amber-500 bg-amber-50 text-amber-900',
    hint: 'Books a call-back and leaves the escalation open in your queue.',
  },
  {
    key: 'Return to Telecaller',
    label: 'Return to Telecaller',
    tone: 'border-blue-500 bg-blue-50 text-blue-900',
    hint: 'Hands the lead back with your note attached.',
  },
  {
    key: 'Not Interested',
    label: 'Not Interested',
    tone: 'border-stone-500 bg-stone-100 text-stone-800',
    hint: 'Closes the escalation and the candidate.',
  },
];

const EMPTY = [];
const norm = (v) => String(v || '').trim().toLowerCase();
const empCode = (id) => `EMP-${String(id).padStart(3, '0')}`;
const mmss = (total) =>
  `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
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
 *
 * The office visit is queued, not booked on the spot: Proceed resolves the case
 * (which sets the candidate INTERESTED) and the visit then moves them on to
 * OFFICE_VISIT. Booking first would be undone by the resolve.
 */
export default function TeamLeaderCallModal({ escalation, onClose, onDone }) {
  const { user } = useAuth();
  const { villages } = useVillageLocations({});
  const audio = useCallAudio();

  const lead = escalation?.candidate;
  const telecaller = escalation?.telecaller;

  const [dialState, setDialState] = useState('idle');
  const [seconds, setSeconds] = useState(0);

  const [result, setResult] = useState('Proceed');
  const [note, setNote] = useState('');
  const [followUpDate, setFollowUpDate] = useState(() => addDays(1));
  const [followUpTime, setFollowUpTime] = useState('11:00 AM');

  const [visitQueued, setVisitQueued] = useState(false);
  const [visitOffice, setVisitOffice] = useState(DEFAULT_REGIONAL_OFFICE);
  const [visitDate, setVisitDate] = useState(() => addDays(2));
  const [visitTime, setVisitTime] = useState('11:30 AM');

  const [detail, setDetail] = useState(null);
  const [nativeVillage, setNativeVillage] = useState(lead?.village || '');
  const [place, setPlace] = useState({
    state: lead?.state || '',
    district: lead?.district || '',
    mandal: lead?.mandal || '',
  });
  const [browsedVillage, setBrowsedVillage] = useState(null);
  const [showMap, setShowMap] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  const loadDetail = useCallback(async () => {
    if (!lead?.id) return;
    try {
      const data = await agentLeadService.getLead(lead.id);
      setDetail(data.result || data.data || null);
    } catch (err) {
      console.error('Failed to load lead detail:', err);
    }
  }, [lead?.id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tickRef = useRef(null);
  useEffect(() => {
    if (dialState !== 'active') return undefined;
    tickRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(tickRef.current);
  }, [dialState]);

  const interests = detail?.interests || lead?.interests || EMPTY;
  const interestedVillages = useMemo(
    () => [...new Set(interests.map((i) => i.village).filter(Boolean))],
    [interests]
  );

  const currentVillage = useMemo(
    () =>
      browsedVillage ||
      villages.find((v) => norm(v.name) === norm(nativeVillage)) ||
      villages[0] ||
      null,
    [villages, browsedVillage, nativeVillage]
  );

  const handleDial = async () => {
    if (dialState === 'active') {
      setDialState('idle');
      return;
    }
    if (!lead?.phone) return;
    setDialState('dialing');
    setError(null);
    try {
      await callingService.clickToCall({
        customerNumber: lead.phone,
        departmentType: 'agents',
        callerName: lead.name,
        missionContext: `TL escalation — ${lead.name}`,
      });
      setSeconds(0);
      setDialState('active');
    } catch (err) {
      console.error('Click-to-call failed:', err);
      setDialState('failed');
      setError(errorMessage(err, 'The call could not be placed. Check the calling line and retry.'));
    }
  };

  const handleAddInterest = async (name) => {
    if (interestedVillages.some((v) => norm(v) === norm(name))) return;
    setError(null);
    try {
      await recruitmentService.addInterests(lead.id, [name]);
      await loadDetail();
    } catch (err) {
      setError(errorMessage(err, `Could not add ${name} to the interested villages.`));
    }
  };

  const handleRemoveInterest = async (name) => {
    const row = interests.find((i) => norm(i.village) === norm(name));
    if (!row) return;
    setError(null);
    try {
      await recruitmentService.removeInterest(row.id);
      await loadDetail();
    } catch (err) {
      setError(errorMessage(err, `Could not remove ${name}.`));
    }
  };

  const handleSetNative = async (name) => {
    setNativeVillage(name);
    setError(null);
    try {
      await recruitmentService.updateCandidate(lead.id, { village: name });
    } catch (err) {
      setError(errorMessage(err, 'Could not save the native village.'));
    }
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    const tlNote = note.trim() || undefined;

    try {
      if (result === 'Follow Up') {
        // The escalation stays Pending on purpose — a booked call-back is
        // still the TL's to work.
        await agentLeadService.logCall({
          leadId: lead.id,
          queue: 'tl',
          answerStatus: 'Answered',
          result: 'Follow Up',
          note: tlNote,
          followUpDate,
          followUpTime,
          durationSeconds: seconds || undefined,
        });
        setDone('Call-back booked. The escalation stays in your queue.');
      } else if (result === 'Return to Telecaller') {
        await agentLeadService.resolveEscalation(escalation.id, {
          status: 'ReturnedToTelecaller',
          tlResult: 'Return to Telecaller',
          tlNote,
        });
        setDone('Returned to the telecaller with your note.');
      } else if (result === 'Not Interested') {
        await agentLeadService.resolveEscalation(escalation.id, {
          status: 'Completed',
          tlResult: 'Not Interested',
          tlNote,
        });
        await agentLeadService.logCall({
          leadId: lead.id,
          queue: 'tl',
          answerStatus: 'Answered',
          result: 'Not Interested',
          note: tlNote,
          durationSeconds: seconds || undefined,
        });
        setDone('Escalation closed and the candidate marked not interested.');
      } else {
        await agentLeadService.resolveEscalation(escalation.id, {
          status: 'Completed',
          tlResult: 'Proceed',
          tlNote,
        });

        if (visitQueued) {
          await agentLeadService.scheduleOfficeVisit({
            candidateId: lead.id,
            regionalOffice: visitOffice,
            visitDate,
            visitTime,
            interestedVillage: interestedVillages[0] || nativeVillage || undefined,
            notes: tlNote,
          });
          setDone(`Promoted to Interested and booked in to ${visitOffice}.`);
        } else {
          setDone('Promoted to Interested.');
        }
      }

      onDone?.();
    } catch (err) {
      setError(errorMessage(err, 'Could not record that outcome.'));
    } finally {
      setSaving(false);
    }
  };

  if (!escalation || !lead) return null;

  const canSubmit = Boolean(note.trim()) && (result !== 'Follow Up' || Boolean(followUpDate)) && !saving;
  const recordingPlaying = audio.playingId !== null && String(audio.playingId) === String(escalation.id);

  return (
    <div
      className="fixed inset-0 z-[1000] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl border border-stone-200 shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Team Leader Call Workspace"
      >
        {/* Header */}
        <div className="bg-stone-900 px-5 py-3 text-white flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm">Team Leader Call Workspace</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-stone-900">
                  TL Senior Support
                </span>
              </div>
              <p className="text-[11px] text-stone-400 truncate">
                Candidate: <strong className="text-white">{lead.name}</strong> ({lead.phone}) ·
                Native: {nativeVillage || '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleDial}
              disabled={!lead.phone || dialState === 'dialing'}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 ${
                dialState === 'active'
                  ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
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
                  ? `End Call (${mmss(seconds)})`
                  : dialState === 'failed'
                  ? 'RETRY CALL'
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
            <PersonAvatar name={telecaller?.name || 'Telecaller'} photo={telecaller?.photo} size="sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-stone-900">{telecaller?.name || 'Telecaller'}</span>
                {telecaller?.id && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-200/70 text-amber-900 font-mono">
                    {empCode(telecaller.id)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-600">
                Call: <strong>{stampOf(escalation.call_datetime || escalation.forwarded_at)}</strong>
                {escalation.call_duration ? ` | Duration: ${escalation.call_duration}` : ''}
              </p>
            </div>
          </div>

          {escalation.call_recording_url ? (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-amber-300 shadow-2xs">
              <button
                type="button"
                onClick={() => audio.toggle(escalation.id, escalation.call_recording_url)}
                className="p-1 rounded bg-amber-500 hover:bg-amber-600 text-stone-900 transition-colors"
              >
                {recordingPlaying ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
              </button>
              <div className="text-[11px]">
                <span className="font-semibold text-stone-800 block">
                  {recordingPlaying ? 'Playing Recording...' : 'Play Telecaller Call'}
                </span>
                <span className="text-[10px] text-stone-500">
                  Duration: {escalation.call_duration || '—'}
                </span>
              </div>
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
            <strong>Note:</strong> {escalation.telecaller_note || 'No note left by the telecaller.'}
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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* LEFT — outcome */}
              <div className="lg:col-span-5 space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider block">
                    Team Leader Result
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {RESULTS.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        title={opt.hint}
                        onClick={() => setResult(opt.key)}
                        className={`p-2 rounded-lg border text-left text-xs font-bold transition-all ${
                          result === opt.key
                            ? `${opt.tone} shadow-xs ring-1 ring-inset`
                            : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {result === 'Follow Up' && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-2 text-xs">
                    <span className="font-bold text-amber-900 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      Schedule Team Leader Follow-Up
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-stone-500 block mb-0.5">Date</label>
                        <input
                          type="date"
                          value={followUpDate}
                          onChange={(e) => setFollowUpDate(e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 rounded border border-stone-300 bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-stone-500 block mb-0.5">Time Slot</label>
                        <input
                          type="text"
                          value={followUpTime}
                          onChange={(e) => setFollowUpTime(e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 rounded border border-stone-300 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {result === 'Return to Telecaller' && (
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-blue-900">
                      <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                      Return to Telecaller Follow-ups
                    </div>
                    <p className="text-[11px] text-blue-700">
                      Lead will move back to {telecaller?.name || 'the telecaller'}&apos;s follow-up
                      queue with your senior guidance notes.
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider block mb-1">
                    Team Leader Note *
                  </label>
                  <textarea
                    rows={4}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Record summary of conversation with candidate, agreed terms, regional office guidance..."
                    className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 bg-white focus:border-[#2563EB]"
                  />
                </div>

                {result === 'Proceed' && (
                  <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-emerald-600" />
                        Schedule Regional Office Visit
                      </span>
                      {visitQueued && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" /> Visit Queued
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-stone-500 block mb-0.5">Office</label>
                        <select
                          value={visitOffice}
                          onChange={(e) => setVisitOffice(e.target.value)}
                          className="w-full text-xs px-2 py-1.5 rounded border border-stone-200 bg-white"
                        >
                          {REGIONAL_OFFICES.map((off) => (
                            <option key={off} value={off}>
                              {off}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-stone-500 block mb-0.5">Date</label>
                        <input
                          type="date"
                          value={visitDate}
                          onChange={(e) => setVisitDate(e.target.value)}
                          className="w-full text-xs px-2 py-1.5 rounded border border-stone-200 bg-white"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-stone-500 block mb-0.5">Time</label>
                        <input
                          type="text"
                          value={visitTime}
                          onChange={(e) => setVisitTime(e.target.value)}
                          className="w-full text-xs px-2 py-1.5 rounded border border-stone-200 bg-white"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setVisitQueued(!visitQueued)}
                      title="Queue the visit; it is booked when the record is saved"
                      className={`w-full mt-1 px-3 py-1.5 rounded-lg text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors ${
                        visitQueued ? 'bg-emerald-800 hover:bg-emerald-900' : 'bg-emerald-600 hover:bg-emerald-700'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      {visitQueued ? 'Visit Queued — click to cancel' : 'Confirm Office Visit Schedule'}
                    </button>
                  </div>
                )}
              </div>

              {/* RIGHT — villages */}
              <div className="lg:col-span-7 space-y-3.5">
                <div className="space-y-3">
                  <HierarchyLocationSelector
                    villages={villages}
                    candidateState={place.state}
                    candidateDistrict={place.district}
                    candidateMandal={place.mandal}
                    candidateNativeVillage={nativeVillage}
                    selectedVillage={browsedVillage}
                    onSelectVillage={setBrowsedVillage}
                    onSetNativeVillage={handleSetNative}
                    onAddInterest={handleAddInterest}
                    interestedVillages={interestedVillages}
                    onRemoveInterest={handleRemoveInterest}
                    onViewOnMap={() => setShowMap(!showMap)}
                  />

                  {showMap && (
                    <div className="rounded-xl border border-stone-200 overflow-hidden bg-white p-1">
                      <div className="px-2 py-1 flex items-center justify-between text-[11px] text-stone-600 border-b border-stone-200">
                        <span className="font-semibold text-stone-800">
                          Inspecting Village Polygons &amp; Allotments:
                        </span>
                        <span className="text-[10px] font-mono text-stone-500">
                          Selected: {currentVillage?.name}
                        </span>
                      </div>
                      <InteractiveMap
                        height="200px"
                        villages={villages}
                        showAllotmentColors
                        agentMapMode
                        selectedVillageId={currentVillage?.id}
                        onSelectVillage={(v) => {
                          setPlace({ state: v.state || place.state, district: v.district, mandal: v.mandal });
                          setBrowsedVillage(v);
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!done && (
          <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-2 text-stone-600 min-w-0">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">
                Recorded Caller:{' '}
                <strong>
                  {user?.name || 'You'} (Team Leader{user?.id ? ` · ${empCode(user.id)}` : ''})
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-700 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className="px-6 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition-all shadow-xs flex items-center gap-1.5"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save Team Leader Record
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
