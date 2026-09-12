import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Clock,
  CheckCircle2,
  Tag,
  ShieldCheck,
  IndianRupee,
  TrendingUp,
  MapPin,
  Eye,
  Loader2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';

import PersonAvatar from '../common/PersonAvatar';
import agentObservationService from '../../../services/agentObservationService';
import { AGENT_CODE, OBSERVATION_STATUS_LABELS } from '../agentConstants';

const lakhs = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return null;
  return `₹${(n / 100000).toFixed(1)}L / acre`;
};

const stamp = (iso) => {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return String(iso).slice(0, 10);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const TYPE_STYLES = {
  'Price change': 'bg-amber-50 text-amber-800 border-amber-200',
  'Sale stage': 'bg-emerald-50 text-emerald-800 border-emerald-200',
  'Local issue': 'bg-blue-50 text-blue-800 border-blue-200',
  Verification: 'bg-purple-50 text-purple-800 border-purple-200',
  Report: 'bg-stone-100 text-stone-700 border-stone-200',
};

/**
 * Everything an agent has reported about one observed parcel, newest first.
 *
 * The prototype tracks a per-user "unread" flag; there is no such column here,
 * and inventing one client-side would mark things read on one desk and not
 * another. The real actionable signal is verification — a report nobody has
 * approved or rejected yet is what the desk still has to deal with — so that
 * is what the header counts.
 */
export default function ObservationTimelineModal({ assignment, onClose, onVerified }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const load = async () => {
    if (!assignment?.id) return;
    setLoading(true);
    try {
      const data = await agentObservationService.getSubmissions({
        observationId: assignment.id,
      });
      const rows = data.result || data.data || [];
      setSubmissions(Array.isArray(rows) ? rows : []);
      setError(null);
    } catch (err) {
      console.error('Failed to load observation submissions:', err);
      setSubmissions([]);
      setError('Could not load this observation’s reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Reload whenever a different assignment is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignment?.id]);

  const land = assignment?.land || {};
  const agent = assignment?.agent || {};

  // Newest first — the desk reads the latest state of the parcel, then history.
  const ordered = useMemo(
    () =>
      [...submissions].sort(
        (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
      ),
    [submissions]
  );

  const pendingCount = ordered.filter(
    (s) => !s.verification_status || s.verification_status === 'PENDING'
  ).length;

  const verify = async (submission, status) => {
    setBusyId(submission.id);
    setError(null);
    try {
      await agentObservationService.verifySubmission(
        submission.id,
        status,
        status === 'APPROVED' ? submission.reported_price_per_acre : undefined
      );
      await load();
      onVerified?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not record that verification.');
    } finally {
      setBusyId(null);
    }
  };

  if (!assignment) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-stone-200 w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 bg-stone-900 text-white flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-400/30 flex items-center justify-center shrink-0">
              <Eye className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm text-white">Observation timeline</h3>
                <span className="text-xs text-sky-300 bg-sky-900/60 px-2 py-0.5 rounded border border-sky-700">
                  LD-{land.id ?? assignment.land_id}
                </span>
                {pendingCount > 0 && (
                  <span className="bg-rose-500 text-white font-bold text-[10px] px-2 py-0.5 rounded-full">
                    {pendingCount} to verify
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-400 truncate">
                Observing agent:{' '}
                <span className="text-stone-200 font-medium">{agent.name || '—'}</span>
                {agent.id ? ` (${AGENT_CODE(agent.id)})` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Land summary */}
        <div className="p-3 bg-stone-50 border-b border-stone-200 flex items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-md bg-stone-200 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-stone-400" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-stone-900 block truncate">
                {[land.village, land.district].filter(Boolean).join(', ') || 'Land parcel'}
              </span>
              <span className="text-stone-500 text-[11px]">
                {land.landDetails?.total_acres
                  ? `${land.landDetails.total_acres} acres`
                  : 'acreage not recorded'}
                {lakhs(land.landDetails?.price_per_acres)
                  ? ` • ${lakhs(land.landDetails.price_per_acres)}`
                  : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="px-2 py-1 rounded bg-white border border-stone-200 text-[10px] font-bold text-stone-700">
              {OBSERVATION_STATUS_LABELS[assignment.status] || assignment.status || 'Active'}
            </span>
            {assignment.next_due_date && (
              <span className="px-2 py-1 rounded bg-white border border-stone-200 text-[10px] text-stone-600">
                Next due {assignment.next_due_date}
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="mx-4 mt-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="py-12 flex items-center justify-center">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-stone-500">
                <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading reports…
              </span>
            </div>
          ) : ordered.length === 0 ? (
            <div className="text-center py-10 text-stone-400 text-xs">
              <Clock className="w-8 h-8 mx-auto mb-2 text-stone-300" />
              <p className="font-medium text-stone-600">No reports filed yet</p>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Price, sale status, availability and local issues appear here as the agent
                files them.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200">
              {ordered.map((item) => {
                const entries = describe(item);
                const isPending =
                  !item.verification_status || item.verification_status === 'PENDING';
                const busy = String(busyId) === String(item.id);

                return (
                  <div key={item.id} className="relative">
                    <div
                      className={`absolute -left-6 top-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        isPending
                          ? 'bg-sky-600 border-white ring-2 ring-sky-300 text-white'
                          : item.verification_status === 'REJECTED'
                          ? 'bg-rose-100 border-rose-300 text-rose-700'
                          : 'bg-emerald-100 border-emerald-300 text-emerald-700'
                      }`}
                    >
                      {iconFor(entries[0]?.type)}
                    </div>

                    <div
                      className={`p-3 rounded-lg border text-xs space-y-2 ${
                        isPending ? 'bg-sky-50/70 border-sky-200' : 'bg-white border-stone-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          {entries.map((e) => (
                            <span
                              key={e.type + e.title}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                TYPE_STYLES[e.type] || TYPE_STYLES.Report
                              }`}
                            >
                              {e.type}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 text-stone-400 text-[10px]">
                          <Clock className="w-3 h-3" />
                          <span>{stamp(item.created_at)}</span>
                        </div>
                      </div>

                      <ul className="text-stone-700 text-[11px] leading-relaxed space-y-0.5">
                        {entries.map((e) => (
                          <li key={e.type + e.title}>• {e.title}</li>
                        ))}
                      </ul>

                      {(item.previous_price_per_acre || item.reported_price_per_acre) && (
                        <div className="flex items-center gap-2 p-1.5 bg-stone-50 rounded border border-stone-100 text-[11px]">
                          <div className="text-stone-500">
                            <span className="text-[9px] block uppercase text-stone-400">
                              Previous
                            </span>
                            <span className="line-through">
                              {lakhs(item.previous_price_per_acre) || '—'}
                            </span>
                          </div>
                          <span className="text-stone-300 font-bold">→</span>
                          <div className="text-stone-900 font-semibold">
                            <span className="text-[9px] block uppercase text-emerald-600">
                              Reported
                            </span>
                            <span>{lakhs(item.reported_price_per_acre) || '—'}</span>
                          </div>
                          {item.verified_price_per_acre && (
                            <>
                              <span className="text-stone-300 font-bold">→</span>
                              <div className="text-emerald-800 font-semibold">
                                <span className="text-[9px] block uppercase text-emerald-600">
                                  Verified
                                </span>
                                <span>{lakhs(item.verified_price_per_acre)}</span>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {item.remarks && (
                        <p className="text-[11px] text-stone-600 bg-white border border-stone-200 rounded px-2 py-1.5">
                          {item.remarks}
                        </p>
                      )}

                      <div className="pt-1 border-t border-stone-100 flex items-center justify-between gap-2 text-[10px] text-stone-500">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <PersonAvatar name={agent.name} photo={agent.photo} size="xs" />
                          <span className="truncate">
                            Filed by <strong className="text-stone-700">{agent.name || '—'}</strong>
                          </span>
                        </div>

                        {isPending ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => verify(item, 'APPROVED')}
                              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1 disabled:opacity-40"
                            >
                              {busy ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3 h-3" />
                              )}
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => verify(item, 'REJECTED')}
                              className="px-2 py-1 rounded border border-stone-200 bg-white text-stone-600 hover:text-rose-700 hover:border-rose-200 font-semibold inline-flex items-center gap-1 disabled:opacity-40"
                            >
                              <XCircle className="w-3 h-3" />
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold shrink-0 ${
                              item.verification_status === 'REJECTED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {item.verification_status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs shrink-0 gap-2">
          <span className="text-stone-500 text-[11px] truncate">
            Reason for observing:{' '}
            <strong className="text-stone-700">
              {assignment.notes || 'General area & market monitoring'}
            </strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-stone-200 hover:bg-stone-300 text-stone-800 font-medium text-xs transition-colors shrink-0"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Read a submission and say, in plain terms, what it reported.
 *
 * Every field below is a string enum, not a boolean — `land_sold` is
 * "YES"/"NO"/"HEARD_LOCALLY"/"NEEDS_VERIFICATION", and the defaults
 * ("NO_CHANGE", "UNKNOWN", "NOT_SURE") mean "nothing to report" rather than
 * something worth a timeline entry. Only genuine findings are listed.
 */
function describe(s) {
  const out = [];

  if (s.price_change_status === 'INCREASED' || s.price_change_status === 'DECREASED') {
    out.push({
      type: 'Price change',
      title: `Asking price ${s.price_change_status.toLowerCase()}`,
    });
  }

  if (s.land_sold === 'YES') {
    out.push({ type: 'Sale stage', title: 'Land confirmed sold' });
  } else if (s.land_sold === 'HEARD_LOCALLY') {
    out.push({ type: 'Sale stage', title: 'Heard locally that the land is sold' });
  } else if (s.land_sold === 'NEEDS_VERIFICATION') {
    out.push({ type: 'Sale stage', title: 'Possible sale — needs verification' });
  }

  if (s.agreement_made === 'YES') {
    out.push({ type: 'Sale stage', title: 'Sale agreement made with a buyer' });
  }

  if (s.owner_willing_to_sell === 'NO') {
    out.push({ type: 'Sale stage', title: 'Owner no longer willing to sell' });
  } else if (s.owner_willing_to_sell === 'YES') {
    out.push({ type: 'Sale stage', title: 'Owner confirmed willing to sell' });
  }

  if (s.buyer_activity === 'YES') {
    out.push({ type: 'Sale stage', title: 'Buyer activity seen on the parcel' });
  }

  if (s.local_issue === 'YES') {
    out.push({
      type: 'Local issue',
      title: 'Local issue reported against this parcel',
    });
  }

  if (s.condition_change === 'CHANGE_OBSERVED') {
    out.push({ type: 'Report', title: 'Change observed in the land’s condition' });
  }

  if (s.is_available === 'NO') {
    out.push({ type: 'Report', title: 'Parcel no longer available' });
  }

  if (s.verification_status && s.verification_status !== 'PENDING') {
    out.push({
      type: 'Verification',
      title: `Desk marked this ${s.verification_status.toLowerCase()}`,
    });
  }

  if (out.length === 0) out.push({ type: 'Report', title: 'Routine report — nothing changed' });
  return out;
}

function iconFor(type) {
  switch (type) {
    case 'Price change':
      return <IndianRupee className="w-3 h-3" />;
    case 'Sale stage':
      return <TrendingUp className="w-3 h-3" />;
    case 'Local issue':
      return <ShieldCheck className="w-3 h-3" />;
    case 'Verification':
      return <CheckCircle2 className="w-3 h-3" />;
    default:
      return <Tag className="w-3 h-3" />;
  }
}
