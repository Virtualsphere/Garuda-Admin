import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Eye,
  Search,
  MapPin,
  Building,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

import PersonAvatar from '../common/PersonAvatar';
import agentObservationService from '../../../services/agentObservationService';
import landService from '../../../services/landService';
import agentService from '../../../services/agentService';
import { AGENT_CODE, OBSERVATION_FREQUENCIES } from '../agentConstants';

const OBSERVATION_REASONS = [
  'Nearby farmer contact',
  'Market price tracking',
  'Potential buyer match',
  'Agent interest',
  'Custom reason',
];

/**
 * Put an agent on standing watch over a parcel.
 *
 * The server refuses to make an agent observe land they are already the primary
 * agent for — an observation exists so a *second* pair of eyes reports on a
 * parcel, and that pairing would be a no-op. Those pairs come back in
 * `result.skipped` rather than failing, so the modal reports them plainly.
 */
export default function AddObservationLandModal({
  agent,
  land,
  existingLandIds = [],
  onClose,
  onDone,
}) {
  const [lands, setLands] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [landId, setLandId] = useState(land?.id ? String(land.id) : '');
  const [agentId, setAgentId] = useState(agent?.id ? String(agent.id) : '');
  const [frequency, setFrequency] = useState('MONTHLY');
  const [reason, setReason] = useState(OBSERVATION_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [landQuery, setLandQuery] = useState('');
  const [agentQuery, setAgentQuery] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([landService.getAll(), agentService.getAll()]).then(
      ([landResult, agentResult]) => {
        if (cancelled) return;

        if (landResult.status === 'fulfilled') {
          const data = landResult.value;
          const rows = data.result || data.data || [];
          setLands(Array.isArray(rows) ? rows : []);
        } else {
          setLoadError('Could not load the land list.');
        }

        if (agentResult.status === 'fulfilled') {
          const data = agentResult.value;
          const rows = data.result || data.data || [];
          setAgents(Array.isArray(rows) ? rows : []);
        }

        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  const alreadyObserved = useMemo(
    () => new Set(existingLandIds.map((id) => String(id))),
    [existingLandIds]
  );

  const availableLands = useMemo(() => {
    const q = landQuery.trim().toLowerCase();
    return lands
      .filter((l) => !alreadyObserved.has(String(l.id)))
      .filter((l) => {
        if (!q) return true;
        return (
          String(l.village || '').toLowerCase().includes(q) ||
          String(l.mandal || '').toLowerCase().includes(q) ||
          String(l.district || '').toLowerCase().includes(q) ||
          String(l.id).includes(q)
        );
      })
      .slice(0, 60);
  }, [lands, landQuery, alreadyObserved]);

  const availableAgents = useMemo(() => {
    const q = agentQuery.trim().toLowerCase();
    if (!q) return agents.slice(0, 60);
    return agents
      .filter(
        (a) =>
          String(a.name || '').toLowerCase().includes(q) ||
          String(a.village || '').toLowerCase().includes(q) ||
          String(a.id).includes(q)
      )
      .slice(0, 60);
  }, [agents, agentQuery]);

  const chosenLand = lands.find((l) => String(l.id) === String(landId)) || land || null;
  const chosenAgent = agents.find((a) => String(a.id) === String(agentId)) || agent || null;

  // The primary agent watching their own parcel is the one pairing the server
  // refuses, so say it here rather than letting the request bounce.
  const isSelfObservation =
    chosenLand?.agent_id && String(chosenLand.agent_id) === String(agentId);

  const finalReason = reason === 'Custom reason' ? customReason.trim() : reason;
  const canSubmit =
    landId && agentId && !isSelfObservation && (reason !== 'Custom reason' || customReason.trim());

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const data = await agentObservationService.assign({
        landId: Number(landId),
        agentId: Number(agentId),
        frequency,
        notes: finalReason || undefined,
      });
      setResult(data.result || data.data || { ok: true });
      onDone?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create that observation.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1010] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden text-xs"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="p-4 bg-stone-900 text-white flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-400/30 flex items-center justify-center shrink-0">
              <Eye className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-white">Add observation land</h3>
              <p className="text-[11px] text-stone-400">
                Put an agent on standing watch over a parcel
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {result ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <div>
              <p className="font-bold text-sm text-stone-900">Observation created</p>
              <p className="text-[11px] text-stone-500 mt-0.5">
                {chosenAgent?.name} will report on LD-{landId} every{' '}
                {OBSERVATION_FREQUENCIES.find((f) => f.key === frequency)?.label.toLowerCase()}.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-stone-900 text-white font-semibold"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {(error || loadError) && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 font-semibold rounded-lg px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error || loadError}
                </div>
              )}

              {loading ? (
                <div className="py-12 flex items-center justify-center">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-stone-500">
                    <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading lands
                    and agents…
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Land picker */}
                  <div className="space-y-1.5">
                    <label className="font-semibold text-stone-700 block">
                      1. Select the land to observe
                    </label>
                    <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5">
                      <Search className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <input
                        value={landQuery}
                        onChange={(e) => setLandQuery(e.target.value)}
                        placeholder="Search village, mandal or land ID…"
                        className="w-full bg-transparent text-xs"
                      />
                    </div>

                    <div className="max-h-56 overflow-y-auto border border-stone-200 rounded-lg divide-y divide-stone-100">
                      {availableLands.map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => setLandId(String(l.id))}
                          className={`w-full text-left px-2.5 py-2 flex items-center gap-2 transition-colors ${
                            String(landId) === String(l.id)
                              ? 'bg-blue-50 border-l-2 border-l-[#2563EB]'
                              : 'hover:bg-stone-50'
                          }`}
                        >
                          <Building className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span className="min-w-0">
                            <span className="font-bold text-stone-900 block">LD-{l.id}</span>
                            <span className="text-[10px] text-stone-500 flex items-center gap-1">
                              <MapPin className="w-2.5 h-2.5" />
                              {[l.village, l.mandal, l.district].filter(Boolean).join(', ') ||
                                'no location'}
                            </span>
                          </span>
                        </button>
                      ))}
                      {availableLands.length === 0 && (
                        <p className="px-2.5 py-4 text-[11px] text-stone-400 text-center">
                          No land matches — or they are all already observed by this agent.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Agent picker */}
                  <div className="space-y-1.5">
                    <label className="font-semibold text-stone-700 block">
                      2. Select the observing agent
                    </label>

                    {agent ? (
                      <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/60 flex items-center gap-2.5">
                        <PersonAvatar name={agent.name} photo={agent.photo} size="sm" />
                        <div className="min-w-0">
                          <span className="font-bold text-stone-900 block truncate">
                            {agent.name}
                          </span>
                          <span className="text-[10px] text-stone-500">
                            {AGENT_CODE(agent.id)} · fixed for this list
                          </span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5">
                          <Search className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <input
                            value={agentQuery}
                            onChange={(e) => setAgentQuery(e.target.value)}
                            placeholder="Search agent name, village or code…"
                            className="w-full bg-transparent text-xs"
                          />
                        </div>

                        <div className="max-h-56 overflow-y-auto border border-stone-200 rounded-lg divide-y divide-stone-100">
                          {availableAgents.map((a) => (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => setAgentId(String(a.id))}
                              className={`w-full text-left px-2.5 py-2 flex items-center gap-2 transition-colors ${
                                String(agentId) === String(a.id)
                                  ? 'bg-blue-50 border-l-2 border-l-[#2563EB]'
                                  : 'hover:bg-stone-50'
                              }`}
                            >
                              <PersonAvatar name={a.name} photo={a.photo} size="xs" />
                              <span className="min-w-0">
                                <span className="font-bold text-stone-900 block truncate">
                                  {a.name}
                                </span>
                                <span className="text-[10px] text-stone-500">
                                  {AGENT_CODE(a.id)} · {a.village || '—'}
                                </span>
                              </span>
                            </button>
                          ))}
                          {availableAgents.length === 0 && (
                            <p className="px-2.5 py-4 text-[11px] text-stone-400 text-center">
                              No agent matches.
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {isSelfObservation && (
                <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                  This agent is already the officially linked agent for LD-{landId}. An
                  observation is a second pair of eyes, so pick a different agent or a
                  different parcel.
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-semibold text-stone-800 block">
                    3. Reporting frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white font-medium text-stone-900"
                  >
                    {OBSERVATION_FREQUENCIES.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-stone-400">
                    Sets when the parcel turns red as "information due" on the map.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-stone-800 block">
                    4. Reason for observing
                  </label>
                  <div className="space-y-1">
                    {OBSERVATION_REASONS.map((r) => (
                      <label
                        key={r}
                        className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-2 cursor-pointer transition-colors ${
                          reason === r
                            ? 'bg-blue-50 border-blue-300'
                            : 'bg-white border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="observation-reason"
                          checked={reason === r}
                          onChange={() => setReason(r)}
                          className="accent-[#2563EB]"
                        />
                        <span className="text-stone-800">{r}</span>
                      </label>
                    ))}
                  </div>

                  {reason === 'Custom reason' && (
                    <input
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="Enter the specific reason…"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-2 shrink-0">
              <span className="text-[11px] text-stone-500 truncate">
                {chosenLand && chosenAgent
                  ? `${chosenAgent.name} → LD-${chosenLand.id}`
                  : 'Pick a land and an agent'}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-stone-200 hover:bg-white text-stone-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!canSubmit || saving}
                  className="px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-stone-300 disabled:cursor-not-allowed text-white font-bold inline-flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm observation
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
