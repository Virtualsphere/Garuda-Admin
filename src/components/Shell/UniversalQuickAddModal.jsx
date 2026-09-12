import { useState, useEffect, useMemo } from 'react';
import {
  X,
  MapPin,
  User,
  Users,
  Building2,
  CalendarCheck,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Plus,
} from 'lucide-react';

import useLocations from '../../hooks/useLocations';
import { useCall } from '../../context/CallContext';
import landService from '../../services/landService';
import buyerService from '../../services/buyerService';
import recruitmentService from '../../services/recruitmentService';
import agentLeadService from '../../services/agentLeadService';

const TABS = [
  { key: 'land', label: 'Land', icon: MapPin, tone: 'emerald' },
  { key: 'buyer', label: 'Buyer', icon: User, tone: 'blue' },
  { key: 'agent', label: 'Agent lead', icon: Users, tone: 'indigo' },
  { key: 'farmer', label: 'Farmer lead', icon: Building2, tone: 'amber' },
  { key: 'visit', label: 'Site visit', icon: CalendarCheck, tone: 'rose' },
];

const TONE_ACTIVE = {
  emerald: 'border-emerald-500 text-emerald-800 bg-emerald-50',
  blue: 'border-blue-500 text-blue-800 bg-blue-50',
  indigo: 'border-indigo-500 text-indigo-800 bg-indigo-50',
  amber: 'border-amber-500 text-amber-900 bg-amber-50',
  rose: 'border-rose-500 text-rose-800 bg-rose-50',
};

const LEAD_SOURCES = ['Meta Ads', 'Field Executive', 'Agent', 'App', 'MyOperator'];

const REGIONAL_OFFICES = [
  'Sangareddy Regional Office',
  'Kalwakurthy Regional Office',
  'Nagarkurnool Regional Office',
  'Achampet Regional Office',
  'Hyderabad Head Office',
];

const input =
  'w-full text-xs bg-white border border-stone-200 rounded-lg px-2.5 py-2 text-stone-800';

const addDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const nameById = (list, id) =>
  list.find((x) => String(x.id) === String(id))?.name || '';

/**
 * Add a record from anywhere, without leaving the page you are on.
 *
 * Each tab writes through the service that owns that record, so what is saved
 * here is the same row the owning page would have created. Two shapes are worth
 * knowing:
 *
 *  - A farmer lead is not its own table. In this schema a farmer exists as the
 *    owner of a land record, so the Farmer tab creates a land with the farmer's
 *    details attached — which is exactly what a farmer lead is.
 *  - Site visit books a candidate into a regional office. A buyer's land visit
 *    is attributed to the signed-in user by the API, which would record staff
 *    as the visitor, so it is not offered here.
 */
export default function UniversalQuickAddModal({ open, initialTab = 'land', onClose }) {
  const [tab, setTab] = useState(initialTab);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const { flagDuplicatePhone } = useCall();

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

  // Land / farmer
  const [farmerName, setFarmerName] = useState('');
  const [farmerPhone, setFarmerPhone] = useState('');
  const [surveyNo, setSurveyNo] = useState('');
  const [acres, setAcres] = useState('');
  const [guntas, setGuntas] = useState('');
  const [pricePerAcre, setPricePerAcre] = useState('');
  const [landNotes, setLandNotes] = useState('');

  // Buyer
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [budget, setBudget] = useState('');
  const [extent, setExtent] = useState('');
  const [preferred, setPreferred] = useState('');
  const [buyerNotes, setBuyerNotes] = useState('');

  // Agent lead
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadSource, setLeadSource] = useState(LEAD_SOURCES[0]);
  const [leadNotes, setLeadNotes] = useState('');

  // Visit
  const [candidates, setCandidates] = useState([]);
  const [visitCandidate, setVisitCandidate] = useState('');
  const [visitOffice, setVisitOffice] = useState(REGIONAL_OFFICES[0]);
  const [visitDate, setVisitDate] = useState(() => addDays(2));
  const [visitTime, setVisitTime] = useState('11:30 AM');

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Candidates for the visit tab, only when that tab is actually in use.
  useEffect(() => {
    if (!open || tab !== 'visit') return;
    agentLeadService
      .getLeads({ status: 'INTERESTED' })
      .then((data) => {
        const rows = data.result || data.data || [];
        setCandidates(Array.isArray(rows) ? rows : []);
      })
      .catch(() => setCandidates([]));
  }, [open, tab]);

  const location = useMemo(
    () => ({
      state: nameById(states, selectedState),
      district: nameById(districts, selectedDistrict),
      mandal: nameById(mandals, selectedMandal),
      village: nameById(villages, selectedVillage),
    }),
    [states, districts, mandals, villages, selectedState, selectedDistrict, selectedMandal, selectedVillage]
  );

  const reset = () => {
    setFarmerName('');
    setFarmerPhone('');
    setSurveyNo('');
    setAcres('');
    setGuntas('');
    setPricePerAcre('');
    setLandNotes('');
    setBuyerName('');
    setBuyerPhone('');
    setBuyerEmail('');
    setBudget('');
    setExtent('');
    setPreferred('');
    setBuyerNotes('');
    setLeadName('');
    setLeadPhone('');
    setLeadNotes('');
    setVisitCandidate('');
  };

  const saveLand = async (asFarmerLead) => {
    const acresNum = Number(acres) || 0;
    const priceNum = Number(pricePerAcre) || 0;

    await landService.create({
      ...location,
      farmerDetails: {
        name: farmerName.trim(),
        phone: farmerPhone.trim(),
      },
      landDetails: {
        total_acres: acresNum || undefined,
        guntas: Number(guntas) || undefined,
        price_per_acres: priceNum || undefined,
        // Kept consistent with how the land pages compute it, so a quick-added
        // parcel sorts and filters alongside the rest.
        total_value: acresNum && priceNum ? acresNum * priceNum : undefined,
      },
    });

    return asFarmerLead
      ? `${farmerName.trim()} added as a farmer lead in ${location.village || 'the selected village'}`
      : `Land in ${location.village || 'the selected village'} added for ${farmerName.trim()}`;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let message;

      if (tab === 'land') {
        message = await saveLand(false);
      } else if (tab === 'farmer') {
        message = await saveLand(true);
      } else if (tab === 'buyer') {
        const data = await buyerService.createFromDesk({
          name: buyerName.trim(),
          phone: buyerPhone.trim(),
          email: buyerEmail.trim() || undefined,
          budget_range: budget.trim() || undefined,
          required_extent: extent.trim() || undefined,
          preferred_location: preferred.trim() || undefined,
          notes: buyerNotes.trim() || undefined,
        });
        message = `${data.data?.name || buyerName.trim()} added as a buyer`;
      } else if (tab === 'agent') {
        await recruitmentService.createCandidate({
          name: leadName.trim(),
          phone: leadPhone.trim(),
          lead_source: leadSource,
          notes: leadNotes.trim() || undefined,
          ...location,
        });
        message = `${leadName.trim()} added as an agent lead`;
      } else {
        const candidate = candidates.find((c) => String(c.id) === String(visitCandidate));
        await agentLeadService.scheduleOfficeVisit({
          candidateId: Number(visitCandidate),
          regionalOffice: visitOffice,
          visitDate,
          visitTime,
          interestedVillage: candidate?.village || undefined,
        });
        message = `${candidate?.name || 'Candidate'} booked in to ${visitOffice}`;
      }

      setSuccess(message);
      reset();
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not save that record.';
      // A clashing phone number is worth showing properly rather than as a
      // red line — the desk usually wants to see who already has it.
      if (/already exists/i.test(msg)) {
        flagDuplicatePhone({
          phone: tab === 'buyer' ? buyerPhone.trim() : leadPhone.trim(),
          context: tab === 'buyer' ? 'buyer' : 'agent lead',
        });
      }
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const canSave =
    !saving &&
    ((tab === 'land' && farmerName.trim() && farmerPhone.trim() && location.village) ||
      (tab === 'farmer' && farmerName.trim() && farmerPhone.trim() && location.village) ||
      (tab === 'buyer' && buyerName.trim() && buyerPhone.trim()) ||
      (tab === 'agent' && leadName.trim() && leadPhone.trim()) ||
      (tab === 'visit' && visitCandidate && visitDate));

  const activeTab = TABS.find((t) => t.key === tab) || TABS[0];

  return (
    <div
      className="garuda-ui fixed inset-0 z-[1150] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden text-xs"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-5 py-3 border-b border-stone-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Plus className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-stone-900 text-sm">Quick add a record</h3>
              <p className="text-[11px] text-stone-500">
                Saved straight to {activeTab.label.toLowerCase()} — no need to leave this page
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 border-b border-stone-200 flex gap-1 overflow-x-auto shrink-0">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTab(t.key);
                  setSuccess(null);
                  setError(null);
                }}
                className={`py-2 px-3 font-semibold border-b-2 inline-flex items-center gap-1.5 shrink-0 transition-colors ${
                  tab === t.key
                    ? TONE_ACTIVE[t.tone]
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 space-y-3">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 font-semibold rounded-lg px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold rounded-lg px-3 py-2 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> {success}
            </div>
          )}

          {(tab === 'land' || tab === 'farmer') && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Farmer / owner name" required>
                  <input
                    value={farmerName}
                    onChange={(e) => setFarmerName(e.target.value)}
                    placeholder="e.g. Rami Reddy"
                    className={input}
                  />
                </Field>
                <Field label="Phone" required>
                  <input
                    value={farmerPhone}
                    onChange={(e) => setFarmerPhone(e.target.value)}
                    placeholder="10-digit mobile"
                    className={input}
                  />
                </Field>
              </div>

              <LocationPicker
                {...{
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
                }}
              />

              {tab === 'land' && (
                <Field label="Survey number(s)">
                  <input
                    value={surveyNo}
                    onChange={(e) => setSurveyNo(e.target.value)}
                    placeholder="e.g. 245/A, 312/1"
                    className={input}
                  />
                </Field>
              )}

              <div className="grid grid-cols-3 gap-3">
                <Field label={tab === 'farmer' ? 'Approx acres' : 'Acres'}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={acres}
                    onChange={(e) => setAcres(e.target.value)}
                    placeholder="e.g. 3"
                    className={input}
                  />
                </Field>
                <Field label="Guntas">
                  <input
                    type="number"
                    min="0"
                    value={guntas}
                    onChange={(e) => setGuntas(e.target.value)}
                    placeholder="e.g. 20"
                    className={input}
                  />
                </Field>
                <Field label="Price per acre (₹)">
                  <input
                    type="number"
                    min="0"
                    value={pricePerAcre}
                    onChange={(e) => setPricePerAcre(e.target.value)}
                    placeholder="e.g. 2500000"
                    className={input}
                  />
                </Field>
              </div>

              {acres && pricePerAcre && (
                <p className="text-[11px] text-stone-600 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5">
                  Total value:{' '}
                  <strong className="text-stone-900">
                    ₹{(Number(acres) * Number(pricePerAcre)).toLocaleString('en-IN')}
                  </strong>
                </p>
              )}

              <Field label="Notes">
                <textarea
                  rows={2}
                  value={landNotes}
                  onChange={(e) => setLandNotes(e.target.value)}
                  placeholder="Water facility, electricity, boundaries, road width…"
                  className={`${input} resize-y`}
                />
              </Field>

              {tab === 'farmer' && (
                <p className="text-[10px] text-stone-500 bg-blue-50/60 border border-blue-200 rounded-lg px-2.5 py-2">
                  A farmer is recorded as the owner of a land parcel — this creates that land
                  record with their details attached, which is what a farmer lead is here.
                </p>
              )}
            </>
          )}

          {tab === 'buyer' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Buyer name" required>
                  <input
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="e.g. Rajesh Sharma"
                    className={input}
                  />
                </Field>
                <Field label="Phone" required>
                  <input
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    placeholder="10-digit mobile"
                    className={input}
                  />
                </Field>
              </div>

              <Field label="Email (optional)">
                <input
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  placeholder="name@example.com"
                  className={input}
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Budget range">
                  <input
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="e.g. 50 Lakhs - 1 Crore"
                    className={input}
                  />
                </Field>
                <Field label="Required extent">
                  <input
                    value={extent}
                    onChange={(e) => setExtent(e.target.value)}
                    placeholder="e.g. 2 to 5 Acres"
                    className={input}
                  />
                </Field>
              </div>

              <Field label="Preferred location">
                <input
                  value={preferred}
                  onChange={(e) => setPreferred(e.target.value)}
                  placeholder="e.g. Warangal Highway / Yadadri"
                  className={input}
                />
              </Field>

              <Field label="Requirements">
                <textarea
                  rows={2}
                  value={buyerNotes}
                  onChange={(e) => setBuyerNotes(e.target.value)}
                  placeholder="Needs highway facing, tar road access, clear title…"
                  className={`${input} resize-y`}
                />
              </Field>
            </>
          )}

          {tab === 'agent' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Candidate name" required>
                  <input
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    placeholder="e.g. Komuravelli Mallaiah"
                    className={input}
                  />
                </Field>
                <Field label="Phone" required>
                  <input
                    value={leadPhone}
                    onChange={(e) => setLeadPhone(e.target.value)}
                    placeholder="10-digit mobile"
                    className={input}
                  />
                </Field>
              </div>

              <Field label="Lead source">
                <select
                  value={leadSource}
                  onChange={(e) => setLeadSource(e.target.value)}
                  className={input}
                >
                  {LEAD_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>

              <LocationPicker
                {...{
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
                }}
              />

              <Field label="Notes">
                <textarea
                  rows={2}
                  value={leadNotes}
                  onChange={(e) => setLeadNotes(e.target.value)}
                  placeholder="What did they ask about?"
                  className={`${input} resize-y`}
                />
              </Field>
            </>
          )}

          {tab === 'visit' && (
            <>
              <Field label="Candidate" required>
                <select
                  value={visitCandidate}
                  onChange={(e) => setVisitCandidate(e.target.value)}
                  className={input}
                >
                  <option value="">Select an interested candidate…</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.phone}
                      {c.village ? ` (${c.village})` : ''}
                    </option>
                  ))}
                </select>
                {candidates.length === 0 && (
                  <p className="text-[10px] text-stone-400 mt-1">
                    Nobody is marked Interested yet — a candidate has to reach that stage
                    before an office visit can be booked.
                  </p>
                )}
              </Field>

              <Field label="Regional office">
                <select
                  value={visitOffice}
                  onChange={(e) => setVisitOffice(e.target.value)}
                  className={input}
                >
                  {REGIONAL_OFFICES.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Visit date" required>
                  <input
                    type="date"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    className={input}
                  />
                </Field>
                <Field label="Time">
                  <input
                    value={visitTime}
                    onChange={(e) => setVisitTime(e.target.value)}
                    placeholder="e.g. 11:30 AM"
                    className={input}
                  />
                </Field>
              </div>

              <p className="text-[10px] text-stone-500 bg-blue-50/60 border border-blue-200 rounded-lg px-2.5 py-2">
                Re-booking a candidate who already has a visit moves it rather than creating a
                second one.
              </p>
            </>
          )}
        </form>

        <div className="px-5 py-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-2 shrink-0">
          <span className="text-[10px] text-stone-500 truncate">
            {success ? 'Saved. Add another, or close.' : 'Fields marked * are required.'}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-100 text-stone-700 font-semibold"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-stone-300 disabled:cursor-not-allowed text-white font-bold inline-flex items-center gap-1.5"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save {activeTab.label.toLowerCase()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Local pieces ─────────────────────────────────────────────── */

function Field({ label, required, children }) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-stone-500 uppercase block mb-1">
        {label}
        {required && <span className="text-rose-600 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function LocationPicker({
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
  loading,
}) {
  return (
    <div className="p-2.5 rounded-lg border border-stone-200 bg-stone-50/60 space-y-2">
      <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wide flex items-center gap-1.5">
        <MapPin className="w-3 h-3" />
        Location
        {loading && <Loader2 className="w-3 h-3 animate-spin text-[#2563EB]" />}
      </span>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={selectedState || ''}
          onChange={(e) => setSelectedState(e.target.value)}
          className={input}
        >
          <option value="">State…</option>
          {states.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={selectedDistrict || ''}
          onChange={(e) => setSelectedDistrict(e.target.value)}
          disabled={!selectedState}
          className={`${input} disabled:opacity-50`}
        >
          <option value="">District…</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          value={selectedMandal || ''}
          onChange={(e) => setSelectedMandal(e.target.value)}
          disabled={!selectedDistrict}
          className={`${input} disabled:opacity-50`}
        >
          <option value="">Mandal…</option>
          {mandals.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select
          value={selectedVillage || ''}
          onChange={(e) => setSelectedVillage(e.target.value)}
          disabled={!selectedMandal}
          className={`${input} disabled:opacity-50`}
        >
          <option value="">Village…</option>
          {villages.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
