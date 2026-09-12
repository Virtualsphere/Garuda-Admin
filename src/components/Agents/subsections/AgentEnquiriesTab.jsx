import { useState, useEffect, useCallback, useMemo } from 'react';
import { Headphones, Plus, Loader2, AlertTriangle, UserPlus, RefreshCw } from 'lucide-react';

import DataTable from '../common/DataTable';
import Badge from '../common/Badge';
import CallButton from '../common/CallButton';
import StatCard from '../common/StatCard';
import LogEnquiryModal from '../Enquiries/LogEnquiryModal';
import agentEnquiryService from '../../../services/agentEnquiryService';
import {
  ENQUIRY_STATUSES,
  ENQUIRY_TYPES,
  ENQUIRY_CALLER_TYPES,
  TERMINAL_ENQUIRY_STATUSES,
  labelOf,
  variantOf,
} from '../agentConstants';

/**
 * The agents desk phone log: who rang in, what they wanted, and whether it
 * became a recruitment lead.
 *
 * An enquiry is deliberately not a candidate — converting is an explicit act,
 * and the server refuses to convert somebody who is already an appointed agent.
 */
export default function AgentEnquiriesTab() {
  const [enquiries, setEnquiries] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [logOpen, setLogOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listData, statsData] = await Promise.all([
        agentEnquiryService.getAll({
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          enquiryType: typeFilter === 'ALL' ? undefined : typeFilter,
        }),
        agentEnquiryService.getStats(),
      ]);

      const list = listData.result || listData.data || [];
      setEnquiries(Array.isArray(list) ? list : []);
      setStats(statsData.result || statsData.data || null);
      setError(null);
    } catch (err) {
      console.error('Failed to load agent enquiries:', err);
      setEnquiries([]);
      setError(
        err?.response?.status === 404
          ? 'The enquiry endpoints are not available on this backend yet.'
          : 'Could not load agent enquiries.'
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatus = async (enquiry, status) => {
    setBusyId(enquiry.id);
    setActionError(null);
    try {
      await agentEnquiryService.updateStatus(enquiry.id, status);
      await load();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not update this enquiry.');
    } finally {
      setBusyId(null);
    }
  };

  const handleConvert = async (enquiry) => {
    setBusyId(enquiry.id);
    setActionError(null);
    try {
      await agentEnquiryService.convert(enquiry.id);
      await load();
    } catch (err) {
      setActionError(
        err.response?.data?.message ||
          'Could not convert this enquiry into a recruitment candidate.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const openCount = useMemo(
    () => enquiries.filter((e) => !TERMINAL_ENQUIRY_STATUSES.includes(e.status)).length,
    [enquiries]
  );

  const columns = [
    {
      header: 'Enquiry',
      accessorKey: 'enquiry_code',
      sortable: true,
      cell: (row) => (
        <div>
          <div className="font-bold text-xs text-[#1c1917]">
            {row.enquiry_code || `ENQ-${row.id}`}
          </div>
          <div className="text-[10px] text-[#78716c]">
            {row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}
          </div>
        </div>
      ),
    },
    {
      header: 'Caller',
      accessorKey: 'caller_name',
      sortable: true,
      cell: (row) => (
        <div>
          <div className="font-bold text-xs text-[#1c1917]">{row.caller_name}</div>
          <div className="text-[10px] text-[#78716c]">{row.caller_phone}</div>
        </div>
      ),
    },
    {
      header: 'Caller type',
      accessorKey: 'caller_type',
      cell: (row) => (
        <div className="space-y-1">
          <Badge variant={row.caller_type === 'EXISTING_AGENT' ? 'green' : 'gray'}>
            {labelOf(ENQUIRY_CALLER_TYPES, row.caller_type)}
          </Badge>
          {row.matched_record_id && (
            <div className="text-[10px] text-[#2563EB] font-bold">
              Matched on file
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Wants',
      accessorKey: 'enquiry_type',
      sortable: true,
      cell: (row) => (
        <span className="text-[11px] font-semibold text-[#57534e]">
          {labelOf(ENQUIRY_TYPES, row.enquiry_type)}
        </span>
      ),
    },
    {
      header: 'Location',
      accessorKey: 'village',
      cell: (row) => (
        <div>
          <div className="font-bold text-xs text-[#1c1917]">{row.village || '—'}</div>
          <div className="text-[10px] text-[#78716c]">
            {row.mandal || '—'}, {row.district || '—'}
          </div>
          {row.preferred_village && (
            <div className="text-[10px] text-amber-700 font-bold">
              Prefers {row.preferred_village}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Telecaller',
      cell: (row) => (
        <span className="text-[11px] text-[#57534e] font-semibold">
          {row.assignedEmployee?.name || '—'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      sortable: true,
      cell: (row) => (
        <Badge variant={variantOf(ENQUIRY_STATUSES, row.status)} dot>
          {labelOf(ENQUIRY_STATUSES, row.status)}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      cell: (row) => {
        const isBusy = String(busyId) === String(row.id);
        const isConverted = Boolean(row.converted_candidate_id);
        const isAgent = row.matched_record_type === 'MASTER_AGENT';

        return (
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <CallButton
              phone={row.caller_phone}
              recordName={row.caller_name}
              recordId={row.id}
              recordType="AGENT_ENQUIRY"
              variant="outline"
            />

            <select
              value={row.status}
              disabled={isBusy}
              onChange={(e) => handleStatus(row, e.target.value)}
              className="text-[11px] bg-[#fafaf9] border border-[#e7e5e4] rounded-lg px-1.5 py-1 font-bold text-[#1c1917] disabled:opacity-50"
            >
              {ENQUIRY_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>

            {!isConverted && !isAgent && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => handleConvert(row)}
                title="Promote into the recruitment pipeline"
                className="px-2 py-1 rounded-lg bg-[#2563EB] text-white text-[11px] font-bold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-1"
              >
                {isBusy ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <UserPlus className="w-3 h-3" />
                )}
                Convert
              </button>
            )}

            {isConverted && (
              <span className="px-2 py-1 rounded-lg bg-purple-50 text-purple-700 text-[11px] font-bold">
                Lead created
              </span>
            )}
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
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[#1c1917]">Agent enquiries</h2>
            <p className="text-xs text-[#78716c] mt-0.5">
              Inbound calls to the agents desk — vacancy questions, joining queries and
              support, with one-click promotion into the recruitment pipeline
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#e7e5e4] bg-white text-xs font-bold text-[#1c1917] hover:border-[#2563EB]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setLogOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-bold hover:bg-[#1d4ed8] shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Log enquiry
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          title="Open enquiries"
          value={openCount}
          subtext="Still being worked"
          variant="orange"
        />
        <StatCard
          title="Total logged"
          value={stats?.total ?? enquiries.length}
          subtext="All time"
        />
        <StatCard
          title="Converted to leads"
          value={stats?.byStatus?.CONVERTED_TO_LEAD ?? 0}
          subtext="Entered the pipeline"
          variant="green"
        />
        <StatCard
          title="Callbacks pending"
          value={stats?.byStatus?.CALLBACK_PENDING ?? 0}
          subtext="Promised a call back"
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
            <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading enquiries…
          </span>
        </div>
      ) : (
        <DataTable
          data={enquiries}
          columns={columns}
          searchPlaceholder="Search by caller name, phone or enquiry code…"
          searchFilterKeys={['caller_name', 'caller_phone', 'enquiry_code', 'village']}
          emptyMessage="No enquiries have been logged for these filters."
          exportFileName="garuda-agent-enquiries.csv"
          filters={
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="p-2 rounded-lg border border-[#e7e5e4] bg-[#fafaf9] text-xs font-semibold text-[#1c1917]"
              >
                <option value="ALL">All statuses</option>
                {ENQUIRY_STATUSES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="p-2 rounded-lg border border-[#e7e5e4] bg-[#fafaf9] text-xs font-semibold text-[#1c1917]"
              >
                <option value="ALL">All enquiry types</option>
                {ENQUIRY_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          }
        />
      )}

      {logOpen && (
        <LogEnquiryModal
          onClose={() => setLogOpen(false)}
          onSaved={() => {
            setLogOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}
