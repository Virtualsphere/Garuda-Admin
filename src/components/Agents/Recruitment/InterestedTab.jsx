import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Sparkles,
  CalendarPlus,
  AlertTriangle,
  RefreshCw,
  MapPin,
  Table2,
  Loader2,
  Phone,
  ShieldCheck,
  UserPlus,
  Search,
} from 'lucide-react';

import PersonAvatar from '../common/PersonAvatar';
import ScheduleVisitModal from './ScheduleVisitModal';
import OnboardingWizard from './OnboardingWizard';
import VillageAllotmentMap from '../maps/VillageAllotmentMap';
import useAgentTeams from '../../../hooks/useAgentTeams';
import agentLeadService from '../../../services/agentLeadService';

const STATUS_TONES = {
  INTERESTED: 'bg-amber-50 text-amber-800 border-amber-200',
  VILLAGE_INTEREST: 'bg-amber-50 text-amber-800 border-amber-200',
  OFFICE_VISIT: 'bg-blue-50 text-blue-800 border-blue-200',
  SELECTED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

const STATUS_LABELS = {
  INTERESTED: 'Interested',
  VILLAGE_INTEREST: 'Village interest',
  OFFICE_VISIT: 'Scheduled',
  SELECTED: 'Selected',
};

/**
 * Candidates who said yes on the call and are waiting to be booked in.
 *
 * The vacancy rule matters here: saying yes does NOT consume a village seat.
 * The seat only closes at onboarding, once the agreement is signed and the fee
 * taken — which is why this tab shows interest counts, not vacancy counts.
 */
export default function InterestedTab({ refresh }) {
  const { employeeById } = useAgentTeams();

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('table');
  const [searchQuery, setSearchQuery] = useState('');

  const [scheduling, setScheduling] = useState(null);
  const [onboarding, setOnboarding] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Everyone past the call but not yet an agent: interested, village
      // interest, selected for a seat, or already booked in.
      const results = await Promise.all(
        ['INTERESTED', 'VILLAGE_INTEREST', 'SELECTED', 'OFFICE_VISIT'].map((status) =>
          agentLeadService.getLeads({ status })
        )
      );

      const merged = new Map();
      results.forEach((data) => {
        (data.result || data.data || []).forEach((lead) => merged.set(lead.id, lead));
      });

      setLeads([...merged.values()]);
      setError(null);
    } catch (err) {
      console.error('Failed to load interested candidates:', err);
      setLeads([]);
      setError('Could not load interested candidates.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        String(l.name || '').toLowerCase().includes(q) ||
        String(l.phone || '').includes(q) ||
        String(l.village || '').toLowerCase().includes(q)
    );
  }, [leads, searchQuery]);

  // One pin per (candidate, village-of-interest) pair — somebody who wants
  // three villages should appear on all three, not just their home one.
  const candidatePins = useMemo(() => {
    const pins = [];
    leads.forEach((lead) => {
      const wanted = (lead.interests || []).map((i) => i.village).filter(Boolean);
      const villages = wanted.length ? wanted : [lead.village].filter(Boolean);
      villages.forEach((village) => {
        pins.push({
          id: `${lead.id}-${village}`,
          name: lead.name,
          village,
          phone: lead.phone,
          status: lead.status,
        });
      });
    });
    return pins;
  }, [leads]);

  return (
    <div className="space-y-3">
      {/* Vacancy rule */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs text-blue-950">
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
          <span>
            <strong>Rule:</strong> Vacancy remains available while a candidate is only{' '}
            <strong>INTERESTED</strong>. It reduces only on document agreement, deposit
            payment and official attachment in Onboarding.
          </span>
        </div>
        <span className="text-[11px] text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200 shrink-0">
          {leads.length} interested record{leads.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-stone-200 rounded-lg p-2.5 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-stone-200 p-0.5 bg-stone-100">
          <button
            type="button"
            onClick={() => setView('table')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md ${
              view === 'table' ? 'bg-white text-[#2563EB] shadow-2xs' : 'text-stone-600'
            }`}
          >
            <Table2 className="w-3.5 h-3.5" /> Table
          </button>
          <button
            type="button"
            onClick={() => setView('map')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md ${
              view === 'map' ? 'bg-white text-[#2563EB] shadow-2xs' : 'text-stone-600'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" /> Map
          </button>
        </div>

        <div className="flex items-center gap-1.5 bg-stone-50 px-2.5 py-1.5 rounded-md border border-stone-200 flex-1 min-w-[200px] max-w-sm">
          <Search className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate, phone, village…"
            className="w-full bg-transparent text-xs text-stone-800 placeholder-stone-400"
          />
        </div>

        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>

        <span className="text-xs text-stone-500 font-medium ml-auto">
          {filtered.length} awaiting an office visit
        </span>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {view === 'map' ? (
        <VillageAllotmentMap candidatePins={candidatePins} height="480px" />
      ) : (
        <div className="bg-white rounded-lg border border-stone-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto max-h-[calc(100vh-420px)]">
            <table className="w-full text-xs text-left">
              <thead className="sticky top-0 z-20">
                <tr className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
                  <th className="p-2.5 bg-stone-50">Candidate</th>
                  <th className="p-2.5 bg-stone-50">Phone</th>
                  <th className="p-2.5 bg-stone-50">Native village</th>
                  <th className="p-2.5 bg-stone-50">Interested village(s)</th>
                  <th className="p-2.5 bg-stone-50">Handled by</th>
                  <th className="p-2.5 bg-stone-50">TL support</th>
                  <th className="p-2.5 bg-stone-50">Status</th>
                  <th className="p-2.5 text-right bg-stone-50">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-stone-400">
                      <span className="inline-flex items-center gap-2 font-medium">
                        <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading…
                      </span>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-stone-400">
                      Nobody is waiting to be booked in — close a call with “Proceed” to
                      fill this queue.
                    </td>
                  </tr>
                ) : (
                  filtered.map((lead) => {
                    const caller = employeeById.get(String(lead.assigned_employee_id));
                    const leader = employeeById.get(String(lead.team_leader_id));
                    const scheduled = (lead.officeVisits || []).find(
                      (v) => v.status === 'Scheduled'
                    );

                    return (
                      <tr key={lead.id} className="hover:bg-stone-50 transition-colors">
                        <td className="p-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <PersonAvatar name={lead.name} photo={lead.photo} size="sm" />
                            <div className="min-w-0">
                              <div className="font-semibold text-stone-900 truncate">
                                {lead.name}
                              </div>
                              <div className="text-[10px] text-stone-400">
                                LD-{String(lead.id).padStart(4, '0')}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="p-2.5 text-stone-700">{lead.phone}</td>
                        <td className="p-2.5 text-stone-800 font-medium">
                          {lead.village || '—'}
                        </td>

                        <td className="p-2.5">
                          {(lead.interests || []).length === 0 ? (
                            <span className="text-stone-400">None linked</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {lead.interests.slice(0, 3).map((i) => (
                                <span
                                  key={i.id}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                    i.is_native
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : 'bg-amber-50 text-amber-800 border-amber-200'
                                  }`}
                                  title={i.is_native ? 'Native village' : 'Outside village'}
                                >
                                  {i.village}
                                </span>
                              ))}
                              {lead.interests.length > 3 && (
                                <span className="text-[10px] text-stone-400 font-bold">
                                  +{lead.interests.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="p-2.5">
                          {caller ? (
                            <div className="flex items-center gap-1.5">
                              <PersonAvatar name={caller.name} photo={caller.photo} size="xs" />
                              <span className="text-stone-700 truncate">{caller.name}</span>
                            </div>
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
                        </td>

                        <td className="p-2.5">
                          {leader ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <ShieldCheck className="w-3 h-3" />
                              {leader.name.split(' ')[0]}
                            </span>
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
                        </td>

                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                              STATUS_TONES[lead.status] || STATUS_TONES.INTERESTED
                            }`}
                          >
                            {STATUS_LABELS[lead.status] || lead.status}
                          </span>
                          {scheduled && (
                            <div className="text-[10px] text-blue-700 font-semibold mt-0.5">
                              {scheduled.visit_date}
                              {scheduled.visit_time ? ` · ${scheduled.visit_time}` : ''}
                            </div>
                          )}
                        </td>

                        <td className="p-2.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <a
                              href={lead.phone ? `tel:${lead.phone}` : undefined}
                              title="Call candidate"
                              className="p-1.5 rounded border border-stone-200 hover:bg-stone-50 text-[#2563EB] inline-flex"
                            >
                              <Phone className="w-3 h-3" />
                            </a>
                            <button
                              type="button"
                              onClick={() => setScheduling(lead)}
                              className="px-2 py-1 rounded border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs inline-flex items-center gap-1"
                            >
                              <CalendarPlus className="w-3 h-3" />
                              {scheduled ? 'Reschedule' : 'Schedule'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setOnboarding(lead)}
                              className="px-2.5 py-1 rounded bg-stone-900 hover:bg-stone-800 text-white font-medium text-xs inline-flex items-center gap-1 shadow-2xs"
                            >
                              <UserPlus className="w-3 h-3" />
                              Onboard &amp; attach
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-3 py-2 border-t border-stone-200 bg-stone-50/60 text-[11px] text-stone-500">
            Interest does not consume a seat — the village vacancy only closes at
            onboarding.
          </div>
        </div>
      )}

      {scheduling && (
        <ScheduleVisitModal
          lead={scheduling}
          onClose={() => setScheduling(null)}
          onDone={() => {
            load();
            refresh?.();
          }}
        />
      )}

      {onboarding && (
        <OnboardingWizard
          lead={onboarding}
          onClose={() => setOnboarding(null)}
          onDone={() => {
            load();
            refresh?.();
          }}
        />
      )}
    </div>
  );
}
