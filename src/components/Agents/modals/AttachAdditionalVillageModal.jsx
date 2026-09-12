import { useState, useEffect, useMemo } from 'react';
import { X, MapPin, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';

import PersonAvatar from '../common/PersonAvatar';
import useVillageLocations from '../../../hooks/useVillageLocations';
import agentService from '../../../services/agentService';
import { AGENT_CODE } from '../agentConstants';

const norm = (v) => String(v || '').trim().toLowerCase();

/**
 * Widen an agent's franchise territory by one village.
 *
 * The server's territory endpoint *replaces* the whole list, so this reads the
 * current rows and PUTs them back with the new one appended — dropping the
 * existing territory would silently un-assign villages the agent already works.
 *
 * A village with no open seat is refused: the quota is the whole basis of the
 * franchise model, and attaching past it would make every vacancy figure on the
 * recruitment map wrong.
 */
export default function AttachAdditionalVillageModal({ agent, onClose, onDone }) {
  const { villages, loading: villagesLoading } = useVillageLocations({});

  const [territory, setTerritory] = useState([]);
  const [loadingTerritory, setLoadingTerritory] = useState(true);
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!agent?.id) return;
    let cancelled = false;

    agentService
      .getTerritory(agent.id)
      .then((data) => {
        if (cancelled) return;
        setTerritory(data.result || data.data || []);
      })
      .catch((err) => {
        console.error('Failed to load agent territory:', err);
        if (!cancelled) setError('Could not read this agent’s current territory.');
      })
      .finally(() => {
        if (!cancelled) setLoadingTerritory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [agent?.id]);

  // Their primary village plus every extra territory row.
  const attached = useMemo(() => {
    const names = new Set();
    if (agent?.village) names.add(agent.village);
    territory.forEach((row) => row.village && names.add(row.village));
    return [...names];
  }, [agent, territory]);

  const available = useMemo(
    () => villages.filter((v) => !attached.some((a) => norm(a) === norm(v.name))),
    [villages, attached]
  );

  useEffect(() => {
    if (!selected && available.length) setSelected(available[0].name);
  }, [available, selected]);

  const target = villages.find((v) => norm(v.name) === norm(selected)) || null;
  const vacancy = target?.vacancy ?? 0;
  const hasSlot = vacancy > 0;

  const submit = async () => {
    if (!target || !hasSlot) return;
    setSaving(true);
    setError(null);
    try {
      const rows = [
        ...territory.map((row) => ({
          state: row.state,
          district: row.district,
          mandal: row.mandal,
          village: row.village,
        })),
        {
          state: target.state,
          district: target.district,
          mandal: target.mandal,
          village: target.name,
        },
      ];

      await agentService.setTerritory(agent.id, rows);
      setDone(true);
      onDone?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not attach that village.');
    } finally {
      setSaving(false);
    }
  };

  if (!agent) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 space-y-4 text-xs"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between pb-3 border-b border-stone-200 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#2563EB] flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-stone-900 text-sm">Attach additional village</h3>
              <p className="text-[11px] text-stone-500">
                Expand this agent's franchise territory
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 font-semibold rounded-lg px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {done ? (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <div>
              <p className="font-bold text-sm text-stone-900">
                {selected} attached to {agent.name}
              </p>
              <p className="text-[11px] text-stone-500 mt-0.5">
                Their territory now covers {attached.length + 1} village(s).
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
            <div className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 border border-stone-200">
              <PersonAvatar name={agent.name} photo={agent.photo} size={40} />
              <div className="min-w-0">
                <h4 className="font-bold text-stone-900">
                  {agent.name} ({AGENT_CODE(agent.id)})
                </h4>
                <p className="text-stone-500 text-[11px]">
                  Currently attached to:{' '}
                  {loadingTerritory ? (
                    <span className="text-stone-400">reading…</span>
                  ) : (
                    <strong className="text-stone-800">
                      {attached.join(', ') || 'no village'}
                    </strong>
                  )}
                </p>
              </div>
            </div>

            <div>
              <label className="text-stone-600 font-semibold block mb-1">
                Select additional village:
              </label>
              {villagesLoading ? (
                <div className="py-3 flex items-center gap-2 text-stone-500">
                  <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading villages…
                </div>
              ) : available.length === 0 ? (
                <p className="text-[11px] text-stone-500 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-2">
                  This agent is already attached to every village on the map.
                </p>
              ) : (
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white font-medium text-stone-900"
                >
                  {available.map((v) => (
                    <option key={v.id} value={v.name}>
                      {v.name} ({v.mandal} Mdl) • Vacancy: {v.vacancy} / {v.requiredAgents}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {target && (
              <div className="p-3 rounded-xl border border-stone-200 bg-stone-50/70 space-y-1.5">
                <Row
                  label="Administrative division"
                  value={[target.mandal && `${target.mandal} Mandal`, target.district]
                    .filter(Boolean)
                    .join(', ')}
                />
                <Row label="Total quota required" value={`${target.requiredAgents} agents`} />
                <Row
                  label="Currently attached"
                  value={`${target.attachedAgentsCount} agents`}
                />
                <div className="flex justify-between items-center pt-1 border-t border-stone-200">
                  <span className="text-stone-600 font-semibold">Available vacancy:</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-xs ${
                      hasSlot ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {vacancy} opening{vacancy === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            )}

            {target && !hasSlot && (
              <p className="text-[11px] text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-2">
                {target.name} is at full quota, so it cannot be attached. Pick a village with
                an open seat.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!hasSlot || !selected || saving || loadingTerritory}
                className="px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-stone-300 disabled:cursor-not-allowed text-white font-bold transition-colors inline-flex items-center gap-1.5"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm village attachment
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-stone-600">{label}:</span>
      <span className="font-medium text-stone-900 text-right truncate">{value || '—'}</span>
    </div>
  );
}
