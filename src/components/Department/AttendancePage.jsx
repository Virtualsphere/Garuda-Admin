import React, { useState, useEffect, useCallback, useMemo } from 'react';
import attendanceService from '../../services/attendanceService';
import './AttendancePage.css';

const avatarGradients = [
  'linear-gradient(135deg, #667eea, #764ba2)',
  'linear-gradient(135deg, #f093fb, #f5576c)',
  'linear-gradient(135deg, #4facfe, #00f2fe)',
  'linear-gradient(135deg, #43e97b, #38f9d7)',
  'linear-gradient(135deg, #fa709a, #fee140)',
  'linear-gradient(135deg, #a18cd1, #fbc2eb)',
  'linear-gradient(135deg, #fccb90, #d57eeb)',
  'linear-gradient(135deg, #e0c3fc, #8ec5fc)',
  'linear-gradient(135deg, #f5576c, #ff6a88)',
  'linear-gradient(135deg, #0ba360, #3cba92)',
];

const STATUS_CYCLE = ['PRESENT', 'ABSENT', 'LEAVE'];
const STATUS_LABEL = { PRESENT: 'P', ABSENT: 'A', LEAVE: 'L' };

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
};

const pad2 = (n) => String(n).padStart(2, '0');

const toDateStr = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const formatMonthYear = (date) =>
  date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();

const formatDayLabel = (dateStr) => {
  const d = new Date(`${dateStr}T00:00:00`);
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    day: d.getDate(),
  };
};

const toHHMM = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const combineDateTime = (dateStr, hhmm) => {
  if (!hhmm) return null;
  return `${dateStr}T${hhmm}:00`;
};

const formatTime12h = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
};

const computeHours = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return null;
  const diffMs = new Date(checkOut) - new Date(checkIn);
  if (diffMs <= 0) return null;
  return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
};

const getWeekRange = (date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: toDateStr(monday), end: toDateStr(sunday) };
};

function EmployeeCell({ name, code, role, photo, idx }) {
  return (
    <div className="att-identity">
      {photo ? (
        <img className="att-avatar-img" src={photo} alt={name} />
      ) : (
        <div className="att-avatar" style={{ background: avatarGradients[idx % avatarGradients.length] }}>
          {getInitials(name)}
        </div>
      )}
      <div className="att-identity-info">
        <span className="att-identity-name">{name}</span>
        <span className="att-identity-code">
          {code} &bull; {(role || 'STAFF').toUpperCase()}
        </span>
      </div>
    </div>
  );
}

function TimeCell({ value, dirty, verifiedLabel, placeholder, onCommit }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(toHHMM(value));

  useEffect(() => {
    setDraft(toHHMM(value));
  }, [value]);

  if (editing) {
    return (
      <input
        type="time"
        className="att-time-input"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          onCommit(draft || null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.target.blur();
        }}
      />
    );
  }

  return (
    <button type="button" className={`att-time-cell${dirty ? ' dirty' : ''}`} onClick={() => setEditing(true)}>
      <span className="att-time-value">{formatTime12h(value) || '—'}</span>
      <span className="att-time-sub">{value ? (dirty ? 'PENDING SAVE' : verifiedLabel) : placeholder}</span>
    </button>
  );
}

function StatusBadge({ status, dirty, onClick }) {
  return (
    <button type="button" className={`att-status-badge ${(status || 'ABSENT').toLowerCase()}${dirty ? ' dirty' : ''}`} onClick={onClick}>
      {STATUS_LABEL[status] || 'A'}
    </button>
  );
}

export default function AttendancePage({ roleFilter = 'call center', departmentLabel = 'Call Center Department' }) {
  const [viewMode, setViewMode] = useState('daily');
  const [viewDate, setViewDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [allEmployeesCount, setAllEmployeesCount] = useState(null);

  const [dailyRows, setDailyRows] = useState([]);
  const [weeklyData, setWeeklyData] = useState({ dates: [], employees: [] });
  const [monthlyRows, setMonthlyRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edits, setEdits] = useState({}); // daily: { [empId]: {check_in, check_out, status} }
  const [weeklyEdits, setWeeklyEdits] = useState({}); // weekly: { [`${empId}_${date}`]: status }

  const dateStr = useMemo(() => toDateStr(viewDate), [viewDate]);
  const weekRange = useMemo(() => getWeekRange(viewDate), [viewDate]);
  const month = viewDate.getMonth() + 1;
  const year = viewDate.getFullYear();

  const shiftMonth = (delta) => {
    setViewDate((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
    setEdits({});
    setWeeklyEdits({});
  };

  const fetchDaily = useCallback(async () => {
    setLoading(true);
    try {
      const res = await attendanceService.getDaily({ role: roleFilter, date: dateStr });
      const rows = res.data || [];
      setDailyRows(rows);
      setAllEmployeesCount(rows.length);
    } catch (err) {
      console.error('Failed to fetch daily attendance:', err);
      setDailyRows([]);
    } finally {
      setLoading(false);
    }
  }, [roleFilter, dateStr]);

  const fetchWeekly = useCallback(async () => {
    setLoading(true);
    try {
      const res = await attendanceService.getWeekly({ role: roleFilter, startDate: weekRange.start, endDate: weekRange.end });
      const data = res.data || { dates: [], employees: [] };
      setWeeklyData(data);
      setAllEmployeesCount(data.employees?.length || 0);
    } catch (err) {
      console.error('Failed to fetch weekly attendance:', err);
      setWeeklyData({ dates: [], employees: [] });
    } finally {
      setLoading(false);
    }
  }, [roleFilter, weekRange.start, weekRange.end]);

  const fetchMonthly = useCallback(async () => {
    setLoading(true);
    try {
      const res = await attendanceService.getMonthly({ role: roleFilter, month, year });
      const rows = res.data || [];
      setMonthlyRows(rows);
      setAllEmployeesCount(rows.length);
    } catch (err) {
      console.error('Failed to fetch monthly attendance:', err);
      setMonthlyRows([]);
    } finally {
      setLoading(false);
    }
  }, [roleFilter, month, year]);

  useEffect(() => {
    if (viewMode === 'daily') fetchDaily();
    else if (viewMode === 'weekly') fetchWeekly();
    else fetchMonthly();
  }, [viewMode, fetchDaily, fetchWeekly, fetchMonthly]);

  const filteredDaily = dailyRows.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return r.name?.toLowerCase().includes(q) || String(r.id).includes(q);
  });

  const filteredWeeklyEmployees = (weeklyData.employees || []).filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return r.name?.toLowerCase().includes(q) || String(r.id).includes(q);
  });

  const filteredMonthly = monthlyRows.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return r.name?.toLowerCase().includes(q) || String(r.id).includes(q);
  });

  const updateDailyField = (empId, field, value) => {
    setEdits((prev) => ({ ...prev, [empId]: { ...prev[empId], [field]: value } }));
  };

  const cycleDailyStatus = (empId, current) => {
    const idx = STATUS_CYCLE.indexOf(current);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    updateDailyField(empId, 'status', next);
  };

  const cycleWeeklyStatus = (empId, date, current) => {
    const idx = STATUS_CYCLE.indexOf(current);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    setWeeklyEdits((prev) => ({ ...prev, [`${empId}_${date}`]: next }));
  };

  const dailyDirtyCount = Object.keys(edits).length;
  const weeklyDirtyCount = Object.keys(weeklyEdits).length;
  const dirtyCount = viewMode === 'daily' ? dailyDirtyCount : viewMode === 'weekly' ? weeklyDirtyCount : 0;

  const handleSave = async () => {
    if (!dirtyCount || saving) return;
    setSaving(true);
    try {
      if (viewMode === 'daily') {
        const records = Object.entries(edits).map(([id, e]) => {
          const row = dailyRows.find((r) => String(r.id) === String(id));
          return {
            employee_id: Number(id),
            check_in: e.check_in !== undefined ? e.check_in : row?.check_in,
            check_out: e.check_out !== undefined ? e.check_out : row?.check_out,
            status: e.status !== undefined ? e.status : row?.status,
          };
        });
        await attendanceService.saveBulk(dateStr, records);
        setEdits({});
        await fetchDaily();
      } else if (viewMode === 'weekly') {
        const records = Object.entries(weeklyEdits).map(([key, status]) => {
          const lastUnderscore = key.lastIndexOf('_');
          const empId = key.slice(0, lastUnderscore);
          const date = key.slice(lastUnderscore + 1);
          return { employee_id: Number(empId), date, status };
        });
        await attendanceService.saveBulk(weekRange.start, records);
        setWeeklyEdits({});
        await fetchWeekly();
      }
    } catch (err) {
      console.error('Failed to save attendance changes:', err);
    } finally {
      setSaving(false);
    }
  };

  const CalendarIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );

  return (
    <div className="att-page">
      {/* Header */}
      <div className="att-header">
        <div className="att-title-section">
          <div className="att-title-main">
            <div className="att-title-icon">{CalendarIcon}</div>
            <div>
              <h2>PRESENCE REGISTRY &bull; {departmentLabel.toUpperCase()}</h2>
              <div className="att-subtitle">Surgical shift and mission hours audit</div>
            </div>
          </div>
        </div>

        <div className="att-month-nav">
          <button type="button" onClick={() => shiftMonth(-1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <span>{formatMonthYear(viewDate)}</span>
          <button type="button" onClick={() => shiftMonth(1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>

        <button
          type="button"
          className="att-save-btn"
          disabled={!dirtyCount || saving}
          onClick={handleSave}
        >
          {saving ? 'SAVING…' : dirtyCount ? `SAVE ALL CHANGES (${dirtyCount})` : 'SAVE ALL CHANGES'}
        </button>
      </div>

      {/* View toggle */}
      <div className="att-view-tabs">
        <button className={`att-view-tab${viewMode === 'daily' ? ' active' : ''}`} onClick={() => setViewMode('daily')}>
          Daily (Timings)
        </button>
        <button className={`att-view-tab${viewMode === 'weekly' ? ' active' : ''}`} onClick={() => setViewMode('weekly')}>
          Weekly Grid
        </button>
        <button className={`att-view-tab${viewMode === 'monthly' ? ' active' : ''}`} onClick={() => setViewMode('monthly')}>
          Monthly History
        </button>
      </div>

      {/* Search */}
      <div className="att-search-row">
        <div className="att-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Search personnel..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <span className="att-staff-count">{allEmployeesCount ?? 0} STAFF LINKED</span>
      </div>

      {/* Table */}
      <div className="att-table-container">
        <div className="att-table-scroll">
          {viewMode === 'daily' && (
            <table className="att-table">
              <thead>
                <tr>
                  <th>Personnel Identity</th>
                  <th>Entry Time</th>
                  <th>Exit Time</th>
                  <th>Mission Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" className="att-empty">Loading...</td></tr>
                ) : filteredDaily.length === 0 ? (
                  <tr><td colSpan="5" className="att-empty">No personnel linked to this department.</td></tr>
                ) : filteredDaily.map((row, idx) => {
                  const e = edits[row.id] || {};
                  const checkIn = e.check_in !== undefined ? e.check_in : row.check_in;
                  const checkOut = e.check_out !== undefined ? e.check_out : row.check_out;
                  const status = e.status !== undefined ? e.status : row.status;
                  const hours = computeHours(checkIn, checkOut) ?? row.mission_hours;
                  const dirty = !!edits[row.id];
                  return (
                    <tr key={row.id}>
                      <td>
                        <EmployeeCell
                          name={row.name}
                          code={`GTS${String(row.id).padStart(5, '0')}`}
                          role={row.role}
                          photo={row.photo}
                          idx={idx}
                        />
                      </td>
                      <td>
                        <TimeCell
                          value={checkIn}
                          dirty={dirty && e.check_in !== undefined}
                          verifiedLabel={row.verified ? 'VERIFIED' : 'RECORDED'}
                          placeholder="TAP TO SET"
                          onCommit={(hhmm) => updateDailyField(row.id, 'check_in', combineDateTime(dateStr, hhmm))}
                        />
                      </td>
                      <td>
                        <TimeCell
                          value={checkOut}
                          dirty={dirty && e.check_out !== undefined}
                          verifiedLabel={row.exit_type === 'MANUAL' ? 'MANUAL EXIT' : 'AUTO EXIT'}
                          placeholder="TAP TO SET"
                          onCommit={(hhmm) => updateDailyField(row.id, 'check_out', combineDateTime(dateStr, hhmm))}
                        />
                      </td>
                      <td>
                        <span className="att-hours-pill">{hours != null ? `${hours} Hours` : '—'}</span>
                      </td>
                      <td>
                        <StatusBadge status={status} dirty={dirty && e.status !== undefined} onClick={() => cycleDailyStatus(row.id, status)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {viewMode === 'weekly' && (
            <table className="att-table att-weekly-table">
              <thead>
                <tr>
                  <th>Personnel Identity</th>
                  {(weeklyData.dates || []).map((d) => {
                    const { weekday, day } = formatDayLabel(d);
                    return (
                      <th key={d} className="att-day-col">
                        <div className="att-day-head">
                          <span>{weekday}</span>
                          <span className="att-day-num">{day}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={(weeklyData.dates?.length || 0) + 1} className="att-empty">Loading...</td></tr>
                ) : filteredWeeklyEmployees.length === 0 ? (
                  <tr><td colSpan={(weeklyData.dates?.length || 0) + 1} className="att-empty">No personnel linked to this department.</td></tr>
                ) : filteredWeeklyEmployees.map((emp, idx) => (
                  <tr key={emp.id}>
                    <td>
                      <EmployeeCell
                        name={emp.name}
                        code={`GTS${String(emp.id).padStart(5, '0')}`}
                        role={emp.role}
                        photo={emp.photo}
                        idx={idx}
                      />
                    </td>
                    {(weeklyData.dates || []).map((d) => {
                      const key = `${emp.id}_${d}`;
                      const status = weeklyEdits[key] !== undefined ? weeklyEdits[key] : emp.days?.[d]?.status;
                      const dirty = weeklyEdits[key] !== undefined;
                      return (
                        <td key={d} className="att-day-col">
                          <StatusBadge status={status} dirty={dirty} onClick={() => cycleWeeklyStatus(emp.id, d, status)} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {viewMode === 'monthly' && (
            <table className="att-table">
              <thead>
                <tr>
                  <th>Personnel Identity</th>
                  <th>Present Days</th>
                  <th>Absent Days</th>
                  <th>Leave Days</th>
                  <th>Total Mission Hours</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" className="att-empty">Loading...</td></tr>
                ) : filteredMonthly.length === 0 ? (
                  <tr><td colSpan="5" className="att-empty">No personnel linked to this department.</td></tr>
                ) : filteredMonthly.map((row, idx) => (
                  <tr key={row.id}>
                    <td>
                      <EmployeeCell
                        name={row.name}
                        code={`GTS${String(row.id).padStart(5, '0')}`}
                        role={row.role}
                        photo={row.photo}
                        idx={idx}
                      />
                    </td>
                    <td><span className="att-status-badge present static">{row.presentDays}</span></td>
                    <td><span className="att-status-badge absent static">{row.absentDays}</span></td>
                    <td><span className="att-status-badge leave static">{row.leaveDays}</span></td>
                    <td><span className="att-hours-pill">{row.totalHours} Hours</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
