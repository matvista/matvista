// Sequential blue ramp (validated reference palette): light → dark = low → high.
export const RAMP = [
  '#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7',
  '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b',
];

// Ink flips once cells get dark enough that primary ink would fail contrast.
const DARK_INK_MAX_STEP = 6;

export function rampColor(t: number): { bg: string; ink: 'dark' | 'light' } {
  const clamped = Math.min(1, Math.max(0, t));
  const i = Math.min(RAMP.length - 1, Math.floor(clamped * RAMP.length));
  return { bg: RAMP[i], ink: i <= DARK_INK_MAX_STEP ? 'dark' : 'light' };
}

export function normalize(
  value: number,
  min: number,
  max: number,
  log = false,
): number {
  if (log) {
    const lmin = Math.log10(min);
    return (Math.log10(value) - lmin) / (Math.log10(max) - lmin);
  }
  return (value - min) / (max - min);
}
