import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Users2, Building2, Loader2, AlertTriangle } from 'lucide-react';

import AgentsFilterBar from '../AgentsFilterBar';
import AgentsRecruitmentMap from '../maps/AgentsRecruitmentMap';
import DataTable from '../common/DataTable';
import Badge from '../common/Badge';
import CallButton from '../common/CallButton';
import StatCard from '../common/StatCard';
import AddCandidateModal from '../Recruitment/AddCandidateModal';
import OpenToWaitingModal from '../Recruitment/OpenToWaitingModal';
import SelectCandidateModal from '../Recruitment/SelectCandidateModal';
import CandidateDrawer from '../Recruitment/CandidateDrawer';
import SyncSeatsModal from '../Recruitment/SyncSeatsModal';
import recruitmentService from '../../../services/recruitmentService';
import {
  STAGE_LABELS,
  TERMINAL_STAGES,
  POSITION_LABELS,
} from '../Recruitment/recruitmentConstants';

const STAGE_VARIANTS = {
  NEW_LEAD: 'blue',
  FIRST_CALL: 'blue',
  INTERESTED: 'green',
  LOCATION_CHECK: 'green',
  VILLAGE_INTEREST: 'yellow',
  WAITING: 'yellow',
  SELECTED: 'orange',
  OFFICE_VISIT: 'purple',
  JOINING_PROCESS: 'purple',
  JOINED: 'green',
};

const SEAT_VARIANTS = {
  VACANT: 'red',
  NATIVE_SEARCH: 'red',
  WAITING_CANDIDATES_AVAILABLE: 'yellow',
  OPEN_TO_WAITING_CANDIDATES: 'yellow',
  CANDIDATE_SELECTED: 'blue',
  JOINING: 'purple',
  FILLED: 'green',
};

/**
 * Agent leads and recruitment: the same territory shown two ways — spatially
 * on the map, or as the candidate pipeline and seat register in tables.
 */
export default function AgentRecruitmentTab({ agents }) {
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState('');
  const [view, setView] = useState('MAP');
  const [table, setTable] = useState('PIPELINE');

  const [candidates, setCandidates] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [addVillage, setAddVillage] = useState(null);
  const [openingSeat, setOpeningSeat] = useState(null);
  const [selecting, setSelecting] = useState(null);
  const [drawerCandidateId, setDrawerCandidateId] = useState(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const [mapKey, setMapKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const locationFilter = {
        state: filters.state || undefined,
        district: filters.district || undefined,
        mandal: filters.mandal || undefined,
        village: filters.village || undefined,
      };

      const [candidatesData, positionsData] = await Promise.all([
        recruitmentService.getCandidates({
          ...locationFilter,
          search: search || undefined,
        }),
        recruitmentService.getPositions(locationFilter),
      ]);

      setCandidates(candidatesData.result || candidatesData.data || []);
      setPositions(positionsData.result || positionsData.data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load recruitment data:', err);
      setError('Could not load the recruitment pipeline.');
    } finally {
      setLoading(false);
    }
  }, [filters, search]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = () => {
    load();
    setMapKey((k) => k + 1);
  };

  const activeCandidates = useMemo(
    () => candidates.filter((c) => !TERMINAL_STAGES.includes(c.status)),
    [candidates]
  );

  const candidateColumns = [
    {
      header: 'Candidate',
      accessorKey: 'name',
      sortable: true,
      cell: (row) => (
        <button
          type="button"
          onClick={() => setDrawerCandidateId(row.id)}
          className="flex items-center gap-2.5 text-left"
        >
          <div className="w-8 h-8 rounded-full bg-[#2563EB] text-white text-xs font-black flex items-center justify-center shrink-0">
            {String(row.name || '?').charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-[#1c1917] hover:text-[#2563EB] truncate">
              {row.name}
            </div>
            <div className="text-[10px] text-[#78716c]">{row.phone}</div>
          </div>
        </button>
      ),
    },
    {
      header: 'Home village',
      accessorKey: 'village',
      sortable: true,
      cell: (row) => (
        <div>
          <div className="font-bold text-xs text-[#1c1917]">{row.village || '—'}</div>
          <div className="text-[10px] text-[#78716c]">
            {row.mandal || '—'}, {row.district || '—'}
          </div>
        </div>
      ),
    },
    {
      header: 'Villages of interest',
      cell: (row) => {
        const list = row.interests || [];
        if (!list.length) return <span className="text-[10px] text-[#78716c]">None linked</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {list.slice(0, 3).map((i) => (
              <span
                key={i.id}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  i.is_native
                    ? 'bg-[#2563EB]/10 text-[#2563EB]'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {i.village}
              </span>
            ))}
            {list.length > 3 && (
              <span className="text-[10px] text-[#78716c] font-bold">+{list.length - 3}</span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Stage',
      accessorKey: 'status',
      sortable: true,
      cell: (row) => (
        <Badge variant={STAGE_VARIANTS[row.status] || 'gray'}>
          {STAGE_LABELS[row.status] || row.status}
        </Badge>
      ),
    },
    {
      header: 'Source',
      accessorKey: 'lead_source',
      cell: (row) => (
        <span className="text-[11px] text-[#57534e] font-semibold">
          {String(row.lead_source || 'DIRECT').replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <CallButton
            phone={row.phone}
            recordName={row.name}
            recordId={row.id}
            recordType="AGENT_CANDIDATE"
            variant="outline"
          />
          <button
            type="button"
            onClick={() => setDrawerCandidateId(row.id)}
            className="px-2.5 py-1 rounded-lg bg-gray-100 text-[#1c1917] hover:bg-[#2563EB] hover:text-white text-[11px] font-bold transition-colors"
          >
            Open
          </button>
        </div>
      ),
    },
  ];

  const seatColumns = [
    {
      header: 'Village',
      accessorKey: 'village',
      sortable: true,
      cell: (row) => (
        <div>
          <div className="font-bold text-xs text-[#1c1917]">{row.village}</div>
          <div className="text-[10px] text-[#78716c]">
            {row.mandal || '—'}, {row.district || '—'}
          </div>
        </div>
      ),
    },
    {
      header: 'Seat',
      accessorKey: 'position_number',
      sortable: true,
      cell: (row) => (
        <span className="font-black text-xs text-[#1c1917]">#{row.position_number}</span>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      sortable: true,
      cell: (row) => (
        <Badge variant={SEAT_VARIANTS[row.status] || 'gray'}>
          {POSITION_LABELS[row.status] || row.status}
        </Badge>
      ),
    },
    {
      header: 'Occupant',
      cell: (row) =>
        row.agent ? (
          <div>
            <div className="font-bold text-xs text-[#2563EB]">{row.agent.name}</div>
            <div className="text-[10px] text-[#78716c]">{row.agent.phone}</div>
          </div>
        ) : row.selectedCandidate ? (
          <div>
            <div className="font-bold text-xs text-blue-700">
              {row.selectedCandidate.name}
            </div>
            <div className="text-[10px] text-[#78716c]">selected, not yet joined</div>
          </div>
        ) : (
          <span className="text-[10px] text-[#78716c]">Unfilled</span>
        ),
    },
    {
      header: 'Requirement',
      accessorKey: 'required_agents',
      sortable: true,
      cell: (row) => (
        <div className="text-xs">
          <span className="font-black text-[#1c1917]">{row.deployed_agents}</span>
          <span className="text-[#78716c]"> / {row.required_agents}</span>
          {row.vacancy > 0 && (
            <span className="ml-1.5 text-[10px] font-bold text-rose-600">
              {row.vacancy} short
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {row.status === 'NATIVE_SEARCH' && (
            <button
              type="button"
              onClick={() => setOpeningSeat(row)}
              className="px-2.5 py-1 rounded-lg bg-[#F59E0B] text-white text-[11px] font-bold hover:bg-[#D97706]"
            >
              Open to waiting
            </button>
          )}
          {row.status !== 'FILLED' && (
            <button
              type="button"
              onClick={() => setSelecting({ seat: row })}
              className="px-2.5 py-1 rounded-lg bg-[#1c1917] text-white text-[11px] font-bold hover:bg-[#292524]"
            >
              Select
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <AgentsFilterBar
        filters={filters}
        onChange={setFilters}
        search={search}
        onSearchChange={setSearch}
        view={view}
        onViewChange={setView}
        onAddCandidate={() => setAddVillage('')}
      />

      {/* Pipeline stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          title="Active candidates"
          value={activeCandidates.length}
          subtext={`${candidates.length} total on record`}
          icon={Users2}
          variant="orange"
        />
        <StatCard
          title="Seats tracked"
          value={positions.length}
          subtext={`${positions.filter((p) => p.status === 'FILLED').length} filled`}
          icon={Building2}
          variant="green"
        />
        <StatCard
          title="Open seats"
          value={positions.filter((p) => p.status !== 'FILLED').length}
          subtext="Awaiting an appointment"
        />
        <StatCard
          title="Joined"
          value={candidates.filter((c) => c.status === 'JOINED').length}
          subtext="Converted into agents"
        />
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl px-4 py-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {view === 'MAP' ? (
        <AgentsRecruitmentMap
          key={mapKey}
          state={filters.state}
          district={filters.district}
          mandal={filters.mandal}
          agents={agents}
          onAddCandidate={(village) => setAddVillage(village || '')}
          onOpenCandidate={setDrawerCandidateId}
          onOpenToWaiting={setOpeningSeat}
          onSelectCandidate={(candidate, seat) => {
            if (!seat) {
              window.alert(
                'Every position in this village is already filled or has a candidate selected.'
              );
              return;
            }
            setSelecting({ seat, candidateId: candidate.id });
          }}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="inline-flex rounded-lg border border-[#e7e5e4] p-0.5 bg-[#f5f5f4]">
              <button
                type="button"
                onClick={() => setTable('PIPELINE')}
                className={`px-3 py-1 text-xs font-bold rounded-md ${
                  table === 'PIPELINE' ? 'bg-white text-[#2563EB] shadow-sm' : 'text-[#78716c]'
                }`}
              >
                Candidate pipeline ({candidates.length})
              </button>
              <button
                type="button"
                onClick={() => setTable('SEATS')}
                className={`px-3 py-1 text-xs font-bold rounded-md ${
                  table === 'SEATS' ? 'bg-white text-[#2563EB] shadow-sm' : 'text-[#78716c]'
                }`}
              >
                Village seats ({positions.length})
              </button>
            </div>

            <div className="flex items-center gap-2">
              {table === 'SEATS' && (
                <button
                  type="button"
                  onClick={() => setSyncOpen(true)}
                  className="px-3 py-1.5 rounded-lg border border-[#e7e5e4] bg-white text-xs font-bold text-[#1c1917] hover:border-[#2563EB]"
                >
                  Sync seats
                </button>
              )}
              <button
                type="button"
                onClick={refresh}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e7e5e4] bg-white text-xs font-bold text-[#1c1917] hover:border-[#2563EB]"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="bg-white rounded-xl border border-[#e7e5e4] py-16 flex items-center justify-center">
              <span className="flex items-center gap-2 text-xs font-bold text-[#78716c]">
                <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading…
              </span>
            </div>
          ) : table === 'PIPELINE' ? (
            <DataTable
              data={candidates}
              columns={candidateColumns}
              searchPlaceholder="Search candidates by name, phone or village…"
              searchFilterKeys={['name', 'phone', 'village', 'mandal', 'status']}
              emptyMessage="No candidates match these filters."
              exportFileName="garuda-agent-candidates.csv"
            />
          ) : (
            <DataTable
              data={positions}
              columns={seatColumns}
              searchPlaceholder="Search seats by village…"
              searchFilterKeys={['village', 'mandal', 'status']}
              emptyMessage="No village seats have been synced for these filters."
              exportFileName="garuda-village-seats.csv"
            />
          )}
        </div>
      )}

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

      {syncOpen && (
        <SyncSeatsModal
          positions={positions}
          filters={filters}
          onClose={() => setSyncOpen(false)}
          onDone={refresh}
        />
      )}
    </div>
  );
}
