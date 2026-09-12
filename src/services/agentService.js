import apiClient from './apiClient';

const agentService = {
  /**
   * Get a flat list of individual agents (optionally filtered by location/search)
   */
  async getAll(filters = {}) {
    const { data } = await apiClient.get('/fieldwork/agent/list', { params: filters });
    return data;
  },

  /**
   * Get aggregated agent counts per mandal (capacity view)
   */
  async getByLocation(filters = {}) {
    const { data } = await apiClient.get('/fieldwork/agents', { params: filters });
    return data;
  },

  async create(agentData) {
    const { data } = await apiClient.post('/fieldwork/agent', agentData);
    return data;
  },

  async update(id, agentData) {
    const { data } = await apiClient.put(`/fieldwork/agent/${id}`, agentData);
    return data;
  },

  async delete(id) {
    const { data } = await apiClient.delete(`/fieldwork/agent/${id}`);
    return data;
  },

  /**
   * Get lands linked to an agent
   */
  async getLinkedLands(agentId) {
    const { data } = await apiClient.get(`/land/by-agent/${agentId}`);
    return data;
  },

  /**
   * Link a land record to an agent
   */
  async linkLand(landId, agentId) {
    const { data } = await apiClient.put(`/land/link-agent/${landId}`, { agentId });
    return data;
  },

  /**
   * Village nodes for the tactical map: coordinates, land aggregates and the
   * agents deployed on each node. Villages with no agent are included so they
   * can be shown as recruitment targets.
   */
  async getMapNodes(filters = {}) {
    const { data } = await apiClient.get('/fieldwork/agent/map-nodes', { params: filters });
    return data;
  },

  /**
   * Land nodes for the allotment map. Pass agentId to have each node flagged
   * as linked/observed by that agent and inside/outside their territory.
   */
  async getLandNodes(filters = {}) {
    const { data } = await apiClient.get('/fieldwork/agent/land-nodes', { params: filters });
    return data;
  },

  /**
   * Village nodes an agent is deployed to
   */
  async getTerritory(agentId) {
    const { data } = await apiClient.get(`/fieldwork/agent/${agentId}/territory`);
    return data;
  },

  /**
   * Replace an agent's deployed village nodes.
   * villages: [{ state, district, mandal, village }]
   */
  async setTerritory(agentId, villages) {
    const { data } = await apiClient.put(`/fieldwork/agent/${agentId}/territory`, { villages });
    return data;
  },

  /**
   * Attach an agent to a land parcel as an observer (secondary link)
   */
  async addObservation(landId, agentId) {
    const { data } = await apiClient.post('/fieldwork/agent-observation', { landId, agentId });
    return data;
  },

  async removeObservation(landId, agentId) {
    const { data } = await apiClient.delete('/fieldwork/agent-observation', {
      data: { landId, agentId },
    });
    return data;
  },
};

export default agentService;
