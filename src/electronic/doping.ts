/**
 * Dopant diffusion and the junction depth (P13).
 *
 * The junction panel starts from N_a and N_d as given numbers, and a student
 * leaves believing a p–n junction is an abrupt step. It is a diffusion profile
 * crossing a background level, and "abrupt" is an approximation you can watch
 * fail on the plot when the profile is shallow.
 *
 * It also joins two halves of the course that look unrelated: the same Fick's
 * second law that carburises a gear shaft dopes a wafer. Only the boundary
 * condition differs, and that difference is the exam question —
 *
 *   **Predeposition** holds the surface at a fixed concentration while dopant
 *   flows in, giving a complementary error function and a dose that grows as
 *   √(Dt).
 *
 *   **Drive-in** seals the surface, so a fixed dose redistributes, giving a
 *   Gaussian whose surface concentration *falls* as the profile deepens.
 *
 * **On the diffusivity.** D is a control here rather than a table of D₀ and
 * Q_d per dopant. This repo will not ship numbers it cannot source, and every
 * result below depends on D and t only through the product Dt — so a reader
 * who sets √(Dt) directly is doing the same physics with nothing invented.
 */
import { erf, erfInverse } from '../diffusion/model';

/** erfc(z) = 1 − erf(z). */
export function erfc(z: number): number {
  return 1 - erf(z);
}

/**
 * Predeposition profile: surface held at `Cs`, concentration at depth `x`.
 *
 *     C(x) = Cs · erfc( x / (2√(Dt)) )
 */
export function predepositionProfile(Cs: number, x: number, Dt: number): number {
  if (Dt <= 0) return x <= 0 ? Cs : 0;
  return Cs * erfc(x / (2 * Math.sqrt(Dt)));
}

/**
 * The dose taken in during predeposition, atoms per unit area.
 *
 *     Q = 2·Cs·√(Dt/π)
 *
 * This is the integral of the erfc profile, and it is what the drive-in step
 * then conserves.
 */
export function predepositionDose(Cs: number, Dt: number): number {
  return 2 * Cs * Math.sqrt(Dt / Math.PI);
}

/**
 * Drive-in profile: a fixed dose `Q` redistributing, no flux at the surface.
 *
 *     C(x) = Q / √(π·Dt) · exp( −x² / (4Dt) )
 */
export function driveInProfile(Q: number, x: number, Dt: number): number {
  if (Dt <= 0) return 0;
  return (Q / Math.sqrt(Math.PI * Dt)) * Math.exp(-(x ** 2) / (4 * Dt));
}

/** Surface concentration after drive-in — it falls as the profile deepens. */
export function driveInSurface(Q: number, Dt: number): number {
  return driveInProfile(Q, 0, Dt);
}

/**
 * Junction depth for a predeposition profile: where it crosses the background.
 *
 *     x_j = 2√(Dt) · erfc⁻¹(C_B / Cs)
 *
 * Null when the background is at or above the surface concentration, because
 * then there is no junction — the dopant never overcomes what is already
 * there, and returning a depth would invent one.
 */
export function predepositionJunction(Cs: number, cBackground: number, Dt: number): number | null {
  if (Dt <= 0 || Cs <= 0 || cBackground <= 0 || cBackground >= Cs) return null;
  // erfc(z) = ratio  ⇒  erf(z) = 1 − ratio
  const z = erfInverse(1 - cBackground / Cs);
  return z == null ? null : 2 * Math.sqrt(Dt) * z;
}

/**
 * Junction depth for a drive-in profile.
 *
 *     x_j = √( 4·Dt·ln( Q / (C_B·√(π·Dt)) ) )
 *
 * Null once the profile has spread so far that its own surface concentration
 * has fallen to the background: the junction has run out, which is a real
 * outcome of over-driving and not an error.
 */
export function driveInJunction(Q: number, cBackground: number, Dt: number): number | null {
  if (Dt <= 0 || Q <= 0 || cBackground <= 0) return null;
  const ratio = Q / (cBackground * Math.sqrt(Math.PI * Dt));
  if (ratio <= 1) return null;
  return Math.sqrt(4 * Dt * Math.log(ratio));
}

/**
 * How sharply the profile crosses the background, as a fraction of x_j.
 *
 * The abrupt-junction approximation assumes the transition is a step. This
 * reports the depth interval over which the net doping goes from ten times the
 * background to a tenth of it, divided by x_j — small means the step is a fair
 * picture, of order one means it is not.
 */
export function junctionSharpness(
  profile: (x: number) => number,
  cBackground: number,
  xj: number,
): number | null {
  if (!(xj > 0)) return null;
  const find = (target: number): number | null => {
    let lo = 0;
    let hi = xj * 20;
    if (profile(lo) < target) return null;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (profile(mid) > target) lo = mid;
      else hi = mid;
    }
    return hi;
  };
  const near = find(cBackground * 10);
  const far = find(cBackground / 10);
  if (near == null || far == null) return null;
  return (far - near) / xj;
}
