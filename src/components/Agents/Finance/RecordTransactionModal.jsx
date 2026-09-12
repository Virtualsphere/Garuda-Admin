import { useState, useMemo } from 'react';

import Modal, {
  ModalError,
  ModalCallout,
  Field,
  inputClass,
  GhostButton,
  PrimaryButton,
} from '../common/Modal';
import agentFinanceService from '../../../services/agentFinanceService';
import {
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
  PAYMENT_MODES,
  formatINR,
} from '../agentConstants';

/**
 * Record a line against an agent's ledger.
 *
 * Marking it PAID here settles it immediately — the server then recomputes the
 * agent's running totals and, for a membership fee, flips their membership
 * badge. A settled line cannot be re-priced afterwards, so the modal says so.
 */
export default function RecordTransactionModal({ agents = [], defaultAgentId, onClose, onSaved }) {
  const [agentId, setAgentId] = useState(defaultAgentId ? String(defaultAgentId) : '');
  const [type, setType] = useState('COMMISSION');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('PENDING');
  const [paymentMode, setPaymentMode] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [transactionDate, setTransactionDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const typeMeta = useMemo(
    () => TRANSACTION_TYPES.find((t) => t.key === type),
    [type]
  );

  const numericAmount = Number(amount) || 0;
  const willSettle = ['PAID', 'PARTIAL'].includes(status);
  const canSave = agentId && type && numericAmount > 0 && !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;

    setSaving(true);
    setError(null);
    try {
      await agentFinanceService.createTransaction({
        agentId: Number(agentId),
        type,
        amount: numericAmount,
        status,
        paymentMode: paymentMode || undefined,
        referenceNo: referenceNo.trim() || undefined,
        transactionDate,
        notes: notes.trim() || undefined,
      });
      onSaved?.();
    } catch (err) {
      setError(
        err.response?.data?.message || 'Could not record this transaction. Try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Record transaction"
      subtitle="Add a line to the agent finance ledger"
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" form="record-txn-form" disabled={!canSave}>
            {saving ? 'Saving…' : 'Record transaction'}
          </PrimaryButton>
        </>
      }
    >
      <form id="record-txn-form" onSubmit={handleSubmit} className="space-y-4">
        <ModalError>{error}</ModalError>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Agent" htmlFor="txn-agent">
            <select
              id="txn-agent"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className={inputClass}
            >
              <option value="">Select an agent…</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} — {agent.village || 'Unassigned'}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Type"
            htmlFor="txn-type"
            hint={
              typeMeta?.direction === 'OUT'
                ? 'Money paid out to the agent'
                : 'Money received from the agent'
            }
          >
            <select
              id="txn-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={inputClass}
            >
              {TRANSACTION_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Amount (₹)"
            htmlFor="txn-amount"
            hint={numericAmount > 0 ? formatINR(numericAmount) : undefined}
          >
            <input
              id="txn-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={inputClass}
            />
          </Field>

          <Field label="Status" htmlFor="txn-status">
            <select
              id="txn-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={inputClass}
            >
              {TRANSACTION_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Payment mode" htmlFor="txn-mode">
            <select
              id="txn-mode"
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className={inputClass}
            >
              <option value="">Not specified</option>
              {PAYMENT_MODES.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Reference no." htmlFor="txn-ref">
            <input
              id="txn-ref"
              type="text"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="UTR, cheque no., receipt…"
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Transaction date" htmlFor="txn-date">
          <input
            id="txn-date"
            type="date"
            value={transactionDate}
            onChange={(e) => setTransactionDate(e.target.value)}
            className={inputClass}
          />
        </Field>

        {willSettle && (
          <ModalCallout tone="amber">
            Recording this as <strong>{status.toLowerCase()}</strong> settles it straight
            away. A settled line cannot be re-priced or deleted afterwards — a correction
            has to be raised as its own adjusting entry.
            {type === 'MEMBERSHIP_FEE' &&
              " It will also mark this agent's membership as paid."}
          </ModalCallout>
        )}

        <Field label="Notes" htmlFor="txn-notes">
          <textarea
            id="txn-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What is this payment for?"
            className={`${inputClass} resize-y`}
          />
        </Field>
      </form>
    </Modal>
  );
}
