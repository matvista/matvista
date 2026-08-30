import { describe, expect, it } from 'vitest';
import { FIBRES, MATRICES, MEASURED, agreement } from './materials';
import { SELECTION_MATERIALS } from '../selection/materials';

/**
 * The constituents are a *join* onto `selection/materials.ts` by name, and a
 * join by string is the kind of thing that fails quietly: a renamed Appendix B
 * entry would empty a selector at runtime with nothing to say why. `resolve`
 * throws at module load, so importing this file at all is most of the test —
 * what is left is to check that the join lands on what it claims to.
 */
describe('constituents resolve onto Appendix B', () => {
  it('every fibre and matrix is an entry of the Ashby dataset', () => {
    const names = new Set(SELECTION_MATERIALS.map((m) => m.name));
    for (const c of [...FIBRES, ...MATRICES]) {
      expect(names.has(c.name), `${c.name} is not in SELECTION_MATERIALS`).toBe(true);
    }
  });

  it('carries the dataset’s values rather than a second copy of them', () => {
    for (const c of [...FIBRES, ...MATRICES]) {
      const row = SELECTION_MATERIALS.find((m) => m.name === c.name)!;
      expect(c.modulus).toBe(row.modulus);
      expect(c.density).toBe(row.density);
      expect(c.strength).toBe(row.strength);
    }
  });

  it('every fibre is stiffer and stronger than every matrix', () => {
    // Not decoration: it is what makes the reinforcement reinforce, and a
    // mis-joined name would show up here before it showed up as a plot.
    for (const f of FIBRES) {
      for (const m of MATRICES) {
        expect(f.modulus, `${f.label} vs ${m.label}`).toBeGreaterThan(m.modulus);
        expect(f.strength, `${f.label} vs ${m.label}`).toBeGreaterThan(m.strength);
      }
    }
  });

  it('measured composites name a real fibre, a real matrix and a real row', () => {
    const names = new Set(SELECTION_MATERIALS.map((m) => m.name));
    for (const c of MEASURED) {
      expect(FIBRES.some((f) => f.id === c.fibre), c.fibre).toBe(true);
      expect(MATRICES.some((m) => m.id === c.matrix), c.matrix).toBe(true);
      expect(names.has(c.name), c.name).toBe(true);
      expect(c.vf).toBeGreaterThan(0);
      expect(c.vf).toBeLessThan(1);
    }
    expect(agreement()).toHaveLength(MEASURED.length);
  });

  it('gives each fibre a nominal diameter in the range fibre actually comes in', () => {
    // 5–15 µm, in mm. The value only enters through l_c, where it scales the
    // answer linearly, so a stray factor of ten would be invisible in the plot
    // and wrong in the readout.
    for (const f of FIBRES) {
      expect(f.diameter).toBeGreaterThanOrEqual(0.005);
      expect(f.diameter).toBeLessThanOrEqual(0.015);
    }
  });

  it('marks glass isotropic and the two polymer-derived fibres not', () => {
    // Drives whether the transverse bound is presented as fair or as a floor.
    expect(FIBRES.find((f) => f.id === 'e-glass')!.isotropic).toBe(true);
    expect(FIBRES.filter((f) => !f.isotropic).map((f) => f.id).sort()).toEqual(['aramid', 'carbon']);
  });
});
