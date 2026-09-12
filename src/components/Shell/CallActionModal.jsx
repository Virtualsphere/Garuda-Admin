import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X,
  PhoneCall,
  PhoneOff,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  CalendarClock,
  Shuffle,
  UsersRound,
  History,
  PlayCircle,
  PauseCircle,
  Building2,
  MapPin,
  UserRoundPlus,
} from 'lucide-react';

import { useCall } from '../../context/CallContext';
import callingService from '../../services/callingService';
import callSignalService from '../../services/callSignalService';
import agentLeadService from '../../services/agentLeadService';
import employeeService from '../../services/employeeService';

const ANSWER_STATUSES = [
  'Answered',
  'Not Lifted',
  'No Answer',
  'Busy / Call Later',
  'Invalid Number',
];

const LEAD_RESULTS = [
  { key: 'Proceed', label: 'Proceed', tone: 'border-emerald-500 bg-emerald-50 text-emerald-900' },
  { key: 'Follow Up', label: 'Follow up', tone: 'border-amber-500 bg-amber-50 text-amber-900' },
  { key: 'Divert', label: 'Divert', tone: 'border-blue-500 bg-blue-50 text-blue-900' },
  {
    key: 'Not Interested',
    label: 'Not interested',
    tone: 'border-stone-500 bg-stone-100 text-stone-800',
  },
];

const DIVERT_DEPARTMENTS = ['Farmers', 'Land', 'Buyers', 'Call Center'];

const REGIONAL_OFFICES = [
  'Sangareddy Regional Office',
  'Kalwakurthy Regional Office',
  'Nagarkurnool Regional Office',
  'Achampet Regional Office',
  'Hyderabad Head Office',
];

/** Which department the click-to-call trunk should place this through. */
const TRUNK = {
  AgentLead: 'agents',
  Agent: 'agents',
  Farmer: 'farmers',
  Buyer: 'buyers',
  Land: 'land',
  Staff: 'callcenter',
};

const mmss = (total) => {
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
};

const addDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const stamp = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 16);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * The app-wide call workspace: dial, time the call, read what happened last
 * time, and record the outcome.
 *
 * Every call is logged as a call signal with its real measured duration, for
 * every department. Only an agent lead gets the pipeline outcomes on top of
 * that — the modal will not offer to mark a colleague "not interested".
 *
 * The timer measures wall-clock time on this desk from the moment the dial is
 * placed. The IVR does not report call state back, so this is explicitly the
 * operator's own stopwatch, not carrier-confirmed talk time.
 */
export default function CallActionModal() {
  const { activeCallTarget: target, closeCall } = useCall();

  const [dialState, setDialState] = useState('idle');
  const [seconds, setSeconds] = useState(0);
  const [startedAt, setStartedAt] = useState(null);

  const [answerStatus, setAnswerStatus] = useState('Answered');
  const [result, setResult] = useState('Proceed');
  const [divertTo, setDivertTo] = useState(DIVERT_DEPARTMENTS[0]);
  const [note, setNote] = useState('');
  const [followUpDate, setFollowUpDate] = useState(() => addDays(1));
  const [followUpTime, setFollowUpTime] = useState('11:00 AM');

  const [showDivert, setShowDivert] = useState(false);
  const [showForward, setShowForward] = useState(false);
  const [teamLeaders, setTeamLeaders] = useState([]);
  const [forwardToId, setForwardToId] = useState('');
  const [forwardNote, setForwardNote] = useState('');

  const [scheduleVisit, setScheduleVisit] = useState(false);
  const [visitOffice, setVisitOffice] = useState(REGIONAL_OFFICES[0]);
  const [visitDate, setVisitDate] = useState(() => addDays(2));
  const [visitTime, setVisitTime] = useState('11:30 AM');

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [playing, setPlaying] = useState(null);
  const audioRef = useRef(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  const isAgentLead = target?.leadType === 'AgentLead';
  const isDivert = result === 'Divert';
  const isFollowUp = result === 'Follow Up';
  const connected = answerStatus === 'Answered';

  /* ── Timer ───────────────────────────────────────────────── */

  useEffect(() => {
    if (dialState !== 'active') return undefined;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [dialState]);

  // Stop any playing recording when the modal is dismissed.
  useEffect(
    () => () => {
      audioRef.current?.pause();
    },
    []
  );

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !showDivert && !showForward && closeCall();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeCall, showDivert, showForward]);

  /* ── History ─────────────────────────────────────────────── */

  const loadHistory = useCallback(async () => {
    if (!target?.phone) return;
    setHistoryLoading(true);

    const calls = [];
    const [signalResult, attemptResult] = await Promise.allSettled([
      callSignalService.getAll({ caller_phone: target.phone }),
      target.leadId
        ? agentLeadService.getCallAttempts({ leadId: target.leadId })
        : Promise.resolve({ result: [] }),
    ]);

    if (signalResult.status === 'fulfilled') {
      const rows = signalResult.value.data || signalResult.value.result || [];
      (Array.isArray(rows) ? rows : []).forEach((s) =>
        calls.push({
          id: `sig-${s.id}`,
          at: s.created_at,
          who: s.caller_name || 'Call signal',
          status: s.status || (s.missed ? 'Missed' : 'Placed'),
          duration: s.duration_seconds ? mmss(s.duration_seconds) : null,
          note: s.mission_context,
          recording: null,
        })
      );
    }

    if (attemptResult.status === 'fulfilled') {
      const rows = attemptResult.value.result || attemptResult.value.data || [];
      (Array.isArray(rows) ? rows : []).forEach((a) =>
        calls.push({
          id: `att-${a.id}`,
          at: a.called_at,
          who: a.result ? `Outcome: ${a.result}` : 'Call attempt',
          status: a.answer_status,
          duration: a.duration_seconds ? mmss(a.duration_seconds) : null,
          note: a.note,
          recording: a.recording_url || null,
        })
      );
    }

    calls.sort((x, y) => new Date(y.at || 0) - new Date(x.at || 0));
    setHistory(calls);
    setHistoryLoading(false);
  }, [target?.phone, target?.leadId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Team leaders to escalate to, only where escalation is possible.
  useEffect(() => {
    if (!isAgentLead) return;
    employeeService
      .getAll()
      .then((data) => {
        const rows = data.data || data.employees || data.result || [];
        setTeamLeaders(Array.isArray(rows) ? rows : []);
      })
      .catch(() => setTeamLeaders([]));
  }, [isAgentLead]);

  const lastCall = useMemo(() => history[0] || null, [history]);

  /* ── Actions ─────────────────────────────────────────────── */

  const handleDial = async () => {
    if (dialState === 'active') {
      setDialState('ended');
      return;
    }
    setDialState('dialing');
    setError(null);
    try {
      await callingService.clickToCall({
        customerNumber: target.phone,
        departmentType: TRUNK[target.leadType] || 'callcenter',
        callerName: target.name,
        missionContext: target.source || `${target.leadType || 'Contact'} call`,
        landId: target.landId,
      });
      setSeconds(0);
      setStartedAt(new Date().toISOString());
      setDialState('active');
    } catch (err) {
      console.error('Click-to-call failed:', err);
      setDialState('failed');
      setError('The trunk did not accept the call. The outcome can still be recorded.');
    }
  };

  const togglePlay = (row) => {
    if (playing === row.id) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(row.recording);
    audio.onended = () => setPlaying(null);
    audio.play().catch(() => setPlaying(null));
    audioRef.current = audio;
    setPlaying(row.id);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      // Every department logs the call itself, with the measured duration.
      await callSignalService.create({
        department_type: TRUNK[target.leadType] || 'callcenter',
        direction: 'OUTBOUND',
        caller_name: target.name,
        caller_phone: target.phone,
        caller_type: target.leadType || 'Contact',
        mission_context: note.trim() || target.source || undefined,
        duration_seconds: seconds || undefined,
        missed: !connected,
        status: answerStatus,
        land_id: target.landId,
      });

      if (isAgentLead && target.leadId) {
        await agentLeadService.logCall({
          leadId: target.leadId,
          answerStatus,
          result: connected ? result : undefined,
          note: note.trim() || undefined,
          followUpDate: connected && isFollowUp ? followUpDate : undefined,
          followUpTime: connected && isFollowUp ? followUpTime || undefined : undefined,
          divertToDepartment: connected && isDivert ? divertTo : undefined,
          durationSeconds: seconds || undefined,
        });

        if (connected && result === 'Proceed' && scheduleVisit) {
          await agentLeadService.scheduleOfficeVisit({
            candidateId: target.leadId,
            regionalOffice: visitOffice,
            visitDate,
            visitTime,
            interestedVillage: target.village || undefined,
          });
        }
      }

      setDone(
        isAgentLead
          ? `Call logged${connected ? ` — ${result}` : ` — ${answerStatus}`}.`
          : 'Call logged.'
      );
      target.onDone?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not record this call.');
    } finally {
      setSaving(false);
    }
  };

  const forwardToTeamLeader = async () => {
    setSaving(true);
    setError(null);
    try {
      await agentLeadService.escalate({
        leadId: target.leadId,
        telecallerNote: forwardNote.trim() || note.trim() || undefined,
        callDuration: seconds ? mmss(seconds) : undefined,
        teamLeaderId: forwardToId || undefined,
      });
      setShowForward(false);
      setDone('Escalated to the team leader.');
      target.onDone?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not escalate this lead.');
      setShowForward(false);
    } finally {
      setSaving(false);
    }
  };

  if (!target) return null;

  const canSave =
    answerStatus &&
    (!connected || !isFollowUp || followUpDate) &&
    (!connected || !isDivert || divertTo) &&
    !saving;

  return (
    <div
      className="garuda-ui fixed inset-0 z-[1200] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
      onClick={closeCall}
    >
      <div
        className="bg-white rounded-xl border border-stone-200 shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden text-xs"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-stone-900 px-5 py-3 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <PhoneCall className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm truncate">{target.name || 'Contact'}</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 border border-white/15">
                  {target.leadType || 'Contact'}
                </span>
                {dialState === 'active' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-stone-900">
                    ● LIVE {mmss(seconds)}
                  </span>
                )}
                {dialState === 'ended' && seconds > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-700 text-stone-200">
                    Ended · {mmss(seconds)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-400 truncate">
                {target.phone}
                {target.source ? ` · ${target.source}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleDial}
              disabled={dialState === 'dialing'}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-60 ${
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
              {dialState === 'active'
                ? `End call (${mmss(seconds)})`
                : dialState === 'failed'
                ? 'Retry call'
                : dialState === 'ended'
                ? 'Call again'
                : 'CALL'}
            </button>

            <button
              type="button"
              onClick={closeCall}
              aria-label="Close"
              className="text-stone-400 hover:text-white p-1 rounded-md hover:bg-stone-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 font-semibold rounded-lg px-3 py-2 flex items-start gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {done ? (
            <div className="py-12 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <p className="font-bold text-sm text-stone-900">{done}</p>
              {seconds > 0 && (
                <p className="text-[11px] text-stone-500">
                  Duration recorded: {mmss(seconds)}
                  {startedAt ? ` · started ${stamp(startedAt)}` : ''}
                </p>
              )}
              <button
                type="button"
                onClick={closeCall}
                className="px-5 py-2 rounded-xl bg-stone-900 text-white font-semibold"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Outcome */}
              <div className="lg:col-span-7 space-y-3.5">
                <div>
                  <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider block mb-1.5">
                    How did the call go?
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {ANSWER_STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setAnswerStatus(s)}
                        className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-colors ${
                          answerStatus === s
                            ? 'bg-stone-900 border-stone-900 text-white'
                            : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {isAgentLead && connected && (
                  <div>
                    <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider block mb-1.5">
                      What was decided?
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {LEAD_RESULTS.map((r) => (
                        <button
                          key={r.key}
                          type="button"
                          onClick={() => {
                            setResult(r.key);
                            if (r.key === 'Divert') setShowDivert(true);
                          }}
                          className={`px-3 py-2 rounded-lg border-2 text-left font-bold transition-all ${
                            result === r.key
                              ? r.tone
                              : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isAgentLead && connected && isFollowUp && (
                  <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/60 grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-stone-500 block mb-0.5">
                        Call back on
                      </label>
                      <input
                        type="date"
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                        className="w-full text-xs bg-white border border-stone-200 rounded-lg px-2 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-500 block mb-0.5">At</label>
                      <input
                        value={followUpTime}
                        onChange={(e) => setFollowUpTime(e.target.value)}
                        placeholder="11:00 AM"
                        className="w-full text-xs bg-white border border-stone-200 rounded-lg px-2 py-1.5"
                      />
                    </div>
                  </div>
                )}

                {isAgentLead && connected && isDivert && (
                  <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/60 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-blue-900">
                      Diverting to <strong>{divertTo}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowDivert(true)}
                      className="px-2 py-1 rounded-lg border border-blue-300 bg-white text-blue-800 font-bold text-[11px]"
                    >
                      Change
                    </button>
                  </div>
                )}

                {isAgentLead && connected && result === 'Proceed' && (
                  <label className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scheduleVisit}
                      onChange={(e) => setScheduleVisit(e.target.checked)}
                      className="accent-[#2563EB]"
                    />
                    <span className="text-[11px] font-bold text-emerald-900 inline-flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" />
                      Also book them in to a regional office
                    </span>
                  </label>
                )}

                {isAgentLead && connected && result === 'Proceed' && scheduleVisit && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-3">
                      <label className="text-[10px] text-stone-500 block mb-0.5">Office</label>
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

                <div>
                  <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider block mb-1">
                    Call note
                  </label>
                  <textarea
                    rows={4}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="What did they say?"
                    className="w-full text-xs bg-white border border-stone-200 rounded-lg px-2.5 py-2 resize-y"
                  />
                </div>

                {isAgentLead && (
                  <button
                    type="button"
                    onClick={() => setShowForward(true)}
                    className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 font-bold inline-flex items-center justify-center gap-1.5 hover:bg-amber-100"
                  >
                    <UsersRound className="w-3.5 h-3.5" />
                    Forward to a team leader instead
                  </button>
                )}
              </div>

              {/* History */}
              <div className="lg:col-span-5 space-y-3">
                <div className="bg-stone-50 rounded-xl border border-stone-200 p-3">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-stone-200">
                    <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wider inline-flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-stone-400" />
                      Previous calls
                    </span>
                    <span className="text-[10px] text-stone-400">{history.length} on record</span>
                  </div>

                  {historyLoading ? (
                    <div className="py-8 flex items-center justify-center">
                      <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" />
                    </div>
                  ) : history.length === 0 ? (
                    <p className="py-6 text-center text-[11px] text-stone-400">
                      No earlier call recorded against {target.phone}.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-1.5 max-h-80 overflow-y-auto pr-0.5">
                      {history.map((row) => (
                        <div
                          key={row.id}
                          className="p-2 bg-white rounded-lg border border-stone-200 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-stone-900 truncate">{row.who}</span>
                            <span className="text-[10px] text-stone-400 shrink-0">
                              {stamp(row.at)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-1.5 rounded bg-stone-100 text-stone-700 text-[10px] font-bold">
                              {row.status}
                            </span>
                            {row.duration && (
                              <span className="text-[10px] text-stone-500">{row.duration}</span>
                            )}
                            {row.recording && (
                              <button
                                type="button"
                                onClick={() => togglePlay(row)}
                                className="px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-bold inline-flex items-center gap-1"
                              >
                                {playing === row.id ? (
                                  <PauseCircle className="w-3 h-3" />
                                ) : (
                                  <PlayCircle className="w-3 h-3" />
                                )}
                                {playing === row.id ? 'Pause' : 'Play'}
                              </button>
                            )}
                          </div>
                          {row.note && (
                            <p className="text-[11px] text-stone-600 italic">{row.note}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {lastCall && (
                  <div className="p-2.5 rounded-lg bg-blue-50/60 border border-blue-200 text-[11px] text-blue-900">
                    <strong>Last contact:</strong> {stamp(lastCall.at)} — {lastCall.status}
                  </div>
                )}

                {target.village && (
                  <div className="p-2.5 rounded-lg bg-white border border-stone-200 text-[11px] text-stone-700 inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-stone-400" />
                    {target.village}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!done && (
          <div className="px-4 py-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-2 shrink-0">
            <span className="text-[11px] text-stone-500 truncate">
              {dialState === 'active'
                ? `Timing this call — ${mmss(seconds)}`
                : seconds > 0
                ? `Duration to record: ${mmss(seconds)}`
                : 'The duration is measured from when you place the call.'}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={closeCall}
                className="px-4 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!canSave}
                className="px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-stone-300 disabled:cursor-not-allowed text-white font-bold inline-flex items-center gap-1.5"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Record call
              </button>
            </div>
          </div>
        )}

        {/* Divert picker */}
        {showDivert && (
          <div className="absolute inset-0 z-20 bg-stone-900/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-sm w-full p-5 space-y-3">
              <h4 className="font-bold text-stone-900 text-sm inline-flex items-center gap-1.5">
                <Shuffle className="w-4 h-4 text-blue-600" /> Divert lead to department
              </h4>
              <p className="text-[11px] text-stone-600">
                The agents desk closes this lead as diverted and records where it went. The
                receiving department picks it up from their own queue.
              </p>
              <select
                value={divertTo}
                onChange={(e) => setDivertTo(e.target.value)}
                className="w-full text-xs bg-white border border-stone-200 rounded-lg px-2.5 py-2"
              >
                {DIVERT_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDivert(false);
                    setResult('Proceed');
                  }}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setShowDivert(false)}
                  className="px-5 py-2 rounded-xl bg-[#2563EB] text-white font-bold"
                >
                  Use {divertTo}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Forward to TL */}
        {showForward && (
          <div className="absolute inset-0 z-20 bg-stone-900/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-md w-full p-5 space-y-3">
              <h4 className="font-bold text-stone-900 text-sm inline-flex items-center gap-1.5">
                <UserRoundPlus className="w-4 h-4 text-amber-600" /> Forward to a team leader
              </h4>
              <p className="text-[11px] text-stone-600">
                The lead moves into the team leader queue with your note attached. A lead can
                only have one open escalation at a time.
              </p>

              <div>
                <label className="text-[10px] text-stone-500 block mb-0.5">Team leader</label>
                <select
                  value={forwardToId}
                  onChange={(e) => setForwardToId(e.target.value)}
                  className="w-full text-xs bg-white border border-stone-200 rounded-lg px-2.5 py-2"
                >
                  <option value="">Whoever picks it up</option>
                  {teamLeaders.map((tl) => (
                    <option key={tl.id} value={tl.id}>
                      {tl.name} — {tl.role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-stone-500 block mb-0.5">Note for them</label>
                <textarea
                  rows={3}
                  value={forwardNote}
                  onChange={(e) => setForwardNote(e.target.value)}
                  placeholder="What does the team leader need to know?"
                  className="w-full text-xs bg-white border border-stone-200 rounded-lg px-2.5 py-2 resize-y"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForward(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={forwardToTeamLeader}
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Forward
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
