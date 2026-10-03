import apiClient from './apiClient';

/**
 * Agent recruitment pipeline: candidates, their village interests, and the
 * numbered village seats they are selected for.
 *
 * Seat capacity is derived server-side from the shared `required_agents_slabs`
 * setting, so `listPositions` rows carry `required_agents`, `deployed_agents`
 * and `vacancy` alongside the seat itself.
 */
const recruitmentService = {
  // ── Candidates ───────────────────────────────────────────────
  async getCandidates(filters = {}) {
    const { data } = await apiClient.get('/recruitment/candidate', { params: filters });
    return data;
  },

  async getCandidate(id) {
    const { data } = await apiClient.get(`/recruitment/candidate/${id}`);
    return data;
  },

  async createCandidate(candidateData) {
    const { data } = await apiClient.post('/recruitment/candidate', candidateData);
    return data;
  },

  async updateCandidate(id, candidateData) {
    const { data } = await apiClient.put(`/recruitment/candidate/${id}`, candidateData);
    return data;
  },

  /** Moves a candidate to a new pipeline stage and writes a history row. */
  async updateCandidateStatus(id, status, notes) {
    const { data } = await apiClient.put(`/recruitment/candidate/${id}/status`, { status, notes });
    return data;
  },

  /** Appoints a selected candidate as an agent and fills their seat. */
  async convertCandidate(id) {
    const { data } = await apiClient.post(`/recruitment/candidate/${id}/convert`);
    return data;
  },

  // ── Village interests ────────────────────────────────────────
  /** `is_native` is derived on the server — never send it. */
  async addInterests(candidateId, villages) {
    const { data } = await apiClient.post('/recruitment/interest', { candidateId, villages });
    return data;
  },

  async removeInterest(id) {
    const { data } = await apiClient.delete(`/recruitment/interest/${id}`);
    return data;
  },

  /**
   * "This candidate wants that village": records the interest *and* makes sure
   * the lead is in the Interested queue. The two are separate on the server —
   * adding an interest row does not move the lead's stage — so doing only the
   * first would leave someone who said yes invisible on the Interested tab.
   *
   * The stage is only ever promoted. A lead already booked in to an office or
   * selected for a seat must not be dragged back to INTERESTED by one more
   * village being ticked.
   */
  async markInterested(candidateId, villages, { stage, note } = {}) {
    const names = (Array.isArray(villages) ? villages : [villages]).filter(Boolean);
    if (!names.length) return null;

    const result = await recruitmentService.addInterests(candidateId, names);

    const EARLY = ['NEW_LEAD', 'FIRST_CALL', 'LOCATION_CHECK'];
    if (!stage || EARLY.includes(stage)) {
      await recruitmentService.updateCandidateStatus(
        candidateId,
        'INTERESTED',
        note || `Interested in ${names.join(', ')}`
      );
    }
    return result;
  },

  // ── Village positions (seats) ────────────────────────────────
  async getPositions(filters = {}) {
    const { data } = await apiClient.get('/recruitment/position', { params: filters });
    return data;
  },

  /** Creates any seats a village's acreage calls for but does not yet have. */
  async syncPositions(location) {
    const { data } = await apiClient.post('/recruitment/position/sync', location);
    return data;
  },

  /** Ends native priority on one seat. Requires a remark for the audit trail. */
  async openPositionToWaiting(id, remarks) {
    const { data } = await apiClient.put(`/recruitment/position/${id}/open-to-waiting`, { remarks });
    return data;
  },

  /**
   * Selects a candidate for a seat. Rejects with 409 if a non-native is
   * chosen for a seat still under native search.
   */
  async selectCandidate(positionId, candidateId) {
    const { data } = await apiClient.put(`/recruitment/position/${positionId}/select`, { candidateId });
    return data;
  },

  // ── Stats ────────────────────────────────────────────────────
  async getStats() {
    const { data } = await apiClient.get('/recruitment/stats');
    return data;
  },
};

export default recruitmentService;
