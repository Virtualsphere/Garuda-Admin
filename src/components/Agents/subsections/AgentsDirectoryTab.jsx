import { useState, useMemo, useEffect, useRef } from 'react';
import {
  MapPin,
  Plus,
  Loader2,
  Layers,
  MoreHorizontal,
  Receipt,
  FileText,
  Link2,
  Eye,
} from 'lucide-react';

import DataTable from '../common/DataTable';
import Badge from '../common/Badge';
import CallButton from '../common/CallButton';
import AgentFormModal from '../AgentFormModal';
import AgentAttachLandMap from '../maps/AgentAttachLandMap';
import AgentReceiptModal from '../modals/AgentReceiptModal';
import AgentDocumentsModal from '../modals/AgentDocumentsModal';
import LinkLandsModal from '../modals/LinkLandsModal';
import AttachAdditionalVillageModal from '../modals/AttachAdditionalVillageModal';
import AgentObservationLandsModal from '../modals/AgentObservationLandsModal';
import agentService from '../../../services/agentService';
import {
  AGENT_STATUSES,
  MEMBERSHIP_STATUSES,
  AGENT_CODE,
  formatINR,
  variantOf,
  labelOf,
} from '../agentConstants';

/**
 * Master agents directory — the operational roster. Every row opens the agent's
 * 360° profile; the Lands action drops straight into their map workspace.
 */
export default function AgentsDirectoryTab({ agents, agentsLoading, refreshAgents, onOpenAgent }) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [mandalFilter, setMandalFilter] = useState('ALL');
  const [formAgent, setFormAgent] = useState(null);
  const [landsAgent, setLandsAgent] = useState(null);
  const [actionError, setActionError] = useState(null);

  // The per-agent record actions. Each holds the agent it was opened for, so
  // closing one never leaves another pointing at a stale row.
  const [receiptAgent, setReceiptAgent] = useState(null);
  const [documentsAgent, setDocumentsAgent] = useState(null);
  const [linkLandsAgent, setLinkLandsAgent] = useState(null);
  const [attachVillageAgent, setAttachVillageAgent] = useState(null);
  const [observationsAgent, setObservationsAgent] = useState(null);

  // Mandals actually present on the roster, so the filter never offers an
  // option that matches nothing.
  const mandals = useMemo(
    () => [...new Set(agents.map((a) => a.mandal).filter(Boolean))].sort(),
    [agents]
  );

  const filtered = useMemo(
    () =>
      agents.filter((agent) => {
        const matchesStatus = statusFilter === 'ALL' || agent.status === statusFilter;
        const matchesMandal =
          mandalFilter === 'ALL' ||
          String(agent.mandal || '').toLowerCase() === mandalFilter.toLowerCase();
        return matchesStatus && matchesMandal;
      }),
    [agents, statusFilter, mandalFilter]
  );

  const handleDelete = async (agent) => {
    const confirmed = window.confirm(
      `Remove ${agent.name} from the agent registry? This cannot be undone.`
    );
    if (!confirmed) return;

    setActionError(null);
    try {
      await agentService.delete(agent.id);
      await refreshAgents();
    } catch (err) {
      setActionError(err.response?.data?.message || `Could not remove ${agent.name}.`);
    }
  };

  const columns = [
    {
      header: 'Agent name & ID',
      accessorKey: 'name',
      sortable: true,
      cell: (row) => (
        <button
          type="button"
          onClick={() => onOpenAgent(row)}
          className="flex items-center gap-2.5 text-left"
        >
          {row.photo ? (
            <img
              src={row.photo}
              alt={row.name}
              className="w-8 h-8 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#2563EB] text-white text-xs font-black flex items-center justify-center shrink-0">
              {String(row.name || '?').charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <div className="font-bold text-[#1c1917] hover:text-[#2563EB] transition-colors truncate">
              {row.name}
            </div>
            <div className="text-[10px] text-[#78716c]">{AGENT_CODE(row.id)}</div>
          </div>
        </button>
      ),
    },
    {
      header: 'Contact phone',
      accessorKey: 'phone',
      cell: (row) => (
        <span className="text-xs font-semibold text-[#1c1917]">{row.phone || '—'}</span>
      ),
    },
    {
      header: 'Village / Mandal',
      accessorKey: 'village',
      sortable: true,
      cell: (row) => (
        <div>
          <div className="font-bold text-xs text-[#1c1917] flex items-center gap-1">
            <MapPin className="w-3 h-3 text-[#2563EB] shrink-0" /> {row.village || '—'}
          </div>
          <div className="text-[10px] text-[#78716c]">
            {row.mandal || '—'}, {row.district || '—'}
          </div>
        </div>
      ),
    },
    {
      header: 'Membership',
      accessorKey: 'membership_status',
      sortable: true,
      cell: (row) => (
        <Badge variant={variantOf(MEMBERSHIP_STATUSES, row.membership_status)}>
          {labelOf(MEMBERSHIP_STATUSES, row.membership_status)}
        </Badge>
      ),
    },
    {
      header: 'Commission',
      accessorKey: 'commission_earned',
      sortable: true,
      cell: (row) => {
        const earned = Number(row.commission_earned) || 0;
        const paid = Number(row.commission_paid) || 0;
        const due = earned - paid;
        return (
          <div className="text-xs">
            <div className="font-extrabold text-[#2563EB]">{formatINR(earned)}</div>
            {due > 0 && (
              <div className="text-[10px] text-amber-700 font-bold">
                {formatINR(due)} outstanding
              </div>
            )}
          </div>
        );
      },
    },
    {
      header: 'Status',
      accessorKey: 'status',
      sortable: true,
      cell: (row) => (
        <Badge variant={variantOf(AGENT_STATUSES, row.status)} dot>
          {labelOf(AGENT_STATUSES, row.status)}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <CallButton
            phone={row.phone}
            recordName={row.name}
            recordId={row.id}
            recordType="MASTER_AGENT"
            variant="outline"
          />
          <button
            type="button"
            onClick={() => setLandsAgent(row)}
            title="Open land workspace"
            className="px-2 py-1 rounded-lg bg-[#f5f5f4] text-[#1c1917] hover:bg-[#2563EB] hover:text-white text-[11px] font-bold transition-colors flex items-center gap-1"
          >
            <Layers className="w-3 h-3" /> Lands
          </button>
          <button
            type="button"
            onClick={() => onOpenAgent(row)}
            className="px-2 py-1 rounded-lg bg-gray-100 text-[#1c1917] hover:bg-[#1c1917] hover:text-white text-[11px] font-bold transition-colors"
          >
            Profile
          </button>

          <RecordMenu
            items={[
              { label: 'Fee receipt', icon: Receipt, onSelect: () => setReceiptAgent(row) },
              { label: 'Document vault', icon: FileText, onSelect: () => setDocumentsAgent(row) },
              { label: 'Link lands', icon: Link2, onSelect: () => setLinkLandsAgent(row) },
              {
                label: 'Attach another village',
                icon: MapPin,
                onSelect: () => setAttachVillageAgent(row),
              },
              {
                label: 'Observed lands',
                icon: Eye,
                onSelect: () => setObservationsAgent(row),
              },
              { separator: true },
              {
                label: 'Remove from registry',
                danger: true,
                onSelect: () => handleDelete(row),
              },
            ]}
          />
        </div>
      ),
    },
  ];

  if (landsAgent) {
    return (
      <div className="space-y-3">
        <AgentAttachLandMap agent={landsAgent} onClose={() => setLandsAgent(null)} />
      </div>
    );
  }

  const activeCount = agents.filter((a) => a.status === 'ACTIVE').length;

  return (
    <div className="space-y-4">
      <div className="bg-white p-5 rounded-2xl border border-[#e7e5e4] shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-[#1c1917]">
              Master agents directory
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
              {activeCount} active
            </span>
          </div>
          <p className="text-xs text-[#78716c] mt-0.5">
            Open any agent for their full 360° profile with territory, linked lands,
            observations and call log
          </p>
        </div>

        <button
          type="button"
          onClick={() => setFormAgent({})}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-bold hover:bg-[#1d4ed8] shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" /> Enlist agent
        </button>
      </div>

      {actionError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl px-4 py-3">
          {actionError}
        </div>
      )}

      {agentsLoading ? (
        <div className="bg-white rounded-xl border border-[#e7e5e4] py-16 flex items-center justify-center">
          <span className="flex items-center gap-2 text-xs font-bold text-[#78716c]">
            <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading agents…
          </span>
        </div>
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          searchPlaceholder="Search by agent name, village or mobile…"
          searchFilterKeys={['name', 'phone', 'village', 'mandal', 'district']}
          emptyMessage="No agents match these filters."
          exportFileName="garuda-agents.csv"
          filters={
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="p-2 rounded-lg border border-[#e7e5e4] bg-[#fafaf9] text-xs text-[#1c1917] font-semibold"
              >
                <option value="ALL">All statuses</option>
                {AGENT_STATUSES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>

              <select
                value={mandalFilter}
                onChange={(e) => setMandalFilter(e.target.value)}
                className="p-2 rounded-lg border border-[#e7e5e4] bg-[#fafaf9] text-xs text-[#1c1917] font-semibold"
              >
                <option value="ALL">All mandals</option>
                {mandals.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          }
        />
      )}

      {formAgent && (
        <AgentFormModal
          agent={formAgent}
          onClose={() => setFormAgent(null)}
          onSaved={() => {
            setFormAgent(null);
            refreshAgents();
          }}
        />
      )}

      {receiptAgent && (
        <AgentReceiptModal agent={receiptAgent} onClose={() => setReceiptAgent(null)} />
      )}

      {documentsAgent && (
        <AgentDocumentsModal
          agent={documentsAgent}
          onClose={() => setDocumentsAgent(null)}
          onSaved={refreshAgents}
          // Handing the vault a way back to the receipt keeps the two in one
          // flow, the way the prototype's "Open receipt" row does.
          onOpenReceipt={() => setReceiptAgent(documentsAgent)}
        />
      )}

      {linkLandsAgent && (
        <LinkLandsModal
          agent={linkLandsAgent}
          onClose={() => setLinkLandsAgent(null)}
          onChanged={refreshAgents}
        />
      )}

      {attachVillageAgent && (
        <AttachAdditionalVillageModal
          agent={attachVillageAgent}
          onClose={() => setAttachVillageAgent(null)}
          onDone={refreshAgents}
        />
      )}

      {observationsAgent && (
        <AgentObservationLandsModal
          agent={observationsAgent}
          onClose={() => setObservationsAgent(null)}
          onChanged={refreshAgents}
        />
      )}
    </div>
  );
}

/**
 * Overflow menu for a table row. The record actions outnumber the space in the
 * Actions column, and burying the destructive one behind a click is the point:
 * "Remove from registry" should not sit a stray tap away from "Profile".
 */
function RecordMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onAway = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onAway);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onAway);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="More actions"
        className="px-2 py-1 rounded-lg bg-[#f5f5f4] text-[#1c1917] hover:bg-[#e7e5e4] transition-colors"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-50 w-52 bg-white border border-stone-200 rounded-xl shadow-xl py-1"
        >
          {items.map((item, i) =>
            item.separator ? (
              // eslint-disable-next-line react/no-array-index-key
              <div key={`sep-${i}`} className="my-1 border-t border-stone-100" />
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={`w-full text-left px-3 py-1.5 text-[11px] font-semibold flex items-center gap-2 transition-colors ${
                  item.danger
                    ? 'text-rose-700 hover:bg-rose-50'
                    : 'text-stone-700 hover:bg-stone-50'
                }`}
              >
                {item.icon && <item.icon className="w-3.5 h-3.5 shrink-0 opacity-70" />}
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
