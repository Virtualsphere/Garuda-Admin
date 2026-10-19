import React, { useState, useEffect, useMemo } from 'react';
import permissionService from '../../services/permissionService';
import roleService from '../../services/roleService';
import employeeService from '../../services/employeeService';
import { useAuth } from '../../context/AuthContext';
import './SettingsPermissions.css';

const MODES = [
  { key: 'roles', label: 'Roles' },
  { key: 'employees', label: 'Employee overrides' },
];

const OVERRIDE_STATES = [
  { value: 'DEFAULT', label: 'Role default' },
  { value: 'ALLOW', label: 'Allow' },
  { value: 'DENY', label: 'Deny' },
];

// Where each permission key lives in this panel (the catalog's `path` is the old panel's route).
const PERMISSION_WHERE = {
  add_land: 'Land › Land data › Add land',
  location: 'Locations',
  employees: 'HR › All employees',
  call_verification: 'Land › Verification › Phone list, Verify details, Trainee observation',
  physical_verification: 'Land › Verification › Physical list',
  final_verification: 'Land › Verification › Review details, Verified lands',
};

const unwrapList = (data) => {
  const list = data?.data || data || [];
  return Array.isArray(list) ? list : [];
};

function RoleMatrix({ catalog, roles }) {
  const [role, setRole] = useState('');
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState(null);

  const effectiveRole = role || roles[0]?.name || '';

  useEffect(() => {
    if (!effectiveRole) return;
    let cancelled = false;
    setLoading(true);
    setMessage(null);
    permissionService
      .getRolePermissions(effectiveRole)
      .then((data) => {
        if (cancelled) return;
        setKeys(data.data?.permissions || []);
        setDirty(false);
      })
      .catch((err) => {
        console.error('Failed to load role permissions:', err);
        if (!cancelled) setMessage({ type: 'error', text: 'Could not load this role’s permissions.' });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [effectiveRole]);

  const toggle = (key) => {
    setKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await permissionService.setRolePermissions(effectiveRole, keys);
      setDirty(false);
      setMessage({ type: 'success', text: `Saved permissions for ${effectiveRole}.` });
    } catch (err) {
      console.error('Failed to save role permissions:', err);
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save role permissions.' });
    } finally {
      setSaving(false);
    }
  };

  const isAdminRole = effectiveRole.trim().toLowerCase() === 'admin';

  return (
    <div className="perm-panel">
      <div className="perm-toolbar">
        <label className="perm-field">
          <span>Role</span>
          <select value={effectiveRole} onChange={(e) => setRole(e.target.value)}>
            {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
          </select>
        </label>
        <button type="button" className="perm-save-btn" onClick={save} disabled={!effectiveRole || !dirty || saving || loading}>
          {saving ? 'Saving...' : dirty ? 'Save changes' : 'Saved'}
        </button>
      </div>

      {isAdminRole && <div className="perm-note">ADMIN always has access to every page, whatever is ticked here.</div>}
      {message && <div className={`perm-alert ${message.type}`}>{message.text}</div>}

      <div className="perm-list">
        {catalog.map((perm) => (
          <label key={perm.key} className={`perm-item${loading ? ' is-loading' : ''}`}>
            <input type="checkbox" checked={keys.includes(perm.key)} onChange={() => toggle(perm.key)} disabled={loading} />
            <div>
              <span className="perm-label">{perm.label}</span>
              <span className="perm-where">{PERMISSION_WHERE[perm.key] || perm.path}</span>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

function EmployeeOverrides({ catalog, employees }) {
  const [search, setSearch] = useState('');
  const [employee, setEmployee] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [effective, setEffective] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState(null);

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = term
      ? employees.filter((e) => e.name?.toLowerCase().includes(term) || e.email?.toLowerCase().includes(term) || e.phone?.includes(term))
      : employees;
    return list.slice(0, 20);
  }, [employees, search]);

  const load = async (emp) => {
    setEmployee(emp);
    setLoading(true);
    setMessage(null);
    try {
      const data = await permissionService.getEmployeePermissions(emp.id);
      const payload = data.data || {};
      const map = {};
      (payload.overrides || []).forEach((o) => { map[o.permissionKey] = o.type; });
      setOverrides(map);
      setEffective(payload.isAdmin ? catalog.map((c) => c.key) : payload.keys || []);
      setDirty(false);
    } catch (err) {
      console.error('Failed to load employee permissions:', err);
      setMessage({ type: 'error', text: 'Could not load this employee’s permissions.' });
    } finally {
      setLoading(false);
    }
  };

  const setState = (key, value) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (value === 'DEFAULT') delete next[key];
      else next[key] = value;
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const list = Object.entries(overrides).map(([permissionKey, type]) => ({ permissionKey, type }));
      await permissionService.setEmployeePermissions(employee.id, list);
      const refreshed = await permissionService.getEmployeePermissions(employee.id);
      const payload = refreshed.data || {};
      setEffective(payload.isAdmin ? catalog.map((c) => c.key) : payload.keys || []);
      setDirty(false);
      setMessage({ type: 'success', text: `Saved overrides for ${employee.name}.` });
    } catch (err) {
      console.error('Failed to save employee permissions:', err);
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save employee permissions.' });
    } finally {
      setSaving(false);
    }
  };

  if (!employee) {
    return (
      <div className="perm-panel">
        <label className="perm-field perm-field--wide">
          <span>Find employee</span>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email or phone..." />
        </label>
        <div className="perm-employee-list">
          {matches.map((emp) => (
            <button key={emp.id} type="button" className="perm-employee" onClick={() => load(emp)}>
              <span className="perm-label">{emp.name}</span>
              <span className="perm-where">{emp.email} • {emp.role || 'No role'}</span>
            </button>
          ))}
          {matches.length === 0 && <div className="perm-empty">No employees found.</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="perm-panel">
      <div className="perm-toolbar">
        <div className="perm-selected">
          <span className="perm-label">{employee.name}</span>
          <span className="perm-where">{employee.email} • {employee.role || 'No role'}</span>
        </div>
        <div className="perm-toolbar-actions">
          <button type="button" className="perm-ghost-btn" onClick={() => { setEmployee(null); setOverrides({}); setMessage(null); }}>
            Change employee
          </button>
          <button type="button" className="perm-save-btn" onClick={save} disabled={!dirty || saving || loading}>
            {saving ? 'Saving...' : dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>
      </div>

      {message && <div className={`perm-alert ${message.type}`}>{message.text}</div>}

      <div className="perm-list">
        {catalog.map((perm) => {
          const current = overrides[perm.key] || 'DEFAULT';
          return (
            <div key={perm.key} className={`perm-item perm-item--override${loading ? ' is-loading' : ''}`}>
              <div>
                <span className="perm-label">
                  {perm.label}
                  {!dirty && effective.includes(perm.key) && <span className="perm-effective">has access</span>}
                </span>
                <span className="perm-where">{PERMISSION_WHERE[perm.key] || perm.path}</span>
              </div>
              <div className="perm-segment">
                {OVERRIDE_STATES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    className={`perm-segment-btn ${s.value.toLowerCase()}${current === s.value ? ' active' : ''}`}
                    onClick={() => setState(perm.key, s.value)}
                    disabled={loading}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Settings › Permissions — which pages each role / employee can open. Admin only. */
export default function SettingsPermissions() {
  const { isAdmin, permissionsLoaded } = useAuth();
  const [mode, setMode] = useState('roles');
  const [catalog, setCatalog] = useState([]);
  const [roles, setRoles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAdmin) return;
    Promise.all([permissionService.getCatalog(), roleService.getAll(), employeeService.getAll()])
      .then(([catalogData, roleData, employeeData]) => {
        setCatalog(unwrapList(catalogData));
        setRoles(unwrapList(roleData));
        setEmployees(unwrapList(employeeData));
      })
      .catch((err) => {
        console.error('Failed to load permissions data:', err);
        setError('Could not load permissions.');
      });
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div style={{ padding: '24px', color: 'var(--text-muted)' }}>
        {permissionsLoaded ? 'Only administrators can manage permissions.' : 'Checking access...'}
      </div>
    );
  }

  return (
    <div className="perm-page">
      <div className="perm-header">
        <div>
          <span className="perm-title">PAGE PERMISSIONS</span>
          <span className="perm-subtitle">CONTROL WHICH PAGES EACH ROLE OR EMPLOYEE CAN OPEN</span>
        </div>
        <div className="perm-modes">
          {MODES.map((m) => (
            <button key={m.key} type="button" className={`perm-mode${mode === m.key ? ' active' : ''}`} onClick={() => setMode(m.key)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="perm-alert error">{error}</div>}

      {mode === 'roles'
        ? <RoleMatrix catalog={catalog} roles={roles} />
        : <EmployeeOverrides catalog={catalog} employees={employees} />}
    </div>
  );
}
