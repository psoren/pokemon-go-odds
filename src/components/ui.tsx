import type { ReactNode } from 'react';
import type { Confidence } from '../model/types';

export function Panel({
  title,
  subtitle,
  children,
  right,
}: {
  title?: string;
  subtitle?: ReactNode;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-edge/70 bg-panel/70 backdrop-blur-sm shadow-lg shadow-black/20">
      {title && (
        <header className="flex items-start justify-between gap-4 border-b border-edge/60 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-slate-100">{title}</h2>
            {subtitle && <p className="mt-1 text-xs leading-relaxed text-muted">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
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
    info: 'border-sky-500/40 bg-sky-500/10 text-sky-100',
    warn: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
    error: 'border-rose-500/50 bg-rose-500/10 text-rose-100',
  } as const;
  return (
    <div className={`rounded-xl border px-4 py-3 text-xs leading-relaxed ${tones[tone]}`}>
      {title && <div className="mb-1 font-semibold tracking-tight">{title}</div>}
      {children}
    </div>
  );
}

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  high: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  medium: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  low: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
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
        onChange(Number.isFinite(n) ? n : undefined);
      }}
      className={`rounded-lg border border-edge bg-ink/70 px-3 py-1.5 text-right text-sm tabular-nums text-slate-100 outline-none transition focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20 ${className}`}
    />
  );
}
