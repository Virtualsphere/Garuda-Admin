import { useState } from 'react';
import {
  Users,
  IdCard,
  Network,
  CalendarCheck,
  IndianRupee,
  TrendingUp,
  PhoneCall,
} from 'lucide-react';

import CrewCadresTab from './CrewCadresTab';
import AgentHierarchyTab from '../subsections/AgentHierarchyTab';
import AgentFinanceTab from '../subsections/AgentFinanceTab';
import AgentCallsTab from '../subsections/AgentCallsTab';
import TelecallerPerformanceTab from './TelecallerPerformanceTab';
import AttendanceTab from './AttendanceTab';
import PersonalPageTab from './PersonalPageTab';

/**
 * Management mode: the department itself rather than its pipeline — who staffs
 * it, how they are ranked, whether they turned up, and what the desk spends.
 */
const SUB_TABS = [
  { key: 'crew', label: 'Personnel & Cadres', icon: Users },
  { key: 'hierarchy', label: 'Hierarchy & Teams', icon: Network },
  { key: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { key: 'personal', label: 'Employee Personal Page', icon: IdCard },
  { key: 'performance', label: 'Telecaller Performance', icon: TrendingUp },
  { key: 'myoperator', label: 'Call Traffic', icon: PhoneCall },
  { key: 'budget', label: 'Budget', icon: IndianRupee },
];

export default function ManagementSection({ agents }) {
  const [subTab, setSubTab] = useState('crew');

  return (
    <div className="space-y-3">
      <div className="flex border-b border-stone-200 gap-1 text-xs overflow-x-auto">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSubTab(tab.key)}
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

      {subTab === 'crew' && <CrewCadresTab />}
      {subTab === 'hierarchy' && <AgentHierarchyTab />}
      {subTab === 'attendance' && <AttendanceTab />}
      {subTab === 'personal' && <PersonalPageTab />}
      {subTab === 'performance' && <TelecallerPerformanceTab />}
      {subTab === 'myoperator' && <AgentCallsTab agents={agents} />}
      {subTab === 'budget' && <AgentFinanceTab agents={agents} />}
    </div>
  );
}
