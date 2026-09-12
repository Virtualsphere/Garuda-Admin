import React, { useState, useMemo } from 'react';
import AgentTacticalMap from './AgentTacticalMap';
import useLocations from '../../hooks/useLocations';
import './AgentsMapPage.css';

// The tactical map filters on location *names*; the selects hold ids.
const nameById = (list, id) => list.find((x) => String(x.id) === String(id))?.name;

export default function AgentsMapPage() {
  const [searchQuery, setSearchQuery] = useState('');

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

  const hasFilters = Boolean(selectedState || searchQuery);

  const clearAll = () => {
    resetLocations();
    setSearchQuery('');
  };

  return (
    <div className="amp-page">
      <div className="amp-header">
        <div className="amp-title-group">
          <svg className="amp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
          </svg>
          <div className="amp-title-texts">
            <span className="amp-title">TERRITORIAL SATURATION MAP</span>
            <span className="amp-subtitle">AGENT DEPLOYMENT AGAINST VILLAGE REQUIREMENT</span>
          </div>
        </div>

        <div className="amp-controls">
          <select
            className="amp-select"
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            disabled={locationsLoading.states}
            aria-label="State"
          >
            <option value="">{locationsLoading.states ? 'Loading…' : 'All states'}</option>
            {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select
            className="amp-select"
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            disabled={!selectedState || locationsLoading.districts}
            aria-label="District"
          >
            <option value="">{locationsLoading.districts ? 'Loading…' : 'All districts'}</option>
            {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select
            className="amp-select"
            value={selectedMandal}
            onChange={(e) => setSelectedMandal(e.target.value)}
            disabled={!selectedDistrict || locationsLoading.mandals}
            aria-label="Mandal"
          >
            <option value="">{locationsLoading.mandals ? 'Loading…' : 'All mandals'}</option>
            {mandals.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>

          <div className="amp-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              id="amp-search-input"
              type="text"
              placeholder="Village or agent…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {hasFilters && (
            <button type="button" className="amp-clear" onClick={clearAll}>
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="amp-surface">
        <AgentTacticalMap
          state={stateName}
          district={districtName}
          mandal={mandalName}
          searchQuery={searchQuery}
        />
      </div>
    </div>
  );
}
