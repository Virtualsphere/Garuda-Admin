import { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  Phone,
  MapPin,
  Loader2,
  ArrowRight,
  UserRound,
} from 'lucide-react';

import { useCall } from '../../context/CallContext';
import agentService from '../../services/agentService';
import agentLeadService from '../../services/agentLeadService';

const DEPT_TONES = {
  Agent: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  'Agent lead': 'bg-blue-50 text-blue-800 border-blue-200',
};

const digitsOf = (v) => String(v || '').replace(/\D/g, '');

/**
 * Raised when somebody types a phone number the system already holds.
 *
 * It searches for real matches rather than trusting the caller of
 * `flagDuplicatePhone` — the point of the prompt is to show *who* already has
 * that number, and a prompt that cannot name them is just an obstacle. If
 * nothing is found it says so and lets the entry continue.
 */
export default function DuplicatePhoneModal() {
  const { duplicatePhone, clearDuplicatePhone, initiateCall } = useCall();

  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const phone = duplicatePhone?.phone;

  useEffect(() => {
    if (!phone) return undefined;
    const onKey = (e) => e.key === 'Escape' && clearDuplicatePhone();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phone, clearDuplicatePhone]);

  useEffect(() => {
    if (!phone) return undefined;
    let cancelled = false;
    const target = digitsOf(phone);

    setLoading(true);
    Promise.allSettled([
      agentService.getAll({ search: target }),
      agentLeadService.getLeads({ search: target }),
    ]).then(([agentResult, leadResult]) => {
      if (cancelled) return;
      const found = [];

      if (agentResult.status === 'fulfilled') {
        const rows = agentResult.value.result || agentResult.value.data || [];
        (Array.isArray(rows) ? rows : [])
          .filter((a) => digitsOf(a.phone) === target)
          .forEach((a) =>
            found.push({
              key: `agent-${a.id}`,
              kind: 'Agent',
              id: a.id,
              name: a.name,
              phone: a.phone,
              where: [a.village, a.mandal].filter(Boolean).join(', '),
              detail: `AG${String(a.id).padStart(5, '0')} · ${a.status || 'ACTIVE'}`,
            })
          );
      }

      if (leadResult.status === 'fulfilled') {
        const rows = leadResult.value.result || leadResult.value.data || [];
        (Array.isArray(rows) ? rows : [])
          .filter((l) => digitsOf(l.phone) === target)
          .forEach((l) =>
            found.push({
              key: `lead-${l.id}`,
              kind: 'Agent lead',
              id: l.id,
              name: l.name,
              phone: l.phone,
              where: [l.village, l.mandal].filter(Boolean).join(', '),
              detail: `Lead #${l.id} · ${String(l.status || '').replace(/_/g, ' ')}`,
            })
          );
      }

      setMatches(found);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [phone]);

  if (!duplicatePhone) return null;

  return (
    <div
      className="garuda-ui fixed inset-0 z-[1300] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={clearDuplicatePhone}
    >
      <div
        className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-md w-full overflow-hidden text-xs"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-4 py-3 bg-amber-500 text-stone-900 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <h3 className="font-bold text-sm">Existing number found</h3>
          </div>
          <button
            type="button"
            onClick={clearDuplicatePhone}
            aria-label="Close"
            className="p-1 rounded hover:bg-black/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-[11px] text-stone-600">
            <strong className="text-stone-900">{phone}</strong> is already on record
            {duplicatePhone.context ? ` — you were adding it as a ${duplicatePhone.context}.` : '.'}
          </p>

          {loading ? (
            <div className="py-8 flex items-center justify-center">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-stone-500">
                <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Looking it up…
              </span>
            </div>
          ) : matches.length === 0 ? (
            <p className="text-[11px] text-stone-500 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-2">
              No existing agent or lead actually holds this number. It is safe to carry on.
            </p>
          ) : (
            <div className="space-y-2">
              {matches.map((m) => (
                <div
                  key={m.key}
                  className="p-2.5 rounded-xl border border-stone-200 bg-stone-50 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-white border border-stone-200 flex items-center justify-center shrink-0">
                      <UserRound className="w-4 h-4 text-stone-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-stone-900 truncate">{m.name}</span>
                        <span
                          className={`px-1.5 rounded text-[10px] font-bold border ${
                            DEPT_TONES[m.kind] || 'bg-stone-100 text-stone-700 border-stone-200'
                          }`}
                        >
                          {m.kind}
                        </span>
                      </div>
                      <p className="text-stone-500 flex items-center gap-1 text-[11px]">
                        <Phone className="w-3 h-3" />
                        {m.phone}
                      </p>
                      {m.where && (
                        <p className="text-[10px] text-stone-400 flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5" />
                          {m.where}
                        </p>
                      )}
                      <p className="text-[10px] text-stone-400">{m.detail}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      clearDuplicatePhone();
                      initiateCall({
                        name: m.name,
                        phone: m.phone,
                        leadType: m.kind === 'Agent' ? 'Agent' : 'AgentLead',
                        leadId: m.kind === 'Agent lead' ? m.id : undefined,
                        village: m.where,
                        source: 'Duplicate number check',
                      });
                    }}
                    className="px-2 py-1 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-[10px] inline-flex items-center gap-1 shrink-0"
                  >
                    Call
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-2">
          <span className="text-[10px] text-stone-500">
            {matches.length} existing record(s)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearDuplicatePhone}
              className="px-4 py-2 rounded-xl border border-stone-200 bg-white text-stone-700 font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                duplicatePhone.onContinue?.();
                clearDuplicatePhone();
              }}
              className="px-4 py-2 rounded-xl bg-stone-900 text-white font-semibold"
            >
              Add anyway
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
