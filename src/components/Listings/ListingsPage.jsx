import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import listingService from '../../services/listingService';
import {
  LISTING_TYPE_LABELS, CONTACT_TYPE_OPTIONS, optionLabel, listingTitle, listingSize, listingPrice,
} from '../../utils/listingRecord';
import HomeListingForm from './HomeListingForm';
import PlotListingForm from './PlotListingForm';
import VentureListingForm from './VentureListingForm';
import VillaListingForm from './VillaListingForm';
import './Listings.css';

const FORMS = {
  home: HomeListingForm,
  plot: PlotListingForm,
  venture: VentureListingForm,
  villa: VillaListingForm,
};

const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const PAGE_SIZE = 20;

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * Listings section — one tab per listing form (Home / Plot / Venture / Villa).
 * Receives `activeTab` as a prop (like HR / Settings) and is re-mounted per tab
 * by App.jsx, so switching tabs always lands on that type's list.
 */
export default function ListingsPage({ activeTab }) {
  const type = FORMS[activeTab] ? activeTab : 'home';
  const FormComponent = FORMS[type];
  const { isAdmin } = useAuth();

  const [mode, setMode] = useState('list'); // 'list' | 'form'
  const [editing, setEditing] = useState(null);
  const [listings, setListings] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [counts, setCounts] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, debouncedSearch]);

  const loadListings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listingService.getAll({
        type,
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setListings(res.data || []);
      setPagination(res.pagination || { total: 0, page: 1, totalPages: 1 });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load listings.');
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [type, statusFilter, debouncedSearch, page]);

  const loadCounts = useCallback(async () => {
    try {
      const res = await listingService.getCounts();
      setCounts((res.data || {})[type] || null);
    } catch {
      setCounts(null);
    }
  }, [type]);

  useEffect(() => {
    if (mode === 'list') loadListings();
  }, [mode, loadListings]);

  useEffect(() => {
    if (mode === 'list') loadCounts();
  }, [mode, loadCounts]);

  const openCreate = () => {
    setEditing(null);
    setNotice('');
    setMode('form');
  };

  // Re-fetch before editing so the form starts from the latest record (media is replace-all).
  const openEdit = async (row) => {
    setBusyId(row.id);
    setNotice('');
    try {
      const res = await listingService.getById(row.id);
      setEditing(res.data || res);
      setMode('form');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not open the listing.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSaved = () => {
    setNotice(editing ? 'Listing updated — it is back in pending review.' : 'Listing submitted for review.');
    setEditing(null);
    setMode('list');
  };

  const changeStatus = async (row, status) => {
    let remarks;
    if (status === 'rejected') {
      remarks = window.prompt('Reason for rejecting this listing:');
      if (remarks === null) return;
      if (!remarks.trim()) {
        setError('A reason is required to reject a listing.');
        return;
      }
    }
    setBusyId(row.id);
    setError('');
    try {
      await listingService.updateStatus(row.id, status, remarks);
      setNotice(`Listing #${row.id} ${status}.`);
      await Promise.all([loadListings(), loadCounts()]);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update the status.');
    } finally {
      setBusyId(null);
    }
  };

  const deleteListing = async (row) => {
    if (!window.confirm(`Delete listing #${row.id}? This cannot be undone.`)) return;
    setBusyId(row.id);
    setError('');
    try {
      await listingService.remove(row.id);
      setNotice(`Listing #${row.id} deleted.`);
      if (listings.length === 1 && page > 1) setPage(page - 1);
      else await loadListings();
      await loadCounts();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete the listing.');
    } finally {
      setBusyId(null);
    }
  };

  if (mode === 'form') {
    return (
      <div className="lst-page">
        <FormComponent
          listing={editing}
          onSaved={handleSaved}
          onCancel={() => { setEditing(null); setMode('list'); }}
        />
      </div>
    );
  }

  const label = LISTING_TYPE_LABELS[type];

  return (
    <div className="lst-page">
      <div className="lst-header">
        <div>
          <h2 className="lst-title">{label} listings</h2>
          <p className="lst-subtitle">Listings submitted through the Garuda {label.toLowerCase()} listing form.</p>
        </div>
        <button type="button" className="lst-btn primary" onClick={openCreate}>+ Add {label.toLowerCase()} listing</button>
      </div>

      <div className="lst-stats">
        {[
          ['Total', counts?.total],
          ['Pending', counts?.pending],
          ['Approved', counts?.approved],
          ['Rejected', counts?.rejected],
        ].map(([name, value]) => (
          <div key={name} className="lst-stat">
            <span className="lst-stat-label">{name}</span>
            <span className="lst-stat-value">{value ?? '—'}</span>
          </div>
        ))}
      </div>

      <div className="lst-toolbar">
        <div className="lst-tabs">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s.key || 'all'}
              type="button"
              className={`lst-tab${statusFilter === s.key ? ' active' : ''}`}
              onClick={() => setStatusFilter(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          className="lst-input lst-search"
          placeholder="Search name, mobile, area, agent ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {notice && <div className="lst-notice">{notice}</div>}
      {error && <div className="lst-error" role="alert">{error}</div>}

      <div className="lst-table-wrap">
        <table className="lst-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Property</th>
              <th>Location</th>
              <th>Size</th>
              <th>Price</th>
              <th>Contact</th>
              <th>Listed by</th>
              <th>Status</th>
              <th>Created</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="lst-empty">Loading listings…</td></tr>
            ) : listings.length === 0 ? (
              <tr>
                <td colSpan={10} className="lst-empty">
                  {debouncedSearch || statusFilter ? 'No listings match these filters.' : `No ${label.toLowerCase()} listings yet.`}
                </td>
              </tr>
            ) : (
              listings.map((row) => (
                <tr key={row.id}>
                  <td className="lst-muted">{row.id}</td>
                  <td>
                    <div className="lst-cell-main">{listingTitle(row) || '—'}</div>
                    {row.media?.length > 0 && <div className="lst-cell-sub">{row.media.length} file{row.media.length > 1 ? 's' : ''}</div>}
                  </td>
                  <td>
                    <div className="lst-cell-main">{[row.town_area, row.town_name].filter(Boolean).join(', ') || '—'}</div>
                    <div className="lst-cell-sub">{[row.district_name, row.state_name].filter(Boolean).join(', ')}</div>
                  </td>
                  <td>{listingSize(row)}</td>
                  <td>{listingPrice(row)}</td>
                  <td>
                    <div className="lst-cell-main">{row.contact_name}</div>
                    <div className="lst-cell-sub">
                      +91 {row.mobile} · {optionLabel(CONTACT_TYPE_OPTIONS[type], row.contact_type)}
                    </div>
                  </td>
                  <td>{row.is_direct_listing ? 'Direct' : <span title="Garuda Agent ID">{row.agent_code}</span>}</td>
                  <td>
                    <span className={`lst-badge ${row.status}`} title={row.remarks || undefined}>{row.status}</span>
                  </td>
                  <td className="lst-muted">{formatDate(row.created_at)}</td>
                  <td>
                    <div className="lst-actions">
                      <button type="button" className="lst-btn secondary small" disabled={busyId === row.id} onClick={() => openEdit(row)}>
                        Edit
                      </button>
                      {isAdmin && row.status !== 'approved' && (
                        <button type="button" className="lst-btn approve small" disabled={busyId === row.id} onClick={() => changeStatus(row, 'approved')}>
                          Approve
                        </button>
                      )}
                      {isAdmin && row.status !== 'rejected' && (
                        <button type="button" className="lst-btn reject small" disabled={busyId === row.id} onClick={() => changeStatus(row, 'rejected')}>
                          Reject
                        </button>
                      )}
                      {isAdmin && (
                        <button type="button" className="lst-btn danger small" disabled={busyId === row.id} onClick={() => deleteListing(row)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="lst-pagination">
          <button type="button" className="lst-btn secondary small" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Prev</button>
          <span>Page {pagination.page} of {pagination.totalPages} · {pagination.total} listings</span>
          <button type="button" className="lst-btn secondary small" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>Next ›</button>
        </div>
      )}
    </div>
  );
}
