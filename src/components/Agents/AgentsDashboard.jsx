import React, { useState, useEffect, useMemo } from 'react';
import agentService from '../../services/agentService';
import callSignalService from '../../services/callSignalService';
import useRequiredAgents from '../../hooks/useRequiredAgents';
import './AgentsDashboard.css';

const DEPARTMENT = 'agents';

const num = (v) => Number(v) || 0;

const formatTalkTime = (seconds) => {
  const total = num(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export default function AgentsDashboard() {
  const [agents, setAgents] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [metrics, setMetrics] = useState({ totalTalkTimeSeconds: 0, attendedCount: 0, missedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { requiredFor, loading: slabsLoading } = useRequiredAgents();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [agentsData, nodesData, metricsData] = await Promise.all([
          agentService.getAll(),
          agentService.getMapNodes(),
          callSignalService.getMetrics({ department_type: DEPARTMENT }).catch(() => ({ data: null })),
        ]);

        const agentList = agentsData.result || agentsData.data || [];
        const nodeList = nodesData.result || nodesData.data || [];

        setAgents(Array.isArray(agentList) ? agentList : []);
        setNodes(Array.isArray(nodeList) ? nodeList : []);
        setMetrics(metricsData.data || { totalTalkTimeSeconds: 0, attendedCount: 0, missedCount: 0 });
      } catch (err) {
        console.error('Failed to load agents dashboard:', err);
        setError('Could not load dashboard figures.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Capacity is derived, not stored: the slab table says how many agents a
  // village's acreage calls for, the map nodes say how many are deployed.
  const coverage = useMemo(() => {
    if (slabsLoading) return { rows: [], totalRequired: 0, totalDeployed: 0, shortVillages: 0 };

    const rows = nodes
      .filter((n) => n.village)
      .map((n) => {
        const deployed = num(n.agent_count);
        const required = requiredFor(num(n.total_acres));
        return {
          key: `${n.village}-${n.mandal}`,
          village: n.village,
          mandal: n.mandal,
          district: n.district,
          acres: num(n.total_acres),
          landCount: num(n.land_count),
          linkedLandCount: num(n.linked_land_count),
          deployed,
          required,
          gap: Math.max(required - deployed, 0),
        };
      });

    return {
      rows,
      totalRequired: rows.reduce((s, r) => s + r.required, 0),
      totalDeployed: rows.reduce((s, r) => s + r.deployed, 0),
      shortVillages: rows.filter((r) => r.gap > 0).length,
    };
  }, [nodes, requiredFor, slabsLoading]);

  const topGaps = useMemo(
    () => [...coverage.rows].sort((a, b) => b.gap - a.gap || b.acres - a.acres).slice(0, 8),
    [coverage.rows]
  );

  const landStats = useMemo(() => {
    const totalLands = nodes.reduce((s, n) => s + num(n.land_count), 0);
    const linkedLands = nodes.reduce((s, n) => s + num(n.linked_land_count), 0);
    return { totalLands, linkedLands };
  }, [nodes]);

  const villagesCovered = coverage.rows.filter((r) => r.deployed > 0).length;
  const busy = loading || slabsLoading;

  return (
    <div className="adb-page">
      <div className="adb-header">
        <div className="adb-title-group">
          <svg className="adb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" />
            <rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" />
          </svg>
          <div className="adb-title-texts">
            <span className="adb-title">AGENT FORCE OVERVIEW</span>
            <span className="adb-subtitle">DEPLOYMENT, COVERAGE AND SIGNAL SUMMARY</span>
          </div>
        </div>
      </div>

      {error && <div className="adb-error">{error}</div>}

      {/* Headline tiles */}
      <div className="adb-tiles">
        <div className="adb-tile adb-tile-accent">
          <span className="adb-tile-label">Agents enlisted</span>
          <span className="adb-tile-value">{busy ? '—' : agents.length}</span>
          <span className="adb-tile-foot">{villagesCovered} villages covered</span>
        </div>
        <div className="adb-tile">
          <span className="adb-tile-label">Required by slabs</span>
          <span className="adb-tile-value">{busy ? '—' : coverage.totalRequired}</span>
          <span className="adb-tile-foot">across {coverage.rows.length} village nodes</span>
        </div>
        <div className={`adb-tile${coverage.shortVillages > 0 ? ' adb-tile-warn' : ''}`}>
          <span className="adb-tile-label">Villages under strength</span>
          <span className="adb-tile-value">{busy ? '—' : coverage.shortVillages}</span>
          <span className="adb-tile-foot">
            {busy ? '' : `${Math.max(coverage.totalRequired - coverage.totalDeployed, 0)} seats short`}
          </span>
        </div>
        <div className="adb-tile">
          <span className="adb-tile-label">Lands linked</span>
          <span className="adb-tile-value">{busy ? '—' : landStats.linkedLands}</span>
          <span className="adb-tile-foot">
            {busy ? '' : `${pct(landStats.linkedLands, landStats.totalLands)}% of ${landStats.totalLands}`}
          </span>
        </div>
        <div className="adb-tile">
          <span className="adb-tile-label">Talk time</span>
          <span className="adb-tile-value">{busy ? '—' : formatTalkTime(metrics.totalTalkTimeSeconds)}</span>
          <span className="adb-tile-foot">
            {busy ? '' : `${num(metrics.attendedCount)} attended · ${num(metrics.missedCount)} missed`}
          </span>
        </div>
      </div>

      {/* Coverage detail */}
      <div className="adb-panels">
        <section className="adb-panel">
          <header className="adb-panel-head">
            <h3>Biggest staffing gaps</h3>
            <span className="adb-panel-note">Required minus deployed, by village</span>
          </header>

          {busy ? (
            <div className="adb-empty">Loading coverage…</div>
          ) : topGaps.length === 0 ? (
            <div className="adb-empty">No village nodes returned yet.</div>
          ) : (
            <ul className="adb-gaps">
              {topGaps.map((row) => {
                const fill = row.required > 0 ? Math.min(pct(row.deployed, row.required), 100) : 100;
                return (
                  <li key={row.key} className="adb-gap">
                    <div className="adb-gap-head">
                      <span className="adb-gap-village">{row.village}</span>
                      <span className="adb-gap-count">
                        {row.deployed}<span className="adb-gap-sep">/</span>{row.required}
                      </span>
                    </div>
                    <div className="adb-gap-track">
                      <div
                        className={`adb-gap-fill${row.gap > 0 ? ' short' : ''}`}
                        style={{ width: `${fill}%` }}
                      />
                    </div>
                    <div className="adb-gap-foot">
                      <span>{row.mandal || '—'}</span>
                      <span>
                        {row.acres > 0 ? `${Math.round(row.acres)} ac` : 'no acreage'}
                        {row.gap > 0 && <strong className="adb-gap-short"> · {row.gap} short</strong>}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="adb-panel">
          <header className="adb-panel-head">
            <h3>Recently enlisted</h3>
            <span className="adb-panel-note">Newest agents on the roster</span>
          </header>

          {busy ? (
            <div className="adb-empty">Loading roster…</div>
          ) : agents.length === 0 ? (
            <div className="adb-empty">No agents enlisted yet.</div>
          ) : (
            <ul className="adb-roster">
              {agents.slice(0, 8).map((agent) => (
                <li key={agent.id} className="adb-roster-row">
                  <img
                    className="adb-roster-avatar"
                    src={agent.photo || `https://i.pravatar.cc/150?u=${agent.id}`}
                    alt={agent.name}
                  />
                  <div className="adb-roster-main">
                    <span className="adb-roster-name">{agent.name}</span>
                    <span className="adb-roster-sub">
                      {[agent.village, agent.mandal].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </div>
                  <span className="adb-roster-code">AG{String(agent.id).padStart(5, '0')}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
