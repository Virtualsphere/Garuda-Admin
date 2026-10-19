import React, { useState, useEffect } from 'react';
import roleService from '../../services/roleService';

/** Add / rename / delete roles. Calls `onChanged()` after every successful write. */
export default function HRRolesModal({ roles, onClose, onChanged }) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = async (fn, fallback) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onChanged();
      return true;
    } catch (err) {
      console.error(fallback, err);
      setError(err.response?.data?.message || fallback);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    if (await run(() => roleService.create(newName), 'Failed to add role.')) setNewName('');
  };

  const handleRename = async (id) => {
    if (!editName.trim()) return;
    if (await run(() => roleService.update(id, editName), 'Failed to rename role.')) setEditingId(null);
  };

  const handleDelete = async (role) => {
    if (!window.confirm(`Delete role "${role.name}"? Employees keep the role name on their file.`)) return;
    await run(() => roleService.delete(role.id), 'Failed to delete role.');
  };

  return (
    <div className="hr-modal-overlay" onClick={onClose}>
      <div className="hr-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="hr-modal-header">
          <span className="hr-emp-title">MANAGE ROLES</span>
          <button type="button" className="hr-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <form className="hr-role-add" onSubmit={handleAdd}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. HR MANAGER" />
          <button type="submit" className="hr-primary-btn" disabled={busy || !newName.trim()}>Add</button>
        </form>
        <p className="hr-modal-hint">Names are saved in upper case with underscores (HR MANAGER → HR_MANAGER).</p>

        {error && <div className="hr-alert error">{error}</div>}

        <ul className="hr-role-list">
          {roles.length === 0 && <li className="hr-role-empty">No roles found.</li>}
          {roles.map((role) => (
            <li key={role.id} className="hr-role-item">
              {editingId === role.id ? (
                <>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                  <div className="hr-role-actions">
                    <button type="button" className="hr-primary-btn small" onClick={() => handleRename(role.id)} disabled={busy || !editName.trim()}>Save</button>
                    <button type="button" className="hr-emp-action-btn" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <span className="hr-role-name">{role.name}</span>
                  <div className="hr-role-actions">
                    <button type="button" className="hr-emp-action-btn" onClick={() => { setEditingId(role.id); setEditName(role.name); }} disabled={busy}>Rename</button>
                    <button type="button" className="hr-emp-action-btn danger" onClick={() => handleDelete(role)} disabled={busy}>Delete</button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
