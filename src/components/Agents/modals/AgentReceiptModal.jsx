import { useState, useEffect } from 'react';
import {
  X,
  Printer,
  ShieldCheck,
  Receipt,
  Building2,
  Phone,
  MapPin,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

import PersonAvatar from '../common/PersonAvatar';
import agentFinanceService from '../../../services/agentFinanceService';
import { AGENT_CODE } from '../agentConstants';

const COMPANY = 'GARUDA LANDS NETWORK OPC PRIVATE LIMITED';
const CIN = 'CIN: U70109TG2026OPC189421 • Registered under Companies Act, Govt. of India';

const inr = (v) => `₹${(Number(v) || 0).toLocaleString('en-IN')}`;

const MODE_LABELS = {
  CASH: 'Cash',
  UPI: 'UPI',
  BANK_TRANSFER: 'Bank Transfer',
  CHEQUE: 'Cheque',
  ADJUSTMENT: 'Adjustment',
};

/**
 * The official fee receipt for an onboarded agent.
 *
 * The figures come from the agent row and their ledger, never from defaults —
 * a receipt is a document somebody may be handed or audited against, so an
 * invented amount or reference number would be worse than an empty field. When
 * a deposit transaction cannot be found the modal says so rather than printing
 * a plausible one.
 */
export default function AgentReceiptModal({ agent, onClose }) {
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!agent?.id) return;
    let cancelled = false;

    agentFinanceService
      .getLedger(agent.id)
      .then((data) => {
        if (cancelled) return;
        setLedger(data.result || data.data || null);
        setError(null);
      })
      .catch((err) => {
        console.error('Failed to load the agent ledger:', err);
        if (!cancelled) setError('Could not load this agent’s payment record.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [agent?.id]);

  if (!agent) return null;

  const transactions = ledger?.transactions || [];

  // The joining money: the security deposit line written at onboarding, or the
  // membership fee if that is what was collected instead.
  const deposit =
    transactions.find(
      (t) => t.type === 'OTHER' && /deposit/i.test(String(t.notes || ''))
    ) || transactions.find((t) => t.type === 'MEMBERSHIP_FEE') || null;

  const amount = deposit ? Number(deposit.amount) : Number(agent.security_deposit) || 0;
  const receiptNo = agent.receipt_no || deposit?.transaction_code || null;
  const paidOn = deposit?.transaction_date || agent.onboarding_completed_at?.slice(0, 10) || null;
  const paymentMode = deposit?.payment_mode ? MODE_LABELS[deposit.payment_mode] || deposit.payment_mode : null;
  const referenceNo = deposit?.reference_no || null;
  const village = agent.village || null;

  const division = [
    agent.mandal ? `${agent.mandal} Mandal` : null,
    agent.district ? `${agent.district} Dist` : null,
    agent.state,
  ]
    .filter(Boolean)
    .join(', ');

  /**
   * Printed from its own window with a self-contained stylesheet. Printing the
   * app page instead would carry the whole shell onto the paper, and this
   * section's utilities are scoped to `.garuda-agents` so they would not
   * survive into a print context reliably.
   */
  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=820,height=1000');
    if (!win) return;

    const row = (label, value) =>
      `<tr><td class="k">${label}</td><td class="v">${value ?? '—'}</td></tr>`;

    win.document.write(`<!doctype html><html><head><meta charset="utf-8">
<title>Receipt ${receiptNo || AGENT_CODE(agent.id)}</title>
<style>
  *{box-sizing:border-box}
  body{font:13px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#1c1917;margin:0;padding:32px}
  .head{text-align:center;border-bottom:2px solid #1c1917;padding-bottom:16px;margin-bottom:20px}
  .tag{display:inline-block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#1e40af;background:#eff6ff;border-radius:999px;padding:3px 10px;margin-bottom:6px}
  h1{font-size:21px;margin:4px 0;text-transform:uppercase;letter-spacing:-.01em}
  .cin{font-size:10px;color:#78716c;margin:0}
  h2{font-size:13px;color:#047857;text-transform:uppercase;letter-spacing:.08em;margin:10px 0 0}
  .meta{display:flex;justify-content:space-between;background:#fafaf9;border:1px solid #e7e5e4;border-radius:10px;padding:12px;margin-bottom:16px}
  .lbl{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#a8a29e;font-weight:700;display:block}
  .no{font-weight:700;color:#2563eb;font-size:14px}
  .who{border:1px solid #e7e5e4;border-radius:10px;padding:14px;margin-bottom:16px;background:#fafaf9}
  .who h3{margin:0 0 4px;font-size:16px}
  .who p{margin:2px 0;color:#57534e;font-size:12px}
  table{width:100%;border-collapse:collapse;border:1px solid #e7e5e4;border-radius:10px;overflow:hidden}
  td{padding:9px 12px;border-bottom:1px solid #f5f5f4;font-size:12px}
  .k{color:#57534e}
  .v{text-align:right;font-weight:600;color:#1c1917}
  .total td{background:#ecfdf5;border-top:2px solid #10b981;font-size:15px;font-weight:800;color:#065f46}
  .sign{display:flex;justify-content:space-between;margin-top:24px;padding-top:14px;border-top:1px solid #e7e5e4;font-size:11px;color:#78716c}
  .sign b{color:#1c1917;display:block}
  .stamp{color:#047857;font-weight:700}
  @page{margin:14mm}
</style></head><body>
  <div class="head">
    <span class="tag">Corporate Land Agency Network</span>
    <h1>${COMPANY}</h1>
    <p class="cin">${CIN}</p>
    <h2>Official Agent Fee Receipt</h2>
  </div>

  <div class="meta">
    <div><span class="lbl">Receipt Number</span><span class="no">${receiptNo || 'Not issued'}</span></div>
    <div style="text-align:right"><span class="lbl">Payment Date</span><span>${paidOn || '—'}</span></div>
  </div>

  <div class="who">
    <h3>${agent.name} <span style="float:right;font-size:12px;color:#57534e">${AGENT_CODE(agent.id)}</span></h3>
    <p>${agent.phone || '—'}</p>
    <p>Attached village: <strong>${village || '—'}</strong></p>
  </div>

  <table>
    ${row('Officially attached village', village)}
    ${row('Administrative division', division || '—')}
    ${row('Payment mode', paymentMode)}
    ${row('Payment reference no.', referenceNo)}
    ${row('Agreement execution date', agent.agreement_date)}
    <tr class="total"><td>Amount paid (security deposit)</td><td class="v">${inr(amount)}</td></tr>
  </table>

  <div class="sign">
    <div><b>Received by:</b>Regional Onboarding Officer<br><span style="font-size:10px">Garuda Regional Office Operations</span></div>
    <div style="text-align:right"><b>Digital authorization:</b><span class="stamp">VERIFIED-SECURE-STAMP</span><br><span style="font-size:10px">Official computer generated voucher</span></div>
  </div>
</body></html>`);

    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div
      className="fixed inset-0 z-[1000] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden text-xs"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="h-12 px-5 border-b border-stone-200 flex items-center justify-between bg-stone-50/80 shrink-0">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-stone-900 text-sm">Official Agent Fee Receipt</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-white">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div className="text-center pb-5 border-b-2 border-stone-900 space-y-1">
            <div className="inline-flex items-center justify-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-800 text-[11px] font-bold tracking-wide uppercase mb-1">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              Corporate Land Agency Network
            </div>
            <h1 className="text-xl font-black tracking-tight text-stone-900 uppercase">
              {COMPANY}
            </h1>
            <p className="text-[11px] text-stone-500 font-medium">{CIN}</p>
            <h2 className="text-sm font-bold text-emerald-700 tracking-wider uppercase pt-2">
              Official Agent Fee Receipt
            </h2>
          </div>

          <div className="flex items-center justify-between bg-stone-50 p-3.5 rounded-xl border border-stone-200 gap-3">
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400 block">
                Receipt number
              </span>
              {receiptNo ? (
                <span className="font-bold text-sm text-[#2563EB]">{receiptNo}</span>
              ) : (
                <span className="text-[11px] text-amber-700 font-semibold">
                  No receipt number recorded
                </span>
              )}
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400 block">
                Payment date
              </span>
              <span className="font-medium text-stone-900 text-xs">{paidOn || '—'}</span>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-xl border border-stone-200 bg-stone-50/50">
            <PersonAvatar name={agent.name} photo={agent.photo} size={64} />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-base text-stone-900 truncate">{agent.name}</h3>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-stone-200 text-stone-800 shrink-0">
                  {AGENT_CODE(agent.id)}
                </span>
              </div>
              <p className="text-stone-600 flex items-center gap-1.5 text-xs">
                <Phone className="w-3.5 h-3.5 text-stone-400" />
                {agent.phone || '—'}
              </p>
              <p className="text-stone-600 flex items-center gap-1.5 text-xs">
                <MapPin className="w-3.5 h-3.5 text-stone-400" />
                Attached village: <strong className="text-stone-800">{village || '—'}</strong>
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
              Franchise territory &amp; payment breakdown
            </h4>

            {loading ? (
              <div className="py-8 flex items-center justify-center">
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-stone-500">
                  <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Reading the ledger…
                </span>
              </div>
            ) : (
              <div className="rounded-xl border border-stone-200 divide-y divide-stone-100 bg-white overflow-hidden">
                <Line label="Officially attached village">
                  {village ? (
                    <span className="font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                      {village}
                    </span>
                  ) : (
                    <Missing />
                  )}
                </Line>
                <Line label="Administrative division">
                  {division || <Missing />}
                </Line>
                <Line label="Payment mode">{paymentMode || <Missing />}</Line>
                <Line label="Payment reference no.">{referenceNo || <Missing />}</Line>
                <Line label="Agreement execution date">
                  {agent.agreement_date || <Missing />}
                </Line>

                <div className="p-3.5 flex justify-between items-center bg-emerald-50/60 border-t-2 border-emerald-500 gap-3">
                  <div className="min-w-0">
                    <span className="font-bold text-stone-900 text-sm block">
                      Amount paid (security deposit)
                    </span>
                    <span className="text-[10px] text-stone-500">
                      Refundable subject to franchise agreement conditions
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-black text-emerald-800 text-lg">{inr(amount)}</span>
                    <span className="text-[10px] text-emerald-700 font-bold flex items-center justify-end gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {deposit ? 'Paid & cleared' : 'From the agent record'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {!loading && !deposit && (
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                No payment transaction is recorded against this agent, so the mode and
                reference are blank. The amount shown is the deposit stored on the agent
                record.
              </p>
            )}
          </div>

          <div className="pt-4 border-t border-stone-200 grid grid-cols-2 gap-6 text-[11px] text-stone-500">
            <div>
              <span className="font-bold text-stone-800 block mb-0.5">Received by:</span>
              <p className="text-stone-700 font-medium">Regional Onboarding Officer</p>
              <p className="text-[10px] text-stone-400">Garuda Regional Office Operations</p>
            </div>
            <div className="text-right">
              <span className="font-bold text-stone-800 block mb-0.5">Digital authorization:</span>
              <p className="text-emerald-700 font-bold">VERIFIED-SECURE-STAMP</p>
              <p className="text-[10px] text-stone-400">Official computer generated voucher</p>
            </div>
          </div>
        </div>

        <div className="h-14 px-6 border-t border-stone-200 bg-stone-50 flex items-center justify-between shrink-0 gap-3">
          <span className="text-[11px] text-stone-500 truncate">
            Stored in the agent profile &amp; documents repository
          </span>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl border border-stone-300 hover:bg-stone-100 text-stone-700 font-semibold text-xs flex items-center gap-2 transition-colors"
            >
              <Printer className="w-4 h-4 text-stone-600" />
              Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Line({ label, children }) {
  return (
    <div className="p-3 flex justify-between items-center gap-3">
      <span className="text-stone-600 shrink-0">{label}:</span>
      <span className="text-stone-900 font-medium text-right min-w-0 truncate">{children}</span>
    </div>
  );
}

function Missing() {
  return <span className="text-stone-400 font-normal">Not recorded</span>;
}
