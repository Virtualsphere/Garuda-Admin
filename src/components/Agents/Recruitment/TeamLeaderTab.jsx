import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Headphones,
  Phone,
  CheckCircle2,
  RotateCcw,
  UserCog,
  Search,
  Check,
  MapPin,
  FileText,
  Play,
  Pause,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

import PersonAvatar from '../common/PersonAvatar';
import TeamLeaderCallModal from '../modals/TeamLeaderCallModal';
import TlPerformancePanel from './TlPerformancePanel';
import { useRecruitmentDesk } from '../../../hooks/useRecruitmentDesk';
import useCallAudio from '../../../hooks/useCallAudio';
import agentLeadService from '../../../services/agentLeadService';
import { errorMessage } from '../../../utils/apiErrors';
import { normaliseLead, squadLabel, sameId, stampOf } from './recruitmentModel';

const STATUS_TABS = [
  { key: 'All', label: 'All Cases', count: 'All' },
  { key: 'Pending', label: 'Pending Callback', count: 'Pending' },
  { key: 'Completed', label: 'Resolved', count: 'Completed' },
  { key: 'ReturnedToTelecaller', label: 'Returned', count: 'ReturnedToTelecaller' },
];

/**
 * The team leader's escalation hub: leads a telecaller could not close alone,
 * handed up with a note and (where MyOperator captured one) the recording.
 *
 * A lead can only have one open escalation at a time — the server enforces it
 * with a 409, so two leaders never work the same candidate.
 *
 * Every outcome — resolve, follow up, return with a note, close — is recorded
 * from the call workspace, so a case has one place it is worked rather than a
 * workspace plus a separate set of shortcut buttons that could disagree with it.
 */
export default function TeamLeaderTab({ onNavigate }) {
  const { teams, employeeById, openLead, version, notifyChanged } = useRecruitmentDesk();
  const audio = useCallAudio();

  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [tlFilterStatus, setTlFilterStatus] = useState('All');
  const [tlFilterLeader, setTlFilterLeader] = useState('All');
  const [tlSearchQuery, setTlSearchQuery] = useState('');
  const [workspace, setWorkspace] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // The whole history, so the KPI cards and tab counts read from one set.
      const data = await agentLeadService.getEscalations({ status: 'All' });
      const list = data.result || data.data || [];
      setEscalations(Array.isArray(list) ? list : []);
      setError(null);
    } catch (err) {
      console.error('Failed to load escalations:', err);
      setEscalations([]);
      setError(errorMessage(err, 'Could not load the team leader queue.'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Reloads whenever any tab or popup on the desk reports a change.
  useEffect(() => {
    load();
  }, [load, version]);

  const counts = useMemo(
    () => ({
      All: escalations.length,
      Pending: escalations.filter((e) => e.status === 'Pending').length,
      Completed: escalations.filter((e) => e.status === 'Completed').length,
      ReturnedToTelecaller: escalations.filter((e) => e.status === 'ReturnedToTelecaller').length,
    }),
    [escalations]
  );

  const teamOfCaller = useCallback(
    (id) =>
      id === null || id === undefined
        ? undefined
        : teams.find((t) => (t.memberIds || []).some((m) => sameId(m, id))),
    [teams]
  );

  const filtered = useMemo(() => {
    const q = tlSearchQuery.trim().toLowerCase();
    return escalations.filter((esc) => {
      if (tlFilterStatus !== 'All' && esc.status !== tlFilterStatus) return false;
      if (tlFilterLeader !== 'All' && !sameId(esc.team_leader_id, tlFilterLeader)) return false;
      if (!q) return true;

      const lead = esc.candidate || {};
      return (
        String(lead.name || '').toLowerCase().includes(q) ||
        String(lead.phone || '').includes(q) ||
        String(lead.village || '').toLowerCase().includes(q) ||
        String(esc.telecaller_note || '').toLowerCase().includes(q) ||
        String(esc.telecaller?.name || '').toLowerCase().includes(q)
      );
    });
  }, [escalations, tlFilterStatus, tlFilterLeader, tlSearchQuery]);

  const resetFilters = () => {
    setTlFilterStatus('All');
    setTlFilterLeader('All');
    setTlSearchQuery('');
  };

  return (
    <div className="space-y-3">
      {/* Header banner */}
      <div className="p-3 bg-linear-to-r from-amber-50/90 via-orange-50/40 to-stone-50 border border-amber-200/90 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs">
            <Headphones className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-stone-900 text-sm">
                Team Leader Operations &amp; Escalations
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                Senior Supervisory Intervention
              </span>
            </div>
            <p className="text-stone-600 text-[11px]">
              High-priority working area for candidates requiring senior intervention,
              fee/franchise reassurance, and senior conversion.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate?.('calls')}
            className="px-2.5 py-1.5 rounded-md border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 font-medium inline-flex items-center gap-1.5 transition-colors text-xs"
          >
            <Phone className="w-3.5 h-3.5 text-stone-500" />
            Telecaller Queues
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white p-3 rounded-lg border border-amber-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-amber-800 font-semibold mb-1">
            <span>Pending TL Calls</span>
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-900">{counts.Pending}</div>
          <div className="text-[11px] text-stone-500 mt-0.5">Awaiting senior callback</div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-emerald-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-emerald-800 font-semibold mb-1">
            <span>Resolved by TL</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-800">{counts.Completed}</div>
          <div className="text-[11px] text-stone-500 mt-0.5">Converted or settled</div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-blue-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-blue-800 font-semibold mb-1">
            <span>Returned to Telecaller</span>
            <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-blue-800">
            {counts.ReturnedToTelecaller}
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">Guidance note provided</div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-stone-700 font-semibold mb-1">
            <span>Total Escalated</span>
            <UserCog className="w-3.5 h-3.5 text-stone-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-stone-900">{counts.All}</div>
          <div className="text-[11px] text-stone-500 mt-0.5">All-time interventions</div>
        </div>
      </div>

      {/* Queue + analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        <div className="lg:col-span-7 xl:col-span-8 space-y-2.5">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-stone-50 p-2 rounded-lg border border-stone-200 text-xs">
            <div className="flex items-center gap-1">
              {STATUS_TABS.map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setTlFilterStatus(st.key)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                    tlFilterStatus === st.key
                      ? 'bg-white text-stone-900 shadow-2xs border border-stone-200/80 font-bold'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <span>{st.label}</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-stone-100 text-stone-700 font-mono">
                    {counts[st.count]}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-stone-500 text-[11px] font-medium">Team Leader:</span>
                <select
                  value={tlFilterLeader}
                  onChange={(e) => setTlFilterLeader(e.target.value)}
                  className="px-2 py-1 rounded border border-stone-200 bg-white text-stone-800 text-xs focus:ring-1 focus:ring-amber-400"
                >
                  <option value="All">All Team Leaders</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.teamLeaderId}>
                      {t.teamLeaderName} (TL)
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search candidate, phone, note..."
                  value={tlSearchQuery}
                  onChange={(e) => setTlSearchQuery(e.target.value)}
                  className="pl-8 pr-2.5 py-1 rounded border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 text-xs w-52 focus:ring-1 focus:ring-amber-400"
                />
              </div>
            </div>
          </div>

          {/* Escalated leads */}
          <div className="space-y-2.5">
            {loading && escalations.length === 0 ? (
              <div className="bg-white rounded-lg border border-stone-200 py-14 flex items-center justify-center">
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-stone-500">
                  <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading cases…
                </span>
              </div>
            ) : (
              filtered.map((esc) => {
                const lead = esc.candidate ? normaliseLead(esc.candidate, employeeById) : null;
                const isPending = esc.status === 'Pending';
                const isCompleted = esc.status === 'Completed';
                const isReturned = esc.status === 'ReturnedToTelecaller';
                const isAudioPlaying = sameId(audio.playingId, esc.id);
                const callerTeam = teamOfCaller(esc.telecaller_id);
                const leaderName =
                  esc.teamLeader?.name || employeeById.get(String(esc.team_leader_id))?.name;

                return (
                  <div
                    key={esc.id}
                    className={`bg-white rounded-lg border transition-all p-3 shadow-2xs ${
                      isPending
                        ? 'border-amber-200 hover:border-amber-300'
                        : isCompleted
                        ? 'border-emerald-100 hover:border-emerald-200'
                        : 'border-blue-100 hover:border-blue-200'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                      {/* 1. Candidate */}
                      <div className="flex items-start gap-3 min-w-[260px]">
                        <PersonAvatar name={lead?.name} photo={lead?.photo} size="md" />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-stone-900 text-sm">
                              {lead?.name || 'Unknown lead'}
                            </span>
                            {lead && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-stone-100 text-stone-700 font-mono">
                                {lead.code}
                              </span>
                            )}
                            {isPending && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Pending TL Review
                              </span>
                            )}
                            {isCompleted && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                                <Check className="w-2.5 h-2.5" />
                                Resolved by TL
                              </span>
                            )}
                            {isReturned && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 inline-flex items-center gap-1">
                                <RotateCcw className="w-2.5 h-2.5" />
                                Returned to Telecaller
                              </span>
                            )}
                          </div>

                          <div className="text-stone-600 text-xs mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-mono font-medium text-stone-800">
                              {lead?.phone}
                            </span>
                            <span className="text-stone-300">•</span>
                            <span className="inline-flex items-center gap-1 text-stone-700">
                              <MapPin className="w-3 h-3 text-stone-400" />
                              {lead?.nativeVillage || '—'}, {lead?.mandal || lead?.district || '—'}
                            </span>
                            <span className="text-stone-300">•</span>
                            <span className="text-stone-500">Source: {lead?.source}</span>
                          </div>

                          <div className="text-[11px] text-stone-500 mt-1 flex items-center gap-1.5">
                            <span className="font-semibold text-stone-700">Assigned TL:</span>
                            <span className="text-amber-800 font-medium">
                              {leaderName ? `${leaderName} (TL)` : 'Unassigned'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 2. Handover note + recording */}
                      <div className="flex-1 bg-stone-50 p-2.5 rounded-md border border-stone-200/80 text-xs space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] gap-2">
                          <div className="flex items-center gap-1.5 text-stone-600 flex-wrap">
                            <span className="font-semibold text-stone-900">Forwarded by:</span>
                            <span className="text-stone-800 font-medium">
                              {esc.telecaller?.name || 'Unattributed'}
                            </span>
                            {callerTeam && (
                              <span className="text-stone-500">({squadLabel(callerTeam)})</span>
                            )}
                            <span className="text-stone-400">· {stampOf(esc.forwarded_at)}</span>
                          </div>

                          {esc.call_recording_url && (
                            <button
                              type="button"
                              onClick={() => audio.toggle(esc.id, esc.call_recording_url)}
                              className={`px-2 py-0.5 rounded text-[10px] font-medium inline-flex items-center gap-1 transition-colors shrink-0 ${
                                isAudioPlaying
                                  ? 'bg-amber-500 text-white shadow-2xs'
                                  : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
                              }`}
                            >
                              {isAudioPlaying ? (
                                <>
                                  <Pause className="w-2.5 h-2.5" />
                                  <span>Playing {esc.call_duration || ''}</span>
                                </>
                              ) : (
                                <>
                                  <Play className="w-2.5 h-2.5 text-amber-600" />
                                  <span>Listen Audio ({esc.call_duration || 'Recording'})</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        <div className="text-stone-800 bg-amber-50/60 p-1.5 rounded border border-amber-200/50">
                          <span className="font-semibold text-amber-900 mr-1">Handover Note:</span>
                          {esc.telecaller_note || 'No handover note was left.'}
                        </div>

                        {esc.tl_note && (
                          <div className="text-stone-800 bg-emerald-50/60 p-1.5 rounded border border-emerald-200/50">
                            <span className="font-semibold text-emerald-900 mr-1">
                              TL Resolution ({esc.tl_result || 'Updated'}):
                            </span>
                            {esc.tl_note}
                          </div>
                        )}
                      </div>

                      {/* 3. Actions */}
                      <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
                        <button
                          type="button"
                          disabled={!lead}
                          onClick={() => lead && openLead(lead)}
                          className="px-2.5 py-1.5 rounded bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 font-medium text-xs inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                        >
                          <FileText className="w-3.5 h-3.5 text-stone-500" />
                          View Lead
                        </button>

                        <button
                          type="button"
                          onClick={() => setWorkspace(esc)}
                          className="px-3.5 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-2xs transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Call as Team Leader</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {!loading && filtered.length === 0 && (
              <div className="bg-white rounded-lg border border-stone-200 p-8 text-center text-stone-500 space-y-2">
                <Headphones className="w-8 h-8 mx-auto text-stone-300" />
                <p className="font-medium text-stone-800 text-sm">No Escalated Leads in this queue</p>
                <p className="text-xs text-stone-400">
                  When telecallers select &quot;Forward to Team Leader&quot; during a candidate
                  call, leads will automatically route here for senior intervention.
                </p>
                {(tlFilterStatus !== 'All' || tlFilterLeader !== 'All' || tlSearchQuery) && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-2 px-3 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded text-xs font-semibold"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 xl:col-span-4">
          <TlPerformancePanel
            escalations={escalations}
            teams={teams}
            employeeById={employeeById}
            selectedLeader={tlFilterLeader}
            onSelectLeader={setTlFilterLeader}
          />
        </div>
      </div>

      {workspace && (
        <TeamLeaderCallModal
          escalation={workspace}
          onClose={() => setWorkspace(null)}
          onDone={notifyChanged}
        />
      )}
    </div>
  );
}
