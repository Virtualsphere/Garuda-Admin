import React, { useState, useEffect, useMemo, useCallback } from 'react';
import agentService from '../../services/agentService';
import landService from '../../services/landService';
import useLocations from '../../hooks/useLocations';
import AgentAllotmentMap from './AgentAllotmentMap';
import './AgentsProcessPage.css';

export default function AgentsProcessPage() {
  const [activeSubTab, setActiveSubTab] = useState('allotment');
  const [missionView, setMissionView] = useState('registry');

  const {
    states, districts, mandals, villages,
    selectedState, selectedDistrict, selectedMandal, selectedVillage,
    setSelectedState, setSelectedDistrict, setSelectedMandal, setSelectedVillage,
  } = useLocations();

  const [lands, setLands] = useState([]);
  const [landsLoading, setLandsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [agents, setAgents] = useState([]);
  const [phoneQuery, setPhoneQuery] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [linkedLands, setLinkedLands] = useState([]);

  useEffect(() => {
    const fetchLands = async () => {
      setLandsLoading(true);
      try {
        const data = await landService.getAll();
        setLands(data.data || []);
      } catch (err) {
        console.error('Failed to fetch lands:', err);
        setLands([]);
      } finally {
        setLandsLoading(false);
      }
    };
    fetchLands();
  }, []);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const data = await agentService.getAll({ search: phoneQuery || undefined });
        const list = data.result || data.data || [];
        setAgents(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('Failed to fetch agents:', err);
        setAgents([]);
      }
    };
    fetchAgents();
  }, [phoneQuery]);

  useEffect(() => {
    if (!selectedAgentId) {
      setLinkedLands([]);
      return;
    }
    const fetchLinkedLands = async () => {
      try {
        const data = await agentService.getLinkedLands(selectedAgentId);
        setLinkedLands(data.data || []);
      } catch (err) {
        console.error('Failed to fetch linked lands:', err);
        setLinkedLands([]);
      }
    };
    fetchLinkedLands();
  }, [selectedAgentId]);

  const selectedAgent = agents.find((a) => String(a.id) === String(selectedAgentId));

  // Selects hold location ids; the map endpoint filters on names.
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

  const refreshLinkedLands = useCallback(async () => {
    if (!selectedAgentId) return;
    try {
      const data = await agentService.getLinkedLands(selectedAgentId);
      setLinkedLands(data.data || []);
    } catch (err) {
      console.error('Failed to fetch linked lands:', err);
    }
  }, [selectedAgentId]);

  const missionsData = useMemo(() => {
    return lands
      .filter((land) => {
        if (selectedState) {
          const stateName = states.find((s) => String(s.id) === String(selectedState))?.name;
          if (stateName && land.state !== stateName) return false;
        }
        if (selectedDistrict) {
          const districtName = districts.find((d) => String(d.id) === String(selectedDistrict))?.name;
          if (districtName && land.district !== districtName) return false;
        }
        if (selectedMandal) {
          const mandalName = mandals.find((m) => String(m.id) === String(selectedMandal))?.name;
          if (mandalName && land.mandal !== mandalName) return false;
        }
        if (selectedVillage) {
          const villageName = villages.find((v) => String(v.id) === String(selectedVillage))?.name;
          if (villageName && land.village !== villageName) return false;
        }
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const farmerName = land.farmerDetails?.farmer_name || land.farmerDetails?.name || '';
          if (!farmerName.toLowerCase().includes(q) && !String(land.id).includes(q)) return false;
        }
        return true;
      })
      .map((land) => {
        const farmerName = land.farmerDetails?.farmer_name || land.farmerDetails?.name;
        const linked = linkedLands.find((l) => l.id === land.id);
        return {
          landId: land.id,
          id: `L${String(land.id).padStart(3, '0')}`,
          node: land.village || land.mandal || land.district || 'N/A',
          name: farmerName || '-',
          size: land.landDetails?.total_acres ? `${land.landDetails.total_acres} Ac` : '-',
          val: land.landDetails?.total_value ? `₹${land.landDetails.total_value}` : '-',
          linkedName: linked ? selectedAgent?.name : '',
          linkedInitial: linked && selectedAgent?.name ? selectedAgent.name[0] : '',
        };
      });
  }, [lands, states, districts, mandals, villages, selectedState, selectedDistrict, selectedMandal, selectedVillage, searchQuery, linkedLands, selectedAgent]);

  const handleLink = async (landId) => {
    if (!selectedAgentId) return;
    try {
      await agentService.linkLand(landId, selectedAgentId);
      const data = await agentService.getLinkedLands(selectedAgentId);
      setLinkedLands(data.data || []);
    } catch (err) {
      console.error('Failed to link land to agent:', err);
    }
  };

  return (
    <div className="a-process-page">
      {/* Sub Tabs */}
      <div className="a-process-sub-tabs">
        <button
          className={`a-process-sub-tab${activeSubTab === 'allotment' ? ' active' : ''}`}
          onClick={() => setActiveSubTab('allotment')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
          </svg>
          Allotment
        </button>
        <button className="a-process-sub-tab">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
          Updates
        </button>
        <button className="a-process-sub-tab">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
          Promotion
        </button>
        <button className="a-process-sub-tab">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          Referrals
        </button>
        <button className="a-process-sub-tab">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
          Abstract
        </button>
      </div>

      {/* Main Content Area */}
      <div className="a-process-content">
        <div className="a-process-layout">
          {/* Left Panel */}
          <div className="a-mission-panel">
            <div className="a-mission-header">
              <div className="a-mission-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" /><path d="M8 18h.01" /><path d="M12 18h.01" /><path d="M16 18h.01" /></svg>
                MISSION REGISTRY POOL
              </div>
              <div className="a-mission-toggle">
                <div
                  className={`a-mission-toggle-btn${missionView === 'registry' ? ' active' : ''}`}
                  onClick={() => setMissionView('registry')}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                  REGISTRY
                </div>
                <div
                  className={`a-mission-toggle-btn${missionView === 'map' ? ' active' : ''}`}
                  onClick={() => setMissionView('map')}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></svg>
                  TACTICAL MAP
                </div>
              </div>
              <div className="a-mission-search">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input type="text" placeholder="Search Farmer or ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
            </div>

            <div className="a-mission-filters">
              <select className="a-mission-filter-select" style={{ appearance: 'auto' }} value={selectedState} onChange={(e) => setSelectedState(e.target.value)}>
                <option value="">All States</option>
                {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select className="a-mission-filter-select" style={{ appearance: 'auto' }} value={selectedDistrict} onChange={(e) => setSelectedDistrict(e.target.value)} disabled={!selectedState}>
                <option value="">All Districts</option>
                {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select className="a-mission-filter-select" style={{ appearance: 'auto' }} value={selectedMandal} onChange={(e) => setSelectedMandal(e.target.value)} disabled={!selectedDistrict}>
                <option value="">All Mandals</option>
                {mandals.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <select className="a-mission-filter-select" style={{ appearance: 'auto' }} value={selectedVillage} onChange={(e) => setSelectedVillage(e.target.value)} disabled={!selectedMandal}>
                <option value="">All Villages</option>
                {villages.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>

            {missionView === 'map' && (
              <div className="a-mission-map">
                <AgentAllotmentMap
                  agentId={selectedAgentId}
                  agentName={selectedAgent?.name}
                  state={stateName}
                  district={districtName}
                  mandal={mandalName}
                  village={villageName}
                  onChanged={refreshLinkedLands}
                />
              </div>
            )}

            {missionView === 'registry' && (
            <div className="a-mission-list">
              {landsLoading ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading missions...</div>
              ) : missionsData.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No land records found.</div>
              ) : missionsData.map((mission) => (
                <div key={mission.landId} className="a-mission-item">
                  <div className="a-mission-item-info">
                    {mission.name !== '-' && (
                      <svg className="a-mission-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22C12 22 17 17 17 12C17 7 12 2 12 2C12 2 7 7 7 12C7 17 12 22 12 22Z" /><line x1="12" y1="22" x2="12" y2="12" />
                      </svg>
                    )}
                    <div className="a-mission-item-texts">
                      <span className="a-mission-item-name">{mission.name}</span>
                      <span className="a-mission-item-sub">
                        {mission.id} <span style={{color: '#94a3b8', margin: '0 4px'}}>&bull;</span> <span style={{color: '#64748b'}}>{mission.node}</span>
                      </span>
                    </div>
                  </div>
                  
                  {mission.name !== '-' && (
                    <>
                      <div className="a-mission-item-ac">{mission.size}</div>
                      <div className="a-mission-item-val">{mission.val}</div>
                      <div className="a-mission-item-actions">
                        <div className="a-mission-btn link" onClick={() => handleLink(mission.landId)} style={{ cursor: selectedAgentId ? 'pointer' : 'not-allowed', opacity: selectedAgentId ? 1 : 0.5 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                          LINK
                        </div>
                        <div className="a-mission-btn observe">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12l-10 10-6-6" /></svg>
                          OBSERVE
                        </div>
                      </div>
                      {mission.linkedName && (
                        <div className="a-mission-item-linked">
                          <div className="a-mission-linked-avatar">
                            {/* Dummy avatar logic, using an image if available */}
                            <img src="https://i.pravatar.cc/150?u=a042581f4e29026704d" alt={mission.linkedName} style={{width:'100%', height:'100%', borderRadius:'50%'}} />
                          </div>
                          <div className="a-mission-linked-name">{mission.linkedName}</div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
            )}
          </div>

          {/* Right Panel */}
          <div className="a-deploy-panel">
            <div className="a-deploy-header">
              <div className="a-deploy-title-group">
                <span className="a-deploy-title">FORCE DEPLOYMENT HUB</span>
                <span className="a-deploy-subtitle">REGISTRY CONTEXT & ACTIVE ALLOTMENTS</span>
              </div>
              <svg className="a-deploy-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
            
            <div className="a-deploy-form">
              <div className="a-deploy-row">
                <div className="a-deploy-inputs">
                  <div className="a-deploy-group">
                    <label className="a-deploy-label">IDENTIFY BY PHONE</label>
                    <div className="a-deploy-input">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
                      <input type="text" placeholder="98XXXXXXXX" value={phoneQuery} onChange={(e) => setPhoneQuery(e.target.value)} />
                    </div>
                  </div>
                  <div className="a-deploy-group">
                    <label className="a-deploy-label">REGISTRY SELECTOR</label>
                    <div className="a-deploy-input">
                      <select value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value)}>
                        <option value="">Select agent...</option>
                        {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                {selectedAgent && (
                  <div className="a-deploy-agent-card">
                    <div className="a-deploy-agent-info">
                      <img className="a-deploy-agent-avatar" src={`https://i.pravatar.cc/150?u=${selectedAgent.id}`} alt="Avatar" />
                      <div className="a-deploy-agent-texts">
                        <span className="a-deploy-agent-name">{selectedAgent.name?.toUpperCase()}</span>
                        <span className="a-deploy-agent-id">{`AG${String(selectedAgent.id).padStart(5, '0')}`}</span>
                      </div>
                    </div>
                    <div className="a-deploy-stats">
                      <div className="a-deploy-stat">
                        <span className="a-deploy-stat-label">PORTFOLIO</span>
                        <span className="a-deploy-stat-val blue">₹0.0Cr</span>
                      </div>
                      <div className="a-deploy-stat">
                        <span className="a-deploy-stat-label">PAID DEP.</span>
                        <span className="a-deploy-stat-val green">₹0K</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="a-deploy-tabs">
              <div className="a-deploy-tab active">LINKED (PRIMARY)</div>
              <div className="a-deploy-tab">OBSERVED (INTEL)</div>
            </div>

            <div className="a-deploy-split">
              <div className="a-deploy-col">
                {!selectedAgentId ? (
                  <div className="a-deploy-tab-content">SELECT AN AGENT</div>
                ) : linkedLands.length === 0 ? (
                  <div className="a-deploy-tab-content">NO PRIMARY LINKS</div>
                ) : (
                  linkedLands.map((land) => (
                    <div key={land.id} className="a-mission-item-sub" style={{ padding: '8px 12px' }}>
                      {land.farmerDetails?.farmer_name || land.farmerDetails?.name || `Land #${land.id}`}
                    </div>
                  ))
                )}
              </div>
              <div className="a-deploy-col">
                <div className="a-deploy-tab-content">NO OBSERVED LEADS</div>
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
