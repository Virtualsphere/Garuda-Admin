import React, { useState, useEffect } from 'react';
import callSignalService from '../../services/callSignalService';
import './InboundSignals.css';

export default function InboundSignals() {
  const [toggleOn, setToggleOn] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [signals, setSignals] = useState([]);

  const fetchSignals = async () => {
    try {
      const data = await callSignalService.getAll({ direction: 'inbound', status: 'pending' });
      const list = (data.data || []).map((s) => ({
        id: s.id,
        name: s.caller_name?.toUpperCase() || 'UNKNOWN',
        location: s.department_type?.toUpperCase() || 'GENERAL',
        message: s.mission_context ? `"${s.mission_context}"` : 'No message provided.',
        badge: (s.caller_type || 'SIGNAL').toUpperCase(),
      }));
      setSignals(list);
    } catch (err) {
      console.error('Failed to fetch inbound signals:', err);
    }
  };

  useEffect(() => {
    if (!toggleOn) return;
    fetchSignals();
    const interval = setInterval(fetchSignals, 30000);
    return () => clearInterval(interval);
  }, [toggleOn]);

  const handleAction = async (id, status) => {
    try {
      await callSignalService.updateStatus(id, status);
      fetchSignals();
    } catch (err) {
      console.error('Failed to update inbound signal:', err);
    }
  };

  return (
    <div className={`inbound-signals-float${isCollapsed ? ' collapsed' : ''}`}>
      {/* Header */}
      <div 
        className="inbound-header" 
        onClick={(e) => {
          // Prevent collapsing when clicking the toggle switch itself
          if (!e.target.closest('.inbound-toggle')) {
            setIsCollapsed(!isCollapsed);
          }
        }}
        style={{ cursor: 'pointer' }}
      >
        <div className="inbound-header-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          Inbound Signals ({signals.length})
        </div>
        <div className="inbound-header-actions">
          <button className="inbound-action-btn" onClick={(e) => e.stopPropagation()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
          <div
            className={`inbound-toggle${toggleOn ? ' on' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setToggleOn(!toggleOn);
            }}
          >
            <div className="inbound-toggle-knob" />
          </div>
          <button className="inbound-action-btn" onClick={(e) => {
            e.stopPropagation();
            setIsCollapsed(!isCollapsed);
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isCollapsed ? (
                <polyline points="18 15 12 9 6 15" />
              ) : (
                <polyline points="6 9 12 15 18 9" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Cards */}
      {!isCollapsed && (
        <div className="inbound-cards">
          {signals.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>No pending inbound signals.</div>
          ) : signals.map((signal) => (
            <div className="inbound-card" key={signal.id}>
              <span className="inbound-card-badge">{signal.badge}</span>
              <div className="inbound-card-name">{signal.name}</div>
              <div className="inbound-card-location">
                <span className="dot" />
                {signal.location}
              </div>
              <div className="inbound-card-message">{signal.message}</div>
              <div className="inbound-card-actions">
                <button className="inbound-call-btn" onClick={() => handleAction(signal.id, 'attended')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  Call Now
                </button>
                <button className="inbound-act-btn" onClick={() => handleAction(signal.id, 'attended')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
                <button className="inbound-act-btn" onClick={() => handleAction(signal.id, 'dismissed')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
