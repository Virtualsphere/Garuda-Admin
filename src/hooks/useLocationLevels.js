import { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../services/apiClient';

const byName = (a, b) => String(a.name).localeCompare(String(b.name));

/** Directory names arrive with stray spaces ("Andhra Pradesh "); trim once here. */
const tidy = (data) => {
  const list = data.data || data || [];
  return (Array.isArray(list) ? list : [])
    .map((row) => ({ ...row, name: String(row.name || '').trim() }))
    .filter((row) => row.name)
    .sort(byName);
};

const LEVEL_PATHS = {
  districts: (stateId) => `/location/districts/${stateId}`,
  mandals: (districtId) => `/location/mandals/${districtId}`,
  villages: (mandalId) => `/location/villages/${mandalId}`,
};

/**
 * State → District → Mandal → Village, fetched one level at a time by parent id
 * from the `/location/*` endpoints, for forms with *many* independent chains.
 *
 * `useLocations` holds a single selected chain. A multi-row grid needs one chain
 * per row, so this keeps no selection at all — only a cache of each level keyed
 * by parent id. Rows sharing a mandal therefore cost one request between them,
 * and a request already in flight is joined rather than repeated.
 *
 * `load*` resolve with the list (for callers that must match names, e.g. a
 * paste); `*Of` read the cache synchronously for rendering and return `[]`
 * until it arrives.
 */
export default function useLocationLevels() {
  const [states, setStates] = useState([]);
  const [statesLoading, setStatesLoading] = useState(true);
  const [error, setError] = useState(null);

  // { districts: { [stateId]: [...] }, mandals: {...}, villages: {...} }
  const [cache, setCache] = useState({ districts: {}, mandals: {}, villages: {} });
  const [pending, setPending] = useState({});
  const inFlight = useRef(new Map());

  useEffect(() => {
    let cancelled = false;
    // GET /location is the states list (it also nests the tree, which is ignored
    // here — every lower level comes from its own endpoint).
    apiClient
      .get('/location')
      .then(({ data }) => {
        if (cancelled) return;
        setStates(tidy(data).map(({ id, name }) => ({ id, name })));
        setError(null);
      })
      .catch((err) => {
        console.error('Failed to load states:', err);
        if (!cancelled) {
          setStates([]);
          setError('Could not load locations.');
        }
      })
      .finally(() => {
        if (!cancelled) setStatesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback((level, parentId) => {
    if (!parentId) return Promise.resolve([]);
    const key = `${level}:${parentId}`;
    if (inFlight.current.has(key)) return inFlight.current.get(key);

    setPending((prev) => ({ ...prev, [key]: true }));
    const request = apiClient
      .get(LEVEL_PATHS[level](parentId))
      .then(({ data }) => {
        const list = tidy(data);
        setCache((prev) => ({ ...prev, [level]: { ...prev[level], [parentId]: list } }));
        return list;
      })
      .catch((err) => {
        console.error(`Failed to load ${level} for ${parentId}:`, err);
        // Forget the failure so the next selection of this parent retries it.
        inFlight.current.delete(key);
        return [];
      })
      .finally(() => {
        setPending((prev) => ({ ...prev, [key]: false }));
      });

    inFlight.current.set(key, request);
    return request;
  }, []);

  const loadDistricts = useCallback((stateId) => load('districts', stateId), [load]);
  const loadMandals = useCallback((districtId) => load('mandals', districtId), [load]);
  const loadVillages = useCallback((mandalId) => load('villages', mandalId), [load]);

  const districtsOf = useCallback((stateId) => cache.districts[stateId] || [], [cache]);
  const mandalsOf = useCallback((districtId) => cache.mandals[districtId] || [], [cache]);
  const villagesOf = useCallback((mandalId) => cache.villages[mandalId] || [], [cache]);

  const isLoading = useCallback(
    (level, parentId) => Boolean(pending[`${level}:${parentId}`]),
    [pending]
  );

  return {
    states,
    statesLoading,
    error,
    loadDistricts,
    loadMandals,
    loadVillages,
    districtsOf,
    mandalsOf,
    villagesOf,
    isLoading,
  };
}
