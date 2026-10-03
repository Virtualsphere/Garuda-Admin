import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  CircleCheck,
  CircleX,
  Clock3,
  CircleArrowRight,
  CalendarClock,
  CircleMinus,
  UsersRound,
  Route,
  CalendarDays,
  CalendarCheck,
  PlayCircle,
  PauseCircle,
  History,
  UserRoundPlus,
  X,
  Check,
  MessageSquare,
  Send,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

import PersonAvatar from '../common/PersonAvatar';
import HierarchyLocationSelector from '../common/HierarchyLocationSelector';
import InteractiveMap from '../maps/InteractiveMap';
import useVillageLocations from '../../../hooks/useVillageLocations';
import useCallAudio from '../../../hooks/useCallAudio';
import { useRecruitmentDesk } from '../../../hooks/useRecruitmentDesk';
import { useAuth } from '../../../context/AuthContext';
import agentLeadService from '../../../services/agentLeadService';
import recruitmentService from '../../../services/recruitmentService';
import callingService from '../../../services/callingService';
import { errorMessage } from '../../../utils/apiErrors';
import { CALL_WHATSAPP_TEMPLATES, sameId, stampOf } from './recruitmentModel';
import { REGIONAL_OFFICES, DEFAULT_REGIONAL_OFFICE, VISIT_TIME_SLOTS } from './recruitmentConstants';

// Where a lead can be handed on when the agents desk is not the right home for
// them. The server records the choice on the candidate, so `key` has to be the
// department name it expects, not display text.
const DIVERT_DEPARTMENTS = [
  { key: 'Farmers', label: 'Farmers', desc: 'Landowner sourcing & farming community' },
  { key: 'Buyers', label: 'Buyers', desc: 'Land procurement & investors' },
  { key: 'Land', label: 'Lands / Survey', desc: 'Physical verification & GIS team' },
  { key: 'Call Center', label: 'Call Center', desc: 'General telecaller support queue' },
];

const EMPTY = [];
const norm = (v) => String(v || '').trim().toLowerCase();
const mmss = (total) =>
  `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
const addDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const labelClass = 'text-[11px] font-semibold text-stone-500 uppercase tracking-wider';
const fieldClass = 'w-full text-xs px-2.5 py-1.5 rounded border border-stone-200 bg-white';

/**
 * The agent call workspace: place the call, read what happened before, record
 * what happened now, and — while the candidate is still on the line — fix their
 * villages and book them in to an office.
 *
 * Order matters on save. Marking a call Proceed sets the lead to INTERESTED on
 * the server, and booking an office visit sets it to OFFICE_VISIT, so the visit
 * is booked *after* the call is logged; the other way round would be undone by
 * the call. The visit button therefore queues the booking rather than making it.
 *
 * The timer is the operator's own stopwatch from the moment the dial is placed —
 * the IVR does not report call state back, so it is not carrier-confirmed time.
 */
export default function CallWorkspaceModal({ lead, queue = 'first-call', options = {}, onClose, onDone }) {
  const { user } = useAuth();
  const { teams, employeeById } = useRecruitmentDesk();
  const { villages } = useVillageLocations({});
  const audio = useCallAudio();

  /* ── Call state ───────────────────────────────────────────── */

  const [dialState, setDialState] = useState('idle');
  const [seconds, setSeconds] = useState(0);
  const [answerStatus, setAnswerStatus] = useState('Answered');
  // Deliberately unset: a stray Save must not promote a lead nobody has judged.
  const [result, setResult] = useState('');
  const [note, setNote] = useState('');
  const [followUpDate, setFollowUpDate] = useState(() => addDays(1));
  const [followUpTime, setFollowUpTime] = useState('11:00 AM');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [showDivert, setShowDivert] = useState(false);
  const [divertTo, setDivertTo] = useState(DIVERT_DEPARTMENTS[0].key);
  const [showForward, setShowForward] = useState(false);
  const [forwardLeaderId, setForwardLeaderId] = useState('');
  const [forwardNote, setForwardNote] = useState('');

  /* ── The candidate: history, villages, trail ──────────────── */

  const [detail, setDetail] = useState(null);
  const [nativeVillage, setNativeVillage] = useState(lead.village || '');
  const [place, setPlace] = useState({
    state: lead.state || '',
    district: lead.district || '',
    mandal: lead.mandal || '',
  });
  const [browsedVillage, setBrowsedVillage] = useState(null);
  const [showMap, setShowMap] = useState(false);

  const [visitOffice, setVisitOffice] = useState(DEFAULT_REGIONAL_OFFICE);
  const [visitDate, setVisitDate] = useState(() => addDays(2));
  const [visitTime, setVisitTime] = useState(VISIT_TIME_SLOTS[1]);
  const [visitVillage, setVisitVillage] = useState('');
  const [visitQueued, setVisitQueued] = useState(false);

  const [showComposer, setShowComposer] = useState(false);
  const [templateId, setTemplateId] = useState(CALL_WHATSAPP_TEMPLATES[0].id);
  const [messageText, setMessageText] = useState(() =>
    CALL_WHATSAPP_TEMPLATES[0].text(lead.name || 'Candidate', lead.village || lead.mandal)
  );
  const [whatsAppToast, setWhatsAppToast] = useState(false);

  const loadDetail = useCallback(async () => {
    try {
      const data = await agentLeadService.getLead(lead.id);
      setDetail(data.result || data.data || null);
    } catch (err) {
      // History is context, not a blocker: the call can still be made without it.
      console.error('Failed to load lead history:', err);
    }
  }, [lead.id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !showDivert && !showForward && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, showDivert, showForward]);

  // The stopwatch only runs while a call is up.
  const tickRef = useRef(null);
  useEffect(() => {
    if (dialState !== 'active') return undefined;
    tickRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(tickRef.current);
  }, [dialState]);

  const interests = detail?.interests || lead.interests || EMPTY;
  const interestedVillages = useMemo(
    () => [...new Set(interests.map((i) => i.village).filter(Boolean))],
    [interests]
  );

  const history = detail?.callAttempts || EMPTY;
  const trail = detail?.whatsappTrail || EMPTY;
  const hasOpenEscalation = (detail?.escalations || []).some((e) => e.status === 'Pending');

  const connected = answerStatus === 'Answered';
  const isFollowUp = answerStatus === 'Busy / Call Later' || (connected && result === 'Follow Up');
  const canSave =
    !saving && (!connected || Boolean(result)) && (!isFollowUp || Boolean(followUpDate));

  /* ── Dialling ─────────────────────────────────────────────── */

  const handleDial = async () => {
    if (dialState === 'active') {
      setDialState('idle');
      return;
    }
    if (!lead.phone) return;
    setDialState('dialing');
    setError(null);
    try {
      await callingService.clickToCall({
        customerNumber: lead.phone,
        departmentType: 'agents',
        callerName: lead.name,
        missionContext: `Agent lead — ${lead.name} (${lead.village || 'unknown village'})`,
      });
      setSeconds(0);
      setDialState('active');
    } catch (err) {
      console.error('Click-to-call failed:', err);
      setDialState('failed');
      setError(errorMessage(err, 'The call could not be placed. Check the calling line and retry.'));
    }
  };

  /* ── Villages ─────────────────────────────────────────────── */

  const handleAddInterest = async (name) => {
    if (interestedVillages.some((v) => norm(v) === norm(name))) return;
    setError(null);
    try {
      await recruitmentService.addInterests(lead.id, [name]);
      if (!visitVillage) setVisitVillage(name);
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

  const currentVillage = useMemo(
    () =>
      browsedVillage ||
      villages.find((v) => norm(v.name) === norm(nativeVillage)) ||
      villages.find((v) => norm(v.district) === norm(place.district)) ||
      villages[0] ||
      null,
    [villages, browsedVillage, nativeVillage, place.district]
  );

  /* ── Saving ───────────────────────────────────────────────── */

  const logCall = (overrides = {}) =>
    agentLeadService.logCall({
      leadId: lead.id,
      queue,
      answerStatus,
      result: connected ? result || undefined : undefined,
      note: note.trim() || undefined,
      followUpDate: isFollowUp ? followUpDate : undefined,
      followUpTime: isFollowUp ? followUpTime || undefined : undefined,
      durationSeconds: seconds || undefined,
      // Only the recovery hub may credit a dial to a colleague; the server
      // ignores this on every other queue.
      callerEmployeeId: options.callerEmployeeId,
      ...overrides,
    });

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await logCall();

      if (visitQueued && connected && result === 'Proceed') {
        await agentLeadService.scheduleOfficeVisit({
          candidateId: lead.id,
          regionalOffice: visitOffice,
          visitDate,
          visitTime,
          interestedVillage: visitVillage || interestedVillages[0] || nativeVillage || undefined,
        });
      }

      onDone?.();
      onClose?.();
    } catch (err) {
      setError(errorMessage(err, 'Could not record this call. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDivert = async () => {
    setSaving(true);
    setError(null);
    try {
      await logCall({
        answerStatus: 'Answered',
        result: 'Divert',
        note: note.trim() || `Lead diverted to ${divertTo} department.`,
        followUpDate: undefined,
        followUpTime: undefined,
        divertToDepartment: divertTo,
      });
      onDone?.();
      onClose?.();
    } catch (err) {
      setShowDivert(false);
      setError(errorMessage(err, 'Could not divert this lead.'));
    } finally {
      setSaving(false);
    }
  };

  const defaultLeader = useMemo(() => {
    const own = teams.find((t) => sameId(t.id, lead.team_leader_id) || sameId(t.id, lead.assigned_team_id));
    return String((own || teams[0])?.teamLeaderId || '');
  }, [teams, lead.team_leader_id, lead.assigned_team_id]);

  const openForward = () => {
    setForwardLeaderId((current) => current || defaultLeader);
    setForwardNote((current) => current || note);
    setShowForward(true);
  };

  const handleForward = async () => {
    if (!forwardNote.trim()) {
      setError('Add a note for the team leader explaining what support is needed.');
      setShowForward(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await agentLeadService.escalate({
        leadId: lead.id,
        teamLeaderId: forwardLeaderId ? Number(forwardLeaderId) : undefined,
        telecallerNote: forwardNote.trim(),
        callDuration: seconds ? mmss(seconds) : undefined,
      });
      onDone?.();
      onClose?.();
    } catch (err) {
      // 409 when the lead is already with a team leader — worth saying plainly.
      setShowForward(false);
      setError(errorMessage(err, 'Could not forward this lead.'));
    } finally {
      setSaving(false);
    }
  };

  /* ── WhatsApp ─────────────────────────────────────────────── */

  const recipient = String(lead.phone || '').replace(/\D/g, '');

  const handleTemplate = (id) => {
    setTemplateId(id);
    const tpl = CALL_WHATSAPP_TEMPLATES.find((t) => t.id === id) || CALL_WHATSAPP_TEMPLATES[0];
    setMessageText(tpl.text(lead.name || 'Candidate', lead.village || lead.mandal));
  };

  const handleSendWhatsApp = async () => {
    if (!recipient || !messageText.trim()) return;
    const tpl = CALL_WHATSAPP_TEMPLATES.find((t) => t.id === templateId) || CALL_WHATSAPP_TEMPLATES[0];

    // Opened first: the browser only allows a new tab from inside the click.
    window.open(
      `https://wa.me/91${recipient.slice(-10)}?text=${encodeURIComponent(messageText)}`,
      '_blank',
      'noopener'
    );

    try {
      await agentLeadService.logWhatsapp(lead.id, {
        templateName: tpl.templateName,
        messageText,
        callerEmployeeId: options.callerEmployeeId,
      });
      setWhatsAppToast(true);
      setTimeout(() => setWhatsAppToast(false), 3500);
      await loadDetail();
    } catch (err) {
      setError(errorMessage(err, 'WhatsApp opened, but it could not be logged to the trail.'));
    }
  };

  /* ── The one status chip next to the name ─────────────────── */

  const statusChip = (() => {
    if (visitQueued) {
      return { icon: CalendarCheck, label: 'Visit Queued', tone: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
    }
    if (hasOpenEscalation) {
      return { icon: UsersRound, label: 'Team Leader Follow-up', tone: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
    }
    if (interestedVillages.length > 0) {
      return { icon: UserRoundPlus, label: `Interested · ${interestedVillages[0]}`, tone: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
    }
    if (answerStatus === 'Busy / Call Later' || result === 'Follow Up' || lead.follow_up_date) {
      return { icon: CalendarClock, label: `Follow-up ${lead.follow_up_date || followUpDate}`, tone: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
    }
    if (answerStatus === 'Not Lifted' || lead.last_call_status === 'Not Lifted') {
      return { icon: PhoneOff, label: 'Not Lifted', tone: 'bg-stone-500/20 text-stone-300 border-stone-500/30' };
    }
    return { icon: CircleCheck, label: 'Answered', tone: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
  })();

  const StatusIcon = statusChip.icon;
  const location = [lead.village, lead.mandal, lead.district].filter(Boolean).join(', ');

  return (
    <div
      className="fixed inset-0 z-[1000] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl border border-stone-200 shadow-2xl w-full overflow-hidden my-auto max-w-5xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Call workspace"
      >
        {/* Header */}
        <div className="bg-stone-900 px-4 py-3 text-white flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#2563EB] flex items-center justify-center shrink-0">
              <Phone className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm tracking-tight">{lead.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-mono">Agent</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium border flex items-center gap-1 ${statusChip.tone}`}
                >
                  <StatusIcon className="w-3 h-3 shrink-0" />
                  <span>{statusChip.label}</span>
                </span>
              </div>
              <p className="text-[11px] text-stone-300 font-mono mt-0.5 truncate">
                {lead.phone} · {location || 'Location not specified'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {dialState === 'active' ? (
              <div className="flex items-center gap-2 bg-stone-800 px-2.5 py-1 rounded-lg border border-stone-700">
                <PhoneCall className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="text-xs font-mono text-white font-bold">{mmss(seconds)}</span>
                <button
                  type="button"
                  onClick={handleDial}
                  title="Stop the timer"
                  className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleDial}
                disabled={!lead.phone || dialState === 'dialing'}
                title="Initiate call with candidate"
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
              >
                {dialState === 'dialing' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Phone className="w-3.5 h-3.5" />
                )}
                <span>
                  {dialState === 'dialing' ? 'Dialling…' : dialState === 'failed' ? 'Retry' : 'Call'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              title="Close workspace"
              aria-label="Close"
              className="text-stone-400 hover:text-white p-1 rounded-md hover:bg-stone-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* LEFT — outcome */}
            <div className="lg:col-span-5 space-y-3.5">
              <div>
                <label className={`${labelClass} block mb-1.5`}>1. Call Answer Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'Answered', label: 'Answered', icon: CircleCheck, on: 'bg-emerald-600 text-white border-emerald-600 shadow-xs', off: 'bg-emerald-50/70 text-emerald-800 border-emerald-200 hover:bg-emerald-100', title: 'Candidate answered call' },
                    { key: 'Not Lifted', label: 'Not Lifted', icon: PhoneOff, on: 'bg-stone-600 text-white border-stone-600 shadow-xs', off: 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200', title: 'Candidate did not lift call' },
                    { key: 'Busy / Call Later', label: 'Call Later', icon: Clock3, on: 'bg-amber-500 text-white border-amber-500 shadow-xs', off: 'bg-amber-50/70 text-amber-800 border-amber-200 hover:bg-amber-100', title: 'Candidate busy, call later' },
                    { key: 'Invalid Number', label: 'Invalid Number', icon: CircleX, on: 'bg-red-600 text-white border-red-600 shadow-xs', off: 'bg-red-50/70 text-red-800 border-red-200 hover:bg-red-100', title: 'Invalid or wrong phone number' },
                  ].map(({ key, label, icon: Icon, on, off, title }) => (
                    <button
                      key={key}
                      type="button"
                      title={title}
                      onClick={() => {
                        setAnswerStatus(key);
                        if (key !== 'Answered') setResult('');
                      }}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-2 transition-all ${
                        answerStatus === key ? on : off
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {connected && (
                <div className="space-y-1.5">
                  <label className={`${labelClass} block`}>2. Business Result</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'Proceed', label: 'Proceed', icon: CircleArrowRight, on: 'bg-[#2563EB] text-white border-[#2563EB] shadow-xs', off: 'bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100', title: 'Proceed with candidate' },
                      { key: 'Follow Up', label: 'Follow-up', icon: CalendarClock, on: 'bg-amber-500 text-white border-amber-500 shadow-xs', off: 'bg-amber-50/70 text-amber-900 border-amber-200 hover:bg-amber-100', title: 'Schedule a follow-up call' },
                      { key: 'Not Interested', label: 'Not Interested', icon: CircleMinus, on: 'bg-red-600 text-white border-red-600 shadow-xs', off: 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100', title: 'Candidate not interested' },
                    ].map(({ key, label, icon: Icon, on, off, title }) => (
                      <button
                        key={key}
                        type="button"
                        title={title}
                        onClick={() => setResult(key)}
                        className={`py-2 px-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                          result === key ? on : off
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isFollowUp && (
                <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200/80 space-y-2">
                  <span className="text-[11px] font-semibold text-amber-900 flex items-center gap-1.5">
                    <CalendarClock className="w-3.5 h-3.5 text-amber-600" />
                    Schedule Follow-up
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-stone-500 block mb-0.5">Follow-up Date</label>
                      <input
                        type="date"
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-500 block mb-0.5">Time Slot</label>
                      <input
                        type="text"
                        value={followUpTime}
                        onChange={(e) => setFollowUpTime(e.target.value)}
                        placeholder="e.g. 11:30 AM"
                        className={fieldClass}
                      />
                    </div>
                  </div>
                </div>
              )}

              {!connected && answerStatus !== 'Busy / Call Later' && (
                <p className="text-[11px] text-stone-500 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
                  An unanswered call is still recorded as an attempt — the lead stays in the queue
                  and its attempt count goes up.
                </p>
              )}

              <div>
                <label className={`${labelClass} block mb-1`}>Call Note</label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Enter candidate interest, questions, location preference, or remarks..."
                  className="w-full text-xs px-3 py-2 rounded-lg border border-stone-200 bg-white focus:border-[#2563EB]"
                />
              </div>

              <div className="pt-2 border-t border-stone-200">
                <label className={`${labelClass} block mb-2`}>Other Actions</label>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={openForward}
                    disabled={hasOpenEscalation}
                    title={
                      hasOpenEscalation
                        ? 'This lead is already with a team leader'
                        : 'Telecaller spoke to the lead but could not close it and needs Team Leader support'
                    }
                    className="w-full py-2 px-3 rounded-lg border border-stone-300 bg-stone-50 hover:bg-blue-50/50 hover:border-blue-300 text-stone-800 hover:text-blue-900 font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-2xs disabled:opacity-50 disabled:hover:bg-stone-50 disabled:hover:border-stone-300"
                  >
                    <UsersRound className="w-4 h-4 text-[#2563EB]" />
                    <span>{hasOpenEscalation ? 'With Team Leader' : 'Team Leader Support'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowDivert(true)}
                    title="Divert lead to another department (Farmers, Buyers, Call Center)"
                    className="w-full py-2 px-3 rounded-lg border border-stone-300 bg-stone-50 hover:bg-stone-100 hover:border-stone-400 text-stone-800 font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-2xs"
                  >
                    <Route className="w-4 h-4 text-stone-600" />
                    <span>Divert</span>
                  </button>
                </div>
              </div>

              {/* Call history */}
              <div className="pt-2 border-t border-stone-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className={`${labelClass} flex items-center gap-1.5`}>
                    <History className="w-3.5 h-3.5 text-stone-600" />
                    <span>Call History</span>
                  </label>
                  <span className="text-[10px] text-stone-400 font-mono">
                    {history.length} record{history.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {history.length === 0 && (
                    <div className="p-2.5 rounded-lg border border-stone-200/80 bg-stone-50/70 text-center text-xs text-stone-500">
                      No earlier calls on record for this candidate.
                    </div>
                  )}
                  {history.map((item) => {
                    const caller = employeeById.get(String(item.employee_id));
                    const playing = sameId(audio.playingId, item.id);
                    return (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-lg border border-stone-200 bg-stone-50/60 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <PersonAvatar
                              name={caller?.name || 'Telecaller'}
                              photo={caller?.photo}
                              size="xs"
                            />
                            <div className="min-w-0">
                              <span className="font-semibold text-stone-900 block leading-tight truncate">
                                {caller?.name || 'Telecaller'}
                              </span>
                              <span className="text-[10px] text-stone-500 leading-none">
                                {stampOf(item.called_at)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-white border border-stone-200 text-stone-700">
                              <CircleCheck
                                className={`w-2.5 h-2.5 ${
                                  item.answer_status === 'Answered' ? 'text-emerald-600' : 'text-stone-400'
                                }`}
                              />
                              {item.answer_status}
                            </span>

                            {item.recording_url && (
                              <button
                                type="button"
                                onClick={() => audio.toggle(item.id, item.recording_url)}
                                title={playing ? 'Pause recording' : 'Play call recording'}
                                className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-all shadow-2xs ${
                                  playing
                                    ? 'bg-red-600 text-white'
                                    : 'bg-white hover:bg-stone-100 text-stone-800 border border-stone-300'
                                }`}
                              >
                                {playing ? (
                                  <>
                                    <PauseCircle className="w-3 h-3 text-white" />
                                    <span>Pause</span>
                                  </>
                                ) : (
                                  <>
                                    <PlayCircle className="w-3 h-3 text-[#2563EB]" />
                                    <span>
                                      Recording
                                      {item.duration_seconds ? ` (${mmss(item.duration_seconds)})` : ''}
                                    </span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {item.note && (
                          <p className="text-[11px] text-stone-600 pl-7 border-l-2 border-stone-200 py-0.5 mt-0.5">
                            &quot;{item.note}&quot;
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* WhatsApp trail */}
              <div className="pt-2 border-t border-stone-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    <span>WhatsApp Trail</span>
                    {trail.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        {trail.length}
                      </span>
                    )}
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowComposer(!showComposer)}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                  >
                    <span>{showComposer ? 'Hide Composer' : '+ Send WhatsApp'}</span>
                  </button>
                </div>

                {whatsAppToast && (
                  <div className="p-2 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>WhatsApp link opened &amp; logged to candidate&apos;s trail!</span>
                  </div>
                )}

                {trail.length > 0 ? (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {trail.map((msg) => (
                      <div
                        key={msg.id}
                        className="p-2 rounded-lg border border-emerald-200/80 bg-emerald-50/50 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-emerald-900 bg-emerald-100 px-1.5 py-0.5 rounded">
                            {msg.template_name}
                          </span>
                          <span className="text-stone-400 font-mono">{stampOf(msg.sent_at)}</span>
                        </div>
                        <p className="text-[11px] text-stone-700 line-clamp-2 italic">
                          &quot;{msg.message_text}&quot;
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-stone-500 pt-0.5">
                          <span>
                            Sent by:{' '}
                            <strong className="text-stone-700">
                              {employeeById.get(String(msg.sent_by))?.name || 'Unknown'}
                            </strong>
                          </span>
                          <span className="text-emerald-700 font-semibold">
                            {msg.delivery_status || 'Sent'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg border border-stone-200/80 bg-stone-50/70 text-center text-xs text-stone-500">
                    No WhatsApp messages logged yet for this candidate.
                  </div>
                )}

                {showComposer && (
                  <div className="p-2.5 rounded-lg border border-emerald-300 bg-emerald-50/70 space-y-2">
                    <div>
                      <label className="text-[10px] font-semibold text-emerald-900 block mb-1">
                        Select Message Template
                      </label>
                      <select
                        value={templateId}
                        onChange={(e) => handleTemplate(e.target.value)}
                        className="w-full text-xs py-1.5 px-2 rounded-md border border-emerald-300 bg-white text-stone-800"
                      >
                        {CALL_WHATSAPP_TEMPLATES.map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-emerald-900 block mb-1">
                        Message Preview (editable before sending)
                      </label>
                      <textarea
                        rows={2}
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        className="w-full text-xs p-2 rounded-md border border-emerald-300 bg-white text-stone-800"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-stone-600 font-mono">
                        Recipient: +91 {recipient.slice(-10)}
                      </span>
                      <button
                        type="button"
                        onClick={handleSendWhatsApp}
                        disabled={!recipient}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        <span>Send WhatsApp &amp; Log</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT — villages and office visit */}
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
                        Click any village polygon to inspect vacancy:
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

              {/* Office visit */}
              <div className="p-3 rounded-xl border border-stone-200 bg-stone-50/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-stone-900 flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-[#2563EB]" />
                    Schedule Regional Office Visit
                  </span>
                  {visitQueued && (
                    <div className="text-right">
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <CalendarCheck className="w-3 h-3 text-emerald-700" /> Visit Queued
                      </span>
                      <span className="text-[10px] text-emerald-800 block mt-0.5">
                        {visitDate} at {visitTime}
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] text-stone-500 block mb-0.5">Regional Office</label>
                    <select
                      value={visitOffice}
                      onChange={(e) => setVisitOffice(e.target.value)}
                      className={fieldClass}
                    >
                      {REGIONAL_OFFICES.map((off) => (
                        <option key={off} value={off}>
                          {off}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-stone-500 block mb-0.5">Visit Date</label>
                    <input
                      type="date"
                      value={visitDate}
                      onChange={(e) => setVisitDate(e.target.value)}
                      className={fieldClass}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-stone-500 block mb-0.5">Time Slot</label>
                    <input
                      type="text"
                      value={visitTime}
                      onChange={(e) => setVisitTime(e.target.value)}
                      placeholder="11:30 AM"
                      className={fieldClass}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-stone-500 block mb-0.5">Associated Village</label>
                    <select
                      value={visitVillage || interestedVillages[0] || nativeVillage}
                      onChange={(e) => setVisitVillage(e.target.value)}
                      className={fieldClass}
                    >
                      {interestedVillages.length > 0 ? (
                        interestedVillages.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))
                      ) : (
                        <option value={nativeVillage}>{nativeVillage || '—'}</option>
                      )}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setVisitQueued(!visitQueued)}
                  title="Queue the office visit; it is booked when the call is saved"
                  className={`w-full mt-1 px-3 py-2 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors ${
                    visitQueued
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-stone-900 hover:bg-stone-800 text-white'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  {visitQueued ? 'Visit Queued — click to cancel' : 'Schedule Visit'}
                </button>
                {visitQueued && !(connected && result === 'Proceed') && (
                  <p className="text-[10px] text-amber-700">
                    The visit is booked when the call is saved as Answered → Proceed.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-3 text-xs shrink-0">
          <div className="text-stone-500 text-[11px] hidden sm:block">
            {interestedVillages.length > 0 && (
              <span>
                Interested in: <strong>{interestedVillages.join(', ')}</strong>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[11px] text-stone-400 hidden md:block">
              Logged as {user?.name || 'you'}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-700 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="px-5 py-2 rounded-lg bg-[#2563EB] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-all flex items-center gap-1.5 shadow-xs"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save Call Record
            </button>
          </div>
        </div>
      </div>

      {/* Divert */}
      {showDivert && (
        <div
          className="fixed inset-0 z-[1010] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            e.stopPropagation();
            setShowDivert(false);
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl border border-stone-200 max-w-md w-full p-4 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center">
                  <Route className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-stone-900 text-sm">Divert</h4>
                  <p className="text-[11px] text-stone-500">Route candidate to another department</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDivert(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-stone-700">Select Target Department</label>
                  <span className="text-[10px] text-stone-500 font-medium">
                    Current: <strong>Agents</strong> (Filtered out)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DIVERT_DEPARTMENTS.map((dept) => (
                    <button
                      key={dept.key}
                      type="button"
                      onClick={() => setDivertTo(dept.key)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        divertTo === dept.key
                          ? 'bg-blue-50 border-[#2563EB] text-blue-900 ring-1 ring-[#2563EB]'
                          : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      <span className="font-bold text-xs block">{dept.label}</span>
                      <span className="text-[10px] text-stone-500 block leading-tight">{dept.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Transfer Note / Reason
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Candidate is a crop farmer / buyer looking to procure directly..."
                  className="w-full text-xs px-3 py-2 rounded-lg border border-stone-200 bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowDivert(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-stone-200 text-stone-600 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDivert}
                disabled={saving}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white shadow-xs flex items-center gap-1.5"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Route className="w-3.5 h-3.5" />}
                Confirm Divert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team leader support */}
      {showForward && (
        <div
          className="fixed inset-0 z-[1010] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            e.stopPropagation();
            setShowForward(false);
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl border border-stone-200 max-w-md w-full p-4 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center">
                  <UsersRound className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-stone-900 text-sm">Team Leader Support</h4>
                  <p className="text-[11px] text-stone-500">
                    Request senior support to assist with closing candidate
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForward(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200 space-y-1">
                <div className="flex justify-between text-stone-600">
                  <span>
                    Candidate: <strong>{lead.name}</strong>
                  </span>
                  <span>
                    Duration: <strong>{seconds ? mmss(seconds) : '—'}</strong>
                  </span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Caller: {user?.name || 'You'}</span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Select Team Leader *</label>
                <select
                  value={forwardLeaderId}
                  onChange={(e) => setForwardLeaderId(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white"
                >
                  {teams.length === 0 && <option value="">No team leaders set up</option>}
                  {teams.map((t) => (
                    <option key={t.id} value={t.teamLeaderId}>
                      {t.teamLeaderName} ({t.name.split('—')[0].trim()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">
                  Reason / Notes for Team Leader *
                </label>
                <textarea
                  rows={3}
                  value={forwardNote}
                  onChange={(e) => setForwardNote(e.target.value)}
                  placeholder="Candidate spoke but needs TL clarification on franchise model, commission split, or village quota..."
                  className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 bg-white focus:border-[#2563EB]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowForward(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-stone-200 text-stone-600 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleForward}
                disabled={saving}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white transition-colors shadow-2xs flex items-center gap-1.5"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UsersRound className="w-3.5 h-3.5" />}
                Forward to Team Leader
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
