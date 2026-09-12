import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Check,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  FileText,
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
  Table as TableIcon,
  Map as MapIcon,
} from 'lucide-react';

import PersonAvatar from '../common/PersonAvatar';
import InteractiveMap from '../maps/InteractiveMap';
import useVillageLocations from '../../../hooks/useVillageLocations';
import { getProgress, setProgress, clearProgress } from './onboardingProgress';
import agentLeadService from '../../../services/agentLeadService';
import callingService from '../../../services/callingService';

const STEPS = [
  { n: 1, label: 'Candidate' },
  { n: 2, label: 'Village' },
  { n: 3, label: 'Agreement & Fee' },
  { n: 4, label: 'Attachment' },
];

const REGIONAL_OFFICES = [
  'Sangareddy Regional Office',
  'Kalwakurthy Regional Office',
  'Nagarkurnool Regional Office',
  'Achampet Regional Office',
  'Hyderabad Head Office',
];

const DEPOSIT_TIERS = [
  { label: '₹5,000 (Standard Security Deposit)', amount: 5000 },
  { label: '₹10,000', amount: 10000 },
  { label: '₹15,000', amount: 15000 },
  { label: '₹2,500 (Sub-Agent)', amount: 2500 },
];

const PAYMENT_MODES = ['UPI', 'Bank Transfer', 'Cash', 'Cheque'];

const norm = (v) => String(v || '').trim().toLowerCase();
const inr = (v) => `₹${(Number(v) || 0).toLocaleString('en-IN')}`;
const todayISO = () => new Date().toISOString().slice(0, 10);

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

  const [villageView, setVillageView] = useState('list');
  const [villageSearch, setVillageSearch] = useState('');

  const scheduledVisit = useMemo(
    () => (lead.officeVisits || []).find((v) => v.status === 'Scheduled'),
    [lead]
  );

  const [form, setForm] = useState(() => ({
    name: lead.name || '',
    phone: lead.phone || '',
    whatsapp: lead.alternate_phone || lead.phone || '',
    nativeVillage: lead.village || '',
    mandal: lead.mandal || '',
    district: lead.district || '',
    state: lead.state || '',
    houseNumber: '',
    address: '',
    pinCode: '',

    regionalOffice: scheduledVisit?.regional_office || REGIONAL_OFFICES[0],
    visitDate: scheduledVisit?.visit_date || todayISO(),
    visitTime: scheduledVisit?.visit_time || '11:00 AM',

    idProofVerified: false,
    idProofUrl: '',
    addressProofVerified: false,
    addressProofUrl: '',
    otherDocVerified: false,

    nativeVillageAction: 'direct_attach',
    nativeVillageQueueReason: '',
    otherChosenVillages: [],
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
  }));

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

  // Villages they registered interest in, minus their native one.
  const otherInterestVillages = useMemo(() => {
    const set_ = new Set();
    (lead.interests || []).forEach((i) => {
      if (i.village && norm(i.village) !== norm(form.nativeVillage)) set_.add(i.village);
    });
    return [...set_];
  }, [lead.interests, form.nativeVillage]);

  // Seed the agreement with whatever is actually attachable.
  useEffect(() => {
    if (form.selectedAgreementVillages.length) return;
    const seed =
      form.nativeVillageAction === 'direct_attach' && form.nativeVillage
        ? [form.nativeVillage]
        : otherInterestVillages.slice(0, 1);
    if (seed.length) set({ selectedAgreementVillages: seed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.nativeVillageAction, otherInterestVillages.length]);

  const agreementCandidates = useMemo(() => {
    const names = new Set([...otherInterestVillages]);
    if (form.nativeVillage) names.add(form.nativeVillage);
    return [...names];
  }, [otherInterestVillages, form.nativeVillage]);

  /** The village the agent is actually seated in — never a queued native one. */
  const primaryVillage = useMemo(() => {
    const picked = form.selectedAgreementVillages;
    if (form.nativeVillageAction === 'queue') {
      return picked.find((v) => norm(v) !== norm(form.nativeVillage)) || '';
    }
    return picked[0] || form.nativeVillage || '';
  }, [form.selectedAgreementVillages, form.nativeVillageAction, form.nativeVillage]);

  /* ── Step gating ─────────────────────────────────────────── */

  const stepValid = {
    1: Boolean(form.name.trim() && form.phone.trim() && form.idProofVerified),
    2:
      form.nativeVillageAction === 'direct_attach'
        ? Boolean(form.nativeVillage)
        : Boolean(form.nativeVillageQueueReason.trim()) && otherInterestVillages.length > 0,
    3: Boolean(
      form.agreementSigned &&
        form.selectedAgreementVillages.length > 0 &&
        form.referenceNo.trim() &&
        primaryVillage
    ),
    4: true,
  };

  const goNext = () => {
    setCompleted((prev) => (prev.includes(step) ? prev : [...prev, step]));
    const next = Math.min(4, step + 1);
    setProgress(lead.id, next);
    setStep(next);
  };

  const saveDraft = () => {
    // Only the step reached is persisted, and only in this browser. Saying so
    // matters: nothing reaches the server until Complete Attachment, so a
    // colleague on another desk will not see this draft.
    setProgress(lead.id, step);
    setToast('Progress saved on this device — nothing reaches the server until Complete Attachment.');
    setTimeout(() => setToast(null), 3500);
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
      setError(err.response?.data?.message || 'Could not complete the attachment.');
    } finally {
      setSaving(false);
    }
  };

  const filteredVillages = useMemo(() => {
    const q = villageSearch.trim().toLowerCase();
    if (!q) return villages;
    return villages.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        String(v.mandal || '').toLowerCase().includes(q)
    );
  }, [villages, villageSearch]);

  /* ── Done ────────────────────────────────────────────────── */

  if (result) {
    const agent = result.agent || {};
    return (
      <Shell onClose={onClose}>
        <div className="p-8 space-y-4">
          <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-1.5">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <div className="font-bold text-base text-emerald-900">
              {result.alreadyOnboarded
                ? 'This candidate was already an agent'
                : 'Attachment complete'}
            </div>
            <div className="text-sm text-emerald-800">
              {agent.name} · AG{String(agent.id).padStart(5, '0')} · {agent.village}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <Tile label="Seat filled" value={result.seat ? `#${result.seat.position_number}` : '—'} />
            <Tile label="Deposit" value={inr(agent.security_deposit)} />
            <Tile
              label="Native village"
              value={agent.native_village_queued ? 'Queued' : 'Attached'}
            />
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
      {/* Candidate banner */}
      <div className="px-4 py-3 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <PersonAvatar name={form.name} photo={lead.photo} size="md" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-sm text-stone-900">{form.name}</span>
              <span className="text-xs text-stone-500">({form.phone})</span>
            </div>
            <div className="text-[11px] text-stone-500 flex items-center gap-1.5 flex-wrap">
              <span>
                Native: <strong className="text-stone-700">{form.nativeVillage || '—'}</strong>
              </span>
              <span
                className={`px-1.5 rounded text-[10px] font-bold border ${
                  form.nativeVillageAction === 'queue'
                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                }`}
              >
                {form.nativeVillageAction === 'queue' ? 'Waiting Queue' : 'Direct Attach'}
              </span>
              <span className="text-stone-300">•</span>
              <span>
                Attached Territory:{' '}
                <strong className="text-stone-700">{primaryVillage || 'not set'}</strong>
              </span>
              <span className="text-stone-300">•</span>
              <span>Office: {form.regionalOffice}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={saveDraft}
            className="px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-emerald-100"
          >
            <Save className="w-3.5 h-3.5" /> Save &amp; Close
          </button>
          <button
            type="button"
            onClick={handleCall}
            disabled={dialState === 'dialing'}
            className="px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-stone-700 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-stone-50 disabled:opacity-50"
          >
            {dialState === 'dialing' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Phone className="w-3.5 h-3.5 text-[#2563EB]" />
            )}
            {dialState === 'placed' ? 'Called' : 'Call'}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stepper */}
      <div className="px-4 py-2.5 border-b border-stone-200 flex items-center gap-2 overflow-x-auto">
        {STEPS.map((s, i) => {
          const done = completed.includes(s.n) && step !== s.n;
          const active = step === s.n;
          const reachable = done || active || completed.includes(s.n - 1);
          return (
            <div key={s.n} className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => reachable && setStep(s.n)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
                  active
                    ? 'bg-[#2563EB] text-white'
                    : done
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                    : 'bg-stone-100 text-stone-600'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                    active ? 'bg-white/20' : done ? 'bg-emerald-100' : 'bg-stone-200'
                  }`}
                >
                  {done ? <Check className="w-2.5 h-2.5" /> : s.n}
                </span>
                {s.label}
              </button>
              {i < STEPS.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-stone-300" />}
            </div>
          );
        })}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50/50">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {/* ── STEP 1 ─────────────────────────────────── */}
        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card
              n="1"
              title="Candidate details"
              badge={<Chip tone="stone">In-Person Visit</Chip>}
            >
              <div className="flex items-start gap-3">
                <PersonAvatar name={form.name} photo={lead.photo} size={56} />
                <div className="flex-1 min-w-0">
                  <Label>Full name *</Label>
                  <input
                    value={form.name}
                    onChange={(e) => set({ name: e.target.value })}
                    placeholder="e.g. Ramesh Reddy"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Phone number *</Label>
                  <input
                    value={form.phone}
                    onChange={(e) => set({ phone: e.target.value })}
                    placeholder="10-digit mobile"
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label>WhatsApp number</Label>
                  <input
                    value={form.whatsapp}
                    onChange={(e) => set({ whatsapp: e.target.value })}
                    placeholder="Same as mobile"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/50 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-bold text-stone-900 uppercase tracking-wide inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#2563EB]" />
                    Candidate native village &amp; location search *
                  </span>
                  <span className="text-[9px] text-blue-800 bg-white px-1.5 py-0.5 rounded border border-blue-200 shrink-0">
                    State → District → Mandal → Village
                  </span>
                </div>

                <div>
                  <Label>Quick village search (type to find village / mandal)</Label>
                  <div className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-lg px-2 py-1.5">
                    <Search className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <input
                      value={villageSearch}
                      onChange={(e) => setVillageSearch(e.target.value)}
                      placeholder="Type village name (e.g. Nandikandi, Kandi, Achampet)…"
                      className="w-full bg-transparent text-xs"
                    />
                  </div>

                  {villageSearch.trim() && (
                    <div className="mt-1 max-h-36 overflow-y-auto border border-stone-200 rounded-lg bg-white divide-y divide-stone-100">
                      {filteredVillages.slice(0, 25).map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            set({
                              nativeVillage: v.name,
                              mandal: v.mandal || form.mandal,
                              district: v.district || form.district,
                              state: v.state || form.state,
                            });
                            setVillageSearch('');
                          }}
                          className="w-full text-left px-2.5 py-1.5 hover:bg-blue-50 flex items-center justify-between gap-2"
                        >
                          <span className="text-xs font-semibold text-stone-800">{v.name}</span>
                          <span className="text-[10px] text-stone-500">
                            {v.mandal} · {v.vacancy > 0 ? `${v.vacancy} open` : 'full'}
                          </span>
                        </button>
                      ))}
                      {filteredVillages.length === 0 && (
                        <div className="px-2.5 py-2 text-[11px] text-stone-400">
                          No village matches.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Readonly label="Village" value={form.nativeVillage} />
                  <Readonly label="Mandal" value={form.mandal} />
                  <Readonly label="District" value={form.district} />
                  <Readonly label="State" value={form.state} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>House no.</Label>
                  <input
                    value={form.houseNumber}
                    onChange={(e) => set({ houseNumber: e.target.value })}
                    placeholder="e.g. H.No 2-18/B"
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label>PIN code</Label>
                  <input
                    value={form.pinCode}
                    onChange={(e) => set({ pinCode: e.target.value })}
                    placeholder="e.g. 502001"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <Label>Full residential address</Label>
                <textarea
                  rows={2}
                  value={form.address}
                  onChange={(e) => set({ address: e.target.value })}
                  placeholder="House No, Street, Landmark, Village, Mandal, District"
                  className={`${inputCls} resize-y`}
                />
              </div>
            </Card>

            <Card
              title="Office visit details"
              icon={Building2}
              badge={<Chip tone="stone">KYC Verification</Chip>}
            >
              <div>
                <Label>Regional office</Label>
                <select
                  value={form.regionalOffice}
                  onChange={(e) => set({ regionalOffice: e.target.value })}
                  className={inputCls}
                >
                  {REGIONAL_OFFICES.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Visit date</Label>
                  <input
                    type="date"
                    value={form.visitDate}
                    onChange={(e) => set({ visitDate: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label>Visit time</Label>
                  <input
                    value={form.visitTime}
                    onChange={(e) => set({ visitTime: e.target.value })}
                    placeholder="e.g. 11:00 AM"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="pt-1">
                <Label>Documents verification</Label>
                <div className="space-y-2 mt-1">
                  <DocRow
                    title="ID Proof (Aadhaar / PAN)"
                    required
                    verified={form.idProofVerified}
                    url={form.idProofUrl}
                    onToggle={(v) => set({ idProofVerified: v })}
                    onUrl={(v) => set({ idProofUrl: v })}
                  />
                  <DocRow
                    title="Address & Land Record Document"
                    verified={form.addressProofVerified}
                    url={form.addressProofUrl}
                    onToggle={(v) => set({ addressProofVerified: v })}
                    onUrl={(v) => set({ addressProofUrl: v })}
                  />
                  <DocRow
                    title="Other Required Document"
                    verified={form.otherDocVerified}
                    onToggle={(v) => set({ otherDocVerified: v })}
                  />
                </div>

                {!form.idProofVerified && (
                  <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 mt-2">
                    ID proof must be verified before continuing.
                  </p>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ── STEP 2 ─────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-3">
            <Card
              n="1"
              title="Candidate native village attachment & queue"
              icon={Building2}
              subtitle="Check live vacancy for the native village. Direct attach if slots are available, or place in the waiting queue."
              badge={
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-stone-400 font-semibold uppercase">
                    Live quota:
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                      nativeHasSlot
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-rose-50 text-rose-800 border-rose-300'
                    }`}
                  >
                    {villagesLoading
                      ? 'Checking…'
                      : nativeHasSlot
                      ? `✓ ${nativeVacancy} Open Slot(s)`
                      : 'Full Quota (0 Vacancy)'}
                  </span>
                </div>
              }
            >
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-stone-900 text-sm">
                      {form.nativeVillage || '—'}
                    </span>
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
                    Required Target: <strong>{nativeData?.requiredAgents ?? 0}</strong> Agents
                    • Currently Attached:{' '}
                    <strong>{nativeData?.attachedAgentsCount ?? 0}</strong> • Available
                    Slots:{' '}
                    <strong className={nativeHasSlot ? 'text-emerald-700' : 'text-rose-700'}>
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
                  onClick={() => nativeHasSlot && set({ nativeVillageAction: 'direct_attach' })}
                  title="Direct Attach Native Village"
                  badge={nativeHasSlot ? 'Recommended' : 'No slots'}
                  badgeTone={nativeHasSlot ? 'emerald' : 'rose'}
                  body={
                    nativeHasSlot
                      ? `Quota slot is open in ${form.nativeVillage}. Directly assign the candidate to their native village in the official Franchise Agreement.`
                      : `${form.nativeVillage || 'This village'} has no open slot, so it cannot be attached directly.`
                  }
                  footer={
                    form.nativeVillageAction === 'direct_attach'
                      ? '✓ Active: Native village will be attached in the agreement'
                      : null
                  }
                  tone="blue"
                />

                <OptionCard
                  selected={form.nativeVillageAction === 'queue'}
                  onClick={() => set({ nativeVillageAction: 'queue' })}
                  title="Place in Waiting Queue / Standby"
                  badge="Standby"
                  badgeTone="amber"
                  body={`Hold the candidate as interested in the waiting queue for ${
                    form.nativeVillage || 'their native village'
                  }. They can simultaneously be attached to other chosen villages below.`}
                  footer={
                    form.nativeVillageAction === 'queue'
                      ? '✓ Active: Held in the candidate waiting queue'
                      : 'Click to put the candidate on the waitlist'
                  }
                  tone="amber"
                />
              </div>

              {form.nativeVillageAction === 'queue' && (
                <div className="pt-1">
                  <Label>Waiting queue priority note / reason</Label>
                  <textarea
                    rows={2}
                    value={form.nativeVillageQueueReason}
                    onChange={(e) => set({ nativeVillageQueueReason: e.target.value })}
                    placeholder="e.g. Native village quota full — holding for the next opening"
                    className={`${inputCls} resize-y`}
                  />
                  {otherInterestVillages.length === 0 && (
                    <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1.5 mt-1.5">
                      This candidate has no other village of interest, so there is nothing to
                      attach them to. Link another village from their profile first.
                    </p>
                  )}
                </div>
              )}
            </Card>

            <Card
              n="2"
              title="Other chosen villages"
              icon={MapPin}
              subtitle="Villages the candidate registered interest in. These become the territories available for the agreement."
              badge={
                <div className="inline-flex rounded-lg border border-stone-200 p-0.5 bg-stone-100">
                  <button
                    type="button"
                    onClick={() => setVillageView('list')}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded-md inline-flex items-center gap-1 ${
                      villageView === 'list' ? 'bg-white text-[#2563EB] shadow-2xs' : 'text-stone-600'
                    }`}
                  >
                    <TableIcon className="w-3 h-3" /> List
                  </button>
                  <button
                    type="button"
                    onClick={() => setVillageView('map')}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded-md inline-flex items-center gap-1 ${
                      villageView === 'map' ? 'bg-white text-[#2563EB] shadow-2xs' : 'text-stone-600'
                    }`}
                  >
                    <MapIcon className="w-3 h-3" /> Map
                  </button>
                </div>
              }
            >
              {villageView === 'map' ? (
                <InteractiveMap
                  height="320px"
                  villages={villages}
                  showAllotmentColors
                  selectedVillageId={
                    villageByName.get(norm(form.selectedAgreementVillages[0]))?.id
                  }
                  onSelectVillage={(v) =>
                    set({
                      selectedAgreementVillages: form.selectedAgreementVillages.includes(v.name)
                        ? form.selectedAgreementVillages
                        : [...form.selectedAgreementVillages, v.name],
                    })
                  }
                />
              ) : otherInterestVillages.length === 0 ? (
                <p className="text-[11px] text-stone-400 py-3 text-center">
                  No other villages of interest linked to this candidate.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {otherInterestVillages.map((name) => {
                    const data = villageByName.get(norm(name));
                    const vac = data?.vacancy ?? 0;
                    const picked = form.selectedAgreementVillages.includes(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() =>
                          set({
                            selectedAgreementVillages: picked
                              ? form.selectedAgreementVillages.filter((v) => v !== name)
                              : [...form.selectedAgreementVillages, name],
                          })
                        }
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
                            {vac > 0 ? `✓ ${vac} Vacancy` : 'Full'}
                          </span>
                        </div>
                        <div className="text-[10px] text-stone-500 mt-0.5">
                          {data?.mandal || '—'} · {picked ? 'In agreement' : 'Tap to include'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── STEP 3 ─────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-3">
            <Card
              title="Franchise agreement territory allocation & village selection"
              icon={FileText}
              subtitle="Tick each village to be officially attached in the legal franchise agreement deed."
              badge={
                <Chip tone="blue">
                  {form.selectedAgreementVillages.length} village(s) selected
                </Chip>
              }
            >
              {form.nativeVillageAction === 'queue' ? (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 font-semibold">
                  Native village <strong>{form.nativeVillage}</strong> is held in the waiting
                  queue (standby) — it is not part of this agreement.
                </div>
              ) : (
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-900 font-semibold">
                  Native village <strong>{form.nativeVillage}</strong> is designated for direct
                  attachment.
                </div>
              )}

              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-stone-700">
                  Territories available for agreement (tick villages to attach):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {agreementCandidates.map((name) => {
                    const data = villageByName.get(norm(name));
                    const vac = data?.vacancy ?? 0;
                    const isNative = norm(name) === norm(form.nativeVillage);
                    const blocked = isNative && form.nativeVillageAction === 'queue';
                    const ticked = form.selectedAgreementVillages.includes(name);

                    return (
                      <label
                        key={name}
                        className={`p-2.5 rounded-lg border flex items-start gap-2 transition-all ${
                          blocked
                            ? 'bg-stone-50 border-stone-200 opacity-60 cursor-not-allowed'
                            : ticked
                            ? 'bg-blue-50 border-blue-400 cursor-pointer'
                            : 'bg-white border-stone-200 hover:border-stone-300 cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={ticked}
                          disabled={blocked}
                          onChange={(e) =>
                            set({
                              selectedAgreementVillages: e.target.checked
                                ? [...form.selectedAgreementVillages, name]
                                : form.selectedAgreementVillages.filter((v) => v !== name),
                            })
                          }
                          className="mt-0.5 accent-[#2563EB]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-stone-900">{name}</span>
                            {isNative && (
                              <span className="px-1.5 rounded text-[9px] font-bold bg-purple-100 text-purple-800">
                                Native
                              </span>
                            )}
                            <span
                              className={`px-1.5 rounded text-[10px] font-bold ${
                                vac > 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {vac > 0 ? `✓ ${vac} Vacancy` : 'Full'}
                            </span>
                          </div>
                          <div className="text-[10px] text-stone-500 mt-0.5">
                            {blocked ? 'Queued — cannot be attached' : data?.mandal || '—'}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Card title="Franchise agreement deed" icon={FileText}>
                <CheckRow
                  checked={form.agreementPrepared}
                  onChange={(v) => set({ agreementPrepared: v })}
                  title="Agreement deed prepared & printed"
                  sub={`Franchise deed covering: ${
                    form.selectedAgreementVillages.join(', ') || 'selected villages'
                  }.`}
                />

                <div>
                  <Label>Agreement execution date</Label>
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
                  title="Signed by candidate & regional officer"
                  sub="Required before the attachment can be completed."
                />

                <div>
                  <Label>Signed scan link (optional)</Label>
                  <input
                    value={form.agreementUrl}
                    onChange={(e) => set({ agreementUrl: e.target.value })}
                    placeholder="https://…"
                    className={inputCls}
                  />
                </div>
              </Card>

              <Card
                title="Agent security deposit fee"
                icon={Receipt}
                badge={
                  form.referenceNo.trim() ? <Chip tone="emerald">Receipt ready</Chip> : null
                }
              >
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Fee amount (₹) *</Label>
                    <input
                      type="number"
                      min="0"
                      value={form.feeAmount}
                      onChange={(e) => set({ feeAmount: Number(e.target.value) })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <Label>Payment mode</Label>
                    <select
                      value={form.paymentMode}
                      onChange={(e) => set({ paymentMode: e.target.value })}
                      className={inputCls}
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
                  <Label>Select security deposit tier</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {DEPOSIT_TIERS.map((t) => (
                      <button
                        key={t.amount}
                        type="button"
                        onClick={() => set({ feeAmount: t.amount })}
                        className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                          form.feeAmount === t.amount
                            ? 'bg-[#2563EB] border-[#2563EB] text-white'
                            : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1">
                    Standard deposit is ₹5,000. Refundable on exit per company policy.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Payment date</Label>
                    <input
                      type="date"
                      value={form.paymentDate}
                      onChange={(e) => set({ paymentDate: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <Label>Payment reference *</Label>
                    <input
                      value={form.referenceNo}
                      onChange={(e) => set({ referenceNo: e.target.value })}
                      placeholder="UTR / receipt no."
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/60 text-[11px] space-y-0.5">
                  <div className="font-bold text-emerald-900 inline-flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5" /> Official agent fee receipt
                  </div>
                  <div className="flex justify-between text-emerald-900">
                    <span>Receipt no.</span>
                    <strong>{form.receiptNo}</strong>
                  </div>
                  <div className="flex justify-between text-emerald-900">
                    <span>Amount</span>
                    <strong>{inr(form.feeAmount)}</strong>
                  </div>
                  <div className="flex justify-between text-emerald-900">
                    <span>Mode</span>
                    <strong>{form.paymentMode}</strong>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ── STEP 4 ─────────────────────────────────── */}
        {step === 4 && (
          <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-stone-900 text-sm tracking-tight">
                Final attachment confirmation
              </h3>
              <span className="text-[10px] text-stone-400">Step 4 of 4 • Complete review</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-stone-200 bg-stone-50/60 space-y-2.5">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                  Candidate profile
                </span>
                <div className="flex items-center gap-2.5">
                  <PersonAvatar name={form.name} photo={lead.photo} size="lg" />
                  <div>
                    <p className="font-bold text-stone-900 text-sm">{form.name}</p>
                    <p className="text-[11px] text-stone-500">{form.phone}</p>
                    <p className="text-[11px] text-stone-500">
                      Native: <strong>{form.nativeVillage}</strong> • {form.mandal} Mandal
                    </p>
                  </div>
                </div>

                {form.nativeVillageAction === 'queue' ? (
                  <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between">
                    <span className="font-bold text-amber-900 text-[11px] inline-flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Held in native village waiting queue
                    </span>
                    <span className="text-[10px] text-amber-800">Standby</span>
                  </div>
                ) : (
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                    <span className="font-bold text-emerald-900 text-[11px] inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Direct attach: {form.nativeVillage}
                    </span>
                    <span className="text-[10px] text-emerald-800">Assigned</span>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl border border-stone-200 bg-stone-50/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                    Official agreement territories ({form.selectedAgreementVillages.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="text-[10px] text-[#2563EB] font-bold hover:underline"
                  >
                    Modify (Part 3)
                  </button>
                </div>

                {form.selectedAgreementVillages.length === 0 ? (
                  <p className="text-[11px] text-rose-700">No territory selected.</p>
                ) : (
                  form.selectedAgreementVillages.map((vil) => {
                    const vac = villageByName.get(norm(vil))?.vacancy ?? 0;
                    const isNative = norm(vil) === norm(form.nativeVillage);
                    return (
                      <div
                        key={vil}
                        className="p-2 rounded-lg bg-white border border-stone-200 flex items-center justify-between gap-2"
                      >
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <MapPin className="w-3 h-3 text-[#2563EB]" />
                          <span className="font-bold text-stone-900">{vil}</span>
                          {isNative && (
                            <span className="px-1.5 rounded text-[9px] font-bold bg-purple-100 text-purple-800">
                              Native
                            </span>
                          )}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            vac > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SummaryCard
                label="Franchise agreement deed"
                ok={form.agreementSigned}
                okText="✓ Prepared & Signed"
                badText="Not signed yet"
              />
              <SummaryCard
                label="Agent security fee"
                ok={form.feeAmount > 0 && Boolean(form.referenceNo.trim())}
                okText={`✓ Paid (${inr(form.feeAmount)})`}
                badText="Payment reference missing"
              />
            </div>

            {!primaryVillage && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2">
                No attachable village selected — with the native village queued you must tick
                at least one other territory in step 3.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-stone-200 bg-white flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg border border-stone-200 bg-white text-xs font-bold text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={saveDraft}
            className="px-3.5 py-2 rounded-lg border border-stone-200 bg-white text-xs font-bold text-stone-700 hover:bg-stone-50 inline-flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5 text-[#2563EB]" /> Save
          </button>
        </div>

        <div className="flex items-center gap-2">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="px-3.5 py-2 rounded-lg border border-stone-200 bg-white text-xs font-bold text-stone-700 hover:bg-stone-50 inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {STEPS[step - 2].label}
            </button>
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={!stepValid[step]}
              className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-bold hover:bg-[#1D4ED8] disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              Next → {STEPS[step].label}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              disabled={saving || !primaryVillage}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              COMPLETE ATTACHMENT
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className="absolute bottom-20 right-5 px-3 py-2 bg-stone-900 text-white rounded-lg text-[11px] font-semibold shadow-xl">
          {toast}
        </div>
      )}
    </Shell>
  );
}

/* ── Local pieces ─────────────────────────────────────────────── */

const inputCls =
  'w-full text-xs bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-800 focus:border-[#2563EB]';

function Shell({ children, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[1000] bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
}

function Card({ n, title, subtitle, icon: Icon, badge, children }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-3.5 space-y-2.5">
      <div className="flex items-start justify-between gap-2 pb-2 border-b border-stone-100">
        <div className="flex items-start gap-2 min-w-0">
          {n && (
            <div className="w-5 h-5 rounded-md bg-[#2563EB] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
              {n}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-bold text-stone-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              {Icon && <Icon className="w-4 h-4 text-[#2563EB]" />}
              <span>{title}</span>
            </h3>
            {subtitle && <p className="text-[11px] text-stone-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>
      {children}
    </div>
  );
}

function Label({ children }) {
  return (
    <label className="text-[10px] font-semibold text-stone-500 uppercase block mb-1">
      {children}
    </label>
  );
}

function Readonly({ label, value }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="text-xs bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-700 truncate">
        {value || '—'}
      </div>
    </div>
  );
}

const CHIP_TONES = {
  stone: 'bg-stone-100 text-stone-700 border-stone-200',
  blue: 'bg-blue-50 text-blue-800 border-blue-200',
  emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

function Chip({ tone = 'stone', children }) {
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${CHIP_TONES[tone]}`}>
      {children}
    </span>
  );
}

function DocRow({ title, required, verified, url, onToggle, onUrl }) {
  return (
    <div
      className={`p-2 rounded-lg border ${
        verified ? 'bg-emerald-50/60 border-emerald-200' : 'bg-white border-stone-200'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 min-w-0 cursor-pointer">
          <ShieldCheck
            className={`w-4 h-4 shrink-0 ${verified ? 'text-emerald-600' : 'text-stone-300'}`}
          />
          <span className="min-w-0">
            <span className="text-xs font-bold text-stone-900 block truncate">
              {title}
              {required && <span className="ml-1 text-[10px] text-rose-600">required</span>}
            </span>
            <button
              type="button"
              onClick={() => onToggle(!verified)}
              className={`text-[10px] font-bold ${
                verified ? 'text-emerald-700' : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              {verified ? 'Verified' : 'Mark verified'}
            </button>
          </span>
        </label>

        <div className="flex items-center gap-1 shrink-0">
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="px-1.5 py-0.5 rounded border border-stone-200 bg-white text-[10px] font-bold text-stone-700 inline-flex items-center gap-1 hover:bg-stone-50"
            >
              <Eye className="w-3 h-3" /> View
            </a>
          ) : (
            <span className="px-1.5 py-0.5 rounded border border-stone-200 bg-stone-50 text-[10px] text-stone-400 inline-flex items-center gap-1">
              <Eye className="w-3 h-3" /> View
            </span>
          )}
          {onUrl && (
            <span className="px-1.5 py-0.5 rounded border border-stone-200 bg-white text-[10px] font-bold text-stone-600 inline-flex items-center gap-1">
              <Upload className="w-3 h-3 text-stone-500" /> Upload
            </span>
          )}
        </div>
      </div>

      {verified && onUrl && (
        <input
          value={url}
          onChange={(e) => onUrl(e.target.value)}
          placeholder="Link to the scan (optional)"
          className="mt-1.5 w-full text-[11px] bg-white border border-stone-200 rounded px-2 py-1"
        />
      )}
    </div>
  );
}

function OptionCard({ selected, disabled, onClick, title, badge, badgeTone, body, footer, tone }) {
  const ring =
    tone === 'amber'
      ? 'bg-amber-50/60 border-amber-400 ring-1 ring-amber-300'
      : 'bg-blue-50/60 border-[#2563EB] ring-1 ring-blue-300';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`p-3 rounded-xl border text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
        selected ? ring : 'bg-white border-stone-200 hover:border-stone-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <span
            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
              selected ? 'border-[#2563EB] bg-[#2563EB]' : 'border-stone-300'
            }`}
          >
            {selected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
          </span>
          <span className="font-bold text-xs text-stone-900">{title}</span>
        </span>
        <Chip tone={badgeTone === 'amber' ? 'stone' : badgeTone === 'rose' ? 'stone' : 'emerald'}>
          {badge}
        </Chip>
      </div>
      <p className="text-[11px] text-stone-600 mt-1.5">{body}</p>
      {footer && (
        <p
          className={`text-[10px] font-bold mt-1.5 ${
            selected ? 'text-[#2563EB]' : 'text-amber-700'
          }`}
        >
          {footer}
        </p>
      )}
    </button>
  );
}

function CheckRow({ checked, onChange, title, sub }) {
  return (
    <label
      className={`p-2 rounded-lg border flex items-start gap-2 cursor-pointer ${
        checked ? 'bg-emerald-50/60 border-emerald-200' : 'bg-white border-stone-200'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-[#2563EB]"
      />
      <span className="min-w-0">
        <span className="font-bold text-stone-900 block text-xs">{title}</span>
        <span className="text-[10px] text-stone-500">{sub}</span>
      </span>
    </label>
  );
}

function SummaryCard({ label, ok, okText, badText }) {
  return (
    <div
      className={`p-3 rounded-xl border ${
        ok ? 'bg-emerald-50/60 border-emerald-200' : 'bg-amber-50/60 border-amber-200'
      }`}
    >
      <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
        {label}
      </div>
      <div
        className={`text-sm font-black mt-1 ${ok ? 'text-emerald-900' : 'text-amber-900'}`}
      >
        {ok ? okText : badText}
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
