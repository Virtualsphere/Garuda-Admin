import apiClient from './apiClient';

/**
 * Standing observation assignments and the reports filed against them.
 *
 * An assignment is an agent watching a land parcel they do not own the primary
 * link to, on a cadence (`frequency`). When `next_due_date` passes, the map
 * draws that parcel with the red "information due" ping — which is why the
 * allotment map reads `observation_due` off the land-nodes endpoint rather
 * than recomputing dates in the browser.
 */
const agentObservationService = {
  // ── Assignments ──────────────────────────────────────────────
  async getAssignments(filters = {}) {
    const { data } = await apiClient.get('/agent-observation/assignment', {
      params: filters,
    });
    return data;
  },

  async getAssignment(id) {
    const { data } = await apiClient.get(`/agent-observation/assignment/${id}`);
    return data;
  },

  /**
   * Attach one agent to one land. Re-assigning an existing pair updates its
   * cadence rather than failing, so the desk can adjust in place.
   */
  async assign(assignmentData) {
    const { data } = await apiClient.post(
      '/agent-observation/assignment',
      assignmentData
    );
    return data;
  },

  /**
   * What the map's multi-select "Assign Observation" action sends. Pairs that
   * clash (the agent is already the land's primary agent) come back in
   * `result.skipped` rather than failing the whole batch.
   */
  async assignBulk({ landIds, agentIds, frequency, nextDueDate, notes }) {
    const { data } = await apiClient.post('/agent-observation/assignment/bulk', {
      landIds,
      agentIds,
      frequency,
      nextDueDate,
      notes,
    });
    return data;
  },

  async updateAssignment(id, assignmentData) {
    const { data } = await apiClient.put(
      `/agent-observation/assignment/${id}`,
      assignmentData
    );
    return data;
  },

  async removeAssignment(id) {
    const { data } = await apiClient.delete(`/agent-observation/assignment/${id}`);
    return data;
  },

  /** Flip every assignment whose report has come due to INFORMATION_DUE. */
  async markDue() {
    const { data } = await apiClient.post('/agent-observation/assignment/mark-due');
    return data;
  },

  // ── Submissions ──────────────────────────────────────────────
  async getSubmissions(filters = {}) {
    const { data } = await apiClient.get('/agent-observation/submission', {
      params: filters,
    });
    return data;
  },

  /**
   * File what the agent found. The server derives the price-change direction
   * from the previous report, rolls the next due date forward, and parks the
   * assignment in VERIFICATION_PENDING.
   */
  async submitInformation(submissionData) {
    const { data } = await apiClient.post(
      '/agent-observation/submission',
      submissionData
    );
    return data;
  },

  async verifySubmission(id, verificationStatus, verifiedPricePerAcre) {
    const { data } = await apiClient.put(
      `/agent-observation/submission/${id}/verify`,
      { verificationStatus, verifiedPricePerAcre }
    );
    return data;
  },
};

export default agentObservationService;
