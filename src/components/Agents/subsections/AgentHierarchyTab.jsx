import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Network,
  Users,
  Building2,
  Plus,
  GripVertical,
  BarChart3,
  Activity,
  Headphones,
  Wrench,
  Loader2,
  AlertTriangle,
  X,
} from 'lucide-react';

import PersonAvatar from '../common/PersonAvatar';
import CallButton from '../common/CallButton';
import useAgentTeams from '../../../hooks/useAgentTeams';
import agentCoordinationService from '../../../services/agentCoordinationService';
import { cadreMeta } from '../agentConstants';

/**
 * The department's shape: two wings, each a set of squads led by a team leader.
 *
 * The wings are genuinely separate — an employee can hold a place in both —
 * because `department_leaders` is keyed on (employee, department_type). Moving
 * somebody here writes that row, so a drag is a real reassignment rather than
 * a local rearrangement that evaporates on reload.
 *
 * The coordination wing is sized around 500 agents per executive and 10
 * executives per team leader. Those figures are a standing operational ratio,
 * printed as the blueprint; every count shown beside them is live.
 */

const WINGS = [
  {
    key: 'coordination',
    index: '1',
    label: 'Agents Coordination Department',
    icon: Network,
    quota: 10,
    accent: 'emerald',
  },
  {
    key: 'recruitment',
    index: '2',
    label: 'Agents Recruitment & Telecalling Wing',
    icon: Users,
    quota: 9,
    accent: 'blue',
  },
];

const AGENTS_PER_EXECUTIVE = 500;

const isSupportRole = (emp) => {
  const role = String(emp?.role || '').toLowerCase();
  return role.includes('agent support') || role.includes('technical support') || role.includes('tech support');
};

const isTechSupport = (emp) => {
  const role = String(emp?.role || '').toLowerCase();
  return role.includes('technical support') || role.includes('tech support');
};

const isLeadership = (emp) => {
  const cadre = String(emp?.cadre || '').toLowerCase();
  return cadre.includes('level 5') || cadre.includes('leadership') || cadre.includes('director');
};

const isDepartmentManager = (emp) => {
  const cadre = String(emp?.cadre || '').toLowerCase();
  const role = String(emp?.role || '').toLowerCase();
  return cadre.includes('level 4') || role.includes('department manager');
};

export default function AgentHierarchyTab() {
  const [wing, setWing] = useState('coordination');
  const {
    teams,
    employees,
    employeeById,
    loading,
    error,
    refresh,
    moveToTeam,
  } = useAgentTeams(wing);

  const [rightPanelTab, setRightPanelTab] = useState('workload');
  const [poolFilter, setPoolFilter] = useState('all');
  const [poolSearch, setPoolSearch] = useState('');
  const [dragOverTeamId, setDragOverTeamId] = useState(null);
  const [isDragOverPool, setIsDragOverPool] = useState(false);
  const [toast, setToast] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showAddSquad, setShowAddSquad] = useState(false);

  const [agentLoad, setAgentLoad] = useState({ counts: {}, unassigned: 0, assigned: 0 });

  const wingMeta = WINGS.find((w) => w.key === wing) || WINGS[0];
  const quota = wingMeta.quota;
  const isCoordination = wing === 'coordination';

  // How many agents each coordination executive actually looks after. Only the
  // coordination wing is measured that way, so the recruitment wing skips it.
  useEffect(() => {
    if (!isCoordination) return;
    let cancelled = false;
    agentCoordinationService
      .getLoad()
      .then((data) => {
        if (cancelled) return;
        const result = data.result || data.data || {};
        setAgentLoad({
          counts: result.counts || {},
          unassigned: result.unassigned || 0,
          assigned: result.assigned || 0,
        });
      })
      .catch((err) => {
        console.error('Failed to load coordination workload:', err);
        if (!cancelled) setAgentLoad({ counts: {}, unassigned: 0, assigned: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, [isCoordination, teams]);

  const say = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
  }, []);

  const assignedIds = useMemo(() => {
    const ids = new Set();
    teams.forEach((t) => t.memberIds.forEach((id) => ids.add(String(id))));
    return ids;
  }, [teams]);

  const leaderIds = useMemo(
    () => new Set(teams.map((t) => String(t.teamLeaderId))),
    [teams]
  );

  // Everyone who can staff a squad: not leadership, not the department
  // manager, and not a team leader of this wing (they lead rather than fill a
  // seat).
  const assignable = useMemo(
    () =>
      employees.filter(
        (emp) =>
          !isLeadership(emp) &&
          !isDepartmentManager(emp) &&
          !leaderIds.has(String(emp.id)) &&
          !(isCoordination && isSupportRole(emp))
      ),
    [employees, leaderIds, isCoordination]
  );

  const pool = useMemo(() => {
    const q = poolSearch.trim().toLowerCase();
    return assignable.filter((emp) => {
      const isAssigned = assignedIds.has(String(emp.id));
      if (poolFilter === 'unassigned' && isAssigned) return false;
      if (poolFilter === 'assigned' && !isAssigned) return false;
      if (!q) return true;
      return (
        String(emp.name || '').toLowerCase().includes(q) ||
        String(emp.role || '').toLowerCase().includes(q) ||
        String(emp.id).includes(q) ||
        String(emp.cadre || '').toLowerCase().includes(q)
      );
    });
  }, [assignable, assignedIds, poolFilter, poolSearch]);

  const availableCount = assignable.filter((e) => !assignedIds.has(String(e.id))).length;

  const supportStaff = useMemo(() => employees.filter(isSupportRole), [employees]);
  const agentSupport = useMemo(
    () => supportStaff.filter((e) => !isTechSupport(e)),
    [supportStaff]
  );
  const techSupport = useMemo(() => supportStaff.filter(isTechSupport), [supportStaff]);

  const manager = useMemo(
    () => employees.find((e) => isDepartmentManager(e)) || null,
    [employees]
  );

  const wingMemberCount = useMemo(() => {
    const ids = new Set([...assignedIds]);
    leaderIds.forEach((id) => ids.add(id));
    supportStaff.forEach((e) => ids.add(String(e.id)));
    if (manager) ids.add(String(manager.id));
    return ids.size;
  }, [assignedIds, leaderIds, supportStaff, manager]);

  const membersOf = useCallback(
    (team) => team.memberIds.map((id) => employeeById.get(String(id))).filter(Boolean),
    [employeeById]
  );

  /* ── Moves ───────────────────────────────────────────────── */

  const move = async (employeeId, leaderId, label) => {
    setBusy(true);
    setActionError(null);
    try {
      await moveToTeam(employeeId, leaderId);
      say(label);
    } catch (err) {
      setActionError(
        err.response?.data?.message || 'Could not save that move. Nothing was changed.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDragStart = (e, empId) => {
    e.dataTransfer.setData('text/plain', String(empId));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, teamId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTeamId(teamId);
  };

  const handleDrop = async (e, teamId) => {
    e.preventDefault();
    setDragOverTeamId(null);
    const empId = e.dataTransfer.getData('text/plain');
    if (!empId) return;
    const emp = employeeById.get(String(empId));
    const team = teams.find((t) => String(t.id) === String(teamId));
    await move(empId, teamId, `Moved ${emp?.name || 'employee'} to ${team?.name || 'squad'}`);
  };

  const handleDropToPool = async (e) => {
    e.preventDefault();
    setIsDragOverPool(false);
    const empId = e.dataTransfer.getData('text/plain');
    if (!empId) return;
    const emp = employeeById.get(String(empId));
    await move(empId, null, `Returned ${emp?.name || 'employee'} to the available pool`);
  };

  /* ── Render ──────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="bg-white border border-stone-200 rounded-lg py-16 flex items-center justify-center">
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-stone-500">
          <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading the department…
        </span>
      </div>
    );
  }

  const totalSeats = teams.length * quota;
  const deployed = assignedIds.size;
  const openSlots = Math.max(0, totalSeats - deployed);

  return (
    <div className="space-y-3.5 text-xs relative">
      {/* Wing switcher */}
      <div className="p-1.5 bg-stone-100 rounded-xl border border-stone-200 flex flex-col sm:flex-row items-center gap-2">
        {WINGS.map((w) => {
          const Icon = w.icon;
          const active = wing === w.key;
          const badge =
            w.key === wing
              ? w.key === 'coordination'
                ? `${wingMemberCount} Members`
                : `${teams.length} Squads`
              : w.key === 'coordination'
              ? 'Coordination'
              : 'Telecalling';

          return (
            <button
              key={w.key}
              type="button"
              onClick={() => setWing(w.key)}
              className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                active
                  ? w.accent === 'emerald'
                    ? 'bg-white text-emerald-950 shadow-2xs border border-emerald-300 ring-1 ring-emerald-200'
                    : 'bg-white text-blue-950 shadow-2xs border border-blue-300 ring-1 ring-blue-200'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  w.accent === 'emerald' ? 'text-emerald-600' : 'text-blue-600'
                }`}
              />
              <span className="truncate">
                {w.index}. {w.label}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  w.accent === 'emerald'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {badge}
              </span>
            </button>
          );
        })}
      </div>

      {(error || actionError) && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {actionError || error}
        </div>
      )}

      {/* Capacity blueprint */}
      {isCoordination && (
        <div className="bg-linear-to-r from-emerald-900 via-teal-950 to-stone-900 text-white p-4 rounded-xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2 flex-wrap">
                  {wingMemberCount}-Member Agents Coordination Department
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    Operational Network
                  </span>
                </h3>
                <p className="text-[11px] text-emerald-200/80">
                  Standard operational ratio: 1 Manager → 4 Team Leaders → 10 Executives/TL
                  (40 Execs) → 500 Agents/Exec = 20,000 Network Capacity
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <Pill>{manager ? '1' : '0'} Manager (Level 4)</Pill>
              <Pill>{teams.length} Team Leaders</Pill>
              <Pill>{deployed} Executives</Pill>
              <Pill tone="amber">{supportStaff.length} Common Support Staff</Pill>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <Metric
              label="Per Executive"
              value={`${AGENTS_PER_EXECUTIVE} Agents`}
              note="Assigned Franchisees"
            />
            <Metric
              label="Per Team Leader"
              value={`${(quota * AGENTS_PER_EXECUTIVE).toLocaleString('en-IN')} Agents`}
              note={`${quota} Executives / Team`}
              valueTone="text-emerald-300"
            />
            <Metric
              label={`${teams.length} Team Leaders`}
              value={`${(teams.length * quota * AGENTS_PER_EXECUTIVE).toLocaleString('en-IN')} Agents`}
              note="Total Network Quota"
              valueTone="text-amber-300"
            />
            <Metric
              label="Common Support Pool"
              value={`${supportStaff.length} Staff Members`}
              note={`${agentSupport.length} Agent + ${techSupport.length} Tech Support`}
            />
          </div>
        </div>
      )}

      {/* Department manager */}
      {isCoordination && manager && (
        <div className="bg-white rounded-xl border border-purple-200 p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <PersonAvatar
              name={manager.name}
              photo={manager.photo}
              size={48}
              className="ring-2 ring-purple-500 rounded-full"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-stone-900 text-sm">{manager.name}</h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
                  {cadreMeta(manager.cadre).short === 'Unassigned'
                    ? 'Department Manager'
                    : `Cadre ${cadreMeta(manager.cadre).short}`}
                </span>
                <span className="text-[10px] text-stone-400">
                  EMP-{String(manager.id).padStart(3, '0')}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 mt-0.5">
                {manager.role} · Department head overseeing {teams.length} coordination team
                leader(s), {deployed} executive(s) and the {supportStaff.length}-member support
                pool.
              </p>
            </div>
          </div>

          <CallButton
            phone={manager.phone}
            recordName={manager.name}
            recordId={manager.id}
            recordType="COORDINATION_MANAGER"
            variant="outline"
            size="md"
          />
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl border border-stone-200 p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-stone-900 text-sm">
              {isCoordination
                ? `Agents Coordination Squads & Team Leaders (${teams.length} Squads)`
                : `Agents Recruitment Squads & Team Leaders (${teams.length} Squads)`}
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
              {teams.length} Active Squads
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              {deployed} Assigned Executives
            </span>
          </div>
          <p className="text-[11px] text-stone-500 mt-0.5">
            {isCoordination
              ? `Each coordination team is led by a team leader with up to ${quota} executives (${(
                  quota * AGENTS_PER_EXECUTIVE
                ).toLocaleString('en-IN')} agents quota per TL). Drag & drop to reassign.`
              : "Each squad is led by a designated team leader. Drag executives from the right-side pool into any team leader's squad box."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddSquad(true)}
          className="px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Create New Squad / Team Leader
        </button>
      </div>

      {/* Body */}
      <div
        className={`flex flex-col ${isCoordination ? 'gap-4' : 'lg:flex-row gap-4 items-start'}`}
      >
        <div className="flex-1 min-w-0 w-full space-y-4">
          <div
            className={`grid ${
              isCoordination
                ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'
                : 'grid-cols-1 md:grid-cols-2'
            } gap-3 items-start`}
          >
            {teams.map((team) => {
              const members = membersOf(team);
              const leader = team.teamLeader;
              const isOver = dragOverTeamId === team.id;
              const isFull = members.length === quota;
              const isOverloaded = members.length > quota;

              return (
                <div
                  key={team.id}
                  onDragOver={(e) => handleDragOver(e, team.id)}
                  onDragLeave={() => setDragOverTeamId(null)}
                  onDrop={(e) => handleDrop(e, team.id)}
                  className={`bg-white rounded-xl border transition-all flex flex-col ${
                    isOver ? 'border-[#2563EB] ring-2 ring-blue-300 bg-blue-50/50' : 'border-stone-200'
                  }`}
                >
                  <div className="p-3 border-b border-stone-100 bg-stone-50/70 rounded-t-xl space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                        <h4 className="font-bold text-stone-900 text-xs truncate">{team.name}</h4>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${countTone(
                            members.length,
                            quota
                          )}`}
                        >
                          {members.length} / {quota} Executives
                        </span>
                        {isCoordination && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-100 text-emerald-900 font-bold border border-emerald-300">
                            {(quota * AGENTS_PER_EXECUTIVE).toLocaleString('en-IN')} Agents Cap.
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="w-full bg-stone-200/80 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${barTone(
                            members.length,
                            quota
                          )}`}
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round((members.length / quota) * 100)
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-stone-500">
                        <span>Standard quota: {quota} executives</span>
                        <span className="font-medium">
                          {isFull
                            ? `✓ Full squad (${quota}/${quota})`
                            : isOverloaded
                            ? `⚠ Overload (+${members.length - quota})`
                            : `${quota - members.length} open slots`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-stone-200">
                      <PersonAvatar
                        name={team.teamLeaderName}
                        photo={team.teamLeaderPhoto}
                        size={44}
                        className="ring-2 ring-amber-400 rounded-full"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-stone-900 text-xs truncate">
                            {team.teamLeaderName}
                          </span>
                          <span className="text-[9px] px-1.5 rounded bg-amber-100 text-amber-900 font-bold border border-amber-300 shrink-0">
                            Team Leader
                          </span>
                        </div>
                        <span className="text-[10px] text-stone-500 block truncate mt-0.5">
                          {leader?.cadre || 'Cadre Level 3 — Team Leader'} ·{' '}
                          {leader?.phone || 'no number on record'}
                        </span>
                      </div>
                      {leader?.phone && (
                        <CallButton
                          phone={leader.phone}
                          recordName={leader.name}
                          recordId={leader.id}
                          recordType="TEAM_LEADER"
                          variant="outline"
                        />
                      )}
                    </div>
                  </div>

                  <div className="p-3 flex-1 space-y-2 min-h-[160px] flex flex-col">
                    <div className="flex items-center justify-between text-[10px] text-stone-400 uppercase font-semibold pb-0.5">
                      <span>
                        Assigned executives ({members.length} / {quota})
                      </span>
                      <span className="text-blue-600 lowercase font-normal">
                        drag &amp; drop to move
                      </span>
                    </div>

                    <div
                      className={`flex-1 items-start ${
                        isCoordination ? 'space-y-1.5' : 'grid grid-cols-1 sm:grid-cols-2 gap-2'
                      }`}
                    >
                      {members.map((member) => {
                        const load = agentLoad.counts[String(member.id)] || 0;
                        return (
                          <div
                            key={member.id}
                            draggable={!busy}
                            onDragStart={(e) => handleDragStart(e, member.id)}
                            title="Drag to another squad or to the pool"
                            className="flex items-center justify-between gap-1.5 p-1.5 bg-stone-50 hover:bg-stone-100 rounded-lg border border-stone-200 cursor-grab active:cursor-grabbing transition-colors min-w-0"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <GripVertical className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                              <PersonAvatar name={member.name} photo={member.photo} size="sm" />
                              <div className="truncate flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-stone-900 truncate">
                                    {member.name}
                                  </span>
                                  <span className="text-[9px] text-stone-400">
                                    EMP-{String(member.id).padStart(3, '0')}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[9px] text-stone-500 mt-0.5 flex-wrap">
                                  <span className="truncate">{member.role}</span>
                                  {isCoordination && (
                                    <span
                                      className={`px-1.5 rounded border font-bold shrink-0 ${
                                        load >= AGENTS_PER_EXECUTIVE
                                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      }`}
                                    >
                                      {load} / {AGENTS_PER_EXECUTIVE}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <select
                                value={team.id}
                                disabled={busy}
                                onChange={(e) =>
                                  move(
                                    member.id,
                                    e.target.value,
                                    `Moved ${member.name} to ${
                                      teams.find((t) => String(t.id) === String(e.target.value))
                                        ?.name || 'squad'
                                    }`
                                  )
                                }
                                title="Quick transfer"
                                className="text-[10px] bg-white border border-stone-200 rounded px-1.5 py-0.5 text-stone-600 max-w-[85px] truncate disabled:opacity-50"
                              >
                                <option value={team.id}>In {team.shortName}</option>
                                {teams
                                  .filter((t) => String(t.id) !== String(team.id))
                                  .map((other) => (
                                    <option key={other.id} value={other.id}>
                                      → {other.name.split(' — ')[0]}
                                    </option>
                                  ))}
                              </select>

                              <CallButton
                                phone={member.phone}
                                recordName={member.name}
                                recordId={member.id}
                                recordType="EXECUTIVE"
                                variant="ghost"
                              />

                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  move(
                                    member.id,
                                    null,
                                    `Returned ${member.name} to the available pool`
                                  )
                                }
                                title="Unassign / return to pool"
                                className="p-1 rounded text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-40"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {members.length === 0 && (
                        <div className="col-span-1 sm:col-span-2 h-28 border-2 border-dashed border-stone-200 rounded-lg flex flex-col items-center justify-center text-stone-400 text-center p-3 space-y-1">
                          <span className="text-[11px] font-semibold text-stone-600">
                            Empty squad ({quota} open slots)
                          </span>
                          <span className="text-[10px]">
                            Drag executives from the right-side panel and drop here
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {teams.length === 0 && (
              <div className="col-span-full bg-white border border-stone-200 rounded-xl py-12 px-4 text-center space-y-3">
                <div>
                  <p className="text-xs text-stone-600 font-semibold">
                    The {wingMeta.label.toLowerCase()} has no squads yet.
                  </p>
                  <p className="text-[11px] text-stone-400 mt-1">
                    A squad appears as soon as an employee is allotted to a team leader —
                    the two wings are staffed separately, so this one is empty until somebody
                    is placed in it.
                  </p>
                </div>

                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowAddSquad(true)}
                    className="px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold rounded-lg inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create the first squad
                  </button>
                  <button
                    type="button"
                    onClick={() => setWing(isCoordination ? 'recruitment' : 'coordination')}
                    className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-stone-700 font-semibold hover:bg-stone-50"
                  >
                    Switch to the{' '}
                    {isCoordination ? 'recruitment & telecalling' : 'coordination'} wing
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Common support pool */}
          {isCoordination && supportStaff.length > 0 && (
            <div className="bg-white rounded-xl border-2 border-amber-300 p-4 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center">
                    <Headphones className="w-4 h-4 text-amber-700" />
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2 flex-wrap">
                      Common Support Pool ({supportStaff.length} Members)
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        Shared Service Unit
                      </span>
                    </h4>
                    <p className="text-[11px] text-amber-900 font-medium mt-0.5">
                      Agent support and technical support staff work as one pool across every
                      team rather than being attached to a single squad.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] bg-amber-100 text-amber-900 font-bold border border-amber-300">
                    {agentSupport.length} Agent Support
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-blue-100 text-blue-900 font-bold border border-blue-300">
                    {techSupport.length} Technical Support
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <SupportGroup
                  tone="amber"
                  icon={Users}
                  title={`${agentSupport.length} Agent Support Executives`}
                  staff={agentSupport}
                />
                <SupportGroup
                  tone="blue"
                  icon={Wrench}
                  title={`${techSupport.length} Technical Support Staff`}
                  staff={techSupport}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="w-full lg:w-96 xl:w-[410px] shrink-0 bg-white rounded-xl border border-stone-200 p-3 space-y-3 lg:sticky lg:top-2">
          <div className="space-y-2 border-b border-stone-100 pb-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                {rightPanelTab === 'workload' ? (
                  <BarChart3 className="w-4 h-4 text-[#2563EB] shrink-0" />
                ) : (
                  <Users className="w-4 h-4 text-[#2563EB] shrink-0" />
                )}
                <span className="font-bold text-stone-900 uppercase tracking-wider text-xs truncate">
                  {rightPanelTab === 'workload'
                    ? 'Squad Workload Panel'
                    : isCoordination
                    ? 'Coordination Staff Pool'
                    : 'Recruitment Executives'}
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-50 text-blue-800 border border-blue-200 shrink-0">
                Max {quota} / Squad
              </span>
            </div>

            <div className="flex items-center gap-1 p-0.5 bg-stone-100 rounded-lg text-[11px]">
              <button
                type="button"
                onClick={() => setRightPanelTab('workload')}
                className={`flex-1 py-1.5 rounded-md font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  rightPanelTab === 'workload'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" /> Workload Overview
              </button>
              <button
                type="button"
                onClick={() => setRightPanelTab('pool')}
                className={`flex-1 py-1.5 rounded-md font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  rightPanelTab === 'pool'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" /> Staff Pool ({pool.length})
              </button>
            </div>
          </div>

          {rightPanelTab === 'workload' ? (
            <div className="space-y-3">
              <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200 space-y-2">
                <div className="flex items-center justify-between text-[11px] gap-2">
                  <span className="font-semibold text-stone-700">
                    {isCoordination
                      ? `Coordination squad capacity (${totalSeats} seats):`
                      : 'Squad quota capacity:'}
                  </span>
                  <span className="font-bold text-stone-900 shrink-0">
                    {deployed} / {totalSeats} Seats
                  </span>
                </div>

                <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((deployed / (totalSeats || 1)) * 100)
                      )}%`,
                    }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-1 text-center pt-0.5">
                  <MiniStat label="Active squads" value={teams.length} />
                  <MiniStat label="Deployed" value={deployed} tone="text-blue-600" />
                  <MiniStat label="Open slots" value={openSlots} tone="text-emerald-600" />
                </div>
              </div>

              {isCoordination && (
                <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-[10px] flex items-center justify-between gap-2">
                  <span className="font-semibold">Agents under coordination</span>
                  <span className="font-bold">
                    {agentLoad.assigned} assigned · {agentLoad.unassigned} unassigned
                  </span>
                </div>
              )}

              <div className="p-2 rounded-lg bg-blue-50/60 border border-blue-200 text-blue-900 text-[10px] flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Drop executives onto any squad card below to assign them.</span>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-0.5">
                {teams.map((team) => {
                  const members = membersOf(team);
                  const isOver = dragOverTeamId === team.id;
                  const isFull = members.length === quota;
                  const isOverloaded = members.length > quota;

                  return (
                    <div
                      key={team.id}
                      onDragOver={(e) => handleDragOver(e, team.id)}
                      onDragLeave={() => setDragOverTeamId(null)}
                      onDrop={(e) => handleDrop(e, team.id)}
                      className={`p-2.5 rounded-xl border transition-all ${
                        isOver
                          ? 'border-[#2563EB] ring-2 ring-blue-300 bg-blue-50'
                          : 'border-stone-200 bg-white hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <PersonAvatar
                            name={team.teamLeaderName}
                            photo={team.teamLeaderPhoto}
                            size={36}
                            className="ring-2 ring-amber-400 rounded-full"
                          />
                          <div className="min-w-0">
                            <span className="font-bold text-stone-900 text-xs block truncate">
                              {team.name.split(' — ')[0]}
                            </span>
                            <span className="text-[10px] text-stone-500 block truncate">
                              TL: {team.teamLeaderName}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 border ${countTone(
                            members.length,
                            quota
                          )}`}
                        >
                          {members.length}/{quota}
                        </span>
                      </div>

                      <div className="space-y-1 mb-2">
                        <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${barTone(
                              members.length,
                              quota
                            )}`}
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round((members.length / quota) * 100)
                              )}%`,
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-stone-500">
                          <span>Max {quota} quota</span>
                          <span className="font-semibold">
                            {isFull
                              ? 'Full'
                              : isOverloaded
                              ? `Over (+${members.length - quota})`
                              : `${quota - members.length} slots`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-stone-100">
                        <div className="flex items-center -space-x-1.5 overflow-hidden">
                          {members.slice(0, 5).map((member) => (
                            <PersonAvatar
                              key={member.id}
                              name={member.name}
                              photo={member.photo}
                              size={20}
                              className="border border-white rounded-full"
                            />
                          ))}
                          {members.length > 5 && (
                            <span className="w-5 h-5 rounded-full bg-stone-200 text-stone-700 text-[8px] font-bold flex items-center justify-center border border-white shrink-0">
                              +{members.length - 5}
                            </span>
                          )}
                          {members.length === 0 && (
                            <span className="text-[10px] text-stone-400 italic">
                              No executives
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            const next = pool.find((e) => !assignedIds.has(String(e.id)));
                            if (next) {
                              move(next.id, team.id, `Added ${next.name} to ${team.name}`);
                            } else {
                              setRightPanelTab('pool');
                              say('Nobody is free — reassign someone from the pool.');
                            }
                          }}
                          className="px-2 py-0.5 text-[10px] font-semibold bg-stone-100 hover:bg-blue-50 text-stone-700 hover:text-blue-700 rounded border border-stone-200 transition-colors disabled:opacity-40 shrink-0"
                        >
                          + Assign next
                        </button>
                      </div>
                    </div>
                  );
                })}

                {teams.length === 0 && (
                  <div className="p-6 text-center text-stone-400 text-xs col-span-2">
                    No active squads in this wing.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="space-y-1.5">
                <input
                  type="text"
                  placeholder="Search staff by name, role or ID…"
                  value={poolSearch}
                  onChange={(e) => setPoolSearch(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs"
                />

                <div className="flex items-center gap-1">
                  <FilterChip
                    active={poolFilter === 'all'}
                    onClick={() => setPoolFilter('all')}
                    activeClass="bg-stone-900 text-white border-stone-900"
                  >
                    All ({assignable.length})
                  </FilterChip>
                  <FilterChip
                    active={poolFilter === 'unassigned'}
                    onClick={() => setPoolFilter('unassigned')}
                    activeClass="bg-[#2563EB] text-white border-[#2563EB]"
                  >
                    Available ({availableCount})
                  </FilterChip>
                  <FilterChip
                    active={poolFilter === 'assigned'}
                    onClick={() => setPoolFilter('assigned')}
                    activeClass="bg-stone-700 text-white border-stone-700"
                  >
                    Assigned ({assignedIds.size})
                  </FilterChip>
                </div>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOverPool(true);
                }}
                onDragLeave={() => setIsDragOverPool(false)}
                onDrop={handleDropToPool}
                className={`p-2 rounded-lg border-2 border-dashed text-center transition-colors ${
                  isDragOverPool
                    ? 'border-[#2563EB] bg-blue-50/80 text-blue-900'
                    : 'border-stone-200 bg-stone-50/60 text-stone-500'
                }`}
              >
                <span className="text-[10px] font-medium block">
                  Drop here to return an executive to the available pool
                </span>
              </div>

              <div className="space-y-1.5 max-h-[calc(100vh-340px)] overflow-y-auto pr-0.5">
                {pool.map((emp) => {
                  const isAssigned = assignedIds.has(String(emp.id));
                  const assignedTeam = teams.find((t) =>
                    t.memberIds.some((id) => String(id) === String(emp.id))
                  );
                  const load = agentLoad.counts[String(emp.id)] || 0;

                  return (
                    <div
                      key={emp.id}
                      draggable={!busy}
                      onDragStart={(e) => handleDragStart(e, emp.id)}
                      title="Drag into any squad box or workload card"
                      className="p-2 bg-white hover:bg-stone-50 rounded-lg border border-stone-200 cursor-grab active:cursor-grabbing transition-all space-y-1.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <GripVertical className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <PersonAvatar
                          name={emp.name}
                          photo={emp.photo}
                          size={36}
                          badge={
                            <span
                              className={`block w-2.5 h-2.5 rounded-full border-2 border-white ${
                                isAssigned ? 'bg-blue-500' : 'bg-emerald-500'
                              }`}
                            />
                          }
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-semibold text-stone-900 text-xs truncate">
                                {emp.name}
                              </span>
                              <span className="text-[9px] text-stone-400 shrink-0">
                                EMP-{String(emp.id).padStart(3, '0')}
                              </span>
                            </div>
                            {isAssigned ? (
                              <span className="px-1.5 rounded text-[9px] font-medium bg-blue-50 text-blue-700 border border-blue-200 shrink-0 truncate max-w-[90px]">
                                In: {assignedTeam?.shortName || 'squad'}
                              </span>
                            ) : (
                              <span className="px-1.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                Available
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-1 text-[10px] text-stone-500 mt-0.5">
                            <span className="truncate">{emp.role}</span>
                            {isCoordination && (
                              <span className="px-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[9px] font-bold shrink-0">
                                {load}/{AGENTS_PER_EXECUTIVE} Agents
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-100 text-[10px]">
                        <span className="text-stone-400 shrink-0">Quick assign:</span>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <select
                            value={assignedTeam?.id || ''}
                            disabled={busy || teams.length === 0}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (!value) {
                                move(emp.id, null, `Returned ${emp.name} to the pool`);
                                return;
                              }
                              const dest = teams.find((t) => String(t.id) === String(value));
                              move(emp.id, value, `Moved ${emp.name} to ${dest?.name || 'squad'}`);
                            }}
                            className="text-[10px] bg-white border border-stone-200 rounded px-1.5 py-0.5 text-stone-700 max-w-[130px] truncate disabled:opacity-50"
                          >
                            <option value="">— Unassigned —</option>
                            {teams.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>

                          <CallButton
                            phone={emp.phone}
                            recordName={emp.name}
                            recordId={emp.id}
                            recordType="EXECUTIVE"
                            variant="ghost"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {pool.length === 0 && (
                  <div className="py-8 text-center text-[11px] text-stone-400">
                    Nobody matches this filter.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showAddSquad && (
        <AddSquadModal
          employees={employees}
          teams={teams}
          wingLabel={wingMeta.label}
          onClose={() => setShowAddSquad(false)}
          onCreate={async (leaderId, firstMemberId) => {
            // A squad only exists once somebody is allotted to the leader —
            // there is no teams table to write a name into.
            await move(
              firstMemberId,
              leaderId,
              `Created a squad under ${employeeById.get(String(leaderId))?.name || 'the new leader'}`
            );
            setShowAddSquad(false);
            refresh();
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 z-[900] px-3 py-2 bg-stone-900 text-white rounded-lg text-[11px] font-semibold shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ── Local pieces ─────────────────────────────────────────────── */

const countTone = (count, quota) =>
  count === quota
    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
    : count > quota
    ? 'bg-rose-50 text-rose-800 border-rose-300'
    : count >= quota - 2
    ? 'bg-amber-50 text-amber-800 border-amber-300'
    : 'bg-blue-50 text-blue-800 border-blue-200';

const barTone = (count, quota) =>
  count === quota
    ? 'bg-emerald-600'
    : count > quota
    ? 'bg-rose-600'
    : count >= quota - 2
    ? 'bg-amber-500'
    : 'bg-[#2563EB]';

function Pill({ children, tone }) {
  return (
    <span
      className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${
        tone === 'amber'
          ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
          : 'bg-white/10 text-white border-white/15'
      }`}
    >
      {children}
    </span>
  );
}

function Metric({ label, value, note, valueTone = 'text-white' }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-2">
      <span className="text-[10px] text-emerald-200/70 block">{label}</span>
      <span className={`text-sm font-bold block ${valueTone}`}>{value}</span>
      <span className="text-[9px] text-emerald-300/80 block mt-0.5">{note}</span>
    </div>
  );
}

function MiniStat({ label, value, tone = 'text-stone-900' }) {
  return (
    <div className="p-1 bg-white rounded border border-stone-100">
      <span className="text-[9px] text-stone-500 block">{label}</span>
      <span className={`font-bold text-xs ${tone}`}>{value}</span>
    </div>
  );
}

function FilterChip({ active, onClick, activeClass, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-1 text-[10px] font-semibold rounded border transition-colors ${
        active ? activeClass : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
      }`}
    >
      {children}
    </button>
  );
}

function SupportGroup({ tone, icon: Icon, title, staff }) {
  const isAmber = tone === 'amber';
  return (
    <div
      className={`rounded-lg p-3 border space-y-2 ${
        isAmber ? 'bg-amber-50/50 border-amber-200/80' : 'bg-blue-50/50 border-blue-200/80'
      }`}
    >
      <div
        className={`flex items-center justify-between text-xs font-bold border-b pb-1.5 ${
          isAmber ? 'text-amber-900 border-amber-200' : 'text-blue-900 border-blue-200'
        }`}
      >
        <span className="flex items-center gap-1.5">
          <Icon className={`w-3.5 h-3.5 ${isAmber ? 'text-amber-700' : 'text-blue-700'}`} />
          {title}
        </span>
        <span className={`text-[10px] ${isAmber ? 'text-amber-800' : 'text-blue-800'}`}>
          {staff.length} staff
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {staff.map((person) => (
          <div
            key={person.id}
            className={`p-2 bg-white rounded-lg border flex items-center justify-between gap-2 transition-colors ${
              isAmber
                ? 'border-amber-200/70 hover:border-amber-400'
                : 'border-blue-200/70 hover:border-blue-400'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <PersonAvatar name={person.name} photo={person.photo} size="sm" />
              <div className="truncate">
                <span className="font-semibold text-stone-900 text-xs block truncate">
                  {person.name}
                </span>
                <span
                  className={`text-[9px] block truncate ${
                    isAmber ? 'text-amber-800' : 'text-blue-800'
                  }`}
                >
                  {person.role} · EMP-{String(person.id).padStart(3, '0')}
                </span>
              </div>
            </div>

            <CallButton
              phone={person.phone}
              recordName={person.name}
              recordId={person.id}
              recordType="SUPPORT_STAFF"
              variant="outline"
            />
          </div>
        ))}

        {staff.length === 0 && (
          <p className="text-[10px] text-stone-400 col-span-full py-2 text-center">
            Nobody in this group yet.
          </p>
        )}
      </div>
    </div>
  );
}

function AddSquadModal({ employees, teams, wingLabel, onClose, onCreate }) {
  const [leaderId, setLeaderId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [saving, setSaving] = useState(false);

  const existingLeaders = new Set(teams.map((t) => String(t.teamLeaderId)));
  const leaderChoices = employees.filter((e) => !existingLeaders.has(String(e.id)));
  const memberChoices = employees.filter((e) => String(e.id) !== String(leaderId));

  const submit = async () => {
    if (!leaderId || !memberId) return;
    setSaving(true);
    try {
      await onCreate(leaderId, memberId);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-stone-900">Create a squad</h3>
            <p className="text-[11px] text-stone-500">{wingLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-[11px] text-stone-600 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-2">
            A squad is a team leader plus the people allotted to them — there is no separate
            team record. Pick the leader and the first executive, and the squad appears.
          </p>

          <div>
            <label className="text-[10px] font-semibold text-stone-500 uppercase block mb-1">
              Team leader
            </label>
            <select
              value={leaderId}
              onChange={(e) => setLeaderId(e.target.value)}
              className="w-full text-xs bg-white border border-stone-200 rounded-lg px-2.5 py-1.5"
            >
              <option value="">Select a team leader…</option>
              {leaderChoices.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} — {e.role}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-stone-500 uppercase block mb-1">
              First executive
            </label>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              disabled={!leaderId}
              className="w-full text-xs bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 disabled:opacity-50"
            >
              <option value="">Select an executive…</option>
              {memberChoices.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} — {e.role}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-stone-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg border border-stone-200 bg-white text-xs font-bold text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!leaderId || !memberId || saving}
            className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-bold hover:bg-[#1D4ED8] disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Create squad
          </button>
        </div>
      </div>
    </div>
  );
}
