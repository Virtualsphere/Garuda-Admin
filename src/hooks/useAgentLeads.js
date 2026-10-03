import { useState, useEffect, useCallback, useMemo } from 'react';

import agentLeadService from '../services/agentLeadService';
import { useRecruitmentDesk } from './useRecruitmentDesk';
import { normaliseLead } from '../components/Agents/Recruitment/recruitmentModel';

/**
 * The recruitment desk's leads, fetched and normalised.
 *
 * `pool` picks which set the server returns:
 *   (none)     every active lead — Leads, Allot Leads, Calls
 *   'recovery' leads that could not be reached, with their WhatsApp trail
 *   'dumped'   the dumped archive
 *
 * It reloads whenever the desk's change `version` moves, which is how a call
 * logged in the popup — or an attach made on another tab — shows up here without
 * this tab being told about it. Writers therefore only ever call
 * `notifyChanged()`; there is no second reload to remember.
 */
export default function useAgentLeads({ pool } = {}) {
  const { employeeById, version } = useRecruitmentDesk();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data =
        pool === 'recovery'
          ? await agentLeadService.getRecoveryLeads()
          : pool === 'dumped'
          ? await agentLeadService.getDumpedLeads()
          : await agentLeadService.getLeads({});

      const list = data.result || data.data || [];
      setRows(Array.isArray(list) ? list : []);
      setError(null);
    } catch (err) {
      console.error('Failed to load leads:', err);
      setRows([]);
      setError('Could not load leads.');
    } finally {
      setLoading(false);
    }
  }, [pool]);

  useEffect(() => {
    load();
  }, [load, version]);

  // Names of people a row only references by id come from the roster, which may
  // arrive after the leads; normalising here means they fill in when it does.
  const leads = useMemo(
    () => rows.map((row) => normaliseLead(row, employeeById)),
    [rows, employeeById]
  );

  return { leads, loading, error, reload: load };
}
