import { useState, useEffect, useCallback } from 'react';
import { BadgeDollarSign, Plus, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';

import DataTable from '../common/DataTable';
import Badge from '../common/Badge';
import StatCard from '../common/StatCard';
import RecordTransactionModal from '../Finance/RecordTransactionModal';
import agentFinanceService from '../../../services/agentFinanceService';
import {
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
  SETTLED_TRANSACTION_STATUSES,
  PAYMENT_MODES,
  formatINR,
  labelOf,
  variantOf,
} from '../agentConstants';

/**
 * Agents department finance: the commission and membership ledger.
 *
 * Every row here is what `agent.commission_earned` / `commission_paid` are
 * derived from, so a status change recomputes the agent's running totals
 * server-side — the registry and this table can never disagree.
 */
export default function AgentFinanceTab({ agents = [] }) {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [recordOpen, setRecordOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listData, summaryData] = await Promise.all([
        agentFinanceService.getTransactions({
          type: typeFilter === 'ALL' ? undefined : typeFilter,
          status: statusFilter === 'ALL' ? undefined : statusFilter,
        }),
        agentFinanceService.getSummary(),
      ]);

      const list = listData.result || listData.data || [];
      setTransactions(Array.isArray(list) ? list : []);
      setSummary(summaryData.result || summaryData.data || null);
      setError(null);
    } catch (err) {
      console.error('Failed to load agent finance:', err);
      setTransactions([]);
      setError(
        err?.response?.status === 404
          ? 'The agent finance endpoints are not available on this backend yet.'
          : 'Could not load the finance ledger.'
      );
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatus = async (transaction, status) => {
    setBusyId(transaction.id);
    setActionError(null);
    try {
      await agentFinanceService.updateTransactionStatus(transaction.id, status);
      await load();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not update this transaction.');
    } finally {
      setBusyId(null);
    }
  };

  const columns = [
    {
      header: 'Transaction',
      accessorKey: 'transaction_code',
      sortable: true,
      cell: (row) => (
        <div>
          <div className="font-bold text-xs text-[#1c1917]">
            {row.transaction_code || `TXN-${row.id}`}
          </div>
          <div className="text-[10px] text-[#78716c]">{row.transaction_date || '—'}</div>
        </div>
      ),
    },
    {
      header: 'Agent',
      cell: (row) => (
        <div>
          <div className="font-bold text-xs text-[#1c1917]">
            {row.agent?.name || 'Unknown agent'}
          </div>
          <div className="text-[10px] text-[#78716c]">
            {row.agent?.village || '—'} · {row.agent?.phone || '—'}
          </div>
        </div>
      ),
    },
    {
      header: 'Type',
      accessorKey: 'type',
      sortable: true,
      cell: (row) => {
        const meta = TRANSACTION_TYPES.find((t) => t.key === row.type);
        return (
          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                meta?.direction === 'OUT' ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
              title={meta?.direction === 'OUT' ? 'Paid to agent' : 'Received from agent'}
            />
            <span className="text-[11px] font-semibold text-[#57534e]">
              {labelOf(TRANSACTION_TYPES, row.type)}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Amount',
      accessorKey: 'amount',
      sortable: true,
      cell: (row) => {
        const meta = TRANSACTION_TYPES.find((t) => t.key === row.type);
        return (
          <span
            className={`font-extrabold text-xs ${
              meta?.direction === 'OUT' ? 'text-rose-700' : 'text-[#2563EB]'
            }`}
          >
            {meta?.direction === 'OUT' ? '−' : '+'}
            {formatINR(row.amount, { abbreviate: false })}
          </span>
        );
      },
    },
    {
      header: 'Mode',
      accessorKey: 'payment_mode',
      cell: (row) => (
        <span className="text-[11px] text-[#57534e]">
          {row.payment_mode ? labelOf(PAYMENT_MODES, row.payment_mode) : '—'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      sortable: true,
      cell: (row) => (
        <Badge variant={variantOf(TRANSACTION_STATUSES, row.status)} dot>
          {labelOf(TRANSACTION_STATUSES, row.status)}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      cell: (row) => {
        const isBusy = String(busyId) === String(row.id);
        const isSettled = SETTLED_TRANSACTION_STATUSES.includes(row.status);

        return (
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {isSettled ? (
              // A settled line is an accounting record; the server refuses to
              // re-price or delete one, so no edit affordance is offered.
              <span className="text-[10px] font-bold text-[#78716c] px-2">Settled</span>
            ) : (
              <select
                value={row.status}
                disabled={isBusy}
                onChange={(e) => handleStatus(row, e.target.value)}
                className="text-[11px] bg-[#fafaf9] border border-[#e7e5e4] rounded-lg px-1.5 py-1 font-bold text-[#1c1917] disabled:opacity-50"
              >
                {TRANSACTION_STATUSES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
            {isBusy && <Loader2 className="w-3 h-3 animate-spin text-[#2563EB]" />}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white p-5 rounded-2xl border border-[#e7e5e4] shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
            <BadgeDollarSign className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[#1c1917]">
              Agents finance &amp; commission ledger
            </h2>
            <p className="text-xs text-[#78716c] mt-0.5">
              Membership collections, commission payouts and incentive vouchers — the rows
              an agent's running totals are computed from
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#e7e5e4] bg-white text-xs font-bold text-[#1c1917] hover:border-[#2563EB]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => setRecordOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-bold hover:bg-[#1d4ed8] shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Record transaction
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          title="Commissions disbursed"
          value={formatINR(summary?.commissionsDisbursed)}
          subtext="Settled payouts to agents"
          variant="green"
        />
        <StatCard
          title="Pending commission"
          value={formatINR(summary?.commissionsPending)}
          subtext="Approved but not yet paid"
          variant="orange"
        />
        <StatCard
          title="Membership collected"
          value={formatINR(summary?.membershipCollected)}
          subtext="Onboarding kit deposits"
        />
        <StatCard
          title="Advances outstanding"
          value={formatINR(summary?.advancesOutstanding)}
          subtext="Paid out, not yet recovered"
        />
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl px-4 py-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {actionError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl px-4 py-3">
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-[#e7e5e4] py-16 flex items-center justify-center">
          <span className="flex items-center gap-2 text-xs font-bold text-[#78716c]">
            <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading ledger…
          </span>
        </div>
      ) : (
        <DataTable
          data={transactions}
          columns={columns}
          searchPlaceholder="Search by transaction code or reference…"
          searchFilterKeys={['transaction_code', 'reference_no', 'notes']}
          emptyMessage="No transactions recorded for these filters."
          exportFileName="garuda-agent-transactions.csv"
          filters={
            <div className="flex items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="p-2 rounded-lg border border-[#e7e5e4] bg-[#fafaf9] text-xs font-semibold text-[#1c1917]"
              >
                <option value="ALL">All types</option>
                {TRANSACTION_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="p-2 rounded-lg border border-[#e7e5e4] bg-[#fafaf9] text-xs font-semibold text-[#1c1917]"
              >
                <option value="ALL">All statuses</option>
                {TRANSACTION_STATUSES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          }
        />
      )}

      {recordOpen && (
        <RecordTransactionModal
          agents={agents}
          onClose={() => setRecordOpen(false)}
          onSaved={() => {
            setRecordOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}
