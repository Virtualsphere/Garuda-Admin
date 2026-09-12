import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  Undo2,
  Phone,
  Search,
  PlayCircle,
  TrendingUp,
  Clock,
  Layers,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import TeamLeaderCallModal from '../modals/TeamLeaderCallModal';

import PersonAvatar from '../common/PersonAvatar';
import GraphXAxisPhotoTick from '../common/GraphXAxisPhotoTick';
import Modal, { ModalError, Field, inputClass, GhostButton } from '../common/Modal';
import useAgentTeams from '../../../hooks/useAgentTeams';
import agentLeadService from '../../../services/agentLeadService';

const STATUS_TABS = [
  { key: 'All', label: 'All Cases' },
  { key: 'Pending', label: 'Pending Callback' },
  { key: 'Completed', label: 'Resolved' },
  { key: 'ReturnedToTelecaller', label: 'Returned' },
];

const STATUS_TONES = {
  Pending: 'bg-amber-50 text-amber-900 border-amber-300',
  Completed: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  ReturnedToTelecaller: 'bg-stone-100 text-stone-700 border-stone-300',
};

const formatWhen = (value) => {
  if (!value) return '—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '—';
  return `${dt.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  })} · ${dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
};

/**
 * The team leader's escalation hub: leads a telecaller could not close alone,
 * handed up with a note and (where MyOperator captured one) the recording.
 *
 * A lead can only have one open escalation at a time — the server enforces it
 * with a 409, so two leaders never work the same candidate.
 */
export default function TeamLeaderTab({ refresh }) {
  const { teams, employeeById } = useAgentTeams();

  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [statusFilter, setStatusFilter] = useState('Pending');
  const [leaderFilter, setLeaderFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [resolving, setResolving] = useState(null);
  const [workspace, setWorkspace] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // The whole history, so the KPI cards and tab counts read from one set.
      const data = await agentLeadService.getEscalations({ status: 'All' });
      const list = data.result || data.data || [];
      setEscalations(Array.isArray(list) ? list : []);
      setError(null);
    } catch (err) {
      console.error('Failed to load escalations:', err);
      setEscalations([]);
      setError('Could not load the team leader queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => ({
      All: escalations.length,
      Pending: escalations.filter((e) => e.status === 'Pending').length,
      Completed: escalations.filter((e) => e.status === 'Completed').length,
      ReturnedToTelecaller: escalations.filter(
        (e) => e.status === 'ReturnedToTelecaller'
      ).length,
    }),
    [escalations]
  );

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return escalations.filter((esc) => {
      if (statusFilter !== 'All' && esc.status !== statusFilter) return false;
      if (leaderFilter !== 'All' && String(esc.team_leader_id) !== String(leaderFilter))
        return false;

      if (!q) return true;
      const lead = esc.candidate || {};
      return (
        String(lead.name || '').toLowerCase().includes(q) ||
        String(lead.phone || '').includes(q) ||
        String(lead.village || '').toLowerCase().includes(q)
      );
    });
  }, [escalations, statusFilter, leaderFilter, searchQuery]);

  /** Cases handled per team leader, for the performance panel. */
  const leaderPerformance = useMemo(() => {
    const map = new Map();
    escalations.forEach((esc) => {
      const id = String(esc.team_leader_id || 'unassigned');
      if (!map.has(id)) map.set(id, { total: 0, resolved: 0, returned: 0, pending: 0 });
      const row = map.get(id);
      row.total += 1;
      if (esc.status === 'Completed') row.resolved += 1;
      if (esc.status === 'ReturnedToTelecaller') row.returned += 1;
      if (esc.status === 'Pending') row.pending += 1;
    });

    return [...map.entries()].map(([id, stats]) => {
      const leader = employeeById.get(id);
      const team = teams.find((t) => String(t.teamLeaderId) === id);
      return {
        id,
        name: leader?.name || team?.teamLeaderName || 'Unassigned',
        photo: leader?.photo || team?.teamLeaderPhoto || '',
        ...stats,
        resolutionRate: stats.total ? Math.round((stats.resolved / stats.total) * 100) : 0,
      };
    });
  }, [escalations, employeeById, teams]);

  const chartData = useMemo(
    () =>
      leaderPerformance.map((p) => ({
        name: p.name.split(' ')[0],
        fullName: p.name,
        leader: p.name.split(' ')[0],
        photo: p.photo,
        leads: p.total,
      })),
    [leaderPerformance]
  );

  return (
    <div className="space-y-3">
      {/* Banner */}
      <div className="bg-linear-to-r from-amber-50 to-white p-3 rounded-lg border border-amber-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-stone-900 text-xs block">
              Team Leader Escalation &amp; Operations Hub
            </span>
            <p className="text-[10px] text-stone-500">
              Senior intervention on leads the telecaller could not close alone
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Kpi
          label="Pending callback"
          sub="Awaiting senior callback"
          value={counts.Pending}
          icon={Clock}
          tone="amber"
        />
        <Kpi
          label="Resolved"
          sub="Converted or settled"
          value={counts.Completed}
          icon={CheckCircle2}
          tone="emerald"
        />
        <Kpi
          label="Returned"
          sub="Guidance note provided"
          value={counts.ReturnedToTelecaller}
          icon={Undo2}
          tone="stone"
        />
        <Kpi
          label="Total cases"
          sub="All-time interventions"
          value={counts.All}
          icon={Layers}
          tone="blue"
        />
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        {/* Queue */}
        <div className="lg:col-span-8 space-y-3">
          <div className="bg-white p-2.5 rounded-lg border border-stone-200 shadow-2xs flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                    statusFilter === tab.key
                      ? 'bg-[#2563EB] border-[#2563EB] text-white'
                      : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`px-1.5 rounded-full text-[10px] font-bold ${
                      statusFilter === tab.key
                        ? 'bg-white/25 text-white'
                        : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    {counts[tab.key]}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <select
                value={leaderFilter}
                onChange={(e) => setLeaderFilter(e.target.value)}
                className="px-2 py-1 bg-stone-50 rounded border border-stone-200 text-xs font-medium text-stone-700"
              >
                <option value="All">All team leaders</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.teamLeaderId}>
                    {t.teamLeaderName}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1.5 bg-stone-50 px-2 py-1 rounded border border-stone-200">
                <Search className="w-3.5 h-3.5 text-stone-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search candidate…"
                  className="bg-transparent text-xs w-32"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="bg-white border border-stone-200 rounded-lg py-14 flex items-center justify-center">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-stone-500">
                <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading cases…
              </span>
            </div>
          ) : visible.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-lg py-14 text-center text-xs text-stone-400">
              Nothing in this queue. Telecallers escalate from the call workspace.
            </div>
          ) : (
            <div className="space-y-2.5">
              {visible.map((esc) => {
                const lead = esc.candidate || {};
                const isPending = esc.status === 'Pending';

                return (
                  <div
                    key={esc.id}
                    className={`bg-white border rounded-lg p-3 space-y-2.5 ${
                      isPending ? 'border-amber-300' : 'border-stone-200'
                    }`}
                  >
                    {/* Candidate */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <PersonAvatar name={lead.name} photo={lead.photo} size="md" />
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-stone-900 truncate">
                            {lead.name || 'Unknown lead'}
                          </div>
                          <div className="text-[11px] text-stone-500">
                            {lead.phone} · {lead.village || '—'}, {lead.mandal || '—'}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full border text-[10px] font-bold shrink-0 ${
                          STATUS_TONES[esc.status] || STATUS_TONES.ReturnedToTelecaller
                        }`}
                      >
                        {esc.status === 'ReturnedToTelecaller'
                          ? 'Returned to telecaller'
                          : esc.status === 'Completed'
                          ? 'Resolved'
                          : 'Pending callback'}
                      </span>
                    </div>

                    {/* Telecaller handover */}
                    <div className="p-2.5 bg-stone-50 border border-stone-200 rounded-lg space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-stone-500">
                          Telecaller handover
                        </span>
                        {esc.call_recording_url ? (
                          <a
                            href={esc.call_recording_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-stone-200 text-[10px] font-bold text-[#2563EB] hover:bg-blue-50"
                          >
                            <PlayCircle className="w-3 h-3" />
                            Recording
                            {esc.call_duration ? ` · ${esc.call_duration}` : ''}
                          </a>
                        ) : (
                          <span className="text-[10px] text-stone-400">No recording</span>
                        )}
                      </div>

                      <p className="text-xs text-stone-700">
                        {esc.telecaller_note || 'No note left.'}
                      </p>
                      <div className="text-[10px] text-stone-400">
                        {esc.telecaller?.name || 'Unattributed'} · forwarded{' '}
                        {formatWhen(esc.forwarded_at)}
                        {esc.teamLeader?.name && <> · to {esc.teamLeader.name}</>}
                      </div>
                    </div>

                    {/* TL outcome */}
                    {esc.tl_note && (
                      <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-[#2563EB]">
                          Team leader outcome
                        </div>
                        <p className="text-xs text-stone-700">{esc.tl_note}</p>
                        <div className="text-[10px] text-stone-500">
                          {esc.tl_result && (
                            <span className="font-bold text-[#2563EB]">
                              Result: {esc.tl_result}
                            </span>
                          )}
                          {esc.completed_at && <> · {formatWhen(esc.completed_at)}</>}
                        </div>
                      </div>
                    )}

                    {isPending && (
                      <div className="flex items-center gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => setWorkspace(esc)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-xs font-bold text-amber-900 hover:bg-amber-100"
                        >
                          <Phone className="w-3.5 h-3.5" /> Open call workspace
                        </button>
                        <button
                          type="button"
                          onClick={() => setResolving({ esc, mode: 'Completed' })}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#2563EB] text-white text-xs font-bold hover:bg-[#1D4ED8]"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Resolve case
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setResolving({ esc, mode: 'ReturnedToTelecaller' })
                          }
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50"
                        >
                          <Undo2 className="w-3.5 h-3.5" /> Return with note
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Performance panel */}
        <div className="lg:col-span-4 space-y-3 lg:sticky lg:top-0 lg:self-start">
          <div className="bg-white rounded-lg border border-stone-200 p-2.5 shadow-2xs space-y-2.5">
            <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-stone-100 pb-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
              Team leader performance
            </h3>

            {leaderPerformance.length === 0 ? (
              <p className="text-[11px] text-stone-400 py-4 text-center">
                No escalations recorded yet.
              </p>
            ) : (
              <>
                {chartData.length > 1 && (
                  <div className="p-2 rounded-lg border border-blue-200 bg-linear-to-b from-blue-50/50 to-white">
                    <div className="text-[10px] font-bold text-stone-900 mb-1">
                      Cases handled
                    </div>
                    <div className="h-36 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={chartData}
                          margin={{ top: 5, right: 12, left: -24, bottom: 4 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#f1f5f9"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="name"
                            tick={<GraphXAxisPhotoTick data={chartData} />}
                            interval={0}
                            height={44}
                            tickLine={false}
                            axisLine={{ stroke: '#cbd5e1' }}
                          />
                          <YAxis
                            tick={{ fontSize: 9, fill: '#64748b' }}
                            tickLine={false}
                            axisLine={{ stroke: '#cbd5e1' }}
                            allowDecimals={false}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#0f172a',
                              borderColor: '#334155',
                              borderRadius: '0.5rem',
                              color: '#fff',
                              fontSize: '11px',
                            }}
                            formatter={(v) => [`${v} cases`, 'Handled']}
                          />
                          <Line
                            type="monotone"
                            dataKey="leads"
                            stroke="#2563eb"
                            strokeWidth={2.5}
                            dot={{ r: 3.5, fill: '#2563eb', stroke: '#fff', strokeWidth: 1.5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  {leaderPerformance.map((p) => (
                    <div
                      key={p.id}
                      className="p-2 rounded-lg border border-stone-200 bg-stone-50/60 space-y-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <PersonAvatar name={p.name} photo={p.photo} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-bold text-stone-900 truncate">
                            {p.name}
                          </div>
                          <div className="text-[10px] text-stone-500">
                            {p.pending} pending · {p.resolved} resolved · {p.returned}{' '}
                            returned
                          </div>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-700 shrink-0">
                          {p.resolutionRate}%
                        </span>
                      </div>
                      <div className="w-full bg-stone-200 rounded-full h-1 overflow-hidden">
                        <div
                          className="bg-emerald-600 h-1 rounded-full transition-all"
                          style={{ width: `${p.resolutionRate}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {resolving && (
        <ResolveModal
          escalation={resolving.esc}
          mode={resolving.mode}
          onClose={() => setResolving(null)}
          onDone={() => {
            load();
            refresh?.();
          }}
        />
      )}

      {workspace && (
        <TeamLeaderCallModal
          escalation={workspace}
          onClose={() => setWorkspace(null)}
          onDone={() => {
            load();
            refresh?.();
          }}
        />
      )}
    </div>
  );
}

/* ── Local pieces ─────────────────────────────────────────────── */

const KPI_TONES = {
  amber: 'bg-amber-50 border-amber-200 text-amber-900',
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  stone: 'bg-stone-50 border-stone-200 text-stone-800',
  blue: 'bg-blue-50 border-blue-200 text-blue-900',
};

function Kpi({ label, sub, value, icon: Icon, tone }) {
  return (
    <div className={`p-2.5 rounded-lg border ${KPI_TONES[tone]}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide opacity-80">
          {label}
        </span>
        <Icon className="w-3.5 h-3.5 opacity-70" />
      </div>
      <div className="text-xl font-black mt-1 leading-none">{value}</div>
      <div className="text-[11px] opacity-70 mt-0.5">{sub}</div>
    </div>
  );
}

function ResolveModal({ escalation, mode, onClose, onDone }) {
  const [note, setNote] = useState('');
  const [result, setResult] = useState(mode === 'Completed' ? 'Proceed' : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const isResolve = mode === 'Completed';

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await agentLeadService.resolveEscalation(escalation.id, {
        status: mode,
        tlNote: note.trim() || undefined,
        tlResult: isResolve ? result : undefined,
      });
      onDone?.();
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not close this case.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isResolve ? 'Resolve case' : 'Return to telecaller'}
      subtitle={escalation.candidate?.name}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-bold hover:bg-[#1D4ED8] disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isResolve ? 'Resolve' : 'Return'}
          </button>
        </>
      }
    >
      <ModalError>{error}</ModalError>

      {isResolve && (
        <Field
          label="Outcome"
          htmlFor="tl-result"
          hint="Choosing Proceed moves the lead into Interested."
        >
          <select
            id="tl-result"
            value={result}
            onChange={(e) => setResult(e.target.value)}
            className={inputClass}
          >
            <option value="Proceed">Proceed — interested</option>
            <option value="Not Interested">Not interested</option>
            <option value="Follow Up">Needs another follow-up</option>
            <option value="Divert">Divert — wrong department</option>
          </select>
        </Field>
      )}

      <Field
        label={isResolve ? 'Team leader note' : 'What should the telecaller do?'}
        htmlFor="tl-note"
      >
        <textarea
          id="tl-note"
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            isResolve ? 'What did you agree with them?' : 'Instructions for the telecaller'
          }
          className={`${inputClass} resize-y`}
        />
      </Field>
    </Modal>
  );
}
