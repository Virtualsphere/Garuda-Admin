import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CalendarCheck,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';

import PersonAvatar from '../common/PersonAvatar';
import attendanceService from '../../../services/attendanceService';
import employeeService from '../../../services/employeeService';

const DEPARTMENT = 'agents';

const STATUS_TONES = {
  PRESENT: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  ABSENT: 'bg-rose-50 text-rose-700 border-rose-300',
  HALF_DAY: 'bg-amber-50 text-amber-900 border-amber-300',
  LEAVE: 'bg-blue-50 text-blue-800 border-blue-200',
  WEEKEND: 'bg-stone-100 text-stone-500 border-stone-200',
  HOLIDAY: 'bg-purple-50 text-purple-800 border-purple-200',
};

const shiftDate = (iso, days) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const prettyDate = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Daily attendance for the agents desk, read from the shared HR register
 * rather than a department-local copy — so this page and HR can never
 * disagree about who was in.
 */
export default function AttendanceTab() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    // The roster is required; the register may legitimately be empty for a
    // date nobody has marked yet, so they settle independently.
    const [registerResult, employeeResult] = await Promise.allSettled([
      attendanceService.getDaily({ role: DEPARTMENT, date }),
      employeeService.getAll(),
    ]);

    if (registerResult.status === 'fulfilled') {
      const data = registerResult.value;
      const list = data.result || data.data || [];
      setRows(Array.isArray(list) ? list : []);
      setError(null);
    } else {
      console.error('Failed to load attendance:', registerResult.reason);
      setRows([]);
      setError('Could not load the attendance register for this date.');
    }

    if (employeeResult.status === 'fulfilled') {
      const data = employeeResult.value;
      const list = data.data || data.employees || data.result || [];
      setEmployees(Array.isArray(list) ? list : []);
    }

    setLoading(false);
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const byEmployee = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      map.set(String(row.employee_id ?? row.employeeId), row);
    });
    return map;
  }, [rows]);

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        String(e.name || '').toLowerCase().includes(q) ||
        String(e.role || '').toLowerCase().includes(q)
    );
  }, [employees, searchQuery]);

  const summary = useMemo(() => {
    const counts = { PRESENT: 0, ABSENT: 0, OTHER: 0, UNMARKED: 0 };
    employees.forEach((emp) => {
      const row = byEmployee.get(String(emp.id));
      const status = String(row?.status || '').toUpperCase();
      if (!status) counts.UNMARKED += 1;
      else if (status === 'PRESENT') counts.PRESENT += 1;
      else if (status === 'ABSENT') counts.ABSENT += 1;
      else counts.OTHER += 1;
    });
    return counts;
  }, [employees, byEmployee]);

  const isToday = date === new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-3">
      {/* Date bar */}
      <div className="bg-white border border-stone-200 rounded-lg p-3 shadow-2xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDate((d) => shiftDate(d, -1))}
            aria-label="Previous day"
            className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-600"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <div className="px-3 py-1.5 rounded-lg bg-stone-50 border border-stone-200 text-center min-w-[190px]">
            <div className="text-xs font-bold text-stone-900 inline-flex items-center gap-1.5">
              <CalendarCheck className="w-3.5 h-3.5 text-[#2563EB]" />
              {prettyDate(date)}
            </div>
            {isToday && (
              <div className="text-[10px] text-emerald-700 font-semibold">Today</div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setDate((d) => shiftDate(d, 1))}
            aria-label="Next day"
            className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-600"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-2 py-1.5 rounded-lg border border-stone-200 bg-stone-50 text-xs font-medium"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-stone-50 px-2.5 py-1.5 rounded-md border border-stone-200 flex-1 min-w-[180px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search staff…"
            className="w-full bg-transparent text-xs text-stone-800 placeholder-stone-400"
          />
        </div>

        <div className="flex items-center gap-2 ml-auto text-xs">
          <Pill tone="emerald" label="Present" value={summary.PRESENT} />
          <Pill tone="rose" label="Absent" value={summary.ABSENT} />
          <Pill tone="blue" label="Other" value={summary.OTHER} />
          <Pill tone="stone" label="Unmarked" value={summary.UNMARKED} />
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Register */}
      <div className="bg-white rounded-lg border border-stone-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto max-h-[calc(100vh-400px)]">
          <table className="w-full text-xs text-left">
            <thead className="sticky top-0 z-20">
              <tr className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
                <th className="p-2.5 bg-stone-50">Staff</th>
                <th className="p-2.5 bg-stone-50">Role</th>
                <th className="p-2.5 bg-stone-50">Status</th>
                <th className="p-2.5 bg-stone-50">In</th>
                <th className="p-2.5 bg-stone-50">Out</th>
                <th className="p-2.5 bg-stone-50">Hours</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-stone-400">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading
                      register…
                    </span>
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-stone-400">
                    No staff on the roster.
                  </td>
                </tr>
              ) : (
                visible.map((emp) => {
                  const row = byEmployee.get(String(emp.id));
                  const status = String(row?.status || '').toUpperCase();

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

                      <td className="p-2.5 text-stone-600">{emp.role || '—'}</td>

                      <td className="p-2.5">
                        {status ? (
                          <span
                            className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                              STATUS_TONES[status] || STATUS_TONES.WEEKEND
                            }`}
                          >
                            {status.replace(/_/g, ' ')}
                          </span>
                        ) : (
                          <span className="text-stone-400">Not marked</span>
                        )}
                      </td>

                      <td className="p-2.5 text-stone-600">
                        {row?.entry_time || row?.check_in || '—'}
                      </td>
                      <td className="p-2.5 text-stone-600">
                        {row?.exit_time || row?.check_out || '—'}
                      </td>
                      <td className="p-2.5 text-stone-700 font-medium">
                        {row?.mission_hours ?? row?.hours ?? '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-3 py-2 border-t border-stone-200 bg-stone-50/60 text-[11px] text-stone-500">
          Read from the shared HR attendance register — mark attendance in HR, not here.
        </div>
      </div>
    </div>
  );
}

/* ── Local pieces ─────────────────────────────────────────────── */

const PILL_TONES = {
  emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  blue: 'bg-blue-50 text-blue-800 border-blue-200',
  stone: 'bg-stone-100 text-stone-600 border-stone-200',
};

function Pill({ tone, label, value }) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${PILL_TONES[tone]}`}
    >
      {label} {value}
    </span>
  );
}
