import apiClient from './apiClient';

/**
 * Inbound enquiries handled by the agents desk — somebody ringing in to ask
 * about becoming an agent, a village vacancy, or support on a posting.
 *
 * An enquiry is not yet a recruitment candidate: `convert` is what promotes
 * one into the pipeline, and the server refuses to convert a caller who is
 * already an appointed agent (409).
 */
const agentEnquiryService = {
  async getAll(filters = {}) {
    const { data } = await apiClient.get('/agent-enquiry', { params: filters });
    return data;
  },

  async getById(id) {
    const { data } = await apiClient.get(`/agent-enquiry/${id}`);
    return data;
  },

  async create(enquiryData) {
    const { data } = await apiClient.post('/agent-enquiry', enquiryData);
    return data;
  },

  async update(id, enquiryData) {
    const { data } = await apiClient.put(`/agent-enquiry/${id}`, enquiryData);
    return data;
  },

  async updateStatus(id, status, notes) {
    const { data } = await apiClient.put(`/agent-enquiry/${id}/status`, { status, notes });
    return data;
  },

  /** Promotes an enquiry into the recruitment pipeline. Idempotent server-side. */
  async convert(id) {
    const { data } = await apiClient.post(`/agent-enquiry/${id}/convert`);
    return data;
  },

  async delete(id) {
    const { data } = await apiClient.delete(`/agent-enquiry/${id}`);
    return data;
  },

  /**
   * Who do we already know on this number? Returns `{ result: null }` when the
   * caller is new, so the log form can show "new caller" rather than an error.
   */
  async matchCaller(phone) {
    const { data } = await apiClient.get('/agent-enquiry/match', { params: { phone } });
    return data;
  },

  async getStats() {
    const { data } = await apiClient.get('/agent-enquiry/stats');
    return data;
  },
};

export default agentEnquiryService;
