import React, { useState, useEffect, useCallback } from 'react';
import locationService from '../../services/locationService';
import './LocationsPage.css';

/**
 * Location directory: States → Districts → (Towns | Mandals → Villages).
 *
 * Receives the App-level `activeTab` as a prop (like HR/Settings) and keeps the
 * parent context (selected state / district / mandal) itself, so it survives
 * tab switches — the "Districts ›" drill-down on a state row both sets the
 * context and switches the tab via `onTabChange`.
 */

const LEVELS = {
  states: {
    title: 'REGISTRY: STATES',
    subtitle: 'ADMINISTRATIVE PERIMETERS AND STATE-LEVEL OVERSIGHT',
    noun: 'state',
    placeholder: 'e.g. Telangana',
    countKey: 'district_count',
    countLabel: 'districts',
    drill: { tab: 'districts', label: 'Districts' },
  },
  districts: {
    title: 'REGISTRY: DISTRICTS',
    subtitle: 'ADMINISTRATIVE DISTRICTS AND TERRITORIAL BOUNDARIES',
    noun: 'district',
    placeholder: 'e.g. Rangareddy',
    countKey: 'mandal_count',
    countLabel: 'mandals',
    drill: { tab: 'mandals', label: 'Mandals' },
    needs: ['state'],
    parentKey: 'state_id',
  },
  towns: {
    title: 'REGISTRY: TOWNS',
    subtitle: 'URBAN ADMINISTRATIVE CENTERS AND MUNICIPALITIES',
    noun: 'town',
    placeholder: 'e.g. Shamshabad',
    needs: ['state', 'district'],
    parentKey: 'district_id',
  },
  mandals: {
    title: 'REGISTRY: MANDALS',
    subtitle: 'ADMINISTRATIVE MANDALS AND TERRITORIAL CLUSTERING',
    noun: 'mandal',
    placeholder: 'e.g. Shankarpally',
    countKey: 'village_count',
    countLabel: 'villages',
    drill: { tab: 'villages', label: 'Villages' },
    needs: ['state', 'district'],
    parentKey: 'district_id',
  },
  villages: {
    title: 'REGISTRY: VILLAGES',
    subtitle: 'VILLAGE DRAFTING AND TERRITORIAL CLUSTERING',
    noun: 'village',
    placeholder: 'Enter village name...',
    needs: ['state', 'district', 'mandal'],
    parentKey: 'mandal_id',
  },
};

const unwrap = (data) => {
  const list = data?.data || data || [];
  return Array.isArray(list) ? list : [];
};

const byName = (a, b) => String(a.name).trim().localeCompare(String(b.name).trim());

export default function LocationsPage({ activeTab, onTabChange }) {
  const level = LEVELS[activeTab];

  const [stateId, setStateId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [mandalId, setMandalId] = useState('');

  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [mandals, setMandals] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const parentIdFor = useCallback(
    (tab) => {
      if (tab === 'districts') return stateId;
      if (tab === 'towns' || tab === 'mandals') return districtId;
      if (tab === 'villages') return mandalId;
      return null;
    },
    [stateId, districtId, mandalId]
  );

  // ─── Context dropdown sources ──────────────────────────────────
  const loadStates = useCallback(async () => {
    const list = unwrap(await locationService.getStates()).sort(byName);
    setStates(list);
    return list;
  }, []);

  useEffect(() => {
    loadStates().catch((err) => {
      console.error('Failed to load states:', err);
      setError('Could not load states.');
    });
  }, [loadStates]);

  useEffect(() => {
    setDistricts([]);
    if (!stateId) return;
    locationService
      .list('districts', stateId)
      .then((data) => setDistricts(unwrap(data).sort(byName)))
      .catch((err) => console.error('Failed to load districts:', err));
  }, [stateId]);

  useEffect(() => {
    setMandals([]);
    if (!districtId) return;
    locationService
      .list('mandals', districtId)
      .then((data) => setMandals(unwrap(data).sort(byName)))
      .catch((err) => console.error('Failed to load mandals:', err));
  }, [districtId]);

  // ─── Rows for the active level ─────────────────────────────────
  const loadRows = useCallback(async () => {
    if (!level) return;
    setError(null);
    if (activeTab === 'states') {
      setLoading(true);
      try {
        await loadStates();
      } catch (err) {
        console.error('Failed to load states:', err);
        setError('Could not load states.');
      } finally {
        setLoading(false);
      }
      return;
    }

    const parentId = parentIdFor(activeTab);
    if (!parentId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const list = unwrap(await locationService.list(activeTab, parentId)).sort(byName);
      setRows(list);
      // Keep the context dropdowns in step with what was just changed.
      if (activeTab === 'districts') setDistricts(list);
      if (activeTab === 'mandals') setMandals(list);
    } catch (err) {
      console.error(`Failed to load ${activeTab}:`, err);
      setError(`Could not load ${activeTab}.`);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, level, parentIdFor, loadStates]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  // Reset the inline form whenever the level changes.
  useEffect(() => {
    setName('');
    setEditing(null);
    setSearch('');
    setNotice(null);
  }, [activeTab]);

  // ─── Context changes cascade downward ──────────────────────────
  const changeState = (id) => {
    setStateId(id);
    setDistrictId('');
    setMandalId('');
  };

  const changeDistrict = (id) => {
    setDistrictId(id);
    setMandalId('');
  };

  const clearContext = () => {
    changeState('');
  };

  const drillDown = (row) => {
    const target = level?.drill?.tab;
    if (!target) return;
    if (activeTab === 'states') changeState(String(row.id));
    if (activeTab === 'districts') changeDistrict(String(row.id));
    if (activeTab === 'mandals') setMandalId(String(row.id));
    onTabChange(target);
  };

  // ─── CRUD ──────────────────────────────────────────────────────
  const flash = (text) => {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 3000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    const parentId = parentIdFor(activeTab);
    if (level.parentKey && !parentId) {
      setError(`Select the ${level.needs[level.needs.length - 1]} first.`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await locationService.update(activeTab, editing.id, { name: trimmed });
        flash(`${level.noun[0].toUpperCase()}${level.noun.slice(1)} updated.`);
      } else {
        const payload = { name: trimmed };
        if (level.parentKey) payload[level.parentKey] = Number(parentId);
        await locationService.create(activeTab, payload);
        flash(`${level.noun[0].toUpperCase()}${level.noun.slice(1)} added.`);
      }
      setName('');
      setEditing(null);
      await loadRows();
    } catch (err) {
      console.error('Failed to save location:', err);
      setError(err.response?.data?.message || `Failed to save ${level.noun}.`);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row) => {
    setEditing(row);
    setName(String(row.name || '').trim());
  };

  const cancelEdit = () => {
    setEditing(null);
    setName('');
  };

  const handleDelete = async (row) => {
    const cascade = activeTab === 'states' ? ' All of its districts, mandals and villages will also be deleted.' : '';
    if (!window.confirm(`Delete ${level.noun} "${String(row.name).trim()}"?${cascade}`)) return;
    setError(null);
    try {
      await locationService.delete(activeTab, row.id);
      if (editing && String(editing.id) === String(row.id)) cancelEdit();
      // Deleting the selected parent leaves its context pointing at nothing.
      if (activeTab === 'states' && String(row.id) === String(stateId)) changeState('');
      if (activeTab === 'districts' && String(row.id) === String(districtId)) changeDistrict('');
      if (activeTab === 'mandals' && String(row.id) === String(mandalId)) setMandalId('');
      flash(`${level.noun[0].toUpperCase()}${level.noun.slice(1)} deleted.`);
      await loadRows();
    } catch (err) {
      console.error('Failed to delete location:', err);
      setError(err.response?.data?.message || `Failed to delete ${level.noun}.`);
    }
  };

  if (!level) {
    return <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Page coming soon...</div>;
  }

  const visibleRows = (activeTab === 'states' ? states : rows).filter((row) =>
    !search.trim() || String(row.name).toLowerCase().includes(search.trim().toLowerCase())
  );
  const missingContext = level.parentKey && !parentIdFor(activeTab);
  const needs = level.needs || [];

  return (
    <div className="loc-page">
      <div className="loc-card">
        <div className="loc-card-header">
          <div className="loc-title-group">
            <span className="loc-title">{level.title}</span>
            <span className="loc-subtitle">{level.subtitle}</span>
          </div>
          <div className="loc-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input type="text" placeholder={`Search ${activeTab}...`} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {needs.length > 0 && (
          <div className="loc-context">
            <div className="loc-field">
              <span className="loc-label">State context</span>
              <select value={stateId} onChange={(e) => changeState(e.target.value)}>
                <option value="">Select state</option>
                {states.map((s) => <option key={s.id} value={s.id}>{String(s.name).trim()}</option>)}
              </select>
            </div>
            {needs.includes('district') && (
              <div className="loc-field">
                <span className="loc-label">District context</span>
                <select value={districtId} onChange={(e) => changeDistrict(e.target.value)} disabled={!stateId}>
                  <option value="">Select district</option>
                  {districts.map((d) => <option key={d.id} value={d.id}>{String(d.name).trim()}</option>)}
                </select>
              </div>
            )}
            {needs.includes('mandal') && (
              <div className="loc-field">
                <span className="loc-label">Mandal context</span>
                <select value={mandalId} onChange={(e) => setMandalId(e.target.value)} disabled={!districtId}>
                  <option value="">Select mandal</option>
                  {mandals.map((m) => <option key={m.id} value={m.id}>{String(m.name).trim()}</option>)}
                </select>
              </div>
            )}
            {stateId && (
              <button type="button" className="loc-clear-btn" onClick={clearContext}>Clear context</button>
            )}
          </div>
        )}

        <form className="loc-add-form" onSubmit={handleSubmit}>
          <div className="loc-field loc-field--grow">
            <span className="loc-label">{editing ? `Rename ${level.noun}` : `New ${level.noun} name`}</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={level.placeholder}
              disabled={missingContext}
              required
            />
          </div>
          <button type="submit" className="loc-primary-btn" disabled={saving || missingContext || !name.trim()}>
            {saving ? 'Saving...' : editing ? 'Update' : `Add ${level.noun}`}
          </button>
          {editing && (
            <button type="button" className="loc-ghost-btn" onClick={cancelEdit}>Cancel</button>
          )}
        </form>

        {error && (
          <div className="loc-alert error">
            {error}
            <button type="button" onClick={() => setError(null)} aria-label="Dismiss">×</button>
          </div>
        )}
        {notice && <div className="loc-alert success">{notice}</div>}

        <div className="loc-table-wrap">
          {missingContext ? (
            <div className="loc-empty">Select the {needs.join(', ')} context to list {activeTab}.</div>
          ) : (
            <table className="loc-table">
              <thead>
                <tr>
                  <th>{level.noun} name</th>
                  {level.countKey && <th>Capacity</th>}
                  <th className="loc-col-actions">Management</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="3" className="loc-empty">Loading...</td></tr>
                ) : visibleRows.length === 0 ? (
                  <tr><td colSpan="3" className="loc-empty">No {activeTab} found.</td></tr>
                ) : visibleRows.map((row) => (
                  <tr key={row.id} className={editing && String(editing.id) === String(row.id) ? 'is-editing' : ''}>
                    <td className="loc-name">{String(row.name).trim()}</td>
                    {level.countKey && (
                      <td className="loc-meta">
                        {row[level.countKey] !== undefined ? `${row[level.countKey]} ${level.countLabel} registered` : '—'}
                      </td>
                    )}
                    <td className="loc-col-actions">
                      <div className="loc-actions">
                        <button type="button" className="loc-icon-btn" onClick={() => startEdit(row)} title="Rename">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                        </button>
                        {level.drill && (
                          <button type="button" className="loc-drill-btn" onClick={() => drillDown(row)}>
                            {level.drill.label}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                          </button>
                        )}
                        <button type="button" className="loc-icon-btn danger" onClick={() => handleDelete(row)} title="Delete">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
