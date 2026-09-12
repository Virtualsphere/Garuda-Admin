import { useState, useMemo } from 'react';
import {
  Users,
  UserCheck,
  FileCheck,
  MapPinned,
  Car,
  TrendingUp,
  Loader2,
} from 'lucide-react';

import AgentsDirectoryTab from '../subsections/AgentsDirectoryTab';
import AgentReportsTab from '../subsections/AgentReportsTab';
import ObservationsTab from './ObservationsTab';
import TeamsSquadsTab from './TeamsSquadsTab';
import AfterOnboardingTab from './AfterOnboardingTab';
import AgentAttachLandMap from '../maps/AgentAttachLandMap';
import useAgentRecruitmentMap from '../../../hooks/useAgentRecruitmentMap';
import useAgentTeams from '../../../hooks/useAgentTeams';

/**
 * Coordination mode: everything that happens *after* somebody becomes an
 * agent — the squads that look after them, their profile, their paperwork,
 * the land they are attached to, and what they are watching.
 *
 * Recruitment (Leads → Onboarding) is the other half and lives in its own
 * mode; nothing here touches a candidate.
 */
const SUB_TABS = [
  { key: 'teams', label: 'Teams & Hierarchy (Squads)', icon: Users },
  { key: 'agents-list', label: 'Agent Profiles & Directory', icon: UserCheck },
  { key: 'after-onboarding', label: 'After Onboarding', icon: FileCheck },
  { key: 'lands', label: 'Mapped Lands & Survey Details', icon: MapPinned },
  { key: 'visits', label: 'Site Visits & Observations', icon: Car },
  { key: 'reporting', label: 'Performance & Reporting', icon: TrendingUp },
];

export default function CoordinationSection({
  agents = [],
  agentsLoading,
  refreshAgents,
  onOpenAgent,
  refresh,
}) {
  const [subTab, setSubTab] = useState('agents-list');
  const [landsAgent, setLandsAgent] = useState(null);

  const { teams, employeeById, loading: teamsLoading } = useAgentTeams();
  const { nodes, loading: mapLoading } = useAgentRecruitmentMap({});

  const metrics = useMemo(() => {
    const active = agents.filter((a) => a.status === 'ACTIVE').length;
    const onboarded = agents.filter((a) => a.onboarding_completed_at).length;
    const supportPool = teams.reduce((sum, t) => sum + (t.memberIds?.length || 0), 0);
    const villagesCovered = nodes.filter((n) => n.deployedAgents > 0).length;

    return {
      active,
      onboarded,
      teams: teams.length,
      supportPool,
      mappedLands: nodes.reduce((s, n) => s + (Number(n.land_count) || 0), 0),
      linkedLands: nodes.reduce((s, n) => s + (Number(n.linked_land_count) || 0), 0),
      villages: nodes.length,
      villagesCovered,
      coverage: nodes.length
        ? Math.round((villagesCovered / nodes.length) * 100)
        : 0,
    };
  }, [agents, teams, nodes]);

  const directoryProps = {
    agents,
    agentsLoading,
    refreshAgents: refreshAgents || refresh,
    onOpenAgent,
  };

  const busy = agentsLoading || teamsLoading || mapLoading;

  return (
    <div className="space-y-3">
      {/* Metrics band */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Metric
          label="Active agents"
          value={metrics.active}
          sub={`${metrics.onboarded} fully onboarded`}
          tone="blue"
          busy={busy}
        />
        <Metric
          label="Coordination teams"
          value={metrics.teams}
          sub={`${metrics.supportPool} in the support pool`}
          tone="purple"
          busy={busy}
        />
        <Metric
          label="Mapped lands"
          value={metrics.mappedLands}
          sub={`${metrics.linkedLands} linked to an agent`}
          tone="emerald"
          busy={busy}
        />
        <Metric
          label="Territorial villages"
          value={metrics.villages}
          sub={`${metrics.coverage}% have an agent`}
          tone="amber"
          busy={busy}
        />
      </div>

      {/* Subtabs */}
      <div className="flex border-b border-stone-200 gap-1 text-xs overflow-x-auto">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setSubTab(tab.key);
                setLandsAgent(null);
              }}
              className={`py-2 px-3.5 font-medium transition-colors border-b-2 inline-flex items-center gap-1.5 shrink-0 ${
                subTab === tab.key
                  ? 'border-[#2563EB] text-[#2563EB] font-bold'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {subTab === 'teams' && (
        <TeamsSquadsTab
          teams={teams}
          employeeById={employeeById}
          agents={agents}
          loading={teamsLoading}
        />
      )}

      {subTab === 'agents-list' && <AgentsDirectoryTab {...directoryProps} />}

      {subTab === 'after-onboarding' && (
        <AfterOnboardingTab
          agents={agents}
          loading={agentsLoading}
          refreshAgents={refreshAgents || refresh}
          onOpenAgent={onOpenAgent}
        />
      )}

      {subTab === 'lands' && (
        <div className="space-y-3">
          <div className="bg-white border border-stone-200 rounded-lg p-2.5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-stone-700">
              Land workspace for:
            </span>
            <select
              value={landsAgent?.id || ''}
              onChange={(e) => {
                const found = agents.find((a) => String(a.id) === String(e.target.value));
                setLandsAgent(found || null);
              }}
              className="text-xs bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 font-medium text-stone-700"
            >
              <option value="">Pick an agent…</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} — {agent.village || 'Unassigned'}
                </option>
              ))}
            </select>
            <span className="text-xs text-stone-500 ml-auto">
              Attach parcels and assign observations on the map.
            </span>
          </div>

          {landsAgent ? (
            <AgentAttachLandMap agent={landsAgent} onClose={() => setLandsAgent(null)} />
          ) : (
            <div className="bg-white border border-stone-200 rounded-lg py-14 text-center text-xs text-stone-400">
              Pick an agent to open their land map.
            </div>
          )}
        </div>
      )}

      {subTab === 'visits' && <ObservationsTab agents={agents} />}
      {subTab === 'reporting' && <AgentReportsTab agents={agents} />}
    </div>
  );
}

/* ── Local pieces ─────────────────────────────────────────────── */

const METRIC_TONES = {
  blue: 'bg-blue-50 border-blue-200 text-blue-900',
  purple: 'bg-purple-50 border-purple-200 text-purple-900',
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  amber: 'bg-amber-50 border-amber-200 text-amber-900',
};

function Metric({ label, value, sub, tone, busy }) {
  return (
    <div className={`p-2.5 rounded-lg border ${METRIC_TONES[tone]}`}>
      <div className="text-[11px] font-bold uppercase tracking-wide opacity-80">
        {label}
      </div>
      <div className="text-xl font-black mt-1 leading-none flex items-center gap-2">
        {busy ? <Loader2 className="w-4 h-4 animate-spin opacity-60" /> : value}
      </div>
      <div className="text-[11px] opacity-70 mt-0.5">{sub}</div>
    </div>
  );
}
