const VARIANT_STYLES = {
  orange: 'bg-[#2563EB]/10 text-[#2563EB] border-[#2563EB]/25',
  green: 'bg-[#2563EB]/10 text-[#2563EB] border-[#2563EB]/25',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  yellow: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-rose-50 text-rose-700 border-rose-200',
  gray: 'bg-[#f5f5f4] text-[#1c1917] border-[#e7e5e4]',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
};

const DOT_COLORS = {
  orange: 'bg-[#2563EB]',
  green: 'bg-[#2563EB]',
  blue: 'bg-blue-600',
  yellow: 'bg-amber-500',
  red: 'bg-rose-500',
  gray: 'bg-[#78716c]',
  purple: 'bg-purple-600',
};

const SIZE_STYLES = {
  sm: 'px-2.5 py-0.5 text-xs font-semibold',
  md: 'px-3 py-1 text-sm font-semibold',
};

export default function Badge({
  children,
  variant = 'gray',
  size = 'sm',
  className = '',
  dot = false,
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border tracking-wide whitespace-nowrap ${
        VARIANT_STYLES[variant] || VARIANT_STYLES.gray
      } ${SIZE_STYLES[size] || SIZE_STYLES.sm} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${DOT_COLORS[variant] || DOT_COLORS.gray}`}
        />
      )}
      {children}
    </span>
  );
}
