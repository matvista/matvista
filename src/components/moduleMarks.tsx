import type { Tab } from '../nav';

/**
 * The twelve module signature marks.
 *
 * Each mark is the module's own visual signature, reduced to its outline: a
 * reader who has used the app should recognise the module before reading. At
 * index scale they work as bullets that happen to mean something.
 *
 * They live here rather than in `Landing.tsx` because two surfaces draw them
 * now — the landing page's module index and the header's group menus — and a
 * module drawn one way on the front page and listed as bare text in the header
 * is the same module twice, which is worse than either. Kept as inline SVG for
 * the reason the landing page keeps its plates that way: no request, and the
 * fills are `var(--ld-art)` / `var(--ld-accent)`, so one asset themes for
 * light and dark instead of needing a copy per theme. Whatever scope renders
 * them owns those two properties — `.ld` on the landing page, `.nav-menu` in
 * the header.
 */

const artPeriodic = (
  <svg viewBox="0 0 96 60" aria-hidden="true">
    {Array.from({ length: 9 }, (_, c) =>
      Array.from({ length: 5 }, (_, r) => (
        <rect
          key={`${c}-${r}`}
          x={4 + c * 10}
          y={4 + r * 10}
          width={8}
          height={8}
          rx={1.5}
          fill="var(--ld-art)"
          opacity={0.25 + ((c + r * 2) % 7) * 0.11}
        />
      )),
    )}
  </svg>
);

const artCrystal = (
  <svg viewBox="0 0 96 60" aria-hidden="true">
    <g stroke="var(--ld-art)" strokeWidth="1" fill="none" opacity="0.55">
      <path d="M28 18h30v26H28z" />
      <path d="M40 10h30v26H40z" />
      <path d="M28 18l12-8M58 18l12-8M58 44l12-8M28 44l12-8" />
    </g>
    {[[28, 18], [58, 18], [28, 44], [58, 44], [40, 10], [70, 10], [70, 36], [40, 36], [49, 27]].map(
      ([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={i === 8 ? 6 : 4.5} fill="var(--ld-art)" />
      ),
    )}
  </svg>
);

const artMiller = (
  <svg viewBox="0 0 96 60" aria-hidden="true">
    <g stroke="var(--ld-art)" strokeWidth="1" fill="none" opacity="0.5">
      <path d="M26 16h34v30H26z" />
      <path d="M38 8h34v30H38z" />
      <path d="M26 16l12-8M60 16l12-8M60 46l12-8M26 46l12-8" />
    </g>
    <path d="M26 46L60 16l12-8-34 30z" fill="var(--ld-art)" opacity="0.42" />
    <path d="M26 46L60 16" stroke="var(--ld-art)" strokeWidth="1.6" fill="none" />
  </svg>
);

const artDefects = (
  <svg viewBox="0 0 96 60" aria-hidden="true">
    {Array.from({ length: 6 }, (_, c) =>
      Array.from({ length: 4 }, (_, r) => {
        const gap = c === 3 && r === 1;
        return gap ? (
          <circle
            key={`${c}-${r}`}
            cx={14 + c * 14}
            cy={12 + r * 12}
            r={4.5}
            fill="none"
            stroke="var(--ld-art)"
            strokeDasharray="2 2"
          />
        ) : (
          <circle
            key={`${c}-${r}`}
            cx={14 + c * 14}
            cy={12 + r * 12}
            r={4.5}
            fill="var(--ld-art)"
            opacity={0.75}
          />
        );
      }),
    )}
  </svg>
);

const artPhase = (
  <svg viewBox="0 0 96 60" aria-hidden="true">
    <path d="M12 50h74M12 50V8" stroke="var(--ld-art)" strokeWidth="1" opacity="0.5" fill="none" />
    <path d="M12 16Q40 44 52 44Q66 44 86 20" fill="none" stroke="var(--ld-art)" strokeWidth="1.6" />
    <path d="M12 30Q34 44 52 44Q70 44 86 34" fill="none" stroke="var(--ld-art)" strokeWidth="1.2" opacity="0.6" />
    <path d="M12 44h74" stroke="var(--ld-art)" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
    <circle cx="52" cy="44" r="3.2" fill="var(--ld-accent)" />
  </svg>
);

const artHeat = (
  <svg viewBox="0 0 96 60" aria-hidden="true">
    <path d="M12 50h74M12 50V8" stroke="var(--ld-art)" strokeWidth="1" opacity="0.5" fill="none" />
    <path d="M22 12Q52 22 34 30Q52 40 74 48" fill="none" stroke="var(--ld-art)" strokeWidth="1.6" />
    <path d="M30 12Q66 24 46 32Q64 42 84 48" fill="none" stroke="var(--ld-art)" strokeWidth="1.1" strokeDasharray="3 2" opacity="0.6" />
    <path d="M14 10L76 46" stroke="var(--ld-accent)" strokeWidth="1.5" fill="none" />
  </svg>
);

const artStress = (
  <svg viewBox="0 0 96 60" aria-hidden="true">
    <path d="M12 50h74M12 50V8" stroke="var(--ld-art)" strokeWidth="1" opacity="0.5" fill="none" />
    <path d="M12 50L30 20Q46 8 62 14Q74 19 80 34" fill="none" stroke="var(--ld-art)" strokeWidth="1.8" />
    <path d="M20 50L34 27" stroke="var(--ld-accent)" strokeWidth="1.1" strokeDasharray="3 2" fill="none" />
    <circle cx="62" cy="14" r="3" fill="var(--ld-accent)" />
  </svg>
);

const artXrd = (
  <svg viewBox="0 0 96 60" aria-hidden="true">
    <path d="M10 50h78" stroke="var(--ld-art)" strokeWidth="1" opacity="0.5" fill="none" />
    {[[20, 16], [30, 34], [42, 24], [52, 42], [60, 30], [70, 44], [80, 40]].map(([x, y], i) => (
      <path key={i} d={`M${x} 50V${y}`} stroke="var(--ld-art)" strokeWidth="2.2" strokeLinecap="round" />
    ))}
  </svg>
);

const artSelection = (
  <svg viewBox="0 0 96 60" aria-hidden="true">
    <path d="M12 50h74M12 50V8" stroke="var(--ld-art)" strokeWidth="1" opacity="0.5" fill="none" />
    {[[26, 34], [34, 24], [44, 30], [40, 16], [56, 22], [64, 36], [70, 18], [50, 40], [78, 28]].map(
      ([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={3.4} fill="var(--ld-art)" opacity={0.7} />
      ),
    )}
    <path d="M16 46L82 12" stroke="var(--ld-accent)" strokeWidth="1.5" strokeDasharray="4 3" fill="none" />
  </svg>
);

const artFailure = (
  <svg viewBox="0 0 96 60" aria-hidden="true">
    <path d="M12 50h74M12 50V8" stroke="var(--ld-art)" strokeWidth="1" opacity="0.5" fill="none" />
    {/* an S–N curve that knees over into an endurance limit */}
    <path d="M16 14Q40 34 58 40H84" fill="none" stroke="var(--ld-art)" strokeWidth="1.8" />
    <path d="M58 40H84" fill="none" stroke="var(--ld-accent)" strokeWidth="1.8" />
    {/* a crack opening from the edge */}
    <path d="M20 50l4-6 3 5 3-6" fill="none" stroke="var(--ld-accent)" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

const artCorrosion = (
  <svg viewBox="0 0 96 60" aria-hidden="true">
    {/* two metals joined, with the anode pitting away beneath the electrolyte */}
    <path d="M10 44h34v10H10z" fill="var(--ld-accent)" opacity="0.55" />
    <path d="M52 44h34v10H52z" fill="var(--ld-art)" opacity="0.5" />
    <path d="M44 49h8" stroke="var(--ld-art)" strokeWidth="1.6" />
    <path d="M8 34h80" stroke="var(--ld-art)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" fill="none" />
    {[16, 24, 32].map((x, i) => (
      <circle key={i} cx={x} cy={44} r={3.2} fill="var(--ld-art)" opacity="0.85" />
    ))}
    {/* current arcs from anode to cathode */}
    <path d="M24 40Q48 18 70 40" fill="none" stroke="var(--ld-accent)" strokeWidth="1.3" />
  </svg>
);

const artSemi = (
  <svg viewBox="0 0 96 60" aria-hidden="true">
    {/* bands bending across a junction, with the flat Fermi level */}
    <path d="M10 20h30q8 0 12 -9h34" fill="none" stroke="var(--ld-art)" strokeWidth="1.8" />
    <path d="M10 46h30q8 0 12 -9h34" fill="none" stroke="var(--ld-art)" strokeWidth="1.8" />
    <path d="M10 33h76" fill="none" stroke="var(--ld-accent)" strokeWidth="1.3" strokeDasharray="4 3" />
    <rect x="38" y="8" width="18" height="44" fill="var(--ld-accent)" opacity="0.16" />
  </svg>
);

/** Keyed by module id, so a caller can go straight from a nav item to its mark. */
export const MODULE_MARKS: Record<Tab, React.ReactNode> = {
  trends: artPeriodic,
  crystals: artCrystal,
  miller: artMiller,
  defects: artDefects,
  phase: artPhase,
  heattreat: artHeat,
  mechanical: artStress,
  failure: artFailure,
  semiconductors: artSemi,
  corrosion: artCorrosion,
  xrd: artXrd,
  selection: artSelection,
};
