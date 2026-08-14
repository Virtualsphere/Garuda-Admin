import apiClient from './apiClient';

const settingsService = {
  async getAll() {
    const { data } = await apiClient.get('/settings');
    return data;
  },

  async get(key) {
    const { data } = await apiClient.get(`/settings/${key}`);
    return data;
  },

  async set(key, value) {
    const { data } = await apiClient.put(`/settings/${key}`, { value });
    return data;
  },
};

export default settingsService;
