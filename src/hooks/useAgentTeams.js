import { useState, useEffect, useCallback, useMemo } from 'react';
import departmentLeaderService from '../services/departmentLeaderService';
import employeeService from '../services/employeeService';

/**
 * The agents desk has two separate wings, and an employee can hold a place in
 * each: recruitment (telecalling squads that work leads) and coordination
 * (squads that look after appointed agents). `department_leaders` is keyed on
 * (employee, department_type), so one department type per wing gives each its
 * own squad membership without a second table.
 */
export const WING_DEPARTMENTS = {
  recruitment: 'agents',
  coordination: 'agents_coordination',
};

/**
 * The squads of one wing, derived from the department-leader tree rather than
 * stored as their own entity.
 *
 * A "team" here is one team leader plus everyone allotted to them — which is
 * exactly what `department_leaders` already records. Introducing a separate
 * teams table would give the same information a second home and let the two
 * drift apart.
 *
 * Returns `[]` (not an error) when nobody has been allotted yet, so the page
 * renders with no squads rather than breaking.
 */
export default function useAgentTeams(wing = 'recruitment') {
  const departmentType = WING_DEPARTMENTS[wing] || WING_DEPARTMENTS.recruitment;

  const [tree, setTree] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Employees are needed for leader names and photos; the tree is the
    // membership. Either failing alone should not blank the other.
    const [treeResult, employeeResult] = await Promise.allSettled([
      departmentLeaderService.getTree(departmentType),
      employeeService.getAll(),
    ]);

    if (treeResult.status === 'fulfilled') {
      const data = treeResult.value;
      const rows = data.data || data.result || [];
      setTree(Array.isArray(rows) ? rows : []);
      setError(null);
    } else {
      console.error('Failed to load department tree:', treeResult.reason);
      setTree([]);
      setError('Could not load squads for this wing.');
    }

    if (employeeResult.status === 'fulfilled') {
      const data = employeeResult.value;
      const list = data.data || data.employees || data.result || [];
      setEmployees(Array.isArray(list) ? list : []);
    }

    setLoading(false);
  }, [departmentType]);

  useEffect(() => {
    load();
  }, [load]);

  const employeeById = useMemo(() => {
    const map = new Map();
    employees.forEach((emp) => map.set(String(emp.id), emp));
    return map;
  }, [employees]);

  const teams = useMemo(() => {
    const byLeader = new Map();

    tree.forEach((row) => {
      const leaderId = String(row.leader_id);
      if (!leaderId || leaderId === 'null') return;
      if (!byLeader.has(leaderId)) byLeader.set(leaderId, []);
      if (row.employee_id) byLeader.get(leaderId).push(String(row.employee_id));
    });

    return [...byLeader.entries()].map(([leaderId, memberIds], index) => {
      const leader = employeeById.get(leaderId);
      const leaderName = leader?.name || `Team leader #${leaderId}`;

      return {
        id: leaderId,
        // The prototype names squads after their leader; there is no stored
        // team name to read, so it is composed the same way.
        name: `Squad ${index + 1} — ${leaderName.split(' ')[0]}`,
        shortName: `T${index + 1}`,
        department: 'Agents',
        wing,
        departmentType,
        teamLeaderId: leaderId,
        teamLeaderName: leaderName,
        teamLeaderPhoto: leader?.photo || null,
        teamLeader: leader || null,
        memberIds,
        members: memberIds.map((id) => employeeById.get(id)).filter(Boolean),
      };
    });
  }, [tree, employeeById, wing, departmentType]);

  /** Move an employee into a squad — or out of the wing when `null`. */
  const moveToTeam = useCallback(
    async (employeeId, leaderId) => {
      if (leaderId === null) {
        await departmentLeaderService.removeAllotment(Number(employeeId), departmentType);
      } else {
        await departmentLeaderService.setAllotment(
          Number(employeeId),
          Number(leaderId),
          departmentType
        );
      }
      await load();
    },
    [departmentType, load]
  );

  return {
    teams,
    employees,
    employeeById,
    departmentType,
    loading,
    error,
    refresh: load,
    moveToTeam,
  };
}
