import apiClient from './apiClient';

/**
 * Page-access permissions. The catalog is a fixed list of keys (`add_land`,
 * `location`, `employees`, `call_verification`, `physical_verification`,
 * `final_verification`). A role grants a set of keys; an employee override
 * then ALLOWs or DENYs individual keys on top of their role. The ADMIN role
 * bypasses all of it. Role/employee endpoints require an admin JWT.
 */
const permissionService = {
  async getCatalog() {
    const { data } = await apiClient.get('/permission/catalog');
    return data;
  },

  /** Effective permissions for the logged-in employee: `{ isAdmin, permissions }`. */
  async getMine() {
    const { data } = await apiClient.get('/permission/me');
    return data;
  },

  async getRolePermissions(roleName) {
    const { data } = await apiClient.get(`/permission/role/${encodeURIComponent(roleName)}`);
    return data;
  },

  async setRolePermissions(roleName, permissionKeys) {
    const { data } = await apiClient.put(`/permission/role/${encodeURIComponent(roleName)}`, { permissionKeys });
    return data;
  },

  async getEmployeePermissions(employeeId) {
    const { data } = await apiClient.get(`/permission/employee/${employeeId}`);
    return data;
  },

  /** @param {{permissionKey: string, type: 'ALLOW'|'DENY'}[]} overrides */
  async setEmployeePermissions(employeeId, overrides) {
    const { data } = await apiClient.put(`/permission/employee/${employeeId}`, { overrides });
    return data;
  },
};

export default permissionService;
