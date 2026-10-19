/**
 * Land record ⇄ form conversion, shared by Add Land and every verification
 * queue's editor. Ported from the old admin panel, where the same rules were
 * copy-pasted into five dashboards.
 *
 * Backend quirks this file absorbs (confirmed against Garuda-Backend-2):
 * - `price_per_acres` / `total_value` are stored in rupees; the form works in
 *   lakhs. Legacy rows already stored in lakhs are told apart by size (> 1000).
 * - Trees live in their own table (`tree: [{type, count}]` on read,
 *   `trees` on write) and sheds likewise (`shed` rows of dimensions).
 * - The land row has no nearest-town state/district columns, so each nearest
 *   town is packed as a JSON string `{state, district, town, distance}` into
 *   `nearest_town_1..3`. Older rows hold just the town name.
 * - `media` and `documents` are replace-all on update: always send the full
 *   arrays or existing files are deleted.
 */

// ─── Option lists (values must match the backend ENUMs) ─────────────────
export const OWNERSHIP_TYPE_OPTIONS = ['Ancestral', 'Purchased'];
export const LOCALITY_OPTIONS = ['Local', 'Non-local'];
export const OWNERSHIP_STATUS_OPTIONS = ['Own', 'Joint'];
export const AGE_OPTIONS = ['Upto 30', '30-50', '50+'];
export const LITERACY_OPTIONS = ['Illiterate', 'Literate', 'High School', 'Graduate'];
export const NATURE_OPTIONS = ['Calm', 'Polite', 'Normal', 'Rude'];
export const ELECTRICITY_OPTIONS = ['single phase', 'three phase'];
export const RESIDENCE_OPTIONS = ['developed farm house', 'rcc house', 'asbestos shelter', 'hut'];
export const WATER_SOURCE_OPTIONS = ['borewell', 'cheruvu', 'canal', 'not available'];
export const ROAD_TYPE_OPTIONS = ['HIGHWAY', 'DOUBLE ROAD', 'SINGLE ROAD', 'GRAVEL ROAD'];
export const SOIL_TYPE_OPTIONS = ['Red Soil', 'Black Soil', 'Sandy Soil', 'Alluvial Soil'];
export const FENCING_OPTIONS = ['no', 'partially', 'all sides', 'All side with gates'];
export const COMPLAINT_OPTIONS = [
  'Siblings Issue (own Brother or Sister)',
  'Cousins Issue (of uncles family)',
  'Boundary',
  'Rocks In Land',
  'Electric Poles',
  'Sealing',
  'path issue',
  'No Path at all',
];
export const SALE_STATUS_OPTIONS = [
  { value: 'TOKEN RECEIVED', label: 'Token received' },
  { value: 'AGREEMENT Made', label: 'Agreement made' },
  { value: 'SOLD', label: 'Sold' },
];
export const DOC_TYPES = ['PASSBOOK', 'AADHAR', 'TITLE_DEED'];
export const MEDIA_CATEGORIES = [
  { key: 'farmer_photo', label: 'Farmer photo' },
  { key: 'land_soil', label: 'Land soil' },
  { key: 'fencing', label: 'Fencing' },
  { key: 'farm_pond', label: 'Farm pond' },
  { key: 'residence', label: 'Residence' },
  { key: 'shed', label: 'Shed' },
  { key: 'water_source', label: 'Water source' },
  { key: 'trees', label: 'Trees' },
  { key: 'rocks', label: 'Rocks' },
  { key: 'electric_poles', label: 'Electric poles' },
  { key: 'others', label: 'Others' },
  { key: 'video', label: 'Full site video' },
  { key: 'farmer_agreement', label: 'Farmer agreement' },
];

export const TREE_FIELDS = [
  { field: 'mango_trees_number', type: 'Mango', label: 'Mango' },
  { field: 'coconut_trees_number', type: 'Coconut', label: 'Coconut' },
  { field: 'neem_trees_number', type: 'Neem', label: 'Neem' },
  { field: 'baniyan_trees_number', type: 'Banyan', label: 'Banyan' },
  { field: 'tamarind_trees_number', type: 'Tamarind', label: 'Tamarind' },
  { field: 'sapoto_trees_number', type: 'Sapota', label: 'Sapota' },
  { field: 'guava_trees_number', type: 'Guava', label: 'Guava' },
  { field: 'teak_trees_number', type: 'Teak', label: 'Teak' },
  { field: 'other_trees_number', type: 'Other', label: 'Other' },
];

// Tree type names seen in stored rows → form field (old app spellings included).
const TREE_TYPE_TO_FIELD = {
  mango: 'mango_trees_number',
  coconut: 'coconut_trees_number',
  neem: 'neem_trees_number',
  baniyan: 'baniyan_trees_number',
  banyan: 'baniyan_trees_number',
  tamarind: 'tamarind_trees_number',
  sapoto: 'sapoto_trees_number',
  sapota: 'sapoto_trees_number',
  guava: 'guava_trees_number',
  teak: 'teak_trees_number',
  other: 'other_trees_number',
};

// Form-only landDetails keys that have no column and must not be sent.
const NEAREST_TOWN_FORM_KEYS = [
  'nearest_town_state',
  'nearest_town_district', 'nearest_town_district_2', 'nearest_town_district_3',
  'nearest_town_1', 'nearest_town_2', 'nearest_town_3',
  'nearest_town_distance_1', 'nearest_town_distance_2', 'nearest_town_distance_3',
];
const SHED_FORM_KEYS = ['poultry_shed_length', 'poultry_shed_width', 'cow_shed_length', 'cow_shed_width'];

// Read-only relations / bookkeeping on a fetched land that must not be written back.
const READ_ONLY_LAND_KEYS = [
  'id', 'tree', 'creator', 'verifier', 'linkedAgent', 'observedBy', 'observationSubmissions',
  'agentTransactions', 'created_at', 'updated_at', 'createdAt', 'updatedAt', 'created_by',
];
const ROW_KEYS = ['id', 'land_id', 'created_at', 'updated_at', 'createdAt', 'updatedAt'];

const emptyFarmerDetails = () => ({
  name: '', phone: '', whatsapp: '',
  ownership_type: '', locality: '', ownership_status: '', age: '', literacy: '', nature: '',
});

const emptyLandDetails = () => ({
  total_acres: '', guntas: '', price_per_acres: '', total_value: 0,
  nearest_road_type: '', land_attached_to_road: 'no', path_ownership: '',
  land_entry_latitude: '', land_entry_longitude: '',
  land_boundary_latitude: '', land_boundary_longitude: '',
  soil_type: '', fencing_status: '',
  electricity: [], residence: [], water_source: [], complaints: [],
  poultry_shed_number: 0, poultry_shed_length: '', poultry_shed_width: '',
  cow_shed_number: 0, cow_shed_length: '', cow_shed_width: '',
  number_of_bores: '', farm_pond: false,
  ...Object.fromEntries(TREE_FIELDS.map(({ field }) => [field, ''])),
  ...Object.fromEntries(NEAREST_TOWN_FORM_KEYS.map((key) => [key, ''])),
});

export const createEmptyLand = () => ({
  state: '', district: '', mandal: '', village: '',
  location_latitude: '', location_longitude: '',
  land_sale_available_status: [],
  mortage_availability_status: [],
  urgency_listing: [],
  verification_package: false,
  form_status: 'draft',
  farmerDetails: emptyFarmerDetails(),
  landDetails: emptyLandDetails(),
  media: [],
  documents: [],
});

// ─── Money ──────────────────────────────────────────────────────────────
/** Stored rupees → lakhs for the form. Values ≤ 1000 are legacy rows already in lakhs. */
export const toLakhs = (value) => {
  const num = parseFloat(value);
  if (!Number.isFinite(num)) return '';
  return num > 1000 ? num / 100000 : num;
};

/** (acres + guntas/40) × price per acre, all in lakhs. */
export const computeTotalValue = (acres, guntas, pricePerAcre) =>
  ((parseFloat(acres) || 0) + (parseFloat(guntas) || 0) / 40) * (parseFloat(pricePerAcre) || 0);

/** Lakhs → "₹12.50 L" / "₹1.25 Cr". */
export const formatLakhs = (lakhs) => {
  const value = Number(lakhs) || 0;
  if (value === 0) return '₹0';
  return value >= 100 ? `₹${(value / 100).toFixed(2)} Cr` : `₹${value.toFixed(2)} L`;
};

// ─── Nearest towns ──────────────────────────────────────────────────────
export const unpackTown = (packed, land = {}) => {
  if (!packed) return null;
  try {
    const parsed = JSON.parse(packed);
    if (parsed && typeof parsed === 'object' && parsed.town) return parsed;
  } catch {
    // Legacy rows store just the town name.
  }
  return { state: land.state || '', district: land.district || '', town: String(packed) };
};

const packTown = (state, district, town, distance) =>
  town ? JSON.stringify({ state: state || '', district: district || '', town, distance: distance || '' }) : null;

// ─── Display helpers ────────────────────────────────────────────────────
export const landCode = (land) => `L${String(land?.id ?? '').padStart(3, '0')}`;

export const landAddress = (land) =>
  [land?.village, land?.mandal, land?.district].map((p) => (p ? String(p).trim() : '')).filter(Boolean).join(', ') || 'N/A';

/** "4 Ac 20 Gt" from landDetails, or 'N/A'. */
export const landUnitProfile = (land) => {
  const acres = Number(land?.landDetails?.total_acres) || 0;
  const guntas = Number(land?.landDetails?.guntas) || 0;
  if (!acres && !guntas) return 'N/A';
  return `${acres} Ac${guntas ? ` ${guntas} Gt` : ''}`;
};

/** Case-insensitive search over farmer name/phone, location and land id. */
export const matchesLandSearch = (land, query) => {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  const fields = [
    land.farmerDetails?.name, land.farmerDetails?.phone,
    land.village, land.mandal, land.district, landCode(land), String(land.id),
  ];
  return fields.some((f) => f && String(f).toLowerCase().includes(q));
};

// ─── Normalise a fetched land into form state ───────────────────────────
const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const splitCoords = (value) =>
  typeof value === 'string' && value.includes(',') ? value.split(',').map((s) => s.trim()) : null;

export function landToForm(land) {
  const src = JSON.parse(JSON.stringify(land || {}));
  const form = { ...createEmptyLand(), ...src };

  form.farmerDetails = { ...emptyFarmerDetails(), ...(src.farmerDetails || {}) };
  const details = { ...emptyLandDetails(), ...(src.landDetails || {}) };

  details.price_per_acres = toLakhs(details.price_per_acres);
  details.total_value = toLakhs(details.total_value) || 0;

  // Trees: table rows → flat count fields. Legacy text like "mango-12" → 12.
  asArray(src.tree).forEach((t) => {
    const field = TREE_TYPE_TO_FIELD[String(t?.type || '').toLowerCase()];
    if (field && t.count) details[field] = Number(t.count) || 0;
  });
  TREE_FIELDS.forEach(({ field }) => {
    const val = details[field];
    if (typeof val === 'string' && val !== '') {
      const match = val.match(/\d+/);
      details[field] = match ? parseInt(match[0], 10) : '';
    }
  });

  // Sheds: first dimension row back into the form fields.
  const shedRow = asArray(src.shed)[0];
  if (shedRow) SHED_FORM_KEYS.forEach((key) => { details[key] = shedRow[key] ?? ''; });

  // GPS stored as a single "lat, lng" string in the latitude column.
  const entry = splitCoords(details.land_entry_latitude);
  if (entry) [details.land_entry_latitude, details.land_entry_longitude] = entry;
  const boundary = splitCoords(details.land_boundary_latitude);
  if (boundary) [details.land_boundary_latitude, details.land_boundary_longitude] = boundary;

  // Coerce stored spellings to the dropdown values.
  if (details.nearest_road_type) details.nearest_road_type = String(details.nearest_road_type).toUpperCase();
  if (details.soil_type) {
    const st = details.soil_type.toLowerCase();
    if (st.includes('red')) details.soil_type = 'Red Soil';
    else if (st.includes('black')) details.soil_type = 'Black Soil';
    else if (st.includes('sand')) details.soil_type = 'Sandy Soil';
    else if (st.includes('alluvial')) details.soil_type = 'Alluvial Soil';
  }
  if (details.fencing_status) {
    const fs = details.fencing_status.toLowerCase();
    if (fs.includes('gate')) details.fencing_status = 'All side with gates';
    else if (fs.includes('fully') || fs.includes('all')) details.fencing_status = 'all sides';
    else if (fs.includes('partially')) details.fencing_status = 'partially';
    else if (fs.includes('not') || fs === 'no') details.fencing_status = 'no';
  }

  details.electricity = asArray(details.electricity);
  details.complaints = asArray(details.complaints);
  details.residence = asArray(details.residence).map((r) => (r === 'developed farm' ? 'developed farm house' : r));
  // Legacy water sources like "canal-2" carry a count after the dash.
  details.water_source = asArray(details.water_source).map((item) => {
    const [type, count] = String(item).split('-');
    const name = type.trim().toLowerCase();
    if (count !== undefined && name === 'borewell') details.number_of_bores = parseInt(count, 10) || 0;
    return name;
  });

  // Nearest towns: packed JSON on the land row → form fields.
  [1, 2, 3].forEach((n) => {
    const unpacked = unpackTown(src[`nearest_town_${n}`], src);
    if (!unpacked) return;
    if (n === 1) details.nearest_town_state = unpacked.state || '';
    details[n === 1 ? 'nearest_town_district' : `nearest_town_district_${n}`] = unpacked.district || '';
    details[`nearest_town_${n}`] = unpacked.town || '';
    details[`nearest_town_distance_${n}`] = unpacked.distance || src[`nearest_town_${n}_km`] || '';
  });

  form.landDetails = details;
  form.village = form.village ? String(form.village).trim() : '';
  form.land_sale_available_status = asArray(src.land_sale_available_status);
  form.mortage_availability_status = asArray(src.mortage_availability_status);
  form.urgency_listing = asArray(src.urgency_listing);
  form.media = asArray(src.media);
  form.documents = asArray(src.documents);
  return form;
}

// ─── Form state → API payload ───────────────────────────────────────────
const blankToNull = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === '' ? null : v]));

const stripKeys = (obj, keys) => {
  const copy = { ...obj };
  keys.forEach((k) => delete copy[k]);
  return copy;
};

/**
 * Build the POST/PUT body for `/land`. `overrides` sets top-level fields such
 * as the verification statuses for the action being taken.
 */
export function formToPayload(form, overrides = {}) {
  const details = form.landDetails || {};

  const trees = TREE_FIELDS
    .map(({ field, type }) => ({ type, count: Number(details[field]) || 0 }))
    .filter((t) => t.count > 0);

  const shedDims = Object.fromEntries(SHED_FORM_KEYS.map((key) => [key, Number(details[key]) || null]));
  const shed = Object.values(shedDims).some(Boolean) ? [shedDims] : [];

  const state = details.nearest_town_state;
  const nearestTowns = {
    nearest_town_1: packTown(state, details.nearest_town_district, details.nearest_town_1, details.nearest_town_distance_1),
    nearest_town_2: packTown(state, details.nearest_town_district_2, details.nearest_town_2, details.nearest_town_distance_2),
    nearest_town_3: packTown(state, details.nearest_town_district_3, details.nearest_town_3, details.nearest_town_distance_3),
  };

  const landDetails = blankToNull(stripKeys(details, [...NEAREST_TOWN_FORM_KEYS, ...SHED_FORM_KEYS, ...TREE_FIELDS.map((t) => t.field), ...ROW_KEYS]));
  const price = parseFloat(details.price_per_acres);
  const total = parseFloat(details.total_value);
  landDetails.price_per_acres = Number.isFinite(price) ? price * 100000 : null;
  landDetails.total_value = Number.isFinite(total) ? total * 100000 : null;
  ['total_acres', 'guntas', 'number_of_bores'].forEach((key) => {
    if (landDetails[key] !== null && landDetails[key] !== undefined) landDetails[key] = Number(landDetails[key]) || 0;
  });

  const top = stripKeys(form, [...READ_ONLY_LAND_KEYS, 'farmerDetails', 'landDetails', 'media', 'documents', 'shed', 'gps']);

  return {
    ...blankToNull(top),
    ...nearestTowns,
    ...overrides,
    farmerDetails: blankToNull(stripKeys(form.farmerDetails || {}, ROW_KEYS)),
    landDetails,
    media: (form.media || []).map((m) => stripKeys(m, ROW_KEYS)),
    documents: (form.documents || []).map((d) => stripKeys(d, ROW_KEYS)),
    trees,
    shed,
  };
}
