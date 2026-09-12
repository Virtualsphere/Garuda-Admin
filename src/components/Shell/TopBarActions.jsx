import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import employeeService from '../../services/employeeService';
import './TopBarActions.css';

/**
 * The shell chrome that sits to the right of the section tabs: a universal
 * quick-add, the live on-duty headcount, this user's own duty switch, and their
 * profile chip.
 *
 * Styled against the theme CSS variables rather than Tailwind on purpose — the
 * Tailwind build is scoped to `.garuda-agents`, so utilities do nothing out
 * here, and the top bar has to re-theme with every section anyway.
 */

const QUICK_ADD_ITEMS = [
  {
    key: 'land',
    label: 'Add Land',
    hint: 'Survey no, village, extent, price',
    tone: 'emerald',
    icon: (
      <>
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" />
        <circle cx="12" cy="10" r="3" />
      </>
    ),
  },
  {
    key: 'buyer',
    label: 'Add Buyer',
    hint: 'Budget, extent, preferred location',
    tone: 'blue',
    icon: (
      <>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
  },
  {
    key: 'agent',
    label: 'Add Agent Lead',
    hint: 'Candidate, village, contact',
    tone: 'indigo',
    icon: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  },
  {
    key: 'farmer',
    label: 'Add Farmer Lead',
    hint: 'Farmer details, village, approx acres',
    tone: 'amber',
    icon: (
      <>
        <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
      </>
    ),
  },
  {
    key: 'visit',
    label: 'Schedule Site Visit',
    hint: 'Client, land selection, assigned agent',
    tone: 'rose',
    separated: true,
    icon: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
  },
];

const Icon = ({ children, size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

export default function TopBarActions({ onQuickAdd }) {
  const { user, logout } = useAuth();

  const [employees, setEmployees] = useState([]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

  const quickAddRef = useRef(null);
  const profileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await employeeService.getAll();
      const list = data.data || data.employees || data.result || [];
      setEmployees(Array.isArray(list) ? list : []);
    } catch (err) {
      // The headcount is decoration; a failure must not break the shell.
      console.error('Failed to load the staff roster:', err);
      setEmployees([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Close either menu on an outside click or Escape.
  useEffect(() => {
    if (!quickAddOpen && !profileOpen) return undefined;
    const onAway = (e) => {
      if (quickAddRef.current && !quickAddRef.current.contains(e.target)) setQuickAddOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setQuickAddOpen(false);
      setProfileOpen(false);
    };
    document.addEventListener('mousedown', onAway);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onAway);
      document.removeEventListener('keydown', onKey);
    };
  }, [quickAddOpen, profileOpen]);

  const onlineCount = useMemo(
    () =>
      employees.filter((e) => String(e.duty_status || '').toLowerCase() === 'online').length,
    [employees]
  );

  const me = useMemo(
    () => employees.find((e) => String(e.id) === String(user?.id)) || null,
    [employees, user?.id]
  );

  const isOnline = String(me?.duty_status || '').toLowerCase() === 'online';

  const toggleDuty = async () => {
    if (!user?.id) return;
    const next = isOnline ? 'offline' : 'online';
    setToggling(true);
    try {
      await employeeService.update(user.id, { duty_status: next });
      setEmployees((prev) =>
        prev.map((e) => (String(e.id) === String(user.id) ? { ...e, duty_status: next } : e))
      );
    } catch (err) {
      console.error('Could not change duty status:', err);
    } finally {
      setToggling(false);
    }
  };

  const displayName = user?.name || 'Operations Admin';
  const displayRole = user?.role || me?.role || 'Operations';

  return (
    <div className="topbar-actions">
      {/* Quick add */}
      <div className="topbar-quickadd" ref={quickAddRef}>
        <button
          type="button"
          className="topbar-quickadd-btn"
          onClick={() => setQuickAddOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={quickAddOpen}
          title="Quick add a new record"
        >
          <Icon>
            <path d="M12 5v14M5 12h14" />
          </Icon>
          <span>Quick Add</span>
          <Icon size={12}>
            <path d="m6 9 6 6 6-6" />
          </Icon>
        </button>

        {quickAddOpen && (
          <div className="topbar-menu topbar-menu--wide" role="menu">
            <div className="topbar-menu-head">Quick add record</div>
            {QUICK_ADD_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                className={`topbar-menu-item${item.separated ? ' is-separated' : ''}`}
                onClick={() => {
                  setQuickAddOpen(false);
                  onQuickAdd?.(item.key);
                }}
              >
                <span className={`topbar-menu-icon tone-${item.tone}`}>
                  <Icon>{item.icon}</Icon>
                </span>
                <span className="topbar-menu-text">
                  <span className="topbar-menu-label">{item.label}</span>
                  <span className="topbar-menu-hint">{item.hint}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Live headcount */}
      <div className="topbar-count" title="Staff currently marked on duty">
        <Icon>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="m16 11 2 2 4-4" />
        </Icon>
        <span>
          <strong>{onlineCount}</strong> / {employees.length} Online
        </span>
      </div>

      {/* This user's duty switch */}
      <div className={`topbar-duty${isOnline ? ' is-online' : ''}`}>
        <span className="topbar-duty-dot" />
        <span className="topbar-duty-text">
          <strong>{isOnline ? 'Online' : 'Offline'}</strong>
          <span>{isOnline ? 'Active (working)' : 'Off duty'}</span>
        </span>
        <button
          type="button"
          className="topbar-switch"
          onClick={toggleDuty}
          disabled={toggling || !user?.id}
          aria-pressed={isOnline}
          title={isOnline ? 'Switch to offline' : 'Switch to online'}
        >
          <span className="topbar-switch-knob" />
        </button>
      </div>

      {/* Profile */}
      <div className="topbar-profile" ref={profileRef}>
        <button
          type="button"
          className="topbar-profile-btn"
          onClick={() => setProfileOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={profileOpen}
        >
          <span className="topbar-avatar">
            {displayName
              .split(/\s+/)
              .slice(0, 2)
              .map((p) => p[0])
              .join('')
              .toUpperCase()}
            <span className={`topbar-avatar-dot${isOnline ? ' is-online' : ''}`} />
          </span>
          <span className="topbar-profile-text">
            <strong>{displayName}</strong>
            <span>{displayRole}</span>
          </span>
          <Icon size={12}>
            <path d="m6 9 6 6 6-6" />
          </Icon>
        </button>

        {profileOpen && (
          <div className="topbar-menu" role="menu">
            <div className="topbar-menu-head">{user?.email || 'Signed in'}</div>
            <button
              type="button"
              role="menuitem"
              className="topbar-menu-item is-plain is-danger"
              onClick={() => {
                setProfileOpen(false);
                logout();
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
