import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Loader2,
  AlertTriangle,
  Phone,
  Mail,
  Building2,
  Clock,
  CheckCircle2,
  UserCheck,
  IndianRupee,
  Landmark,
  MapPin,
  CalendarCheck,
} from 'lucide-react';

import PersonAvatar from '../common/PersonAvatar';
import CallButton from '../common/CallButton';
import EmployeeProfileModal from '../modals/EmployeeProfileModal';
import employeeService from '../../../services/employeeService';
import attendanceService from '../../../services/attendanceService';
import { cadreMeta, formatINR } from '../agentConstants';

const DEPARTMENT = 'agents';

const EMP_CODE = (id) => `EMP-${String(id ?? '').padStart(3, '0')}`;

/** Last four digits only — the rest is never needed on screen. */
const maskAadhaar = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 4) return null;
  return `XXXX-XXXX-${digits.slice(-4)}`;
};

const maskAccount = (value) => {
  const raw = String(value || '').trim();
  if (raw.length < 4) return null;
  return `${'X'.repeat(Math.max(4, raw.length - 4))}${raw.slice(-4)}`;
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_TONES = {
  PRESENT: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  LATE: 'bg-amber-50 text-amber-800 border-amber-200',
  LEAVE: 'bg-rose-50 text-rose-800 border-rose-200',
  ABSENT: 'bg-stone-100 text-stone-600 border-stone-200',
  HALF_DAY: 'bg-blue-50 text-blue-800 border-blue-200',
};

/**
 * One staff member, end to end: who they are, whether they are on duty, what
 * their attendance looks like this month and what the company pays them for.
 *
 * Everything here is read from the employee and attendance records. Where a
 * field genuinely is not stored — a CTC, a PAN, a leave balance — the card says
 * so rather than showing a plausible number, because this page is the one
 * people quote from.
 */
export default function PersonalPageTab() {
  const [employees, setEmployees] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toggling, setToggling] = useState(false);
  const [showFullModal, setShowFullModal] = useState(false);
  const [toast, setToast] = useState(null);

  const [monthly, setMonthly] = useState([]);
  const [today, setToday] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(true);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const data = await employeeService.getAll();
      const list = data.data || data.employees || data.result || [];
      const rows = Array.isArray(list) ? list : [];
      setEmployees(rows);
      setSelectedId((prev) =>
        prev && rows.some((e) => String(e.id) === String(prev)) ? prev : String(rows[0]?.id || '')
      );
      setError(null);
    } catch (err) {
      console.error('Failed to load employees:', err);
      setEmployees([]);
      setError('Could not load the staff roster.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // Attendance is per department and per month, not per employee, so it is
  // fetched once and the selected person is picked out of it.
  useEffect(() => {
    let cancelled = false;
    const now = new Date();

    setAttendanceLoading(true);
    Promise.allSettled([
      attendanceService.getMonthly({
        role: DEPARTMENT,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      }),
      attendanceService.getDaily({
        role: DEPARTMENT,
        date: now.toISOString().slice(0, 10),
      }),
    ]).then(([monthlyResult, dailyResult]) => {
      if (cancelled) return;

      if (monthlyResult.status === 'fulfilled') {
        const data = monthlyResult.value;
        setMonthly(data.data || data.result || []);
      } else {
        setMonthly([]);
      }

      if (dailyResult.status === 'fulfilled') {
        const data = dailyResult.value;
        setToday(data.data || data.result || []);
      } else {
        setToday([]);
      }

      setAttendanceLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const employee = useMemo(
    () => employees.find((e) => String(e.id) === String(selectedId)) || employees[0] || null,
    [employees, selectedId]
  );

  const monthlyRow = useMemo(
    () => monthly.find((r) => String(r.id) === String(employee?.id)) || null,
    [monthly, employee]
  );

  const todayRow = useMemo(
    () => today.find((r) => String(r.id) === String(employee?.id)) || null,
    [today, employee]
  );

  // `days` is a map of ISO date → status; newest first is what the desk reads.
  const history = useMemo(() => {
    const days = monthlyRow?.days || {};
    return Object.entries(days)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 7)
      .map(([date, status]) => {
        const dt = new Date(`${date}T00:00:00`);
        return {
          date,
          day: Number.isNaN(dt.getTime()) ? '' : DAY_NAMES[dt.getDay()],
          status: String(status || '').toUpperCase(),
        };
      });
  }, [monthlyRow]);

  const isOnline = String(employee?.duty_status || '').toLowerCase() === 'online';

  const say = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
  };

  const toggleDuty = async () => {
    if (!employee) return;
    const next = isOnline ? 'offline' : 'online';
    setToggling(true);
    setError(null);
    try {
      await employeeService.update(employee.id, { duty_status: next });
      setEmployees((prev) =>
        prev.map((e) =>
          String(e.id) === String(employee.id) ? { ...e, duty_status: next } : e
        )
      );
      say(`${employee.name} is now ${next === 'online' ? 'Online' : 'Offline'}`);
    } catch (err) {
      setError(
        err.response?.data?.message || 'Could not change the duty status. Nothing was saved.'
      );
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-stone-200 rounded-lg py-16 flex items-center justify-center">
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-stone-500">
          <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading staff…
        </span>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="bg-white border border-stone-200 rounded-lg py-16 text-center text-xs text-stone-400">
        No staff on the roster yet.
      </div>
    );
  }

  const cadre = cadreMeta(employee.cadre);
  const aadhaar = maskAadhaar(employee.aadhar_number);
  const account = maskAccount(employee.account_number);
  const presentDays = monthlyRow?.presentDays ?? 0;
  const leaveDays = monthlyRow?.leaveDays ?? 0;
  const absentDays = monthlyRow?.absentDays ?? 0;
  const recordedDays = presentDays + leaveDays + absentDays;
  const rate = formatINR;

  return (
    <div className="space-y-4 text-xs relative">
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Selector + duty switch */}
      <div className="bg-white rounded-xl border border-stone-200 p-3.5 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 shrink-0">
              360° Profile
            </span>
            <span className="text-stone-500 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">
              Select staff:
            </span>
            <select
              value={employee.id}
              onChange={(e) => setSelectedId(e.target.value)}
              className="px-3 py-1.5 bg-stone-50 hover:bg-stone-100 border border-stone-300 rounded-lg text-xs font-bold text-stone-900 max-w-xs truncate"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} — {emp.role}
                  {emp.cadre ? ` [${cadreMeta(emp.cadre).short}]` : ''} (
                  {String(emp.duty_status || '').toLowerCase() === 'online' ? 'Online' : 'Offline'})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 bg-stone-50 p-2 px-3 rounded-xl border border-stone-200 shrink-0 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wide">
                Duty status switch:
              </span>
              <button
                type="button"
                onClick={toggleDuty}
                disabled={toggling}
                title="Toggle online duty status"
                aria-pressed={isOnline}
                className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors disabled:opacity-60 ${
                  isOnline ? 'bg-emerald-600' : 'bg-stone-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isOnline ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center gap-1.5 border-l border-stone-200 pl-3">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  isOnline
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-stone-200 text-stone-700 border-stone-300'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isOnline ? 'bg-emerald-600 animate-pulse' : 'bg-stone-500'
                  }`}
                />
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
              <span className="text-[10px] text-stone-500 hidden lg:inline font-medium">
                {isOnline
                  ? '• Active on PBX trunk & lead allocation'
                  : '• Calls routed to squad fallback'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 border-l border-stone-200 pl-3">
              <CallButton
                phone={employee.phone}
                recordName={employee.name}
                recordId={employee.id}
                recordType="STAFF"
                variant="outline"
              />
              <button
                type="button"
                onClick={() => setShowFullModal(true)}
                title="Open the full 360° profile"
                className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold flex items-center gap-1 text-[11px]"
              >
                <UserCheck className="w-3 h-3" />
                Full Modal
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-[11px]">
          <span className="text-stone-400 font-medium whitespace-nowrap">Quick select:</span>
          {employees.map((emp) => {
            const online = String(emp.duty_status || '').toLowerCase() === 'online';
            const active = String(emp.id) === String(employee.id);
            return (
              <button
                key={emp.id}
                type="button"
                onClick={() => setSelectedId(String(emp.id))}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-full whitespace-nowrap transition-colors border shrink-0 ${
                  active
                    ? 'bg-stone-900 text-white border-stone-900 font-bold'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <PersonAvatar name={emp.name} photo={emp.photo} size={18} />
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    online ? 'bg-emerald-400' : 'bg-stone-400'
                  }`}
                />
                {String(emp.name || '').split(' ')[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 1 */}
      <Section
        n="1"
        tone="blue"
        title="Personal & Contact Details"
        subtitle={`Official employment identity, station allocation and KYC data for ${employee.name}`}
        badge={
          <span className="px-2.5 py-1 rounded text-xs font-bold bg-stone-100 text-stone-700">
            {EMP_CODE(employee.id)}
          </span>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-3 flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <PersonAvatar
                name={employee.name}
                photo={employee.photo}
                size={56}
                badge={
                  <span
                    className={`block w-3.5 h-3.5 rounded-full border-2 border-white ${
                      isOnline ? 'bg-emerald-500' : 'bg-stone-400'
                    }`}
                  />
                }
              />
              <div className="min-w-0">
                <h5 className="font-bold text-stone-900 text-sm truncate">{employee.name}</h5>
                <p className="text-stone-500 text-xs truncate">{employee.role}</p>
                <span
                  className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold border ${cadre.tone}`}
                >
                  {cadre.short}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-stone-200">
              <Row label="Secondary role" value={employee.secondary_role} />
              <Row label="Employment status" value={employee.status} />
              <Row
                label="Contract"
                value={
                  employee.contract_start_date
                    ? `${employee.contract_start_date}${
                        employee.contract_end_date ? ` → ${employee.contract_end_date}` : ' → open'
                      }`
                    : null
                }
              />
            </div>
          </div>

          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2.5">
            <span className="text-stone-500 text-[10px] uppercase font-bold tracking-wider block">
              Official communication & base
            </span>
            <div className="space-y-2">
              <IconRow icon={Phone} label="Mobile phone" value={employee.phone} mono />
              <IconRow icon={Phone} label="Alternate phone" value={employee.other_phone} mono />
              <IconRow icon={Mail} label="Official email" value={employee.email} mono />
              <IconRow icon={Building2} label="Base station" value={employee.assigned_hub} />
              <IconRow
                icon={MapPin}
                label="Work location"
                value={
                  [employee.work_village, employee.work_mandal, employee.work_district]
                    .filter(Boolean)
                    .join(', ') || null
                }
              />
            </div>
          </div>

          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2.5">
            <span className="text-stone-500 text-[10px] uppercase font-bold tracking-wider block">
              KYC, verification & demographics
            </span>
            <div className="space-y-2">
              <Row label="Native district" value={employee.home_district} />
              <Row
                label="Native village"
                value={
                  [employee.home_village, employee.home_mandal].filter(Boolean).join(', ') || null
                }
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-stone-500">Blood group:</span>
                {employee.blood_group ? (
                  <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 font-bold rounded text-[10px] border border-rose-200">
                    {employee.blood_group}
                  </span>
                ) : (
                  <span className="text-stone-400 text-[11px]">Not recorded</span>
                )}
              </div>
              <Row label="Gender" value={employee.gender} />
              <Row label="Date of birth" value={employee.date_of_birth} />
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-200">
                <span className="text-stone-500">Aadhaar (UIDAI):</span>
                {aadhaar ? (
                  <span className="font-bold text-stone-900 flex items-center gap-1">
                    {aadhaar}
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  </span>
                ) : (
                  <span className="text-stone-400 text-[11px]">Not on file</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Section 2 */}
      <Section
        n="2"
        tone="emerald"
        title="Attendance, Biometrics & Shift Records"
        subtitle="Punch records and the leave ledger for the current calendar month"
        badge={
          attendanceLoading ? (
            <span className="text-[11px] text-stone-400 inline-flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading
            </span>
          ) : recordedDays > 0 ? (
            <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 text-xs">
              Monthly rate: {((presentDays / recordedDays) * 100).toFixed(1)}%
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded bg-stone-100 text-stone-500 font-semibold text-[11px]">
              No days recorded yet
            </span>
          )
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi label="Today's punch status">
            {todayRow?.check_in ? (
              <>
                <span className="text-base font-bold text-emerald-700 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {todayRow.check_in} – {todayRow.check_out || 'still in'}
                </span>
                <p className="text-[10px] text-stone-400 font-medium">
                  Logged: {todayRow.mission_hours ? `${todayRow.mission_hours}h` : '—'} ·{' '}
                  {todayRow.verified ? 'Verified' : 'Unverified'}
                </p>
              </>
            ) : (
              <>
                <span className="text-base font-bold text-stone-500 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {todayRow?.status || 'No punch'}
                </span>
                <p className="text-[10px] text-stone-400 font-medium">
                  Nothing recorded on the gateway today
                </p>
              </>
            )}
          </Kpi>

          <Kpi label="Days present">
            <span className="text-xl font-bold text-stone-900 block">
              {presentDays} / {recordedDays || 0} days
            </span>
            <p className="text-[10px] text-stone-400">Current calendar month</p>
          </Kpi>

          <Kpi label="Leave & absence">
            <div className="flex items-center gap-1.5 pt-0.5">
              <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">
                Leave: {leaveDays}
              </span>
              <span className="px-1.5 py-0.5 bg-stone-200 text-stone-800 rounded font-bold text-[10px]">
                Absent: {absentDays}
              </span>
            </div>
            <p className="text-[10px] text-stone-400">
              Balances are not tracked in the roster yet
            </p>
          </Kpi>

          <Kpi label="Hours logged">
            <span className="text-xl font-bold text-stone-900 block">
              {monthlyRow?.totalHours ?? 0} h
            </span>
            <p className="text-[10px] text-stone-400">Across the month to date</p>
          </Kpi>
        </div>

        <div className="border border-stone-200 rounded-xl overflow-hidden">
          <div className="bg-stone-50 p-2.5 px-3 border-b border-stone-200 flex items-center justify-between gap-2">
            <span className="font-bold text-stone-700 text-xs inline-flex items-center gap-1.5">
              <CalendarCheck className="w-3.5 h-3.5 text-stone-400" />
              Recent shift & biometric history
            </span>
            <span className="text-[10px] text-stone-400">
              From the attendance registry
            </span>
          </div>

          {history.length === 0 ? (
            <p className="py-8 text-center text-[11px] text-stone-400">
              No attendance recorded for {employee.name} this month.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5">Date &amp; day</th>
                    <th className="p-2.5 text-right">Attendance status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-800">
                  {history.map((log) => (
                    <tr key={log.date} className="hover:bg-stone-50/60">
                      <td className="p-2.5 font-medium">
                        <span className="font-bold text-stone-900">{log.date}</span>
                        <span className="text-stone-400 text-[10px] ml-1.5">({log.day})</span>
                      </td>
                      <td className="p-2.5 text-right">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            STATUS_TONES[log.status] || STATUS_TONES.ABSENT
                          }`}
                        >
                          {log.status === 'PRESENT' ? '✓ Present' : log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Section>

      {/* Section 3 */}
      <Section
        n="3"
        tone="amber"
        title="Payout Rates & Banking"
        subtitle="What this employee is paid per completed task, and where the money goes"
        badge={
          <span className="px-2.5 py-1 rounded bg-stone-100 text-stone-800 font-bold text-xs">
            Per-task rates
          </span>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi label="New land">
            <span className="text-xl font-bold text-stone-900 block">
              {rate(employee.new_land_price, { abbreviate: false })}
            </span>
            <p className="text-[10px] text-stone-400">Per land brought in</p>
          </Kpi>
          <Kpi label="Verification">
            <span className="text-xl font-bold text-stone-900 block">
              {rate(employee.verification_price, { abbreviate: false })}
            </span>
            <p className="text-[10px] text-stone-400">Per verified land</p>
          </Kpi>
          <Kpi label="Buyer visit">
            <span className="text-xl font-bold text-stone-900 block">
              {rate(employee.buyer_visit_price, { abbreviate: false })}
            </span>
            <p className="text-[10px] text-stone-400">Per accompanied visit</p>
          </Kpi>
          <Kpi label="Referral">
            <span className="text-xl font-bold text-stone-900 block">
              {rate(employee.referal_price, { abbreviate: false })}
            </span>
            <p className="text-[10px] text-stone-400">Per successful referral</p>
          </Kpi>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2.5">
            <span className="font-bold text-stone-800 text-xs flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5 text-stone-400" />
              Direct deposit details
            </span>
            <div className="p-3 bg-white rounded-lg border border-stone-200 space-y-1.5">
              <Row label="Bank name" value={employee.bank_name} />
              <div className="flex items-center justify-between gap-2">
                <span className="text-stone-500">Account number:</span>
                {account ? (
                  <span className="font-bold text-stone-900">{account}</span>
                ) : (
                  <span className="text-stone-400 text-[11px]">Not on file</span>
                )}
              </div>
              <Row label="IFSC code" value={employee.ifsc_code} />
            </div>
          </div>

          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2.5">
            <span className="font-bold text-stone-800 text-xs flex items-center gap-1.5">
              <IndianRupee className="w-3.5 h-3.5 text-stone-400" />
              Digital payment handles
            </span>
            <div className="p-3 bg-white rounded-lg border border-stone-200 space-y-1.5">
              <Row label="UPI ID" value={employee.upi_id} />
              <Row label="PhonePe" value={employee.phone_pe_number} />
              <Row label="Google Pay" value={employee.google_pay_number} />
            </div>
            <p className="text-[10px] text-stone-500 bg-white border border-stone-200 rounded-lg px-2 py-1.5">
              A monthly CTC, PF and professional-tax breakdown is not held in the
              employee record, so none is shown here.
            </p>
          </div>
        </div>
      </Section>

      {showFullModal && (
        <EmployeeProfileModal
          employee={employee}
          onClose={() => setShowFullModal(false)}
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

const SECTION_TONES = {
  blue: 'bg-blue-100 text-blue-800',
  emerald: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
};

function Section({ n, tone, title, subtitle, badge, children }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 border-b border-stone-200 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold shrink-0 ${
              SECTION_TONES[tone] || SECTION_TONES.blue
            }`}
          >
            {n}
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-stone-900 text-sm">{title}</h4>
            <p className="text-stone-500 text-xs">{subtitle}</p>
          </div>
        </div>
        <div className="shrink-0">{badge}</div>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  const displayValue =
    typeof value === 'string' || typeof value === 'number' ? value : null;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-stone-500 shrink-0">{label}:</span>
      {displayValue ? (
        <span className="font-semibold text-stone-800 truncate text-right">{displayValue}</span>
      ) : (
        <span className="text-stone-400 text-[11px]">Not recorded</span>
      )}
    </div>
  );
}

function IconRow({ icon: Icon, label, value, mono }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-stone-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <span className="text-stone-500 text-[10px] block">{label}:</span>
        {value ? (
          <span className={`text-stone-900 break-all ${mono ? 'font-bold' : 'font-semibold'}`}>
            {value}
          </span>
        ) : (
          <span className="text-stone-400 text-[11px]">Not recorded</span>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, children }) {
  return (
    <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
      <span className="text-stone-500 text-[10px] uppercase font-bold block">{label}</span>
      {children}
    </div>
  );
}
