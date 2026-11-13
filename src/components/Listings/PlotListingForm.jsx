import React from 'react';
import useListingForm from '../../hooks/useListingForm';
import { OPTIONS, FACING_OPTIONS, APPROVAL_OPTIONS } from '../../utils/listingRecord';
import {
  ListingFormFrame, FormSection, FieldRow, OptionPills, CheckPills, NumberInput, TextInput,
  RupeeHint, RoadWidthPicker, LocationFields, GpsFields, MediaFields, ContactSection,
} from './ListingFormParts';

const O = OPTIONS.plot;

/** Garuda Plot Listing Form — 15 property fields + 5 contact fields. */
export default function PlotListingForm({ listing, onSaved, onCancel }) {
  const f = useListingForm('plot', listing, onSaved);
  const d = f.form.details;

  // 09. Total price is auto-calculated from size × price per sq. yard by default
  // (the backend recomputes it too, so this is only the preview).
  const size = Number(d.plot_size_sq_yards);
  const rate = Number(d.price_per_sq_yard);
  const autoTotal = size > 0 && rate > 0 ? Math.round(size * rate) : '';

  // Length × width (ft) → sq. yards, offered as a shortcut for 05.
  const len = Number(d.length_ft);
  const wid = Number(d.width_ft);
  const dimsSqYards = len > 0 && wid > 0 ? Math.round(((len * wid) / 9) * 100) / 100 : null;

  return (
    <ListingFormFrame
      f={f}
      title={f.isEdit ? 'Edit plot listing' : 'Plot listing form'}
      subtitle="20 details · 15 property fields + 5 contact fields"
      onCancel={onCancel}
    >
      <FormSection title="A. Plot Details (01-15)">
        <LocationFields f={f} label="Plot Location" />

        <FieldRow num="02" label="Venture / Layout Name" hint="Text">
          <TextInput value={d.venture_name} onChange={(v) => f.setDetail('venture_name', v)} placeholder="Layout name" maxLength={150} />
        </FieldRow>

        <FieldRow num="03" label="Plot Number" hint="Text">
          <TextInput value={d.plot_number} onChange={(v) => f.setDetail('plot_number', v)} placeholder="e.g. 42-A" maxLength={40} />
        </FieldRow>

        <FieldRow num="04" label="Plot Type" required hint="Dropdown">
          <OptionPills options={O.plot_type} value={d.plot_type} onChange={(v) => f.setDetail('plot_type', v)} />
        </FieldRow>

        <FieldRow num="05" label="Plot Size" hint="Number">
          <div className="lst-inline wrap">
            <NumberInput value={d.plot_size_sq_yards} onChange={(v) => f.setDetail('plot_size_sq_yards', v)} unit="sq. yards" />
            {dimsSqYards && String(dimsSqYards) !== String(d.plot_size_sq_yards) && (
              <button type="button" className="lst-link-btn" onClick={() => f.setDetail('plot_size_sq_yards', String(dimsSqYards))}>
                Use {dimsSqYards} sq. yd. from dimensions
              </button>
            )}
          </div>
        </FieldRow>

        <FieldRow num="06" label="Plot Dimensions" hint="Number">
          <div className="lst-inline wrap">
            <NumberInput value={d.length_ft} onChange={(v) => f.setDetail('length_ft', v)} unit="ft" placeholder="Length" />
            <span className="lst-times">×</span>
            <NumberInput value={d.width_ft} onChange={(v) => f.setDetail('width_ft', v)} unit="ft" placeholder="Width" />
          </div>
        </FieldRow>

        <FieldRow num="07" label="Plot Facing" hint="Dropdown">
          <OptionPills options={FACING_OPTIONS} value={d.facing} onChange={(v) => f.setDetail('facing', v)} />
        </FieldRow>

        <FieldRow num="08" label="Price per Sq. Yard" hint="Currency">
          <NumberInput value={d.price_per_sq_yard} onChange={(v) => f.setDetail('price_per_sq_yard', v)} prefix="Rs." step="1" />
        </FieldRow>

        <FieldRow num="09" label="Total Price" hint="Auto / Currency">
          <div className="lst-inline wrap">
            <NumberInput
              value={d.total_price_auto ? autoTotal : d.total_price}
              onChange={(v) => f.setDetail('total_price', v)}
              prefix="Rs."
              step="1"
              disabled={d.total_price_auto}
            />
            <label className="lst-check">
              <input
                type="checkbox"
                checked={d.total_price_auto}
                onChange={(e) => f.setDetail('total_price_auto', e.target.checked)}
              />
              Auto-calculated
            </label>
          </div>
          <RupeeHint value={d.total_price_auto ? autoTotal : d.total_price} />
        </FieldRow>

        <FieldRow num="10" label="Approval Type" hint="Dropdown">
          <OptionPills options={APPROVAL_OPTIONS} value={d.approval_type} onChange={(v) => f.setDetail('approval_type', v)} />
        </FieldRow>

        <FieldRow num="11" label="Road Width" hint="Number / Select">
          <RoadWidthPicker presets={O.road_width_presets} value={d.road_width_ft} onChange={(v) => f.setDetail('road_width_ft', v)} />
        </FieldRow>

        <FieldRow num="12" label="Road Type" hint="Dropdown">
          <OptionPills options={O.road_type} value={d.road_type} onChange={(v) => f.setDetail('road_type', v)} />
        </FieldRow>

        <FieldRow num="13" label="Plot Amenities" hint="Checkboxes">
          <CheckPills options={O.amenities} values={d.amenities} onToggle={(v) => f.toggleDetailList('amenities', v)} />
        </FieldRow>

        <GpsFields f={f} />
        <MediaFields f={f} type="plot" label="Plot Media" />
      </FormSection>

      <ContactSection f={f} type="plot" />
    </ListingFormFrame>
  );
}
