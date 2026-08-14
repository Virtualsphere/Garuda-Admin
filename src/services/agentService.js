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
};

export default agentService;
