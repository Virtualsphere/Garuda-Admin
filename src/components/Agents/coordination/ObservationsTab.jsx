import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  Eye,
  UserRound,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

import ObservationTimelineModal from '../modals/ObservationTimelineModal';
import agentObservationService from '../../../services/agentObservationService';
import { OBSERVATION_STATUS_LABELS } from '../agentConstants';

const FILTERS = [
  { key: 'all', label: 'All assignments' },
  { key: 'due', label: 'Information due' },
  { key: 'pending', label: 'Awaiting verification' },
];

const STATUS_TONES = {
  ACTIVE: 'bg-stone-100 text-stone-700 border-stone-300',
  INFORMATION_DUE: 'bg-rose-50 text-rose-800 border-rose-300',
  VERIFICATION_PENDING: 'bg-amber-50 text-amber-900 border-amber-300',
  UPDATED: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  UNABLE_TO_VERIFY: 'bg-stone-100 text-stone-600 border-stone-300',
  CLOSED: 'bg-stone-100 text-stone-500 border-stone-300',
};

/**
 * The observation desk: which agent is watching which parcel, whose report is
 * overdue, and what has been filed but not yet checked.
 *
 * "Due" is read off the server's own flag rather than recomputed here, so this
 * list and the red ping on the land map always agree.
 */
export default function ObservationsTab({ agents = [] }) {
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [timeline, setTimeline] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [assignmentData, submissionData] = await Promise.all([
        agentObservationService.getAssignments(
          filter === 'due' ? { dueOnly: true } : {}
        ),
        agentObservationService.getSubmissions({ verificationStatus: 'PENDING' }),
      ]);

      const list = assignmentData.result || assignmentData.data || [];
      setAssignments(Array.isArray(list) ? list : []);

      const subs = submissionData.result || submissionData.data || [];
      setSubmissions(Array.isArray(subs) ? subs : []);
      setError(null);
    } catch (err) {
      console.error('Failed to load observations:', err);
      setAssignments([]);
      setError(
        err?.response?.status === 404
          ? 'The observation endpoints are not available on this backend yet.'
          : 'Could not load observations.'
      );
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleVerify = async (submission, status) => {
    setBusyId(submission.id);
    try {
      await agentObservationService.verifySubmission(submission.id, status);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not verify this report.');
    } finally {
      setBusyId(null);
    }
  };

  const visible = useMemo(
    () =>
      filter === 'pending'
        ? assignments.filter((a) => a.status === 'VERIFICATION_PENDING')
        : assignments,
    [assignments, filter]
  );

  const agentName = (id) =>
    agents.find((a) => String(a.id) === String(id))?.name || `Agent #${id}`;

  return (
    <div className="space-y-3">
      <div className="bg-white border border-stone-200 rounded-lg p-2.5 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-stone-200 p-0.5 bg-stone-100">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                filter === f.key ? 'bg-white text-[#2563EB] shadow-2xs' : 'text-stone-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>

        <span className="text-xs text-stone-500 font-medium ml-auto">
          {visible.length} assignment(s) · {submissions.length} report(s) to check
        </span>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Reports waiting on the desk */}
      {submissions.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-amber-50 border-b border-amber-200">
            <h3 className="text-xs font-bold text-amber-900">
              Reports awaiting verification ({submissions.length})
            </h3>
          </div>
          <div className="divide-y divide-stone-100">
            {submissions.map((sub) => (
              <div key={sub.id} className="p-3 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-stone-900">
                    LD-{sub.land_id} · {sub.land?.village || '—'}
                  </div>
                  <div className="text-[11px] text-stone-500">
                    {sub.agent?.name || agentName(sub.agent_id)} · available:{' '}
                    {sub.is_available} · price {sub.price_change_status?.toLowerCase()}
                  </div>
                  {sub.remarks && (
                    <div className="text-[11px] text-stone-500 italic mt-0.5">
                      {sub.remarks}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={String(busyId) === String(sub.id)}
                    onClick={() => handleVerify(sub, 'APPROVED')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#2563EB] text-white text-[11px] font-bold hover:bg-[#1d4ed8] disabled:opacity-40"
                  >
                    {String(busyId) === String(sub.id) ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3" />
                    )}
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={String(busyId) === String(sub.id)}
                    onClick={() => handleVerify(sub, 'REJECTED')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-stone-200 bg-white text-[11px] font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40"
                  >
                    <XCircle className="w-3 h-3" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Standing assignments */}
      <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-420px)]">
          <table className="w-full text-xs text-left">
            <thead className="sticky top-0 z-20">
              <tr className="bg-stone-100 text-stone-700 font-semibold border-b border-stone-200">
                <th className="p-2.5 bg-stone-100">Land</th>
                <th className="p-2.5 bg-stone-100">Village</th>
                <th className="p-2.5 bg-stone-100">Agent</th>
                <th className="p-2.5 bg-stone-100">Cadence</th>
                <th className="p-2.5 bg-stone-100">Next report</th>
                <th className="p-2.5 bg-stone-100">Status</th>
                <th className="p-2.5 bg-stone-100 text-right">Timeline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-stone-400">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading…
                    </span>
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-stone-400">
                    <Eye className="w-5 h-5 mx-auto mb-1.5 text-stone-300" />
                    No observation assignments in this view.
                  </td>
                </tr>
              ) : (
                visible.map((obs) => (
                  <tr key={obs.id} className="hover:bg-stone-50">
                    <td className="p-2.5 font-semibold text-stone-900">LD-{obs.land_id}</td>
                    <td className="p-2.5 text-stone-700">{obs.land?.village || '—'}</td>
                    <td className="p-2.5">
                      <span className="inline-flex items-center gap-1.5 text-stone-700">
                        <UserRound className="w-3 h-3 text-stone-400" />
                        {obs.agent?.name || agentName(obs.agent_id)}
                      </span>
                    </td>
                    <td className="p-2.5 text-stone-600">
                      {String(obs.frequency || '').replace(/_/g, ' ')}
                    </td>
                    <td
                      className={`p-2.5 font-medium ${
                        obs.status === 'INFORMATION_DUE' ? 'text-rose-700' : 'text-stone-600'
                      }`}
                    >
                      {obs.next_due_date || 'Not scheduled'}
                    </td>
                    <td className="p-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                          STATUS_TONES[obs.status] || STATUS_TONES.ACTIVE
                        }`}
                      >
                        {OBSERVATION_STATUS_LABELS[obs.status] || obs.status}
                      </span>
                    </td>
                    <td className="p-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setTimeline(obs)}
                        className="px-2 py-1 rounded-lg border border-stone-200 bg-white text-[11px] font-semibold text-stone-700 hover:bg-stone-50 inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3 text-sky-600" /> Reports
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {timeline && (
        <ObservationTimelineModal
          assignment={timeline}
          onClose={() => setTimeline(null)}
          onVerified={load}
        />
      )}
    </div>
  );
}
