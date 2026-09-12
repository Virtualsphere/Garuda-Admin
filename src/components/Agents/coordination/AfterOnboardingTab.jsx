import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileCheck,
  FileWarning,
  Loader2,
  AlertTriangle,
  Search,
  Download,
  CheckCircle2,
  XCircle,
  Receipt,
} from 'lucide-react';

import PersonAvatar from '../common/PersonAvatar';
import Modal, { ModalError, GhostButton } from '../common/Modal';
import agentLeadService from '../../../services/agentLeadService';
import agentFinanceService from '../../../services/agentFinanceService';
import { formatINR, AGENT_CODE } from '../agentConstants';

const FILTERS = [
  { key: 'all', label: 'All agents' },
  { key: 'complete', label: 'Paperwork complete' },
  { key: 'incomplete', label: 'Paperwork pending' },
];

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

/**
 * Post-onboarding paperwork: who is fully documented and who still owes an ID
 * proof or a signed agreement, plus the joining receipt.
 *
 * An agent can be working on the ground with paperwork still outstanding —
 * that is exactly what this tab exists to surface, so it is never hidden.
 */
export default function AfterOnboardingTab({ agents = [], loading, refreshAgents, onOpenAgent }) {
  const [filter, setFilter] = useState('incomplete');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [receiptAgent, setReceiptAgent] = useState(null);

  const isComplete = (agent) =>
    Boolean(agent.id_proof_uploaded) && Boolean(agent.agreement_uploaded);

  const stats = useMemo(() => {
    const complete = agents.filter(isComplete).length;
    return {
      total: agents.length,
      complete,
      incomplete: agents.length - complete,
      collected: agents.reduce(
        (sum, a) =>
          sum + (Number(a.membership_amount) || 0) + (Number(a.security_deposit) || 0),
        0
      ),
    };
  }, [agents]);

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return agents.filter((agent) => {
      if (filter === 'complete' && !isComplete(agent)) return false;
      if (filter === 'incomplete' && isComplete(agent)) return false;
      if (
        q &&
        !String(agent.name || '').toLowerCase().includes(q) &&
        !String(agent.phone || '').includes(q) &&
        !String(agent.village || '').toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [agents, filter, searchQuery]);

  const togglePaperwork = async (agent, field) => {
    setBusyId(agent.id);
    setError(null);
    try {
      await agentLeadService.updatePaperwork(agent.id, {
        [field]: !agent[field === 'idProofUploaded' ? 'id_proof_uploaded' : 'agreement_uploaded'],
      });
      await refreshAgents?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update the paperwork.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Stat label="Onboarded agents" value={stats.total} tone="stone" />
        <Stat label="Paperwork complete" value={stats.complete} tone="emerald" />
        <Stat label="Paperwork pending" value={stats.incomplete} tone="amber" />
        <Stat label="Joining money collected" value={formatINR(stats.collected)} tone="blue" />
      </div>

      {/* Toolbar */}
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

        <div className="flex items-center gap-1.5 bg-stone-50 px-2.5 py-1.5 rounded-md border border-stone-200 flex-1 min-w-[200px] max-w-sm">
          <Search className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search agent, phone, village…"
            className="w-full bg-transparent text-xs text-stone-800 placeholder-stone-400"
          />
        </div>

        <span className="text-xs text-stone-500 font-medium ml-auto">
          {visible.length} of {agents.length}
        </span>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-stone-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto max-h-[calc(100vh-420px)]">
          <table className="w-full text-xs text-left">
            <thead className="sticky top-0 z-20">
              <tr className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
                <th className="p-2.5 bg-stone-50">Agent</th>
                <th className="p-2.5 bg-stone-50">Village</th>
                <th className="p-2.5 bg-stone-50">Onboarded</th>
                <th className="p-2.5 text-center bg-stone-50">ID proof</th>
                <th className="p-2.5 text-center bg-stone-50">Agreement</th>
                <th className="p-2.5 bg-stone-50">Joining money</th>
                <th className="p-2.5 text-right bg-stone-50">Action</th>
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
                    {filter === 'incomplete'
                      ? 'Every agent has their paperwork on file.'
                      : 'No agents match this filter.'}
                  </td>
                </tr>
              ) : (
                visible.map((agent) => {
                  const busy = String(busyId) === String(agent.id);
                  const money =
                    (Number(agent.membership_amount) || 0) +
                    (Number(agent.security_deposit) || 0);

                  return (
                    <tr key={agent.id} className="hover:bg-stone-50 transition-colors">
                      <td className="p-2.5">
                        <button
                          type="button"
                          onClick={() => onOpenAgent?.(agent)}
                          className="flex items-center gap-2 min-w-0 text-left"
                        >
                          <PersonAvatar name={agent.name} photo={agent.photo} size="sm" />
                          <div className="min-w-0">
                            <div className="font-semibold text-stone-900 truncate hover:text-[#2563EB]">
                              {agent.name}
                            </div>
                            <div className="text-[10px] text-stone-400">
                              {AGENT_CODE(agent.id)} · {agent.phone}
                            </div>
                          </div>
                        </button>
                      </td>

                      <td className="p-2.5">
                        <div className="text-stone-800 font-medium">
                          {agent.village || '—'}
                        </div>
                        <div className="text-[10px] text-stone-500">
                          {agent.mandal || '—'}
                        </div>
                      </td>

                      <td className="p-2.5 text-stone-600">
                        {formatDate(agent.onboarding_completed_at || agent.joining_date)}
                      </td>

                      <td className="p-2.5 text-center">
                        <DocToggle
                          on={agent.id_proof_uploaded}
                          busy={busy}
                          onClick={() => togglePaperwork(agent, 'idProofUploaded')}
                          url={agent.id_proof_url}
                        />
                      </td>

                      <td className="p-2.5 text-center">
                        <DocToggle
                          on={agent.agreement_uploaded}
                          busy={busy}
                          onClick={() => togglePaperwork(agent, 'agreementUploaded')}
                          url={agent.agreement_url}
                        />
                      </td>

                      <td className="p-2.5">
                        <div className="font-bold text-stone-900">{formatINR(money)}</div>
                        <div className="text-[10px] text-stone-500">
                          fee {formatINR(agent.membership_amount)} · deposit{' '}
                          {formatINR(agent.security_deposit)}
                        </div>
                      </td>

                      <td className="p-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setReceiptAgent(agent)}
                          disabled={money <= 0}
                          className="px-2.5 py-1 rounded border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs inline-flex items-center gap-1 disabled:opacity-40"
                        >
                          <Receipt className="w-3 h-3" />
                          Receipt
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {receiptAgent && (
        <ReceiptModal agent={receiptAgent} onClose={() => setReceiptAgent(null)} />
      )}
    </div>
  );
}

/* ── Local pieces ─────────────────────────────────────────────── */

const STAT_TONES = {
  stone: 'bg-stone-50 border-stone-200 text-stone-800',
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  amber: 'bg-amber-50 border-amber-200 text-amber-900',
  blue: 'bg-blue-50 border-blue-200 text-blue-900',
};

function Stat({ label, value, tone }) {
  return (
    <div className={`p-2.5 rounded-lg border ${STAT_TONES[tone]}`}>
      <div className="text-[11px] font-bold uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-xl font-black mt-1 leading-none">{value}</div>
    </div>
  );
}

function DocToggle({ on, busy, onClick, url }) {
  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        title={on ? 'On file — click to mark missing' : 'Missing — click to mark on file'}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-bold transition-colors disabled:opacity-40 ${
          on
            ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
            : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
        }`}
      >
        {busy ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : on ? (
          <CheckCircle2 className="w-3 h-3" />
        ) : (
          <XCircle className="w-3 h-3" />
        )}
        {on ? 'On file' : 'Missing'}
      </button>
      {on && url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          title="Open the scan"
          className="p-0.5 rounded text-[#2563EB] hover:bg-blue-50"
        >
          <Download className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

/**
 * The joining receipt, built from the agent's ledger rather than from the
 * running totals — so it itemises what was actually taken and when.
 */
function ReceiptModal({ agent, onClose }) {
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await agentFinanceService.getLedger(agent.id);
      setLedger(data.result || data.data || null);
      setError(null);
    } catch (err) {
      console.error('Failed to load ledger:', err);
      setError('Could not load this agent’s ledger.');
    } finally {
      setLoading(false);
    }
  }, [agent.id]);

  useEffect(() => {
    load();
  }, [load]);

  const joiningLines = useMemo(
    () =>
      (ledger?.transactions || []).filter(
        (t) => t.type === 'MEMBERSHIP_FEE' || t.notes?.includes('onboarding')
      ),
    [ledger]
  );

  const total = joiningLines.reduce((s, t) => s + (Number(t.amount) || 0), 0);

  return (
    <Modal
      title="Agent fee receipt"
      subtitle={`${agent.name} · ${AGENT_CODE(agent.id)}`}
      onClose={onClose}
      footer={<GhostButton onClick={onClose}>Close</GhostButton>}
    >
      <ModalError>{error}</ModalError>

      {loading ? (
        <div className="py-10 text-center">
          <Loader2 className="w-5 h-5 animate-spin text-[#2563EB] mx-auto" />
        </div>
      ) : (
        <div className="border border-stone-200 rounded-lg overflow-hidden">
          <div className="p-3 bg-stone-50 border-b border-stone-200">
            <div className="flex items-center gap-2.5">
              <PersonAvatar name={agent.name} photo={agent.photo} size="md" />
              <div className="min-w-0">
                <div className="font-bold text-sm text-stone-900">{agent.name}</div>
                <div className="text-[11px] text-stone-500">
                  {agent.village || '—'}, {agent.mandal || '—'} · {agent.phone}
                </div>
              </div>
            </div>
          </div>

          {joiningLines.length === 0 ? (
            <div className="p-6 text-center text-xs text-stone-400">
              <FileWarning className="w-5 h-5 mx-auto mb-1.5 text-stone-300" />
              No joining transactions recorded for this agent.
            </div>
          ) : (
            <>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
                    <th className="p-2 text-left">Item</th>
                    <th className="p-2 text-left">Reference</th>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {joiningLines.map((t) => (
                    <tr key={t.id}>
                      <td className="p-2 font-medium text-stone-800">
                        {String(t.type).replace(/_/g, ' ').toLowerCase()}
                      </td>
                      <td className="p-2 text-stone-500">
                        {t.transaction_code}
                        {t.reference_no ? ` · ${t.reference_no}` : ''}
                      </td>
                      <td className="p-2 text-stone-500">{t.transaction_date || '—'}</td>
                      <td className="p-2 text-right font-bold text-stone-900">
                        {formatINR(t.amount, { abbreviate: false })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="p-3 bg-emerald-50 border-t border-emerald-200 flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 inline-flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5" />
                  Total collected
                </span>
                <span className="text-sm font-black text-emerald-900">
                  {formatINR(total, { abbreviate: false })}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
