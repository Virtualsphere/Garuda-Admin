import { useState, useEffect, useCallback } from 'react';
import { UsersRound } from 'lucide-react';

import agentLeadService from '../../services/agentLeadService';
import agentService from '../../services/agentService';

import RecruitmentDeskProvider from './Recruitment/RecruitmentDesk';
import LeadsTab from './Recruitment/LeadsTab';
import AllotLeadsTab from './Recruitment/AllotLeadsTab';
import CallsTab from './Recruitment/CallsTab';
import NotLiftedInvalidTab from './Recruitment/NotLiftedInvalidTab';
import TeamLeaderTab from './Recruitment/TeamLeaderTab';
import InterestedTab from './Recruitment/InterestedTab';
import OnboardingTab from './Recruitment/OnboardingTab';
import ReportsTab from './Recruitment/ReportsTab';
import CoordinationSection from './coordination/CoordinationSection';
import ManagementSection from './management/ManagementSection';
import AgentProfileDrawer from './AgentProfileDrawer';

/**
 * Root of the Agents department, rebuilt to match the Garuda prototype's
 * information architecture: three modes, with Recruitment carrying eight tabs
 * across the top — seven working queues and the Reports page.
 *
 * This subtree is styled with Tailwind rather than the app's per-section CSS
 * variables — see src/styles/agents-tailwind.css. `.garuda-agents` is what
 * scopes that stylesheet, so every tab must render inside this wrapper.
 *
 * Queue counts come from one server endpoint rather than being recomputed per
 * tab, so the badges and the tab contents can never disagree.
 */

// `badge` names the /queue-counts key a tab shows. `always` tabs keep their tone
// at zero; the rest go neutral when their queue is empty, which is how the
// prototype signals "nothing waiting here".
const RECRUITMENT_TABS = [
  { key: 'leads', label: 'Leads' },
  { key: 'allot-leads', label: 'Allot Leads', badge: 'unallotted', tone: 'blue' },
  { key: 'calls', label: 'Calls', badge: 'calls', tone: 'blue', always: true },
  { key: 'not-lifted-invalid', label: 'Not Lifted & Invalid', badge: 'not-lifted-invalid', tone: 'amber' },
  { key: 'team-leader', label: 'Team Leader', badge: 'team-leader', tone: 'amber' },
  { key: 'interested', label: 'Interested', badge: 'interested', tone: 'stone', always: true },
  { key: 'onboarding', label: 'Onboarding', badge: 'onboarding', tone: 'emerald', always: true },
  { key: 'reporting', label: 'Reports', tone: 'report' },
];

const BADGE_TONES = {
  blue: 'bg-blue-100 text-[#2563EB] border border-blue-200 font-bold',
  amber: 'bg-amber-100 text-amber-900 border border-amber-300 font-bold',
  emerald: 'bg-emerald-100 text-emerald-800 font-bold',
  stone: 'bg-stone-100 text-stone-700',
  report: 'bg-blue-50 text-blue-700 border border-blue-200 font-bold',
  idle: 'bg-stone-100 text-stone-600 font-bold',
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
    // Reports is a page, not a queue: its pill is a label rather than a count.
    if (tab.tone === 'report') {
      return (
        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${BADGE_TONES.report}`}>
          Working Reports
        </span>
      );
    }
    if (!tab.badge) return null;

    const value =
      tab.badge === 'calls'
        ? (counts['first-call'] || 0) + (counts['follow-up'] || 0) + (counts['not-lifted'] || 0)
        : counts[tab.badge] || 0;

    const tone = value > 0 || tab.always ? BADGE_TONES[tab.tone] : BADGE_TONES.idle;
    return (
      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${tone}`}>{value}</span>
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
        <RecruitmentDeskProvider agents={agents} onOpenAgent={setProfileAgent} onChanged={refresh}>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between border-b border-stone-200 gap-2 text-xs pb-1 sm:pb-0">
              <div className="flex gap-1 overflow-x-auto">
                {RECRUITMENT_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setAgentOpsTab(tab.key)}
                    className={`py-2 px-3.5 font-medium transition-colors border-b-2 flex items-center gap-1.5 shrink-0 cursor-pointer ${
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
            </div>

            {agentOpsTab === 'leads' && <LeadsTab />}
            {agentOpsTab === 'allot-leads' && <AllotLeadsTab />}
            {agentOpsTab === 'calls' && <CallsTab />}
            {agentOpsTab === 'not-lifted-invalid' && <NotLiftedInvalidTab onNavigate={setAgentOpsTab} />}
            {agentOpsTab === 'team-leader' && <TeamLeaderTab {...shared} />}
            {agentOpsTab === 'interested' && <InterestedTab {...shared} />}
            {agentOpsTab === 'onboarding' && <OnboardingTab {...shared} />}
            {agentOpsTab === 'reporting' && <ReportsTab />}
          </div>
        </RecruitmentDeskProvider>
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
