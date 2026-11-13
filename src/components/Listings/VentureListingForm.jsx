import React from 'react';
import useListingForm from '../../hooks/useListingForm';
import { OPTIONS, FACING_OPTIONS, APPROVAL_OPTIONS } from '../../utils/listingRecord';
import {
  ListingFormFrame, FormSection, FieldRow, OptionPills, CheckPills, NumberInput, TextInput,
  RupeeHint, RoadWidthPicker, LocationFields, GpsFields, MediaFields, ContactSection,
} from './ListingFormParts';

const O = OPTIONS.venture;

/** Garuda Venture Listing Form — 15 property fields + 5 contact fields. */
export default function VentureListingForm({ listing, onSaved, onCancel }) {
  const f = useListingForm('venture', listing, onSaved);
  const d = f.form.details;

  const total = Number(d.total_plots);
  const available = Number(d.available_plots);
  const availableTooHigh = d.total_plots !== '' && d.available_plots !== '' && available > total;
  const guntasTooHigh = d.area_guntas !== '' && Number(d.area_guntas) >= 40;
  const sizeRangeBad =
    d.plot_size_min_sq_yards !== '' && d.plot_size_max_sq_yards !== '' &&
    Number(d.plot_size_min_sq_yards) > Number(d.plot_size_max_sq_yards);

  return (
    <ListingFormFrame
      f={f}
      title={f.isEdit ? 'Edit venture listing' : 'Venture listing form'}
      subtitle="20 details · 15 property fields + 5 contact fields"
      onCancel={onCancel}
    >
      <FormSection title="A. Venture Details (01-15)">
        <LocationFields f={f} label="Venture Location" />

        <FieldRow num="02" label="Venture Name" required hint="Text">
          <TextInput value={d.venture_name} onChange={(v) => f.setDetail('venture_name', v)} placeholder="Venture name" maxLength={150} />
        </FieldRow>

        <FieldRow num="03" label="Venture Type" required hint="Dropdown">
          <OptionPills options={O.venture_type} value={d.venture_type} onChange={(v) => f.setDetail('venture_type', v)} />
        </FieldRow>

        <FieldRow num="04" label="Total Venture Area" hint="Number">
          <div className="lst-inline wrap">
            <NumberInput value={d.area_acres} onChange={(v) => f.setDetail('area_acres', v)} unit="Acres" />
            <NumberInput value={d.area_guntas} onChange={(v) => f.setDetail('area_guntas', v)} unit="Guntas" />
          </div>
          {guntasTooHigh && <span className="lst-warn">Guntas must be under 40 (40 guntas = 1 acre).</span>}
        </FieldRow>

        <FieldRow num="05" label="Total Number of Plots" hint="Number">
          <NumberInput value={d.total_plots} onChange={(v) => f.setDetail('total_plots', v)} step="1" />
        </FieldRow>

        <FieldRow num="06" label="Available Plots" hint="Number">
          <NumberInput value={d.available_plots} onChange={(v) => f.setDetail('available_plots', v)} step="1" />
          {availableTooHigh && <span className="lst-warn">Available plots cannot exceed the total.</span>}
        </FieldRow>

        <FieldRow num="07" label="Plot Sizes & Available Facings" hint="Number / Multi">
          <div className="lst-inline wrap">
            <NumberInput value={d.plot_size_min_sq_yards} onChange={(v) => f.setDetail('plot_size_min_sq_yards', v)} placeholder="From" />
            <span className="lst-times">to</span>
            <NumberInput value={d.plot_size_max_sq_yards} onChange={(v) => f.setDetail('plot_size_max_sq_yards', v)} unit="sq. yards" placeholder="To" />
          </div>
          {sizeRangeBad && <span className="lst-warn">The smallest size is larger than the largest.</span>}
          <div className="lst-sub lst-spaced">
            <span>Facings</span>
            <CheckPills options={FACING_OPTIONS} values={d.available_facings} onToggle={(v) => f.toggleDetailList('available_facings', v)} />
          </div>
        </FieldRow>

        <FieldRow num="08" label="Price per Sq. Yard" hint="Currency">
          <NumberInput value={d.price_per_sq_yard} onChange={(v) => f.setDetail('price_per_sq_yard', v)} prefix="Rs." step="1" />
          <RupeeHint value={d.price_per_sq_yard} />
        </FieldRow>

        <FieldRow num="09" label="Approval Type" hint="Dropdown">
          <OptionPills options={APPROVAL_OPTIONS} value={d.approval_type} onChange={(v) => f.setDetail('approval_type', v)} />
        </FieldRow>

        <FieldRow num="10" label="RERA Registration" hint="Text / Select">
          <div className="lst-inline wrap">
            <OptionPills options={O.rera_status} value={d.rera_status} onChange={(v) => f.setDetail('rera_status', v)} />
            {d.rera_status === 'registered' && (
              <input
                type="text"
                className="lst-input"
                value={d.rera_number}
                placeholder="RERA No."
                maxLength={60}
                onChange={(e) => f.setDetail('rera_number', e.target.value)}
              />
            )}
          </div>
        </FieldRow>

        <FieldRow num="11" label="Road Width" hint="Dropdown">
          <RoadWidthPicker presets={O.road_width_presets} value={d.road_width_ft} onChange={(v) => f.setDetail('road_width_ft', v)} />
        </FieldRow>

        <FieldRow num="12" label="Road Type" hint="Dropdown">
          <OptionPills options={O.road_type} value={d.road_type} onChange={(v) => f.setDetail('road_type', v)} />
        </FieldRow>

        <FieldRow num="13" label="Venture Amenities" hint="Checkboxes">
          <CheckPills options={O.amenities} values={d.amenities} onToggle={(v) => f.toggleDetailList('amenities', v)} />
        </FieldRow>

        <GpsFields f={f} />
        <MediaFields f={f} type="venture" label="Venture Media" />
      </FormSection>

      <ContactSection f={f} type="venture" />
    </ListingFormFrame>
  );
}
