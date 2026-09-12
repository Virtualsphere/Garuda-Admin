import { useState } from 'react';
import AgentsFilterBar from '../AgentsFilterBar';
import AgentsRecruitmentMap from '../maps/AgentsRecruitmentMap';
import AddCandidateModal from '../Recruitment/AddCandidateModal';
import OpenToWaitingModal from '../Recruitment/OpenToWaitingModal';
import SelectCandidateModal from '../Recruitment/SelectCandidateModal';
import CandidateDrawer from '../Recruitment/CandidateDrawer';

/**
 * Map View tab: the recruitment map on its own, with the territory filter bar
 * above it. The Recruitment tab shows the same map beside a table; this tab is
 * the map-first view for working the territory spatially.
 */
export default function AgentMapTab({ agents }) {
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const [addVillage, setAddVillage] = useState(null);
  const [openingSeat, setOpeningSeat] = useState(null);
  const [selecting, setSelecting] = useState(null);
  const [drawerCandidateId, setDrawerCandidateId] = useState(null);

  // Remounting the map is the simplest way to re-run every join in its data
  // hook after a write that changes seats or candidates.
  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="space-y-4">
      <AgentsFilterBar
        filters={filters}
        onChange={setFilters}
        search={search}
        onSearchChange={setSearch}
        onAddCandidate={() => setAddVillage('')}
      />

      <AgentsRecruitmentMap
        key={refreshKey}
        state={filters.state}
        district={filters.district}
        mandal={filters.mandal}
        agents={agents}
        onAddCandidate={(village) => setAddVillage(village || '')}
        onOpenCandidate={setDrawerCandidateId}
        onOpenToWaiting={setOpeningSeat}
        onSelectCandidate={(candidate, seat) => {
          // Selecting fills a seat, so there has to be an open one to fill.
          if (!seat) {
            window.alert(
              'Every position in this village is already filled or has a candidate selected.'
            );
            return;
          }
          setSelecting({ seat, candidateId: candidate.id });
        }}
      />

      {addVillage !== null && (
        <AddCandidateModal
          initialVillage={addVillage}
          onClose={() => setAddVillage(null)}
          onSaved={refresh}
        />
      )}

      {openingSeat && (
        <OpenToWaitingModal
          position={openingSeat}
          onClose={() => setOpeningSeat(null)}
          onDone={refresh}
        />
      )}

      {selecting && (
        <SelectCandidateModal
          position={selecting.seat}
          preselectCandidateId={selecting.candidateId}
          onClose={() => setSelecting(null)}
          onDone={refresh}
        />
      )}

      {drawerCandidateId && (
        <CandidateDrawer
          candidateId={drawerCandidateId}
          onClose={() => setDrawerCandidateId(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}
