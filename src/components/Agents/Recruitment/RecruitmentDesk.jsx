import { useCallback, useMemo, useState } from 'react';

import useAgentTeams from '../../../hooks/useAgentTeams';
import { RecruitmentDeskContext } from '../../../hooks/useRecruitmentDesk';
import CallWorkspaceModal from './CallWorkspaceModal';
import LeadDrawer from './LeadDrawer';

/**
 * What every recruitment tab shares, so no tab has to fetch or mount it alone:
 *
 * - the squads and the people in them, loaded once for the whole desk;
 * - the **one** call workspace and the **one** lead drawer, opened by any row
 *   with `callLead(lead)` / `openLead(lead)`;
 * - a change `version`. Any write calls `notifyChanged()`, which bumps it, and
 *   every mounted tab reloads from it — so a call logged in the popup is
 *   reflected in the queue behind it without the popup knowing which tab that is.
 *
 * Mounted around the Recruitment wing only. Leaving for Management and coming
 * back remounts it, which is when a crew reshuffle made over there is picked up.
 */
export default function RecruitmentDeskProvider({ agents = [], onOpenAgent, onChanged, children }) {
  const roster = useAgentTeams();

  const [version, setVersion] = useState(0);
  const [callTarget, setCallTarget] = useState(null);
  const [drawerLead, setDrawerLead] = useState(null);

  const notifyChanged = useCallback(() => {
    setVersion((v) => v + 1);
    onChanged?.();
  }, [onChanged]);

  // `options.callerEmployeeId` lets the recovery hub credit a dial to the
  // support executive at the keyboard rather than the shared login.
  const callLead = useCallback((lead, queue = 'first-call', options = {}) => {
    setCallTarget({ lead, queue, options });
  }, []);

  const openLead = useCallback((lead) => setDrawerLead(lead), []);

  // Agents are owned by the section shell (its profile drawer lives there), so
  // the desk only forwards the roster and the "open this agent" action.
  const openAgent = useCallback((agent) => onOpenAgent?.(agent), [onOpenAgent]);

  const value = useMemo(
    () => ({
      agents,
      openAgent,
      teams: roster.teams,
      employees: roster.employees,
      employeeById: roster.employeeById,
      rosterLoading: roster.loading,
      rosterError: roster.error,
      refreshRoster: roster.refresh,
      version,
      notifyChanged,
      callLead,
      openLead,
    }),
    [
      agents,
      openAgent,
      roster.teams,
      roster.employees,
      roster.employeeById,
      roster.loading,
      roster.error,
      roster.refresh,
      version,
      notifyChanged,
      callLead,
      openLead,
    ]
  );

  return (
    <RecruitmentDeskContext.Provider value={value}>
      {children}

      {drawerLead && (
        <LeadDrawer
          lead={drawerLead}
          employeeById={roster.employeeById}
          version={version}
          onClose={() => setDrawerLead(null)}
          onCall={(lead) => callLead(lead)}
          onChanged={notifyChanged}
        />
      )}

      {callTarget && (
        <CallWorkspaceModal
          lead={callTarget.lead.raw}
          queue={callTarget.queue}
          options={callTarget.options}
          onClose={() => setCallTarget(null)}
          onDone={notifyChanged}
        />
      )}
    </RecruitmentDeskContext.Provider>
  );
}
