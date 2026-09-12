// Shared vocabulary for the Agents section. Kept in one module because these
// lists are read by the maps, the tabs, the drawer and several modals — unlike
// section-local tab labels, which stay in their owning component.
//
// Every list mirrors an enum the backend validates against; changing a `key`
// here without changing the model will produce 400s.

/* ── Observations ─────────────────────────────────────────────── */

export const OBSERVATION_FREQUENCIES = [
  { key: 'ONE_TIME', label: 'One time' },
  { key: 'WEEKLY', label: 'Weekly' },
  { key: '15_DAYS', label: 'Every 15 days' },
  { key: 'MONTHLY', label: 'Monthly' },
  { key: 'ON_REQUEST', label: 'On request' },
];

export const OBSERVATION_STATUS_LABELS = {
  ACTIVE: 'Active',
  INFORMATION_DUE: 'Information due',
  UPDATE_SUBMITTED: 'Update submitted',
  VERIFICATION_PENDING: 'Verification pending',
  UPDATED: 'Updated',
  UNABLE_TO_VERIFY: 'Unable to verify',
  CLOSED: 'Closed',
};

/* ── Leads ────────────────────────────────────────────────────── */

// The only sources a recruitment lead may carry; anything else is a
// data-entry mistake. Stored verbatim in `agent_candidate.lead_source`.
export const LEAD_SOURCES = ['Meta Ads', 'Field Executive', 'Agent', 'App', 'MyOperator'];

export const LEAD_SOURCE_TONES = {
  'Meta Ads': 'bg-blue-50 text-blue-700 border-blue-200',
  'Field Executive': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Agent: 'bg-purple-50 text-purple-700 border-purple-200',
  App: 'bg-amber-50 text-amber-700 border-amber-200',
  MyOperator: 'bg-stone-100 text-stone-700 border-stone-200',
};

/**
 * Leads created before the five canonical sources existed carry SCREAMING_CASE
 * values. Map the ones that have an unambiguous equivalent so history renders
 * and filters correctly; leave anything else readable but unmapped rather than
 * guessing it into the wrong bucket.
 */
const LEGACY_SOURCE_ALIASES = {
  META_ADS: 'Meta Ads',
  AGENT_REFERRAL: 'Agent',
  FIELD_VISIT: 'Field Executive',
  EMPLOYEE_REFERRAL: 'Field Executive',
  INBOUND_CALL: 'MyOperator',
  INBOUND_ENQUIRY: 'MyOperator',
};

export const normaliseLeadSource = (raw) => {
  if (!raw) return 'MyOperator';
  if (LEAD_SOURCES.includes(raw)) return raw;
  if (LEGACY_SOURCE_ALIASES[raw]) return LEGACY_SOURCE_ALIASES[raw];
  // Unrecognised: show it as written rather than mislabelling it.
  return String(raw).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
};

/* ── Enquiries ────────────────────────────────────────────────── */

export const ENQUIRY_CALLER_TYPES = [
  { key: 'NEW_CANDIDATE', label: 'New candidate' },
  { key: 'EXISTING_CANDIDATE', label: 'Existing candidate' },
  { key: 'EXISTING_AGENT', label: 'Existing agent' },
  { key: 'UNKNOWN', label: 'Unknown' },
];

export const ENQUIRY_TYPES = [
  { key: 'BECOME_AGENT', label: 'Wants to become an agent' },
  { key: 'VILLAGE_VACANCY', label: 'Village vacancy question' },
  { key: 'INTERESTED_VILLAGE', label: 'Interested in a village' },
  { key: 'JOINING', label: 'Joining process' },
  { key: 'AGENT_SUPPORT', label: 'Agent support' },
  { key: 'OTHER', label: 'Other' },
];

export const ENQUIRY_STATUSES = [
  { key: 'NEW', label: 'New', variant: 'blue' },
  { key: 'CALLBACK_PENDING', label: 'Callback pending', variant: 'yellow' },
  { key: 'IN_PROGRESS', label: 'In progress', variant: 'orange' },
  { key: 'RESOLVED', label: 'Resolved', variant: 'green' },
  { key: 'CONVERTED_TO_LEAD', label: 'Converted to lead', variant: 'purple' },
  { key: 'CLOSED', label: 'Closed', variant: 'gray' },
];

export const TERMINAL_ENQUIRY_STATUSES = ['RESOLVED', 'CONVERTED_TO_LEAD', 'CLOSED'];

/* ── Finance ──────────────────────────────────────────────────── */

export const TRANSACTION_TYPES = [
  { key: 'MEMBERSHIP_FEE', label: 'Membership fee', direction: 'IN' },
  { key: 'COMMISSION', label: 'Commission', direction: 'OUT' },
  { key: 'INCENTIVE', label: 'Incentive', direction: 'OUT' },
  { key: 'ADVANCE', label: 'Advance', direction: 'OUT' },
  { key: 'ADVANCE_RECOVERY', label: 'Advance recovery', direction: 'IN' },
  { key: 'PENALTY', label: 'Penalty', direction: 'IN' },
  { key: 'REFUND', label: 'Refund', direction: 'OUT' },
  { key: 'OTHER', label: 'Other', direction: 'IN' },
];

export const TRANSACTION_STATUSES = [
  { key: 'DRAFT', label: 'Draft', variant: 'gray' },
  { key: 'PENDING', label: 'Pending', variant: 'yellow' },
  { key: 'APPROVED', label: 'Approved', variant: 'blue' },
  { key: 'PAID', label: 'Paid', variant: 'green' },
  { key: 'PARTIAL', label: 'Partial', variant: 'orange' },
  { key: 'REJECTED', label: 'Rejected', variant: 'red' },
  { key: 'REFUNDED', label: 'Refunded', variant: 'purple' },
];

// Money has actually moved in these states; anything else is a claim. The
// server applies the same rule when it recomputes an agent's running totals.
export const SETTLED_TRANSACTION_STATUSES = ['PAID', 'PARTIAL'];

export const PAYMENT_MODES = [
  { key: 'CASH', label: 'Cash' },
  { key: 'UPI', label: 'UPI' },
  { key: 'BANK_TRANSFER', label: 'Bank transfer' },
  { key: 'CHEQUE', label: 'Cheque' },
  { key: 'ADJUSTMENT', label: 'Adjustment' },
];

/* ── Agents ───────────────────────────────────────────────────── */

export const AGENT_STATUSES = [
  { key: 'ACTIVE', label: 'Active', variant: 'green' },
  { key: 'INACTIVE', label: 'Inactive', variant: 'gray' },
  { key: 'SUSPENDED', label: 'Suspended', variant: 'yellow' },
  { key: 'TERMINATED', label: 'Terminated', variant: 'red' },
];

export const MEMBERSHIP_STATUSES = [
  { key: 'PAID', label: 'Paid', variant: 'green' },
  { key: 'PENDING', label: 'Pending', variant: 'yellow' },
  { key: 'EXEMPT', label: 'Exempt', variant: 'gray' },
];

/* ── Personnel ────────────────────────────────────────────────── */

// Seniority bands, distinct from `role` (what somebody does). Stored
// free-form in `employees.cadre` because the ladder is an org decision, not a
// schema one — this list is what the UI offers and colours.
export const CADRES = [
  { value: 'Cadre Level 5 - Leadership / Director', label: 'Level 5 — Leadership / Director', short: 'Leadership', tone: 'bg-amber-100 text-amber-900 border-amber-300' },
  { value: 'Cadre Level 4 - Department Manager', label: 'Level 4 — Department Manager', short: 'Manager', tone: 'bg-purple-100 text-purple-900 border-purple-300' },
  { value: 'Cadre Level 3.5 - Division Responsible', label: 'Level 3.5 — Division Responsible', short: 'Division Resp', tone: 'bg-indigo-100 text-indigo-900 border-indigo-300' },
  { value: 'Cadre Level 3 - Team Leader', label: 'Level 3 — Team Leader', short: 'Team Leader', tone: 'bg-blue-100 text-blue-900 border-blue-300' },
  { value: 'Cadre Level 2 - Senior Executive', label: 'Level 2 — Senior Executive', short: 'Sr. Executive', tone: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  { value: 'Cadre Level 1 - Executive', label: 'Level 1 — Executive', short: 'Executive', tone: 'bg-stone-100 text-stone-800 border-stone-300' },
];

export const cadreMeta = (value) =>
  CADRES.find((c) => c.value === value) || {
    short: 'Unassigned',
    tone: 'bg-stone-100 text-stone-500 border-stone-200',
  };

/* ── Helpers ──────────────────────────────────────────────────── */

/** Look up the display label for a key, falling back to a readable form. */
export const labelOf = (list, key) =>
  list.find((item) => item.key === key)?.label ||
  String(key || '').replace(/_/g, ' ') ||
  '—';

/** Look up the Badge variant for a key, defaulting to neutral. */
export const variantOf = (list, key) =>
  list.find((item) => item.key === key)?.variant || 'gray';

/** Indian-format currency, abbreviated once it stops fitting in a cell. */
export const formatINR = (value, { abbreviate = true } = {}) => {
  const num = Number(value) || 0;
  if (!abbreviate) return `₹${num.toLocaleString('en-IN')}`;
  if (Math.abs(num) >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
  if (Math.abs(num) >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
  return `₹${num.toLocaleString('en-IN')}`;
};

export const AGENT_CODE = (id) => `AG${String(id ?? '').padStart(5, '0')}`;
