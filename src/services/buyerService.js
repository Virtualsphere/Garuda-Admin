import apiClient from './apiClient';

const buyerService = {
  // ── Lands (uses employee JWT — works fine) ──────────────────────────
  async getLands(filters = {}) {
    const { data } = await apiClient.get('/land', { params: filters });
    return data;
  },

  async getLandById(id) {
    const { data } = await apiClient.get(`/land/${id}`);
    return data;
  },

  // ── Admin Buyers ────────────────────────────────────────────────────
  async getBuyersAdmin() {
    const { data } = await apiClient.get('/admin/buyer');
    return data;
  },

  async assignExecutive(buyerId, executiveId) {
    const { data } = await apiClient.put(`/admin/buyer/${buyerId}/executive`, { executive_id: executiveId });
    return data;
  },

  // ── Enquiry Payments ────────────────────────────────────────────────
  // Note: these endpoints require buyer JWT; they may return 401 in admin context.
  // Callers should catch errors and fall back to empty arrays.
  async getPayments() {
    try {
      const { data } = await apiClient.get('/buyer/payment');
      return data;
    } catch {
      return { data: [] };
    }
  },

  async getPaymentByLand(landId) {
    try {
      const { data } = await apiClient.get(`/buyer/payment/${landId}`);
      return data;
    } catch {
      return { data: null };
    }
  },

  async createPayment(payload) {
    const { data } = await apiClient.post('/buyer/payment', payload);
    return data;
  },

  // ── Cart ─────────────────────────────────────────────────────────────
  async getCart() {
    try {
      const { data } = await apiClient.get('/buyer/cart');
      return data;
    } catch {
      return { data: [] };
    }
  },

  async addToCart(landIds) {
    const { data } = await apiClient.post('/buyer/cart', { land_id: landIds });
    return data;
  },

  async removeFromCart(landIds) {
    const { data } = await apiClient.delete('/buyer/cart', { data: { landIds } });
    return data;
  },

  // ── Visits ───────────────────────────────────────────────────────────
  async getVisits() {
    try {
      const { data } = await apiClient.get('/buyer/visit');
      return data;
    } catch {
      return { data: [] };
    }
  },

  async createVisit(payload) {
    const { data } = await apiClient.post('/buyer/visit', payload);
    return data;
  },

  async deleteVisit(id) {
    const { data } = await apiClient.delete(`/buyer/visit/${id}`);
    return data;
  },

  // ── Shortlist ────────────────────────────────────────────────────────
  async getShortlist() {
    try {
      const { data } = await apiClient.get('/buyer/shortlist');
      return data;
    } catch {
      return { data: [] };
    }
  },

  async addToShortlist(landId) {
    const { data } = await apiClient.post('/buyer/shortlist', { land_id: landId });
    return data;
  },

  // ── Final List ───────────────────────────────────────────────────────
  async getFinalList() {
    try {
      const { data } = await apiClient.get('/buyer/final');
      return data;
    } catch {
      return { data: [] };
    }
  },

  // ── Availability ─────────────────────────────────────────────────────
  async getAvailability() {
    try {
      const { data } = await apiClient.get('/buyer/availability');
      return data;
    } catch {
      return { data: [] };
    }
  },
};

export default buyerService;
