import { useEffect, useState } from 'react';
import { X, Phone, Users, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

import recruitmentService from '../../../services/recruitmentService';
import agentLeadService from '../../../services/agentLeadService';
import { normaliseLead } from './recruitmentModel';
import { errorMessage } from '../../../utils/apiErrors';

/**
 * The slide-over a lead row opens: who they are, a Call button, the village they
 * want, and — for a lead an agent referred — the agent who sent them.
 *
 * It fetches its own copy of the lead. The row that opened it is a snapshot, and
 * a drawer that showed yesterday's numbers after a call had just been logged
 * would be worse than one that briefly shows a spinner.
 */
export default function LeadDrawer({ lead: seed, employeeById, version, onClose, onCall, onChanged }) {
  const [lead, setLead] = useState(seed);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    agentLeadService
      .getLead(seed.id)
      .then((data) => {
        if (cancelled) return;
        const row = data.result || data.data;
        if (row) setLead(normaliseLead(row, employeeById));
      })
      .catch((err) => {
        // The snapshot is still perfectly readable; only say so if it matters.
        console.error('Failed to refresh lead:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [seed.id, employeeById, version]);

  useEffect(() => {
    const onKeyDown = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const village = lead.nativeVillage;
  const alreadyInterested = lead.interestedVillages.some(
    (v) => String(v).toLowerCase() === String(village).toLowerCase()
  );

  const handleAddInterested = async () => {
    if (!village) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await recruitmentService.markInterested(lead.id, [village], { stage: lead.stage });
      setNotice(`Added ${lead.name} to the Interested list for ${village}.`);
      onChanged?.();
    } catch (err) {
      setError(errorMessage(err, 'Could not add this lead as interested.'));
    } finally {
      setBusy(false);
    }
  };

  const referrer = lead.referringAgent;
  const showReferrer = Boolean(referrer) || lead.source === 'Agent';

  return (
    <div
      className="fixed inset-0 z-[1050] bg-stone-900/30 backdrop-blur-2xs flex justify-end"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-stone-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Lead ${lead.name}`}
      >
        {/* Header */}
        <div className="p-3.5 bg-stone-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700 shrink-0">
              agent lead
            </span>
            <h3 className="font-semibold text-sm truncate">{lead.name || lead.code}</h3>
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-400 shrink-0" />}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded text-stone-400 hover:text-white hover:bg-stone-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 text-xs text-stone-800 space-y-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 font-semibold rounded-lg px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {notice && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold rounded-lg px-3 py-2 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> {notice}
            </div>
          )}

          {/* Lead card */}
          <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h4 className="font-bold text-sm text-stone-900">{lead.name}</h4>
              <p className="text-stone-500 text-xs font-mono">{lead.phone}</p>
              <p className="text-[11px] text-stone-600 mt-0.5">
                Native: {lead.nativeVillage || '—'}, {lead.district || '—'} • Source: {lead.source}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onCall?.(lead)}
              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center gap-1.5 shrink-0"
            >
              <Phone className="w-3.5 h-3.5" />
              Call
            </button>
          </div>

          {/* Village interest */}
          <div className="border border-stone-200 rounded-lg p-3 space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 block">
              Village Interest &amp; Vacancy Check
            </span>
            <p className="text-xs text-stone-700">
              Target Village: <strong>{village || '—'}</strong>
            </p>
            {lead.interestedVillages.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {lead.interestedVillages.map((v) => (
                  <span
                    key={v}
                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-[#2563EB] border border-blue-200"
                  >
                    {v}
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAddInterested}
                disabled={busy || !village || alreadyInterested}
                title={
                  !village
                    ? 'This lead has no native village recorded'
                    : alreadyInterested
                    ? 'Already interested in this village'
                    : undefined
                }
                className="px-3 py-1.5 rounded bg-stone-900 hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-xs flex items-center gap-1"
              >
                {busy && <Loader2 className="w-3 h-3 animate-spin" />}
                {alreadyInterested ? 'Already Interested' : 'Add as Interested'}
              </button>
            </div>
          </div>

          {/* Referring agent */}
          {showReferrer && (
            <div className="border border-blue-200 rounded-lg p-3 bg-blue-50/60 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900 block flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#2563EB]" />
                Referring Agent Information
              </span>

              {referrer ? (
                <div className="bg-white rounded border border-blue-100 p-2.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-stone-900">{referrer.name}</span>
                    <span className="font-mono text-stone-600 text-[11px]">
                      {referrer.phone || '—'}
                    </span>
                  </div>
                  <div className="pt-1 border-t border-stone-100 text-[11px] space-y-1">
                    <p className="text-stone-700">
                      <strong className="text-stone-900">Native Village:</strong>{' '}
                      {referrer.village || '—'}
                      {referrer.mandal ? `, ${referrer.mandal} Mandal` : ''}
                    </p>
                    <p className="text-stone-700">
                      <strong className="text-stone-900">District &amp; State:</strong>{' '}
                      {[referrer.district, referrer.state].filter(Boolean).join(', ') || '—'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-blue-900">
                  Marked as an agent referral, but no referring agent is linked to this lead.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
