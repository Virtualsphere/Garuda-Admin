import React, { useState, useEffect, useMemo } from 'react';
import agentService from '../../services/agentService';
import useTacticalMap from '../../hooks/useTacticalMap';
import useRequiredAgents from '../../hooks/useRequiredAgents';
import './AgentTacticalMap.css';

const initialsOf = (name) => {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

/**
 * Spatial "saturation" view of the agent roster: administrative village
 * nodes carrying the identity bubbles of the agents deployed on them.
 * Nodes short of their slab-based requirement pulse red as recruitment targets.
 */
export default function AgentTacticalMap({ state, district, mandal, searchQuery }) {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  const { requiredFor } = useRequiredAgents();

  useEffect(() => {
    let cancelled = false;

    const fetchNodes = async () => {
      setLoading(true);
      try {
        const data = await agentService.getMapNodes({
          state: state || undefined,
          district: district || undefined,
          mandal: mandal || undefined,
        });
        const list = data.result || data.data || [];
        if (!cancelled) {
          setNodes(Array.isArray(list) ? list : []);
          setError(null);
        }
      } catch (err) {
        console.error('Failed to fetch agent map nodes:', err);
        if (!cancelled) {
          setNodes([]);
          setError(
            err?.response?.status === 404
              ? 'Map node endpoint not available on this backend yet.'
              : 'Could not load the tactical map.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchNodes();
    return () => { cancelled = true; };
  }, [state, district, mandal]);

  // Attach the slab benchmark to every node up front — the map, the legend
  // counters and the detail card all read from it.
  const decoratedNodes = useMemo(
    () =>
      nodes.map((node) => {
        const required = requiredFor(node.total_acres);
        const allotted = node.agent_count || 0;
        return {
          ...node,
          required,
          allotted,
          due: Math.max(0, required - allotted),
          vacant: allotted < required,
        };
      }),
    [nodes, requiredFor]
  );

  const { surfaceRef, project, transform, handlers, zoomIn, zoomOut, reset, isZoomed, hasCoordinates } =
    useTacticalMap(decoratedNodes);

  const query = (searchQuery || '').trim().toLowerCase();
  const matchesQuery = (agent) =>
    !!query &&
    (agent.name?.toLowerCase().includes(query) || String(agent.phone || '').includes(query));

  const totals = useMemo(() => {
    return decoratedNodes.reduce(
      (acc, node) => ({
        nodes: acc.nodes + 1,
        agents: acc.agents + node.allotted,
        due: acc.due + node.due,
        vacant: acc.vacant + (node.vacant ? 1 : 0),
      }),
      { nodes: 0, agents: 0, due: 0, vacant: 0 }
    );
  }, [decoratedNodes]);

  return (
    <div className="a-map-wrap">
      <div className="a-map-stats">
        <div className="a-map-stat">
          <span className="a-map-stat-value">{totals.nodes}</span>
          <span className="a-map-stat-label">VILLAGE NODES</span>
        </div>
        <div className="a-map-stat">
          <span className="a-map-stat-value">{totals.agents}</span>
          <span className="a-map-stat-label">ALLOTTED FORCE</span>
        </div>
        <div className="a-map-stat alert">
          <span className="a-map-stat-value">{totals.due}</span>
          <span className="a-map-stat-label">AGENTS DUE</span>
        </div>
        <div className="a-map-stat alert">
          <span className="a-map-stat-value">{totals.vacant}</span>
          <span className="a-map-stat-label">TARGET NODES</span>
        </div>
      </div>

      <div className="a-map-surface" ref={surfaceRef} {...handlers}>
        {loading ? (
          <div className="a-map-empty">Loading tactical map...</div>
        ) : error ? (
          <div className="a-map-empty">{error}</div>
        ) : !hasCoordinates ? (
          <div className="a-map-empty">
            No village node in this territory has a coordinate yet.
          </div>
        ) : (
          <div className="a-map-canvas" style={{ transform }}>
            {decoratedNodes.map((node) => {
              const { x, y } = project(node);
              const size = Math.min(46, 18 + Math.sqrt(node.land_count || 0) * 5);
              const isSelected =
                selectedNode &&
                selectedNode.village === node.village &&
                selectedNode.mandal === node.mandal;

              return (
                <div
                  key={`${node.mandal}-${node.village}`}
                  className={`a-map-node${node.vacant ? ' vacant' : ''}${isSelected ? ' selected' : ''}`}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  onClick={() => setSelectedNode(isSelected ? null : node)}
                >
                  <div
                    className="a-map-node-circle"
                    style={{ width: `${size}px`, height: `${size}px` }}
                  >
                    <span className="a-map-node-count">{node.allotted}</span>
                  </div>

                  <span className="a-map-node-label">{node.village}</span>

                  {/* Identity bubbles clustered around the node */}
                  {node.agents.map((agent, idx) => {
                    const angle = (idx / Math.max(node.agents.length, 1)) * Math.PI * 2 - Math.PI / 2;
                    const radius = size / 2 + 16;
                    return (
                      <div
                        key={agent.id}
                        className={`a-map-bubble${matchesQuery(agent) ? ' match' : ''}${agent.home ? ' home' : ''}`}
                        style={{
                          left: `calc(50% + ${Math.cos(angle) * radius}px)`,
                          top: `calc(50% + ${Math.sin(angle) * radius}px)`,
                        }}
                      >
                        {agent.photo ? (
                          <img src={agent.photo} alt={agent.name} />
                        ) : (
                          <span className="a-map-bubble-initials">{initialsOf(agent.name)}</span>
                        )}
                        <div className="a-map-bubble-tip">
                          <span className="a-map-bubble-name">{agent.name || 'Unnamed agent'}</span>
                          <span className="a-map-bubble-phone">{agent.phone || 'No phone'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* Zoom / pan controls */}
        <div className="a-map-controls">
          <button type="button" onClick={zoomIn} title="Zoom in">+</button>
          <button type="button" onClick={zoomOut} title="Zoom out">−</button>
          <button
            type="button"
            className="a-map-control-reset"
            onClick={reset}
            title="Reset view"
            disabled={!isZoomed}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
          </button>
        </div>

        {/* Legend */}
        <div className="a-map-legend">
          <div className="a-map-legend-title">NODE SIGNALS</div>
          <div className="a-map-legend-row">
            <span className="a-map-legend-dot occupied" />
            Occupied — force at strength
          </div>
          <div className="a-map-legend-row">
            <span className="a-map-legend-dot vacant" />
            Pulsing red — recruitment target
          </div>
          <div className="a-map-legend-row">
            <span className="a-map-legend-dot bubble" />
            Identity bubble — deployed agent
          </div>
        </div>

        {/* Selected node detail */}
        {selectedNode && (
          <div className="a-map-detail">
            <div className="a-map-detail-header">
              <span className="a-map-detail-village">{selectedNode.village}</span>
              <button type="button" onClick={() => setSelectedNode(null)}>×</button>
            </div>
            <div className="a-map-detail-sub">
              {selectedNode.mandal || '—'} · {selectedNode.district || '—'}
            </div>
            <div className="a-map-detail-grid">
              <div>
                <span className="a-map-detail-value">{selectedNode.allotted}</span>
                <span className="a-map-detail-label">ALLOTTED</span>
              </div>
              <div>
                <span className="a-map-detail-value">{selectedNode.required}</span>
                <span className="a-map-detail-label">REQUIRED</span>
              </div>
              <div>
                <span className={`a-map-detail-value${selectedNode.due ? ' due' : ''}`}>
                  {selectedNode.due}
                </span>
                <span className="a-map-detail-label">DUE</span>
              </div>
              <div>
                <span className="a-map-detail-value">{selectedNode.land_count}</span>
                <span className="a-map-detail-label">LANDS</span>
              </div>
              <div>
                <span className="a-map-detail-value">
                  {Math.round(selectedNode.total_acres)}
                </span>
                <span className="a-map-detail-label">ACRES</span>
              </div>
              <div>
                <span className="a-map-detail-value">{selectedNode.coord_source || '—'}</span>
                <span className="a-map-detail-label">COORD</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
