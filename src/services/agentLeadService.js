import apiClient from './apiClient';

/**
 * The agent recruitment desk's lead pipeline: Leads → Allot → Calls →
 * Team Leader → Interested → Onboarding.
 *
 * The four call queues are defined server-side (`queue=` on the list endpoint)
 * so the tab badge counts and the tab contents can never disagree — never
 * re-derive a queue in the browser.
 */
const agentLeadService = {
  // ── Queues ───────────────────────────────────────────────────
  /** `queue` is one of: unallotted | first-call | follow-up | not-lifted. */
  async getLeads(filters = {}) {
    const { data } = await apiClient.get('/agent-lead', { params: filters });
    return data;
  },

  async getLead(id) {
    const { data } = await apiClient.get(`/agent-lead/${id}`);
    return data;
  },

  /** Badge counts for every recruitment tab, in one call. */
  async getQueueCounts() {
    const { data } = await apiClient.get('/agent-lead/queue-counts');
    return data;
  },

  async getSourceBreakdown() {
    const { data } = await apiClient.get('/agent-lead/source-breakdown');
    return data;
  },

  async getPerformance(filters = {}) {
    const { data } = await apiClient.get('/agent-lead/performance', { params: filters });
    return data;
  },

  // ── Allotment ────────────────────────────────────────────────
  /** Re-allotting an already-allotted lead reassigns it rather than failing. */
  async allot({ leadIds, employeeId, teamLeaderId, teamId, teamName }) {
    const { data } = await apiClient.post('/agent-lead/allot', {
      leadIds,
      employeeId,
      teamLeaderId,
      teamId,
      teamName,
    });
    return data;
  },

  async unallot(leadIds) {
    const { data } = await apiClient.post('/agent-lead/unallot', { leadIds });
    return data;
  },

  // ── Calls ────────────────────────────────────────────────────
  /**
   * Record a dial. `result` drives the lead's onward status: Proceed promotes
   * it to Interested, Not Interested closes it, and Follow Up schedules the
   * call-back — which is why followUpDate is required for that result (400).
   */
  async logCall(payload) {
    const { data } = await apiClient.post('/agent-lead/call', payload);
    return data;
  },

  async getCallAttempts(filters = {}) {
    const { data } = await apiClient.get('/agent-lead/call', { params: filters });
    return data;
  },

  // ── Team leader escalation ───────────────────────────────────
  /** Rejects with 409 when the lead already has an open escalation. */
  async escalate(payload) {
    const { data } = await apiClient.post('/agent-lead/escalation', payload);
    return data;
  },

  async getEscalations(filters = {}) {
    const { data } = await apiClient.get('/agent-lead/escalation', { params: filters });
    return data;
  },

  async resolveEscalation(id, payload) {
    const { data } = await apiClient.put(`/agent-lead/escalation/${id}/resolve`, payload);
    return data;
  },

  // ── Office visits / onboarding ───────────────────────────────
  async getOfficeVisits(filters = {}) {
    const { data } = await apiClient.get('/agent-lead/office-visit', { params: filters });
    return data;
  },

  /** Re-booking a candidate moves their existing visit instead of duplicating. */
  async scheduleOfficeVisit(payload) {
    const { data } = await apiClient.post('/agent-lead/office-visit', payload);
    return data;
  },

  // ── Onboarding ───────────────────────────────────────────────
  /**
   * Appoint a candidate as an agent. One server transaction: creates the
   * agent, fills the village seat, writes the joining money to the ledger and
   * marks the candidate JOINED.
   *
   * Refuses with 409 unless ID proof and the agreement are both recorded —
   * pass allowIncompletePaperwork to onboard on paper anyway. Idempotent: a
   * candidate already converted comes back with alreadyOnboarded: true.
   */
  async onboard(payload) {
    const { data } = await apiClient.post('/agent-lead/onboard', payload);
    return data;
  },

  async updatePaperwork(agentId, payload) {
    const { data } = await apiClient.put(`/agent-lead/paperwork/${agentId}`, payload);
    return data;
  },

  async getOnboardingSummary(agentId) {
    const { data } = await apiClient.get(`/agent-lead/onboarding-summary/${agentId}`);
    return data;
  },

  async updateOfficeVisitStatus(id, payload) {
    const { data } = await apiClient.put(`/agent-lead/office-visit/${id}/status`, payload);
    return data;
  },

  // ── Interested ───────────────────────────────────────────────
  /**
   * Candidates past the call, joined server-side with who closed them, the
   * recording, any team-leader involvement and the booked office. Rejects with a
   * plain 404 on a backend that predates it — callers fall back to `getLeads`.
   */
  async getInterested() {
    const { data } = await apiClient.get('/agent-lead/interested');
    return data;
  },

  // ── Recovery hub (Not Lifted & Invalid) ──────────────────────
  /** Leads the desk dialled and could not reach, with their WhatsApp trail. */
  async getRecoveryLeads() {
    const { data } = await apiClient.get('/agent-lead', {
      params: { pool: 'recovery', includeWhatsapp: true },
    });
    return data;
  },

  /** The dumped archive. */
  async getDumpedLeads() {
    const { data } = await apiClient.get('/agent-lead', { params: { pool: 'dumped' } });
    return data;
  },

  /** Correct a phone number; the lead stays where it is until a call connects. */
  async updatePhone(id, phone, note) {
    const { data } = await apiClient.put(`/agent-lead/${id}/phone`, { phone, note });
    return data;
  },

  /** Retire an unreachable lead. `callerEmployeeId` credits a shared-desk colleague. */
  async dump(id, { reason, callerEmployeeId } = {}) {
    const { data } = await apiClient.post(`/agent-lead/${id}/dump`, { reason, callerEmployeeId });
    return data;
  },

  async restore(id) {
    const { data } = await apiClient.post(`/agent-lead/${id}/restore`);
    return data;
  },

  /** Log a WhatsApp message that has just been opened in the browser. */
  async logWhatsapp(id, { templateName, messageText, callerEmployeeId }) {
    const { data } = await apiClient.post(`/agent-lead/${id}/whatsapp`, {
      templateName,
      messageText,
      callerEmployeeId,
    });
    return data;
  },

  // ── Reports ──────────────────────────────────────────────────
  /** Per-employee working numbers plus daily / weekly / monthly cadence. */
  async getReport(params = {}) {
    const { data } = await apiClient.get('/agent-lead/report', { params });
    return data;
  },
};

export default agentLeadService;
