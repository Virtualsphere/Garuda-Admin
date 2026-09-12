import { useMemo } from 'react';
import useAgentRecruitmentMap from './useAgentRecruitmentMap';

/**
 * Adapts the agent map-node payload into the shape InteractiveMap draws.
 *
 * The backend speaks in nodes (village + mandal + aggregates); the schematic
 * map speaks in "village locations" with an allotment state. Keeping the
 * translation here means the map component stays a pure renderer and can be
 * pointed at any source — including a caller that supplies its own list.
 *
 * Village *boundary* polygons are not stored anywhere yet, so every village
 * renders as a labelled marker rather than a shape. The moment boundaries
 * exist, filling `boundaryPolygon` is the only change needed.
 */
export default function useVillageLocations(filters = {}) {
  const { nodes, totals, loading, error, refresh } = useAgentRecruitmentMap(filters);

  const villages = useMemo(
    () =>
      nodes.map((node) => ({
        // Villages have no id of their own in the node payload — the
        // (mandal, village) pair is what makes one unique.
        id: `${node.mandal || 'x'}::${node.village}`,
        name: node.village,
        state: node.state,
        district: node.district,
        mandal: node.mandal,

        requiredAgents: node.requiredAgents || 0,
        attachedAgentsCount: node.deployedAgents || 0,
        // Both native leads and outside applicants count as interest in the
        // village — the map only distinguishes "somebody wants this seat".
        interestedAgentsCount: (node.nativeCount || 0) + (node.outsideCount || 0),
        vacancy: node.vacantPositions || 0,

        centerCoordinates: { lat: node.latitude, lng: node.longitude },
        boundaryPolygon: [],

        // Kept so a selected village can show its detail without a re-fetch.
        node,
      })),
    [nodes]
  );

  return { villages, nodes, totals, loading, error, refresh };
}

/**
 * Land nodes → the land shape InteractiveMap draws. Separate from the hook
 * because lands are fetched per agent, not per territory.
 */
export const toMapLands = (landNodes = []) =>
  landNodes.map((land) => ({
    id: land.id,
    label: `LD-${land.id}`,
    acres: Math.round((Number(land.total_acres) || 0) * 10) / 10,
    gpsCoordinates: { lat: land.latitude, lng: land.longitude },
    // land-nodes returns [[lat, lng], ...]; the map wants {lat, lng} objects.
    boundaryPolygon: Array.isArray(land.boundary)
      ? land.boundary.map(([lat, lng]) => ({ lat, lng }))
      : [],
    raw: land,
  }));
