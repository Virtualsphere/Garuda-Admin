import { useState, useEffect, useMemo } from 'react';
import recruitmentService from '../../../services/recruitmentService';
import agentService from '../../../services/agentService';
import useRequiredAgents from '../../../hooks/useRequiredAgents';
import Modal, {
  ModalError,
  ModalCallout,
  ModalEmpty,
  GhostButton,
  PrimaryButton,
} from '../common/Modal';

const num = (v) => Number(v) || 0;
const key = (v) => String(v || '').trim().toLowerCase();

/**
 * Creates the village seats a village's acreage calls for.
 *
 * Seats are not invented here — `required` comes from the shared
 * `required_agents_slabs` setting applied to the acreage the map nodes report,
 * which is the same number the dashboard and recruitment map use. Syncing only
 * ever adds the missing seats; it never removes one.
 */
export default function SyncSeatsModal({ positions, filters, onClose, onDone }) {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(null);
  const [error, setError] = useState(null);
  const [done, setDone] = useState({});

  const { requiredFor, loading: slabsLoading } = useRequiredAgents();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await agentService.getMapNodes({
          state: filters.state,
          district: filters.district,
          mandal: filters.mandal,
        });
        const list = data.result || data.data || [];
        setNodes(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('Failed to load village nodes:', err);
        setError('Could not load village acreage.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [filters.state, filters.district, filters.mandal]);

  // Existing seat count per village, from the rows the page already fetched.
  const seatsByVillage = useMemo(() => {
    const map = {};
    (positions || []).forEach((p) => {
      map[key(p.village)] = (map[key(p.village)] || 0) + 1;
    });
    return map;
  }, [positions]);

  const rows = useMemo(() => {
    if (slabsLoading) return [];

    return nodes
      .filter((n) => n.village)
      .map((n) => {
        const acres = num(n.total_acres);
        const required = requiredFor(acres);
        const existing = seatsByVillage[key(n.village)] || 0;
        return {
          village: n.village,
          mandal: n.mandal,
          district: n.district,
          state: n.state,
          acres,
          required,
          existing,
          missing: Math.max(required - existing, 0),
        };
      })
      .filter((r) => r.required > 0)
      .sort((a, b) => b.missing - a.missing || b.acres - a.acres);
  }, [nodes, requiredFor, seatsByVillage, slabsLoading]);

  const pending = rows.filter((r) => r.missing > 0 && !done[key(r.village)]);

  const syncOne = async (row) => {
    setSyncing(key(row.village));
    setError(null);
    try {
      await recruitmentService.syncPositions({
        village: row.village,
        mandal: row.mandal,
        district: row.district,
        state: row.state,
      });
      setDone((d) => ({ ...d, [key(row.village)]: true }));
      onDone?.();
    } catch (err) {
      setError(err.response?.data?.message || `Could not create seats for ${row.village}.`);
    } finally {
      setSyncing(null);
    }
  };

  const syncAll = async () => {
    setError(null);
    for (const row of pending) {
      setSyncing(key(row.village));
      try {
        await recruitmentService.syncPositions({
          village: row.village,
          mandal: row.mandal,
          district: row.district,
          state: row.state,
        });
        setDone((d) => ({ ...d, [key(row.village)]: true }));
      } catch (err) {
        setError(err.response?.data?.message || `Stopped at ${row.village}.`);
        break;
      }
    }
    setSyncing(null);
    onDone?.();
  };

  const busy = loading || slabsLoading;

  return (
    <Modal
      title="Create village seats"
      subtitle={filters.mandal || filters.district || filters.state || 'All locations'}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Close</GhostButton>
          <PrimaryButton
            type="button"
            onClick={syncAll}
            disabled={busy || pending.length === 0 || Boolean(syncing)}
          >
            {syncing
              ? 'Creating…'
              : pending.length === 0
              ? 'Nothing to create'
              : `Create all (${pending.length})`}
          </PrimaryButton>
        </>
      }
    >
      <ModalError>{error}</ModalError>

      <ModalCallout>
        How many seats a village gets comes from its land acreage and the{' '}
        <strong>required agents</strong> slab table in Settings. Syncing adds the seats a
        village is missing — it never removes one.
      </ModalCallout>

      {busy ? (
        <ModalEmpty>Loading village acreage…</ModalEmpty>
      ) : rows.length === 0 ? (
        <ModalEmpty>
          No villages with recorded land acreage in this area. Seats are sized from land
          records, so add lands first — or widen the location filter.
        </ModalEmpty>
      ) : (
        <div className="max-h-[45vh] overflow-y-auto rounded-xl border border-[#e7e5e4]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0">
              <tr className="bg-[#f5f5f4] border-b border-[#e7e5e4] text-[11px] font-bold text-[#78716c] uppercase tracking-wider">
                <th className="py-2.5 px-3">Village</th>
                <th className="py-2.5 px-3 text-right">Acres</th>
                <th className="py-2.5 px-3 text-right">Seats</th>
                <th className="py-2.5 px-3 text-right">Required</th>
                <th className="py-2.5 px-3" aria-label="Action" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e7e5e4] text-xs text-[#1c1917]">
              {rows.map((r) => {
                const k = key(r.village);
                const isDone = done[k];
                return (
                  <tr key={k} className="hover:bg-[#fafaf9]">
                    <td className="py-2.5 px-3">
                      <div className="font-bold">{r.village}</div>
                      <div className="text-[10px] text-[#78716c]">{r.mandal || '—'}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold">
                      {Math.round(r.acres).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold">
                      {isDone ? r.required : r.existing}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black">{r.required}</td>
                    <td className="py-2.5 px-3 text-right">
                      {isDone ? (
                        <span className="text-[11px] font-bold text-[#2563EB]">Created</span>
                      ) : r.missing === 0 ? (
                        <span className="text-[11px] text-[#78716c]">Complete</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => syncOne(r)}
                          disabled={Boolean(syncing)}
                          className="px-2.5 py-1 rounded-lg bg-[#1c1917] text-white text-[11px] font-bold hover:bg-[#292524] disabled:opacity-40"
                        >
                          {syncing === k ? 'Creating…' : `Add ${r.missing}`}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
