import apiClient from './apiClient';

const assignedVillageService = {
  async getAll() {
    const { data } = await apiClient.get('/fieldwork/assigned-village');
    return data;
  },

  async getByEmployee() {
    const { data } = await apiClient.get('/fieldwork/assigned-village/me');
    return data;
  },

  async getVillageStats({ employeeId } = {}) {
    const { data } = await apiClient.get('/fieldwork/village-stats', {
      params: employeeId ? { employeeId } : {},
    });
    return data;
  },

  async create({ target, assignedEmployeeId, village, mandal, assignedStatus }) {
    const { data } = await apiClient.post('/fieldwork/assigned-village', {
      target,
      assignedEmployeeId,
      village,
      mandal,
      assignedStatus,
    });
    return data;
  },

  async update(id, updateData) {
    const { data } = await apiClient.put('/fieldwork/assigned-village', { id, ...updateData });
    return data;
  },

  async delete(id) {
    const { data } = await apiClient.delete(`/fieldwork/assigned-village/${id}`);
    return data;
  },
};

export default assignedVillageService;
