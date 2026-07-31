/**
 * Original SVG artwork — drawn here rather than pulled from sprite sheets, so
 * the app ships no third-party image assets and makes no network requests.
 * Pokéballs, sparkles and shadow flames are generic motifs; no creature designs
 * are reproduced.
 */

export function Pokeball({
  className = '',
  top = '#e5484d',
  bottom = '#f1f4fb',
  line = '#0b1020',
}: {
  className?: string;
  top?: string;
  bottom?: string;
  line?: string;
}) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="29" fill={bottom} />
      <path d="M3 32a29 29 0 0 1 58 0Z" fill={top} />
      <circle cx="32" cy="32" r="29" fill="none" stroke={line} strokeWidth="3.5" />
      <path d="M3.5 32h57" stroke={line} strokeWidth="4" />
      <circle cx="32" cy="32" r="9.5" fill={bottom} stroke={line} strokeWidth="4" />
      <circle cx="32" cy="32" r="4" fill={line} />
    </svg>
  );
}

/** The classic four-point sparkle used for shiny encounters. */
export function Sparkle({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        d="M32 2c2.4 17.6 12 27.2 30 30-18 2.8-27.6 12.4-30 30-2.4-17.6-12-27.2-30-30 18-2.8 27.6-12.4 30-30Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Three stat bars, all maxed — the hundo motif. */
export function PerfectIV({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      {[16, 30, 44].map((y) => (
        <g key={y}>
          <rect x="6" y={y - 5} width="52" height="10" rx="5" fill="currentColor" opacity="0.22" />
          <rect x="6" y={y - 5} width="52" height="10" rx="5" fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}

/** Sparkle + perfect bars: the intersection that makes a shundo. */
export function ShundoMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        d="M24 4c1.8 13.2 9 20.4 22.5 22.5C33 28.6 25.8 35.8 24 49 22.2 35.8 15 28.6 1.5 26.5 15 24.4 22.2 17.2 24 4Z"
        fill="currentColor"
      />
      {[44, 54].map((y) => (
        <rect key={y} x="30" y={y - 4} width="32" height="8" rx="4" fill="currentColor" />
      ))}
      <rect x="30" y="30" width="32" height="8" rx="4" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

/** Wispy flame for shadow Pokémon. */
export function ShadowFlame({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        d="M32 3c6 12-2 16-2 24 0 5 3 8 3 8s6-4 6-12c7 6 11 13 11 21 0 10-8 17-18 17S14 54 14 44c0-11 8-16 12-24 3-6 5-12 6-17Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** A raid-boss style ring, used to letter the Raids panel. */
export function RaidRing({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" strokeWidth="5" opacity="0.35" />
      <circle
        cx="32"
        cy="32"
        r="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="90 160"
      />
      <circle cx="32" cy="32" r="9" fill="currentColor" />
    </svg>
  );
}

export function EggMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        d="M32 5c11 0 21 18 21 30a21 21 0 0 1-42 0C11 23 21 5 32 5Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path d="M20 38h24M24 46h16" stroke="#0b1020" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

export function TradeArrows({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        d="M10 22h34l-9-9M54 42H20l9 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Big faint pokéball behind the page header. */
export function HeaderArt() {
  return (
    <div
      className="pointer-events-none absolute -right-6 -top-8 hidden h-40 w-40 rotate-12 opacity-[0.10] lg:block"
      aria-hidden="true"
    >
      <Pokeball top="#f6c453" bottom="#c084fc" line="#0b1020" className="h-full w-full" />
    </div>
  );
}

/** Category icon lookup for the medal form panels. */
export function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const cls = className ?? 'h-4 w-4';
  switch (category) {
    case 'Catches':
      return <Pokeball className={cls} top="#e5484d" bottom="#e8edf9" line="#0b1020" />;
    case 'Raids':
      return <RaidRing className={`${cls} text-amber-300`} />;
    case 'Team GO Rocket':
      return <ShadowFlame className={`${cls} text-violet-300`} />;
    case 'Eggs':
      return <EggMark className={`${cls} text-emerald-300`} />;
    case 'Trades':
      return <TradeArrows className={`${cls} text-sky-300`} />;
    default:
      return null;
  }
}
