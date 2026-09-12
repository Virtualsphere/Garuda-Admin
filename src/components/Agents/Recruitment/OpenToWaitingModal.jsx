import { useState } from 'react';
import recruitmentService from '../../../services/recruitmentService';
import Modal, {
  ModalError,
  ModalCallout,
  Field,
  GhostButton,
  PrimaryButton,
} from '../common/Modal';

/**
 * Releasing a seat is the deliberate act that ends native priority on it, so
 * the remark is required — it is what the audit trail records.
 */
export default function OpenToWaitingModal({ position, onClose, onDone }) {
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const canSave = remarks.trim().length >= 10 && !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;

    setSaving(true);
    setError(null);
    try {
      await recruitmentService.openPositionToWaiting(position.id, remarks.trim());
      onDone?.();
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not open this seat. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Open seat to waiting"
      subtitle={`${position.village} · Seat #${position.position_number}`}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" form="open-to-waiting-form" disabled={!canSave}>
            {saving ? 'Opening…' : 'Open seat'}
          </PrimaryButton>
        </>
      }
    >
      <form id="open-to-waiting-form" onSubmit={handleSubmit} className="space-y-4">
        <ModalError>{error}</ModalError>

        <ModalCallout tone="amber">
          Candidates born in <strong>{position.village}</strong> currently get first refusal
          on this seat. Opening it lets outside candidates on the waiting list be
          considered, and promotes them to <strong>vacancy available</strong>. This is
          recorded against your name.
        </ModalCallout>

        <Field
          label="Why is this seat being opened?"
          htmlFor="otw-remarks"
          hint={
            remarks.trim().length < 10
              ? `${10 - remarks.trim().length} more characters needed`
              : 'Ready'
          }
        >
          <textarea
            id="otw-remarks"
            rows={4}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. No native candidates responded in 60 days of outreach"
            className="w-full text-xs bg-[#fafaf9] border border-[#e7e5e4] rounded-xl px-3 py-2 font-medium text-[#1c1917] focus:bg-white focus:border-[#2563EB] resize-y"
          />
        </Field>
      </form>
    </Modal>
  );
}
