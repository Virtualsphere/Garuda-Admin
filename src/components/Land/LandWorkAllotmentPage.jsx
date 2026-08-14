import React, { useState, useEffect, useCallback } from 'react';
import employeeService from '../../services/employeeService';
import assignedVillageService from '../../services/assignedVillageService';
import './LandWorkAllotmentPage.css';

export default function LandWorkAllotmentPage() {
  const [activeSubTab, setActiveSubTab] = useState('villages');

  const [employees, setEmployees] = useState([]);
  const [selectedExecutiveId, setSelectedExecutiveId] = useState('');

  const [villages, setVillages] = useState([]);
  const [villagesLoading, setVillagesLoading] = useState(true);
  const [villagesError, setVillagesError] = useState(null);

  const [search, setSearch] = useState('');
  const [allottingKey, setAllottingKey] = useState(null);
  const [allotError, setAllotError] = useState(null);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const data = await employeeService.getAll();
        const empList = data.data || data.employees || data || [];
        setEmployees(Array.isArray(empList) ? empList : []);
      } catch (err) {
        console.error('Failed to fetch employees:', err);
      }
    };
    fetchEmployees();
  }, []);

  const fetchVillages = useCallback(async () => {
    setVillagesLoading(true);
    setVillagesError(null);
    try {
      const data = await assignedVillageService.getVillageStats(
        selectedExecutiveId ? { employeeId: selectedExecutiveId } : {}
      );
      setVillages(data.result || []);
    } catch (err) {
      console.error('Failed to fetch village stats:', err);
      setVillagesError('Failed to load villages. Please try again.');
    } finally {
      setVillagesLoading(false);
    }
  }, [selectedExecutiveId]);

  useEffect(() => {
    fetchVillages();
  }, [fetchVillages]);

  const selectedExecutive = employees.find((e) => String(e.id) === String(selectedExecutiveId));

  const filteredVillages = villages.filter((v) => {
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    return v.village?.toLowerCase().includes(term) || v.mandal?.toLowerCase().includes(term);
  });

  const handleAllot = async (villageStat) => {
    if (!selectedExecutiveId) return;
    const key = `${villageStat.village}|${villageStat.mandal}`;
    setAllottingKey(key);
    setAllotError(null);
    try {
      await assignedVillageService.create({
        target: villageStat.total,
        assignedEmployeeId: selectedExecutiveId,
        village: villageStat.village,
        mandal: villageStat.mandal,
        assignedStatus: 'ongoing',
      });
      await fetchVillages();
    } catch (err) {
      console.error('Failed to allot village:', err);
      setAllotError(`Failed to allot ${villageStat.village}. Please try again.`);
    } finally {
      setAllottingKey(null);
    }
  };

  return (
    <div className="lwa-page">
      <div className="lwa-sub-tabs">
        <button
          className={`lwa-sub-tab${activeSubTab === 'villages' ? ' active' : ''}`}
          onClick={() => setActiveSubTab('villages')}
        >
          Villages allotment
        </button>
        <button className="lwa-sub-tab" disabled title="Coming soon">
          Data tasks
        </button>
        <button className="lwa-sub-tab" disabled title="Coming soon">
          Mission profile
        </button>
      </div>

      {activeSubTab !== 'villages' ? (
        <div className="lwa-placeholder">Page coming soon...</div>
      ) : (
        <>
          <div className="lwa-banner">
            <div className="lwa-banner-person">
              <div className="lwa-banner-avatar">
                <img
                  src={selectedExecutive?.photo || `https://i.pravatar.cc/150?u=${selectedExecutive?.id || 'lve'}`}
                  alt={selectedExecutive?.name || 'No executive selected'}
                />
              </div>
              <div>
                <div className="lwa-banner-name">
                  {selectedExecutive?.name || 'Select an executive'}
                </div>
                <span className="lwa-banner-role">Land Verification Executive</span>
              </div>
            </div>
            <div className="lwa-banner-context">
              <span className="lwa-banner-context-label">LVE Context</span>
              <select
                value={selectedExecutiveId}
                onChange={(e) => setSelectedExecutiveId(e.target.value)}
              >
                <option value="">Select executive</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="lwa-body">
            <div className="lwa-personnel-card">
              <div className="lwa-personnel-title">Personnel Selection</div>
              <label className="lwa-personnel-label" htmlFor="lwa-active-executive">Active Executive</label>
              <select
                id="lwa-active-executive"
                value={selectedExecutiveId}
                onChange={(e) => setSelectedExecutiveId(e.target.value)}
              >
                <option value="">Select an executive</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>

            <div className="lwa-villages-panel">
              <div className="lwa-villages-header">
                <div className="lwa-view-toggle">
                  <button className="active">List</button>
                  <button disabled title="Coming soon">Map</button>
                </div>
                <span className="lwa-allotable-label">Allotable villages</span>
                <div className="lwa-search">
                  <input
                    type="text"
                    placeholder="Search node..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              {allotError && <div className="lwa-error-banner">{allotError}</div>}
              {villagesError && <div className="lwa-error-banner">{villagesError}</div>}

              <div className="lwa-grid-scroll">
                {villagesLoading ? (
                  <div className="lwa-loading">Loading villages...</div>
                ) : filteredVillages.length === 0 ? (
                  <div className="lwa-empty">No allotable villages found.</div>
                ) : (
                  <div className="lwa-grid">
                    {filteredVillages.map((v) => {
                      const key = `${v.village}|${v.mandal}`;
                      return (
                        <div className="lwa-card" key={key}>
                          <div className="lwa-card-head">
                            <div>
                              <div className="lwa-card-village">{v.village}</div>
                              <div className="lwa-card-mandal">{v.mandal}</div>
                            </div>
                            <span className="lwa-card-target">T: {v.total}</span>
                          </div>
                          <div className="lwa-card-stats">
                            <div className="lwa-card-stat-row">
                              <span className="lwa-card-stat-label">Verified</span>
                              <span className={`lwa-card-stat-value${v.verified === 0 ? ' zero' : ''}`}>{v.verified}</span>
                            </div>
                            <div className="lwa-card-stat-row">
                              <span className="lwa-card-stat-label">Physical audit</span>
                              <span className={`lwa-card-stat-value${v.physicalAudit === 0 ? ' zero' : ''}`}>{v.physicalAudit}</span>
                            </div>
                            <div className="lwa-card-stat-row">
                              <span className="lwa-card-stat-label">Fill details</span>
                              <span className={`lwa-card-stat-value${v.fillDetails === 0 ? ' zero' : ''}`}>{v.fillDetails}</span>
                            </div>
                          </div>
                          <button
                            className="lwa-allot-btn"
                            disabled={!selectedExecutiveId || allottingKey === key}
                            onClick={() => handleAllot(v)}
                          >
                            {allottingKey === key ? 'Allotting...' : '+ Allot village'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
