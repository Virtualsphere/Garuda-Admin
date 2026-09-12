import apiClient from './apiClient';

/**
 * The coordination wing's workload: which executive looks after which agents.
 *
 * The wing is sized at 500 agents per executive, and the server enforces that
 * — `assign` rejects with 409 rather than quietly overloading somebody. Pass
 * allowOverQuota only when the desk has explicitly decided to.
 */
const agentCoordinationService = {
  /** `{ counts: { [executiveId]: n }, unassigned, assigned, total }`. */
  async getLoad() {
    const { data } = await apiClient.get('/agent-coordination/load');
    return data;
  },

  /** `executiveId: null` returns the agents to the unassigned pool. */
  async assign({ agentIds, executiveId, allowOverQuota }) {
    const { data } = await apiClient.put('/agent-coordination/assign', {
      agentIds,
      executiveId,
      allowOverQuota,
    });
    return data;
  },
};

export default agentCoordinationService;
