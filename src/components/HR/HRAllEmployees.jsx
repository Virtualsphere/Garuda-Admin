import React, { useState, useEffect, useCallback } from 'react';
import employeeService from '../../services/employeeService';
import roleService from '../../services/roleService';
import { useAuth } from '../../context/AuthContext';
import mediaUrl from '../../utils/mediaUrl';
import HREmployeeForm from './HREmployeeForm';
import HRRolesModal from './HRRolesModal';
import './HRAllEmployees.css';

const PAGE_SIZE = 15;
const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DEACTIVE', label: 'Inactive' },
  { value: 'TRAINEE', label: 'Trainee' },
];

// Display helpers derived from the free-text role.
const getDesigType = (role) => {
  if (!role) return 'executive';
  const r = role.toLowerCase();
  if (r.includes('ceo') || r.includes('director')) return 'leadership';
  if (r.includes('head')) return 'lands-head';
  if (r.includes('team leader') || r.includes('tl')) return 'team-leader';
  return 'executive';
};

const getEnv = (role) => {
  if (!role) return 'FIELD';
  const r = role.toLowerCase();
  if (r.includes('ceo') || r.includes('director') || r.includes('head') || r.includes('team leader') || r.includes('tl')) return 'OFFICE';
  return 'FIELD';
};

const getBU = (role) => {
  if (!role) return 'GENERAL';
  const r = role.toLowerCase();
  if (r.includes('ceo') || r.includes('director')) return 'LEADERSHIP';
  if (r.includes('land')) return 'LANDS';
  if (r.includes('farmer')) return 'FARMERS';
  if (r.includes('agent')) return 'AGENTS';
  return 'GENERAL';
};

const getEmpId = (emp) => `GTS${String(emp.id).padStart(5, '0')}`;

const listText = (value) => (Array.isArray(value) ? value.filter(Boolean).join(', ') : value || '');

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

function DetailRow({ label, value }) {
  return (
    <div className="hr-detail-row">
      <span>{label}</span>
      <strong>{value === null || value === undefined || value === '' ? '—' : value}</strong>
    </div>
  );
}

export default function HRAllEmployees() {
  const { hasPermission, permissionsLoaded } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => new Set());
  // 'list' | 'create' | 'edit' | 'detail'
  const [view, setView] = useState('list');
  const [current, setCurrent] = useState(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const flash = (text) => {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 3500);
  };

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const data = await employeeService.getAll();
      const empList = data.data || data.employees || data || [];
      setEmployees(Array.isArray(empList) ? empList : []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch employees:', err);
      setError('Failed to load employees');
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const data = await roleService.getAll();
      const list = data.data || data || [];
      setRoles(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to fetch roles:', err);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
    fetchRoles();
  }, [fetchEmployees, fetchRoles]);

  // ─── Filtering & paging ────────────────────────────────────────
  const filteredEmployees = employees.filter((emp) => {
    const q = searchQuery.trim().toLowerCase();
    if (q && !(
      emp.name?.toLowerCase().includes(q) ||
      emp.email?.toLowerCase().includes(q) ||
      emp.phone?.includes(q) ||
      getEmpId(emp).toLowerCase().includes(q)
    )) return false;
    if (deptFilter !== 'all' && !emp.role?.toLowerCase().includes(deptFilter)) return false;
    if (roleFilter !== 'all' && emp.role !== roleFilter) return false;
    if (statusFilter !== 'all' && emp.status !== statusFilter) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredEmployees.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Any filter change returns to page 1.
  useEffect(() => { setPage(1); }, [searchQuery, deptFilter, roleFilter, statusFilter]);

  const toggleSelected = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allOnPageSelected = pageRows.length > 0 && pageRows.every((emp) => selected.has(emp.id));
  const toggleSelectPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      pageRows.forEach((emp) => (allOnPageSelected ? next.delete(emp.id) : next.add(emp.id)));
      return next;
    });
  };

  // ─── Actions ───────────────────────────────────────────────────
  const handleDelete = async (emp) => {
    if (!window.confirm(`Delete ${emp.name} (${getEmpId(emp)})? This cannot be undone.`)) return;
    try {
      await employeeService.delete(emp.id);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(emp.id);
        return next;
      });
      flash(`${emp.name} deleted.`);
      setView('list');
      setCurrent(null);
      fetchEmployees();
    } catch (err) {
      console.error('Failed to delete employee:', err);
      setError(err.response?.data?.message || 'Failed to delete employee.');
    }
  };

  const handleBulkDelete = async () => {
    if (!selected.size) return;
    if (!window.confirm(`Delete ${selected.size} employee${selected.size > 1 ? 's' : ''}? This cannot be undone.`)) return;
    setDeleting(true);
    const results = await Promise.allSettled([...selected].map((id) => employeeService.delete(id)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    setDeleting(false);
    setSelected(new Set());
    flash(`Deleted ${results.length - failed} employee${results.length - failed === 1 ? '' : 's'}${failed ? `, ${failed} failed` : ''}.`);
    fetchEmployees();
  };

  const handleExport = () => {
    if (!filteredEmployees.length) return;
    const headers = ['ID', 'Name', 'Email', 'Phone', 'Role', 'Status', 'State', 'District', 'Mandal', 'Village'];
    const rows = filteredEmployees.map((emp) => [
      getEmpId(emp), emp.name, emp.email, emp.phone, emp.role, emp.status,
      emp.work_state, listText(emp.work_district), listText(emp.work_mandal), listText(emp.work_village),
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `employees-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openForm = (emp) => {
    setCurrent(emp);
    setView(emp ? 'edit' : 'create');
  };

  const handleSaved = (message) => {
    flash(message);
    setView('list');
    setCurrent(null);
    fetchEmployees();
  };

  if (!hasPermission('employees')) {
    return (
      <div style={{ padding: '24px', color: 'var(--text-muted)' }}>
        {permissionsLoaded ? 'You do not have access to the employee registry.' : 'Checking access...'}
      </div>
    );
  }

  if (view === 'create' || view === 'edit') {
    return (
      <div className="hr-emp-page">
        <HREmployeeForm
          key={current?.id || 'new'}
          employee={view === 'edit' ? current : null}
          roles={roles}
          onCancel={() => { setView(current ? 'detail' : 'list'); if (view === 'create') setCurrent(null); }}
          onSaved={handleSaved}
        />
      </div>
    );
  }

  if (view === 'detail' && current) {
    const emp = current;
    return (
      <div className="hr-emp-page">
        <div className="hr-emp-header">
          <div className="hr-emp-title-texts">
            <button type="button" className="hr-back-btn" onClick={() => { setView('list'); setCurrent(null); }}>‹ Back to registry</button>
            <span className="hr-emp-title">{emp.name}</span>
            <span className="hr-emp-subtitle">{getEmpId(emp)} • {emp.role || 'NO ROLE'}</span>
          </div>
          <div className="hr-emp-actions">
            <button type="button" className="hr-emp-global-btn danger" onClick={() => handleDelete(emp)}>Delete</button>
            <button type="button" className="hr-primary-btn" onClick={() => openForm(emp)}>Edit file</button>
          </div>
        </div>
        <div className="hr-detail-grid">
          <section className="hr-detail-card">
            <h4>Contact</h4>
            <DetailRow label="Email" value={emp.email} />
            <DetailRow label="Phone" value={emp.phone} />
            <DetailRow label="Other phone" value={emp.other_phone} />
            <DetailRow label="Address" value={emp.address} />
            <DetailRow label="Status" value={<span className={`hr-status ${String(emp.status || '').toLowerCase()}`}>{emp.status || '—'}</span>} />
          </section>
          <section className="hr-detail-card">
            <h4>Work location</h4>
            <DetailRow label="State" value={emp.work_state} />
            <DetailRow label="District" value={listText(emp.work_district)} />
            <DetailRow label="Mandal" value={listText(emp.work_mandal)} />
            <DetailRow label="Village" value={listText(emp.work_village)} />
          </section>
          <section className="hr-detail-card">
            <h4>Salary package</h4>
            <DetailRow label="New land" value={`₹${emp.new_land_price || 0}`} />
            <DetailRow label="Verification" value={`₹${emp.verification_price || 0}`} />
            <DetailRow label="Buyer visit" value={`₹${emp.buyer_visit_price || 0}`} />
            <DetailRow label="Referral" value={`₹${emp.referal_price || 0}`} />
          </section>
          <section className="hr-detail-card">
            <h4>Personal & bank</h4>
            <DetailRow label="Blood group" value={emp.blood_group} />
            <DetailRow label="Shirt size" value={emp.shirt_size} />
            <DetailRow
              label="Aadhar"
              value={emp.aadhar_photo
                ? <>{emp.aadhar_number || 'Photo'} <a href={mediaUrl(emp.aadhar_photo)} target="_blank" rel="noopener noreferrer">(view)</a></>
                : emp.aadhar_number}
            />
            <DetailRow label="Bank" value={emp.bank_name} />
            <DetailRow label="Account no" value={emp.account_number} />
            <DetailRow label="IFSC" value={emp.ifsc_code} />
            <DetailRow label="UPI" value={emp.upi_id} />
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="hr-emp-page">
      {/* Header */}
      <div className="hr-emp-header">
        <div className="hr-emp-title-group">
          <svg className="hr-emp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <div className="hr-emp-title-texts">
            <span className="hr-emp-title">MASTER PERSONNEL REGISTRY</span>
            <span className="hr-emp-subtitle">GLOBAL ORGANIZATIONAL RESOURCE POOL ({filteredEmployees.length} PERSONNEL)</span>
          </div>
        </div>
        <div className="hr-emp-actions">
          <button type="button" className="hr-emp-global-btn" onClick={() => setRolesOpen(true)}>Manage roles</button>
          <button type="button" className="hr-emp-global-btn" onClick={handleExport} disabled={!filteredEmployees.length}>Export CSV</button>
          <button type="button" className="hr-primary-btn" onClick={() => openForm(null)}>+ Add employee</button>
        </div>
      </div>

      <div className="hr-emp-filters">
        <div className="hr-emp-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" placeholder="Name, email, phone or ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <select className="hr-emp-select-native" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
          <option value="all">All departments</option>
          <option value="land">Lands</option>
          <option value="farmer">Farmers</option>
          <option value="agent">Agents</option>
          <option value="ceo">Leadership</option>
        </select>
        <select className="hr-emp-select-native" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">All roles</option>
          {roles.map((role) => <option key={role.id} value={role.name}>{role.name}</option>)}
        </select>
        <select className="hr-emp-select-native" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {STATUS_FILTERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {notice && <div className="hr-alert success">{notice}</div>}
      {selected.size > 0 && (
        <div className="hr-bulk-bar">
          <span>{selected.size} employee{selected.size > 1 ? 's' : ''} selected</span>
          <div className="hr-emp-actions">
            <button type="button" className="hr-emp-global-btn" onClick={() => setSelected(new Set())}>Clear</button>
            <button type="button" className="hr-emp-global-btn danger" onClick={handleBulkDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete selected'}
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading employees...</div>
      )}
      {error && (
        <div className="hr-alert error">
          {error}
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {!loading && (
       <div className="hr-emp-table-container">
        <div className="hr-emp-table-wrap">
          <table className="hr-emp-table">
            <thead>
              <tr>
                <th className="hr-col-check">
                  <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectPage} aria-label="Select page" />
                </th>
                <th>PERSONNEL IDENTITY</th>
                <th>BUSINESS UNIT</th>
                <th>CADRE / DESIGNATION</th>
                <th>ENVIRONMENT</th>
                <th>OPERATIONAL NODE</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((emp) => {
                const env = getEnv(emp.role);
                const avatarUrl = emp.photo ? mediaUrl(emp.photo) : `https://i.pravatar.cc/150?u=${emp.id}`;

                return (
                <tr key={emp.id} className={selected.has(emp.id) ? 'is-selected' : ''}>
                  <td className="hr-col-check">
                    <input type="checkbox" checked={selected.has(emp.id)} onChange={() => toggleSelected(emp.id)} aria-label={`Select ${emp.name}`} />
                  </td>
                  <td>
                    <div className="hr-emp-identity">
                      <div className="hr-emp-avatar">
                        <img src={avatarUrl} alt={emp.name} />
                      </div>
                      <div className="hr-emp-name-group">
                        <span className="hr-emp-name">{emp.name}</span>
                        <span className="hr-emp-id">{getEmpId(emp)}{emp.phone ? ` • ${emp.phone}` : ''}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="hr-emp-bu">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
                      {getBU(emp.role)}
                    </span>
                  </td>
                  <td>
                    <span className={`hr-emp-badge ${getDesigType(emp.role)}`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                      {emp.role || 'N/A'}
                    </span>
                  </td>
                  <td>
                    <span className={`hr-emp-env ${env.toLowerCase()}`}>
                      {env === 'OFFICE' ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" /></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                      )}
                      {env}
                    </span>
                  </td>
                  <td>
                    <span className="hr-emp-node">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                      {[listText(emp.work_district), emp.work_state].filter(Boolean).join(', ') || 'N/A'}
                    </span>
                  </td>
                  <td>
                    <span className={`hr-status ${String(emp.status || '').toLowerCase()}`}>{emp.status || '—'}</span>
                  </td>
                  <td>
                    <div className="hr-row-actions">
                      <button className="hr-emp-action-btn" onClick={() => { setCurrent(emp); setView('detail'); }}>
                        VIEW / EDIT FILE
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                      </button>
                      <button className="hr-emp-action-btn danger icon" onClick={() => handleDelete(emp)} title="Delete employee" aria-label={`Delete ${emp.name}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No employees found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredEmployees.length > PAGE_SIZE && (
          <div className="hr-pagination">
            <span>
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredEmployees.length)} of {filteredEmployees.length}
            </span>
            <div className="hr-emp-actions">
              <button type="button" className="hr-emp-action-btn" onClick={() => setPage(safePage - 1)} disabled={safePage === 1}>‹ Prev</button>
              <span className="hr-page-indicator">Page {safePage} / {totalPages}</span>
              <button type="button" className="hr-emp-action-btn" onClick={() => setPage(safePage + 1)} disabled={safePage === totalPages}>Next ›</button>
            </div>
          </div>
        )}
      </div>
      )}

      {rolesOpen && <HRRolesModal roles={roles} onClose={() => setRolesOpen(false)} onChanged={fetchRoles} />}
    </div>
  );
}
