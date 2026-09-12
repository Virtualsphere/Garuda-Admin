import { useState, useEffect, useMemo } from 'react';
import recruitmentService from '../../../services/recruitmentService';
import { STAGE_LABELS } from './recruitmentConstants';
import Modal, {
  ModalError,
  ModalCallout,
  ModalEmpty,
  GhostButton,
  PrimaryButton,
} from '../common/Modal';

const sameVillage = (a, b) =>
  Boolean(String(a || '').trim()) &&
  String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

/**
 * Choose a candidate for a village seat.
 *
 * Native priority is enforced by the server (409 on violation); this list
 * mirrors the rule so it is obvious *before* clicking which candidates the
 * seat will actually accept.
 */
export default function SelectCandidateModal({ position, preselectCandidateId, onClose, onDone }) {
  const [candidates, setCandidates] = useState([]);
  const [chosenId, setChosenId] = useState(preselectCandidateId ?? null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const nativeOnly = position.status === 'NATIVE_SEARCH';

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // Anyone who registered interest in this village and is still active.
        const data = await recruitmentService.getCandidates({ activeOnly: true });
        const list = data.result || data.data || [];
        setCandidates(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('Failed to load candidates:', err);
        setError('Could not load candidates.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const eligible = useMemo(() => {
    return candidates
      .filter((c) =>
        (c.interests || []).some((i) => sameVillage(i.village, position.village))
      )
      .map((c) => ({
        ...c,
        isNative: sameVillage(c.village, position.village),
      }))
      // Natives first, then by how long they have been waiting.
      .sort((a, b) => (b.isNative ? 1 : 0) - (a.isNative ? 1 : 0));
  }, [candidates, position.village]);

  const blocked = (c) => nativeOnly && !c.isNative;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!chosenId || saving) return;

    setSaving(true);
    setError(null);
    try {
      await recruitmentService.selectCandidate(position.id, chosenId);
      onDone?.();
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not select this candidate.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Select candidate"
      subtitle={`${position.village} · Seat #${position.position_number}`}
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton
            type="submit"
            form="select-candidate-form"
            disabled={!chosenId || saving}
          >
            {saving ? 'Selecting…' : 'Select for seat'}
          </PrimaryButton>
        </>
      }
    >
      <form id="select-candidate-form" onSubmit={handleSubmit} className="space-y-4">
        <ModalError>{error}</ModalError>

        {nativeOnly && (
          <ModalCallout tone="amber">
            This seat is under <strong>native search</strong> — only candidates born in{' '}
            {position.village} can be selected. Open it to waiting candidates first if you
            need to consider someone from outside.
          </ModalCallout>
        )}

        {loading ? (
          <ModalEmpty>Loading candidates…</ModalEmpty>
        ) : eligible.length === 0 ? (
          <ModalEmpty>
            No active candidate has registered interest in {position.village} yet. Link a
            candidate to this village from their profile first.
          </ModalEmpty>
        ) : (
          <ul className="space-y-2">
            {eligible.map((c) => {
              const isBlocked = blocked(c);
              const isChosen = String(chosenId) === String(c.id);
              return (
                <li key={c.id}>
                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                      isBlocked
                        ? 'bg-[#fafaf9] border-[#e7e5e4] opacity-60 cursor-not-allowed'
                        : isChosen
                        ? 'bg-[#2563EB]/5 border-[#2563EB] cursor-pointer'
                        : 'bg-white border-[#e7e5e4] hover:border-[#2563EB]/40 cursor-pointer'
                    }`}
                  >
                    <input
                      type="radio"
                      name="candidate"
                      value={c.id}
                      checked={isChosen}
                      onChange={() => setChosenId(c.id)}
                      disabled={isBlocked}
                      className="mt-0.5 accent-[#2563EB]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 flex-wrap">
                        <strong className="text-xs font-bold text-[#1c1917]">{c.name}</strong>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            c.isNative
                              ? 'bg-[#2563EB]/10 text-[#2563EB]'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {c.isNative ? 'native' : 'outside'}
                        </span>
                      </span>
                      <span className="block text-[11px] text-[#78716c] mt-0.5">
                        {c.phone} · {STAGE_LABELS[c.status] || c.status}
                        {c.village && ` · from ${c.village}`}
                      </span>
                      {isBlocked && (
                        <span className="block text-[10px] font-bold text-rose-600 mt-1">
                          Blocked while the seat is under native search
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </form>
    </Modal>
  );
}
