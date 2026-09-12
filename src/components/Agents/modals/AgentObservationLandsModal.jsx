import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Plus,
  Eye,
  MapPin,
  Clock,
  Trash2,
  Building,
  Loader2,
  AlertTriangle,
  Tag,
} from 'lucide-react';

import ObservationTimelineModal from './ObservationTimelineModal';
import AddObservationLandModal from './AddObservationLandModal';
import agentObservationService from '../../../services/agentObservationService';
import {
  AGENT_CODE,
  OBSERVATION_FREQUENCIES,
  OBSERVATION_STATUS_LABELS,
} from '../agentConstants';

const lakhs = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return null;
  return `₹${(n / 100000).toFixed(1)}L / acre`;
};

const crores = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return null;
  return `₹${(n / 10000000).toFixed(2)} Cr`;
};

const STATUS_TONES = {
  ACTIVE: 'bg-stone-100 text-stone-700',
  INFORMATION_DUE: 'bg-rose-100 text-rose-800',
  UPDATE_SUBMITTED: 'bg-blue-100 text-blue-800',
  VERIFICATION_PENDING: 'bg-amber-100 text-amber-900',
  UPDATED: 'bg-emerald-100 text-emerald-800',
  UNABLE_TO_VERIFY: 'bg-stone-200 text-stone-700',
  CLOSED: 'bg-stone-100 text-stone-500',
};

const freqLabel = (key) =>
  OBSERVATION_FREQUENCIES.find((f) => f.key === key)?.label || key || '—';

/**
 * Every parcel one agent is standing watch over.
 *
 * An observation is deliberately not the same as owning the land: the agent
 * officially linked to a parcel is shown separately on each row, because the
 * whole point of an observation is that somebody other than the linked agent is
 * keeping an eye on it.
 */
export default function AgentObservationLandsModal({ agent, onClose, onChanged }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !timeline && !adding && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, timeline, adding]);

  const load = useCallback(async () => {
    if (!agent?.id) return;
    setLoading(true);
    try {
      const data = await agentObservationService.getAssignments({ agentId: agent.id });
      const rows = data.result || data.data || [];
      setAssignments(Array.isArray(rows) ? rows : []);
      setError(null);
    } catch (err) {
      console.error('Failed to load observation assignments:', err);
      setAssignments([]);
      setError('Could not load this agent’s observation list.');
    } finally {
      setLoading(false);
    }
  }, [agent?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (assignment) => {
    setRemoving(assignment.id);
    setError(null);
    try {
      await agentObservationService.removeAssignment(assignment.id);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not remove that observation.');
    } finally {
      setRemoving(null);
    }
  };

  if (!agent) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[1000] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden text-xs"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="h-14 px-5 border-b border-stone-200 flex items-center justify-between bg-stone-50 shrink-0 gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                <Eye className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-stone-900 text-sm truncate">
                  Lands observed by {agent.name}
                </h3>
                <p className="text-[11px] text-stone-500">
                  {AGENT_CODE(agent.id)} · standing watch assignments
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-[11px] inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add land to observe
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-8 h-8 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {error && (
            <div className="mx-4 mt-3 bg-rose-50 border border-rose-200 text-rose-700 font-semibold rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="py-14 flex items-center justify-center">
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-stone-500">
                  <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading…
                </span>
              </div>
            ) : assignments.length === 0 ? (
              <div className="py-14 text-center space-y-3">
                <Eye className="w-9 h-9 text-stone-300 mx-auto" />
                <div>
                  <p className="font-semibold text-stone-600">
                    {agent.name} is not observing any land yet
                  </p>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Attach a parcel and set how often they should report on it.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-black text-white font-semibold text-xs inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Select land to observe
                </button>
              </div>
            ) : (
              assignments.map((a) => {
                const land = a.land || {};
                const details = land.landDetails || {};
                const isPrimary =
                  land.agent_id && String(land.agent_id) === String(agent.id);

                return (
                  <div
                    key={a.id}
                    className="p-3.5 rounded-xl border border-stone-200 bg-white hover:border-stone-300 transition-colors space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-14 h-14 rounded-xl bg-stone-100 flex items-center justify-center text-stone-400 shrink-0 border border-stone-200">
                          <Building className="w-6 h-6" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-stone-900 text-sm">
                              LD-{land.id ?? a.land_id}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                STATUS_TONES[a.status] || STATUS_TONES.ACTIVE
                              }`}
                            >
                              {OBSERVATION_STATUS_LABELS[a.status] || a.status}
                            </span>
                            {land.verification_status && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-stone-100 text-stone-700">
                                {land.verification_status}
                              </span>
                            )}
                          </div>

                          <p className="text-stone-600 font-medium">
                            {details.total_acres ? `${details.total_acres} acres` : 'acreage not recorded'}
                            {details.guntas ? ` ${details.guntas} gts` : ''}
                            {lakhs(details.price_per_acres) ? ` • ${lakhs(details.price_per_acres)}` : ''}
                            {crores(details.total_value) && (
                              <span className="text-stone-400 font-normal ml-2">
                                (Total: {crores(details.total_value)})
                              </span>
                            )}
                          </p>

                          <div className="flex items-center gap-2 text-[11px] text-stone-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-stone-400" />
                              {[land.village, land.district].filter(Boolean).join(', ') || '—'}
                            </span>
                            <span>•</span>
                            <span>
                              Officially linked agent:{' '}
                              {land.agent_id ? (
                                isPrimary ? (
                                  <strong className="text-amber-700">
                                    this agent (also the primary)
                                  </strong>
                                ) : (
                                  <strong className="text-stone-800">
                                    #{land.agent_id}
                                  </strong>
                                )
                              ) : (
                                <span className="italic text-stone-400">none (unattached)</span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={String(removing) === String(a.id)}
                        onClick={() => remove(a)}
                        title={`Stop ${agent.name} observing LD-${land.id ?? a.land_id}`}
                        className="p-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 transition-colors shrink-0 disabled:opacity-40"
                      >
                        {String(removing) === String(a.id) ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <div className="pt-2.5 border-t border-stone-100 flex items-center justify-between gap-3 flex-wrap text-[11px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-medium flex items-center gap-1">
                          <Tag className="w-2.5 h-2.5" />
                          {freqLabel(a.frequency)}
                        </span>
                        {a.next_due_date && (
                          <span className="text-stone-500">
                            Next due <strong className="text-stone-700">{a.next_due_date}</strong>
                          </span>
                        )}
                        {a.last_submitted_at && (
                          <span className="text-stone-400">
                            last report {String(a.last_submitted_at).slice(0, 10)}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setTimeline({ ...a, agent })}
                        className="px-2.5 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-[11px] flex items-center gap-1.5 transition-colors"
                      >
                        <Clock className="w-3 h-3 text-sky-600" />
                        View updates
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="h-14 px-5 border-t border-stone-200 bg-stone-50 flex items-center justify-between shrink-0 gap-2">
            <span className="text-stone-500 font-medium truncate">
              Monitored by {agent.name}:{' '}
              <strong className="text-stone-800">{assignments.length} land(s)</strong>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-stone-900 text-white font-semibold hover:bg-black transition-colors shrink-0"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {timeline && (
        <ObservationTimelineModal
          assignment={timeline}
          onClose={() => setTimeline(null)}
          onVerified={() => {
            load();
            onChanged?.();
          }}
        />
      )}

      {adding && (
        <AddObservationLandModal
          agent={agent}
          existingLandIds={assignments.map((a) => a.land_id)}
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            load();
            onChanged?.();
          }}
        />
      )}
    </>
  );
}
