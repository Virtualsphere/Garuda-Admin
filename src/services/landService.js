import apiClient from './apiClient';

const landService = {
  /**
   * Create a new land entry (with farmer details)
   * JWT required — created_by is set from token
   */
  async create(landData) {
    const { data } = await apiClient.post('/land', landData);
    return data;
  },

  /**
   * Get all lands with optional filters
   * @param {Object} [filters] - state, district, mandal, village, verification_status, etc.
   */
  async getAll(filters = {}) {
    const { data } = await apiClient.get('/land', { params: filters });
    return data;
  },

  /**
   * Get land by ID (with all details, farmer, media, etc.)
   */
  async getById(id) {
    const { data } = await apiClient.get(`/land/${id}`);
    return data;
  },

  /**
   * Update land by ID
   */
  async update(id, landData) {
    const { data } = await apiClient.put(`/land/${id}`, landData);
    return data;
  },

  /**
   * Delete land by ID
   */
  async delete(id) {
    const { data } = await apiClient.delete(`/land/${id}`);
    return data;
  },

  /**
   * Get lands pending final verification (physical verification already complete)
   */
  async getByVerificationStatus(status) {
    const { data } = await apiClient.get(`/land/pending-final-verification/${status}`);
    return data;
  },

  /**
   * Get lands pending call verification
   */
  async getByCallVerificationStatus(status) {
    const { data } = await apiClient.get(`/land/pending-call-verification/${status}`);
    return data;
  },

  /**
   * Get lands pending physical verification (call verification already complete)
   */
  async getByPhysicalVerificationStatus(status) {
    const { data } = await apiClient.get(`/land/pending-physical-verification/${status}`);
    return data;
  },
};

export default landService;
