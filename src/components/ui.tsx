import { useState, type ReactNode } from 'react';
import type { Confidence } from '../model/types';

export function Panel({
  title,
  subtitle,
  children,
  right,
  icon,
}: {
  title?: string;
  subtitle?: ReactNode;
  children: ReactNode;
  right?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-edge bg-panel/90 shadow-[0_10px_30px_-12px_rgba(16,36,63,0.18)] backdrop-blur-sm">
      {title && (
        <header className="flex items-start justify-between gap-4 border-b border-edge bg-gradient-to-r from-sky-50/80 to-transparent px-5 py-4">
          <div className="flex items-start gap-2.5">
            {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
            <div>
              <h2 className="text-base font-bold tracking-tight text-ink">{title}</h2>
              {subtitle && <p className="mt-1 text-xs leading-relaxed text-muted">{subtitle}</p>}
            </div>
          </div>
          {right}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

/**
 * A disclosure for the rigorous-but-dense panels. The app's default view stays
 * readable; the full probability machinery is one click away rather than gone.
 */
export function Disclosure({
  label,
  hint,
  children,
  defaultOpen = false,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group flex items-center justify-between gap-3 rounded-2xl border border-edge bg-panel px-5 py-3.5 text-left transition hover:border-sky-300 hover:bg-panel"
      >
        <span>
          <span className="text-sm font-medium text-ink">{label}</span>
          {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
        </span>
        <span className="shrink-0 text-xs text-muted transition group-hover:text-sky-700">
          {open ? 'hide ▲' : 'show ▼'}
        </span>
      </button>
      {open && children}
    </div>
  );
}

export function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warn' | 'error';
  title?: string;
  children: ReactNode;
}) {
  const tones = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-rose-200 bg-rose-50 text-rose-900',
  } as const;
  return (
    <div className={`rounded-2xl border px-4 py-3 text-xs leading-relaxed ${tones[tone]}`}>
      {title && <div className="mb-1 font-semibold tracking-tight">{title}</div>}
      {children}
    </div>
  );
}

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  high: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-800',
  low: 'border-rose-200 bg-rose-50 text-rose-700',
};

export function ConfidenceBadge({ level }: { level: Confidence }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${CONFIDENCE_STYLE[level]}`}
      title={
        level === 'high'
          ? 'Well-replicated community estimate'
          : level === 'medium'
            ? 'Community estimate with meaningful spread'
            : 'Contested or highly event-dependent — override this if you can'
      }
    >
      {level}
    </span>
  );
}

export function NumberField({
  value,
  onChange,
  placeholder,
  className = '',
  ariaLabel,
}: {
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={value === undefined || Number.isNaN(value) ? '' : value}
      onChange={(e) => {
        const raw = e.target.value.trim();
        if (raw === '') return onChange(undefined);
        const n = Number(raw);
        if (!Number.isFinite(n)) return onChange(undefined);
        // Every field here is a count, a percentage or a rate denominator, so a
        // negative is always nonsense. The model clamps too, but without this
        // the input would sit there displaying "-5".
        onChange(Math.max(0, n));
      }}
      className={`rounded-xl border border-edge bg-white px-3 py-1.5 text-right text-sm font-semibold tabular-nums text-ink outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200 ${className}`}
    />
  );
}
