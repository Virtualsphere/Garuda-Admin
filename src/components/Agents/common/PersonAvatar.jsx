import { useState } from 'react';

/**
 * A person, as a circle. Falls back to coloured initials when there is no
 * photo — or when the photo fails to load, which matters because agent and
 * employee photos are external URLs that go stale.
 *
 * The colour is derived from the name rather than random, so the same person
 * is the same colour everywhere in the app.
 */

const COLORS = [
  { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
];

const SIZES = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-7 h-7 text-[11px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-11 h-11 text-sm',
  xl: 'w-14 h-14 text-base font-bold',
};

const colorFor = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
};

const initialsOf = (name) => {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default function PersonAvatar({
  photo,
  name,
  role,
  id,
  size = 'md',
  showDetails = false,
  subtext,
  badge,
  className = '',
}) {
  const [imageFailed, setImageFailed] = useState(false);

  const isNumeric = typeof size === 'number';
  const sizeClass = isNumeric ? '' : SIZES[size] || SIZES.md;
  const customStyle = isNumeric
    ? {
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        fontSize: `${Math.max(9, Math.round(size * 0.38))}px`,
      }
    : undefined;

  const safeName = name || 'Unknown';
  const color = colorFor(safeName);
  const hasPhoto = Boolean(photo) && !imageFailed;

  const circle = (
    <div className={`relative shrink-0 ${className}`}>
      {hasPhoto ? (
        <img
          src={photo}
          alt={safeName}
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
          style={customStyle}
          className={`${sizeClass} aspect-square rounded-full object-cover object-center shrink-0 border border-stone-200 shadow-2xs block`}
        />
      ) : (
        <div
          style={customStyle}
          className={`${sizeClass} aspect-square rounded-full ${color.bg} ${color.text} ${color.border} border font-bold flex items-center justify-center shrink-0 tracking-tight shadow-2xs select-none`}
        >
          {initialsOf(safeName)}
        </div>
      )}
      {badge && <div className="absolute -bottom-0.5 -right-0.5">{badge}</div>}
    </div>
  );

  if (!showDetails) return circle;

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {circle}
      <div className="min-w-0 text-left">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-stone-900 text-xs truncate max-w-[160px]">
            {safeName}
          </span>
          {id && (
            <span className="text-[10px] text-stone-500 bg-stone-100 px-1.5 rounded border border-stone-200">
              {id}
            </span>
          )}
        </div>
        {(role || subtext) && (
          <p className="text-[11px] text-stone-500 truncate max-w-[200px] leading-tight">
            {role} {subtext ? `• ${subtext}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}
