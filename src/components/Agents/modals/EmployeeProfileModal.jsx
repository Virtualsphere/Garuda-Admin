import { useState, useEffect, useMemo } from 'react';
import {
  X,
  User,
  CalendarCheck,
  IndianRupee,
  Network,
  Phone,
  Mail,
  Building2,
  MapPin,
  Landmark,
  Loader2,
  CheckCircle2,
  Users,
} from 'lucide-react';

import PersonAvatar from '../common/PersonAvatar';
import CallButton from '../common/CallButton';
import useAgentTeams from '../../../hooks/useAgentTeams';
import agentCoordinationService from '../../../services/agentCoordinationService';
import agentLeadService from '../../../services/agentLeadService';
import attendanceService from '../../../services/attendanceService';
import { cadreMeta, formatINR } from '../agentConstants';

const DEPARTMENT = 'agents';
const AGENTS_PER_EXECUTIVE = 500;
const EMP_CODE = (id) => `EMP-${String(id ?? '').padStart(3, '0')}`;

const TABS = [
  { key: 'personal', label: 'Personal', icon: User },
  { key: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { key: 'budget', label: 'Payout', icon: IndianRupee },
  { key: 'assignments', label: 'Assignments', icon: Network },
];

const maskAadhaar = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 4 ? `XXXX-XXXX-${digits.slice(-4)}` : null;
};

const maskAccount = (value) => {
  const raw = String(value || '').trim();
  return raw.length >= 4 ? `${'X'.repeat(Math.max(4, raw.length - 4))}${raw.slice(-4)}` : null;
};

/**
 * One employee's full record, in four tabs.
 *
 * Assignments is the tab that does not exist anywhere else: it answers "what is
 * this person actually carrying right now" by joining their squad in each wing,
 * their agent load against the 500 quota, and the recruitment leads allotted to
 * them. The other three mirror the Personal page so the modal is usable from
 * anywhere without navigating away.
 */
export default function EmployeeProfileModal({ employee, onClose }) {
  const [tab, setTab] = useState('personal');

  const recruitment = useAgentTeams('recruitment');
  const coordination = useAgentTeams('coordination');

  const [agentLoad, setAgentLoad] = useState(null);
  const [leadCount, setLeadCount] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!employee?.id) return undefined;
    let cancelled = false;
    const now = new Date();

    setLoading(true);
    Promise.allSettled([
      agentCoordinationService.getLoad(),
      agentLeadService.getLeads({ assignedEmployeeId: employee.id }),
      attendanceService.getMonthly({
        role: DEPARTMENT,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      }),
    ]).then(([loadResult, leadResult, monthlyResult]) => {
      if (cancelled) return;

      if (loadResult.status === 'fulfilled') {
        const r = loadResult.value.result || loadResult.value.data || {};
        setAgentLoad(r.counts?.[String(employee.id)] ?? 0);
      }

      if (leadResult.status === 'fulfilled') {
        const rows = leadResult.value.result || leadResult.value.data || [];
        setLeadCount(Array.isArray(rows) ? rows.length : 0);
      }

      if (monthlyResult.status === 'fulfilled') {
        const rows = monthlyResult.value.data || monthlyResult.value.result || [];
        setMonthly(
          (Array.isArray(rows) ? rows : []).find(
            (r) => String(r.id) === String(employee.id)
          ) || null
        );
      }

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [employee?.id]);

  const squadIn = useMemo(() => {
    const find = (wing) =>
      wing.teams.find((t) =>
        t.memberIds.some((id) => String(id) === String(employee?.id))
      ) ||
      wing.teams.find((t) => String(t.teamLeaderId) === String(employee?.id)) ||
      null;

    return {
      recruitment: find(recruitment),
      coordination: find(coordination),
    };
  }, [recruitment, coordination, employee?.id]);

  if (!employee) return null;

  const cadre = cadreMeta(employee.cadre);
  const isOnline = String(employee.duty_status || '').toLowerCase() === 'online';
  const present = monthly?.presentDays ?? 0;
  const leave = monthly?.leaveDays ?? 0;
  const absent = monthly?.absentDays ?? 0;
  const recorded = present + leave + absent;

  return (
    <div
      className="fixed inset-0 z-[1000] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-xs"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-stone-200 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <PersonAvatar
              name={employee.name}
              photo={employee.photo}
              size={52}
              badge={
                <span
                  className={`block w-3.5 h-3.5 rounded-full border-2 border-white ${
                    isOnline ? 'bg-emerald-500' : 'bg-stone-400'
                  }`}
                />
              }
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-stone-900 text-sm truncate">{employee.name}</h3>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border ${cadre.tone}`}
                >
                  {cadre.short}
                </span>
                <span className="text-[10px] text-stone-400">{EMP_CODE(employee.id)}</span>
              </div>
              <p className="text-[11px] text-stone-500 truncate">
                {employee.role}
                {employee.secondary_role ? ` · ${employee.secondary_role}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <CallButton
              phone={employee.phone}
              recordName={employee.name}
              recordId={employee.id}
              recordType="STAFF"
              variant="outline"
            />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 border-b border-stone-200 flex gap-1 overflow-x-auto shrink-0">
          {TABS.map((t) => {
            const TabIcon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`py-2 px-3 font-medium border-b-2 inline-flex items-center gap-1.5 shrink-0 transition-colors ${
                  tab === t.key
                    ? 'border-[#2563EB] text-[#2563EB] font-bold'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50/40">
          {tab === 'personal' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card title="Communication">
                <IconRow icon={Phone} label="Mobile" value={employee.phone} />
                <IconRow icon={Phone} label="Alternate" value={employee.other_phone} />
                <IconRow icon={Mail} label="Email" value={employee.email} />
                <IconRow icon={Building2} label="Base station" value={employee.assigned_hub} />
              </Card>

              <Card title="Identity & KYC">
                <Row label="Native district" value={employee.home_district} />
                <Row
                  label="Native village"
                  value={[employee.home_village, employee.home_mandal].filter(Boolean).join(', ')}
                />
                <Row label="Blood group" value={employee.blood_group} />
                <Row label="Gender" value={employee.gender} />
                <Row label="Date of birth" value={employee.date_of_birth} />
                <Row label="Aadhaar" value={maskAadhaar(employee.aadhar_number)} />
              </Card>

              <Card title="Posting">
                <IconRow
                  icon={MapPin}
                  label="Work location"
                  value={[employee.work_village, employee.work_mandal, employee.work_district]
                    .filter(Boolean)
                    .join(', ')}
                />
                <Row label="Employment status" value={employee.status} />
                <Row
                  label="Contract"
                  value={
                    employee.contract_start_date
                      ? `${employee.contract_start_date} → ${
                          employee.contract_end_date || 'open'
                        }`
                      : null
                  }
                />
              </Card>

              <Card title="Address">
                <Row label="House no." value={employee.house_no} />
                <Row label="Colony" value={employee.colony} />
                <Row label="Address" value={employee.address} />
                {employee.about && (
                  <p className="text-[11px] text-stone-600 pt-1 border-t border-stone-200">
                    {employee.about}
                  </p>
                )}
              </Card>
            </div>
          )}

          {tab === 'attendance' && (
            <div className="space-y-3">
              {loading ? (
                <Loading />
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Tile label="Present" value={present} tone="text-emerald-700" />
                    <Tile label="Leave" value={leave} tone="text-rose-700" />
                    <Tile label="Absent" value={absent} />
                    <Tile label="Hours" value={`${monthly?.totalHours ?? 0} h`} />
                  </div>

                  <Card title="This calendar month">
                    <Row
                      label="Attendance rate"
                      value={
                        recorded > 0
                          ? `${((present / recorded) * 100).toFixed(1)}% of ${recorded} recorded day(s)`
                          : null
                      }
                    />
                    <Row label="Duty status" value={isOnline ? 'Online' : 'Offline'} />
                  </Card>

                  {recorded === 0 && (
                    <p className="text-[11px] text-stone-500 bg-white border border-stone-200 rounded-lg px-2.5 py-2">
                      No attendance has been recorded for {employee.name} this month.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {tab === 'budget' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Tile
                  label="New land"
                  value={formatINR(employee.new_land_price, { abbreviate: false })}
                />
                <Tile
                  label="Verification"
                  value={formatINR(employee.verification_price, { abbreviate: false })}
                />
                <Tile
                  label="Buyer visit"
                  value={formatINR(employee.buyer_visit_price, { abbreviate: false })}
                />
                <Tile
                  label="Referral"
                  value={formatINR(employee.referal_price, { abbreviate: false })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Card title="Direct deposit" icon={Landmark}>
                  <Row label="Bank" value={employee.bank_name} />
                  <Row label="Account" value={maskAccount(employee.account_number)} />
                  <Row label="IFSC" value={employee.ifsc_code} />
                </Card>

                <Card title="Digital handles">
                  <Row label="UPI ID" value={employee.upi_id} />
                  <Row label="PhonePe" value={employee.phone_pe_number} />
                  <Row label="Google Pay" value={employee.google_pay_number} />
                </Card>
              </div>

              <p className="text-[10px] text-stone-500 bg-white border border-stone-200 rounded-lg px-2.5 py-2">
                Pay is recorded as per-task rates. No monthly CTC, PF or professional-tax
                breakdown is held in the employee record, so none is shown.
              </p>
            </div>
          )}

          {tab === 'assignments' && (
            <div className="space-y-3">
              {loading || recruitment.loading || coordination.loading ? (
                <Loading />
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <SquadCard
                      wing="Recruitment & telecalling"
                      team={squadIn.recruitment}
                      employeeId={employee.id}
                      quota={9}
                    />
                    <SquadCard
                      wing="Agents coordination"
                      team={squadIn.coordination}
                      employeeId={employee.id}
                      quota={10}
                    />
                  </div>

                  <Card title="Allotted capacity" icon={Users}>
                    <div className="space-y-2.5">
                      <Quota
                        label="Agents under coordination"
                        value={agentLoad ?? 0}
                        max={AGENTS_PER_EXECUTIVE}
                      />
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-200">
                        <span className="text-stone-500">Recruitment leads allotted:</span>
                        <span className="font-bold text-stone-900">
                          {leadCount ?? 0} lead(s)
                        </span>
                      </div>
                    </div>
                  </Card>

                  {!squadIn.recruitment && !squadIn.coordination && (
                    <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                      {employee.name} is not in a squad in either wing. Place them from
                      Management → Hierarchy &amp; Teams.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-stone-200 bg-white flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-900 text-white font-semibold text-xs hover:bg-stone-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Local pieces ─────────────────────────────────────────────── */

function Loading() {
  return (
    <div className="py-12 flex items-center justify-center">
      <span className="inline-flex items-center gap-2 text-xs font-semibold text-stone-500">
        <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Loading…
      </span>
    </div>
  );
}

function Card({ title, icon: Icon, children }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-3 space-y-2">
      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {title}
      </span>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-stone-500 shrink-0">{label}:</span>
      {value ? (
        <span className="font-semibold text-stone-800 truncate text-right">{value}</span>
      ) : (
        <span className="text-stone-400 text-[11px]">Not recorded</span>
      )}
    </div>
  );
}

function IconRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-stone-400 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <span className="text-stone-500 text-[10px] block">{label}:</span>
        {value ? (
          <span className="font-semibold text-stone-900 break-all">{value}</span>
        ) : (
          <span className="text-stone-400 text-[11px]">Not recorded</span>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, tone = 'text-stone-900' }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-2.5">
      <span className="text-[10px] font-bold text-stone-500 uppercase block">{label}</span>
      <span className={`text-base font-black ${tone}`}>{value}</span>
    </div>
  );
}

function SquadCard({ wing, team, employeeId, quota }) {
  const isLeader = team && String(team.teamLeaderId) === String(employeeId);

  return (
    <div
      className={`rounded-xl border p-3 space-y-2 ${
        team ? 'bg-white border-stone-200' : 'bg-stone-50 border-stone-200'
      }`}
    >
      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
        {wing}
      </span>

      {team ? (
        <>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold text-stone-900 text-xs truncate">{team.name}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-stone-500">Role in squad:</span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                isLeader
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-stone-100 text-stone-700'
              }`}
            >
              {isLeader ? 'Team leader' : 'Executive'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-stone-500">Squad strength:</span>
            <span className="font-bold text-stone-900">
              {team.memberIds.length} / {quota}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-stone-500">Led by:</span>
            <span className="font-semibold text-stone-800 truncate">{team.teamLeaderName}</span>
          </div>
        </>
      ) : (
        <p className="text-[11px] text-stone-400 py-2">Not placed in this wing.</p>
      )}
    </div>
  );
}

function Quota({ label, value, max }) {
  const pct = Math.min(100, Math.round((value / (max || 1)) * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-stone-500">{label}:</span>
        <span className="font-bold text-stone-900">
          {value} / {max}
        </span>
      </div>
      <div className="w-full bg-stone-200 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            pct >= 100 ? 'bg-rose-600' : pct >= 80 ? 'bg-amber-500' : 'bg-[#2563EB]'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
