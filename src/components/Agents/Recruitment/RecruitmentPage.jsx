import React, { useState, useEffect, useCallback, useMemo } from 'react';
import recruitmentService from '../../../services/recruitmentService';
import useLocations from '../../../hooks/useLocations';
import CandidateDrawer from './CandidateDrawer';
import AddCandidateModal from './AddCandidateModal';
import OpenToWaitingModal from './OpenToWaitingModal';
import SelectCandidateModal from './SelectCandidateModal';
import SyncSeatsModal from './SyncSeatsModal';
import { PIPELINE_STAGES, STAGE_LABELS, POSITION_LABELS } from './recruitmentConstants';
import './RecruitmentPage.css';

const nameById = (list, id) => list.find((x) => String(x.id) === String(id))?.name;

export default function RecruitmentPage() {
  const [view, setView] = useState('pipeline');
  const [candidates, setCandidates] = useState([]);
  const [positions, setPositions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [stageFilter, setStageFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [drawerCandidateId, setDrawerCandidateId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [openingSeat, setOpeningSeat] = useState(null);
  const [selectingSeat, setSelectingSeat] = useState(null);
  const [syncOpen, setSyncOpen] = useState(false);

  const {
    states, districts, mandals,
    selectedState, selectedDistrict, selectedMandal,
    setSelectedState, setSelectedDistrict, setSelectedMandal,
    resetLocations,
    loading: locationsLoading,
  } = useLocations();

  const stateName = useMemo(() => nameById(states, selectedState), [states, selectedState]);
  const districtName = useMemo(() => nameById(districts, selectedDistrict), [districts, selectedDistrict]);
  const mandalName = useMemo(() => nameById(mandals, selectedMandal), [mandals, selectedMandal]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const locationFilters = {
        state: stateName,
        district: districtName,
        mandal: mandalName,
      };

      const [candidatesData, positionsData, statsData] = await Promise.all([
        recruitmentService.getCandidates({
          ...locationFilters,
          status: stageFilter === 'ALL' ? undefined : stageFilter,
          search: searchQuery || undefined,
        }),
        recruitmentService.getPositions(locationFilters),
        recruitmentService.getStats().catch(() => ({ result: null })),
      ]);

      setCandidates(candidatesData.result || candidatesData.data || []);
      setPositions(positionsData.result || positionsData.data || []);
      setStats(statsData.result || null);
    } catch (err) {
      console.error('Failed to load recruitment data:', err);
      setError(
        err.response?.status === 404
          ? 'Recruitment endpoints are not available yet. Run the migration and restart the API.'
          : 'Could not load recruitment data.'
      );
    } finally {
      setLoading(false);
    }
  }, [stateName, districtName, mandalName, stageFilter, searchQuery]);

  useEffect(() => { load(); }, [load]);

  const hasFilters = Boolean(selectedState || searchQuery || stageFilter !== 'ALL');

  const clearAll = () => {
    resetLocations();
    setSearchQuery('');
    setStageFilter('ALL');
  };

  const totalVacancy = positions.reduce((sum, p) => sum + (Number(p.vacancy) || 0), 0);
  const nativeSearchSeats = positions.filter((p) => p.status === 'NATIVE_SEARCH').length;
  const openedSeats = positions.filter((p) => p.status === 'OPEN_TO_WAITING_CANDIDATES').length;

  return (
    <div className="rec-page">
      {/* Header */}
      <div className="rec-header">
        <div className="rec-title-group">
          <svg className="rec-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
          </svg>
          <div className="rec-title-texts">
            <span className="rec-title">AGENT LEADS &amp; RECRUITMENT</span>
            <span className="rec-subtitle">CANDIDATE PIPELINE AND VILLAGE SEAT ALLOCATION</span>
          </div>
        </div>

        <div className="rec-header-right">
          {view === 'seats' && (
            <button type="button" className="rec-clear" onClick={() => setSyncOpen(true)}>
              Create seats
            </button>
          )}
          <button type="button" className="rec-add-btn" onClick={() => setAddOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add candidate
          </button>
          <div className="rec-toggle">
            <button
              type="button"
              className={`rec-toggle-btn${view === 'pipeline' ? ' active' : ''}`}
              onClick={() => setView('pipeline')}
            >
              Pipeline
            </button>
            <button
              type="button"
              className={`rec-toggle-btn${view === 'seats' ? ' active' : ''}`}
              onClick={() => setView('seats')}
            >
              Village seats
            </button>
          </div>
        </div>
      </div>

      {error && <div className="rec-error">{error}</div>}

      {/* Summary tiles */}
      <div className="rec-tiles">
        <div className="rec-tile rec-tile-accent">
          <span className="rec-tile-label">Active candidates</span>
          <span className="rec-tile-value">{stats ? stats.activeCandidates : '—'}</span>
        </div>
        <div className="rec-tile">
          <span className="rec-tile-label">Seats open</span>
          <span className="rec-tile-value">{loading ? '—' : totalVacancy}</span>
        </div>
        <div className="rec-tile">
          <span className="rec-tile-label">Under native search</span>
          <span className="rec-tile-value">{loading ? '—' : nativeSearchSeats}</span>
        </div>
        <div className="rec-tile">
          <span className="rec-tile-label">Opened to waiting</span>
          <span className="rec-tile-value">{loading ? '—' : openedSeats}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="rec-filters">
        <select
          className="rec-select"
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
          disabled={locationsLoading.states}
          aria-label="State"
        >
          <option value="">{locationsLoading.states ? 'Loading…' : 'All states'}</option>
          {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select
          className="rec-select"
          value={selectedDistrict}
          onChange={(e) => setSelectedDistrict(e.target.value)}
          disabled={!selectedState || locationsLoading.districts}
          aria-label="District"
        >
          <option value="">{locationsLoading.districts ? 'Loading…' : 'All districts'}</option>
          {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select
          className="rec-select"
          value={selectedMandal}
          onChange={(e) => setSelectedMandal(e.target.value)}
          disabled={!selectedDistrict || locationsLoading.mandals}
          aria-label="Mandal"
        >
          <option value="">{locationsLoading.mandals ? 'Loading…' : 'All mandals'}</option>
          {mandals.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        {view === 'pipeline' && (
          <select
            className="rec-select"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            aria-label="Pipeline stage"
          >
            <option value="ALL">All stages</option>
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>{STAGE_LABELS[s] || s}</option>
            ))}
          </select>
        )}

        <div className="rec-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            id="rec-search-input"
            type="text"
            placeholder="Name or phone…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {hasFilters && (
          <button type="button" className="rec-clear" onClick={clearAll}>Clear</button>
        )}
      </div>

      {/* Body */}
      <div className="rec-body">
        {loading ? (
          <div className="rec-empty">Loading…</div>
        ) : view === 'pipeline' ? (
          candidates.length === 0 ? (
            <div className="rec-empty">
              No candidates match these filters. Add one to start the pipeline.
            </div>
          ) : (
            <table className="rec-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Home village</th>
                  <th>Interests</th>
                  <th>Stage</th>
                  <th>Source</th>
                  <th aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => {
                  const interests = c.interests || [];
                  const nativeCount = interests.filter((i) => i.is_native).length;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setDrawerCandidateId(c.id)}
                      className="rec-row"
                    >
                      <td>
                        <div className="rec-cand">
                          <span className="rec-cand-name">{c.name}</span>
                          <span className="rec-cand-sub">{c.phone}</span>
                        </div>
                      </td>
                      <td>{c.village || '—'}</td>
                      <td>
                        {interests.length === 0 ? (
                          <span className="rec-muted">none</span>
                        ) : (
                          <span className="rec-interest-count">
                            {interests.length}
                            {nativeCount > 0 && <span className="rec-native-dot" title="Includes a native village" />}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`rec-stage rec-stage-${(c.status || '').toLowerCase()}`}>
                          {STAGE_LABELS[c.status] || c.status}
                        </span>
                      </td>
                      <td className="rec-muted">{c.lead_source || '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="rec-row-btn"
                          onClick={(e) => { e.stopPropagation(); setDrawerCandidateId(c.id); }}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        ) : positions.length === 0 ? (
          <div className="rec-empty">
            <p>
              No village seats yet. How many seats a village gets is sized from its land
              acreage and the required-agents slab table in Settings.
            </p>
            <button type="button" className="rec-add-btn rec-empty-btn" onClick={() => setSyncOpen(true)}>
              Create seats
            </button>
          </div>
        ) : (
          <table className="rec-table">
            <thead>
              <tr>
                <th>Village</th>
                <th>Seat</th>
                <th>Status</th>
                <th className="rec-num">Deployed</th>
                <th className="rec-num">Required</th>
                <th className="rec-num">Vacancy</th>
                <th aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="rec-cand">
                      <span className="rec-cand-name">{p.village}</span>
                      <span className="rec-cand-sub">{p.mandal || '—'}</span>
                    </div>
                  </td>
                  <td className="rec-muted">#{p.position_number}</td>
                  <td>
                    <span className={`rec-seat rec-seat-${(p.status || '').toLowerCase()}`}>
                      {POSITION_LABELS[p.status] || p.status}
                    </span>
                  </td>
                  <td className="rec-num">{p.deployed_agents ?? '—'}</td>
                  <td className="rec-num">{p.required_agents ?? '—'}</td>
                  <td className="rec-num">
                    {p.vacancy > 0
                      ? <strong className="rec-vacancy">{p.vacancy}</strong>
                      : <span className="rec-muted">0</span>}
                  </td>
                  <td>
                    <div className="rec-row-actions">
                      {p.status === 'NATIVE_SEARCH' && (
                        <button
                          type="button"
                          className="rec-row-btn rec-row-btn-ghost"
                          onClick={() => setOpeningSeat(p)}
                        >
                          Open to waiting
                        </button>
                      )}
                      {['VACANT', 'NATIVE_SEARCH', 'WAITING_CANDIDATES_AVAILABLE', 'OPEN_TO_WAITING_CANDIDATES'].includes(p.status) && (
                        <button
                          type="button"
                          className="rec-row-btn"
                          onClick={() => setSelectingSeat(p)}
                        >
                          Select
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Overlays */}
      {addOpen && (
        <AddCandidateModal onClose={() => setAddOpen(false)} onSaved={load} />
      )}

      {drawerCandidateId && (
        <CandidateDrawer
          candidateId={drawerCandidateId}
          onClose={() => setDrawerCandidateId(null)}
          onChanged={load}
        />
      )}

      {openingSeat && (
        <OpenToWaitingModal
          position={openingSeat}
          onClose={() => setOpeningSeat(null)}
          onDone={load}
        />
      )}

      {selectingSeat && (
        <SelectCandidateModal
          position={selectingSeat}
          onClose={() => setSelectingSeat(null)}
          onDone={load}
        />
      )}

      {syncOpen && (
        <SyncSeatsModal
          positions={positions}
          filters={{ state: stateName, district: districtName, mandal: mandalName }}
          onClose={() => setSyncOpen(false)}
          onDone={load}
        />
      )}
    </div>
  );
}
