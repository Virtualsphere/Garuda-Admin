import { createContext, useContext } from 'react';

/**
 * The recruitment desk's shared state — squads, the change `version`, and the
 * `callLead` / `openLead` actions. The provider that fills it lives in
 * components/Agents/Recruitment/RecruitmentDesk.jsx; the context and hook are
 * kept here so that file can export nothing but its component.
 */
export const RecruitmentDeskContext = createContext(null);

export function useRecruitmentDesk() {
  const ctx = useContext(RecruitmentDeskContext);
  if (!ctx) throw new Error('useRecruitmentDesk must be used inside a RecruitmentDeskProvider');
  return ctx;
}

export default useRecruitmentDesk;
