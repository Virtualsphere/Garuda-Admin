import apiClient from './apiClient';

/**
 * Location directory CRUD. Each level is created/updated/deleted by its own
 * singular path (`/location/state/:id`), but listed by its parent's id
 * (`/location/districts/:state_id`). GET /location returns the states.
 */
const LEVEL_PATH = {
  states: 'state',
  districts: 'district',
  towns: 'town',
  mandals: 'mandal',
  villages: 'village',
};

const LIST_PATH = {
  districts: (parentId) => `/location/districts/${parentId}`,
  towns: (parentId) => `/location/towns/${parentId}`,
  mandals: (parentId) => `/location/mandals/${parentId}`,
  villages: (parentId) => `/location/villages/${parentId}`,
};

const locationService = {
  async getStates() {
    const { data } = await apiClient.get('/location');
    return data;
  },

  /** @param {'districts'|'towns'|'mandals'|'villages'} level */
  async list(level, parentId) {
    const { data } = await apiClient.get(LIST_PATH[level](parentId));
    return data;
  },

  /** `payload` carries the parent key (`state_id`, `district_id`, `mandal_id`) where needed. */
  async create(level, payload) {
    const { data } = await apiClient.post(`/location/${LEVEL_PATH[level]}`, payload);
    return data;
  },

  async update(level, id, payload) {
    const { data } = await apiClient.put(`/location/${LEVEL_PATH[level]}/${id}`, payload);
    return data;
  },

  async delete(level, id) {
    const { data } = await apiClient.delete(`/location/${LEVEL_PATH[level]}/${id}`);
    return data;
  },
};

export default locationService;
