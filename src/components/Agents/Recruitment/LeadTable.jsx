import { Phone, UserRound, Loader2 } from 'lucide-react';

/**
 * The lead grid shared by every recruitment queue — Leads, Allot Leads, Calls
 * and Team Leader all render the same row so a lead looks identical wherever
 * the desk meets it.
 *
 * `columns` lets a queue add its own trailing cells (allotment, follow-up date)
 * without forking the component.
 */
export default function LeadTable({
  leads = [],
  loading,
  selectable = false,
  selectedIds = [],
  onToggle,
  onToggleAll,
  onCall,
  onOpenLead,
  extraColumns = [],
  emptyMessage = 'No leads in this queue.',
}) {
  const allSelected = leads.length > 0 && selectedIds.length === leads.length;

  return (
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto max-h-[calc(100vh-330px)]">
        <table className="w-full text-xs text-left">
          <thead className="sticky top-0 z-20 shadow-2xs">
            <tr className="bg-stone-100 text-stone-700 font-semibold border-b border-stone-200 select-none">
              {selectable && (
                <th className="p-2.5 w-10 text-center bg-stone-100">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleAll}
                    aria-label="Select all leads"
                    className="accent-[#2563EB] cursor-pointer"
                  />
                </th>
              )}
              <th className="p-2.5 w-10 text-center bg-stone-100">Photo</th>
              <th className="p-2.5 bg-stone-100">Name</th>
              <th className="p-2.5 bg-stone-100">Phone</th>
              <th className="p-2.5 bg-stone-100">Village</th>
              <th className="p-2.5 bg-stone-100">Mandal</th>
              <th className="p-2.5 bg-stone-100">District</th>
              <th className="p-2.5 bg-stone-100">Source</th>
              {extraColumns.map((col) => (
                <th key={col.header} className={`p-2.5 bg-stone-100 ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
              {onCall && <th className="p-2.5 text-right w-16 bg-stone-100">Call</th>}
            </tr>
          </thead>

          <tbody className="divide-y divide-stone-100">
            {loading ? (
              <tr>
                <td
                  colSpan={20}
                  className="p-10 text-center text-stone-400"
                >
                  <span className="inline-flex items-center gap-2 font-medium">
                    <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading leads…
                  </span>
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={20} className="p-8 text-center text-stone-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              leads.map((lead) => {
                const isSelected = selectedIds.some((id) => String(id) === String(lead.id));
                return (
                  <tr
                    key={lead.id}
                    onClick={() => onOpenLead?.(lead)}
                    className={`transition-colors ${
                      isSelected ? 'bg-blue-50/60' : 'hover:bg-stone-50'
                    } ${onOpenLead ? 'cursor-pointer' : ''}`}
                  >
                    {selectable && (
                      <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggle?.(lead.id)}
                          aria-label={`Select ${lead.name}`}
                          className="accent-[#2563EB] cursor-pointer"
                        />
                      </td>
                    )}

                    <td className="p-2 text-center">
                      {lead.photo ? (
                        <img
                          src={lead.photo}
                          alt={lead.name}
                          className="w-7 h-7 rounded-full object-cover mx-auto"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-stone-200 text-stone-600 flex items-center justify-center mx-auto">
                          <UserRound className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </td>

                    <td className="p-2.5 font-semibold text-stone-900">
                      {lead.name}
                      {Number(lead.call_attempts) > 0 && (
                        <span className="ml-1.5 text-[10px] font-normal text-stone-400">
                          {lead.call_attempts} call{lead.call_attempts === 1 ? '' : 's'}
                        </span>
                      )}
                    </td>

                    <td className="p-2.5 font-mono text-stone-700">{lead.phone}</td>
                    <td className="p-2.5 text-stone-800 font-medium">{lead.village || '—'}</td>
                    <td className="p-2.5 text-stone-600">{lead.mandal || '—'}</td>
                    <td className="p-2.5 text-stone-600">{lead.district || '—'}</td>

                    <td className="p-2.5">
                      <span className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 text-[10px] font-semibold">
                        {String(lead.lead_source || 'DIRECT').replace(/_/g, ' ')}
                      </span>
                    </td>

                    {extraColumns.map((col) => (
                      <td
                        key={col.header}
                        className={`p-2.5 ${col.cellClassName || ''}`}
                        onClick={col.stopPropagation ? (e) => e.stopPropagation() : undefined}
                      >
                        {col.cell(lead)}
                      </td>
                    ))}

                    {onCall && (
                      <td className="p-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onCall(lead)}
                          title={`Call ${lead.name}`}
                          className="w-7 h-7 rounded-lg bg-[#EFF6FF] text-[#2563EB] border border-[#2563EB]/20 hover:bg-[#2563EB] hover:text-white transition-colors inline-flex items-center justify-center"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
