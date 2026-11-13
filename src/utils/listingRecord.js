/**
 * Home / Plot / Venture / Villa listing records.
 *
 * Mirrors the backend's src/service/propertyListingService.js: option values
 * here must match its DETAIL_SCHEMAS / CONTACT_TYPES / MEDIA_KINDS exactly, or
 * the API rejects the payload. Always go through listingToForm() /
 * formToPayload() — the form keeps every value as a string (that is what
 * inputs hold), the API wants numbers/booleans/arrays and drops blanks.
 */

export const LISTING_TYPES = ['home', 'plot', 'venture', 'villa'];

export const LISTING_TYPE_LABELS = {
  home: 'Home',
  plot: 'Plot',
  venture: 'Venture',
  villa: 'Villa',
};

const opt = (value, label) => ({ value, label });

export const FACING_OPTIONS = ['E', 'W', 'N', 'S', 'NE', 'NW', 'SE', 'SW'].map((f) => opt(f, f));

export const APPROVAL_OPTIONS = [
  opt('hmda', 'HMDA'),
  opt('dtcp', 'DTCP'),
  opt('municipal', 'Municipal'),
  opt('panchayat', 'Panchayat'),
  opt('unapproved', 'Unapproved'),
];

export const OPTIONS = {
  home: {
    property_type: [opt('independent_house', 'Independent House'), opt('duplex', 'Duplex'), opt('apartment', 'Apartment / Flat'), opt('other', 'Other')],
    property_status: [opt('new', 'New'), opt('resale', 'Resale'), opt('under_construction', 'Under Construction')],
    furnishing: [opt('furnished', 'Furnished'), opt('semi_furnished', 'Semi-furnished'), opt('unfurnished', 'Unfurnished')],
    parking: [opt('car', 'Car'), opt('two_wheeler', 'Two-Wheeler'), opt('both', 'Both'), opt('none', 'None')],
    utilities: [opt('water', 'Water'), opt('power', 'Power'), opt('drainage', 'Drainage'), opt('lift', 'Lift'), opt('security', 'Security')],
  },
  plot: {
    plot_type: [opt('residential', 'Residential'), opt('commercial', 'Commercial')],
    road_width_presets: ['20', '30', '40', '60'],
    road_type: [opt('bt', 'BT'), opt('cc', 'CC'), opt('gravel', 'Gravel'), opt('other', 'Other')],
    amenities: [opt('water', 'Water'), opt('power', 'Power'), opt('drainage', 'Drainage'), opt('corner_plot', 'Corner Plot')],
  },
  venture: {
    venture_type: [opt('residential', 'Residential'), opt('commercial', 'Commercial'), opt('mixed', 'Mixed')],
    rera_status: [opt('registered', 'Registered'), opt('not_registered', 'Not Registered'), opt('na', 'N/A')],
    road_width_presets: ['30', '40', '60', '80'],
    road_type: [opt('bt', 'BT'), opt('cc', 'CC'), opt('gravel', 'Gravel'), opt('under_development', 'Under Development')],
    amenities: [opt('water', 'Water'), opt('power', 'Power'), opt('drainage', 'Drainage'), opt('park', 'Park'), opt('security', 'Security')],
  },
  villa: {
    villa_type: [opt('independent', 'Independent'), opt('gated_community', 'Gated Community'), opt('duplex', 'Duplex'), opt('triplex', 'Triplex')],
    construction_status: [opt('ready_to_move', 'Ready to Move'), opt('under_construction', 'Under Construction'), opt('resale', 'Resale')],
    parking: [opt('one_car', '1 Car'), opt('two_plus_cars', '2+ Cars'), opt('none', 'None')],
    amenities: [opt('water', 'Water'), opt('power', 'Power'), opt('security', 'Security'), opt('garden', 'Garden'), opt('pool', 'Pool')],
  },
};

export const CONTACT_TYPE_OPTIONS = {
  home: [opt('owner', 'Owner'), opt('agent', 'Agent'), opt('builder_developer', 'Builder / Developer')],
  plot: [opt('owner', 'Owner'), opt('agent', 'Agent'), opt('developer', 'Developer')],
  venture: [opt('developer', 'Developer'), opt('owner', 'Owner'), opt('marketing_agent', 'Marketing Agent')],
  villa: [opt('owner', 'Owner'), opt('agent', 'Agent'), opt('developer', 'Developer')],
};

/** Media slots per form, in the order the PDF lists them. `accept` drives the file picker. */
export const MEDIA_SLOTS = {
  home: [
    { kind: 'photo', label: 'Photos', accept: 'image/*', multiple: true },
    { kind: 'video', label: 'House Video (MP4)', accept: 'video/mp4,video/*', multiple: false },
    { kind: 'floor_plan', label: 'Floor Plan (Image / PDF)', accept: 'image/*,application/pdf', multiple: false },
  ],
  plot: [
    { kind: 'photo', label: 'Photos', accept: 'image/*', multiple: true },
    { kind: 'video', label: 'Plot Video (MP4)', accept: 'video/mp4,video/*', multiple: false },
    { kind: 'layout_map', label: 'Layout Map (Image / PDF)', accept: 'image/*,application/pdf', multiple: false },
  ],
  venture: [
    { kind: 'photo', label: 'Photos', accept: 'image/*', multiple: true },
    { kind: 'layout_map', label: 'Layout Map (Image / PDF)', accept: 'image/*,application/pdf', multiple: false },
    { kind: 'video', label: 'Video (MP4)', accept: 'video/mp4,video/*', multiple: false },
  ],
  villa: [
    { kind: 'photo', label: 'Photos', accept: 'image/*', multiple: true },
    { kind: 'video', label: 'Walkthrough Video', accept: 'video/mp4,video/*', multiple: false },
    { kind: 'floor_plan', label: 'Floor Plan (Image / PDF)', accept: 'image/*,application/pdf', multiple: false },
  ],
};

/** Field keys of each type's `details`, with how to convert them. */
const DETAIL_FIELDS = {
  home: {
    property_type: 'text', property_type_other: 'text', property_status: 'text', property_age_years: 'number',
    built_up_area_sqft: 'number', plot_area_sq_yards: 'number', plot_area_not_applicable: 'bool',
    total_floors: 'number', property_floor: 'number', bedrooms: 'number', bathrooms: 'number',
    facing: 'text', furnishing: 'text', asking_price: 'number', negotiable: 'bool', parking: 'text', utilities: 'list',
  },
  plot: {
    venture_name: 'text', plot_number: 'text', plot_type: 'text', plot_size_sq_yards: 'number',
    length_ft: 'number', width_ft: 'number', facing: 'text', price_per_sq_yard: 'number',
    total_price: 'number', total_price_auto: 'bool', approval_type: 'text', road_width_ft: 'number',
    road_type: 'text', amenities: 'list',
  },
  venture: {
    venture_name: 'text', venture_type: 'text', area_acres: 'number', area_guntas: 'number',
    total_plots: 'number', available_plots: 'number', plot_size_min_sq_yards: 'number',
    plot_size_max_sq_yards: 'number', available_facings: 'list', price_per_sq_yard: 'number',
    approval_type: 'text', rera_status: 'text', rera_number: 'text', road_width_ft: 'number',
    road_type: 'text', amenities: 'list',
  },
  villa: {
    project_name: 'text', villa_type: 'text', construction_status: 'text', plot_area_sq_yards: 'number',
    built_up_area_sqft: 'number', bedrooms: 'number', bathrooms: 'number', floors: 'number',
    facing: 'text', asking_price: 'number', negotiable: 'bool', approval_type: 'text',
    rera_number: 'text', road_width_ft: 'number', parking: 'text', amenities: 'list',
  },
};

/** Defaults that differ from "blank": booleans the PDF shows as a choice. */
const DETAIL_DEFAULTS = {
  home: { negotiable: null, plot_area_not_applicable: false },
  plot: { total_price_auto: true },
  venture: {},
  villa: { negotiable: null },
};

const emptyDetails = (type) => {
  const out = {};
  for (const [key, kind] of Object.entries(DETAIL_FIELDS[type])) {
    out[key] = kind === 'list' ? [] : kind === 'bool' ? false : '';
  }
  return { ...out, ...DETAIL_DEFAULTS[type] };
};

export function emptyListingForm(type) {
  return {
    listing_type: type,
    town_id: '',
    town_area: '',
    details: emptyDetails(type),
    latitude: '',
    longitude: '',
    maps_link: '',
    media: [],
    contact_name: '',
    mobile: '',
    whatsapp_same_as_mobile: true,
    whatsapp_number: '',
    contact_type: '',
    is_direct_listing: true,
    agent_code: '',
  };
}

const str = (v) => (v === null || v === undefined ? '' : String(v));

/** API record → form state. State/district ids are returned separately for useLocations. */
export function listingToForm(listing) {
  const type = listing.listing_type;
  const base = emptyListingForm(type);
  const src = listing.details || {};
  const details = { ...base.details };

  for (const [key, kind] of Object.entries(DETAIL_FIELDS[type])) {
    if (src[key] === undefined || src[key] === null) continue;
    if (kind === 'list') details[key] = Array.isArray(src[key]) ? src[key] : [];
    else if (kind === 'bool') details[key] = Boolean(src[key]);
    else details[key] = str(src[key]);
  }

  return {
    ...base,
    town_id: str(listing.town_id),
    town_area: str(listing.town_area),
    details,
    latitude: str(listing.latitude),
    longitude: str(listing.longitude),
    maps_link: str(listing.maps_link),
    media: Array.isArray(listing.media) ? listing.media : [],
    contact_name: str(listing.contact_name),
    mobile: str(listing.mobile),
    whatsapp_same_as_mobile: listing.whatsapp_same_as_mobile !== false,
    whatsapp_number: listing.whatsapp_same_as_mobile === false ? str(listing.whatsapp_number) : '',
    contact_type: str(listing.contact_type),
    is_direct_listing: listing.is_direct_listing !== false,
    agent_code: str(listing.agent_code),
  };
}

/** Form state → API payload. Blank values are omitted so the backend treats them as "not given". */
export function formToPayload(form, { stateId, districtId }) {
  const type = form.listing_type;
  const details = {};

  for (const [key, kind] of Object.entries(DETAIL_FIELDS[type])) {
    const v = form.details[key];
    if (kind === 'list') {
      if (Array.isArray(v) && v.length) details[key] = v;
    } else if (kind === 'bool') {
      if (v === true || v === false) details[key] = v;
    } else if (kind === 'number') {
      if (v !== '' && v !== null && v !== undefined) details[key] = Number(v);
    } else if (v !== '' && v !== null && v !== undefined) {
      details[key] = String(v).trim();
    }
  }

  const blankToNull = (v) => (v === '' || v === undefined ? null : v);

  return {
    listing_type: type,
    state_id: blankToNull(stateId),
    district_id: blankToNull(districtId),
    town_id: blankToNull(form.town_id),
    town_area: form.town_area.trim() || null,
    details,
    latitude: blankToNull(form.latitude),
    longitude: blankToNull(form.longitude),
    maps_link: form.maps_link.trim() || null,
    media: form.media.map(({ kind, url, name }) => ({ kind, url, name })),
    contact_name: form.contact_name.trim(),
    mobile: form.mobile.trim(),
    whatsapp_same_as_mobile: form.whatsapp_same_as_mobile,
    whatsapp_number: form.whatsapp_same_as_mobile ? null : form.whatsapp_number.trim(),
    contact_type: form.contact_type,
    is_direct_listing: form.is_direct_listing,
    agent_code: form.is_direct_listing ? null : form.agent_code.trim(),
  };
}

/* ── Display helpers ─────────────────────────────────────────── */

export function optionLabel(options, value) {
  return options?.find((o) => String(o.value) === String(value))?.label || value || '—';
}

export function formatRupees(value) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2).replace(/\.00$/, '')} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2).replace(/\.00$/, '')} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

/** One-line summary of the listing for the list table. */
export function listingTitle(listing) {
  const d = listing.details || {};
  switch (listing.listing_type) {
    case 'home':
      return [d.bedrooms ? `${d.bedrooms} BHK` : null, optionLabel(OPTIONS.home.property_type, d.property_type)].filter(Boolean).join(' · ');
    case 'plot':
      return [d.venture_name, d.plot_number ? `Plot ${d.plot_number}` : null, optionLabel(OPTIONS.plot.plot_type, d.plot_type)].filter(Boolean).join(' · ');
    case 'venture':
      return [d.venture_name, optionLabel(OPTIONS.venture.venture_type, d.venture_type)].filter(Boolean).join(' · ');
    case 'villa':
      return [d.project_name, d.bedrooms ? `${d.bedrooms} BHK` : null, optionLabel(OPTIONS.villa.villa_type, d.villa_type)].filter(Boolean).join(' · ');
    default:
      return '—';
  }
}

/** Size column: built-up area for homes/villas, sq. yards for plots, acres for ventures. */
export function listingSize(listing) {
  const d = listing.details || {};
  switch (listing.listing_type) {
    case 'home':
    case 'villa':
      return d.built_up_area_sqft ? `${d.built_up_area_sqft} sq. ft.` : d.plot_area_sq_yards ? `${d.plot_area_sq_yards} sq. yd.` : '—';
    case 'plot':
      return d.plot_size_sq_yards ? `${d.plot_size_sq_yards} sq. yd.` : '—';
    case 'venture': {
      const parts = [d.area_acres ? `${d.area_acres} ac` : null, d.area_guntas ? `${d.area_guntas} gt` : null].filter(Boolean);
      return parts.length ? parts.join(' ') : '—';
    }
    default:
      return '—';
  }
}

/** Price column: asking price, total price, or per-sq-yard for ventures. */
export function listingPrice(listing) {
  const d = listing.details || {};
  if (listing.listing_type === 'plot') return d.total_price ? formatRupees(d.total_price) : d.price_per_sq_yard ? `${formatRupees(d.price_per_sq_yard)}/sq. yd.` : '—';
  if (listing.listing_type === 'venture') return d.price_per_sq_yard ? `${formatRupees(d.price_per_sq_yard)}/sq. yd.` : '—';
  return formatRupees(d.asking_price);
}
