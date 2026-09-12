import { useEffect } from 'react';
import { X } from 'lucide-react';

const WIDTHS = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

/**
 * Modal shell for the Agents section, matching the Garuda Firebase card style.
 *
 * `onClose` fires on backdrop click and on Escape — a dialog the keyboard
 * cannot dismiss is a trap, and these are all cancellable actions.
 */
export default function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = 'md',
  tone = 'default',
}) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[1000] bg-[#1c1917]/40 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl border border-[#e7e5e4] shadow-2xl w-full ${
          WIDTHS[size] || WIDTHS.md
        } max-h-[90vh] flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div
          className={`px-5 py-4 border-b border-[#e7e5e4] flex items-start justify-between gap-3 ${
            tone === 'dark' ? 'bg-[#1c1917] text-white' : 'bg-white'
          }`}
        >
          <div>
            <h3
              className={`text-sm font-extrabold uppercase tracking-wide ${
                tone === 'dark' ? 'text-white' : 'text-[#1c1917]'
              }`}
            >
              {title}
            </h3>
            {subtitle && (
              <p
                className={`text-xs mt-0.5 ${
                  tone === 'dark' ? 'text-orange-200' : 'text-[#78716c]'
                }`}
              >
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`p-1 rounded-lg transition-colors ${
              tone === 'dark'
                ? 'text-gray-300 hover:text-white hover:bg-white/10'
                : 'text-[#78716c] hover:text-[#1c1917] hover:bg-[#f5f5f4]'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1">{children}</div>

        {footer && (
          <div className="px-5 py-4 border-t border-[#e7e5e4] bg-[#fafaf9] flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Shared form atoms, so every Agents modal reads the same ───── */

export function ModalError({ children }) {
  if (!children) return null;
  return (
    <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl px-3 py-2">
      {children}
    </div>
  );
}

export function ModalCallout({ children, tone = 'orange' }) {
  const styles =
    tone === 'amber'
      ? 'bg-amber-50 border-amber-200 text-amber-900'
      : 'bg-orange-50 border-orange-200 text-orange-900';
  return (
    <div className={`border rounded-xl px-3 py-2.5 text-xs leading-relaxed ${styles}`}>
      {children}
    </div>
  );
}

export function ModalEmpty({ children }) {
  return (
    <div className="p-6 text-center bg-[#fafaf9] rounded-xl border border-[#e7e5e4] text-xs text-[#78716c]">
      {children}
    </div>
  );
}

export function Field({ label, htmlFor, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-xs font-bold text-[#57534e] uppercase tracking-wide"
      >
        {label}
      </label>
      {children}
      {hint && <span className="block text-[10px] text-[#78716c]">{hint}</span>}
    </div>
  );
}

export const inputClass =
  'w-full text-xs bg-[#fafaf9] border border-[#e7e5e4] rounded-xl px-3 py-2 font-medium text-[#1c1917] focus:bg-white focus:border-[#2563EB]';

export function GhostButton({ children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className="px-3.5 py-2 rounded-xl border border-[#e7e5e4] bg-white text-xs font-bold text-[#57534e] hover:bg-[#f5f5f4]"
    >
      {children}
    </button>
  );
}

export function PrimaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      className="px-4 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-bold hover:bg-[#1d4ed8] disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}
