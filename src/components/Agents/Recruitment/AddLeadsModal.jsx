import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Trash2,
  Save,
  X,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ClipboardPaste,
  Loader2,
} from 'lucide-react';

import useLocationTree from '../../../hooks/useLocationTree';
import agentLeadService from '../../../services/agentLeadService';
import recruitmentService from '../../../services/recruitmentService';
import { useRecruitmentDesk } from '../../../hooks/useRecruitmentDesk';
import { digitsOf, normaliseLead } from './recruitmentModel';
import { errorMessage } from '../../../utils/apiErrors';

/** Every lead entered here is a campaign lead; the source is not asked per row. */
const ENTRY_SOURCE = 'Meta Ads';

const tail10 = (value) => digitsOf(value).slice(-10);

let rowSeq = 0;
const newRow = (inherit = {}) => {
  rowSeq += 1;
  return {
    id: `row-${Date.now()}-${rowSeq}`,
    name: '',
    phone: '',
    state: inherit.state || '',
    district: inherit.district || '',
    mandal: inherit.mandal || '',
    village: '',
  };
};

const cellSelect =
  'w-full px-2 py-1.5 border border-stone-200 rounded text-xs focus:outline-hidden focus:border-[#2563EB] bg-white text-stone-800 disabled:bg-stone-50 disabled:text-stone-400';

/**
 * "Add Leads": a spreadsheet-style grid for entering campaign leads in bulk.
 *
 * Locations come from the master directory, one independent State → Village
 * cascade per row. A number that already exists — as a lead or as an agent — is
 * flagged as the phone is typed, and skipped on save rather than created twice,
 * which is what stops a re-imported campaign list from doubling the pipeline.
 *
 * New leads deliberately enter unowned and unattached, so they land in the
 * Leads → Allot queue instead of becoming their creator's private work.
 */
export default function AddLeadsModal({ onClose, onSaved }) {
  const { agents, openLead, openAgent } = useRecruitmentDesk();
  const { states, districtsOf, mandalsOf, villagesOf, loading: locationsLoading } =
    useLocationTree();

  const [rows, setRows] = useState(() => [newRow(), newRow(), newRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Default every row to the first state once the tree arrives — but only rows
  // the user has not touched, so a slow response cannot overwrite a choice.
  const defaultedState = useRef(false);
  useEffect(() => {
    if (defaultedState.current || !states.length) return;
    defaultedState.current = true;
    const preferred = states.find((s) => s.name === 'Telangana') || states[0];
    setRows((prev) => prev.map((r) => (r.state ? r : { ...r, state: preferred.name })));
  }, [states]);

  const agentByPhone = useMemo(() => {
    const map = new Map();
    (agents || []).forEach((a) => {
      const key = tail10(a.phone);
      if (key.length === 10) map.set(key, a);
    });
    return map;
  }, [agents]);

  /* ── Duplicate detection ──────────────────────────────────── */

  // digits → { kind, name, ... } | null. Cached so retyping a number the desk
  // has already looked up costs nothing.
  const [lookups, setLookups] = useState({});
  const requested = useRef(new Set());

  useEffect(() => {
    const pending = [...new Set(rows.map((r) => tail10(r.phone)))].filter(
      (d) => d.length === 10 && !requested.current.has(d)
    );
    if (!pending.length) return undefined;

    // Wait for the typing to settle before asking the server anything.
    const timer = setTimeout(() => {
      pending.forEach(async (digits) => {
        requested.current.add(digits);
        try {
          const data = await agentLeadService.getLeads({ search: digits, activeOnly: 'false' });
          const list = data.result || data.data || [];
          const hit = (Array.isArray(list) ? list : []).find((l) => tail10(l.phone) === digits);
          setLookups((prev) => ({ ...prev, [digits]: hit ? { kind: 'lead', row: hit } : null }));
        } catch (err) {
          console.error('Duplicate lookup failed:', err);
          // Do not cache a failure as "no duplicate"; let a later edit retry it.
          requested.current.delete(digits);
        }
      });
    }, 450);

    return () => clearTimeout(timer);
  }, [rows]);

  const duplicateOf = (row, index) => {
    const digits = tail10(row.phone);
    if (digits.length < 10) return null;

    const earlier = rows.findIndex((r, i) => i < index && tail10(r.phone) === digits);
    if (earlier !== -1) {
      return { kind: 'batch', label: `Same number as row ${earlier + 1} in this list` };
    }

    const agent = agentByPhone.get(digits);
    if (agent) {
      return {
        kind: 'agent',
        agent,
        label: `${agent.name} (Existing agent · ${agent.village || 'no village'})`,
      };
    }

    const hit = lookups[digits];
    if (hit?.kind === 'lead') {
      const lead = normaliseLead(hit.row);
      return {
        kind: 'lead',
        lead,
        label: `${lead.name} (Agent lead · ${lead.nativeVillage || 'no village'})`,
      };
    }
    return null;
  };

  /* ── Row editing ──────────────────────────────────────────── */

  const changeRow = (index, field, value) => {
    setFeedback(null);
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        // Changing a level clears the ones beneath it, exactly as the cascade implies.
        if (field === 'state') return { ...row, state: value, district: '', mandal: '', village: '' };
        if (field === 'district') return { ...row, district: value, mandal: '', village: '' };
        if (field === 'mandal') return { ...row, mandal: value, village: '' };
        return { ...row, [field]: value };
      })
    );
  };

  const addRows = (count) =>
    setRows((prev) => {
      const last = prev[prev.length - 1];
      return [
        ...prev,
        ...Array.from({ length: count }, () =>
          newRow({ state: last?.state, district: last?.district, mandal: last?.mandal })
        ),
      ];
    });

  const removeRow = (index) => setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));

  /**
   * "name, phone" per line (tab or comma separated), plus optional district,
   * mandal and village *when they match the master directory*. Anything else is
   * ignored: a free-text village that is not in the directory cannot be chosen
   * from a select, so guessing at it would just create bad data.
   */
  const handlePaste = async () => {
    setError(null);
    try {
      const text = await navigator.clipboard.readText();
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (!lines.length) {
        setError('The clipboard is empty.');
        return;
      }

      const state = rows[0]?.state || states.find((s) => s.name === 'Telangana')?.name || states[0]?.name || '';
      const match = (list, value) =>
        list.find((x) => String(x.name).toLowerCase() === String(value || '').trim().toLowerCase())?.name || '';

      const parsed = lines.map((line) => {
        const [name = '', phone = '', village = '', mandal = '', district = ''] = line
          .split(/\t|,/)
          .map((c) => c.trim());

        const d = match(districtsOf(state), district);
        const m = d ? match(mandalsOf(state, d), mandal) : '';
        const v = d && m ? match(villagesOf(state, d, m), village) : '';
        return { ...newRow({ state }), name, phone, district: d, mandal: m, village: v };
      });

      setRows(parsed.filter((r) => r.name || r.phone));
    } catch {
      // Clipboard reads need permission and a secure context.
      setError('Could not read the clipboard. Type or paste into the rows instead.');
    }
  };

  /* ── Save ─────────────────────────────────────────────────── */

  const filled = rows.filter((r) => r.name.trim() && r.phone.trim());
  const badPhone = filled.filter((r) => tail10(r.phone).length !== 10);

  const handleSave = async () => {
    setError(null);

    if (!filled.length) {
      setError('Please fill at least one row with a name and a phone number.');
      return;
    }
    if (badPhone.length) {
      setError(
        `${badPhone.length} row${badPhone.length === 1 ? ' has' : 's have'} a phone number that is not 10 digits.`
      );
      return;
    }

    setSaving(true);
    setFeedback(null);

    let added = 0;
    let skipped = 0;
    const failures = [];

    for (const row of filled) {
      const index = rows.indexOf(row);
      if (duplicateOf(row, index)) {
        skipped += 1;
        continue;
      }

      try {
        await recruitmentService.createCandidate({
          name: row.name.trim(),
          phone: tail10(row.phone),
          lead_source: ENTRY_SOURCE,
          state: row.state || undefined,
          district: row.district || undefined,
          mandal: row.mandal || undefined,
          village: row.village || undefined,
          // Unowned: see the note on the component.
          assigned_employee_id: null,
        });
        added += 1;
      } catch (err) {
        failures.push({ name: row.name, reason: errorMessage(err, 'Rejected by the server') });
      }
    }

    setSaving(false);
    setFeedback({ added, skipped, failures });
    if (added > 0) onSaved?.(added);

    // A clean save closes itself after a beat; anything skipped or rejected
    // stays on screen so it can be read.
    if (added > 0 && !skipped && !failures.length) {
      setTimeout(() => onClose?.(), 1500);
    }
  };

  useEffect(() => {
    const onKeyDown = (e) => e.key === 'Escape' && !saving && onClose?.();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving]);

  return (
    <div
      className="fixed inset-0 z-[1000] bg-stone-900/50 backdrop-blur-2xs flex items-center justify-center p-4"
      onClick={() => !saving && onClose?.()}
    >
      <div
        className="bg-white rounded-xl border border-stone-200 shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Add multiple leads"
      >
        {/* Header */}
        <div className="bg-stone-900 px-5 py-3.5 text-white flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <span>Add Multiple Leads</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Meta Ads Entries
              </span>
            </h3>
            <p className="text-[11px] text-stone-400">
              Adding multiple leads directly to Agents — they enter unattached, ready for team
              allocation.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="text-stone-400 hover:text-white p-1 rounded-md hover:bg-stone-800 transition-colors disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback */}
        {feedback && (
          <div
            className={`px-4 py-2.5 text-xs flex items-start gap-2 border-b ${
              feedback.skipped > 0 || feedback.failures.length > 0 || feedback.added === 0
                ? 'bg-amber-50 text-amber-900 border-amber-200'
                : 'bg-emerald-50 text-emerald-900 border-emerald-200'
            }`}
          >
            {feedback.skipped > 0 || feedback.failures.length > 0 || feedback.added === 0 ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <span>
                Saved <strong>{feedback.added}</strong> lead{feedback.added === 1 ? '' : 's'} to
                Agents.{' '}
                {feedback.skipped > 0 && (
                  <span>
                    (Skipped <strong>{feedback.skipped}</strong> duplicate number
                    {feedback.skipped === 1 ? '' : 's'} found in database).
                  </span>
                )}
              </span>
              {feedback.failures.map((f, i) => (
                <div key={i} className="text-[11px]">
                  <strong>{f.name || 'Unnamed'}</strong> — {f.reason}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rules bar */}
        <div className="bg-stone-50 px-5 py-2 border-b border-stone-200 text-xs text-stone-600 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-stone-700">Rules:</span>
            <span>Locations synced with master directory. Duplicates checked automatically.</span>
          </div>
          <span className="font-mono text-stone-600 bg-stone-200/80 px-2 py-0.5 rounded font-medium text-[11px]">
            {rows.length} rows
          </span>
        </div>

        {error && (
          <div className="px-4 py-2 text-xs font-semibold bg-rose-50 text-rose-700 border-b border-rose-200">
            {error}
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-auto p-4">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-stone-100 text-stone-700 font-semibold border-b border-stone-200 text-left">
                <th className="p-2 w-8 text-center text-stone-400">#</th>
                <th className="p-2 min-w-[160px]">Name *</th>
                <th className="p-2 min-w-[140px]">Phone *</th>
                <th className="p-2 min-w-[120px]">State</th>
                <th className="p-2 min-w-[130px]">District</th>
                <th className="p-2 min-w-[120px]">Mandal</th>
                <th className="p-2 min-w-[130px]">Village</th>
                <th className="p-2 w-10 text-center">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row, index) => {
                const dup = duplicateOf(row, index);
                const districts = districtsOf(row.state);
                const mandals = mandalsOf(row.state, row.district);
                const villages = villagesOf(row.state, row.district, row.mandal);
                const phoneInvalid = row.phone.trim() && tail10(row.phone).length !== 10;

                return (
                  <Fragment key={row.id}>
                    <tr
                      className={`transition-colors ${
                        dup ? 'bg-amber-50/70 border-l-4 border-amber-500' : 'hover:bg-stone-50/70'
                      }`}
                    >
                      <td className="p-1.5 text-center text-stone-400 font-mono text-[11px]">
                        {index + 1}
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          placeholder="e.g. K. Lingaiah"
                          value={row.name}
                          onChange={(e) => changeRow(index, 'name', e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-stone-200 rounded text-xs focus:outline-hidden focus:border-[#2563EB] bg-white text-stone-900"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="tel"
                          inputMode="numeric"
                          placeholder="9848012345"
                          value={row.phone}
                          onChange={(e) => changeRow(index, 'phone', e.target.value)}
                          className={`w-full px-2.5 py-1.5 border rounded text-xs font-mono focus:outline-hidden bg-white ${
                            dup
                              ? 'border-amber-400 text-amber-900 bg-amber-50/30'
                              : phoneInvalid
                              ? 'border-rose-300 text-rose-800'
                              : 'border-stone-200 text-stone-900 focus:border-[#2563EB]'
                          }`}
                        />
                      </td>
                      <td className="p-1">
                        <select
                          value={row.state}
                          onChange={(e) => changeRow(index, 'state', e.target.value)}
                          disabled={locationsLoading}
                          className={cellSelect}
                        >
                          <option value="">{locationsLoading ? 'Loading…' : 'Select state'}</option>
                          {states.map((s) => (
                            <option key={s.id} value={s.name}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-1">
                        <select
                          value={row.district}
                          onChange={(e) => changeRow(index, 'district', e.target.value)}
                          disabled={!row.state}
                          className={cellSelect}
                        >
                          <option value="">Select district</option>
                          {districts.map((d) => (
                            <option key={d.id} value={d.name}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-1">
                        <select
                          value={row.mandal}
                          onChange={(e) => changeRow(index, 'mandal', e.target.value)}
                          disabled={!row.district}
                          className={cellSelect}
                        >
                          <option value="">Select mandal</option>
                          {mandals.map((m) => (
                            <option key={m.id} value={m.name}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-1">
                        <select
                          value={row.village}
                          onChange={(e) => changeRow(index, 'village', e.target.value)}
                          disabled={!row.mandal}
                          className={cellSelect}
                        >
                          <option value="">Select village</option>
                          {villages.map((v) => (
                            <option key={v.id} value={v.name}>
                              {v.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(index)}
                          title="Delete row"
                          className="p-1 text-stone-400 hover:text-red-600 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>

                    {dup && (
                      <tr className="bg-amber-50/90 text-amber-900">
                        <td />
                        <td colSpan={7} className="px-2 py-1 text-[11px]">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>
                                <strong>Existing Number Found:</strong> {dup.label}
                              </span>
                            </div>
                            {(dup.kind === 'lead' || dup.kind === 'agent') && (
                              <button
                                type="button"
                                onClick={() =>
                                  dup.kind === 'lead' ? openLead(dup.lead) : openAgent?.(dup.agent)
                                }
                                className="px-2 py-0.5 rounded bg-amber-200 hover:bg-amber-300 text-amber-900 font-semibold text-[10px] inline-flex items-center gap-1 transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" />
                                View Record
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="bg-stone-50 p-3.5 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => addRows(1)}
              className="px-3.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-stone-700 font-medium transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-stone-700" />
              Add Row
            </button>
            <button
              type="button"
              onClick={() => addRows(10)}
              className="px-3.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-stone-700 font-medium transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-stone-700" />
              Add 10 Rows
            </button>
            <button
              type="button"
              onClick={handlePaste}
              title="Fill the grid from name, phone lines copied from a sheet"
              className="px-3.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-stone-700 font-medium transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-[#2563EB]" />
              Paste
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-700 font-medium transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-1.5 rounded-lg text-white font-medium transition-colors flex items-center gap-1.5 shadow-2xs bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Agents Leads
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
