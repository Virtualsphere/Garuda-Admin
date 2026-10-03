// Shared vocabulary for the recruitment UI. Kept in one module because these
// lists are read by the page, the drawer and both selection modals — unlike
// section-local tab labels, which stay in their owning component.

/** Active pipeline, in the order a candidate moves through it. */
export const PIPELINE_STAGES = [
  'NEW_LEAD',
  'FIRST_CALL',
  'INTERESTED',
  'LOCATION_CHECK',
  'VILLAGE_INTEREST',
  'WAITING',
  'SELECTED',
  'OFFICE_VISIT',
  'JOINING_PROCESS',
  'JOINED',
];

/** Stages a candidate can be closed into. */
export const TERMINAL_STAGES = [
  'NOT_INTERESTED',
  'NOT_RESPONDING',
  'NOT_ELIGIBLE',
  'REJECTED',
  'DUPLICATE',
  'WITHDRAWN',
  'DIVERTED',
];

export const STAGE_LABELS = {
  NEW_LEAD: 'New lead',
  FIRST_CALL: 'First call',
  INTERESTED: 'Interested',
  LOCATION_CHECK: 'Location check',
  VILLAGE_INTEREST: 'Village interest',
  WAITING: 'Waiting',
  SELECTED: 'Selected',
  OFFICE_VISIT: 'Office visit',
  JOINING_PROCESS: 'Joining',
  JOINED: 'Joined',
  NOT_INTERESTED: 'Not interested',
  NOT_RESPONDING: 'Not responding',
  NOT_ELIGIBLE: 'Not eligible',
  REJECTED: 'Rejected',
  DUPLICATE: 'Duplicate',
  WITHDRAWN: 'Withdrawn',
  DIVERTED: 'Diverted',
};

export const POSITION_LABELS = {
  VACANT: 'Vacant',
  NATIVE_SEARCH: 'Native search',
  WAITING_CANDIDATES_AVAILABLE: 'Waiting available',
  OPEN_TO_WAITING_CANDIDATES: 'Open to waiting',
  CANDIDATE_SELECTED: 'Candidate selected',
  JOINING: 'Joining',
  FILLED: 'Filled',
};

export const INTEREST_LABELS = {
  INTERESTED: 'Interested',
  NATIVE_PRIORITY_WAIT: 'Native priority wait',
  WAITING: 'Waiting',
  VACANCY_AVAILABLE: 'Vacancy available',
  UNDER_REVIEW: 'Under review',
  SELECTED: 'Selected',
  JOINING: 'Joining',
  JOINED: 'Joined',
  WITHDRAWN: 'Withdrawn',
  REJECTED: 'Rejected',
};

export const LEAD_SOURCES = [
  'DIRECT',
  'META_ADS',
  'AGENT_REFERRAL',
  'EMPLOYEE_REFERRAL',
  'WALK_IN',
  'INBOUND_CALL',
  'FIELD_VISIT',
];

/** The next stage in the pipeline, or null at the end. */
export const nextStage = (current) => {
  const idx = PIPELINE_STAGES.indexOf(current);
  if (idx === -1 || idx === PIPELINE_STAGES.length - 1) return null;
  return PIPELINE_STAGES[idx + 1];
};

/**
 * The regions the desk has a regional office in. The Interested tab filters and
 * tallies by these, matching on the booked office's name — so "Sangareddy
 * Regional Office" and "Sangareddy RO" both count towards Sangareddy.
 */
export const REGIONAL_OFFICE_REGIONS = [
  'Mancherial',
  'Adilabad',
  'Nizamabad',
  'Karimnagar',
  'Siddipet',
  'Hanamkonda',
  'Khammam',
  'Hyderabad',
  'Nalgonda',
  'Kalwakurthy',
  'Jadcherla',
  'Sangareddy',
  'Vikarabad',
  'Medak',
  'Kamareddy',
  'Mahabubnagar',
  'Nagarkurnool',
  'Wanaparthy',
  'Gadwal',
  'Suryapet',
  'Miryalaguda',
];

/**
 * Offices a candidate can be booked in to — one per region above, so the
 * booking list and the Interested tab's office filter can never disagree.
 */
export const REGIONAL_OFFICES = [...REGIONAL_OFFICE_REGIONS]
  .sort((a, b) => a.localeCompare(b))
  .map((region) => `${region} Regional Office`);

export const DEFAULT_REGIONAL_OFFICE = 'Sangareddy Regional Office';

export const VISIT_TIME_SLOTS = [
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '2:00 PM',
  '3:00 PM',
  '4:00 PM',
];
