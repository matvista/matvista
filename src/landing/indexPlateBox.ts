/**
 * The figure index's outer box, as a formula rather than as two literals.
 *
 * `ModuleIndexPlate` is generated and lazily imported, so the landing page has
 * to reserve a correctly-shaped slot for it *before* the chunk arrives — that
 * reserved box is what keeps cumulative layout shift at zero over a full
 * scroll. It cannot read the ratio from the plate: the plate is the thing that
 * has not loaded yet.
 *
 * So the geometry lives here and both sides use it —
 * `scripts/gen-module-figures.ts` to lay the plate out, `Landing.tsx` to
 * reserve the slot. It used to be a literal `ratio="1224 / 724"` in the markup
 * beside a literal `IDX_H = 724` in the generator, which agreed until the
 * thirteenth module made the box a row taller and only one of them knew.
 *
 * **This file imports nothing on purpose.** The generator statically imports it
 * to have the constants at module scope, and its own resolver hook — the one
 * that lets plain Node follow the app's extensionless imports — is not
 * registered until `main` runs. A single `import … from '../nav'` here fails
 * the generator before any of it executes. The row counts are passed in.
 */

export const PLATE_MARGIN = 12;
export const PLATE_HEADER = 46;
export const PLATE_CELL_W = 300;
export const PLATE_CELL_H = 222;

/** Width for a given number of columns — one per course group. */
export function plateWidth(columns: number): number {
  return PLATE_MARGIN * 2 + columns * PLATE_CELL_W;
}

/**
 * Height for a given set of column depths. As deep as the deepest column, not
 * as deep as three rows: the columns stopped being equal at the thirteenth
 * module and will be 4/4/6/3 once the roadmap's five have shipped.
 */
export function plateHeight(rowsPerColumn: number[]): number {
  return PLATE_HEADER + Math.max(...rowsPerColumn) * PLATE_CELL_H + PLATE_MARGIN;
}
