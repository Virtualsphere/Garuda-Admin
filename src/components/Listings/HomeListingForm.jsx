import React from 'react';
import useListingForm from '../../hooks/useListingForm';
import { OPTIONS, FACING_OPTIONS } from '../../utils/listingRecord';
import {
  ListingFormFrame, FormSection, FieldRow, OptionPills, CheckPills, YesNo,
  NumberInput, RupeeHint, LocationFields, GpsFields, MediaFields, ContactSection,
} from './ListingFormParts';

const O = OPTIONS.home;

/** Garuda Home Listing Form — 15 property fields + 5 contact fields. */
export default function HomeListingForm({ listing, onSaved, onCancel }) {
  const f = useListingForm('home', listing, onSaved);
  const d = f.form.details;
  const isFlat = d.property_type === 'apartment';

  return (
    <ListingFormFrame
      f={f}
      title={f.isEdit ? 'Edit home listing' : 'Home listing form'}
      subtitle="20 details · 15 property fields + 5 contact fields"
      onCancel={onCancel}
    >
      <FormSection title="A. Home Details (01-15)">
        <LocationFields f={f} label="Home Location" />

        <FieldRow num="02" label="Property Type" required hint="Dropdown">
          <div className="lst-inline wrap">
            <OptionPills options={O.property_type} value={d.property_type} onChange={(v) => f.setDetail('property_type', v)} />
            {d.property_type === 'other' && (
              <input
                type="text"
                className="lst-input"
                value={d.property_type_other}
                placeholder="Specify type"
                maxLength={80}
                onChange={(e) => f.setDetail('property_type_other', e.target.value)}
              />
            )}
          </div>
        </FieldRow>

        <FieldRow num="03" label="Property Age / Status" hint="Select / Number">
          <div className="lst-inline wrap">
            <OptionPills options={O.property_status} value={d.property_status} onChange={(v) => f.setDetail('property_status', v)} />
            {d.property_status === 'resale' && (
              <NumberInput value={d.property_age_years} onChange={(v) => f.setDetail('property_age_years', v)} unit="years" placeholder="Age" />
            )}
          </div>
        </FieldRow>

        <FieldRow num="04" label="Built-up Area" hint="Number">
          <NumberInput value={d.built_up_area_sqft} onChange={(v) => f.setDetail('built_up_area_sqft', v)} unit="sq. ft." />
        </FieldRow>

        <FieldRow num="05" label="Plot / Land Area" hint="Number">
          <div className="lst-inline wrap">
            <NumberInput
              value={d.plot_area_not_applicable ? '' : d.plot_area_sq_yards}
              onChange={(v) => f.setDetail('plot_area_sq_yards', v)}
              unit="sq. yards"
              disabled={d.plot_area_not_applicable}
            />
            <label className="lst-check">
              <input
                type="checkbox"
                checked={d.plot_area_not_applicable}
                onChange={(e) => f.setDetail('plot_area_not_applicable', e.target.checked)}
              />
              Not Applicable
            </label>
          </div>
        </FieldRow>

        <FieldRow num="06" label="Total Floors" hint="Number">
          <div className="lst-grid-2">
            <label className="lst-sub">
              <span>Total floors</span>
              <NumberInput value={d.total_floors} onChange={(v) => f.setDetail('total_floors', v)} step="1" />
            </label>
            <label className="lst-sub">
              <span>Property floor {isFlat ? '' : '(if flat)'}</span>
              <NumberInput value={d.property_floor} onChange={(v) => f.setDetail('property_floor', v)} step="1" />
            </label>
          </div>
        </FieldRow>

        <FieldRow num="07" label="Bedrooms" hint="Number">
          <NumberInput value={d.bedrooms} onChange={(v) => f.setDetail('bedrooms', v)} unit="BHK" step="1" />
        </FieldRow>

        <FieldRow num="08" label="Bathrooms" hint="Number">
          <NumberInput value={d.bathrooms} onChange={(v) => f.setDetail('bathrooms', v)} step="1" />
        </FieldRow>

        <FieldRow num="09" label="House Facing" hint="Dropdown">
          <OptionPills options={FACING_OPTIONS} value={d.facing} onChange={(v) => f.setDetail('facing', v)} />
        </FieldRow>

        <FieldRow num="10" label="Furnishing Status" hint="Dropdown">
          <OptionPills options={O.furnishing} value={d.furnishing} onChange={(v) => f.setDetail('furnishing', v)} />
        </FieldRow>

        <FieldRow num="11" label="Asking Price" hint="Currency">
          <div className="lst-inline wrap">
            <NumberInput value={d.asking_price} onChange={(v) => f.setDetail('asking_price', v)} prefix="Rs." step="1" />
            <YesNo label="Negotiable" value={d.negotiable} onChange={(v) => f.setDetail('negotiable', v)} />
          </div>
          <RupeeHint value={d.asking_price} />
        </FieldRow>

        <FieldRow num="12" label="Parking" hint="Dropdown">
          <OptionPills options={O.parking} value={d.parking} onChange={(v) => f.setDetail('parking', v)} />
        </FieldRow>

        <FieldRow num="13" label="Utilities / Facilities" hint="Checkboxes">
          <CheckPills options={O.utilities} values={d.utilities} onToggle={(v) => f.toggleDetailList('utilities', v)} />
        </FieldRow>

        <GpsFields f={f} />
        <MediaFields f={f} type="home" label="Home Media" />
      </FormSection>

      <ContactSection f={f} type="home" />
    </ListingFormFrame>
  );
}
