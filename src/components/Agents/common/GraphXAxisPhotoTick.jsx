/**
 * Recharts X-axis tick that draws the team leader's face instead of a label.
 *
 * Recharts renders ticks inside the chart's SVG, so the avatar has to come in
 * through a `foreignObject` — there is no way to put an <img> with rounded
 * cropping into an SVG axis otherwise.
 */
export default function GraphXAxisPhotoTick({
  x = 0,
  y = 0,
  payload,
  data = [],
  showBadge = false,
}) {
  if (!payload) return null;

  const index =
    payload.index !== undefined
      ? payload.index
      : data.findIndex((d) => d.name === payload.value);
  const item = data[index] || data.find((d) => d.name === payload.value);

  // An unmatched tick still needs a label, or the axis silently loses a point.
  if (!item) {
    return (
      <text x={x} y={y + 12} textAnchor="middle" fontSize={9} fill="#64748b">
        {payload.value}
      </text>
    );
  }

  const displayName = item.leader || item.name;
  const badgeLabel = showBadge ? item.name : null;

  return (
    <g transform={`translate(${x},${y})`}>
      <foreignObject x={-20} y={3} width={40} height={42} className="overflow-visible">
        <div
          className="flex flex-col items-center justify-start pointer-events-none select-none"
          title={`${item.fullName || item.name}${item.leader ? ` (TL: ${item.leader})` : ''}`}
        >
          <div className="relative">
            <div className="w-5 h-5 rounded-full overflow-hidden border border-stone-300 bg-stone-100 shadow-2xs flex items-center justify-center">
              <span className="text-[7.5px] font-bold text-stone-600">
                {String(displayName || '?').charAt(0)}
              </span>
              {item.photo && (
                <img
                  src={item.photo}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    // Drop back to the initial underneath rather than a broken icon.
                    e.currentTarget.style.display = 'none';
                  }}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
            </div>

            {badgeLabel && (
              <span className="absolute -bottom-1 -right-1 bg-stone-900 text-amber-400 text-[6.5px] font-extrabold px-0.5 rounded-xs leading-none border border-stone-800">
                {badgeLabel}
              </span>
            )}
          </div>

          <span className="text-[8px] font-medium text-stone-600 mt-1 leading-tight max-w-[42px] truncate text-center">
            {displayName}
          </span>
        </div>
      </foreignObject>
    </g>
  );
}
