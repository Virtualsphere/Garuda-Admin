import apiClient from './apiClient';

const employeeService = {
  /**
   * Get all employees
   * @param {Object} [filters] - Optional query params (role, status, etc.)
   */
  async getAll(filters = {}) {
    const { data } = await apiClient.get('/employee/all', { params: filters });
    return data;
  },

  /**
   * Get employee by ID
   */
  async getById(id) {
    const { data } = await apiClient.get(`/employee/${id}`);
    return data;
  },

  /**
   * Get current employee profile (JWT required)
   */
  async getProfile() {
    const { data } = await apiClient.get('/employee/profile');
    return data;
  },

  /**
   * Create a new employee (signup)
   */
  async create(employeeData) {
    const { data } = await apiClient.post('/employee/signup', employeeData);
    return data;
  },

  /**
   * Update employee by ID
   */
  async update(id, employeeData) {
    const { data } = await apiClient.put(`/employee/update/${id}`, employeeData);
    return data;
  },

  /**
   * Delete employee by ID
   */
  async delete(id) {
    const { data } = await apiClient.delete(`/employee/delete/${id}`);
    return data;
  },

  /**
   * Update salary package
   */
  async updateSalaryPackage(id, packageData) {
    const { data } = await apiClient.put(`/employee/salary-package/${id}`, packageData);
    return data;
  },

  /**
   * Update work location
   */
  async updateWorkLocation(id, locationData) {
    const { data } = await apiClient.put(`/employee/work-location/${id}`, locationData);
    return data;
  },
};

export default employeeService;
