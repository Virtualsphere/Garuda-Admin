import { useState, useEffect, useCallback } from 'react';
import settingsService from '../services/settingsService';

// Mirrors the defaults in SettingsRequiredAgents so the map still benchmarks
// sensibly before an admin has saved a slab table.
const DEFAULT_SLABS = [
  { from: '0', to: '500', agents: '5' },
  { from: '501', to: '1000', agents: '12' },
  { from: '1001', to: '2000', agents: '25' },
  { from: '2001', to: '5000', agents: '50' },
];

/**
 * Loads the global `required_agents_slabs` setting and exposes the
 * slab lookup used to benchmark a village node's allotted force against
 * how many agents its acreage calls for.
 *
 * Acreage above the highest slab keeps that slab's requirement.
 */
export default function useRequiredAgents() {
  const [slabs, setSlabs] = useState(DEFAULT_SLABS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await settingsService.get('required_agents_slabs');
        const value = data.data?.value ?? DEFAULT_SLABS;
        if (!cancelled && Array.isArray(value) && value.length) setSlabs(value);
      } catch (err) {
        console.error('Failed to load required agents slabs:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const requiredFor = useCallback(
    (acres) => {
      const value = Number(acres) || 0;

      const ordered = [...slabs].sort((a, b) => Number(a.from) - Number(b.from));

      const match = ordered.find(
        (slab) => value >= Number(slab.from) && value <= Number(slab.to)
      );

      if (match) return Number(match.agents) || 0;

      // beyond the top slab, hold the highest requirement
      const top = ordered[ordered.length - 1];
      if (top && value > Number(top.to)) return Number(top.agents) || 0;

      return 0;
    },
    [slabs]
  );

  return { slabs, requiredFor, loading };
}
