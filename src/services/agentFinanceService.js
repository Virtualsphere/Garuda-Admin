import apiClient from './apiClient';

/**
 * The agent finance ledger. `agent.commission_earned` / `commission_paid` are
 * running totals recomputed server-side from these rows after every write, so
 * the registry badge and the ledger can never disagree.
 *
 * A settled line (PAID / PARTIAL) is an accounting record: the server refuses
 * to re-price or delete one (409) and expects an adjusting entry instead.
 */
const agentFinanceService = {
  async getTransactions(filters = {}) {
    const { data } = await apiClient.get('/agent-transaction', { params: filters });
    return data;
  },

  async getTransaction(id) {
    const { data } = await apiClient.get(`/agent-transaction/${id}`);
    return data;
  },

  async createTransaction(transactionData) {
    const { data } = await apiClient.post('/agent-transaction', transactionData);
    return data;
  },

  async updateTransaction(id, transactionData) {
    const { data } = await apiClient.put(`/agent-transaction/${id}`, transactionData);
    return data;
  },

  async updateTransactionStatus(id, status) {
    const { data } = await apiClient.put(`/agent-transaction/${id}/status`, { status });
    return data;
  },

  async deleteTransaction(id) {
    const { data } = await apiClient.delete(`/agent-transaction/${id}`);
    return data;
  },

  /** Department-level rollup for the Finance tab's stat cards. */
  async getSummary(filters = {}) {
    const { data } = await apiClient.get('/agent-transaction/summary', { params: filters });
    return data;
  },

  /** One agent's ledger plus outstanding balance, for the profile drawer. */
  async getLedger(agentId) {
    const { data } = await apiClient.get(`/agent-transaction/ledger/${agentId}`);
    return data;
  },
};

export default agentFinanceService;
