export const TIER_RANK = { head: 3, team_leader: 2, executive: 1 };

export function computeTier(tree, employeeId) {
  if (!employeeId) return 'executive';
  const id = Number(employeeId);
  const isEmployee = tree.some((row) => Number(row.employee_id) === id);
  const isLeader = tree.some((row) => Number(row.leader_id) === id);
  if (isLeader && !isEmployee) return 'head';
  if (isLeader && isEmployee) return 'team_leader';
  return 'executive';
}

export function isTierEnabled(tab, userTier) {
  return TIER_RANK[tab] <= TIER_RANK[userTier];
}
