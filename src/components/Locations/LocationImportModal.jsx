import React, { useState, useRef } from 'react';
import locationService from '../../services/locationService';
import './LocationImportModal.css';

/**
 * Bulk location import: pick an Excel/CSV sheet → the backend previews it
 * (dry run, nothing saved) → confirm → the same file is imported for real.
 *
 * Expected columns (one row per village): State | District | Mandal | Village | Town (optional).
 */

const LEVEL_ROWS = [
  ['states', 'States'],
  ['districts', 'Districts'],
  ['mandals', 'Mandals'],
  ['villages', 'Villages'],
  ['towns', 'Towns'],
];

const ACCEPT = '.xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv';

const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
const totalNew = (summary) => Object.values(summary?.created || {}).reduce((a, b) => a + b, 0);

export default function LocationImportModal({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [step, setStep] = useState('pick'); // 'pick' | 'preview' | 'done'
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const preview = async (picked) => {
    if (!picked) return;
    if (!/\.(xlsx|csv)$/i.test(picked.name)) {
      setError('Choose an Excel .xlsx or a .csv file. Old .xls files must be re-saved as .xlsx.');
      return;
    }
    setFile(picked);
    setBusy(true);
    setError('');
    setSummary(null);
    try {
      const res = await locationService.importFile(picked, { commit: false });
      setSummary(res.data || res);
      setStep('preview');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not read the file.');
      setStep('pick');
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await locationService.importFile(file, { commit: true });
      setSummary(res.data || res);
      setStep('done');
      onImported?.();
    } catch (err) {
      setError(err.response?.data?.message || 'The import failed. Nothing was saved.');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setFile(null);
    setSummary(null);
    setError('');
    setStep('pick');
  };

  const downloadTemplate = async () => {
    try {
      const blob = await locationService.downloadImportTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'location-import-template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Could not download the template.');
    }
  };

  const newCount = totalNew(summary);

  return (
    <div className="lim-overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="lim-modal" role="dialog" aria-modal="true" aria-labelledby="lim-title">
        <div className="lim-header">
          <div>
            <h2 id="lim-title" className="lim-title">Import locations from Excel</h2>
            <p className="lim-subtitle">Add many states, districts, mandals and villages at once.</p>
          </div>
          <button type="button" className="lim-close" onClick={onClose} disabled={busy} aria-label="Close">×</button>
        </div>

        <div className="lim-body">
          {step === 'pick' && (
            <>
              <div
                className={`lim-drop${dragging ? ' dragging' : ''}${busy ? ' busy' : ''}`}
                onClick={() => !busy && inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  if (!busy) preview(e.dataTransfer.files?.[0]);
                }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span className="lim-drop-title">
                  {busy ? `Reading ${file?.name}…` : 'Drop an Excel file here, or click to choose'}
                </span>
                <span className="lim-drop-hint">.xlsx or .csv · up to 15 MB · 50,000 rows</span>
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPT}
                  hidden
                  onChange={(e) => { preview(e.target.files?.[0]); e.target.value = ''; }}
                />
              </div>

              <div className="lim-format">
                <div className="lim-format-head">
                  <span>Expected columns — one row per village</span>
                  <button type="button" className="lim-link" onClick={downloadTemplate}>Download template</button>
                </div>
                <table className="lim-format-table">
                  <thead>
                    <tr><th>State</th><th>District</th><th>Mandal</th><th>Village</th><th>Town <em>(optional)</em></th></tr>
                  </thead>
                  <tbody>
                    <tr><td>Andhra Pradesh</td><td>Alluri Sitharama Raju</td><td>Ananthagiri</td><td>Addategela</td><td /></tr>
                  </tbody>
                </table>
                <ul className="lim-notes">
                  <li>Locations that already exist are matched by name (ignoring case and extra spaces) and are not duplicated.</li>
                  <li>You will see a preview first — nothing is saved until you confirm.</li>
                </ul>
              </div>
            </>
          )}

          {(step === 'preview' || step === 'done') && summary && (
            <>
              <div className="lim-file">
                <span className="lim-file-name">{file?.name}</span>
                <span className="lim-file-meta">
                  {summary.sheets?.length > 1 ? `${summary.sheets.length} sheets · ` : summary.sheets?.[0] ? `Sheet "${summary.sheets[0]}" · ` : ''}
                  {fmt(summary.totalRows)} rows
                </span>
              </div>

              {step === 'done' ? (
                <div className="lim-banner success">
                  Imported {fmt(newCount)} new location{newCount === 1 ? '' : 's'}.
                </div>
              ) : newCount === 0 ? (
                <div className="lim-banner info">Everything in this file already exists — there is nothing new to import.</div>
              ) : null}

              <div className="lim-stats">
                <div className="lim-stat"><span>Rows read</span><strong>{fmt(summary.totalRows)}</strong></div>
                <div className="lim-stat"><span>Valid</span><strong>{fmt(summary.validRows)}</strong></div>
                <div className="lim-stat"><span>Duplicate rows</span><strong>{fmt(summary.duplicateRows)}</strong></div>
                <div className={`lim-stat${summary.skippedRows ? ' warn' : ''}`}><span>Skipped (errors)</span><strong>{fmt(summary.skippedRows)}</strong></div>
              </div>

              <table className="lim-table">
                <thead>
                  <tr>
                    <th>Level</th>
                    <th className="num">{step === 'done' ? 'Created' : 'Will be created'}</th>
                    <th className="num">Already exist</th>
                    <th>{step === 'done' ? 'Examples' : 'New examples'}</th>
                  </tr>
                </thead>
                <tbody>
                  {LEVEL_ROWS.filter(([key]) => key !== 'towns' || summary.columns?.town).map(([key, label]) => (
                    <tr key={key}>
                      <td>{label}</td>
                      <td className="num strong">{fmt(summary.created?.[key])}</td>
                      <td className="num muted">{fmt(summary.existing?.[key])}</td>
                      <td className="lim-samples">
                        {(summary.samples?.[key] || []).slice(0, 6).join(', ') || '—'}
                        {summary.created?.[key] > 6 ? ` +${fmt(summary.created[key] - 6)} more` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {summary.errors?.length > 0 && (
                <div className="lim-errors">
                  <div className="lim-errors-head">
                    Rows {step === 'done' ? 'that were skipped' : 'that will be skipped'}
                    {summary.errorsTruncated ? ` (first ${summary.errors.length} shown)` : ''}
                  </div>
                  <ul>
                    {summary.errors.map((e) => (
                      <li key={`${e.sheet}-${e.row}`}>
                        <span className="lim-err-row">{summary.sheets?.length > 1 ? `${e.sheet} · ` : ''}Row {e.row}</span>
                        {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {error && <div className="lim-banner error" role="alert">{error}</div>}
        </div>

        <div className="lim-footer">
          {step === 'preview' && (
            <>
              <button type="button" className="loc-ghost-btn" onClick={reset} disabled={busy}>Choose another file</button>
              <button type="button" className="loc-primary-btn" onClick={commit} disabled={busy || newCount === 0}>
                {busy ? 'Importing…' : `Import ${fmt(newCount)} location${newCount === 1 ? '' : 's'}`}
              </button>
            </>
          )}
          {step === 'done' && (
            <>
              <button type="button" className="loc-ghost-btn" onClick={reset}>Import another file</button>
              <button type="button" className="loc-primary-btn" onClick={onClose}>Done</button>
            </>
          )}
          {step === 'pick' && (
            <button type="button" className="loc-ghost-btn" onClick={onClose} disabled={busy}>Cancel</button>
          )}
        </div>
      </div>
    </div>
  );
}
