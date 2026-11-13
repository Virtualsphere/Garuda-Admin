import { useState, useEffect, useCallback } from 'react';
import useLocations from './useLocations';
import listingService from '../services/listingService';
import uploadService from '../services/uploadService';
import { emptyListingForm, listingToForm, formToPayload, MEDIA_SLOTS } from '../utils/listingRecord';

/** The one required "type" field of each form's section A (backend enforces the same). */
const REQUIRED_DETAIL = {
  home: ['property_type', 'Property type'],
  plot: ['plot_type', 'Plot type'],
  venture: ['venture_type', 'Venture type'],
  villa: ['villa_type', 'Villa type'],
};

const MOBILE_RE = /^(?:\+?91|0)?[6-9]\d{9}$/;

/**
 * State, uploads and submit for the four listing forms (Home / Plot / Venture / Villa).
 *
 * @param {'home'|'plot'|'venture'|'villa'} type
 * @param {object|null} listing  existing record when editing, null when creating
 * @param {(saved: object) => void} onSaved
 */
export default function useListingForm(type, listing, onSaved) {
  const [form, setForm] = useState(() => (listing ? listingToForm(listing) : emptyListingForm(type)));
  const [uploading, setUploading] = useState({});
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const locations = useLocations();
  const { setSelectedState, setSelectedDistrict } = locations;

  // Prefill the state → district cascade when editing. Calling both
  // synchronously is safe: selecting the state resets the district first,
  // then the district is set and its towns load.
  const listingStateId = listing?.state_id;
  const listingDistrictId = listing?.district_id;
  useEffect(() => {
    if (listingStateId) setSelectedState(String(listingStateId));
    if (listingDistrictId) setSelectedDistrict(String(listingDistrictId));
  }, [listingStateId, listingDistrictId, setSelectedState, setSelectedDistrict]);

  const setField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setDetail = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, details: { ...prev.details, [key]: value } }));
  }, []);

  const toggleDetailList = useCallback((key, value) => {
    setForm((prev) => {
      const list = prev.details[key] || [];
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      return { ...prev, details: { ...prev.details, [key]: next } };
    });
  }, []);

  const changeState = (id) => {
    setSelectedState(id);
    setForm((prev) => ({ ...prev, town_id: '' }));
  };

  const changeDistrict = (id) => {
    setSelectedDistrict(id);
    setForm((prev) => ({ ...prev, town_id: '' }));
  };

  /* ── Media ─────────────────────────────────────────────── */

  const uploadMedia = async (kind, fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const slot = MEDIA_SLOTS[type].find((s) => s.kind === kind);

    setUploading((prev) => ({ ...prev, [kind]: true }));
    setError('');
    try {
      const uploaded = [];
      for (const file of files) {
        // The upload endpoint only has photo / video / document fields.
        const field = kind === 'photo' || kind === 'video'
          ? kind
          : file.type.startsWith('image/') ? 'photo' : 'document';
        const url = await uploadService.upload(file, field);
        if (url) uploaded.push({ kind, url, name: file.name });
      }
      setForm((prev) => ({
        ...prev,
        // Single-file slots (video, floor plan, layout map) replace what was there.
        media: slot?.multiple
          ? [...prev.media, ...uploaded]
          : [...prev.media.filter((m) => m.kind !== kind), ...uploaded.slice(-1)],
      }));
    } catch (err) {
      setError(err.response?.data?.message || 'File upload failed. Please try again.');
    } finally {
      setUploading((prev) => ({ ...prev, [kind]: false }));
    }
  };

  const removeMedia = (url) => {
    setForm((prev) => ({ ...prev, media: prev.media.filter((m) => m.url !== url) }));
  };

  /* ── GPS ───────────────────────────────────────────────── */

  const fetchCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Location is not available in this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(7),
          longitude: pos.coords.longitude.toFixed(7),
        }));
        setLocating(false);
      },
      () => {
        setError('Could not get the current location. Allow location access or enter it manually.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  /* ── Submit ────────────────────────────────────────────── */

  const validate = () => {
    if (!locations.selectedState) return 'Select a state.';
    const [reqKey, reqLabel] = REQUIRED_DETAIL[type];
    if (!form.details[reqKey]) return `${reqLabel} is required.`;
    if (type === 'venture' && !String(form.details.venture_name || '').trim()) return 'Venture name is required.';
    if (!form.contact_name.trim()) return 'Contact person name is required.';
    if (!MOBILE_RE.test(form.mobile.replace(/[\s-]/g, ''))) return 'Enter a valid 10-digit mobile number.';
    if (!form.whatsapp_same_as_mobile && !MOBILE_RE.test(form.whatsapp_number.replace(/[\s-]/g, ''))) {
      return 'Enter a valid WhatsApp number.';
    }
    if (!form.contact_type) return 'Select the contact person type.';
    if (!form.is_direct_listing && !form.agent_code.trim()) return 'Enter the Garuda Agent ID, or mark this as a direct listing.';
    if (Object.values(uploading).some(Boolean)) return 'Wait for uploads to finish.';
    return '';
  };

  const submit = async (e) => {
    e?.preventDefault?.();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = formToPayload(form, {
        stateId: locations.selectedState,
        districtId: locations.selectedDistrict,
      });
      const res = listing?.id
        ? await listingService.update(listing.id, payload)
        : await listingService.create(payload);
      onSaved?.(res.data || res);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save the listing. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return {
    form,
    setField,
    setDetail,
    toggleDetailList,
    locations,
    changeState,
    changeDistrict,
    uploading,
    uploadMedia,
    removeMedia,
    locating,
    fetchCurrentLocation,
    saving,
    error,
    submit,
    isEdit: Boolean(listing?.id),
  };
}
