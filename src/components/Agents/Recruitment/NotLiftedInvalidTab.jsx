import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Phone,
  PhoneOff,
  PhoneCall,
  PhoneMissed,
  AlertTriangle,
  Search,
  RotateCcw,
  Clock,
  CheckCircle2,
  MessageSquare,
  Edit2,
  Trash2,
  Send,
  RefreshCw,
  Eye,
  Headphones,
  X,
  Archive,
  Lock,
  Timer,
  Play,
  User,
  ShieldCheck,
  Loader2,
} from 'lucide-react';

import PersonAvatar from '../common/PersonAvatar';
import { useAuth } from '../../../context/AuthContext';
import { useRecruitmentDesk } from '../../../hooks/useRecruitmentDesk';
import useAgentLeads from '../../../hooks/useAgentLeads';
import useAgentTeams from '../../../hooks/useAgentTeams';
import agentLeadService from '../../../services/agentLeadService';
import {
  RECOVERY_WHATSAPP_TEMPLATES,
  PREDEFINED_DUMP_REASONS,
  squadLabel,
  sameId,
  digitsOf,
  inRecoveryPool,
  normaliseLead,
  isNotLifted,
  isInvalid,
  localDate,
  clockOf,
} from './recruitmentModel';
import { errorMessage, isMissingEndpoint, BACKEND_UPDATE_HINT } from '../../../utils/apiErrors';

const PAGE_SIZE = 25;
const LOCK_WINDOW_SECONDS = 30;

const phoneTail = (value) => digitsOf(value).slice(-10);

/** What a logged recovery dial amounts to, in the workstation's own vocabulary. */
const outcomeOfAttempt = (attempt) => {
  if (attempt.result === 'Follow Up') return 'Follow Up';
  if (attempt.answer_status === 'Answered') return 'Answered';
  if (attempt.answer_status === 'Invalid Number') return 'Invalid Number';
  return 'Not Lifted';
};

/**
 * Not Lifted & Invalid: the recovery hub.
 *
 * Every lead somebody dialled and could not reach lands here — nobody picked up,
 * or the number does not work. A shared support team works the list directly:
 * there is no allotment, anyone can dial anything. Three views:
 *
 *   Direct Recovery Queue  the open list, with quick outcomes, WhatsApp, a phone
 *                          fix and a dump button on every row
 *   Recovery Workstation   what each specialist has done, from the call log
 *   Dumped                 the archive of leads given up on, restorable
 *
 * Because several specialists can sit at one login, dialling starts a five-second
 * countdown that locks the lead on this desk so two people do not ring the same
 * candidate. It is a courtesy lock for one browser session, not a server lock.
 */
export default function NotLiftedInvalidTab({ onNavigate }) {
  const { user } = useAuth();
  const { teams, employeeById, notifyChanged, callLead, version } = useRecruitmentDesk();
  const recovery = useAgentLeads({ pool: 'recovery' });
  const dumped = useAgentLeads({ pool: 'dumped' });

  /* ── The supporting team ──────────────────────────────────── */

  // Support work belongs to the coordination wing. Where that wing has nobody,
  // fall back to the recruitment callers, and finally to whoever is signed in, so
  // "Calling As" is never empty.
  const coordination = useAgentTeams('coordination');

  const supportingTeamMembers = useMemo(() => {
    const collect = (list, lookup) => {
      const ids = new Set();
      list.forEach((t) => {
        if (t.teamLeaderId) ids.add(String(t.teamLeaderId));
        (t.memberIds || []).forEach((id) => ids.add(String(id)));
      });
      return [...ids].map((id) => lookup.get(id)).filter(Boolean);
    };

    let people = collect(coordination.teams, coordination.employeeById);
    if (!people.length) people = collect(teams, employeeById);
    if (!people.length && user) people = [user];
    return people;
  }, [coordination.teams, coordination.employeeById, teams, employeeById, user]);

  const [chosenCallerId, setChosenCallerId] = useState(null);

  const activeCaller = useMemo(
    () =>
      supportingTeamMembers.find((m) => sameId(m.id, chosenCallerId)) ||
      supportingTeamMembers.find((m) => sameId(m.id, user?.id)) ||
      supportingTeamMembers[0] ||
      null,
    [supportingTeamMembers, chosenCallerId, user]
  );
  const activeCallerName = activeCaller?.name || 'Recovery Team';

  /* ── State ────────────────────────────────────────────────── */

  const [activeTab, setActiveTab] = useState('direct-queue');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [workstationCallerFilter, setWorkstationCallerFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const [dialCountdown, setDialCountdown] = useState(null);
  const [activeLocks, setActiveLocks] = useState({});

  const [editingLead, setEditingLead] = useState(null);
  const [newPhoneValue, setNewPhoneValue] = useState('');
  const [editPhoneNote, setEditPhoneNote] = useState('');
  const [phoneEditError, setPhoneEditError] = useState('');
  const [phoneSaving, setPhoneSaving] = useState(false);

  const [dumpTargetLead, setDumpTargetLead] = useState(null);
  const [selectedDumpReason, setSelectedDumpReason] = useState(PREDEFINED_DUMP_REASONS[0]);
  const [customDumpReason, setCustomDumpReason] = useState('');
  const [dumping, setDumping] = useState(false);

  const [whatsAppModalLead, setWhatsAppModalLead] = useState(null);
  const [modalTemplateId, setModalTemplateId] = useState('missed_call');
  const [modalMessageText, setModalMessageText] = useState('');

  const [selectedDetailLead, setSelectedDetailLead] = useState(null);

  const [toastMessage, setToastMessage] = useState(null);
  const toastTimer = useRef(null);
  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 3500);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  /** A failed write, told plainly — including "this backend predates the feature". */
  const fail = useCallback(
    (err, fallback) =>
      showToast(isMissingEndpoint(err) ? BACKEND_UPDATE_HINT : errorMessage(err, fallback)),
    [showToast]
  );

  /* ── The pools ────────────────────────────────────────────── */

  // Filtered again here as well as on the server: a backend that predates the
  // `pool` parameter returns every active lead, and this list must not.
  const activeRecoveryQueue = useMemo(
    () => recovery.leads.filter(inRecoveryPool),
    [recovery.leads]
  );
  const dumpedLeads = useMemo(() => dumped.leads.filter((l) => l.isDumped), [dumped.leads]);

  const notLiftedCount = useMemo(
    () => activeRecoveryQueue.filter(isNotLifted).length,
    [activeRecoveryQueue]
  );
  const invalidCount = useMemo(
    () => activeRecoveryQueue.filter(isInvalid).length,
    [activeRecoveryQueue]
  );

  const directQueueFilteredLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeRecoveryQueue.filter((l) => {
      if (typeFilter === 'not-lifted' && !isNotLifted(l)) return false;
      if (typeFilter === 'invalid' && !isInvalid(l)) return false;
      if (selectedTeam !== 'all' && !sameId(l.assignedTeamId, selectedTeam)) return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        l.nativeVillage.toLowerCase().includes(q) ||
        l.mandal.toLowerCase().includes(q) ||
        (l.lastCallNote || '').toLowerCase().includes(q)
      );
    });
  }, [activeRecoveryQueue, typeFilter, selectedTeam, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(directQueueFilteredLeads.length / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const paginatedQueueLeads = useMemo(
    () => directQueueFilteredLeads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [directQueueFilteredLeads, page]
  );

  /* ── The workstation: recovery dials from the call log ────── */

  const [attempts, setAttempts] = useState([]);

  useEffect(() => {
    let cancelled = false;
    agentLeadService
      .getCallAttempts({ queue: 'recovery' })
      .then((data) => {
        if (cancelled) return;
        const rows = data.result || data.data || [];
        // Filtered client-side too: an older backend ignores `queue`.
        setAttempts((Array.isArray(rows) ? rows : []).filter((a) => a.queue === 'recovery'));
      })
      .catch((err) => {
        console.error('Failed to load recovery calls:', err);
        if (!cancelled) setAttempts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const allHandledWorkstationRecords = useMemo(() => {
    const fromCalls = attempts.map((a) => ({
      id: `att-${a.id}`,
      leadId: a.candidate_id,
      name: a.candidate?.name || 'Unknown lead',
      phone: a.candidate?.phone || '',
      nativeVillage: a.candidate?.village,
      mandal: a.candidate?.mandal,
      endedById: a.employee_id,
      endedByCaller: a.employee?.name || 'Unattributed',
      outcome: outcomeOfAttempt(a),
      endedAt: a.called_at,
      notes: a.note || 'Recovery dial',
    }));

    // A dump is not a dial, but it is the specialist's last word on a lead, so it
    // belongs in the same ledger.
    const fromDumps = dumpedLeads.map((l) => {
      const who = l.dumpedBy ? employeeById.get(String(l.dumpedBy))?.name : null;
      return {
        id: `dump-${l.id}`,
        leadId: l.id,
        name: l.name,
        phone: l.phone,
        nativeVillage: l.nativeVillage,
        mandal: l.mandal,
        endedById: l.dumpedBy,
        endedByCaller: who || 'Recovery Team',
        outcome: 'Dumped',
        endedAt: l.dumpedAt,
        notes: `Dumped by ${who || 'Recovery Team'}: ${l.dumpReason || 'No response'}`,
      };
    });

    return [...fromCalls, ...fromDumps].sort(
      (a, b) => new Date(b.endedAt || 0) - new Date(a.endedAt || 0)
    );
  }, [attempts, dumpedLeads, employeeById]);

  const filteredWorkstationRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allHandledWorkstationRecords.filter((r) => {
      if (workstationCallerFilter !== 'all' && !sameId(r.endedById, workstationCallerFilter)) {
        return false;
      }
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.phone.includes(q) ||
        r.endedByCaller.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q)
      );
    });
  }, [allHandledWorkstationRecords, workstationCallerFilter, searchQuery]);

  const endedBy = useCallback(
    (member) => allHandledWorkstationRecords.filter((r) => sameId(r.endedById, member.id)).length,
    [allHandledWorkstationRecords]
  );

  /* ── Dialling, with the five-second lock ──────────────────── */

  const executeCallNow = useCallback(
    (lead, caller) => {
      setDialCountdown(null);
      setActiveLocks((prev) => ({
        ...prev,
        [lead.id]: { callerId: caller?.id, callerName: caller?.name, timestamp: Date.now() },
      }));
      callLead(lead, 'recovery', { callerEmployeeId: caller?.id });
      showToast(`📞 Dialing ${lead.name} by ${caller?.name || 'Recovery Team'}...`);
    },
    [callLead, showToast]
  );

  useEffect(() => {
    if (!dialCountdown) return undefined;

    if (dialCountdown.secondsLeft <= 0) {
      executeCallNow(dialCountdown.lead, dialCountdown.caller);
      return undefined;
    }

    const timer = setTimeout(
      () => setDialCountdown((prev) => (prev ? { ...prev, secondsLeft: prev.secondsLeft - 1 } : null)),
      1000
    );
    return () => clearTimeout(timer);
  }, [dialCountdown, executeCallNow]);

  const handleStartCallCountdown = (lead) => {
    const existing = activeLocks[lead.id];
    if (existing && !sameId(existing.callerId, activeCaller?.id)) {
      const elapsed = Math.floor((Date.now() - existing.timestamp) / 1000);
      if (elapsed < LOCK_WINDOW_SECONDS) {
        showToast(`⚠️ ${lead.name} is currently being called by ${existing.callerName}! Please wait.`);
        return;
      }
    }

    setActiveLocks((prev) => ({
      ...prev,
      [lead.id]: { callerId: activeCaller?.id, callerName: activeCallerName, timestamp: Date.now() },
    }));
    setDialCountdown({ lead, secondsLeft: 5, caller: activeCaller });
  };

  const handleCancelCountdown = () => {
    if (dialCountdown) {
      setActiveLocks((prev) => {
        const copy = { ...prev };
        delete copy[dialCountdown.lead.id];
        return copy;
      });
      showToast(`Call countdown cancelled for ${dialCountdown.lead.name}.`);
    }
    setDialCountdown(null);
  };

  /** Re-dial from the workstation, even for a lead no longer in the recovery pool. */
  const handleRedial = async (record) => {
    const inPool = activeRecoveryQueue.find((l) => sameId(l.id, record.leadId));
    if (inPool) {
      handleStartCallCountdown(inPool);
      return;
    }
    try {
      const data = await agentLeadService.getLead(record.leadId);
      const row = data.result || data.data;
      if (row) handleStartCallCountdown(normaliseLead(row, employeeById));
    } catch (err) {
      fail(err, 'Could not open this lead to re-dial it.');
    }
  };

  /* ── Quick outcomes ───────────────────────────────────────── */

  const logRecoveryOutcome = async (lead, answerStatus, note, doneMessage) => {
    try {
      await agentLeadService.logCall({
        leadId: lead.id,
        queue: 'recovery',
        answerStatus,
        note,
        callerEmployeeId: activeCaller?.id,
      });
      showToast(doneMessage);
      notifyChanged();
    } catch (err) {
      fail(err, 'Could not record this outcome.');
    }
  };

  const handleQuickMarkAnswered = (lead) =>
    logRecoveryOutcome(
      lead,
      'Answered',
      'Candidate connected & recovered',
      `🎉 ${lead.name} marked as Answered by ${activeCallerName}! Logged in Workstation.`
    );

  const handleQuickMarkNotLifted = (lead) =>
    logRecoveryOutcome(
      lead,
      'Not Lifted',
      'Ringing no answer on recovery dial',
      `Recorded Not Lifted for ${lead.name} by ${activeCallerName}`
    );

  /* ── Phone fix ────────────────────────────────────────────── */

  const handleOpenPhoneEdit = (lead) => {
    setEditingLead(lead);
    setNewPhoneValue(lead.phone);
    setEditPhoneNote('');
    setPhoneEditError('');
  };

  const handleSavePhoneUpdate = async () => {
    if (!editingLead) return;
    const cleaned = digitsOf(newPhoneValue);
    if (cleaned.length !== 10) {
      setPhoneEditError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setPhoneSaving(true);
    setPhoneEditError('');
    try {
      await agentLeadService.updatePhone(
        editingLead.id,
        cleaned,
        editPhoneNote.trim() ||
          `Phone number verified and updated to ${cleaned} by ${activeCallerName}`
      );
      showToast(`Phone number updated to +91 ${cleaned}`);
      setEditingLead(null);
      notifyChanged();
    } catch (err) {
      setPhoneEditError(
        isMissingEndpoint(err) ? BACKEND_UPDATE_HINT : errorMessage(err, 'Could not update the number.')
      );
    } finally {
      setPhoneSaving(false);
    }
  };

  /* ── WhatsApp ─────────────────────────────────────────────── */

  const handleOpenWhatsAppModal = (lead) => {
    setWhatsAppModalLead(lead);
    setModalTemplateId('missed_call');
    setModalMessageText(RECOVERY_WHATSAPP_TEMPLATES[0].text(lead.name, lead.mandal));
  };

  const handleSelectWhatsAppTemplate = (tplId) => {
    setModalTemplateId(tplId);
    const tpl =
      RECOVERY_WHATSAPP_TEMPLATES.find((t) => t.id === tplId) || RECOVERY_WHATSAPP_TEMPLATES[0];
    if (whatsAppModalLead) {
      setModalMessageText(tpl.text(whatsAppModalLead.name, whatsAppModalLead.mandal));
    }
  };

  const handleSendModalWhatsApp = async () => {
    if (!whatsAppModalLead) return;
    const lead = whatsAppModalLead;
    const tpl =
      RECOVERY_WHATSAPP_TEMPLATES.find((t) => t.id === modalTemplateId) ||
      RECOVERY_WHATSAPP_TEMPLATES[0];

    // Open WhatsApp first: that has to happen inside the click for the browser
    // to allow the new tab, and the log is a record of it, not a precondition.
    const anchor = document.createElement('a');
    anchor.href = `https://wa.me/91${phoneTail(lead.phone)}?text=${encodeURIComponent(modalMessageText)}`;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.click();

    setWhatsAppModalLead(null);
    try {
      await agentLeadService.logWhatsapp(lead.id, {
        templateName: tpl.templateName,
        messageText: modalMessageText,
        callerEmployeeId: activeCaller?.id,
      });
      showToast(`WhatsApp sent & logged in trail for ${lead.name}`);
      notifyChanged();
    } catch (err) {
      fail(err, `WhatsApp opened, but it could not be logged for ${lead.name}.`);
    }
  };

  /* ── Dump / restore ───────────────────────────────────────── */

  const handleOpenDumpModal = (lead) => {
    setDumpTargetLead(lead);
    setSelectedDumpReason(PREDEFINED_DUMP_REASONS[0]);
    setCustomDumpReason('');
  };

  const handleConfirmDump = async () => {
    if (!dumpTargetLead) return;
    const lead = dumpTargetLead;
    const reason = customDumpReason.trim() || selectedDumpReason || PREDEFINED_DUMP_REASONS[0];

    setDumping(true);
    try {
      await agentLeadService.dump(lead.id, { reason, callerEmployeeId: activeCaller?.id });
      showToast(`Lead ${lead.name} moved to Dumped Archive by ${activeCallerName}`);
      setDumpTargetLead(null);
      notifyChanged();
    } catch (err) {
      fail(err, 'Could not dump this lead.');
    } finally {
      setDumping(false);
    }
  };

  const handleRestore = async (lead) => {
    try {
      await agentLeadService.restore(lead.id);
      showToast(`Restored ${lead.name} to active recovery queue`);
      notifyChanged();
    } catch (err) {
      fail(err, 'Could not restore this lead.');
    }
  };

  const resetAll = () => {
    setTypeFilter('all');
    setSelectedTeam('all');
    setSearchQuery('');
    setWorkstationCallerFilter('all');
    setCurrentPage(1);
  };

  const loading = recovery.loading || dumped.loading;

  return (
    <div className="space-y-3.5">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-[1300] bg-stone-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 5-second conflict-prevention countdown */}
      {dialCountdown && (
        <div className="fixed inset-0 z-[1150] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-blue-500 max-w-md w-full p-5 space-y-4 text-center">
            <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-blue-100 animate-ping opacity-75" />
              <div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center font-mono font-bold text-2xl shadow-md">
                {dialCountdown.secondsLeft}s
              </div>
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold mb-1">
                <Lock className="w-3 h-3 text-amber-600" />
                <span>Conflict-Prevention Lock Active</span>
              </div>
              <h3 className="text-base font-bold text-stone-900">
                Connecting Call in {dialCountdown.secondsLeft} Seconds...
              </h3>
              <p className="text-xs text-stone-600 mt-1">
                Calling <b>{dialCountdown.lead.name}</b> (+91 {phoneTail(dialCountdown.lead.phone)})
              </p>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-left text-xs text-blue-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Calling as: {dialCountdown.caller?.name || 'Recovery Team'}</span>
              </div>
              <p className="text-[11px] text-blue-700 leading-relaxed">
                The 5-second buffer prevents other executives from dialing the candidate
                simultaneously to avoid collision.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleCancelCountdown}
                className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel Call</span>
              </button>
              <button
                type="button"
                onClick={() => executeCallNow(dialCountdown.lead, dialCountdown.caller)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Call Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header & caller identity ────────────────────── */}
      <div className="bg-white rounded-xl border border-stone-200 p-3 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-amber-500 to-rose-600 text-white flex items-center justify-center shadow-xs">
              <PhoneMissed className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-sm text-stone-900">Not Lifted &amp; Invalid Recovery</h3>
              <span className="px-2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 font-mono">
                {activeRecoveryQueue.length} In Queue
              </span>
              <span className="px-2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono">
                {allHandledWorkstationRecords.length} Handled
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1 text-xs">
              <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="text-stone-500 font-medium whitespace-nowrap">Calling As:</span>
              <select
                value={activeCaller?.id ?? ''}
                onChange={(e) => {
                  setChosenCallerId(e.target.value);
                  const who = supportingTeamMembers.find((m) => sameId(m.id, e.target.value));
                  showToast(`Active caller switched to ${who?.name || 'caller'}`);
                }}
                disabled={!supportingTeamMembers.length}
                title="Select which support executive is making calls"
                className="bg-white font-bold text-stone-800 border border-stone-200 rounded px-1.5 py-0.5 text-xs"
              >
                {supportingTeamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} (Support)
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={resetAll}
              title="Reset all filters"
              className="px-2.5 py-1 text-xs font-medium text-stone-600 bg-stone-50 hover:bg-stone-100 rounded-lg border border-stone-200 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('calls')}
                className="px-2.5 py-1 text-xs font-medium text-[#2563EB] bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 flex items-center gap-1 transition-colors"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Primary Calls</span>
              </button>
            )}
          </div>
        </div>

        {/* Primary view tabs */}
        <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setActiveTab('direct-queue');
              setCurrentPage(1);
            }}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'direct-queue'
                ? 'bg-white text-stone-900 shadow-2xs border border-stone-200/80'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5 text-blue-600" />
            <span>Direct Recovery Queue</span>
            <span className="px-1.5 rounded-full text-[10px] bg-blue-100 text-blue-800 font-mono font-bold">
              {activeRecoveryQueue.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('workstation')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'workstation'
                ? 'bg-white text-stone-900 shadow-2xs border border-stone-200/80'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Headphones className="w-3.5 h-3.5 text-emerald-600" />
            <span>Recovery Workstation</span>
            <span className="px-1.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-mono font-bold">
              {allHandledWorkstationRecords.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dumped-archive')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'dumped-archive'
                ? 'bg-white text-stone-900 shadow-2xs border border-stone-200/80'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Archive className="w-3.5 h-3.5 text-rose-500" />
            <span>Dumped ({dumpedLeads.length})</span>
          </button>
        </div>

        {/* Supporting team strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-stone-50/80 rounded-lg border border-stone-200 text-xs">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-bold text-stone-700">
              Supporting Team ({supportingTeamMembers.length}{' '}
              {supportingTeamMembers.length === 1 ? 'Specialist' : 'Specialists'}):
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {supportingTeamMembers.map((member) => {
              const isCurrent = sameId(member.id, activeCaller?.id);
              const ended = endedBy(member);
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => {
                    setChosenCallerId(String(member.id));
                    showToast(`Active caller switched to ${member.name}`);
                  }}
                  title={`Click to set ${member.name} as active caller. Handled: ${ended} calls`}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] transition-all ${
                    isCurrent
                      ? 'bg-blue-50 text-blue-900 border-blue-400 ring-1 ring-blue-300 font-bold'
                      : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200'
                  }`}
                >
                  <PersonAvatar name={member.name} photo={member.photo} size="xs" />
                  <span>{member.name}</span>
                  <span className="px-1 bg-stone-100 rounded text-[10px] font-mono text-stone-600">
                    {ended} ended
                  </span>
                  {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {(recovery.error || dumped.error) && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {recovery.error || dumped.error}
        </div>
      )}

      {/* ── VIEW 1: direct recovery queue ───────────────── */}
      {activeTab === 'direct-queue' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden space-y-3 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setTypeFilter('all');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1.5 transition-colors ${
                  typeFilter === 'all'
                    ? 'bg-stone-900 text-white border-stone-900 shadow-2xs'
                    : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                }`}
              >
                <span>All Open</span>
                <span className="px-1.5 rounded-full text-[10px] font-mono font-bold bg-stone-800 text-white">
                  {activeRecoveryQueue.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTypeFilter('not-lifted');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1.5 transition-colors ${
                  typeFilter === 'not-lifted'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                    : 'bg-amber-50/60 border-amber-200 text-amber-900 hover:bg-amber-100'
                }`}
              >
                <PhoneOff className="w-3 h-3" />
                <span>Not Lifted</span>
                <span className="px-1.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-900">
                  {notLiftedCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTypeFilter('invalid');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1.5 transition-colors ${
                  typeFilter === 'invalid'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                    : 'bg-rose-50/60 border-rose-200 text-rose-900 hover:bg-rose-100'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Invalid Numbers</span>
                <span className="px-1.5 rounded-full text-[10px] font-mono font-bold bg-rose-100 text-rose-900">
                  {invalidCount}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2 flex-1 justify-end min-w-[280px]">
              <select
                value={selectedTeam}
                onChange={(e) => {
                  setSelectedTeam(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-xs bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-stone-700 font-medium focus:bg-white"
              >
                <option value="all">All Teams / Squads</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {squadLabel(t)}
                  </option>
                ))}
              </select>

              <div className="relative min-w-[180px] max-w-[240px]">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search candidate, phone, village..."
                  className="w-full text-xs bg-stone-50 border border-stone-200 rounded-lg pl-8 pr-6 py-1 text-stone-800 placeholder-stone-400 focus:bg-white focus:border-blue-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs px-1"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-blue-50/70 border border-blue-200/60 text-blue-900">
            <span className="flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>
                <b>Direct Call &amp; 5-Second Buffer:</b> Clicking call starts a 5-second countdown
                timer, locking the lead so other executives do not dial concurrently.
              </span>
            </span>
            <span className="font-semibold text-stone-600 shrink-0 ml-2">
              Showing {directQueueFilteredLeads.length} leads
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-stone-400">
              <span className="inline-flex items-center gap-2 font-medium text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading…
              </span>
            </div>
          ) : paginatedQueueLeads.length === 0 ? (
            <div className="p-8 text-center text-stone-400 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-70" />
              <p className="text-xs font-semibold text-stone-700">
                No unresolved leads matching this filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-bold text-stone-500 uppercase tracking-wider select-none">
                    <th className="py-2 px-3">Candidate</th>
                    <th className="py-2 px-3">Phone</th>
                    <th className="py-2 px-3">Issue</th>
                    <th className="py-2 px-3">Location</th>
                    <th className="py-2 px-3">Forwarded By / Dials</th>
                    <th className="py-2 px-3">Last Note</th>
                    <th className="py-2 px-3 text-right">Direct Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-xs">
                  {paginatedQueueLeads.map((lead) => {
                    const notLifted = isNotLifted(lead);
                    const invalid = isInvalid(lead);
                    const attemptsCount = lead.callAttempts || 1;
                    const trailCount = lead.whatsappTrail.length;
                    const lock = activeLocks[lead.id];
                    const isCounting = sameId(dialCountdown?.lead.id, lead.id);
                    const lockedByOther =
                      lock &&
                      !sameId(lock.callerId, activeCaller?.id) &&
                      Math.floor((Date.now() - lock.timestamp) / 1000) < LOCK_WINDOW_SECONDS;

                    return (
                      <tr
                        key={lead.id}
                        onClick={() => setSelectedDetailLead(lead)}
                        className={`hover:bg-blue-50/40 transition-colors cursor-pointer group ${
                          isCounting ? 'bg-amber-50/60 ring-1 ring-amber-300' : 'bg-white'
                        }`}
                      >
                        <td className="py-2 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <PersonAvatar name={lead.name} photo={lead.photo} size="xs" />
                            <div className="min-w-0">
                              <span className="font-semibold text-stone-900 group-hover:text-blue-600 transition-colors truncate max-w-[130px] block leading-tight">
                                {lead.name}
                              </span>
                              <span className="text-[10px] font-mono text-stone-400">
                                {lead.code}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-2 px-3 whitespace-nowrap font-mono font-medium text-stone-800">
                          <div className="flex items-center gap-1.5">
                            <span>+91 {phoneTail(lead.phone)}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenPhoneEdit(lead);
                              }}
                              title="Update contact phone number"
                              className="text-stone-400 hover:text-blue-600 p-0.5 rounded"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        <td className="py-2 px-3 whitespace-nowrap">
                          {notLifted ? (
                            <span className="inline-flex items-center gap-1 px-2 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                              <PhoneOff className="w-2.5 h-2.5" />
                              <span>Not Lifted</span>
                            </span>
                          ) : invalid ? (
                            <span className="inline-flex items-center gap-1 px-2 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              <span>Invalid Number</span>
                            </span>
                          ) : (
                            <span className="px-2 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-700">
                              {lead.lastCallStatus || 'Pending'}
                            </span>
                          )}
                        </td>

                        <td className="py-2 px-3 whitespace-nowrap text-stone-600">
                          <span
                            className="truncate max-w-[130px] inline-block"
                            title={`${lead.nativeVillage || 'Village'}, ${lead.mandal || 'Mandal'}`}
                          >
                            {lead.nativeVillage || 'Village'}, {lead.mandal || 'Mandal'}
                          </span>
                        </td>

                        <td className="py-2 px-3 whitespace-nowrap text-stone-600">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-stone-700 truncate max-w-[100px]">
                              {lead.forwardedByCaller || lead.lastAttemptCaller || 'Telecaller'}
                            </span>
                            <span className="text-[10px] font-mono px-1 bg-stone-100 rounded text-stone-600 font-semibold">
                              {attemptsCount} dial{attemptsCount > 1 ? 's' : ''}
                            </span>
                            {trailCount > 0 && (
                              <span className="text-[10px] font-mono px-1 bg-emerald-100 text-emerald-800 rounded flex items-center gap-0.5">
                                <MessageSquare className="w-2.5 h-2.5" />
                                {trailCount}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-2 px-3 whitespace-nowrap text-stone-500">
                          <span className="truncate max-w-[140px] block" title={lead.lastCallNote || ''}>
                            {lead.lastCallNote || 'No notes'}
                          </span>
                        </td>

                        <td
                          className="py-2 px-3 whitespace-nowrap text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            {isCounting ? (
                              <button
                                type="button"
                                onClick={handleCancelCountdown}
                                title="Click to cancel countdown"
                                className="px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold flex items-center gap-1 animate-pulse shadow-2xs"
                              >
                                <Timer className="w-3 h-3" />
                                <span>Calling {dialCountdown.secondsLeft}s (Cancel)</span>
                              </button>
                            ) : lockedByOther ? (
                              <span
                                title={`Currently locked by ${lock.callerName}`}
                                className="px-2 py-1 rounded-md bg-stone-100 text-stone-600 text-[10px] font-bold flex items-center gap-1 border border-stone-200"
                              >
                                <Lock className="w-2.5 h-2.5" />
                                <span>In Call by {String(lock.callerName || '').split(' ')[0]}</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleStartCallCountdown(lead)}
                                disabled={!activeCaller}
                                title={`Direct Call candidate as ${activeCallerName} (5-second conflict prevention)`}
                                className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-colors"
                              >
                                <Phone className="w-3 h-3" />
                                <span>Call</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleQuickMarkAnswered(lead)}
                              title="Mark answered and log in Workstation"
                              className="px-2 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-semibold flex items-center gap-0.5 transition-colors"
                            >
                              <CheckCircle2 className="w-3 h-3 text-blue-600" />
                              <span>Answered</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleQuickMarkNotLifted(lead)}
                              title="Log ringing no answer in Workstation"
                              className="px-2 py-1 rounded-md bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 text-[11px] font-semibold flex items-center gap-0.5 transition-colors"
                            >
                              <PhoneOff className="w-3 h-3 text-stone-500" />
                              <span>No Lift</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenWhatsAppModal(lead)}
                              title="Send WhatsApp recovery message"
                              className="px-2 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-semibold flex items-center gap-1 border border-emerald-200 transition-colors"
                            >
                              <MessageSquare className="w-3 h-3 text-emerald-600" />
                              <span>WA</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenDumpModal(lead)}
                              title="Dump lead to archive"
                              className="p-1 rounded-md text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedDetailLead(lead)}
                              title="Open full lead details"
                              className="px-2 py-1 rounded-md text-stone-600 hover:text-blue-600 bg-stone-100 hover:bg-blue-50 text-[11px] font-medium flex items-center gap-1 transition-colors border border-stone-200"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Open</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {directQueueFilteredLeads.length > PAGE_SIZE && (
            <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600">
              <span>
                Page {page} of {totalPages} ({directQueueFilteredLeads.length} total)
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setCurrentPage(Math.max(1, page - 1))}
                  className="px-2 py-1 rounded border border-stone-200 bg-white disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={page === totalPages}
                  onClick={() => setCurrentPage(Math.min(totalPages, page + 1))}
                  className="px-2 py-1 rounded border border-stone-200 bg-white disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── VIEW 2: recovery workstation ────────────────── */}
      {activeTab === 'workstation' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden space-y-3 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-stone-100">
            <div>
              <h4 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <Headphones className="w-4 h-4 text-emerald-600" />
                <span>Recovery Workstation — Handled &amp; Ended Calls</span>
              </h4>
              <p className="text-[11px] text-stone-500">
                Displays completed calls, call outcome, timestamp, and handling specialist details.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-bold font-mono">
                {allHandledWorkstationRecords.filter((r) => r.outcome === 'Answered').length}{' '}
                Answered &amp; Recovered
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold font-mono">
                {allHandledWorkstationRecords.filter((r) => r.outcome === 'Not Lifted').length} Not
                Lifted
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-stone-700 mr-1">Ended By Caller:</span>
            <button
              type="button"
              onClick={() => setWorkstationCallerFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                workstationCallerFilter === 'all'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
              }`}
            >
              All Specialists ({allHandledWorkstationRecords.length})
            </button>

            {supportingTeamMembers.map((member) => {
              const isSelected = sameId(workstationCallerFilter, member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setWorkstationCallerFilter(String(member.id))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <PersonAvatar name={member.name} photo={member.photo} size="xs" />
                  <span>{member.name}</span>
                  <span
                    className={`px-1 rounded text-[10px] font-mono ${
                      isSelected ? 'bg-emerald-700 text-white' : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    {endedBy(member)}
                  </span>
                </button>
              );
            })}
          </div>

          {filteredWorkstationRecords.length === 0 ? (
            <div className="p-8 text-center text-stone-400 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-70" />
              <p className="text-xs font-semibold text-stone-700">
                No completed calls found for this filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-bold text-stone-500 uppercase tracking-wider select-none">
                    <th className="py-2 px-3">Candidate</th>
                    <th className="py-2 px-3">Phone</th>
                    <th className="py-2 px-3">Ended &amp; Handled By</th>
                    <th className="py-2 px-3">Outcome Status</th>
                    <th className="py-2 px-3">Ended Date &amp; Time</th>
                    <th className="py-2 px-3">Resolution Notes</th>
                    <th className="py-2 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-xs">
                  {filteredWorkstationRecords.map((record) => {
                    const member = supportingTeamMembers.find((m) => sameId(m.id, record.endedById));
                    return (
                      <tr key={record.id} className="hover:bg-stone-50 transition-colors">
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className="font-semibold text-stone-900 block">{record.name}</span>
                          <span className="text-[10px] text-stone-400">
                            {record.nativeVillage || 'Village'}, {record.mandal || 'Mandal'}
                          </span>
                        </td>

                        <td className="py-2 px-3 whitespace-nowrap font-mono font-medium text-stone-800">
                          +91 {phoneTail(record.phone)}
                        </td>

                        <td className="py-2 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <PersonAvatar
                              name={record.endedByCaller}
                              photo={member?.photo || employeeById.get(String(record.endedById))?.photo}
                              size="xs"
                            />
                            <span className="font-bold text-emerald-950">{record.endedByCaller}</span>
                          </div>
                        </td>

                        <td className="py-2 px-3 whitespace-nowrap">
                          {record.outcome === 'Answered' ? (
                            <span className="inline-flex items-center gap-1 px-2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>Answered &amp; Recovered</span>
                            </span>
                          ) : record.outcome === 'Follow Up' ? (
                            <span className="inline-flex items-center gap-1 px-2 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              <Clock className="w-2.5 h-2.5" />
                              <span>Follow Up</span>
                            </span>
                          ) : record.outcome === 'Invalid Number' ? (
                            <span className="inline-flex items-center gap-1 px-2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              <span>Invalid Phone</span>
                            </span>
                          ) : record.outcome === 'Dumped' ? (
                            <span className="inline-flex items-center gap-1 px-2 rounded-full text-[10px] font-bold bg-stone-200 text-stone-700">
                              <Trash2 className="w-2.5 h-2.5" />
                              <span>Dumped</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <PhoneOff className="w-2.5 h-2.5" />
                              <span>Not Lifted</span>
                            </span>
                          )}
                        </td>

                        <td className="py-2 px-3 whitespace-nowrap text-stone-600 font-mono text-[11px]">
                          {localDate(record.endedAt)} · {clockOf(record.endedAt)}
                        </td>

                        <td className="py-2 px-3 whitespace-nowrap text-stone-600">
                          <span className="truncate max-w-[200px] block" title={record.notes}>
                            {record.notes}
                          </span>
                        </td>

                        <td className="py-2 px-3 whitespace-nowrap text-right">
                          <button
                            type="button"
                            onClick={() => handleRedial(record)}
                            className="px-2 py-1 rounded-md bg-stone-100 hover:bg-emerald-50 text-stone-700 hover:text-emerald-800 text-[11px] font-semibold inline-flex items-center gap-1 border border-stone-200 transition-colors"
                          >
                            <Phone className="w-3 h-3 text-emerald-600" />
                            <span>Re-dial</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── VIEW 3: dumped archive ──────────────────────── */}
      {activeTab === 'dumped-archive' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden space-y-3 p-3">
          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
            <h4 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
              <Archive className="w-4 h-4 text-rose-500" />
              <span>Dumped Leads Archive ({dumpedLeads.length})</span>
            </h4>
            <span className="text-xs text-stone-500">
              Leads marked unreachable after maximum recovery attempts
            </span>
          </div>

          {dumpedLeads.length === 0 ? (
            <div className="p-8 text-center text-stone-400">
              <p className="text-xs">No dumped leads in archive.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-bold text-stone-500 uppercase">
                    <th className="py-2 px-3">Candidate</th>
                    <th className="py-2 px-3">Phone</th>
                    <th className="py-2 px-3">Location</th>
                    <th className="py-2 px-3">Dump Reason</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {dumpedLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-rose-50/20">
                      <td className="py-2 px-3 whitespace-nowrap font-medium text-stone-900">
                        {lead.name}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-mono text-stone-700">
                        +91 {phoneTail(lead.phone)}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-stone-600">
                        {lead.nativeVillage || 'Village'}, {lead.mandal || 'Mandal'}
                      </td>
                      <td className="py-2 px-3 text-stone-500">
                        {lead.dumpReason || lead.lastCallNote || 'No response after recovery'}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRestore(lead)}
                          className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-[11px] font-bold inline-flex items-center gap-1 border border-emerald-200"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Restore Lead</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modal: update phone ─────────────────────────── */}
      {editingLead && (
        <div className="fixed inset-0 z-[1100] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h4 className="font-bold text-sm text-stone-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-600" />
                <span>Update Contact Phone Number</span>
              </h4>
              <button
                type="button"
                onClick={() => setEditingLead(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-stone-600 font-semibold mb-1">Candidate Name</label>
                <div className="p-2 bg-stone-50 rounded-lg border border-stone-200 font-semibold text-stone-800">
                  {editingLead.name} ({editingLead.code})
                </div>
              </div>

              <div>
                <label className="block text-stone-600 font-semibold mb-1">
                  New Mobile Number (10 Digits)
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  value={newPhoneValue}
                  onChange={(e) => setNewPhoneValue(e.target.value)}
                  placeholder="Enter 10-digit mobile number"
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg font-mono text-sm focus:bg-white focus:border-blue-500"
                />
                {phoneEditError && (
                  <p className="text-rose-600 text-[11px] mt-1 font-semibold">{phoneEditError}</p>
                )}
              </div>

              <div>
                <label className="block text-stone-600 font-semibold mb-1">Verification Note</label>
                <textarea
                  rows={2}
                  value={editPhoneNote}
                  onChange={(e) => setEditPhoneNote(e.target.value)}
                  placeholder="How was this new number obtained?"
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:bg-white focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setEditingLead(null)}
                className="px-3 py-1.5 rounded-lg border border-stone-200 text-stone-600 text-xs font-semibold hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePhoneUpdate}
                disabled={phoneSaving}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5"
              >
                {phoneSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Phone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: WhatsApp composer ────────────────────── */}
      {whatsAppModalLead && (
        <div className="fixed inset-0 z-[1100] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h4 className="font-bold text-sm text-stone-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <span>Send WhatsApp Recovery Message</span>
              </h4>
              <button
                type="button"
                onClick={() => setWhatsAppModalLead(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-stone-600 font-semibold mb-1">
                  Select Message Template
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {RECOVERY_WHATSAPP_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleSelectWhatsAppTemplate(tpl.id)}
                      className={`p-2 text-left rounded-lg border text-[11px] font-semibold transition-all ${
                        modalTemplateId === tpl.id
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-400'
                          : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      {tpl.title}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-stone-600 font-semibold mb-1">Message Preview</label>
                <textarea
                  rows={4}
                  value={modalMessageText}
                  onChange={(e) => setModalMessageText(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-lg text-xs leading-relaxed focus:bg-white focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setWhatsAppModalLead(null)}
                className="px-3 py-1.5 rounded-lg border border-stone-200 text-stone-600 text-xs font-semibold hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendModalWhatsApp}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Open WhatsApp &amp; Log Trail</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: dump confirmation ────────────────────── */}
      {dumpTargetLead && (
        <div className="fixed inset-0 z-[1100] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h4 className="font-bold text-sm text-stone-900 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Dump Lead to Archive</span>
              </h4>
              <button
                type="button"
                onClick={() => setDumpTargetLead(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-stone-600">
                Are you sure you want to move <b>{dumpTargetLead.name}</b> (+91{' '}
                {phoneTail(dumpTargetLead.phone)}) to the dumped archive?
              </p>

              <div>
                <label className="block text-stone-600 font-semibold mb-1">Select Dump Reason</label>
                <select
                  value={selectedDumpReason}
                  onChange={(e) => setSelectedDumpReason(e.target.value)}
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:bg-white"
                >
                  {PREDEFINED_DUMP_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-stone-600 font-semibold mb-1">
                  Additional Note (Optional)
                </label>
                <textarea
                  rows={2}
                  value={customDumpReason}
                  onChange={(e) => setCustomDumpReason(e.target.value)}
                  placeholder="Specific remarks..."
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setDumpTargetLead(null)}
                className="px-3 py-1.5 text-xs text-stone-600 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDump}
                disabled={dumping}
                className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded-lg inline-flex items-center gap-1.5"
              >
                {dumping && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Dump
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: lead detail ──────────────────────────── */}
      {selectedDetailLead && (
        <div className="fixed inset-0 z-[1100] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <PersonAvatar
                  name={selectedDetailLead.name}
                  photo={selectedDetailLead.photo}
                  size="sm"
                />
                <div>
                  <h4 className="font-bold text-sm text-stone-900">{selectedDetailLead.name}</h4>
                  <p className="text-[11px] font-mono text-stone-500">
                    ID: {selectedDetailLead.code} · +91 {phoneTail(selectedDetailLead.phone)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetailLead(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-2.5 bg-stone-50 rounded-xl border border-stone-200">
                <div>
                  <span className="text-stone-500 text-[10px] block">Location</span>
                  <span className="font-semibold text-stone-800">
                    {selectedDetailLead.nativeVillage || 'Village'},{' '}
                    {selectedDetailLead.mandal || 'Mandal'}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 text-[10px] block">Last Status</span>
                  <span className="font-semibold text-stone-800">
                    {selectedDetailLead.lastCallStatus || 'Pending'}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 text-[10px] block">Call Attempts</span>
                  <span className="font-semibold text-stone-800">
                    {selectedDetailLead.callAttempts || 1} attempts
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 text-[10px] block">Forwarded By</span>
                  <span className="font-semibold text-stone-800">
                    {selectedDetailLead.forwardedByCaller || 'Telecaller'}
                  </span>
                </div>
              </div>

              <div>
                <span className="font-bold text-stone-700 block mb-1">Last Call Remarks:</span>
                <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200 text-stone-700 leading-relaxed">
                  {selectedDetailLead.lastCallNote ||
                    'No specific notes recorded on previous attempt.'}
                </div>
              </div>

              {selectedDetailLead.whatsappTrail.length > 0 && (
                <div>
                  <span className="font-bold text-stone-700 block mb-1">
                    WhatsApp Communications:
                  </span>
                  <div className="space-y-1.5">
                    {selectedDetailLead.whatsappTrail.map((item) => (
                      <div
                        key={item.id}
                        className="p-2 rounded-lg bg-emerald-50/60 border border-emerald-200 text-[11px]"
                      >
                        <div className="flex justify-between font-bold text-emerald-950 mb-0.5">
                          <span>{item.templateName}</span>
                          <span className="font-mono text-[10px] opacity-75">
                            {localDate(item.sentAt)} {clockOf(item.sentAt)}
                          </span>
                        </div>
                        <p className="text-emerald-900">{item.messageText}</p>
                        {item.sentBy && (
                          <p className="text-[10px] text-emerald-700 mt-0.5">Sent by {item.sentBy}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => {
                  const lead = selectedDetailLead;
                  setSelectedDetailLead(null);
                  handleOpenWhatsAppModal(lead);
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold flex items-center gap-1 border border-emerald-200"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDetailLead(null)}
                  className="px-3 py-1.5 rounded-lg border border-stone-200 text-stone-600 text-xs font-semibold hover:bg-stone-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const lead = selectedDetailLead;
                    setSelectedDetailLead(null);
                    handleStartCallCountdown(lead);
                  }}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call (5s Buffer)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
