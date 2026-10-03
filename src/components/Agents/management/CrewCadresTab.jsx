import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Loader2, AlertTriangle, Phone, RefreshCw, Users } from 'lucide-react';

import PersonAvatar from '../common/PersonAvatar';
import EmployeeProfileModal from '../modals/EmployeeProfileModal';
import useAgentTeams from '../../../hooks/useAgentTeams';
import employeeService from '../../../services/employeeService';
import { CADRES, cadreMeta } from '../agentConstants';

/**
 * Personnel and cadres: the department roster, what band each person sits in,
 * which squad they report into, and whether they are on duty.
 *
 * Cadre and duty status are edited inline — they change often enough that a
 * modal per change would be friction.
 */
export default function CrewCadresTab() {
  const { teams, employeeById, refresh: refreshTeams } = useAgentTeams();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [cadreFilter, setCadreFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [profileEmployee, setProfileEmployee] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await employeeService.getAll();
      const list = data.data || data.employees || data.result || [];
      setEmployees(Array.isArray(list) ? list : []);
      setError(null);
    } catch (err) {
      console.error('Failed to load personnel:', err);
      setEmployees([]);
      setError('Could not load the personnel roster.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Which squad each person reports into, derived from the leader tree.
  const squadOf = useMemo(() => {
    const map = new Map();
    teams.forEach((team) => {
      map.set(String(team.teamLeaderId), { team, isLeader: true });
      (team.memberIds || []).forEach((id) =>
        map.set(String(id), { team, isLeader: false })
      );
    });
    return map;
  }, [teams]);

  const cadreCounts = useMemo(() => {
    const counts = { All: employees.length, Unassigned: 0 };
    CADRES.forEach((c) => {
      counts[c.value] = 0;
    });
    employees.forEach((e) => {
      if (e.cadre && counts[e.cadre] !== undefined) counts[e.cadre] += 1;
      else counts.Unassigned += 1;
    });
    return counts;
  }, [employees]);

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return employees.filter((emp) => {
      if (cadreFilter === 'Unassigned' && emp.cadre) return false;
      if (cadreFilter !== 'All' && cadreFilter !== 'Unassigned' && emp.cadre !== cadreFilter)
        return false;
      if (
        q &&
        !String(emp.name || '').toLowerCase().includes(q) &&
        !String(emp.phone || '').includes(q) &&
        !String(emp.role || '').toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [employees, cadreFilter, searchQuery]);

  const patchEmployee = async (emp, patch) => {
    setBusyId(emp.id);
    setError(null);
    try {
      await employeeService.update(emp.id, patch);
      // Update in place rather than refetching the whole roster for one field.
      setEmployees((prev) =>
        prev.map((e) => (String(e.id) === String(emp.id) ? { ...e, ...patch } : e))
      );
      refreshTeams?.();
    } catch (err) {
      setError(err.response?.data?.message || `Could not update ${emp.name}.`);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const onlineCount = employees.filter((e) => e.duty_status === 'online').length;

  return (
    <div className="space-y-3">
      {/* Summary + cadre counters */}
      <div className="bg-white border border-stone-200 rounded-lg p-3 shadow-2xs space-y-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-stone-900 text-xs inline-flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#2563EB]" />
            {employees.length} personnel
          </span>
          <span className="text-xs text-stone-500">
            <strong className="text-emerald-700">{onlineCount}</strong> on duty
          </span>

          <div className="flex items-center gap-1.5 bg-stone-50 px-2.5 py-1.5 rounded-md border border-stone-200 flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, phone, role…"
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
        </div>

        <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-stone-100">
          <CadreChip
            active={cadreFilter === 'All'}
            onClick={() => setCadreFilter('All')}
            tone="bg-stone-800 text-white border-stone-800"
            count={cadreCounts.All}
          >
            All
          </CadreChip>
          {CADRES.map((c) => (
            <CadreChip
              key={c.value}
              active={cadreFilter === c.value}
              onClick={() => setCadreFilter(cadreFilter === c.value ? 'All' : c.value)}
              tone={c.tone}
              count={cadreCounts[c.value]}
            >
              {c.short}
            </CadreChip>
          ))}
          {cadreCounts.Unassigned > 0 && (
            <CadreChip
              active={cadreFilter === 'Unassigned'}
              onClick={() =>
                setCadreFilter(cadreFilter === 'Unassigned' ? 'All' : 'Unassigned')
              }
              tone="bg-stone-100 text-stone-500 border-stone-200"
              count={cadreCounts.Unassigned}
            >
              Unassigned
            </CadreChip>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Roster */}
      <div className="bg-white rounded-lg border border-stone-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto max-h-[calc(100vh-400px)]">
          <table className="w-full text-xs text-left">
            <thead className="sticky top-0 z-20">
              <tr className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
                <th className="p-2.5 bg-stone-50">Staff</th>
                <th className="p-2.5 bg-stone-50">Role</th>
                <th className="p-2.5 bg-stone-50">Team &amp; reporting</th>
                <th className="p-2.5 bg-stone-50">Cadre</th>
                <th className="p-2.5 text-center bg-stone-50">Duty</th>
                <th className="p-2.5 text-right bg-stone-50">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-stone-400">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading
                      personnel…
                    </span>
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-stone-400">
                    No personnel match these filters.
                  </td>
                </tr>
              ) : (
                visible.map((emp) => {
                  const squad = squadOf.get(String(emp.id));
                  const meta = cadreMeta(emp.cadre);
                  const busy = String(busyId) === String(emp.id);
                  const online = emp.duty_status === 'online';

                  return (
                    <tr key={emp.id} className="hover:bg-stone-50 transition-colors">
                      <td className="p-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <PersonAvatar name={emp.name} photo={emp.photo} size="sm" />
                          <div className="min-w-0">
                            <div className="font-semibold text-stone-900 truncate">
                              {emp.name}
                            </div>
                            <div className="text-[10px] text-stone-400">{emp.phone}</div>
                          </div>
                        </div>
                      </td>

                      <td className="p-2.5 text-stone-700">
                        {emp.role || '—'}
                        {typeof emp.secondary_role === 'string' && emp.secondary_role && (
                          <div className="text-[10px] text-stone-400">
                            {emp.secondary_role}
                          </div>
                        )}
                      </td>

                      <td className="p-2.5">
                        {squad ? (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <PersonAvatar
                              name={squad.team.teamLeaderName}
                              photo={
                                employeeById.get(String(squad.team.teamLeaderId))?.photo ||
                                squad.team.teamLeaderPhoto
                              }
                              size="xs"
                            />
                            <div className="min-w-0">
                              <div className="text-stone-800 font-medium truncate">
                                {squad.team.shortName}
                              </div>
                              <div className="text-[10px] text-stone-400 truncate">
                                {squad.isLeader
                                  ? 'Leads this squad'
                                  : `Reports to ${squad.team.teamLeaderName.split(' ')[0]}`}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-stone-400">No squad</span>
                        )}
                      </td>

                      <td className="p-2.5">
                        <select
                          value={emp.cadre || ''}
                          disabled={busy}
                          onChange={(e) => patchEmployee(emp, { cadre: e.target.value })}
                          className={`px-1.5 py-0.5 rounded border text-[10px] font-bold disabled:opacity-50 ${meta.tone}`}
                        >
                          <option value="">Unassigned</option>
                          {CADRES.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            patchEmployee(emp, {
                              duty_status: online ? 'offline' : 'online',
                            })
                          }
                          title={online ? 'On duty — click to set offline' : 'Offline — click to set on duty'}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-bold transition-colors disabled:opacity-50 ${
                            online
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                              : 'bg-stone-100 border-stone-300 text-stone-500'
                          }`}
                        >
                          {busy ? (
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          ) : (
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                online ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'
                              }`}
                            />
                          )}
                          {online ? 'Online' : 'Offline'}
                        </button>
                      </td>

                      <td className="p-2.5 text-right">
                        {emp.phone && (
                          <a
                            href={`tel:${emp.phone}`}
                            title={`Call ${emp.name}`}
                            className="inline-flex p-1.5 rounded border border-stone-200 hover:bg-stone-50 text-[#2563EB]"
                          >
                            <Phone className="w-3 h-3" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => setProfileEmployee(emp)}
                          className="ml-1.5 px-2 py-1 rounded border border-stone-200 bg-white hover:bg-stone-50 text-[10px] font-bold text-stone-700"
                        >
                          Profile
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-3 py-2 border-t border-stone-200 bg-stone-50/60 text-[11px] text-stone-500">
          Cadre is seniority; role is the job. Squad membership comes from the hierarchy
          tab.
        </div>
      </div>

      {profileEmployee && (
        <EmployeeProfileModal
          employee={profileEmployee}
          onClose={() => setProfileEmployee(null)}
        />
      )}
    </div>
  );
}

/* ── Local pieces ─────────────────────────────────────────────── */

function CadreChip({ active, onClick, tone, count, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-0.5 rounded-full border text-[10px] font-bold inline-flex items-center gap-1.5 transition-all ${tone} ${
        active ? 'ring-2 ring-offset-1 ring-stone-400' : 'opacity-80 hover:opacity-100'
      }`}
    >
      {children}
      <span className="bg-white/60 px-1 rounded-full">{count ?? 0}</span>
    </button>
  );
}
