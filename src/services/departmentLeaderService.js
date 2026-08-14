import apiClient from './apiClient';

const departmentLeaderService = {
  async setAllotment(employeeId, leaderId, departmentType) {
    const { data } = await apiClient.put('/department-leader/allotment', { employeeId, leaderId, departmentType });
    return data;
  },

  async getRoster(leaderId, departmentType) {
    const { data } = await apiClient.get('/department-leader/roster', { params: { leaderId, departmentType } });
    return data;
  },

  async getTree(departmentType) {
    const { data } = await apiClient.get('/department-leader/tree', { params: { departmentType } });
    return data;
  },

  async removeAllotment(employeeId, departmentType) {
    const { data } = await apiClient.delete('/department-leader/allotment', { data: { employeeId, departmentType } });
    return data;
  },
};

export default departmentLeaderService;
