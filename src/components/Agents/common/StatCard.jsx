/**
 * Metric tile used across the Agents section. Ported from the Garuda Firebase
 * design, so this section is styled with Tailwind rather than the app's
 * per-section CSS variables (see src/styles/agents-tailwind.css).
 */
export default function StatCard({
  title,
  value,
  subtext,
  change,
  isPositive,
  icon: Icon,
  variant = 'default',
  onClick,
}) {
  const isClickable = Boolean(onClick);

  const iconTone =
    variant === 'orange'
      ? 'bg-[#2563EB]/10 text-[#2563EB]'
      : variant === 'green'
      ? 'bg-[#2563EB]/10 text-[#2563EB]'
      : 'bg-[#f5f5f4] text-[#1c1917]';

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-[#e7e5e4] p-5 shadow-sm transition-all duration-200 ${
        isClickable ? 'cursor-pointer hover:border-[#2563EB]/40 hover:shadow-md' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#78716c]">
          {title}
        </span>
        {Icon && (
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconTone}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-[#1c1917]">{value}</span>
        {change && (
          <span
            className={`text-xs font-semibold ${
              isPositive ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {change}
          </span>
        )}
      </div>

      {subtext && <p className="mt-1.5 text-xs text-[#78716c] line-clamp-1">{subtext}</p>}
    </div>
  );
}
