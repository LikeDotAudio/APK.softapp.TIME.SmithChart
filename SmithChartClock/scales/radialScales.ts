/**
 * The nomograph's ruler table: the six-by-two "RADIALLY SCALED PARAMETERS"
 * rulers and how their printed values are formatted.
 */

import type { RadialScaleDef } from '../types';
import { INF, returnLossDbFromRho, rhoFromSwr, swrFromRho } from '../math/metrics';

/**
 * The six rulers of the standard chart, top to bottom.
 *
 * Left half runs rho = 1 at the far left to rho = 0 at CENTER and carries the
 * reflection-side parameters; the right half runs rho = 0 at CENTER back out to
 * rho = 1 and carries the transmission-side parameters. The bottom ruler spans
 * the whole width because it is linear in Gamma itself, not in |Gamma|.
 */
export const RADIAL_SCALES: RadialScaleDef[] = [
    {
        id: 'swr', row: 0, side: 'left', label: 'SWR', formula: 'SWR = (1 + |\u0393|) / (1 - |\u0393|)',
        rhoOf: rhoFromSwr, valueOf: swrFromRho, precision: 2,
        ticks: [INF, 100, 40, 20, 10, 5, 4, 3, 2.5, 2, 1.8, 1.6, 1.4, 1.2, 1.1, 1]
    },
    {
        id: 'dbs', row: 1, side: 'left', label: 'dBS', formula: 'dBS = 20\u00b7log\u2081\u2080(SWR)',
        rhoOf: (d) => (d === INF ? 1 : rhoFromSwr(Math.pow(10, d / 20))),
        valueOf: (rho) => (rho >= 0.9999 ? INF : 20 * Math.log10(swrFromRho(rho))),
        precision: 2,
        ticks: [INF, 40, 30, 20, 15, 10, 8, 6, 5, 4, 3, 2, 1, 0]
    },
    {
        id: 'rtnLoss', row: 2, side: 'left', label: 'RTN. LOSS [dB]', formula: 'RL = -20\u00b7log\u2081\u2080|\u0393|',
        rhoOf: (l) => (l === INF ? 0 : Math.pow(10, -l / 20)),
        valueOf: returnLossDbFromRho,
        precision: 2,
        ticks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 20, 30, INF]
    },
    {
        id: 'rflCoeffE', row: 3, side: 'left', label: 'RFL. COEFF. E or I', formula: '|\u0393| = (SWR - 1)/(SWR + 1)',
        rhoOf: (v) => v, valueOf: (rho) => rho, precision: 3,
        ticks: [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.05, 0.01, 0]
    },
    {
        id: 'rflCoeffP', row: 4, side: 'left', label: 'RFL. COEFF. P', formula: '|\u0393|\u00b2 = reflected / incident power',
        rhoOf: (v) => Math.sqrt(Math.max(0, v)), valueOf: (rho) => rho * rho, precision: 3,
        ticks: [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0]
    },

    {
        id: 'atten', row: 0, side: 'right', label: 'ATTEN. [dB]', formula: 'A = -10\u00b7log\u2081\u2080|\u0393|  (1 dB steps of line loss)',
        rhoOf: (a) => (a === INF ? 0 : Math.pow(10, -a / 10)),
        valueOf: (rho) => (rho > 1e-5 ? -10 * Math.log10(rho) : INF),
        precision: 2,
        ticks: [1, 2, 3, 4, 5, 7, 10, 15]
    },
    {
        id: 'swLossCoeff', row: 1, side: 'right', label: 'S.W. LOSS COEFF', formula: '(1 + |\u0393|\u00b2) / (1 - |\u0393|\u00b2)',
        rhoOf: (c) => (c === INF ? 1 : Math.sqrt(Math.max(0, (c - 1) / (c + 1)))),
        valueOf: (rho) => (rho >= 0.9999 ? INF : (1 + rho * rho) / (1 - rho * rho)),
        precision: 3,
        ticks: [1, 1.1, 1.2, 1.3, 1.4, 1.6, 1.8, 2, 3, 4, 5, 10, 20, INF]
    },
    {
        id: 'rflLoss', row: 2, side: 'right', label: 'RFL. LOSS [dB]', formula: 'ML = -10\u00b7log\u2081\u2080(1 - |\u0393|\u00b2)',
        rhoOf: (l) => (l === INF ? 1 : Math.sqrt(Math.max(0, 1 - Math.pow(10, -l / 10)))),
        valueOf: (rho) => (rho >= 0.9999 ? INF : -10 * Math.log10(1 - rho * rho)),
        precision: 3,
        ticks: [0, 0.1, 0.2, 0.4, 0.6, 0.8, 1, 1.5, 2, 3, 4, 5, 6, 10, 15, INF]
    },
    {
        id: 'swPeak', row: 3, side: 'right', label: 'S.W. PEAK (CONST. P)', formula: '\u221a((1 + |\u0393|) / (1 - |\u0393|))',
        rhoOf: (p) => (p === INF ? 1 : (p * p - 1) / (p * p + 1)),
        valueOf: (rho) => (rho >= 0.9999 ? INF : Math.sqrt((1 + rho) / (1 - rho))),
        precision: 3,
        ticks: [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2, 2.5, 3, 4, 5, 10, INF]
    },
    {
        id: 'transmP', row: 4, side: 'right', label: 'TRANSM. COEFF. P', formula: '1 - |\u0393|\u00b2 = transmitted / incident power',
        rhoOf: (t) => Math.sqrt(Math.max(0, 1 - t)), valueOf: (rho) => 1 - rho * rho, precision: 3,
        ticks: [1, 0.99, 0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0]
    },

    {
        id: 'transmE', row: 5, side: 'full', label: 'TRANSM. COEFF. E or I', formula: '\u03c4 = 1 + \u0393   (0 at the short, 2 at the open)',
        // Linear in Gamma, so the ruler spans the full width: 0 at ORIGIN, 1 at
        // CENTER, 2 at the far right. Positions are handled by the renderer.
        rhoOf: (v) => Math.abs(v - 1), valueOf: (rho) => 1 + rho, precision: 3,
        ticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1,
                1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2]
    }
];

/**
 * Formats a scale value for printing, collapsing Infinity to the usual glyph.
 */
export function formatScaleValue(v: number, precision: number = 2): string {
    if (!isFinite(v)) return '\u221e';
    if (Number.isInteger(v)) return v.toString();
    return parseFloat(v.toFixed(precision)).toString();
}
