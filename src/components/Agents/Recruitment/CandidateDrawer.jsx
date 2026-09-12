import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Plus, ChevronRight } from 'lucide-react';

import recruitmentService from '../../../services/recruitmentService';
import useLocations from '../../../hooks/useLocations';
import Badge from '../common/Badge';
import CallButton from '../common/CallButton';
import {
  PIPELINE_STAGES,
  TERMINAL_STAGES,
  STAGE_LABELS,
  INTEREST_LABELS,
  nextStage,
} from './recruitmentConstants';

const STAGE_VARIANTS = {
  NEW_LEAD: 'blue',
  FIRST_CALL: 'blue',
  INTERESTED: 'green',
  LOCATION_CHECK: 'green',
  VILLAGE_INTEREST: 'yellow',
  WAITING: 'yellow',
  SELECTED: 'orange',
  OFFICE_VISIT: 'purple',
  JOINING_PROCESS: 'purple',
  JOINED: 'green',
};

const formatDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatStamp = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return `${dt.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  })} · ${dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
};

/**
 * A candidate's recruitment record: where they are in the pipeline, which
 * villages they have registered interest in, and how they got here.
 */
export default function CandidateDrawer({ candidateId, onClose, onChanged }) {
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [addingVillage, setAddingVillage] = useState(false);

  const {
    states,
    districts,
    mandals,
    villages,
    selectedState,
    selectedDistrict,
    selectedMandal,
    setSelectedState,
    setSelectedDistrict,
    setSelectedMandal,
    loading: locationsLoading,
  } = useLocations();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await recruitmentService.getCandidate(candidateId);
      setCandidate(data.result || data.data || null);
    } catch (err) {
      console.error('Failed to load candidate:', err);
      setError('Could not load this candidate.');
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (fn, failMessage) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      onChanged?.();
    } catch (err) {
      // The server returns 409 with a readable reason for rule violations —
      // e.g. selecting a non-native for a seat under native search.
      setError(err.response?.data?.message || failMessage);
    } finally {
      setBusy(false);
    }
  };

  const advance = () => {
    const next = nextStage(candidate.status);
    if (!next) return;
    runAction(
      () =>
        recruitmentService.updateCandidateStatus(
          candidate.id,
          next,
          `Advanced to ${STAGE_LABELS[next]}`
        ),
      'Could not advance this candidate.'
    );
  };

  const setStage = (status) => {
    runAction(
      () => recruitmentService.updateCandidateStatus(candidate.id, status),
      'Could not update the stage.'
    );
  };

  const addInterest = (villageName) => {
    if (!villageName) return;
    runAction(
      () =>
        recruitmentService.addInterests(candidate.id, [
          {
            village: villageName,
            state: states.find((s) => String(s.id) === String(selectedState))?.name,
            district: districts.find((d) => String(d.id) === String(selectedDistrict))?.name,
            mandal: mandals.find((m) => String(m.id) === String(selectedMandal))?.name,
          },
        ]),
      'Could not link that village.'
    ).then(() => setAddingVillage(false));
  };

  const removeInterest = (interestId) => {
    runAction(
      () => recruitmentService.removeInterest(interestId),
      'Could not remove that interest.'
    );
  };

  const convert = () => {
    runAction(
      () => recruitmentService.convertCandidate(candidate.id),
      'Could not appoint this candidate.'
    );
  };

  const interests = candidate?.interests || [];
  const history = candidate?.history || [];
  const next = candidate ? nextStage(candidate.status) : null;
  const isClosed = candidate ? TERMINAL_STAGES.includes(candidate.status) : false;

  const selectClass =
    'text-xs bg-[#fafaf9] border border-[#e7e5e4] rounded-lg px-2 py-1.5 font-semibold text-[#1c1917] disabled:opacity-50';

  return (
    <div
      className="fixed inset-0 z-[900] bg-[#1c1917]/40 backdrop-blur-xs flex justify-end"
      onClick={onClose}
    >
      <aside
        className="bg-[#f5f5f4] w-full max-w-xl h-full flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Candidate record"
      >
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="flex items-center gap-2 text-xs font-bold text-[#78716c]">
              <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading candidate…
            </span>
          </div>
        ) : !candidate ? (
          <div className="flex-1 flex items-center justify-center text-xs text-[#78716c]">
            {error || 'Candidate not found.'}
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-[#1c1917] text-white px-5 py-4 flex items-start justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-[#2563EB] flex items-center justify-center font-black shrink-0">
                  {String(candidate.name || '?').charAt(0)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold truncate">{candidate.name}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant={STAGE_VARIANTS[candidate.status] || 'gray'} dot>
                      {STAGE_LABELS[candidate.status] || candidate.status}
                    </Badge>
                    <span className="text-xs text-gray-300">{candidate.phone}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <CallButton
                  phone={candidate.phone}
                  recordName={candidate.name}
                  recordId={candidate.id}
                  recordType="AGENT_CANDIDATE"
                  size="md"
                />
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Stage actions */}
            <div className="bg-white border-b border-[#e7e5e4] px-5 py-3 flex flex-wrap items-center gap-2 shrink-0">
              {next && !isClosed && (
                <button
                  type="button"
                  onClick={advance}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2563EB] text-white text-xs font-bold hover:bg-[#1d4ed8] disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                  Advance to {STAGE_LABELS[next]}
                </button>
              )}

              {candidate.status === 'SELECTED' && (
                <button
                  type="button"
                  onClick={convert}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-lg bg-[#2563EB] text-white text-xs font-bold hover:bg-[#1d4ed8] disabled:opacity-50"
                >
                  Appoint as agent
                </button>
              )}

              <select
                value=""
                onChange={(e) => e.target.value && setStage(e.target.value)}
                disabled={busy}
                aria-label="Set stage"
                className={selectClass}
              >
                <option value="">Set stage…</option>
                <optgroup label="Pipeline">
                  {PIPELINE_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {STAGE_LABELS[s]}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Close">
                  {TERMINAL_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {STAGE_LABELS[s]}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl px-3 py-2">
                  {error}
                </div>
              )}

              {/* Profile */}
              <section className="bg-white rounded-2xl border border-[#e7e5e4] shadow-sm p-4 space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#57534e]">
                  Profile
                </h4>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  {[
                    ['Home village', candidate.village],
                    ['Mandal', candidate.mandal],
                    ['District', candidate.district],
                    ['Lead source', candidate.lead_source],
                    ['Type', candidate.candidate_type],
                    ['Added', formatDate(candidate.created_at)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-2">
                      <dt className="text-[#78716c] font-semibold">{label}</dt>
                      <dd className="text-[#1c1917] font-bold text-right truncate">
                        {value || '—'}
                      </dd>
                    </div>
                  ))}
                </dl>
                {candidate.notes && (
                  <p className="text-xs text-[#57534e] bg-[#fafaf9] rounded-xl p-3 leading-relaxed">
                    {candidate.notes}
                  </p>
                )}
              </section>

              {/* Village interests */}
              <section className="bg-white rounded-2xl border border-[#e7e5e4] shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#57534e]">
                    Village interests
                  </h4>
                  <button
                    type="button"
                    onClick={() => setAddingVillage((v) => !v)}
                    disabled={busy}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#f5f5f4] text-[#1c1917] text-[11px] font-bold hover:bg-[#2563EB] hover:text-white disabled:opacity-50"
                  >
                    {addingVillage ? (
                      'Cancel'
                    ) : (
                      <>
                        <Plus className="w-3 h-3" /> Add village
                      </>
                    )}
                  </button>
                </div>

                {addingVillage && (
                  <div className="grid grid-cols-2 gap-2 p-3 bg-[#fafaf9] rounded-xl border border-[#e7e5e4]">
                    <select
                      value={selectedState}
                      onChange={(e) => setSelectedState(e.target.value)}
                      disabled={locationsLoading.states}
                      aria-label="State"
                      className={selectClass}
                    >
                      <option value="">{locationsLoading.states ? 'Loading…' : 'State'}</option>
                      {states.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedDistrict}
                      onChange={(e) => setSelectedDistrict(e.target.value)}
                      disabled={!selectedState || locationsLoading.districts}
                      aria-label="District"
                      className={selectClass}
                    >
                      <option value="">
                        {locationsLoading.districts ? 'Loading…' : 'District'}
                      </option>
                      {districts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedMandal}
                      onChange={(e) => setSelectedMandal(e.target.value)}
                      disabled={!selectedDistrict || locationsLoading.mandals}
                      aria-label="Mandal"
                      className={selectClass}
                    >
                      <option value="">
                        {locationsLoading.mandals ? 'Loading…' : 'Mandal'}
                      </option>
                      {mandals.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value=""
                      onChange={(e) => {
                        const v = villages.find((x) => String(x.id) === String(e.target.value));
                        if (v) addInterest(v.name);
                      }}
                      disabled={!selectedMandal || locationsLoading.villages || busy}
                      aria-label="Village"
                      className={selectClass}
                    >
                      <option value="">
                        {locationsLoading.villages ? 'Loading…' : 'Pick village…'}
                      </option>
                      {villages
                        .filter(
                          (v) =>
                            !interests.some(
                              (i) =>
                                (i.village || '').toLowerCase() ===
                                (v.name || '').toLowerCase()
                            )
                        )
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {interests.length === 0 ? (
                  <p className="text-xs text-[#78716c]">
                    No villages linked yet. A candidate needs at least one before they can be
                    selected for a seat.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {interests.map((i) => (
                      <li
                        key={i.id}
                        className="flex items-center justify-between gap-2 p-2.5 bg-[#fafaf9] rounded-xl border border-[#e7e5e4]"
                      >
                        <div className="min-w-0">
                          <span className="flex items-center gap-2 flex-wrap">
                            <strong className="text-xs font-bold text-[#1c1917]">
                              {i.village}
                            </strong>
                            {i.is_native && (
                              <span className="px-1.5 py-0.5 rounded bg-[#2563EB]/10 text-[#2563EB] text-[10px] font-bold uppercase">
                                native
                              </span>
                            )}
                          </span>
                          <span className="block text-[10px] text-[#78716c] mt-0.5">
                            {INTEREST_LABELS[i.status] || i.status}
                            {i.interested_since && ` · since ${formatDate(i.interested_since)}`}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeInterest(i.id)}
                          disabled={busy}
                          aria-label={`Remove interest in ${i.village}`}
                          className="p-1 rounded-lg text-[#78716c] hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* History */}
              <section className="bg-white rounded-2xl border border-[#e7e5e4] shadow-sm p-4 space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#57534e]">
                  Status history
                </h4>
                {history.length === 0 ? (
                  <p className="text-xs text-[#78716c]">No transitions recorded.</p>
                ) : (
                  <ol className="space-y-3">
                    {history.map((h) => (
                      <li key={h.id} className="flex gap-3">
                        <span className="w-2 h-2 rounded-full bg-[#2563EB] mt-1.5 shrink-0" />
                        <div className="min-w-0">
                          <span className="block text-xs font-bold text-[#1c1917]">
                            {h.from_status
                              ? `${STAGE_LABELS[h.from_status] || h.from_status} → ${
                                  STAGE_LABELS[h.to_status] || h.to_status
                                }`
                              : STAGE_LABELS[h.to_status] || h.to_status}
                          </span>
                          {h.notes && (
                            <span className="block text-[11px] text-[#57534e]">{h.notes}</span>
                          )}
                          <span className="block text-[10px] text-[#78716c]">
                            {formatStamp(h.created_at)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
