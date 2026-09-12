import React, { useState, useEffect, useMemo, useCallback } from 'react';
import agentService from '../../services/agentService';
import useTacticalMap from '../../hooks/useTacticalMap';
import './AgentAllotmentMap.css';

const formatValue = (value) => {
  const amount = Number(value) || 0;
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  return `₹${amount.toLocaleString('en-IN')}`;
};

/**
 * Land nodes for the mission allotment hub.
 *
 * Parcels inside the selected agent's territory that are not yet linked to
 * them pulse red as mission targets; parcels watched by several agents take a
 * deeper observation tone. Clicking a node links it or attaches an observation
 * straight away.
 */
export default function AgentAllotmentMap({
  agentId,
  agentName,
  state,
  district,
  mandal,
  village,
  onChanged,
}) {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [acting, setActing] = useState(false);

  const fetchNodes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await agentService.getLandNodes({
        agentId: agentId || undefined,
        state: state || undefined,
        district: district || undefined,
        mandal: mandal || undefined,
        village: village || undefined,
      });
      const list = data.result || data.data || [];
      setNodes(Array.isArray(list) ? list : []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch agent land nodes:', err);
      setNodes([]);
      setError(
        err?.response?.status === 404
          ? 'Land node endpoint not available on this backend yet.'
          : 'Could not load the allotment map.'
      );
    } finally {
      setLoading(false);
    }
  }, [agentId, state, district, mandal, village]);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  const { surfaceRef, project, transform, handlers, zoomIn, zoomOut, reset, isZoomed, hasCoordinates } =
    useTacticalMap(nodes);

  const totals = useMemo(
    () =>
      nodes.reduce(
        (acc, node) => ({
          lands: acc.lands + 1,
          linked: acc.linked + (node.linked_to_agent ? 1 : 0),
          targets: acc.targets + (node.in_territory && !node.linked_to_agent && !node.agent_id ? 1 : 0),
          observed: acc.observed + (node.observation_count > 0 ? 1 : 0),
        }),
        { lands: 0, linked: 0, targets: 0, observed: 0 }
      ),
    [nodes]
  );

  // Portfolio of the selected agent, derived from the same node set
  const portfolio = useMemo(() => {
    const owned = nodes.filter((node) => node.linked_to_agent);
    return {
      count: owned.length,
      acres: owned.reduce((sum, node) => sum + (Number(node.total_acres) || 0), 0),
      value: owned.reduce((sum, node) => sum + (Number(node.total_value) || 0), 0),
    };
  }, [nodes]);

  const classFor = (node) => {
    if (node.linked_to_agent) return 'linked';
    if (agentId && node.in_territory && !node.agent_id) return 'target';
    if (node.agent_id) return 'taken';
    return 'free';
  };

  // Observation heatmap: deeper blue → violet as more agents watch a parcel
  const toneFor = (node) => Math.min(3, node.observation_count || 0);

  const runAction = async (action) => {
    if (!selected || !agentId || acting) return;
    setActing(true);
    try {
      if (action === 'link') {
        await agentService.linkLand(selected.id, agentId);
      } else if (action === 'observe') {
        await agentService.addObservation(selected.id, agentId);
      } else if (action === 'unobserve') {
        await agentService.removeObservation(selected.id, agentId);
      }
      await fetchNodes();
      setSelected(null);
      if (onChanged) onChanged();
    } catch (err) {
      console.error(`Failed to ${action} land:`, err);
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="a-alot-map-wrap">
      <div className="a-alot-map-stats">
        <div className="a-alot-stat">
          <span className="a-alot-stat-value">{totals.lands}</span>
          <span className="a-alot-stat-label">LAND NODES</span>
        </div>
        <div className="a-alot-stat">
          <span className="a-alot-stat-value">{totals.linked}</span>
          <span className="a-alot-stat-label">PRIMARY LINKS</span>
        </div>
        <div className="a-alot-stat alert">
          <span className="a-alot-stat-value">{totals.targets}</span>
          <span className="a-alot-stat-label">MISSION TARGETS</span>
        </div>
        <div className="a-alot-stat">
          <span className="a-alot-stat-value">{totals.observed}</span>
          <span className="a-alot-stat-label">OBSERVED</span>
        </div>
      </div>

      {/* Portfolio wallet for the selected agent */}
      {agentId && (
        <div className="a-alot-wallet">
          <div className="a-alot-wallet-head">
            PORTFOLIO WALLET{agentName ? ` · ${agentName}` : ''}
          </div>
          <div className="a-alot-wallet-body">
            <div>
              <span className="a-alot-wallet-value">{portfolio.count}</span>
              <span className="a-alot-wallet-label">PARCELS</span>
            </div>
            <div>
              <span className="a-alot-wallet-value">{portfolio.acres.toFixed(2)}</span>
              <span className="a-alot-wallet-label">ACRES</span>
            </div>
            <div>
              <span className="a-alot-wallet-value">{formatValue(portfolio.value)}</span>
              <span className="a-alot-wallet-label">MANAGED VALUATION</span>
            </div>
          </div>
        </div>
      )}

      <div className="a-alot-surface" ref={surfaceRef} {...handlers}>
        {loading ? (
          <div className="a-alot-empty">Loading land nodes...</div>
        ) : error ? (
          <div className="a-alot-empty">{error}</div>
        ) : !hasCoordinates ? (
          <div className="a-alot-empty">No land in this filter has GPS coordinates yet.</div>
        ) : (
          <div className="a-alot-canvas" style={{ transform }}>
            {nodes.map((node) => {
              const { x, y } = project(node);
              const isSelected = selected && selected.id === node.id;

              return (
                <div
                  key={node.id}
                  className={`a-alot-node ${classFor(node)} tone-${toneFor(node)}${isSelected ? ' selected' : ''}`}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  onClick={() => setSelected(isSelected ? null : node)}
                  title={`${node.farmer_name || 'Unknown farmer'} · ${node.village || '—'}`}
                >
                  {node.observation_count > 0 && (
                    <span className="a-alot-node-obs">{node.observation_count}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="a-alot-controls">
          <button type="button" onClick={zoomIn} title="Zoom in">+</button>
          <button type="button" onClick={zoomOut} title="Zoom out">−</button>
          <button type="button" onClick={reset} title="Reset view" disabled={!isZoomed}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
          </button>
        </div>

        <div className="a-alot-legend">
          <div className="a-alot-legend-title">NODE SIGNALS</div>
          <div className="a-alot-legend-row">
            <span className="a-alot-legend-dot target" />
            Pulsing red — mission target
          </div>
          <div className="a-alot-legend-row">
            <span className="a-alot-legend-dot linked" />
            Linked to this agent
          </div>
          <div className="a-alot-legend-row">
            <span className="a-alot-legend-dot taken" />
            Held by another agent
          </div>
          <div className="a-alot-legend-row">
            <span className="a-alot-legend-ramp" />
            Observation depth — 0 → 3+ agents
          </div>
        </div>

        {selected && (
          <div className="a-alot-detail">
            <div className="a-alot-detail-header">
              <span className="a-alot-detail-title">
                L{String(selected.id).padStart(3, '0')} · {selected.farmer_name || 'Unknown farmer'}
              </span>
              <button type="button" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="a-alot-detail-sub">
              {selected.village || '—'} · {selected.mandal || '—'}
            </div>

            <div className="a-alot-detail-grid">
              <div>
                <span className="a-alot-detail-value">{(Number(selected.total_acres) || 0).toFixed(2)}</span>
                <span className="a-alot-detail-label">ACRES</span>
              </div>
              <div>
                <span className="a-alot-detail-value">{formatValue(selected.total_value)}</span>
                <span className="a-alot-detail-label">VALUATION</span>
              </div>
              <div>
                <span className="a-alot-detail-value">{selected.observation_count}</span>
                <span className="a-alot-detail-label">OBSERVERS</span>
              </div>
            </div>

            <div className="a-alot-detail-owner">
              {selected.agent_id
                ? `PRIMARY: ${selected.agent_name || `Agent #${selected.agent_id}`}`
                : 'PRIMARY: UNLINKED'}
            </div>

            {!agentId ? (
              <div className="a-alot-detail-hint">Select an agent to act on this node.</div>
            ) : (
              <div className="a-alot-detail-actions">
                <button
                  type="button"
                  className="a-alot-action primary"
                  onClick={() => runAction('link')}
                  disabled={acting || selected.linked_to_agent}
                >
                  {selected.linked_to_agent ? 'Primary linked' : 'Primary link'}
                </button>
                <button
                  type="button"
                  className="a-alot-action"
                  onClick={() => runAction(selected.observed_by_agent ? 'unobserve' : 'observe')}
                  disabled={acting}
                >
                  {selected.observed_by_agent ? 'Remove observation' : 'Attach observation'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
