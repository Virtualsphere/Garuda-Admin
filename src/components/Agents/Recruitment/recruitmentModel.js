import { normaliseLeadSource } from '../agentConstants';

/**
 * The recruitment desk's view of a lead.
 *
 * The API returns `agent_candidate` rows in snake_case, with the people and
 * villages attached to them as nested objects. Every tab on this desk reads the
 * same handful of facts — where the lead lives, who owns it, how the last call
 * went — so they are normalised once, here, instead of each tab picking the row
 * apart its own way. That is what keeps "Not Lifted" meaning the same thing on
 * the Calls tab, in the recovery hub and in the tab badge.
 *
 * Kept free of React so the rules can be checked from plain Node.
 */

/* ── Vocabulary ───────────────────────────────────────────────── */

/** The two answers that mean "we dialled and nobody spoke to us". */
export const NOT_LIFTED_STATUSES = ['Not Lifted', 'No Answer'];

/** Everything the recovery hub works: unreached, or a number that does not work. */
export const RECOVERY_STATUSES = [...NOT_LIFTED_STATUSES, 'Invalid Number'];

/** Pipeline stages that mean "said yes, not yet an agent" — the Interested queue. */
export const INTERESTED_STAGES = ['INTERESTED', 'VILLAGE_INTEREST', 'SELECTED', 'OFFICE_VISIT'];

/** Stages that end a lead; recovery never resurrects these. */
export const CLOSED_STAGES = [
  'JOINED',
  'NOT_INTERESTED',
  'REJECTED',
  'DUPLICATE',
  'WITHDRAWN',
  'DIVERTED',
  'NOT_RESPONDING',
];

export const RECOVERY_WHATSAPP_TEMPLATES = [
  {
    id: 'missed_call',
    title: 'Missed Call Alert (Agent Interest)',
    templateName: 'Missed Call Alert',
    text: (name, mandal) =>
      `Namaskaram ${name} garu, our team tried calling you regarding your Gram Agent registration inquiry for ${
        mandal || 'your area'
      }. Please let us know when you are free to speak, or reply to this message.`,
  },
  {
    id: 'brochure',
    title: 'Program Brochure & Benefits',
    templateName: 'Gram Agent Brochure',
    text: (name) =>
      `Namaskaram ${name} garu, thank you for your interest in Gram Agent. Here are the program highlights and earnings structure. We look forward to connecting with you.`,
  },
  {
    id: 'invalid_num',
    title: 'Alternate Contact Number Request',
    templateName: 'Alternate Number Request',
    text: (name) =>
      `Hello ${name} garu, we tried reaching your phone number but could not connect over the cellular network. Please reply with an active alternate mobile number so our team can assist you.`,
  },
  {
    id: 'final_warning',
    title: 'Final Follow-up (Pre-Dump Warning)',
    templateName: 'Final Recovery Notice',
    text: (name) =>
      `Namaskaram ${name} garu, we have made multiple attempts to reach you regarding Gram Agent onboarding. If you are still interested, please reply today. Otherwise, your inquiry will be marked as no-response and closed.`,
  },
  {
    id: 'custom',
    title: 'Custom Follow-up Message',
    templateName: 'Custom Follow-up',
    text: (name) => `Namaskaram ${name} garu, `,
  },
];

/**
 * The templates offered from the call workspace. Wording differs slightly from
 * the recovery hub's (which is for people who never picked up), so the two lists
 * are kept apart rather than one pretending to serve both.
 */
export const CALL_WHATSAPP_TEMPLATES = [
  {
    id: 'missed_call',
    title: 'Missed Call Alert',
    templateName: 'Missed Call Alert',
    text: (name) =>
      `Namaskaram ${name} garu, we tried reaching you regarding your interest in becoming a Gram Agent. Please call us back or let us know a convenient time to speak.`,
  },
  {
    id: 'brochure',
    title: 'Agent Program & Brochure',
    templateName: 'Gram Agent Brochure',
    text: (name, location) =>
      `Namaskaram ${name} garu, here is the official Gram Agent Brochure and earning potential details for ${location || 'your mandal'}. Review and let us know if you wish to enroll.`,
  },
  {
    id: 'alternate_num',
    title: 'Alternate Number Request (Invalid Line)',
    templateName: 'Alternate Number Request',
    text: (name) =>
      `Hello ${name} garu, your phone number appears to be invalid or uncontactable on the cellular network. Please reply with an active alternate calling number so we can guide you.`,
  },
  {
    id: 'final_notice',
    title: 'Final Recovery Notice (Pre-Dump Warning)',
    templateName: 'Final Recovery Notice',
    text: (name) =>
      `Namaskaram ${name} garu, this is our final follow-up for your Gram Agent registration. If we receive no response, your inquiry will be marked as unresponsive and closed.`,
  },
  {
    id: 'custom',
    title: 'Custom Message',
    templateName: 'Custom Follow-up',
    text: (name) => `Namaskaram ${name} garu, `,
  },
];

export const PREDEFINED_DUMP_REASONS = [
  'No response after multiple calls & WhatsApp messages',
  'Phone continuously switched off / unreachable for >48 hours',
  'WhatsApp trail delivered & read but no response',
  'Invalid phone number and unable to get alternate contact',
  'Candidate confirmed not interested / requested to stop calling',
];

/* ── Small formatters ─────────────────────────────────────────── */

export const leadCode = (id) => `LD-${String(id ?? '').padStart(4, '0')}`;

/** Local calendar date of a timestamp, as YYYY-MM-DD. */
export const localDate = (value = new Date()) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const todayISO = () => localDate();

export const tomorrowISO = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return localDate(d);
};

/** "12:30 PM" — the clock face of a timestamp, or '' when there is none. */
export const clockOf = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

/** "23 Sep" style date for chips; the raw string if it does not parse. */
export const shortDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

/** "23 Sep · 12:30 PM" */
export const stampOf = (value) => {
  if (!value) return '—';
  const when = shortDate(value);
  const time = clockOf(value);
  return time ? `${when} · ${time}` : when;
};

/** `Squad 1` out of `Squad 1 — Arjun`; the label a squad wears in a picker. */
export const squadLabel = (team) =>
  String(team?.name || '')
    .split('—')[0]
    .trim() || `Squad ${team?.id ?? ''}`;

export const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';

export const digitsOf = (value) => String(value || '').replace(/\D/g, '');

export const sameId = (a, b) =>
  a !== undefined && a !== null && b !== undefined && b !== null && String(a) === String(b);

/* ── Lead normalisation ───────────────────────────────────────── */

const idOrUndefined = (value) =>
  value === null || value === undefined || value === '' ? undefined : String(value);

const nameOfEmployee = (employeeById, id) =>
  id === null || id === undefined ? undefined : employeeById?.get(String(id))?.name;

/**
 * A backend lead row → the shape every recruitment tab reads.
 *
 * `employeeById` is optional; when given it fills in the *names* of people the
 * row only references by id (who dialled last, who owns a follow-up). Ids stay
 * as strings on purpose: `<select>` values are strings, and this codebase
 * compares ids by `String()` everywhere.
 */
export function normaliseLead(row, employeeById) {
  const interests = Array.isArray(row.interests) ? row.interests : [];
  const trail = Array.isArray(row.whatsappTrail) ? row.whatsappTrail : [];

  return {
    id: row.id,
    code: leadCode(row.id),
    raw: row,

    name: row.name || '',
    phone: row.phone || '',
    photo: row.photo || '',

    state: row.state || '',
    district: row.district || '',
    mandal: row.mandal || '',
    nativeVillage: row.village || '',

    source: normaliseLeadSource(row.lead_source),
    createdAt: row.created_at,
    stage: row.status,

    // Latest call
    lastCallStatus: row.last_call_status || undefined,
    lastCallNote: row.last_call_note || undefined,
    callAttempts: Number(row.call_attempts) || 0,
    lastAttemptAt: row.last_attempt_at || undefined,
    lastAttemptDate: row.last_attempt_at ? localDate(row.last_attempt_at) : undefined,
    lastAttemptTime: row.last_attempt_at ? clockOf(row.last_attempt_at) : undefined,
    lastAttemptCaller: nameOfEmployee(employeeById, row.last_attempt_by),
    lastAttemptBy: idOrUndefined(row.last_attempt_by),

    // Promised call-back
    followUpDate: row.follow_up_date || undefined,
    followUpTime: row.follow_up_time || undefined,
    followUpBy: idOrUndefined(row.follow_up_by),
    followUpCaller: nameOfEmployee(employeeById, row.follow_up_by),

    // Ownership
    assignedTeamId: idOrUndefined(row.assigned_team_id),
    assignedTeamName: row.assigned_team_name || undefined,
    assignedTelecallerId: idOrUndefined(row.assigned_employee_id),
    assignedTelecallerName:
      row.assignedTelecaller?.name || nameOfEmployee(employeeById, row.assigned_employee_id),
    teamLeaderId: idOrUndefined(row.team_leader_id),
    allottedAt: row.allotted_at || undefined,

    // The desk shows "forwarded by" for a lead that landed in recovery: whoever
    // last dialled it, falling back to whoever owns it.
    forwardedByCaller:
      nameOfEmployee(employeeById, row.last_attempt_by) || row.assignedTelecaller?.name,

    // Referral
    referringAgent: row.referringAgent || null,
    referringAgentName: row.referringAgent?.name,
    referringAgentPhone: row.referringAgent?.phone,

    interests,
    interestedVillages: interests.map((i) => i.village).filter(Boolean),

    whatsappTrail: trail.map((w) => ({
      id: w.id,
      templateName: w.template_name,
      messageText: w.message_text,
      sentAt: w.sent_at,
      sentBy: w.sender?.name,
      deliveryStatus: w.delivery_status,
    })),

    // Recovery
    isDumped: row.status === 'NOT_RESPONDING',
    dumpedAt: row.dumped_at || undefined,
    dumpedBy: idOrUndefined(row.dumped_by),
    dumpReason: row.dump_reason || undefined,

    convertedAgentId: row.converted_agent_id || undefined,
  };
}

/* ── Queue rules (shared by tabs and badges) ──────────────────── */

export const isNotLifted = (lead) => NOT_LIFTED_STATUSES.includes(lead.lastCallStatus);
export const isInvalid = (lead) => lead.lastCallStatus === 'Invalid Number';
export const isRecoverable = (lead) => RECOVERY_STATUSES.includes(lead.lastCallStatus);

/** Never dialled — the "First Calls" queue. */
export const isFirstCall = (lead) => !lead.lastCallStatus || lead.callAttempts === 0;

/**
 * Leads the recovery hub is responsible for: unreached or invalid, and not yet
 * closed out. A lead that later connected drops out because its last status is
 * no longer one of the recovery ones.
 */
export const inRecoveryPool = (lead) =>
  isRecoverable(lead) && !CLOSED_STAGES.includes(lead.stage);
