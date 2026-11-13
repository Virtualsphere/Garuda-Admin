import apiClient from './apiClient';

/**
 * Home / Plot / Venture / Villa property listings (`/listings`).
 * Payloads are built by utils/listingRecord.js → formToPayload().
 */
const listingService = {
  /** @param {{ type?: string, status?: string, search?: string, page?: number, limit?: number }} params */
  async getAll(params = {}) {
    const { data } = await apiClient.get('/listings', { params });
    return data;
  },

  async getCounts() {
    const { data } = await apiClient.get('/listings/counts');
    return data;
  },

  async getById(id) {
    const { data } = await apiClient.get(`/listings/${id}`);
    return data;
  },

  async create(payload) {
    const { data } = await apiClient.post('/listings', payload);
    return data;
  },

  /** Full replace — `media` omitted means all media is removed. */
  async update(id, payload) {
    const { data } = await apiClient.put(`/listings/${id}`, payload);
    return data;
  },

  /** Admin only. Rejecting requires `remarks`. */
  async updateStatus(id, status, remarks) {
    const { data } = await apiClient.patch(`/listings/${id}/status`, { status, remarks });
    return data;
  },

  /** Admin only. */
  async remove(id) {
    const { data } = await apiClient.delete(`/listings/${id}`);
    return data;
  },
};

export default listingService;
