import apiClient from './apiClient';

const attendanceService = {
  /**
   * Daily presence registry (entry/exit times + mission hours) for a department
   * @param {Object} params - { role, date }
   */
  async getDaily({ role, date }) {
    const { data } = await apiClient.get('/attendance/registry/daily', { params: { role, date } });
    return data;
  },

  /**
   * Weekly presence grid for a department
   * @param {Object} params - { role, startDate, endDate }
   */
  async getWeekly({ role, startDate, endDate }) {
    const { data } = await apiClient.get('/attendance/registry/weekly', { params: { role, startDate, endDate } });
    return data;
  },

  /**
   * Monthly presence history/summary for a department
   * @param {Object} params - { role, month, year }
   */
  async getMonthly({ role, month, year }) {
    const { data } = await apiClient.get('/attendance/registry/monthly', { params: { role, month, year } });
    return data;
  },

  /**
   * Bulk save entry/exit time & status edits
   * @param {string} date - YYYY-MM-DD
   * @param {Array} records - [{ employee_id, check_in, check_out, status }]
   */
  async saveBulk(date, records) {
    const { data } = await apiClient.put('/attendance/registry/bulk', { date, records });
    return data;
  },
};

export default attendanceService;
