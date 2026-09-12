import { useState, useEffect, useRef, useCallback } from 'react';
import {
  PhoneCall,
  PhoneIncoming,
  X,
  ArrowRight,
  UserRound,
  MapPin,
  Loader2,
} from 'lucide-react';

import { useCall } from '../../context/CallContext';
import callSignalService from '../../services/callSignalService';
import agentService from '../../services/agentService';
import agentLeadService from '../../services/agentLeadService';

const POLL_MS = 20000;
const digitsOf = (v) => String(v || '').replace(/\D/g, '');

const PURPOSES = ['Become Agent', 'Sell Land', 'Buy Land', 'Support'];

const PURPOSE_ROUTE = {
  'Become Agent': 'agents',
  'Sell Land': 'land',
  'Buy Land': 'buyers',
  Support: 'callcenter',
};

const clock = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Live inbound-call banner.
 *
 * It watches the call-signal feed for INBOUND rows this session has not seen
 * yet, and tries to put a name to the number. Signals that already existed when
 * the app loaded are marked seen without alerting — otherwise every refresh
 * would pop a banner for a call somebody took yesterday.
 *
 * Polling, not a socket: there is no push channel on this backend, and a banner
 * that appears twenty seconds late is far better than one that never appears.
 */
export default function MyOperatorLivePopup() {
  const { initiateCall } = useCall();

  const [event, setEvent] = useState(null);
  const [match, setMatch] = useState(null);
  const [looking, setLooking] = useState(false);
  const [unknownName, setUnknownName] = useState('');
  const [purpose, setPurpose] = useState(PURPOSES[0]);

  const seenRef = useRef(null);

  const identify = useCallback(async (phone) => {
    const target = digitsOf(phone);
    if (!target) return null;

    const [agentResult, leadResult] = await Promise.allSettled([
      agentService.getAll({ search: target }),
      agentLeadService.getLeads({ search: target }),
    ]);

    if (agentResult.status === 'fulfilled') {
      const rows = agentResult.value.result || agentResult.value.data || [];
      const hit = (Array.isArray(rows) ? rows : []).find((a) => digitsOf(a.phone) === target);
      if (hit) {
        return {
          kind: 'Agent',
          id: hit.id,
          name: hit.name,
          where: [hit.village, hit.mandal].filter(Boolean).join(', '),
        };
      }
    }

    if (leadResult.status === 'fulfilled') {
      const rows = leadResult.value.result || leadResult.value.data || [];
      const hit = (Array.isArray(rows) ? rows : []).find((l) => digitsOf(l.phone) === target);
      if (hit) {
        return {
          kind: 'Agent lead',
          id: hit.id,
          name: hit.name,
          where: [hit.village, hit.mandal].filter(Boolean).join(', '),
        };
      }
    }

    return null;
  }, []);

  const poll = useCallback(async () => {
    try {
      const data = await callSignalService.getAll({ direction: 'INBOUND' });
      const rows = data.data || data.result || [];
      const list = Array.isArray(rows) ? rows : [];
      if (list.length === 0) return;

      // First pass only records what already existed; it must never alert.
      if (seenRef.current === null) {
        seenRef.current = new Set(list.map((s) => String(s.id)));
        return;
      }

      const fresh = list.find((s) => !seenRef.current.has(String(s.id)));
      if (!fresh) return;

      seenRef.current.add(String(fresh.id));
      setEvent(fresh);
      setMatch(null);
      setUnknownName('');

      if (fresh.caller_phone) {
        setLooking(true);
        const found = await identify(fresh.caller_phone);
        setMatch(found);
        setLooking(false);
      }
    } catch {
      // A failed poll is not worth surfacing; the next one will try again.
    }
  }, [identify]);

  useEffect(() => {
    poll();
    const id = window.setInterval(poll, POLL_MS);
    return () => window.clearInterval(id);
  }, [poll]);

  if (!event) return null;

  const phone = event.caller_phone || 'Unknown number';
  const known = Boolean(match);

  return (
    <div className="garuda-ui fixed bottom-4 right-4 z-[1100] max-w-sm w-full bg-white rounded-lg border-2 border-[#7C3AED] shadow-2xl overflow-hidden">
      <div className="bg-[#7C3AED] px-3 py-2 text-white flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping shrink-0" />
          <PhoneIncoming className="w-4 h-4 shrink-0" />
          <span className="font-semibold text-xs tracking-wide truncate">
            Inbound call{clock(event.created_at) ? ` • ${clock(event.created_at)}` : ''}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setEvent(null)}
          title="Dismiss"
          aria-label="Dismiss"
          className="text-white/80 hover:text-white p-0.5 rounded shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3.5 text-xs text-stone-800 space-y-2.5 bg-stone-50/50">
        {looking ? (
          <div className="py-4 flex items-center justify-center gap-2 text-stone-500">
            <Loader2 className="w-4 h-4 animate-spin text-[#7C3AED]" />
            Identifying the caller…
          </div>
        ) : known ? (
          <>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white border border-stone-200 flex items-center justify-center shrink-0">
                <UserRound className="w-5 h-5 text-stone-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-stone-900 text-sm truncate">{match.name}</p>
                <p className="text-stone-500 text-xs">{phone}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                    {match.kind}
                  </span>
                  {match.where && (
                    <span className="text-[10px] text-stone-500 inline-flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5" />
                      {match.where}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {event.mission_context && (
              <p className="text-[11px] text-stone-600 italic bg-white border border-stone-200 rounded px-2 py-1">
                {event.mission_context}
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEvent(null)}
                className="flex-1 px-3 py-2 rounded-lg border border-stone-200 bg-white text-stone-700 font-semibold text-[11px]"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  setEvent(null);
                  initiateCall({
                    name: match.name,
                    phone,
                    leadType: match.kind === 'Agent' ? 'Agent' : 'AgentLead',
                    leadId: match.kind === 'Agent lead' ? match.id : undefined,
                    village: match.where,
                    source: 'Inbound call',
                  });
                }}
                className="flex-1 px-3 py-2 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-[11px] inline-flex items-center justify-center gap-1.5"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                Attend
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="font-bold text-stone-900 text-sm">Unknown caller</p>
              <p className="text-stone-500 text-xs">{phone}</p>
              <p className="text-[10px] text-stone-400 mt-0.5">
                This number is not on any agent or lead record.
              </p>
            </div>

            <div>
              <label
                htmlFor="mo-name"
                className="text-[10px] text-stone-500 block mb-0.5"
              >
                Caller name
              </label>
              <input
                id="mo-name"
                value={unknownName}
                onChange={(e) => setUnknownName(e.target.value)}
                placeholder="Enter caller name"
                className="w-full text-xs bg-white border border-stone-200 rounded-lg px-2 py-1.5"
              />
            </div>

            <div>
              <label
                htmlFor="mo-purpose"
                className="text-[10px] text-stone-500 block mb-0.5"
              >
                Purpose
              </label>
              <select
                id="mo-purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full text-xs bg-white border border-stone-200 rounded-lg px-2 py-1.5"
              >
                {PURPOSES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEvent(null)}
                className="flex-1 px-3 py-2 rounded-lg border border-stone-200 bg-white text-stone-700 font-semibold text-[11px]"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  setEvent(null);
                  // Hand the caller to the section that owns their purpose, and
                  // open the call workspace so the operator can log it.
                  window.dispatchEvent(
                    new CustomEvent('garuda:route-section', {
                      detail: { section: PURPOSE_ROUTE[purpose] || 'callcenter' },
                    })
                  );
                  initiateCall({
                    name: unknownName.trim() || 'Unknown caller',
                    phone,
                    leadType: purpose === 'Become Agent' ? 'AgentLead' : 'Contact',
                    source: `Inbound · ${purpose}`,
                  });
                }}
                className="flex-1 px-3 py-2 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-[11px] inline-flex items-center justify-center gap-1.5"
              >
                Route
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
