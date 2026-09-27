/**
 * Everything read off |Gamma|: SWR, return and mismatch loss, transmission,
 * standing-wave figures and the interference between two hands.
 */

import type { ComplexNumber, ImpedanceMetrics, PolarCoordinate } from '../types';
import { gammaToNormalizedAdmittance, gammaToNormalizedImpedance, polarToGamma } from './complex';

export const INF = Infinity;

/** rho from SWR, and back. */
export const rhoFromSwr = (swr: number): number => (swr === INF ? 1 : (swr - 1) / (swr + 1));
/** VSWR = (1 + |Gamma|) / (1 - |Gamma|), infinite at total reflection. */
export const swrFromRho = (rho: number): number => (rho >= 0.9999 ? INF : (1 + rho) / (1 - rho));

/** Return Loss (dB) = -20 * log10(|Gamma|), infinite at a perfect match. */
export const returnLossDbFromRho = (rho: number): number =>
    (rho > 1e-5 ? -20 * Math.log10(rho) : INF);

/** Reflection (mismatch) Loss = -10 * log10(1 - |Gamma|^2), infinite at total reflection. */
export const mismatchLossDbFromRho = (rho: number): number => {
    const powerTransmission = 1 - (rho * rho);
    return powerTransmission > 1e-5 ? -10 * Math.log10(powerTransmission) : INF;
};

/**
 * Calculates complete impedance metrics from a polar coordinate point
 */
export function computeMetrics(
    polar: PolarCoordinate,
    z0: number = 50,
    otherHandPolar?: PolarCoordinate
): ImpedanceMetrics {
    const gamma = polarToGamma(polar);
    const gammaMag = polar.magnitude;
    let gammaPhaseDeg = (polar.phase * 180) / Math.PI;
    // Normalize angle to [-180, 180]
    while (gammaPhaseDeg > 180) gammaPhaseDeg -= 360;
    while (gammaPhaseDeg < -180) gammaPhaseDeg += 360;

    const zNorm = gammaToNormalizedImpedance(gamma);
    const zActual: ComplexNumber = {
        re: isFinite(zNorm.re) ? zNorm.re * z0 : Infinity,
        im: isFinite(zNorm.im) ? zNorm.im * z0 : Infinity
    };

    // y = Y/Y0 = 1/z = g + jb, sitting diametrically opposite z on the chart
    const yNorm = gammaToNormalizedAdmittance(gamma);
    const yActual: ComplexNumber = {
        re: isFinite(yNorm.re) ? yNorm.re / z0 : Infinity,
        im: isFinite(yNorm.im) ? yNorm.im / z0 : Infinity
    };

    const vswr = swrFromRho(gammaMag);
    const returnLossDb = returnLossDbFromRho(gammaMag);
    const mismatchLossDb = mismatchLossDbFromRho(gammaMag);
    const powerTransmission = 1 - (gammaMag * gammaMag);

    // Remaining radially scaled parameters (the nomograph beneath the chart)
    const transmCoeffP = Math.max(0, powerTransmission);
    const transmCoeffE = Math.sqrt(
        (1 + gamma.re) * (1 + gamma.re) + (gamma.im * gamma.im)
    );
    const swLossCoeff = powerTransmission > 1e-5
        ? (1 + gammaMag * gammaMag) / powerTransmission
        : Infinity;
    const swPeakConstP = gammaMag < 0.9999
        ? Math.sqrt((1 + gammaMag) / (1 - gammaMag))
        : Infinity;

    // Phase difference and interference ratio with another hand (e.g. Hour hand)
    let interferencePhaseDeg = 0;
    let interferenceRatio = 1.0;
    if (otherHandPolar) {
        let delta = Math.abs(polar.phase - otherHandPolar.phase);
        delta = delta % (2 * Math.PI);
        if (delta > Math.PI) delta = 2 * Math.PI - delta;
        interferencePhaseDeg = (delta * 180) / Math.PI;

        // Interference amplitude: |e^(j*theta1) + e^(j*theta2)| = 2 * cos(delta/2)
        interferenceRatio = 2 * Math.cos(delta / 2);
    }

    return {
        gamma,
        gammaMag,
        gammaPhaseDeg,
        zNorm,
        zActual,
        yNorm,
        yActual,
        vswr,
        returnLossDb,
        mismatchLossDb,
        transmCoeffP,
        transmCoeffE,
        swLossCoeff,
        swPeakConstP,
        interferencePhaseDeg,
        interferenceRatio
    };
}
