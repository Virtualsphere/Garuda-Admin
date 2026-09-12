import { useState, useEffect, useCallback, useMemo } from 'react';
import agentService from '../services/agentService';
import recruitmentService from '../services/recruitmentService';

const norm = (value) => String(value || '').trim().toLowerCase();

/**
 * The recruitment map's data layer: village nodes carrying their coordinates,
 * their seat vacancies, and the candidate pipeline pressing on them.
 *
 * Four endpoints feed one node list because they are keyed differently —
 * map-nodes is keyed on (village, mandal) and has the coordinates; positions,
 * candidates and interests are keyed on village name alone. Everything is
 * joined here so the component only ever reads a finished node.
 *
 * A village with no coordinate is dropped by the server (it cannot be drawn),
 * so `nodes` is always plottable.
 */
export default function useAgentRecruitmentMap(filters = {}) {
  const { state, district, mandal } = filters;

  const [nodes, setNodes] = useState([]);
  const [positions, setPositions] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [interests, setInterests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const locationFilter = {
        state: state || undefined,
        district: district || undefined,
        mandal: mandal || undefined,
      };

      const [nodesData, positionsData, candidatesData] = await Promise.all([
        agentService.getMapNodes(locationFilter),
        recruitmentService.getPositions(locationFilter),
        recruitmentService.getCandidates(locationFilter),
      ]);

      setNodes(nodesData.result || nodesData.data || []);
      setPositions(positionsData.result || positionsData.data || []);
      setCandidates(candidatesData.result || candidatesData.data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load recruitment map data:', err);
      setNodes([]);
      setPositions([]);
      setCandidates([]);
      setError(
        err?.response?.status === 404
          ? 'Map endpoints are not available on this backend yet.'
          : 'Could not load the recruitment map.'
      );
    } finally {
      setLoading(false);
    }
  }, [state, district, mandal]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Village interests are only fetched per-candidate by the API, so the
   * "waiting from outside" layer is assembled from the candidates already
   * loaded rather than by an N+1 sweep. A candidate carries its interests when
   * the list endpoint includes them; when it does not, the layer reads zero
   * rather than guessing.
   */
  useEffect(() => {
    const collected = [];
    candidates.forEach((candidate) => {
      const list = candidate.interests || candidate.villageInterests || [];
      list.forEach((interest) => {
        collected.push({
          ...interest,
          candidate_id: candidate.id,
          candidate_name: candidate.name,
          candidate_phone: candidate.phone,
        });
      });
    });
    setInterests(collected);
  }, [candidates]);

  /** Seats, native leads and outside interest, folded onto each village node. */
  const decoratedNodes = useMemo(() => {
    const positionsByVillage = new Map();
    positions.forEach((position) => {
      const key = norm(position.village);
      if (!positionsByVillage.has(key)) positionsByVillage.set(key, []);
      positionsByVillage.get(key).push(position);
    });

    // The detail panel lists these people, not just their count, so group the
    // rows themselves and let the count fall out of the list length.
    const nativeByVillage = new Map();
    candidates.forEach((candidate) => {
      const key = norm(candidate.village);
      if (!key) return;
      if (!nativeByVillage.has(key)) nativeByVillage.set(key, []);
      nativeByVillage.get(key).push(candidate);
    });

    const outsideByVillage = new Map();
    interests.forEach((interest) => {
      if (interest.is_native) return;
      const key = norm(interest.village);
      if (!key) return;
      if (!outsideByVillage.has(key)) outsideByVillage.set(key, []);
      outsideByVillage.get(key).push(interest);
    });

    return nodes.map((node) => {
      const key = norm(node.village);
      const villagePositions = positionsByVillage.get(key) || [];

      // A seat is vacant until somebody is actually in it; CANDIDATE_SELECTED
      // and JOINING are still unfilled ground.
      const vacantPositions = villagePositions.filter((p) => p.status !== 'FILLED').length;
      const isOpenToWaiting = villagePositions.some(
        (p) => p.status === 'OPEN_TO_WAITING_CANDIDATES'
      );

      // The seat rows already carry the slab requirement; fall back to the
      // node's own deployed count when a village has no seats synced yet.
      const required = villagePositions.length
        ? Number(villagePositions[0].required_agents) || villagePositions.length
        : 0;

      const nativeCandidates = nativeByVillage.get(key) || [];
      const outsideInterests = outsideByVillage.get(key) || [];

      return {
        ...node,
        positions: villagePositions,
        requiredAgents: required,
        deployedAgents: node.agent_count || 0,
        vacantPositions,
        isOpenToWaiting,
        nativeCandidates,
        outsideInterests,
        nativeCount: nativeCandidates.length,
        outsideCount: outsideInterests.length,
      };
    });
  }, [nodes, positions, candidates, interests]);

  const totals = useMemo(
    () =>
      decoratedNodes.reduce(
        (acc, node) => ({
          nodes: acc.nodes + 1,
          agents: acc.agents + node.deployedAgents,
          vacancies: acc.vacancies + node.vacantPositions,
          nativeLeads: acc.nativeLeads + node.nativeCount,
          waiting: acc.waiting + node.outsideCount,
          fullyStaffed: acc.fullyStaffed + (node.vacantPositions === 0 ? 1 : 0),
        }),
        { nodes: 0, agents: 0, vacancies: 0, nativeLeads: 0, waiting: 0, fullyStaffed: 0 }
      ),
    [decoratedNodes]
  );

  return {
    nodes: decoratedNodes,
    positions,
    candidates,
    interests,
    totals,
    loading,
    error,
    refresh: load,
  };
}
