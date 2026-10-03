import { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Check,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  FileText,
  FileCheck2,
  Eye,
  Upload,
  Receipt,
  AlertTriangle,
  MapPin,
  Building2,
  Phone,
  Save,
  Search,
  Loader2,
  Clock,
  Navigation,
  Printer,
  Sparkles,
  Table as TableIcon,
  Map as MapIcon,
} from 'lucide-react';

import PersonAvatar from '../common/PersonAvatar';
import InteractiveMap from '../maps/InteractiveMap';
import useVillageLocations from '../../../hooks/useVillageLocations';
import useLocationTree from '../../../hooks/useLocationTree';
import { getProgress, setProgress, clearProgress } from './onboardingProgress';
import { REGIONAL_OFFICES, DEFAULT_REGIONAL_OFFICE } from './recruitmentConstants';
import agentLeadService from '../../../services/agentLeadService';
import callingService from '../../../services/callingService';
import { errorMessage } from '../../../utils/apiErrors';

const STEPS = [
  { n: 1, label: 'Candidate' },
  { n: 2, label: 'Village' },
  { n: 3, label: 'Agreement & Fee' },
  { n: 4, label: 'Attachment' },
];

const NEXT_LABELS = {
  1: 'Next → Village',
  2: 'Next → Agreement & Fee',
  3: 'Next → Complete Attachment',
};

const DEPOSIT_TIERS = [
  { label: '₹5,000 (Standard Security Deposit)', amount: 5000 },
  { label: '₹10,000', amount: 10000 },
  { label: '₹15,000', amount: 15000 },
  { label: '₹2,500 (Sub-Agent)', amount: 2500 },
];

const PAYMENT_MODES = ['UPI', 'Bank Transfer', 'Cash', 'Cheque'];

const norm = (v) => String(v || '').trim().toLowerCase();
const uniqueSorted = (list) => [...new Set(list.filter(Boolean))].sort((a, b) => a.localeCompare(b));
const inr = (v) => `₹${(Number(v) || 0).toLocaleString('en-IN')}`;
const todayISO = () => new Date().toISOString().slice(0, 10);
const sameName = (a, b) => norm(a) === norm(b);
const withName = (list, name) => (list.some((v) => sameName(v, name)) ? list : [...list, name]);
const withoutName = (list, name) => list.filter((v) => !sameName(v, name));

const inputCls =
  'w-full px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-stone-800 text-xs focus:border-[#2563EB]';
const selectCls =
  'w-full px-2 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-semibold text-stone-800 focus:border-[#2563EB]';

/**
 * Prints one element on its own. The page's own stylesheets are copied into a
 * throwaway iframe so the printout keeps its layout; calling window.print() on
 * the page would print the whole desk behind the dialog.
 */
const printElement = (element, title) => {
  if (!element) return;
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);

  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(`<!doctype html><html><head><title>${title}</title></head><body></body></html>`);
  doc.close();

  document
    .querySelectorAll('style, link[rel="stylesheet"]')
    .forEach((node) => doc.head.appendChild(node.cloneNode(true)));
  doc.body.innerHTML = `<div class="text-xs" style="padding:24px">${element.innerHTML}</div>`;

  // Let the cloned stylesheets apply before the print dialog opens.
  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 1000);
  }, 300);
};

/**
 * The four things that must be true before a candidate becomes an agent:
 * who they are and their KYC, which village seat they take, the signed deed
 * and the deposit, and a final review.
 *
 * Nothing is written until step 4. The server then does it in one transaction,
 * so a half-finished onboarding cannot leave a seat marked filled with nobody
 * in it.
 *
 * The load-bearing rule is the native-village quota: if their own village has
 * no open slot they can still be appointed against another village, with the
 * native one held on a waiting list — which does NOT consume its seat.
 */
export default function OnboardingWizard({ lead, onClose, onDone }) {
  const { villages, loading: villagesLoading } = useVillageLocations({});
  const tree = useLocationTree();

  // Reopening a candidate lands on the step they got to, with everything
  // before it already ticked off.
  const resumeAt = getProgress(lead.id) || 1;
  const [step, setStep] = useState(resumeAt);
  const [completed, setCompleted] = useState(() =>
    Array.from({ length: Math.max(0, resumeAt - 1) }, (_, i) => i + 1)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [toast, setToast] = useState(null);
  const [dialState, setDialState] = useState('idle');

  // Part 1
  const [villageSearch, setVillageSearch] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [customVillage, setCustomVillage] = useState(false);
  const [linkOpen, setLinkOpen] = useState({});

  // Part 2
  const [part2View, setPart2View] = useState('list');
  const [step2Search, setStep2Search] = useState('');
  const [step2District, setStep2District] = useState('All');
  const [step2Mandal, setStep2Mandal] = useState('All');
  const [inspected, setInspected] = useState(null);

  // Part 3 previews
  const [viewingAgreement, setViewingAgreement] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState(false);
  const previewRef = useRef(null);

  const scheduledVisit = useMemo(
    () => (lead.officeVisits || []).find((v) => v.status === 'Scheduled'),
    [lead]
  );

  const [form, setForm] = useState(() => {
    // The villages they registered interest in, other than their own, start out
    // as the "other chosen" set — the desk can then add to or trim it.
    const nativeName = lead.village || '';
    const others = [
      ...new Set(
        (lead.interests || [])
          .map((i) => i.village)
          .filter((v) => v && !sameName(v, nativeName))
      ),
    ];

    return {
      name: lead.name || '',
      phone: lead.phone || '',
      whatsapp: lead.alternate_phone || lead.phone || '',
      nativeVillage: nativeName,
      mandal: lead.mandal || '',
      district: lead.district || '',
      state: lead.state || '',
      houseNumber: '',
      address: '',
      pinCode: '',

      regionalOffice: scheduledVisit?.regional_office || DEFAULT_REGIONAL_OFFICE,
      visitDate: scheduledVisit?.visit_date || todayISO(),
      visitTime: scheduledVisit?.visit_time || '11:00 AM',

      idProofVerified: false,
      idProofUrl: '',
      addressProofVerified: false,
      addressProofUrl: '',
      otherDocVerified: false,

      nativeVillageAction: 'direct_attach',
      nativeVillageQueueReason: '',
      otherChosenVillages: others,
      selectedAgreementVillages: [],

      agreementPrepared: false,
      agreementSigned: false,
      agreementDate: todayISO(),
      agreementUrl: '',

      feeAmount: 5000,
      paymentMode: 'Cash',
      paymentDate: todayISO(),
      referenceNo: '',
      receiptNo: `RCPT-${String(lead.id).padStart(5, '0')}`,
    };
  });

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  /* ── Vacancy ─────────────────────────────────────────────── */

  const villageByName = useMemo(() => {
    const map = new Map();
    villages.forEach((v) => map.set(norm(v.name), v));
    return map;
  }, [villages]);

  const nativeData = villageByName.get(norm(form.nativeVillage));
  const nativeVacancy = nativeData?.vacancy ?? 0;
  const nativeHasSlot = nativeVacancy > 0;

  // Default to whatever the quota actually allows, once it is known.
  useEffect(() => {
    if (!nativeData) return;
    set({ nativeVillageAction: nativeHasSlot ? 'direct_attach' : 'queue' });
    // Only when the native village's quota first resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nativeData?.id]);

  // Seed the agreement with whatever is actually attachable.
  useEffect(() => {
    if (form.selectedAgreementVillages.length) return;
    const seed =
      form.nativeVillageAction === 'direct_attach' && form.nativeVillage
        ? [form.nativeVillage]
        : form.otherChosenVillages.slice(0, 1);
    if (seed.length) set({ selectedAgreementVillages: seed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.nativeVillageAction, form.otherChosenVillages.length]);

  /** Everything that can go in the deed: the native village (unless queued) plus the chosen ones. */
  const agreementCandidates = useMemo(() => {
    const names = [];
    if (form.nativeVillageAction === 'direct_attach' && form.nativeVillage) names.push(form.nativeVillage);
    form.otherChosenVillages.forEach((v) => {
      if (!names.some((n) => sameName(n, v))) names.push(v);
    });
    return names;
  }, [form.nativeVillageAction, form.nativeVillage, form.otherChosenVillages]);

  /** The village the agent is actually seated in — never a queued native one. */
  const primaryVillage = useMemo(() => {
    const picked = form.selectedAgreementVillages;
    if (form.nativeVillageAction === 'queue') {
      return picked.find((v) => !sameName(v, form.nativeVillage)) || '';
    }
    return picked[0] || form.nativeVillage || '';
  }, [form.selectedAgreementVillages, form.nativeVillageAction, form.nativeVillage]);

  const primaryData = villageByName.get(norm(primaryVillage));
  // Only a village the map knows can be reported full; an unmapped one is the
  // server's call to accept or refuse.
  const primaryIsFull = Boolean(primaryData) && primaryData.vacancy <= 0;

  /* ── Part 1: where they live ─────────────────────────────── */

  const stateOptions = useMemo(
    () => uniqueSorted([...tree.states.map((s) => s.name), ...villages.map((v) => v.state), form.state]),
    [tree.states, villages, form.state]
  );

  const districtOptions = useMemo(
    () =>
      uniqueSorted([
        ...tree.districtsOf(form.state).map((d) => d.name),
        ...villages.filter((v) => sameName(v.state, form.state)).map((v) => v.district),
        form.district,
      ]),
    [tree, villages, form.state, form.district]
  );

  const mandalOptions = useMemo(
    () =>
      uniqueSorted([
        ...tree.mandalsOf(form.state, form.district).map((m) => m.name),
        ...villages
          .filter((v) => sameName(v.state, form.state) && sameName(v.district, form.district))
          .map((v) => v.mandal),
        form.mandal,
      ]),
    [tree, villages, form.state, form.district, form.mandal]
  );

  const villageOptions = useMemo(
    () =>
      uniqueSorted([
        ...tree.villagesOf(form.state, form.district, form.mandal).map((v) => v.name),
        ...villages
          .filter(
            (v) =>
              sameName(v.state, form.state) &&
              sameName(v.district, form.district) &&
              sameName(v.mandal, form.mandal)
          )
          .map((v) => v.name),
      ]),
    [tree, villages, form.state, form.district, form.mandal]
  );

  const searchMatches = useMemo(() => {
    const q = norm(villageSearch);
    if (!q) return [];
    const found = new Map();
    const add = (v) => {
      const key = `${norm(v.name)}|${norm(v.mandal)}|${norm(v.district)}`;
      if (!found.has(key)) found.set(key, v);
    };

    villages
      .filter((v) => norm(v.name).includes(q) || norm(v.mandal).includes(q))
      .forEach((v) => add({ name: v.name, mandal: v.mandal, district: v.district, state: v.state }));

    // The map only holds villages that were synced for recruitment; the tree
    // holds all of them.
    if (found.size < 10) {
      tree.states.forEach((s) =>
        tree.districtsOf(s.name).forEach((d) =>
          tree.mandalsOf(s.name, d.name).forEach((m) =>
            tree.villagesOf(s.name, d.name, m.name).forEach((v) => {
              if (norm(v.name).includes(q)) {
                add({ name: v.name, mandal: m.name, district: d.name, state: s.name });
              }
            })
          )
        )
      );
    }
    return [...found.values()].slice(0, 10);
  }, [villageSearch, villages, tree]);

  const selectNativeLocation = (loc) => {
    set({
      nativeVillage: loc.name,
      mandal: loc.mandal || form.mandal,
      district: loc.district || form.district,
      state: loc.state || form.state,
      address: form.address || `${loc.name}, ${loc.mandal} Mandal, ${loc.district} Dist, ${loc.state}`,
    });
    setVillageSearch('');
    setShowSearchResults(false);
    setCustomVillage(false);
  };

  const flash = (message, ms = 3500) => {
    setToast(message);
    setTimeout(() => setToast(null), ms);
  };

  /* ── Part 2: villages to add ─────────────────────────────── */

  const step2Districts = useMemo(
    () => uniqueSorted(villages.map((v) => v.district)),
    [villages]
  );
  const step2Mandals = useMemo(
    () =>
      uniqueSorted(
        villages
          .filter((v) => step2District === 'All' || v.district === step2District)
          .map((v) => v.mandal)
      ),
    [villages, step2District]
  );

  const step2Villages = useMemo(() => {
    const q = norm(step2Search);
    return villages
      .filter((v) => {
        if (step2District !== 'All' && v.district !== step2District) return false;
        if (step2Mandal !== 'All' && v.mandal !== step2Mandal) return false;
        if (!q) return true;
        return norm(v.name).includes(q) || norm(v.mandal).includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [villages, step2Search, step2District, step2Mandal]);

  const isChosenOther = (name) => form.otherChosenVillages.some((v) => sameName(v, name));

  // Choosing a village adds it to the deed too; removing it takes it back out.
  const toggleOtherVillage = (name) => {
    setForm((prev) => {
      const chosen = prev.otherChosenVillages.some((v) => sameName(v, name));
      return {
        ...prev,
        otherChosenVillages: chosen ? withoutName(prev.otherChosenVillages, name) : [...prev.otherChosenVillages, name],
        selectedAgreementVillages: chosen
          ? withoutName(prev.selectedAgreementVillages, name)
          : withName(prev.selectedAgreementVillages, name),
      };
    });
  };

  /* ── Step gating ─────────────────────────────────────────── */

  const stepValid = {
    1: Boolean(form.name.trim() && form.phone.trim() && form.nativeVillage && form.idProofVerified),
    2:
      form.nativeVillageAction === 'direct_attach'
        ? Boolean(form.nativeVillage)
        : Boolean(form.nativeVillageQueueReason.trim()) && form.otherChosenVillages.length > 0,
    3: Boolean(
      form.agreementSigned &&
        form.selectedAgreementVillages.length > 0 &&
        form.referenceNo.trim() &&
        primaryVillage
    ),
    4: !primaryIsFull,
  };

  const step1Blocker = !form.name.trim() || !form.phone.trim()
    ? 'Name and phone are required.'
    : !form.nativeVillage
    ? 'Choose the candidate’s native village.'
    : !form.idProofVerified
    ? 'ID proof must be verified before continuing.'
    : null;

  const goTo = (n) => {
    setProgress(lead.id, n);
    setStep(n);
  };

  const goNext = () => {
    if (!stepValid[step]) return;
    setCompleted((prev) => (prev.includes(step) ? prev : [...prev, step]));
    goTo(Math.min(4, step + 1));
  };

  const saveDraft = (andClose = false) => {
    // Only the step reached is persisted, and only in this browser. Saying so
    // matters: nothing reaches the server until Complete Attachment, so a
    // colleague on another desk will not see this draft.
    setProgress(lead.id, step);
    flash(`✓ Progress saved for Step ${step} on this device`, 2500);
    if (andClose) setTimeout(() => onClose?.(), 350);
  };

  const handleCall = async () => {
    if (!form.phone) return;
    setDialState('dialing');
    try {
      await callingService.clickToCall({
        customerNumber: form.phone,
        departmentType: 'agents',
        callerName: form.name,
        missionContext: `Onboarding — ${form.name}`,
      });
      setDialState('placed');
    } catch {
      setDialState('failed');
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    setError(null);
    try {
      const data = await agentLeadService.onboard({
        candidateId: lead.id,
        village: primaryVillage,
        mandal: form.mandal,
        district: form.district,
        state: form.state,
        address: [form.houseNumber, form.address, form.pinCode].filter(Boolean).join(', '),

        nativeVillageAction: form.nativeVillageAction,
        nativeVillageQueueReason: form.nativeVillageQueueReason.trim() || undefined,
        agreementVillages: form.selectedAgreementVillages,

        membershipAmount: 0,
        securityDeposit: form.feeAmount,
        paymentMode: form.paymentMode.toUpperCase().replace(/ /g, '_'),
        referenceNo: form.referenceNo.trim() || undefined,
        receiptNo: form.receiptNo.trim() || undefined,
        agreementDate: form.agreementDate,

        idProofUploaded: form.idProofVerified,
        idProofUrl: form.idProofUrl.trim() || undefined,
        addressProofUploaded: form.addressProofVerified,
        addressProofUrl: form.addressProofUrl.trim() || undefined,
        agreementUploaded: form.agreementSigned,
        agreementUrl: form.agreementUrl.trim() || undefined,
      });
      setResult(data.result);
      // They are an agent now — the draft would otherwise offer to "resume"
      // an onboarding that has already happened.
      clearProgress(lead.id);
      onDone?.();
    } catch (err) {
      setError(errorMessage(err, 'Could not complete the attachment.'));
    } finally {
      setSaving(false);
    }
  };

  const territoryLabel = form.selectedAgreementVillages.join(', ') || primaryVillage || 'Selected Villages';

  /* ── Done ────────────────────────────────────────────────── */

  if (result) {
    const agent = result.agent || {};
    return (
      <Shell onClose={onClose}>
        <div className="p-8 space-y-4 overflow-y-auto">
          <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-1.5">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <div className="font-bold text-base text-emerald-900">
              {result.alreadyOnboarded ? 'This candidate was already an agent' : 'Attachment complete'}
            </div>
            <div className="text-sm text-emerald-800">
              {agent.name} · AG{String(agent.id).padStart(5, '0')} · {agent.village}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <Tile label="Seat filled" value={result.seat ? `#${result.seat.position_number}` : '—'} />
            <Tile label="Deposit" value={inr(agent.security_deposit)} />
            <Tile label="Native village" value={agent.native_village_queued ? 'Queued' : 'Attached'} />
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-lg bg-stone-900 text-white text-sm font-bold hover:bg-stone-800"
          >
            Close
          </button>
        </div>
      </Shell>
    );
  }

  /* ── Wizard ──────────────────────────────────────────────── */

  return (
    <Shell onClose={onClose}>
      {/* Top bar: who, and the actions that leave the wizard */}
      <div className="h-14 px-5 border-b border-stone-200 flex items-center justify-between bg-white shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <PersonAvatar name={form.name} photo={lead.photo} size={36} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-stone-900 text-sm tracking-tight truncate">
                {form.name || 'Direct Agent Onboarding'}
              </h2>
              {form.phone && <span className="font-mono text-stone-500 text-xs">({form.phone})</span>}
            </div>
            <p className="text-[11px] text-stone-500 flex flex-wrap items-center gap-1.5 mt-0.5">
              <span>
                Native: <strong className="text-stone-800">{form.nativeVillage || '—'}</strong>
              </span>
              {form.nativeVillageAction === 'queue' ? (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  Queue (Standby)
                </span>
              ) : (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                  Direct Attach
                </span>
              )}
              <span>•</span>
              <span>
                Attached Territory:{' '}
                <strong className="text-blue-700">{primaryVillage || 'not set'}</strong>
              </span>
              <span>•</span>
              <span>Office: {form.regionalOffice}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => saveDraft(true)}
            title="Save progress and close modal"
            className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Save className="w-3.5 h-3.5 text-emerald-700" />
            <span>Save &amp; Close</span>
          </button>
          <button
            type="button"
            onClick={handleCall}
            disabled={dialState === 'dialing' || !form.phone}
            className="px-2.5 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-700 font-medium text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {dialState === 'dialing' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Phone className="w-3.5 h-3.5 text-[#2563EB]" />
            )}
            <span className="hidden sm:inline">{dialState === 'placed' ? 'Called' : 'Call'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stepper */}
      <div className="px-6 py-2.5 bg-stone-50 border-b border-stone-200 shrink-0 overflow-x-auto">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          {STEPS.map((s, i) => {
            const done = completed.includes(s.n) && step !== s.n;
            const active = step === s.n;
            const reachable = done || active || completed.includes(s.n - 1);
            return (
              <div key={s.n} className="contents">
                <button
                  type="button"
                  disabled={!reachable}
                  onClick={() => reachable && setStep(s.n)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full font-semibold text-xs transition-all disabled:cursor-default ${
                    active
                      ? 'bg-[#2563EB] text-white shadow-xs'
                      : done
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                      : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {done ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                        active ? 'bg-white/20' : 'bg-stone-100 text-stone-700'
                      }`}
                    >
                      {s.n}
                    </span>
                  )}
                  <span>{s.label}</span>
                </button>
                {i < STEPS.length - 1 && <span className="text-stone-300 font-bold">→</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Working area */}
      <div className="flex-1 p-5 md:p-6 bg-stone-50/70 overflow-y-auto">
        {error && (
          <div className="max-w-4xl mx-auto mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {/* ── PART 1 ─────────────────────────────────── */}
        {step === 1 && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: candidate */}
              <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                  <h3 className="font-bold text-stone-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-50 text-[#2563EB] font-bold text-[10px] flex items-center justify-center">
                      1
                    </span>
                    Candidate Details
                  </h3>
                  <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    In-Person Visit
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <SquarePhoto name={form.name} photo={lead.photo} className="w-14 h-14" />
                  <div className="space-y-1 flex-1">
                    <Label>Full Name *</Label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => set({ name: e.target.value })}
                      className={`${inputCls} font-bold text-stone-900`}
                      placeholder="e.g. Ramesh Reddy"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Phone Number *</Label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => set({ phone: e.target.value })}
                      className={`${inputCls} font-mono`}
                      placeholder="10-digit mobile"
                    />
                  </div>
                  <div>
                    <Label>WhatsApp Number</Label>
                    <input
                      type="tel"
                      value={form.whatsapp}
                      onChange={(e) => set({ whatsapp: e.target.value })}
                      className={`${inputCls} font-mono bg-stone-50`}
                      placeholder="Same as mobile"
                    />
                  </div>
                </div>

                {/* Native village & location */}
                <div className="p-3.5 bg-blue-50/40 rounded-xl border border-blue-200/80 space-y-3">
                  <div className="flex items-center justify-between pb-1.5 border-b border-blue-100 gap-2">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-[#2563EB]" />
                      <label className="text-[11px] font-bold text-stone-900 uppercase tracking-wide">
                        Candidate Native Village &amp; Location Search *
                      </label>
                    </div>
                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full shrink-0">
                      State → District → Mandal → Village
                    </span>
                  </div>

                  <div className="relative">
                    <label className="text-[10px] font-semibold text-stone-600 block mb-1">
                      Quick Village Search (Type to find village / mandal)
                    </label>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        value={villageSearch}
                        onFocus={() => setShowSearchResults(true)}
                        onBlur={() => setTimeout(() => setShowSearchResults(false), 150)}
                        onChange={(e) => {
                          setVillageSearch(e.target.value);
                          setShowSearchResults(true);
                        }}
                        placeholder="Type village name (e.g. Nandikandi, Kandi, Marpalle, Chevella)..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs text-stone-900 focus:border-[#2563EB] focus:ring-1 focus:ring-blue-500"
                      />
                      {villageSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setVillageSearch('');
                            setShowSearchResults(false);
                          }}
                          className="absolute right-2.5 top-2 text-stone-400 hover:text-stone-600 text-xs font-bold"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {showSearchResults && searchMatches.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white rounded-lg border border-stone-200 shadow-lg max-h-48 overflow-y-auto divide-y divide-stone-100">
                        {searchMatches.map((v) => (
                          <button
                            key={`${v.name}|${v.mandal}|${v.district}`}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectNativeLocation(v)}
                            className="w-full px-3 py-2 text-left text-xs hover:bg-blue-50 flex items-center justify-between group transition-colors"
                          >
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3 h-3 text-[#2563EB] shrink-0" />
                              <span className="font-bold text-stone-900 group-hover:text-blue-700">
                                {v.name}
                              </span>
                              <span className="text-stone-500 text-[11px]">
                                ({v.mandal} Mandal, {v.district} Dist)
                              </span>
                            </div>
                            <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              Select
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-stone-600 block mb-1">
                      Or Select Step-by-Step (State → District → Mandal → Village):
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="text-[9px] font-semibold text-stone-500 uppercase block mb-0.5">
                          State
                        </label>
                        <select
                          value={form.state}
                          onChange={(e) =>
                            set({ state: e.target.value, district: '', mandal: '', nativeVillage: '' })
                          }
                          className={selectCls}
                        >
                          <option value="">Select…</option>
                          {stateOptions.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] font-semibold text-stone-500 uppercase block mb-0.5">
                          District *
                        </label>
                        <select
                          value={form.district}
                          onChange={(e) => set({ district: e.target.value, mandal: '', nativeVillage: '' })}
                          className={selectCls}
                        >
                          <option value="">Select…</option>
                          {districtOptions.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] font-semibold text-stone-500 uppercase block mb-0.5">
                          Mandal *
                        </label>
                        <select
                          value={form.mandal}
                          onChange={(e) => set({ mandal: e.target.value, nativeVillage: '' })}
                          className={selectCls}
                        >
                          <option value="">Select…</option>
                          {mandalOptions.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] font-semibold text-stone-500 uppercase block mb-0.5">
                          Village *
                        </label>
                        {!customVillage ? (
                          <select
                            value={form.nativeVillage}
                            onChange={(e) => {
                              if (e.target.value === '__custom__') {
                                setCustomVillage(true);
                                set({ nativeVillage: '' });
                              } else {
                                selectNativeLocation({
                                  name: e.target.value,
                                  mandal: form.mandal,
                                  district: form.district,
                                  state: form.state,
                                });
                              }
                            }}
                            className={`${selectCls} font-bold text-stone-900`}
                          >
                            <option value="">-- Choose Village --</option>
                            {villageOptions.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                            {form.nativeVillage && !villageOptions.some((v) => sameName(v, form.nativeVillage)) && (
                              <option value={form.nativeVillage}>{form.nativeVillage} (Current)</option>
                            )}
                            <option value="__custom__">+ Enter Custom Village...</option>
                          </select>
                        ) : (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              autoFocus
                              value={form.nativeVillage}
                              onChange={(e) => set({ nativeVillage: e.target.value })}
                              placeholder="Village name..."
                              className="w-full px-2 py-1.5 rounded-lg border border-[#2563EB] bg-white text-xs font-bold text-stone-900"
                            />
                            <button
                              type="button"
                              onClick={() => setCustomVillage(false)}
                              title="Back to list"
                              className="px-1.5 py-1 text-[10px] rounded bg-stone-200 hover:bg-stone-300 text-stone-700"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white border border-blue-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-semibold text-stone-600 text-[11px]">
                          Selected Native Location:{' '}
                        </span>
                        <span className="font-bold text-blue-900">{form.nativeVillage || 'None'}</span>
                        <span className="text-stone-500 text-[11px]">
                          {' '}
                          • {form.mandal || '—'} Mandal • {form.district || '—'} District •{' '}
                          {form.state || '—'}
                        </span>
                      </div>
                    </div>

                    {form.nativeVillage && (
                      <button
                        type="button"
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            selectedAgreementVillages:
                              prev.nativeVillageAction === 'direct_attach'
                                ? withName(prev.selectedAgreementVillages, prev.nativeVillage)
                                : prev.selectedAgreementVillages,
                          }));
                          flash(`✓ ${form.nativeVillage} set as Franchise Village`, 2000);
                        }}
                        title="Include this village in the franchise agreement"
                        className="px-2 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-[#2563EB] font-semibold text-[11px] flex items-center gap-1 border border-blue-200 transition-colors"
                      >
                        <Sparkles className="w-3 h-3 text-blue-600" />
                        <span>Set as Franchise Village too</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label>House Number / Street</Label>
                    <input
                      type="text"
                      value={form.houseNumber}
                      onChange={(e) => set({ houseNumber: e.target.value })}
                      className={inputCls}
                      placeholder="e.g. H.No 2-18/B"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Full Residential Address</Label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => set({ address: e.target.value })}
                      className={inputCls}
                      placeholder="House No, Street, Landmark, Village, Mandal, District"
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: office visit + documents */}
              <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                  <h3 className="font-bold text-stone-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-[#2563EB]" />
                    Office Visit Details
                  </h3>
                  <span className="text-[10px] text-stone-400 font-mono">KYC Verification</span>
                </div>

                <div>
                  <Label>Regional Office</Label>
                  <select
                    value={form.regionalOffice}
                    onChange={(e) => set({ regionalOffice: e.target.value })}
                    className={inputCls}
                  >
                    {(REGIONAL_OFFICES.includes(form.regionalOffice)
                      ? REGIONAL_OFFICES
                      : [form.regionalOffice, ...REGIONAL_OFFICES]
                    ).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Visit Date</Label>
                    <input
                      type="date"
                      value={form.visitDate}
                      onChange={(e) => set({ visitDate: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <Label>Visit Time</Label>
                    <input
                      type="text"
                      value={form.visitTime}
                      onChange={(e) => set({ visitTime: e.target.value })}
                      className={inputCls}
                      placeholder="e.g. 11:00 AM"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-100 space-y-2">
                  <Label>Documents Verification</Label>

                  <DocRow
                    icon={ShieldCheck}
                    iconTone="text-[#2563EB]"
                    title="ID Proof (Aadhaar / PAN)"
                    required
                    verified={form.idProofVerified}
                    url={form.idProofUrl}
                    linkOpen={Boolean(linkOpen.id)}
                    onToggle={(v) => set({ idProofVerified: v })}
                    onUrl={(v) => set({ idProofUrl: v })}
                    onToggleLink={() => setLinkOpen((p) => ({ ...p, id: !p.id }))}
                  />
                  <DocRow
                    icon={FileText}
                    iconTone="text-emerald-600"
                    title="Address & Land Record Document"
                    verified={form.addressProofVerified}
                    url={form.addressProofUrl}
                    linkOpen={Boolean(linkOpen.address)}
                    onToggle={(v) => set({ addressProofVerified: v })}
                    onUrl={(v) => set({ addressProofUrl: v })}
                    onToggleLink={() => setLinkOpen((p) => ({ ...p, address: !p.address }))}
                  />
                  <DocRow
                    icon={FileText}
                    iconTone="text-emerald-600"
                    title="Other Required Document"
                    verified={form.otherDocVerified}
                    onToggle={(v) => set({ otherDocVerified: v })}
                  />

                  {step1Blocker && (
                    <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                      {step1Blocker}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-200 flex items-center justify-between">
              <span className="text-[11px] text-stone-500">
                {stepValid[1]
                  ? 'Step 1 complete • Ready for village territory allocation'
                  : 'Complete the details above to continue'}
              </span>
              <button
                type="button"
                onClick={goNext}
                disabled={!stepValid[1]}
                className="px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all"
              >
                <span>Next: Select Village Territory</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ── PART 2 ─────────────────────────────────── */}
        {step === 2 && (
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Native village: attach or queue */}
            <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <h3 className="font-bold text-stone-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-[#2563EB]" />
                      <span>Candidate Native Village Attachment &amp; Queue</span>
                    </h3>
                    <p className="text-[11px] text-stone-500">
                      Check live vacancy for native village. Direct attach if slots are available, or
                      place in Waiting Queue.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-stone-400 font-semibold uppercase">Live Quota:</span>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                      nativeHasSlot
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-red-50 text-red-800 border-red-300'
                    }`}
                  >
                    {villagesLoading
                      ? 'Checking…'
                      : nativeHasSlot
                      ? `✓ ${nativeVacancy} Open Slot(s)`
                      : 'Full Quota (0 Vacancy)'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-stone-900 text-sm">{form.nativeVillage || '—'}</span>
                    <span className="text-stone-300">•</span>
                    <span className="text-stone-600">
                      Mandal: <strong>{form.mandal || '—'}</strong>
                    </span>
                    <span className="text-stone-300">•</span>
                    <span className="text-stone-600">
                      District: <strong>{form.district || '—'}</strong>
                    </span>
                    <span className="text-stone-300">•</span>
                    <span className="text-stone-600">
                      State: <strong>{form.state || '—'}</strong>
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 mt-1">
                    Required Target: <strong>{nativeData?.requiredAgents ?? 0}</strong> Agents •
                    Currently Attached: <strong>{nativeData?.attachedAgentsCount ?? 0}</strong> •
                    Available Slots:{' '}
                    <strong className={nativeHasSlot ? 'text-emerald-700' : 'text-red-700'}>
                      {nativeVacancy}
                    </strong>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-2.5 py-1 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-stone-700 font-medium text-[11px]"
                >
                  Change Native Village (Part 1)
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <OptionCard
                  selected={form.nativeVillageAction === 'direct_attach'}
                  disabled={!nativeHasSlot}
                  tone="blue"
                  title="Direct Attach Native Village"
                  badge={nativeHasSlot ? 'Recommended' : '0 Vacancy'}
                  badgeTone={nativeHasSlot ? 'emerald' : 'amber'}
                  body={
                    nativeHasSlot
                      ? `Quota slot is open in ${form.nativeVillage}. Directly assign candidate to their native village in the official Franchise Agreement.`
                      : `Notice: Quota is currently full in ${form.nativeVillage || 'this village'}, so it cannot be attached directly.`
                  }
                  footer={
                    form.nativeVillageAction === 'direct_attach'
                      ? '✓ Active: Native Village will be attached in Agreement'
                      : 'Click to select Direct Attachment'
                  }
                  onClick={() =>
                    nativeHasSlot &&
                    setForm((prev) => ({
                      ...prev,
                      nativeVillageAction: 'direct_attach',
                      selectedAgreementVillages: prev.selectedAgreementVillages.some((v) =>
                        sameName(v, prev.nativeVillage)
                      )
                        ? prev.selectedAgreementVillages
                        : [prev.nativeVillage, ...prev.selectedAgreementVillages],
                    }))
                  }
                />

                <OptionCard
                  selected={form.nativeVillageAction === 'queue'}
                  tone="amber"
                  title="Place in Waiting Queue / Standby"
                  badge="Standby"
                  badgeTone="amber"
                  body={`Hold the candidate as interested in the Waiting Queue for ${
                    form.nativeVillage || 'their native village'
                  }. They can simultaneously be attached to other chosen villages below.`}
                  footer={
                    form.nativeVillageAction === 'queue'
                      ? '✓ Active: Held in Candidate Waiting Queue'
                      : 'Click to put candidate on Waitlist'
                  }
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      nativeVillageAction: 'queue',
                      nativeVillageQueueReason:
                        prev.nativeVillageQueueReason ||
                        (nativeHasSlot
                          ? 'Candidate placed in priority waiting queue per preference'
                          : 'Quota full in native village - candidate placed in priority waiting queue for next opening'),
                      selectedAgreementVillages: withoutName(
                        prev.selectedAgreementVillages,
                        prev.nativeVillage
                      ),
                    }))
                  }
                />
              </div>

              {form.nativeVillageAction === 'queue' && (
                <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 space-y-1.5">
                  <label className="text-[10px] font-bold text-amber-900 uppercase block">
                    Waiting Queue Priority Note / Reason:
                  </label>
                  <input
                    type="text"
                    value={form.nativeVillageQueueReason}
                    onChange={(e) => set({ nativeVillageQueueReason: e.target.value })}
                    placeholder="e.g. Quota full - candidate logged as priority waitlist for next slot opening"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white text-xs text-stone-900 focus:border-amber-600"
                  />
                  <p className="text-[10px] text-amber-700">
                    This note will be saved in the candidate record so telecallers and team leaders
                    know they are queued for {form.nativeVillage}.
                  </p>
                  {form.otherChosenVillages.length === 0 && (
                    <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1.5">
                      With the native village queued, choose at least one other village below to
                      attach this candidate to.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Other villages */}
            <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3.5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <h3 className="font-bold text-stone-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Navigation className="w-4 h-4 text-emerald-600" />
                      <span>Other Preferred / Operating Villages</span>
                    </h3>
                    <p className="text-[11px] text-stone-500">
                      Choose additional or nearby villages where the candidate can operate or
                      express interest.
                    </p>
                  </div>
                </div>

                <div className="flex items-center bg-stone-100 p-0.5 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setPart2View('list')}
                    className={`px-3 py-1 rounded-md font-semibold flex items-center gap-1.5 transition-all ${
                      part2View === 'list'
                        ? 'bg-white text-stone-900 shadow-2xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                    List
                  </button>
                  <button
                    type="button"
                    onClick={() => setPart2View('map')}
                    className={`px-3 py-1 rounded-md font-semibold flex items-center gap-1.5 transition-all ${
                      part2View === 'map'
                        ? 'bg-white text-[#2563EB] shadow-2xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <MapIcon className="w-3.5 h-3.5 text-[#2563EB]" />
                    Map
                  </button>
                </div>
              </div>

              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wide">
                    Selected Additional Operating Villages ({form.otherChosenVillages.length}):
                  </span>
                  {form.otherChosenVillages.length > 0 && (
                    <span className="text-[10px] text-blue-700">
                      These will be available for agreement attachment in Part 3
                    </span>
                  )}
                </div>

                {form.otherChosenVillages.length === 0 ? (
                  <p className="text-xs text-stone-500 italic py-1">
                    No additional villages chosen yet. Search or click &quot;+ Choose Village&quot;
                    below to add villages.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {form.otherChosenVillages.map((vil) => {
                      const match = villageByName.get(norm(vil));
                      return (
                        <div
                          key={vil}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-blue-300 text-blue-950 text-xs shadow-2xs"
                        >
                          <MapPin className="w-3 h-3 text-blue-600" />
                          <span className="font-bold">{vil}</span>
                          {match && (
                            <span className="text-[10px] text-stone-500">
                              ({match.mandal} • Vacancy: {match.vacancy})
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleOtherVillage(vil)}
                            title="Remove village"
                            className="ml-1 text-stone-400 hover:text-red-600 text-xs font-bold"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-stone-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-[#2563EB]" />
                    Search &amp; Filter Other Villages (State → District → Mandal)
                  </span>
                  <span className="text-[10px] text-stone-500">
                    Showing {step2Villages.length} of {villages.length} villages
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={step2Search}
                      onChange={(e) => setStep2Search(e.target.value)}
                      placeholder="Search village or mandal..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs text-stone-900 focus:border-[#2563EB]"
                    />
                    {step2Search && (
                      <button
                        type="button"
                        onClick={() => setStep2Search('')}
                        className="absolute right-2 top-2 text-stone-400 hover:text-stone-600 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <select
                    value={step2District}
                    onChange={(e) => {
                      setStep2District(e.target.value);
                      setStep2Mandal('All');
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-semibold text-stone-800 focus:border-[#2563EB]"
                  >
                    <option value="All">All Districts</option>
                    {step2Districts.map((d) => (
                      <option key={d} value={d}>
                        {d} District
                      </option>
                    ))}
                  </select>

                  <select
                    value={step2Mandal}
                    onChange={(e) => setStep2Mandal(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-semibold text-stone-800 focus:border-[#2563EB]"
                  >
                    <option value="All">All Mandals</option>
                    {step2Mandals.map((m) => (
                      <option key={m} value={m}>
                        {m} Mandal
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {part2View === 'list' ? (
                <div className="border border-stone-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200 shadow-2xs">
                        <th className="p-2.5">Village Name</th>
                        <th className="p-2.5">District / Mandal</th>
                        <th className="p-2.5 text-right">Required</th>
                        <th className="p-2.5 text-right">Attached</th>
                        <th className="p-2.5 text-right">Vacancy</th>
                        <th className="p-2.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {villagesLoading && (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-stone-400">
                            <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading villages…
                          </td>
                        </tr>
                      )}
                      {!villagesLoading && step2Villages.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-stone-400">
                            No villages match the filters.
                          </td>
                        </tr>
                      )}
                      {step2Villages.map((v) => {
                        const isNative = sameName(v.name, form.nativeVillage);
                        const chosen = isChosenOther(v.name);
                        return (
                          <tr
                            key={v.id}
                            className={`transition-colors ${
                              chosen ? 'bg-blue-50/80 font-semibold' : isNative ? 'bg-stone-50/60' : 'hover:bg-stone-50'
                            }`}
                          >
                            <td className="p-2.5 font-bold text-stone-900">
                              <div className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                                <span>{v.name}</span>
                                {isNative && (
                                  <span className="text-[10px] text-stone-600 bg-stone-200 px-1.5 py-0.2 rounded font-normal">
                                    Candidate Native
                                  </span>
                                )}
                                {chosen && (
                                  <span className="text-[10px] text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded font-normal">
                                    ✓ Chosen
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-2.5 text-stone-600">
                              {v.district} • {v.mandal}
                            </td>
                            <td className="p-2.5 text-right font-mono text-stone-700">{v.requiredAgents}</td>
                            <td className="p-2.5 text-right font-mono text-stone-700">
                              {v.attachedAgentsCount}
                            </td>
                            <td className="p-2.5 text-right font-mono">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  v.vacancy > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {v.vacancy}
                              </span>
                            </td>
                            <td className="p-2.5 text-center">
                              {isNative ? (
                                <span className="text-[10px] text-stone-400">Native village</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => toggleOtherVillage(v.name)}
                                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                                    chosen
                                      ? 'bg-[#2563EB] text-white shadow-2xs hover:bg-[#1D4ED8]'
                                      : 'border border-stone-300 hover:bg-stone-100 text-stone-700'
                                  }`}
                                >
                                  {chosen ? '✓ Added (Remove)' : '+ Choose Village'}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="rounded-xl border border-stone-200 overflow-hidden bg-white">
                    <div className="p-2 bg-stone-50 border-b border-stone-200 flex items-center justify-between text-xs">
                      <span className="font-semibold text-stone-800">
                        Click any village polygon to inspect live vacancy &amp; choose operational
                        villages:
                      </span>
                      <div className="flex items-center gap-3 text-[10px]">
                        <span>
                          <strong>A1</strong> = Attached
                        </span>
                        <span>
                          <strong>I3</strong> = Interested
                        </span>
                        <span>
                          <strong>V1</strong> = Vacancy
                        </span>
                      </div>
                    </div>
                    <div className="p-1">
                      <InteractiveMap
                        height="340px"
                        villages={villages}
                        selectedVillageId={inspected?.id}
                        onSelectVillage={setInspected}
                        showAllotmentColors
                        agentMapMode
                      />
                    </div>
                  </div>

                  {inspected && (
                    <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div>
                        <p className="font-bold text-blue-950 text-sm">
                          {inspected.name} ({inspected.mandal} Mandal, {inspected.district} Dist)
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-blue-800">
                          <span>
                            Required: <strong>{inspected.requiredAgents}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Attached: <strong>{inspected.attachedAgentsCount}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Current Vacancy: <strong>{inspected.vacancy}</strong>
                          </span>
                        </div>
                      </div>
                      {sameName(inspected.name, form.nativeVillage) ? (
                        <span className="text-[11px] text-stone-500">This is the native village.</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleOtherVillage(inspected.name)}
                          className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs shadow-xs"
                        >
                          {isChosenOther(inspected.name)
                            ? '✓ Added to Chosen Villages (Click to Remove)'
                            : '+ Add to Chosen Villages'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PART 3 ─────────────────────────────────── */}
        {step === 3 && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-stone-100">
                <div>
                  <h3 className="font-bold text-stone-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <FileCheck2 className="w-4 h-4 text-[#2563EB]" />
                    <span>Franchise Agreement Territory Allocation &amp; Village Selection</span>
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Tick (✓) each village from shortlisted territories to be officially attached in
                    the legal Franchise Agreement deed.
                  </p>
                </div>

                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-900 border border-blue-200">
                  {form.selectedAgreementVillages.length} Village(s) Selected for Agreement
                </span>
              </div>

              {form.nativeVillageAction === 'queue' ? (
                <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <span className="font-bold text-amber-950">
                        Candidate Native Village ({form.nativeVillage}) is held in the Waiting Queue
                        (Standby)
                      </span>
                      <p className="text-[11px] text-amber-800">
                        Note: {form.nativeVillageQueueReason || 'Candidate queued as standby for next slot opening'}.
                        (Not attached in agreement deed).
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!nativeHasSlot}
                    title={nativeHasSlot ? undefined : 'The native village has no open slot'}
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        nativeVillageAction: 'direct_attach',
                        selectedAgreementVillages: withName(prev.selectedAgreementVillages, prev.nativeVillage),
                      }))
                    }
                    className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 font-semibold text-[11px] shrink-0 disabled:opacity-40 disabled:hover:bg-white"
                  >
                    Attach Native Village Instead
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-bold text-emerald-950">
                        Candidate Native Village ({form.nativeVillage}) is designated for Direct
                        Attachment
                      </span>
                      <p className="text-[11px] text-emerald-800">
                        Live Quota: {nativeVacancy} slot(s) open. Native village is included in
                        candidate agreement deed.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        nativeVillageAction: 'queue',
                        nativeVillageQueueReason:
                          prev.nativeVillageQueueReason || 'Candidate placed in priority waiting queue per preference',
                        selectedAgreementVillages: withoutName(prev.selectedAgreementVillages, prev.nativeVillage),
                      }))
                    }
                    className="px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-900 hover:bg-emerald-100 font-semibold text-[11px] shrink-0"
                  >
                    Switch Native Village to Queue
                  </button>
                </div>
              )}

              <div className="border border-stone-200 rounded-xl overflow-hidden">
                <div className="p-2.5 bg-stone-50 border-b border-stone-200 flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-700">
                    Territories Available for Agreement (Tick villages to attach):
                  </span>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-blue-600 hover:text-blue-800 font-semibold text-[11px]"
                  >
                    + Add / Manage Villages in Part 2
                  </button>
                </div>

                <div className="divide-y divide-stone-100 max-h-64 overflow-y-auto">
                  {agreementCandidates.length === 0 && (
                    <p className="p-4 text-center text-[11px] text-stone-400">
                      No villages to attach yet — add some in Part 2.
                    </p>
                  )}
                  {agreementCandidates.map((name) => {
                    const data = villageByName.get(norm(name));
                    const vac = data?.vacancy ?? 0;
                    const isNative = sameName(name, form.nativeVillage);
                    const ticked = form.selectedAgreementVillages.some((v) => sameName(v, name));

                    return (
                      <label
                        key={name}
                        className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                          ticked ? 'bg-blue-50/70 font-semibold' : 'hover:bg-stone-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={ticked}
                            onChange={(e) =>
                              set({
                                selectedAgreementVillages: e.target.checked
                                  ? withName(form.selectedAgreementVillages, name)
                                  : withoutName(form.selectedAgreementVillages, name),
                              })
                            }
                            className="rounded w-4 h-4 accent-[#2563EB]"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-stone-900">{name}</span>
                              {isNative ? (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                                  Native Village
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
                                  Operating Village
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-stone-500 font-normal mt-0.5">
                              Mandal: {data?.mandal || form.mandal || '—'} • District:{' '}
                              {data?.district || form.district || '—'} • Target Quota:{' '}
                              {data?.requiredAgents ?? '—'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              vac > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {vac > 0 ? `✓ ${vac} Vacancy` : 'Full Quota'}
                          </span>
                          <span
                            className={`text-xs font-bold ${ticked ? 'text-[#2563EB]' : 'text-stone-400'}`}
                          >
                            {ticked ? '✓ Attached' : 'Not Attached'}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Deed */}
              <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                  <h3 className="font-bold text-stone-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <FileCheck2 className="w-4 h-4 text-[#2563EB]" />
                    Franchise Agreement Deed
                  </h3>
                  <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Legal Compliance
                  </span>
                </div>

                <div className="space-y-3">
                  <CheckRow
                    checked={form.agreementPrepared}
                    onChange={(v) => set({ agreementPrepared: v })}
                    title="Agreement Deed Prepared & Printed"
                    sub={`Franchise deed covering: ${territoryLabel}.`}
                  />

                  <div>
                    <Label>Agreement Execution Date</Label>
                    <input
                      type="date"
                      value={form.agreementDate}
                      onChange={(e) => set({ agreementDate: e.target.value })}
                      className={inputCls}
                    />
                  </div>

                  <CheckRow
                    checked={form.agreementSigned}
                    onChange={(v) => set({ agreementSigned: v })}
                    title="Signed by Candidate & Regional Officer"
                    sub="Physical or digital signature confirmed on-site. Required before the attachment can be completed."
                  />

                  <div className="pt-2 border-t border-stone-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-stone-500">Deed Document:</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewingAgreement(true)}
                          className="px-2.5 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-700 font-semibold text-xs flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5 text-stone-500" />
                          View Agreement
                        </button>
                        <button
                          type="button"
                          onClick={() => setLinkOpen((p) => ({ ...p, deed: !p.deed }))}
                          title="Paste a link to the signed scan"
                          className="px-2.5 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-600 text-xs flex items-center gap-1.5"
                        >
                          <Upload className="w-3.5 h-3.5 text-stone-500" />
                          Upload
                        </button>
                      </div>
                    </div>
                    {linkOpen.deed && (
                      <input
                        value={form.agreementUrl}
                        onChange={(e) => set({ agreementUrl: e.target.value })}
                        placeholder="Link to the signed scan (https://…)"
                        className={inputCls}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Fee */}
              <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                  <h3 className="font-bold text-stone-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-emerald-600" />
                    Agent Security Deposit Fee
                  </h3>
                  <span className="font-mono text-[10px] text-stone-400">Receipt Generated</span>
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Fee Amount (₹) *</Label>
                      <input
                        type="number"
                        min="0"
                        value={form.feeAmount}
                        onChange={(e) => set({ feeAmount: Number(e.target.value) })}
                        className={`${inputCls} border-stone-300 font-bold text-emerald-700 focus:border-emerald-600`}
                      />
                    </div>
                    <div>
                      <Label>Payment Mode</Label>
                      <select
                        value={form.paymentMode}
                        onChange={(e) => set({ paymentMode: e.target.value })}
                        className={`${inputCls} font-semibold`}
                      >
                        {PAYMENT_MODES.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <span className="text-[9px] font-semibold text-stone-500 uppercase block mb-1">
                      Select Security Deposit Tier:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {DEPOSIT_TIERS.map((t) => (
                        <button
                          key={t.amount}
                          type="button"
                          onClick={() => set({ feeAmount: t.amount })}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                            form.feeAmount === t.amount
                              ? 'bg-emerald-700 text-white shadow-xs'
                              : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-stone-500 mt-1">
                      Standard security deposit amount is set to ₹5,000. Refundable upon exit per
                      company policy.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Payment Date</Label>
                    <input
                      type="date"
                      value={form.paymentDate}
                      onChange={(e) => set({ paymentDate: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <Label>Payment Reference *</Label>
                    <input
                      type="text"
                      value={form.referenceNo}
                      onChange={(e) => set({ referenceNo: e.target.value })}
                      placeholder="UTR / receipt no."
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                </div>

                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-900 text-xs">Official Agent Fee Receipt</span>
                    {form.referenceNo.trim() ? (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        ✓ Paid
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                        Awaiting reference
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-stone-600">
                    <span>
                      Receipt No: <strong className="font-mono text-stone-900">{form.receiptNo}</strong>
                    </span>
                    <span>
                      Amount:{' '}
                      <strong className="text-emerald-700 font-mono">{inr(form.feeAmount)}</strong>
                    </span>
                  </div>
                  <div className="pt-1.5 border-t border-stone-200 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setViewingReceipt(true)}
                      className="px-2.5 py-1 rounded-md border border-stone-200 hover:bg-white text-stone-700 text-xs font-semibold flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3 text-stone-500" />
                      View Receipt
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewingReceipt('print')}
                      className="px-2.5 py-1 rounded-md border border-stone-200 hover:bg-white text-stone-700 text-xs font-semibold flex items-center gap-1"
                    >
                      <Printer className="w-3 h-3 text-stone-500" />
                      Print Receipt
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {stepValid[3] ? (
              <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 flex items-center justify-between text-xs text-emerald-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Validation Confirmed:</strong> Required KYC documents verified, Agreement
                    deed completed &amp; Fee receipt generated.
                  </span>
                </div>
                <span className="text-[10px] text-stone-500">
                  Ready to proceed to final attachment confirmation.
                </span>
              </div>
            ) : (
              <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200 flex items-center gap-2 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Still needed:</strong>{' '}
                  {[
                    form.selectedAgreementVillages.length === 0 && 'tick at least one village',
                    !primaryVillage && 'one village that can take a seat',
                    !form.agreementSigned && 'signed agreement',
                    !form.referenceNo.trim() && 'payment reference',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── PART 4 ─────────────────────────────────── */}
        {step === 4 && (
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <h3 className="font-bold text-stone-900 text-sm tracking-tight">
                  Final Attachment Confirmation
                </h3>
                <span className="text-[10px] text-stone-500">Step 4 of 4 • Complete Review</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                    Candidate Profile
                  </span>
                  <div className="flex items-center gap-3">
                    <SquarePhoto name={form.name} photo={lead.photo} className="w-12 h-12" />
                    <div>
                      <p className="font-bold text-stone-900 text-sm">{form.name}</p>
                      <p className="font-mono text-xs text-stone-600">{form.phone}</p>
                      <p className="text-[11px] text-stone-500">
                        Native: <strong>{form.nativeVillage}</strong> • {form.mandal} Mandal
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-stone-200">
                    {form.nativeVillageAction === 'queue' ? (
                      <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between text-[11px]">
                        <span className="font-bold text-amber-900 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          Held in Native Village Waiting Queue
                        </span>
                        <span className="text-[10px] text-amber-800 italic">Standby</span>
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between text-[11px]">
                        <span className="font-bold text-emerald-900 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          Direct Attach: {form.nativeVillage}
                        </span>
                        <span className="text-[10px] text-emerald-800">Assigned</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                      Official Agreement Territories ({form.selectedAgreementVillages.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="text-blue-600 hover:text-blue-800 font-semibold text-[11px]"
                    >
                      Modify (Part 3)
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {form.selectedAgreementVillages.length === 0 ? (
                      <p className="text-xs text-stone-500 italic py-2">
                        No villages selected for attachment. Go to Part 3 to tick villages.
                      </p>
                    ) : (
                      form.selectedAgreementVillages.map((vil) => {
                        const vac = villageByName.get(norm(vil))?.vacancy ?? 0;
                        const isNative = sameName(vil, form.nativeVillage);
                        return (
                          <div
                            key={vil}
                            className="p-2 rounded-lg bg-white border border-stone-200 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span className="font-bold text-stone-900">{vil}</span>
                              {isNative && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-800">
                                  Native
                                </span>
                              )}
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                vac > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {vac > 0 ? `✓ ${vac} Vacancy` : 'Full'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                  <span className="text-[10px] text-stone-500 block uppercase font-semibold">
                    Franchise Agreement Deed
                  </span>
                  <span
                    className={`font-bold text-sm block mt-1 ${
                      form.agreementSigned ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {form.agreementSigned ? '✓ Prepared & Signed' : 'Not signed yet'}
                  </span>
                  <span className="text-[10px] text-stone-500 block mt-0.5">
                    Execution Date: {form.agreementDate}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                  <span className="text-[10px] text-stone-500 block uppercase font-semibold">
                    Agent Security Fee
                  </span>
                  <span
                    className={`font-bold text-sm block mt-1 ${
                      form.referenceNo.trim() ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {form.referenceNo.trim() ? `✓ Paid (${inr(form.feeAmount)})` : 'Payment reference missing'}
                  </span>
                  <span className="text-[10px] font-mono text-stone-500 block mt-0.5 truncate">
                    Receipt: {form.receiptNo} ({form.paymentMode})
                  </span>
                </div>
              </div>

              {!primaryVillage ? (
                <div className="p-3.5 rounded-xl bg-red-100 border border-red-300 text-red-900 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                    <div>
                      <p className="font-bold text-xs">No attachable village selected</p>
                      <p className="text-[11px] text-red-800">
                        With the native village queued you must tick at least one other territory
                        in Part 3.
                      </p>
                    </div>
                  </div>
                </div>
              ) : primaryIsFull ? (
                <div className="p-3.5 rounded-xl bg-red-100 border border-red-300 text-red-900 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                    <div>
                      <p className="font-bold text-xs">VILLAGE NOW FULL</p>
                      <p className="text-[11px] text-red-800">
                        {primaryVillage} has reached capacity (0 vacancy). Complete attachment is
                        disabled. Please change village.
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white font-semibold text-xs flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Change Village
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold text-xs">Vacancy Available</p>
                      <p className="text-[11px] text-emerald-800">
                        {primaryData
                          ? `${primaryData.vacancy} position(s) open in ${primaryVillage}.`
                          : `${primaryVillage} is not on the recruitment map; the server will confirm a seat.`}{' '}
                        Ready for complete attachment.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-emerald-600 text-white font-bold text-[10px] uppercase">
                    Ready to Attach
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sticky action bar */}
      <div className="h-16 px-6 border-t border-stone-200 bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-stone-300 hover:bg-stone-100 text-stone-700 font-semibold text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => saveDraft(false)}
            className="px-4 py-2 rounded-xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100 text-[#2563EB] font-semibold text-xs flex items-center gap-1.5 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {step === 2 ? 'Save Village' : 'Save'}
          </button>
          {toast && (
            <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
              {toast}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep(step === 4 ? 2 : step - 1)}
              className="px-4 py-2 rounded-xl border border-stone-300 hover:bg-stone-100 text-stone-700 font-semibold text-xs flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{step === 4 ? 'Change Village' : STEPS[step - 2].label}</span>
            </button>
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={!stepValid[step]}
              className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all"
            >
              <span>{NEXT_LABELS[step]}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              disabled={saving || !primaryVillage || primaryIsFull}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-300 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md tracking-wider flex items-center gap-2 transition-all"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>COMPLETE ATTACHMENT</span>
            </button>
          )}
        </div>
      </div>

      {/* Agreement deed preview */}
      {viewingAgreement && (
        <Preview
          icon={FileCheck2}
          title="Village Franchise Agreement Deed"
          size="max-w-xl"
          printLabel="Print Agreement"
          previewRef={previewRef}
          onClose={() => setViewingAgreement(false)}
          onPrint={() => printElement(previewRef.current, 'Franchise Agreement Deed')}
        >
          <div className="p-4 rounded-xl border border-stone-200 bg-stone-50 space-y-3 max-h-96 overflow-y-auto">
            <div className="text-center pb-2 border-b border-stone-200">
              <h4 className="font-bold text-sm text-stone-900">GARUDA LANDS NETWORK OPC PVT LTD</h4>
              <p className="text-[10px] text-stone-500">Village Franchise Agent Agreement &amp; Service Deed</p>
              <p className="text-[11px] font-semibold text-blue-700 mt-0.5">
                Allocated Franchise Territory: {territoryLabel}
                {primaryData?.mandal ? ` (${primaryData.mandal} Mandal)` : ''}
              </p>
            </div>

            <div className="space-y-2 text-[11px] text-stone-700">
              <p>
                This agreement is executed on <strong>{form.agreementDate}</strong> between Garuda
                Lands Network OPC Pvt Ltd and Candidate <strong>{form.name}</strong> (Phone:{' '}
                {form.phone}), resident of {form.nativeVillage}.
              </p>
              <div className="p-2.5 bg-white rounded-lg border border-stone-200 space-y-1.5 text-[10px] text-stone-600">
                <p>
                  <strong>1. Village Representation:</strong> The Agent officially represents the
                  company within designated franchise territory: <strong>{territoryLabel}</strong>{' '}
                  for farmer identification, land listing facilitation, and field survey
                  verifications.
                </p>
                {form.nativeVillageAction === 'queue' && (
                  <p>
                    <strong>• Native Village Standby Note:</strong> Candidate&apos;s native village (
                    {form.nativeVillage}) is registered in the priority standby queue (Reason:{' '}
                    {form.nativeVillageQueueReason || 'Awaiting slot opening'}).
                  </p>
                )}
                <p>
                  <strong>2. Security Deposit:</strong> The Agent has remitted {inr(form.feeAmount)}{' '}
                  as a security deposit under Receipt No. {form.receiptNo}.
                </p>
                <p>
                  <strong>3. Transparent Conduct:</strong> Agent will maintain truthful
                  communication with farmers and buyers without unauthorized representations.
                </p>
                <p>
                  <strong>4. Local Roster Coordination:</strong> All verified lands in assigned
                  territories are coordinated via Garuda Lands Operations Portal.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-[10px] text-stone-500">
              <span>Candidate Sign: {form.agreementSigned ? 'Signed' : 'Pending'}</span>
              <span>Regional Office Seal: {form.agreementSigned ? 'Verified' : 'Pending'}</span>
            </div>
          </div>
        </Preview>
      )}

      {/* Receipt preview */}
      {viewingReceipt && (
        <Preview
          icon={Receipt}
          iconTone="text-emerald-600"
          title="Security Deposit Official Receipt"
          size="max-w-lg"
          printLabel="Print Receipt"
          previewRef={previewRef}
          autoPrint={viewingReceipt === 'print'}
          onClose={() => setViewingReceipt(false)}
          onPrint={() => printElement(previewRef.current, 'Security Deposit Receipt')}
        >
          <div className="p-4 rounded-xl border border-stone-200 bg-stone-50 space-y-3">
            <div className="text-center pb-2 border-b border-stone-200">
              <h4 className="font-bold text-sm text-stone-900">GARUDA LANDS NETWORK OPC PVT LTD</h4>
              <p className="text-[10px] text-stone-500">
                Official Agent Onboarding Security Deposit Receipt
              </p>
              <span className="font-mono font-bold text-[#2563EB] text-xs mt-1 block">
                Receipt No: {form.receiptNo}
              </span>
            </div>

            <div className="space-y-1.5 text-[11px] text-stone-700">
              <ReceiptLine label="Received From:" value={<strong className="text-stone-900">{form.name}</strong>} />
              <ReceiptLine label="Phone:" value={<span className="font-mono">{form.phone}</span>} />
              <ReceiptLine
                label="Assigned Village:"
                value={<strong className="text-blue-900">{primaryVillage || '—'}</strong>}
              />
              <ReceiptLine label="Payment Mode:" value={form.paymentMode} />
              <ReceiptLine
                label="Reference No:"
                value={<span className="font-mono">{form.referenceNo || '—'}</span>}
              />
              <ReceiptLine label="Payment Date:" value={form.paymentDate} />
              <div className="pt-2 border-t border-stone-200 flex justify-between text-xs font-bold">
                <span>Total Amount Paid:</span>
                <span className="text-emerald-700 font-mono text-sm">{inr(form.feeAmount)}</span>
              </div>
            </div>

            <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-800 text-center font-medium">
              Official refundable security deposit against village franchise agreement.
            </div>
          </div>
        </Preview>
      )}
    </Shell>
  );
}

/* ── Local pieces ─────────────────────────────────────────────── */

function Shell({ children, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[1000] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6"
      onClick={onClose}
    >
      <div
        className="w-[94vw] max-w-5xl h-[88vh] max-h-[860px] bg-white rounded-2xl border border-stone-200 shadow-2xl flex flex-col overflow-hidden text-xs relative"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
}

function Label({ children }) {
  return (
    <label className="text-[10px] font-semibold text-stone-500 uppercase block mb-1">{children}</label>
  );
}

const initialsOf = (name) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

/** The candidate's photo as a rounded square, falling back to initials. */
function SquarePhoto({ name, photo, className }) {
  const [failed, setFailed] = useState(false);
  if (photo && !failed) {
    return (
      <img
        src={photo}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`rounded-xl object-cover border border-stone-200 shrink-0 ${className}`}
      />
    );
  }
  return (
    <div
      className={`rounded-xl border border-stone-200 bg-blue-50 text-[#2563EB] text-sm font-bold flex items-center justify-center shrink-0 ${className}`}
    >
      {initialsOf(name)}
    </div>
  );
}

/**
 * One KYC document: whether the officer has verified it, and — optionally — a
 * link to the scan. "Upload" reveals the link box; nothing is uploaded from
 * here, the desk pastes where the scan already lives.
 */
function DocRow({ icon: Icon, iconTone, title, required, verified, url, linkOpen, onToggle, onUrl, onToggleLink }) {
  return (
    <div className="space-y-1.5">
      <div className="p-2 rounded-lg border border-stone-200 bg-stone-50/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`w-4 h-4 shrink-0 ${iconTone}`} />
          <div className="truncate">
            <p className="font-semibold text-stone-900 truncate">
              {title}
              {required && <span className="ml-1 text-[10px] text-rose-600">required</span>}
            </p>
            <button
              type="button"
              onClick={() => onToggle(!verified)}
              className={`text-[10px] font-semibold px-1 py-0.2 rounded border ${
                verified
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : 'text-stone-500 bg-white border-stone-200 hover:text-stone-700'
              }`}
            >
              {verified ? 'Verified' : 'Mark verified'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="px-2 py-1 rounded border border-stone-200 hover:bg-white text-stone-700 text-[10px] font-semibold flex items-center gap-1"
            >
              <Eye className="w-3 h-3 text-stone-500" />
              View
            </a>
          ) : (
            <span className="px-2 py-1 rounded border border-stone-200 bg-stone-100/60 text-stone-400 text-[10px] font-semibold flex items-center gap-1">
              <Eye className="w-3 h-3" />
              View
            </span>
          )}
          {onUrl && (
            <button
              type="button"
              onClick={onToggleLink}
              title="Paste a link to the scan"
              className="px-2 py-1 rounded border border-stone-200 hover:bg-white text-stone-600 text-[10px] flex items-center gap-1"
            >
              <Upload className="w-3 h-3 text-stone-500" />
              Upload
            </button>
          )}
        </div>
      </div>

      {linkOpen && onUrl && (
        <input
          value={url}
          onChange={(e) => onUrl(e.target.value)}
          placeholder="Link to the scan (https://…)"
          className="w-full text-[11px] bg-white border border-stone-200 rounded px-2 py-1"
        />
      )}
    </div>
  );
}

function OptionCard({ selected, disabled, onClick, title, badge, badgeTone, body, footer, tone }) {
  const active =
    tone === 'amber'
      ? 'border-amber-500 bg-amber-50/70 shadow-xs ring-2 ring-amber-400/20'
      : 'border-[#2563EB] bg-blue-50/70 shadow-xs ring-2 ring-[#2563EB]/20';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`p-3.5 rounded-xl border-2 text-left transition-all space-y-2 flex flex-col justify-between disabled:opacity-60 disabled:cursor-not-allowed ${
        selected ? active : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'
      }`}
    >
      <div className="flex items-start justify-between gap-2 w-full">
        <div className="flex items-center gap-2">
          <div
            className={`w-5 h-5 rounded-full border flex items-center justify-center ${
              selected
                ? tone === 'amber'
                  ? 'border-amber-500 bg-amber-500 text-white'
                  : 'border-[#2563EB] bg-[#2563EB] text-white'
                : 'border-stone-300 bg-white'
            }`}
          >
            {selected && <Check className="w-3 h-3 stroke-[3]" />}
          </div>
          <span className="font-bold text-xs text-stone-900">{title}</span>
        </div>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
            badgeTone === 'emerald' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {badge}
        </span>
      </div>

      <p className="text-[11px] text-stone-600 leading-relaxed">{body}</p>

      <div className="pt-1 text-[10px]">
        <span className={`font-semibold ${tone === 'amber' ? 'text-amber-900' : 'text-blue-900'}`}>{footer}</span>
      </div>
    </button>
  );
}

function CheckRow({ checked, onChange, title, sub }) {
  return (
    <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-stone-200 bg-stone-50 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 rounded accent-[#2563EB]"
      />
      <div>
        <span className="font-bold text-stone-900 block text-xs">{title}</span>
        <span className="text-[11px] text-stone-500 block">{sub}</span>
      </div>
    </label>
  );
}

function ReceiptLine({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-stone-500">{label}</span>
      {value}
    </div>
  );
}

/** A dialog on top of the wizard that shows a printable document. */
function Preview({ icon: Icon, iconTone = 'text-[#2563EB]', title, size, printLabel, previewRef, autoPrint, onClose, onPrint, children }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  // "Print Receipt" on the fee card opens straight to the print dialog.
  useEffect(() => {
    if (!autoPrint) return undefined;
    const timer = setTimeout(() => onPrint?.(), 400);
    return () => clearTimeout(timer);
    // Once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-[1010] bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => {
        e.stopPropagation();
        onClose?.();
      }}
    >
      <div
        className={`bg-white rounded-2xl border border-stone-200 shadow-2xl ${size} w-full p-5 space-y-4 text-xs`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${iconTone}`} />
            <h3 className="font-bold text-stone-900 text-sm">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div ref={previewRef}>{children}</div>

        <div className="flex items-center justify-between pt-2 border-t border-stone-100">
          <button
            type="button"
            onClick={onPrint}
            className="px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-700 font-medium text-xs flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            {printLabel}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-stone-900 text-white font-semibold text-xs hover:bg-stone-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value }) {
  return (
    <div className="bg-stone-50 border border-stone-200 rounded-lg py-2">
      <div className="text-sm font-black text-stone-900">{value}</div>
      <div className="text-[10px] font-bold text-stone-500 uppercase">{label}</div>
    </div>
  );
}
