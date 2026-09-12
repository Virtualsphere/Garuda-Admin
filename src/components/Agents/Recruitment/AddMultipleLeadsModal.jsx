import { useState, useMemo } from 'react';
import { Loader2, Plus, Trash2, ClipboardPaste, AlertTriangle } from 'lucide-react';

import Modal, { ModalError, ModalCallout, GhostButton } from '../common/Modal';
import recruitmentService from '../../../services/recruitmentService';
import { LEAD_SOURCES } from '../agentConstants';

const BLANK = () => ({
  key: Math.random().toString(36).slice(2),
  name: '',
  phone: '',
  village: '',
  mandal: '',
  district: '',
  source: LEAD_SOURCES[0],
});

const phoneTail = (v) => String(v || '').replace(/\D/g, '').slice(-10);

/**
 * Bulk lead entry — a spreadsheet-style grid, plus paste-from-clipboard for
 * the common case of a list arriving from a campaign export.
 *
 * Rows are validated before anything is sent, and saved one at a time so a
 * single bad row reports itself instead of failing the whole batch.
 */
export default function AddMultipleLeadsModal({ onClose, onSaved }) {
  const [rows, setRows] = useState(() => [BLANK(), BLANK(), BLANK()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [failures, setFailures] = useState([]);

  const update = (key, field, value) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  const addRow = () => setRows((prev) => [...prev, BLANK()]);
  const removeRow = (key) =>
    setRows((prev) => (prev.length === 1 ? [BLANK()] : prev.filter((r) => r.key !== key)));

  /**
   * Accepts tab- or comma-separated text: name, phone, village, mandal,
   * district. Anything beyond those columns is ignored rather than guessed at.
   */
  const handlePaste = async () => {
    setError(null);
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setError('The clipboard is empty.');
        return;
      }

      const parsed = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const cells = line.split(/\t|,/).map((c) => c.trim());
          return {
            ...BLANK(),
            name: cells[0] || '',
            phone: cells[1] || '',
            village: cells[2] || '',
            mandal: cells[3] || '',
            district: cells[4] || '',
          };
        })
        .filter((r) => r.name || r.phone);

      if (!parsed.length) {
        setError('Could not read any rows from the clipboard.');
        return;
      }
      setRows(parsed);
    } catch {
      // Clipboard read needs permission and a secure context.
      setError('Could not read the clipboard. Paste into the rows manually instead.');
    }
  };

  const validRows = useMemo(
    () => rows.filter((r) => r.name.trim() && phoneTail(r.phone).length === 10),
    [rows]
  );

  const incompleteCount = rows.filter(
    (r) => (r.name.trim() || r.phone.trim()) && !validRows.includes(r)
  ).length;

  const handleSave = async () => {
    if (!validRows.length) return;
    setSaving(true);
    setError(null);
    setFailures([]);

    const failed = [];
    let saved = 0;

    for (const row of validRows) {
      try {
        await recruitmentService.createCandidate({
          name: row.name.trim(),
          phone: row.phone.trim(),
          lead_source: row.source,
          village: row.village.trim() || undefined,
          mandal: row.mandal.trim() || undefined,
          district: row.district.trim() || undefined,
        });
        saved += 1;
      } catch (err) {
        failed.push({
          name: row.name,
          reason: err.response?.data?.message || 'Rejected by the server',
        });
      }
    }

    setSaving(false);

    if (failed.length) {
      setFailures(failed);
      if (saved === 0) {
        setError('No leads could be created.');
        return;
      }
    }

    onSaved?.(saved);
  };

  const cellClass =
    'w-full text-xs bg-white border border-stone-200 rounded px-2 py-1.5 text-stone-800 focus:border-[#2563EB]';

  return (
    <Modal
      title="Add multiple leads"
      subtitle="Bulk entry for campaign or field lists"
      size="xl"
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <button
            type="button"
            onClick={handleSave}
            disabled={!validRows.length || saving}
            className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-bold hover:bg-[#1D4ED8] disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Create {validRows.length} lead{validRows.length === 1 ? '' : 's'}
          </button>
        </>
      }
    >
      <ModalError>{error}</ModalError>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handlePaste}
          className="px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 inline-flex items-center gap-1.5"
        >
          <ClipboardPaste className="w-3.5 h-3.5 text-[#2563EB]" />
          Paste from clipboard
        </button>
        <button
          type="button"
          onClick={addRow}
          className="px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 inline-flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Add row
        </button>

        <span className="text-[11px] text-stone-500 ml-auto">
          {validRows.length} ready
          {incompleteCount > 0 && (
            <span className="text-amber-700 font-semibold">
              {' '}· {incompleteCount} incomplete
            </span>
          )}
        </span>
      </div>

      <ModalCallout>
        A name and a 10-digit phone are the minimum. Pasted text is read as
        <strong> name, phone, village, mandal, district</strong> — tab or comma separated.
      </ModalCallout>

      <div className="max-h-[45vh] overflow-auto border border-stone-200 rounded-lg">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-stone-100 text-stone-700 font-semibold border-b border-stone-200">
              <th className="p-2 text-left w-8">#</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Phone</th>
              <th className="p-2 text-left">Village</th>
              <th className="p-2 text-left">Mandal</th>
              <th className="p-2 text-left">District</th>
              <th className="p-2 text-left">Source</th>
              <th className="p-2 w-8" aria-label="Remove" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((row, idx) => {
              const touched = row.name.trim() || row.phone.trim();
              const isValid = validRows.includes(row);
              return (
                <tr
                  key={row.key}
                  className={touched && !isValid ? 'bg-amber-50/50' : 'bg-white'}
                >
                  <td className="p-2 text-stone-400 text-center">{idx + 1}</td>
                  <td className="p-1.5">
                    <input
                      value={row.name}
                      onChange={(e) => update(row.key, 'name', e.target.value)}
                      placeholder="Full name"
                      className={cellClass}
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      value={row.phone}
                      onChange={(e) => update(row.key, 'phone', e.target.value)}
                      placeholder="10 digits"
                      inputMode="numeric"
                      className={cellClass}
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      value={row.village}
                      onChange={(e) => update(row.key, 'village', e.target.value)}
                      className={cellClass}
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      value={row.mandal}
                      onChange={(e) => update(row.key, 'mandal', e.target.value)}
                      className={cellClass}
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      value={row.district}
                      onChange={(e) => update(row.key, 'district', e.target.value)}
                      className={cellClass}
                    />
                  </td>
                  <td className="p-1.5">
                    <select
                      value={row.source}
                      onChange={(e) => update(row.key, 'source', e.target.value)}
                      className={cellClass}
                    >
                      {LEAD_SOURCES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      aria-label={`Remove row ${idx + 1}`}
                      className="p-1 rounded text-stone-400 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {failures.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
          <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            {failures.length} row{failures.length === 1 ? '' : 's'} could not be created
          </div>
          {failures.map((f, i) => (
            <div key={i} className="text-[11px] text-amber-800">
              <strong>{f.name || 'Unnamed'}</strong> — {f.reason}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
