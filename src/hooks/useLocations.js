import { useState, useEffect, useCallback } from 'react';
import apiClient from '../services/apiClient';

/**
 * Custom hook for cascading location dropdowns.
 * Provides states, districts, mandals, villages, and towns
 * with automatic cascading load behavior.
 *
 * Usage:
 *   const {
 *     states, districts, mandals, villages, towns,
 *     selectedState, selectedDistrict, selectedMandal, selectedVillage,
 *     setSelectedState, setSelectedDistrict, setSelectedMandal, setSelectedVillage,
 *     loading
 *   } = useLocations();
 */
export default function useLocations() {
  // Data lists
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [mandals, setMandals] = useState([]);
  const [villages, setVillages] = useState([]);
  const [towns, setTowns] = useState([]);

  // Selected IDs
  const [selectedState, setSelectedStateRaw] = useState('');
  const [selectedDistrict, setSelectedDistrictRaw] = useState('');
  const [selectedMandal, setSelectedMandalRaw] = useState('');
  const [selectedVillage, setSelectedVillageRaw] = useState('');

  // Loading states
  const [loading, setLoading] = useState({
    states: false,
    districts: false,
    mandals: false,
    villages: false,
    towns: false,
  });

  // ─── Load all states on mount ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const fetchStates = async () => {
      setLoading((prev) => ({ ...prev, states: true }));
      try {
        const { data } = await apiClient.get('/location');
        if (!cancelled) {
          // The /location endpoint returns the full hierarchy.
          // We extract just the states (top-level).
          const statesList = data.data || data || [];
          setStates(Array.isArray(statesList) ? statesList : []);
        }
      } catch (err) {
        console.error('Failed to fetch states:', err);
        if (!cancelled) setStates([]);
      } finally {
        if (!cancelled) setLoading((prev) => ({ ...prev, states: false }));
      }
    };

    fetchStates();
    return () => { cancelled = true; };
  }, []);

  // ─── Load districts when state changes ─────────────────────────
  const setSelectedState = useCallback((stateId) => {
    setSelectedStateRaw(stateId);
    setSelectedDistrictRaw('');
    setSelectedMandalRaw('');
    setSelectedVillageRaw('');
    setDistricts([]);
    setMandals([]);
    setVillages([]);
    setTowns([]);

    if (!stateId) return;

    setLoading((prev) => ({ ...prev, districts: true }));
    apiClient
      .get(`/location/districts/${stateId}`)
      .then(({ data }) => {
        setDistricts(data.data || data || []);
      })
      .catch((err) => {
        console.error('Failed to fetch districts:', err);
        setDistricts([]);
      })
      .finally(() => {
        setLoading((prev) => ({ ...prev, districts: false }));
      });
  }, []);

  // ─── Load mandals & towns when district changes ────────────────
  const setSelectedDistrict = useCallback((districtId) => {
    setSelectedDistrictRaw(districtId);
    setSelectedMandalRaw('');
    setSelectedVillageRaw('');
    setMandals([]);
    setVillages([]);
    setTowns([]);

    if (!districtId) return;

    setLoading((prev) => ({ ...prev, mandals: true, towns: true }));

    // Fetch mandals
    apiClient
      .get(`/location/mandals/${districtId}`)
      .then(({ data }) => {
        setMandals(data.data || data || []);
      })
      .catch((err) => {
        console.error('Failed to fetch mandals:', err);
        setMandals([]);
      })
      .finally(() => {
        setLoading((prev) => ({ ...prev, mandals: false }));
      });

    // Fetch towns (for the same district)
    apiClient
      .get(`/location/towns/${districtId}`)
      .then(({ data }) => {
        setTowns(data.data || data || []);
      })
      .catch((err) => {
        console.error('Failed to fetch towns:', err);
        setTowns([]);
      })
      .finally(() => {
        setLoading((prev) => ({ ...prev, towns: false }));
      });
  }, []);

  // ─── Load villages when mandal changes ─────────────────────────
  const setSelectedMandal = useCallback((mandalId) => {
    setSelectedMandalRaw(mandalId);
    setSelectedVillageRaw('');
    setVillages([]);

    if (!mandalId) return;

    setLoading((prev) => ({ ...prev, villages: true }));
    apiClient
      .get(`/location/villages/${mandalId}`)
      .then(({ data }) => {
        setVillages(data.data || data || []);
      })
      .catch((err) => {
        console.error('Failed to fetch villages:', err);
        setVillages([]);
      })
      .finally(() => {
        setLoading((prev) => ({ ...prev, villages: false }));
      });
  }, []);

  // ─── Set selected village (no further cascade) ─────────────────
  const setSelectedVillage = useCallback((villageId) => {
    setSelectedVillageRaw(villageId);
  }, []);

  // ─── Reset all selections ──────────────────────────────────────
  const resetLocations = useCallback(() => {
    setSelectedStateRaw('');
    setSelectedDistrictRaw('');
    setSelectedMandalRaw('');
    setSelectedVillageRaw('');
    setDistricts([]);
    setMandals([]);
    setVillages([]);
    setTowns([]);
  }, []);

  return {
    // Data lists
    states,
    districts,
    mandals,
    villages,
    towns,

    // Selected values
    selectedState,
    selectedDistrict,
    selectedMandal,
    selectedVillage,

    // Setters (trigger cascading loads)
    setSelectedState,
    setSelectedDistrict,
    setSelectedMandal,
    setSelectedVillage,

    // Utilities
    resetLocations,
    loading,
  };
}
