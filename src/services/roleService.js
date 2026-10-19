import apiClient from './apiClient';

/** Roles are stored upper-snake-case (`FIELD_EXECUTIVE`); normalise before sending. */
const toRoleName = (name) => String(name).trim().toUpperCase().replace(/\s+/g, '_');

const roleService = {
  async getAll() {
    const { data } = await apiClient.get('/role');
    return data;
  },

  async create(name) {
    const { data } = await apiClient.post('/role', { name: toRoleName(name) });
    return data;
  },

  async update(id, name) {
    const { data } = await apiClient.put(`/role/${id}`, { name: toRoleName(name) });
    return data;
  },

  async delete(id) {
    const { data } = await apiClient.delete(`/role/${id}`);
    return data;
  },
};

export default roleService;
