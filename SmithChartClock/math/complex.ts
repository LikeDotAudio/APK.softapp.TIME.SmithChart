/**
 * Conversions between the reflection coefficient Gamma, the normalized
 * impedance z and the normalized admittance y, plus the complex reciprocal.
 */

import type { ComplexNumber, PolarCoordinate } from '../types';

/**
 * Converts normalized polar reflection coefficient (Gamma) to Cartesian (U, V)
 */
export function polarToGamma(polar: PolarCoordinate): ComplexNumber {
    return {
        re: polar.magnitude * Math.cos(polar.phase),
        im: polar.magnitude * Math.sin(polar.phase)
    };
}

/**
 * Converts Cartesian reflection coefficient (Gamma_r, Gamma_i) to Polar (Mag, Phase)
 */
export function gammaToPolar(gamma: ComplexNumber): PolarCoordinate {
    const mag = Math.sqrt(gamma.re * gamma.re + gamma.im * gamma.im);
    const phase = Math.atan2(gamma.im, gamma.re);
    return { magnitude: Math.min(1.0, mag), phase };
}

/**
 * Transforms Reflection Coefficient Gamma into Normalized Impedance z = (1 + Gamma) / (1 - Gamma)
 */
export function gammaToNormalizedImpedance(gamma: ComplexNumber): ComplexNumber {
    const denom = (1 - gamma.re) * (1 - gamma.re) + (gamma.im * gamma.im);
    if (denom < 1e-7) {
        // Singularity at Gamma = (1, 0) -> Open Circuit
        return { re: Infinity, im: Infinity };
    }
    const r = (1 - (gamma.re * gamma.re) - (gamma.im * gamma.im)) / denom;
    const x = (2 * gamma.im) / denom;
    return { re: Math.max(0, r), im: x };
}

/**
 * Transforms Normalized Impedance z = r + jx to Reflection Coefficient Gamma = (z - 1) / (z + 1)
 */
export function normalizedImpedanceToGamma(z: ComplexNumber): ComplexNumber {
    if (!isFinite(z.re) || !isFinite(z.im)) {
        return { re: 1.0, im: 0.0 };
    }
    const denom = (z.re + 1) * (z.re + 1) + (z.im * z.im);
    if (denom < 1e-7) return { re: 1.0, im: 0.0 };

    const gammaRe = ((z.re * z.re) + (z.im * z.im) - 1) / denom;
    const gammaIm = (2 * z.im) / denom;
    return { re: gammaRe, im: gammaIm };
}

/**
 * Transforms Gamma into Normalized Admittance y = 1/z = (1 - Gamma) / (1 + Gamma)
 * The admittance point is the impedance point rotated 180 deg about the origin.
 */
export function gammaToNormalizedAdmittance(gamma: ComplexNumber): ComplexNumber {
    const denom = (1 + gamma.re) * (1 + gamma.re) + (gamma.im * gamma.im);
    if (denom < 1e-7) {
        // Singularity at Gamma = (-1, 0) -> Short Circuit -> infinite admittance
        return { re: Infinity, im: Infinity };
    }
    const g = (1 - (gamma.re * gamma.re) - (gamma.im * gamma.im)) / denom;
    const b = (-2 * gamma.im) / denom;
    return { re: Math.max(0, g), im: b };
}

/**
 * Reciprocal of a complex number, used for y = 1/z when z is finite.
 */
export function reciprocal(z: ComplexNumber): ComplexNumber {
    if (!isFinite(z.re) || !isFinite(z.im)) return { re: 0, im: 0 };
    const denom = (z.re * z.re) + (z.im * z.im);
    if (denom < 1e-12) return { re: Infinity, im: Infinity };
    return { re: z.re / denom, im: -z.im / denom };
}
