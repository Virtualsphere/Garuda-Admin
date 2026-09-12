import { useState } from 'react';
import {
  X,
  FileText,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Loader2,
  Save,
} from 'lucide-react';

import agentLeadService from '../../../services/agentLeadService';
import { AGENT_CODE } from '../agentConstants';

/**
 * The agent's document vault.
 *
 * Each row reflects what is actually on the agent record — the prototype shows
 * four permanently "Verified" documents, which would be a lie here: a desk uses
 * this screen to find out what is *missing*. A row with no link offers to
 * record one instead of pretending a file exists.
 */
export default function AgentDocumentsModal({ agent, onClose, onOpenReceipt, onSaved }) {
  const [draft, setDraft] = useState({});
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [local, setLocal] = useState(agent || {});

  if (!agent) return null;

  const current = { ...agent, ...local };
  const onboardedOn = current.onboarding_completed_at?.slice(0, 10) || current.joining_date || null;

  const documents = [
    {
      id: 'agreement',
      title: 'Franchise partner agreement',
      category: 'Legal contract',
      date: current.agreement_date || onboardedOn,
      uploaded: Boolean(current.agreement_uploaded),
      url: current.agreement_url,
      urlField: 'agreementUrl',
      flagField: 'agreementUploaded',
    },
    {
      id: 'receipt',
      title: `Official franchise fee receipt${
        current.security_deposit
          ? ` (₹${Number(current.security_deposit).toLocaleString('en-IN')} security deposit)`
          : ''
      }`,
      category: 'Financial voucher',
      date: onboardedOn,
      uploaded: Boolean(current.receipt_no),
      isReceipt: true,
    },
    {
      id: 'id',
      title: 'Government Aadhaar / PAN KYC copy',
      category: 'Identity proof',
      date: onboardedOn,
      uploaded: Boolean(current.id_proof_uploaded),
      url: current.id_proof_url,
      urlField: 'idProofUrl',
      flagField: 'idProofUploaded',
    },
    {
      id: 'address',
      title: `Residence & land record proof${
        current.village ? ` (${current.village})` : ''
      }`,
      category: 'Territory proof',
      date: onboardedOn,
      uploaded: Boolean(current.address_proof_uploaded),
      url: current.address_proof_url,
      urlField: 'addressProofUrl',
      flagField: 'addressProofUploaded',
    },
  ];

  const verifiedCount = documents.filter((d) => d.uploaded).length;

  const saveDoc = async (doc) => {
    const url = String(draft[doc.id] ?? doc.url ?? '').trim();
    setSaving(true);
    setError(null);
    try {
      await agentLeadService.updatePaperwork(agent.id, {
        [doc.urlField]: url || null,
        [doc.flagField]: Boolean(url),
      });
      // Reflect it locally so the row updates without re-opening the vault.
      setLocal((prev) => ({
        ...prev,
        [doc.id === 'id' ? 'id_proof_url' : doc.id === 'address' ? 'address_proof_url' : 'agreement_url']: url || null,
        [doc.id === 'id'
          ? 'id_proof_uploaded'
          : doc.id === 'address'
          ? 'address_proof_uploaded'
          : 'agreement_uploaded']: Boolean(url),
      }));
      setEditing(null);
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save that document link.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden text-xs"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="h-14 px-5 border-b border-stone-200 flex items-center justify-between bg-stone-50 shrink-0 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-[#2563EB] shrink-0" />
            <h3 className="font-bold text-stone-900 text-sm truncate">
              Agent document vault • {agent.name} ({AGENT_CODE(agent.id)})
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200 flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3.5 bg-stone-50/50 border-b border-stone-200 text-stone-600">
          Digital archive of onboarding contracts, statutory KYC credentials and the fee
          voucher. Paste the link to a stored scan to mark a document on file.
        </div>

        {error && (
          <div className="mx-4 mt-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {documents.map((doc) => {
            const isEditing = editing === doc.id;

            return (
              <div
                key={doc.id}
                className={`p-3.5 rounded-xl border bg-white transition-colors ${
                  doc.uploaded ? 'border-stone-200' : 'border-amber-200 bg-amber-50/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        doc.uploaded
                          ? 'bg-blue-50 text-[#2563EB] border-blue-100'
                          : 'bg-amber-100 text-amber-700 border-amber-200'
                      }`}
                    >
                      {doc.isReceipt ? (
                        <Receipt className="w-4 h-4" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-stone-900 text-xs">{doc.title}</h4>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-stone-500 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-stone-100 font-medium text-stone-600">
                          {doc.category}
                        </span>
                        <span>•</span>
                        <span>{doc.date || 'no date recorded'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {doc.uploaded ? (
                      <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {doc.isReceipt ? 'Issued' : 'On file'}
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-md bg-amber-100 text-amber-900 text-[10px] font-bold border border-amber-300 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Missing
                      </span>
                    )}

                    {doc.isReceipt ? (
                      <button
                        type="button"
                        disabled={!doc.uploaded}
                        onClick={() => {
                          onClose();
                          onOpenReceipt?.();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-[11px] flex items-center gap-1.5 disabled:opacity-40"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        Open receipt
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {doc.url && (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-700 font-medium text-[11px] flex items-center gap-1"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
                            View
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(isEditing ? null : doc.id);
                            setDraft((p) => ({ ...p, [doc.id]: doc.url || '' }));
                          }}
                          className="px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-700 font-medium text-[11px]"
                        >
                          {doc.url ? 'Replace' : 'Add link'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {isEditing && (
                  <div className="mt-2.5 pt-2.5 border-t border-stone-100 flex items-center gap-2">
                    <input
                      value={draft[doc.id] ?? ''}
                      onChange={(e) => setDraft((p) => ({ ...p, [doc.id]: e.target.value }))}
                      placeholder="https://… link to the stored scan"
                      className="flex-1 text-xs bg-white border border-stone-200 rounded-lg px-2.5 py-1.5"
                    />
                    <button
                      type="button"
                      onClick={() => saveDoc(doc)}
                      disabled={saving}
                      className="px-3 py-1.5 rounded-lg bg-stone-900 text-white font-bold text-[11px] inline-flex items-center gap-1.5 disabled:opacity-40"
                    >
                      {saving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="px-3 py-1.5 rounded-lg border border-stone-200 text-stone-600 font-semibold text-[11px]"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="h-14 px-5 border-t border-stone-200 bg-stone-50 flex items-center justify-between shrink-0 gap-3">
          <span
            className={`font-semibold ${
              verifiedCount === documents.length ? 'text-emerald-700' : 'text-amber-800'
            }`}
          >
            {verifiedCount} of {documents.length} documents on file
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-900 text-white font-semibold hover:bg-stone-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
