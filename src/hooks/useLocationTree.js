import { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../services/apiClient';

const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''));

const findByName = (list, name) =>
  (list || []).find((x) => String(x.name).toLowerCase() === String(name || '').toLowerCase());

/**
 * The whole State → District → Mandal → Village tree, fetched once and queried
 * by *name*.
 *
 * `useLocations` is the right tool for a form with one chain of selects. A
 * multi-row entry grid needs a separate chain per row, and re-fetching each
 * level per row would be dozens of requests — so the tree is loaded in one call
 * and each row just asks "what are the districts of this state".
 *
 * Lookups go down the tree by parent name, never by a bare mandal name, because
 * two districts can each have a mandal called the same thing.
 */
export default function useLocationTree() {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get('/location')
      .then(({ data }) => {
        if (cancelled) return;
        const rows = data.data || data || [];
        setTree(Array.isArray(rows) ? rows : []);
        setError(null);
      })
      .catch((err) => {
        console.error('Failed to load the location tree:', err);
        if (!cancelled) {
          setTree([]);
          setError('Could not load locations.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const states = useMemo(() => [...tree].sort(byName), [tree]);

  const districtsOf = useCallback(
    (stateName) => [...(findByName(tree, stateName)?.districts || [])].sort(byName),
    [tree]
  );

  const mandalsOf = useCallback(
    (stateName, districtName) =>
      [
        ...(findByName(findByName(tree, stateName)?.districts, districtName)?.mandals || []),
      ].sort(byName),
    [tree]
  );

  const villagesOf = useCallback(
    (stateName, districtName, mandalName) =>
      [
        ...(findByName(
          findByName(findByName(tree, stateName)?.districts, districtName)?.mandals,
          mandalName
        )?.villages || []),
      ].sort(byName),
    [tree]
  );

  return { states, districtsOf, mandalsOf, villagesOf, loading, error };
}
