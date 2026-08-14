import apiClient from './apiClient';

const callSignalService = {
  async getAll(filters = {}) {
    const { data } = await apiClient.get('/call-signal', { params: filters });
    return data;
  },

  async getMetrics(filters = {}) {
    const { data } = await apiClient.get('/call-signal/metrics', { params: filters });
    return data;
  },

  async create(signalData) {
    const { data } = await apiClient.post('/call-signal', signalData);
    return data;
  },

  async updateStatus(id, status) {
    const { data } = await apiClient.put(`/call-signal/${id}/status`, { status });
    return data;
  },
};

export default callSignalService;
