import { useState, useMemo } from 'react';
import { Loader2, Users, ChevronDown, ChevronRight, Phone, MapPin } from 'lucide-react';

import PersonAvatar from '../common/PersonAvatar';

/**
 * The squad hierarchy: which team leader runs which crew, and how many agents
 * sit under each.
 *
 * Squads come from the department-leader tree rather than a teams table, so
 * this view and the recruitment allotment can never disagree about who is on
 * which crew.
 */
export default function TeamsSquadsTab({ teams = [], employeeById, agents = [], loading }) {
  const [expanded, setExpanded] = useState(() => new Set());

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Agents are coordinated per squad; the link is the coordination allotment
  // on the agent, falling back to nothing rather than guessing.
  const agentsBySquad = useMemo(() => {
    const map = new Map();
    agents.forEach((agent) => {
      const key = String(agent.coordination_team_id ?? '');
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(agent);
    });
    return map;
  }, [agents]);

  const unassignedAgents = useMemo(
    () => agents.filter((a) => !a.coordination_team_id).length,
    [agents]
  );

  if (loading) {
    return (
      <div className="bg-white border border-stone-200 rounded-lg py-14 flex items-center justify-center">
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-stone-500">
          <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading squads…
        </span>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-lg py-14 text-center text-xs text-stone-400 px-6">
        No squads configured. Allot employees to a team leader in Management → Crew
        &amp; hierarchy and they will appear here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-white border border-stone-200 rounded-lg p-2.5 flex flex-wrap items-center gap-3 text-xs">
        <span className="font-bold text-stone-900 inline-flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-[#2563EB]" />
          {teams.length} squad{teams.length === 1 ? '' : 's'}
        </span>
        <span className="text-stone-500">
          {teams.reduce((s, t) => s + (t.memberIds?.length || 0), 0)} crew members
        </span>
        {unassignedAgents > 0 && (
          <span className="ml-auto px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 font-semibold">
            {unassignedAgents} agent{unassignedAgents === 1 ? '' : 's'} not yet coordinated
          </span>
        )}
      </div>

      <div className="space-y-2">
        {teams.map((team, idx) => {
          const leader = employeeById.get(String(team.teamLeaderId));
          const squadAgents = agentsBySquad.get(String(team.id)) || [];
          const isOpen = expanded.has(team.id);

          return (
            <div
              key={team.id}
              className="bg-white border border-stone-200 rounded-lg overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggle(team.id)}
                className="w-full p-3 flex items-center gap-3 hover:bg-stone-50 transition-colors text-left"
              >
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-stone-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
                )}

                <div className="relative shrink-0">
                  <PersonAvatar
                    name={leader?.name || team.teamLeaderName}
                    photo={leader?.photo || team.teamLeaderPhoto}
                    size="lg"
                  />
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-stone-100 border border-stone-300 rounded-full flex items-center justify-center text-[8px] font-bold text-stone-700">
                    {idx + 1}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-stone-900">{team.name}</span>
                    <span className="text-[9px] px-1.5 rounded bg-amber-100 text-amber-900 font-bold border border-amber-300">
                      Team Leader
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-500 mt-0.5">
                    {leader?.name || team.teamLeaderName}
                    {leader?.phone && <> · {leader.phone}</>}
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 text-center">
                  <div>
                    <div className="text-sm font-black text-stone-900">
                      {team.memberIds?.length || 0}
                    </div>
                    <div className="text-[9px] font-bold text-stone-400 uppercase">Crew</div>
                  </div>
                  <div>
                    <div className="text-sm font-black text-[#2563EB]">
                      {squadAgents.length}
                    </div>
                    <div className="text-[9px] font-bold text-stone-400 uppercase">
                      Agents
                    </div>
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-stone-200 bg-stone-50/50 p-3 space-y-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1.5">
                      Crew members ({team.members?.length || 0})
                    </div>
                    {(team.members || []).length === 0 ? (
                      <p className="text-[11px] text-stone-400">
                        Nobody allotted to this leader yet.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {team.members.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center gap-2 p-2 bg-white border border-stone-200 rounded-lg"
                          >
                            <PersonAvatar
                              name={member.name}
                              photo={member.photo}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="text-[11px] font-bold text-stone-900 truncate">
                                {member.name}
                              </div>
                              <div className="text-[10px] text-stone-500 truncate">
                                {member.role || 'Executive'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {squadAgents.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1.5">
                        Agents coordinated ({squadAgents.length})
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {squadAgents.slice(0, 12).map((agent) => (
                          <div
                            key={agent.id}
                            className="flex items-center gap-2 p-2 bg-white border border-stone-200 rounded-lg"
                          >
                            <PersonAvatar name={agent.name} photo={agent.photo} size="sm" />
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-bold text-stone-900 truncate">
                                {agent.name}
                              </div>
                              <div className="text-[10px] text-stone-500 truncate inline-flex items-center gap-1">
                                <MapPin className="w-2.5 h-2.5" />
                                {agent.village || '—'}
                              </div>
                            </div>
                            {agent.phone && (
                              <a
                                href={`tel:${agent.phone}`}
                                className="p-1 rounded text-[#2563EB] hover:bg-blue-50"
                                title={`Call ${agent.name}`}
                              >
                                <Phone className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                      {squadAgents.length > 12 && (
                        <p className="text-[10px] text-stone-400 mt-1.5">
                          +{squadAgents.length - 12} more
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
