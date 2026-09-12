import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  User,
  MapPinned,
  Layers,
  Eye,
  PhoneCall,
  BadgeDollarSign,
  Loader2,
  Trash2,
  Save,
  Pencil,
  Receipt,
  FileText,
  Link2,
} from 'lucide-react';

import Badge from './common/Badge';
import CallButton from './common/CallButton';
import AgentReceiptModal from './modals/AgentReceiptModal';
import AgentDocumentsModal from './modals/AgentDocumentsModal';
import LinkLandsModal from './modals/LinkLandsModal';
import AttachAdditionalVillageModal from './modals/AttachAdditionalVillageModal';
import AgentObservationLandsModal from './modals/AgentObservationLandsModal';
import AgentFormModal from './AgentFormModal';
import agentService from '../../services/agentService';
import agentFinanceService from '../../services/agentFinanceService';
import agentObservationService from '../../services/agentObservationService';
import callSignalService from '../../services/callSignalService';
import useLocations from '../../hooks/useLocations';
import {
  AGENT_STATUSES,
  MEMBERSHIP_STATUSES,
  OBSERVATION_STATUS_LABELS,
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
  AGENT_CODE,
  formatINR,
  labelOf,
  variantOf,
} from './agentConstants';

const na = (v) => (v === null || v === undefined || v === '' ? '—' : v);

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

const formatDuration = (seconds) => {
  const total = Number(seconds) || 0;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// Call signals carry no agent id — they are matched on the dialled number,
// so compare on the last 10 digits and ignore formatting differences.
const phoneKey = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);

/**
 * The agent's 360° profile: identity, the villages they cover, the lands they
 * source and observe, their call history and their ledger.
 */
export default function AgentProfileDrawer({ agent, onClose, onChanged }) {
  const [activeTab, setActiveTab] = useState('OVERVIEW');
  const [territory, setTerritory] = useState([]);
  const [lands, setLands] = useState([]);
  const [observations, setObservations] = useState([]);
  const [calls, setCalls] = useState([]);
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingTerritory, setSavingTerritory] = useState(false);
  const [error, setError] = useState(null);
  const [editOpen, setEditOpen] = useState(false);

  // The record actions that also live on the directory row, so the drawer is
  // not a dead end once somebody has opened it.
  const [openRecord, setOpenRecord] = useState(null);
  const {
    states,
    districts,
    mandals,
    villages,
    selectedState,
    selectedDistrict,
    selectedMandal,
    setSelectedState,
    setSelectedDistrict,
    setSelectedMandal,
    loading: locationsLoading,
  } = useLocations();

  const agentId = agent?.id;

  const load = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    setError(null);

    // Each panel is independent — one missing endpoint should not blank the
    // whole drawer, so every call settles on its own.
    const [territoryRes, landsRes, obsRes, callsRes, ledgerRes] = await Promise.allSettled([
      agentService.getTerritory(agentId),
      agentService.getLinkedLands(agentId),
      agentObservationService.getAssignments({ agentId }),
      callSignalService.getAll({ department_type: 'agents' }),
      agentFinanceService.getLedger(agentId),
    ]);

    const unwrap = (settled, ...keys) => {
      if (settled.status !== 'fulfilled') return [];
      const data = settled.value;
      for (const key of keys) {
        if (Array.isArray(data?.[key])) return data[key];
      }
      return Array.isArray(data) ? data : [];
    };

    setTerritory(unwrap(territoryRes, 'result', 'data'));
    setLands(unwrap(landsRes, 'data', 'result'));
    setObservations(unwrap(obsRes, 'result', 'data'));

    const callsList = unwrap(callsRes, 'data', 'result');
    const key = phoneKey(agent?.phone);
    setCalls(callsList.filter((c) => key && phoneKey(c.caller_phone) === key));

    if (ledgerRes.status === 'fulfilled') {
      setLedger(ledgerRes.value.result || ledgerRes.value.data || null);
    } else {
      setLedger(null);
    }

    if (territoryRes.status === 'rejected' && landsRes.status === 'rejected') {
      setError('Could not load this agent’s records.');
    }

    setLoading(false);
  }, [agentId, agent?.phone]);

  useEffect(() => {
    load();
  }, [load]);

  const territoryVillages = useMemo(
    () => territory.map((t) => t.village).filter(Boolean),
    [territory]
  );

  const addVillage = (villageName) => {
    if (!villageName) return;
    if (territoryVillages.some((v) => (v || '').toLowerCase() === villageName.toLowerCase()))
      return;

    setTerritory((prev) => [
      ...prev,
      {
        id: `pending-${villageName}`,
        state: states.find((s) => String(s.id) === String(selectedState))?.name || agent.state,
        district:
          districts.find((d) => String(d.id) === String(selectedDistrict))?.name ||
          agent.district,
        mandal:
          mandals.find((m) => String(m.id) === String(selectedMandal))?.name || agent.mandal,
        village: villageName,
      },
    ]);
  };

  const saveTerritory = async () => {
    setSavingTerritory(true);
    setError(null);
    try {
      await agentService.setTerritory(
        agentId,
        territory.map((t) => ({
          state: t.state,
          district: t.district,
          mandal: t.mandal,
          village: t.village,
        }))
      );
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save the territory. Try again.');
    } finally {
      setSavingTerritory(false);
    }
  };

  const TABS = [
    { key: 'OVERVIEW', label: 'Overview', icon: User },
    { key: 'TERRITORY', label: `Territory (${territory.length})`, icon: MapPinned },
    { key: 'LANDS', label: `Lands (${lands.length})`, icon: Layers },
    { key: 'OBSERVATIONS', label: `Observations (${observations.length})`, icon: Eye },
    { key: 'CALLS', label: `Calls (${calls.length})`, icon: PhoneCall },
    { key: 'FINANCE', label: 'Finance', icon: BadgeDollarSign },
  ];

  const dueCount = observations.filter((o) => o.status === 'INFORMATION_DUE').length;

  return (
    <div
      className="fixed inset-0 z-[900] bg-[#1c1917]/40 backdrop-blur-xs flex justify-end"
      onClick={onClose}
    >
      <div
        className="bg-[#f5f5f4] w-full max-w-3xl h-full flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${agent?.name} profile`}
      >
        {/* Header */}
        <div className="bg-[#1c1917] text-white px-5 py-4 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {agent?.photo ? (
              <img
                src={agent.photo}
                alt={agent.name}
                className="w-12 h-12 rounded-xl object-cover shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-[#2563EB] flex items-center justify-center font-black text-lg shrink-0">
                {String(agent?.name || '?').charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-extrabold truncate">{agent?.name}</h3>
                <span className="px-2 py-0.5 rounded bg-white/10 text-orange-200 text-xs font-bold">
                  {AGENT_CODE(agent?.id)}
                </span>
                <Badge variant={variantOf(AGENT_STATUSES, agent?.status)} dot>
                  {labelOf(AGENT_STATUSES, agent?.status)}
                </Badge>
              </div>
              <p className="text-xs text-gray-300 mt-0.5 truncate">
                {na(agent?.village)}, {na(agent?.mandal)} · {na(agent?.district)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <CallButton
              phone={agent?.phone}
              recordName={agent?.name}
              recordId={agent?.id}
              recordType="MASTER_AGENT"
              size="md"
            />
            <DrawerAction label="Fee receipt" onClick={() => setOpenRecord("receipt")}>
              <Receipt className="w-4 h-4" />
            </DrawerAction>
            <DrawerAction label="Document vault" onClick={() => setOpenRecord("documents")}>
              <FileText className="w-4 h-4" />
            </DrawerAction>
            <DrawerAction label="Link lands" onClick={() => setOpenRecord("lands")}>
              <Link2 className="w-4 h-4" />
            </DrawerAction>
            <DrawerAction label="Attach another village" onClick={() => setOpenRecord("village")}>
              <MapPinned className="w-4 h-4" />
            </DrawerAction>
            <DrawerAction label="Observed lands" onClick={() => setOpenRecord("observations")}>
              <Eye className="w-4 h-4" />
            </DrawerAction>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              title="Edit agent"
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b border-[#e7e5e4] px-3 flex items-center gap-1 overflow-x-auto shrink-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'border-[#2563EB] text-[#2563EB]'
                    : 'border-transparent text-[#78716c] hover:text-[#1c1917]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.key === 'OBSERVATIONS' && dueCount > 0 && (
                  <span className="px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-black">
                    {dueCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-20 flex items-center justify-center">
              <span className="flex items-center gap-2 text-xs font-bold text-[#78716c]">
                <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading profile…
              </span>
            </div>
          ) : (
            <>
              {activeTab === 'OVERVIEW' && (
                <div className="space-y-4">
                  <Panel title="Identity">
                    <Row label="Phone" value={na(agent?.phone)} />
                    <Row label="Alternate phone" value={na(agent?.alternate_phone)} />
                    <Row label="Email" value={na(agent?.email)} />
                    <Row label="Address" value={na(agent?.address)} />
                    <Row label="Joined" value={formatDate(agent?.joining_date)} />
                    <Row label="Lead source" value={na(agent?.lead_source)} />
                  </Panel>

                  <Panel title="Standing">
                    <Row
                      label="Membership"
                      value={
                        <Badge variant={variantOf(MEMBERSHIP_STATUSES, agent?.membership_status)}>
                          {labelOf(MEMBERSHIP_STATUSES, agent?.membership_status)}
                        </Badge>
                      }
                    />
                    <Row
                      label="Membership amount"
                      value={formatINR(agent?.membership_amount, { abbreviate: false })}
                    />
                    <Row
                      label="Commission earned"
                      value={formatINR(agent?.commission_earned, { abbreviate: false })}
                    />
                    <Row
                      label="Commission paid"
                      value={formatINR(agent?.commission_paid, { abbreviate: false })}
                    />
                    <Row label="Rating" value={na(agent?.rating)} />
                  </Panel>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <MiniStat label="Villages" value={territory.length} />
                    <MiniStat label="Lands linked" value={lands.length} />
                    <MiniStat label="Observing" value={observations.length} />
                    <MiniStat label="Calls" value={calls.length} />
                  </div>
                </div>
              )}

              {activeTab === 'TERRITORY' && (
                <div className="space-y-4">
                  <Panel title="Assigned villages">
                    {territory.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {territory.map((t) => (
                          <span
                            key={t.id}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#fafaf9] border border-[#e7e5e4] text-xs font-bold text-[#1c1917]"
                          >
                            {t.village}
                            <button
                              type="button"
                              onClick={() =>
                                setTerritory((prev) =>
                                  prev.filter((x) => x.village !== t.village)
                                )
                              }
                              className="text-[#78716c] hover:text-rose-600"
                              aria-label={`Remove ${t.village}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#78716c]">
                        No villages assigned beyond their home village.
                      </p>
                    )}
                  </Panel>

                  <Panel title="Add a village">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <select
                        value={selectedState}
                        onChange={(e) => setSelectedState(e.target.value)}
                        disabled={locationsLoading.states}
                        className="text-xs bg-[#fafaf9] border border-[#e7e5e4] rounded-lg px-2 py-1.5 font-semibold"
                      >
                        <option value="">State</option>
                        {states.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={selectedDistrict}
                        onChange={(e) => setSelectedDistrict(e.target.value)}
                        disabled={!selectedState}
                        className="text-xs bg-[#fafaf9] border border-[#e7e5e4] rounded-lg px-2 py-1.5 font-semibold disabled:opacity-50"
                      >
                        <option value="">District</option>
                        {districts.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={selectedMandal}
                        onChange={(e) => setSelectedMandal(e.target.value)}
                        disabled={!selectedDistrict}
                        className="text-xs bg-[#fafaf9] border border-[#e7e5e4] rounded-lg px-2 py-1.5 font-semibold disabled:opacity-50"
                      >
                        <option value="">Mandal</option>
                        {mandals.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value=""
                        onChange={(e) => {
                          const village = villages.find(
                            (v) => String(v.id) === String(e.target.value)
                          );
                          if (village) addVillage(village.name);
                        }}
                        disabled={!selectedMandal}
                        className="text-xs bg-[#fafaf9] border border-[#e7e5e4] rounded-lg px-2 py-1.5 font-semibold disabled:opacity-50"
                      >
                        <option value="">Add village…</option>
                        {villages.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={saveTerritory}
                      disabled={savingTerritory}
                      className="mt-3 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-bold hover:bg-[#1d4ed8] disabled:opacity-50"
                    >
                      {savingTerritory ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      Save territory
                    </button>
                  </Panel>
                </div>
              )}

              {activeTab === 'LANDS' && (
                <Panel title={`Lands sourced by ${agent?.name}`}>
                  {lands.length > 0 ? (
                    <div className="space-y-2">
                      {lands.map((land) => (
                        <div
                          key={land.id}
                          className="flex items-center justify-between gap-3 p-3 bg-[#fafaf9] rounded-xl border border-[#e7e5e4]"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#1c1917]">
                              LD-{land.id} · {na(land.village)}
                            </div>
                            <div className="text-[10px] text-[#78716c]">
                              {na(land.mandal)}, {na(land.district)}
                            </div>
                          </div>
                          <Badge variant="orange">Primary link</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#78716c]">
                      No land parcels are linked to this agent yet.
                    </p>
                  )}
                </Panel>
              )}

              {activeTab === 'OBSERVATIONS' && (
                <Panel title="Standing observations">
                  {observations.length > 0 ? (
                    <div className="space-y-2">
                      {observations.map((obs) => (
                        <div
                          key={obs.id}
                          className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${
                            obs.status === 'INFORMATION_DUE'
                              ? 'bg-rose-50 border-rose-200'
                              : 'bg-[#fafaf9] border-[#e7e5e4]'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#1c1917]">
                              LD-{obs.land_id} · {na(obs.land?.village)}
                            </div>
                            <div className="text-[10px] text-[#78716c]">
                              {String(obs.frequency || '').replace(/_/g, ' ')} · next report{' '}
                              {obs.next_due_date || 'not scheduled'}
                            </div>
                          </div>
                          <Badge
                            variant={
                              obs.status === 'INFORMATION_DUE'
                                ? 'red'
                                : obs.status === 'UPDATED'
                                ? 'green'
                                : 'gray'
                            }
                          >
                            {OBSERVATION_STATUS_LABELS[obs.status] || obs.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#78716c]">
                      This agent is not observing any parcels.
                    </p>
                  )}
                </Panel>
              )}

              {activeTab === 'CALLS' && (
                <Panel title="Call history">
                  {calls.length > 0 ? (
                    <div className="space-y-2">
                      {calls.map((call) => (
                        <div
                          key={call.id}
                          className="flex items-center justify-between gap-3 p-3 bg-[#fafaf9] rounded-xl border border-[#e7e5e4]"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#1c1917]">
                              {formatDate(call.created_at)} ·{' '}
                              {formatDuration(call.duration_seconds)}
                            </div>
                            <div className="text-[10px] text-[#78716c] truncate">
                              {na(call.mission_context)}
                            </div>
                          </div>
                          <Badge variant={call.direction === 'outbound' ? 'blue' : 'green'}>
                            {String(call.direction || '').toUpperCase()}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#78716c]">
                      No calls logged against this number.
                    </p>
                  )}
                </Panel>
              )}

              {activeTab === 'FINANCE' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <MiniStat
                      label="Earned"
                      value={formatINR(ledger?.agent?.commission_earned ?? agent?.commission_earned)}
                    />
                    <MiniStat
                      label="Paid"
                      value={formatINR(ledger?.agent?.commission_paid ?? agent?.commission_paid)}
                    />
                    <MiniStat
                      label="Outstanding"
                      value={formatINR(ledger?.outstanding)}
                      tone={Number(ledger?.outstanding) > 0 ? 'amber' : undefined}
                    />
                  </div>

                  <Panel title="Ledger">
                    {ledger?.transactions?.length > 0 ? (
                      <div className="space-y-2">
                        {ledger.transactions.map((txn) => {
                          const meta = TRANSACTION_TYPES.find((t) => t.key === txn.type);
                          return (
                            <div
                              key={txn.id}
                              className="flex items-center justify-between gap-3 p-3 bg-[#fafaf9] rounded-xl border border-[#e7e5e4]"
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-[#1c1917]">
                                  {labelOf(TRANSACTION_TYPES, txn.type)}
                                </div>
                                <div className="text-[10px] text-[#78716c]">
                                  {txn.transaction_code} · {txn.transaction_date || '—'}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div
                                  className={`text-xs font-extrabold ${
                                    meta?.direction === 'OUT'
                                      ? 'text-rose-700'
                                      : 'text-[#2563EB]'
                                  }`}
                                >
                                  {meta?.direction === 'OUT' ? '−' : '+'}
                                  {formatINR(txn.amount, { abbreviate: false })}
                                </div>
                                <Badge variant={variantOf(TRANSACTION_STATUSES, txn.status)}>
                                  {labelOf(TRANSACTION_STATUSES, txn.status)}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-[#78716c]">
                        No transactions recorded against this agent.
                      </p>
                    )}
                  </Panel>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {editOpen && (
        <AgentFormModal
          agent={agent}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            onChanged?.();
            load();
          }}
        />
      )}

      {openRecord === 'receipt' && (
        <AgentReceiptModal agent={agent} onClose={() => setOpenRecord(null)} />
      )}

      {openRecord === 'documents' && (
        <AgentDocumentsModal
          agent={agent}
          onClose={() => setOpenRecord(null)}
          onSaved={load}
          onOpenReceipt={() => setOpenRecord('receipt')}
        />
      )}

      {openRecord === 'lands' && (
        <LinkLandsModal
          agent={agent}
          onClose={() => setOpenRecord(null)}
          onChanged={load}
        />
      )}

      {openRecord === 'village' && (
        <AttachAdditionalVillageModal
          agent={agent}
          onClose={() => setOpenRecord(null)}
          onDone={load}
        />
      )}

      {openRecord === 'observations' && (
        <AgentObservationLandsModal
          agent={agent}
          onClose={() => setOpenRecord(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

/** Icon button in the drawer header, on the dark bar. */
function DrawerAction({ label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
    >
      {children}
    </button>
  );
}

/* ── Local pieces ─────────────────────────────────────────────── */

function Panel({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-[#e7e5e4] shadow-sm p-4 space-y-3">
      <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#57534e]">
        {title}
      </h4>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs py-1.5 border-b border-[#f5f5f4] last:border-0">
      <span className="text-[#78716c] font-semibold">{label}</span>
      <span className="text-[#1c1917] font-bold text-right truncate">{value}</span>
    </div>
  );
}

function MiniStat({ label, value, tone }) {
  return (
    <div
      className={`rounded-xl border p-3 text-center ${
        tone === 'amber' ? 'bg-amber-50 border-amber-200' : 'bg-white border-[#e7e5e4]'
      }`}
    >
      <div
        className={`text-base font-black ${
          tone === 'amber' ? 'text-amber-800' : 'text-[#1c1917]'
        }`}
      >
        {value}
      </div>
      <div className="text-[10px] font-bold text-[#78716c] uppercase tracking-wider mt-0.5">
        {label}
      </div>
    </div>
  );
}
