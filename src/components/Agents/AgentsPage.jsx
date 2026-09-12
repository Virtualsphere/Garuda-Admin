import React, { useState, useEffect, useMemo, useCallback } from 'react';
import agentService from '../../services/agentService';
import useLocations from '../../hooks/useLocations';
import AgentTacticalMap from './AgentTacticalMap';
import AgentFormModal from './AgentFormModal';
import AgentProfileDrawer from './AgentProfileDrawer';
import './AgentsPage.css';

export default function AgentsPage() {
  const [activeToggle, setActiveToggle] = useState('registry');
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // `formAgent` holds the record being edited, or {} for a new enlistment;
  // null closes the modal. `drawerAgent` drives the profile drawer.
  const [formAgent, setFormAgent] = useState(null);
  const [drawerAgent, setDrawerAgent] = useState(null);
  const [actionError, setActionError] = useState(null);

  const {
    states, districts, mandals, villages,
    selectedState, selectedDistrict, selectedMandal, selectedVillage,
    setSelectedState, setSelectedDistrict, setSelectedMandal, setSelectedVillage,
    loading: locationsLoading,
  } = useLocations();

  // The API filters on names, the selects hold ids — resolve once so both the
  // registry fetch and the tactical map read the same values.
  const stateName = useMemo(
    () => states.find((s) => String(s.id) === String(selectedState))?.name,
    [states, selectedState]
  );
  const districtName = useMemo(
    () => districts.find((d) => String(d.id) === String(selectedDistrict))?.name,
    [districts, selectedDistrict]
  );
  const mandalName = useMemo(
    () => mandals.find((m) => String(m.id) === String(selectedMandal))?.name,
    [mandals, selectedMandal]
  );
  const villageName = useMemo(
    () => villages.find((v) => String(v.id) === String(selectedVillage))?.name,
    [villages, selectedVillage]
  );

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await agentService.getAll({
        state: stateName,
        district: districtName,
        mandal: mandalName,
        village: villageName,
        search: searchQuery || undefined,
      });
      const list = data.result || data.data || [];
      setAgents(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [stateName, districtName, mandalName, villageName, searchQuery]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleDelete = async (agent) => {
    const confirmed = window.confirm(
      `Remove ${agent.name} from the agent registry? This cannot be undone.`
    );
    if (!confirmed) return;

    setActionError(null);
    try {
      await agentService.delete(agent.id);
      if (String(drawerAgent?.id) === String(agent.id)) setDrawerAgent(null);
      await fetchAgents();
    } catch (err) {
      setActionError(err.response?.data?.message || `Could not remove ${agent.name}.`);
    }
  };

  // Keep the source record on each row so the drawer and the edit modal get
  // the real agent, not the display projection.
  const matchesData = agents.map((agent) => ({
    raw: agent,
    name: agent.name,
    id: `AG${String(agent.id).padStart(5, '0')}`,
    node: `${agent.village || agent.mandal || agent.district || 'Unassigned'} Node`,
    phone: agent.phone,
    active: true,
    avatar: agent.photo || `https://i.pravatar.cc/150?u=${agent.id}`,
  }));

  return (
    <div className="a-main-page">
      {/* Header */}
      <div className="a-main-header">
        <div className="a-main-title-group">
          <svg className="a-main-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <path d="M8 14h.01" />
            <path d="M12 14h.01" />
            <path d="M16 14h.01" />
            <path d="M8 18h.01" />
            <path d="M12 18h.01" />
            <path d="M16 18h.01" />
          </svg>
          <div className="a-main-title-texts">
            <span className="a-main-title">AGENT TACTICAL PORTAL</span>
            <span className="a-main-subtitle">SOURCING LIFECYCLE AND PERSONNEL OVERSIGHT REGISTRY</span>
          </div>
        </div>
        <div className="a-main-header-right">
        <button type="button" className="a-enlist-btn" onClick={() => setFormAgent({})}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
          </svg>
          Enlist agent
        </button>
        <div className="a-main-toggle">
          <div
            className={`a-toggle-btn${activeToggle === 'registry' ? ' active' : ''}`}
            onClick={() => setActiveToggle('registry')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
            AGENT REGISTRY
          </div>
          <div
            className={`a-toggle-btn${activeToggle === 'map' ? ' active' : ''}`}
            onClick={() => setActiveToggle('map')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></svg>
            SATURATION MAP
          </div>
          <div
            className={`a-toggle-btn${activeToggle === 'personnel' ? ' active' : ''}`}
            onClick={() => setActiveToggle('personnel')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            PERSONNEL FILE
          </div>
        </div>
        </div>
      </div>

      {actionError && <div className="a-action-error">{actionError}</div>}

      {/* Main Layout */}
      <div className="a-main-layout">
        {/* Left Filters Panel */}
        <div className="a-filters-panel">
          <div className="a-filters-header">
            1. TACTICAL PARAMETERS
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
          </div>
          
          <div className="a-filter-group">
            <label className="a-filter-label">MISSION IDENTITY</label>
            <div className="a-filter-input">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input type="text" placeholder="Name, ID or Phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>

          <div className="a-filter-group">
            <label className="a-filter-label">OPERATIONAL STATE</label>
            <select className="a-filter-select" style={{ appearance: 'auto' }} value={selectedState} onChange={(e) => setSelectedState(e.target.value)} disabled={locationsLoading.states}>
              <option value="">{locationsLoading.states ? 'Loading...' : 'All States'}</option>
              {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="a-filter-group">
            <label className="a-filter-label">DISTRICT CONTEXT</label>
            <select className="a-filter-select" style={{ appearance: 'auto' }} value={selectedDistrict} onChange={(e) => setSelectedDistrict(e.target.value)} disabled={!selectedState || locationsLoading.districts}>
              <option value="">{locationsLoading.districts ? 'Loading...' : 'All Districts'}</option>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div className="a-filter-group">
            <label className="a-filter-label">MANDAL REGISTRY</label>
            <select className="a-filter-select" style={{ appearance: 'auto' }} value={selectedMandal} onChange={(e) => setSelectedMandal(e.target.value)} disabled={!selectedDistrict || locationsLoading.mandals}>
              <option value="">{locationsLoading.mandals ? 'Loading...' : 'All Mandals'}</option>
              {mandals.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          <div className="a-filter-group">
            <label className="a-filter-label">VILLAGE NODE</label>
            <select className="a-filter-select" style={{ appearance: 'auto' }} value={selectedVillage} onChange={(e) => setSelectedVillage(e.target.value)} disabled={!selectedMandal || locationsLoading.villages}>
              <option value="">{locationsLoading.villages ? 'Loading...' : 'All Villages'}</option>
              {villages.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
        </div>

        {/* Right Content Panel */}
        <div className="a-content-panel">
          <div className="a-content-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            {activeToggle === 'map'
              ? '2. TERRITORIAL SATURATION'
              : `2. PERSONNEL MATCHES (${matchesData.length})`}
          </div>

          {activeToggle === 'map' && (
            <div className="a-content-map">
              <AgentTacticalMap
                state={stateName}
                district={districtName}
                mandal={mandalName}
                searchQuery={searchQuery}
              />
            </div>
          )}

          {activeToggle === 'personnel' && (
            <div style={{ padding: '24px', color: 'var(--text-muted)' }}>
              Personnel file coming soon...
            </div>
          )}

          {activeToggle === 'registry' && (
          <div className="a-content-list">
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading agents...</div>
            ) : matchesData.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No agents found.</div>
            ) : matchesData.map((person) => (
              <div
                key={person.raw.id}
                className="a-person-card"
                role="button"
                tabIndex={0}
                onClick={() => setDrawerAgent(person.raw)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setDrawerAgent(person.raw);
                  }
                }}
              >
                <div className="a-person-info">
                  <div className="a-person-avatar">
                    <img src={person.avatar} alt={person.name} />
                  </div>
                  <div className="a-person-details">
                    <div className="a-person-name-row">
                      <span className="a-person-name">{person.name}</span>
                      <span className="a-person-id">{person.id}</span>
                    </div>
                    <div className="a-person-contact">
                      <div className="a-person-contact-item">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                        {person.node}
                      </div>
                      <div className="a-person-contact-item">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
                        {person.phone}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="a-person-actions">
                  <div className={`a-person-status ${person.active ? 'active' : 'inactive'}`}>
                    {person.active ? 'ACTIVE' : 'INACTIVE'}
                  </div>
                  <div className="a-person-tools">
                    <button
                      type="button"
                      className="a-person-tool"
                      title={`Edit ${person.name}`}
                      aria-label={`Edit ${person.name}`}
                      onClick={(e) => { e.stopPropagation(); setFormAgent(person.raw); }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="a-person-tool a-person-tool-danger"
                      title={`Remove ${person.name}`}
                      aria-label={`Remove ${person.name}`}
                      onClick={(e) => { e.stopPropagation(); handleDelete(person.raw); }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                  <svg className="a-person-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      </div>

      {formAgent && (
        <AgentFormModal
          agent={formAgent.id ? formAgent : null}
          onClose={() => setFormAgent(null)}
          onSaved={fetchAgents}
        />
      )}

      {drawerAgent && (
        <AgentProfileDrawer
          agent={drawerAgent}
          onClose={() => setDrawerAgent(null)}
          onEdit={(agent) => { setDrawerAgent(null); setFormAgent(agent); }}
          onChanged={fetchAgents}
        />
      )}
    </div>
  );
}
