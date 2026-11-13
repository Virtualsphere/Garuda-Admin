import React from 'react';
import useListingForm from '../../hooks/useListingForm';
import { OPTIONS, FACING_OPTIONS, APPROVAL_OPTIONS } from '../../utils/listingRecord';
import {
  ListingFormFrame, FormSection, FieldRow, OptionPills, CheckPills, YesNo, NumberInput, TextInput,
  RupeeHint, LocationFields, GpsFields, MediaFields, ContactSection,
} from './ListingFormParts';

const O = OPTIONS.villa;

/** Garuda Villa Listing Form — 15 property fields + 5 contact fields. */
export default function VillaListingForm({ listing, onSaved, onCancel }) {
  const f = useListingForm('villa', listing, onSaved);
  const d = f.form.details;

  return (
    <ListingFormFrame
      f={f}
      title={f.isEdit ? 'Edit villa listing' : 'Villa listing form'}
      subtitle="20 details · 15 property fields + 5 contact fields"
      onCancel={onCancel}
    >
      <FormSection title="A. Villa Details (01-15)">
        <LocationFields f={f} label="Villa Location" />

        <FieldRow num="02" label="Project / Community Name" hint="Text">
          <TextInput value={d.project_name} onChange={(v) => f.setDetail('project_name', v)} placeholder="Project name" maxLength={150} />
        </FieldRow>

        <FieldRow num="03" label="Villa Type" required hint="Dropdown">
          <OptionPills options={O.villa_type} value={d.villa_type} onChange={(v) => f.setDetail('villa_type', v)} />
        </FieldRow>

        <FieldRow num="04" label="Construction Status" hint="Dropdown">
          <OptionPills options={O.construction_status} value={d.construction_status} onChange={(v) => f.setDetail('construction_status', v)} />
        </FieldRow>

        <FieldRow num="05" label="Plot / Land Area" hint="Number">
          <NumberInput value={d.plot_area_sq_yards} onChange={(v) => f.setDetail('plot_area_sq_yards', v)} unit="sq. yards" />
        </FieldRow>

        <FieldRow num="06" label="Built-up Area" hint="Number">
          <NumberInput value={d.built_up_area_sqft} onChange={(v) => f.setDetail('built_up_area_sqft', v)} unit="sq. ft." />
        </FieldRow>

        <FieldRow num="07" label="Bedrooms" hint="Number">
          <NumberInput value={d.bedrooms} onChange={(v) => f.setDetail('bedrooms', v)} unit="BHK" step="1" />
        </FieldRow>

        <FieldRow num="08" label="Bathrooms / Floors" hint="Number">
          <div className="lst-grid-2">
            <label className="lst-sub">
              <span>Bathrooms</span>
              <NumberInput value={d.bathrooms} onChange={(v) => f.setDetail('bathrooms', v)} step="1" />
            </label>
            <label className="lst-sub">
              <span>Floors</span>
              <NumberInput value={d.floors} onChange={(v) => f.setDetail('floors', v)} step="1" />
            </label>
          </div>
        </FieldRow>

        <FieldRow num="09" label="Villa Facing" hint="Dropdown">
          <OptionPills options={FACING_OPTIONS} value={d.facing} onChange={(v) => f.setDetail('facing', v)} />
        </FieldRow>

        <FieldRow num="10" label="Asking Price" hint="Currency">
          <div className="lst-inline wrap">
            <NumberInput value={d.asking_price} onChange={(v) => f.setDetail('asking_price', v)} prefix="Rs." step="1" />
            <YesNo label="Negotiable" value={d.negotiable} onChange={(v) => f.setDetail('negotiable', v)} />
          </div>
          <RupeeHint value={d.asking_price} />
        </FieldRow>

        <FieldRow num="11" label="Approval / RERA Status" hint="Dropdown / Text">
          <div className="lst-sub">
            <span>Approval</span>
            <OptionPills options={APPROVAL_OPTIONS} value={d.approval_type} onChange={(v) => f.setDetail('approval_type', v)} />
          </div>
          <label className="lst-sub lst-spaced">
            <span>RERA No. (if applicable)</span>
            <TextInput value={d.rera_number} onChange={(v) => f.setDetail('rera_number', v)} placeholder="RERA registration number" maxLength={60} />
          </label>
        </FieldRow>

        <FieldRow num="12" label="Road Width / Parking" hint="Select / Number">
          <div className="lst-grid-2">
            <label className="lst-sub">
              <span>Road width</span>
              <NumberInput value={d.road_width_ft} onChange={(v) => f.setDetail('road_width_ft', v)} unit="ft" />
            </label>
            <div className="lst-sub">
              <span>Parking</span>
              <OptionPills options={O.parking} value={d.parking} onChange={(v) => f.setDetail('parking', v)} />
            </div>
          </div>
        </FieldRow>

        <FieldRow num="13" label="Villa Amenities" hint="Checkboxes">
          <CheckPills options={O.amenities} values={d.amenities} onToggle={(v) => f.toggleDetailList('amenities', v)} />
        </FieldRow>

        <GpsFields f={f} />
        <MediaFields f={f} type="villa" label="Villa Media" />
      </FormSection>

      <ContactSection f={f} type="villa" />
    </ListingFormFrame>
  );
}
