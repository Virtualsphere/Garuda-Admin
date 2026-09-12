import { useState, useEffect, useCallback } from 'react';
import { UsersRound } from 'lucide-react';

import agentLeadService from '../../services/agentLeadService';
import agentService from '../../services/agentService';

import LeadsTab from './Recruitment/LeadsTab';
import AllotLeadsTab from './Recruitment/AllotLeadsTab';
import CallsTab from './Recruitment/CallsTab';
import TeamLeaderTab from './Recruitment/TeamLeaderTab';
import InterestedTab from './Recruitment/InterestedTab';
import OnboardingTab from './Recruitment/OnboardingTab';
import CoordinationSection from './coordination/CoordinationSection';
import ManagementSection from './management/ManagementSection';
import AgentProfileDrawer from './AgentProfileDrawer';

/**
 * Root of the Agents department, rebuilt to match the Garuda prototype's
 * information architecture: three modes, with Recruitment carrying six working
 * queues across the top.
 *
 * This subtree is styled with Tailwind rather than the app's per-section CSS
 * variables — see src/styles/agents-tailwind.css. `.garuda-agents` is what
 * scopes that stylesheet, so every tab must render inside this wrapper.
 *
 * Queue counts come from one server endpoint rather than being recomputed per
 * tab, so the badges and the tab contents can never disagree.
 */

const RECRUITMENT_TABS = [
  { key: 'leads', label: 'Leads' },
  { key: 'allot-leads', label: 'Allot Leads', badge: 'unallotted', tone: 'blue' },
  { key: 'calls', label: 'Calls', badge: 'calls', tone: 'blue' },
  { key: 'team-leader', label: 'Team Leader', badge: 'team-leader', tone: 'amber' },
  { key: 'interested', label: 'Interested', badge: 'interested', tone: 'stone' },
  { key: 'onboarding', label: 'Onboarding', badge: 'onboarding', tone: 'emerald' },
];

const BADGE_TONES = {
  blue: 'bg-blue-100 text-[#2563EB] border border-blue-200',
  amber: 'bg-amber-100 text-amber-900 border border-amber-300',
  emerald: 'bg-emerald-100 text-emerald-800',
  stone: 'bg-stone-100 text-stone-700',
  idle: 'bg-stone-100 text-stone-600',
};

export default function AgentsModule({ activeTab = 'recruitment' }) {
  const [agentOpsTab, setAgentOpsTab] = useState('leads');
  const [counts, setCounts] = useState({});
  const [agents, setAgents] = useState([]);
  const [profileAgent, setProfileAgent] = useState(null);

  const loadCounts = useCallback(async () => {
    try {
      const data = await agentLeadService.getQueueCounts();
      setCounts(data.result || data.data || {});
    } catch (err) {
      // Badges are decoration; a failure here must not blank the section.
      console.error('Failed to load queue counts:', err);
      setCounts({});
    }
  }, []);

  const loadAgents = useCallback(async () => {
    try {
      const data = await agentService.getAll();
      const list = data.result || data.data || [];
      setAgents(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to load agents:', err);
      setAgents([]);
    }
  }, []);

  useEffect(() => {
    loadCounts();
    loadAgents();
  }, [loadCounts, loadAgents]);

  // The queues shift on every write, so each tab reports back rather than
  // owning its own copy of the counts.
  const refresh = useCallback(() => {
    loadCounts();
  }, [loadCounts]);

  const badgeFor = (tab) => {
    if (!tab.badge) return null;
    const value =
      tab.badge === 'calls'
        ? (counts['first-call'] || 0) + (counts['follow-up'] || 0) + (counts['not-lifted'] || 0)
        : counts[tab.badge] || 0;

    const tone = value > 0 ? BADGE_TONES[tab.tone] : BADGE_TONES.idle;
    return (
      <span className={`px-1.5 rounded-full text-[10px] font-bold ${tone}`}>{value}</span>
    );
  };

  const shared = {
    agents,
    counts,
    refresh,
    onOpenAgent: setProfileAgent,
    onNavigate: setAgentOpsTab,
  };

  return (
    <div className="garuda-agents p-4 space-y-4">
      {/* Department header */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-stone-200 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-[11px] bg-[#EFF6FF] text-[#2563EB] border border-[#2563EB]/20 flex items-center justify-center shrink-0">
            <UsersRound className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-base font-bold text-stone-900 tracking-tight">
              Agents Department
            </h1>
            <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
          </div>
        </div>

        <span className="text-xs text-stone-500 font-medium">
          {counts.total ?? 0} active leads · {agents.length} agents on the roster
        </span>
      </div>

      {/* ── RECRUITMENT ─────────────────────────────────────── */}
      {activeTab === 'recruitment' && (
        <div className="space-y-3">
          <div className="flex border-b border-stone-200 gap-1 text-xs overflow-x-auto">
            {RECRUITMENT_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setAgentOpsTab(tab.key)}
                className={`py-2 px-3.5 font-medium transition-colors border-b-2 flex items-center gap-1.5 shrink-0 ${
                  agentOpsTab === tab.key
                    ? 'border-[#2563EB] text-[#2563EB] font-bold'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                {tab.label}
                {badgeFor(tab)}
              </button>
            ))}
          </div>

          {agentOpsTab === 'leads' && <LeadsTab {...shared} />}
          {agentOpsTab === 'allot-leads' && <AllotLeadsTab {...shared} />}
          {agentOpsTab === 'calls' && <CallsTab {...shared} />}
          {agentOpsTab === 'team-leader' && <TeamLeaderTab {...shared} />}
          {agentOpsTab === 'interested' && <InterestedTab {...shared} />}
          {agentOpsTab === 'onboarding' && <OnboardingTab {...shared} />}
        </div>
      )}

      {/* ── COORDINATION ────────────────────────────────────── */}
      {activeTab === 'coordination' && <CoordinationSection {...shared} />}

      {/* ── MANAGEMENT ──────────────────────────────────────── */}
      {activeTab === 'management' && <ManagementSection {...shared} />}

      {profileAgent && (
        <AgentProfileDrawer
          agent={profileAgent}
          onClose={() => setProfileAgent(null)}
          onChanged={() => {
            loadAgents();
            refresh();
          }}
        />
      )}
    </div>
  );
}
