/**
 * The 24-hour locus the composite phasor traces, and a per-day cache of it.
 */

import type { DayPathSample, DayPathSummary, PlotPairDef } from '../types';
import { gammaToNormalizedAdmittance, gammaToNormalizedImpedance, polarToGamma } from '../math/complex';
import { returnLossDbFromRho, swrFromRho } from '../math/metrics';
import { compositePolarForTime, PLOT_PAIRS } from './wheels';

/**
 * A full day of normalization and reflection, read off the clock arms.
 *
 * Walks local midnight to midnight, and at every sample converts the hour +
 * minute arm positions into Gamma, then into z = (1+G)/(1-G), y = 1/z and
 * VSWR = (1+|G|)/(1-|G|). The result is the locus the clock draws over 24 h.
 */
export function buildDayPath(
    date: Date,
    sampleMinutes: number = 2,
    pair: PlotPairDef = PLOT_PAIRS[0]
): DayPathSummary {
    const step = Math.max(1, Math.min(60, Math.round(sampleMinutes)));
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);

    const samples: DayPathSample[] = [];
    let bestMatch: DayPathSample | null = null;
    let worstMatch: DayPathSample | null = null;

    for (let minuteOfDay = 0; minuteOfDay <= 1440; minuteOfDay += step) {
        const m = Math.min(1440, minuteOfDay);
        const stamp = new Date(dayStart.getTime() + m * 60000);
        const polar = compositePolarForTime(stamp, pair);
        const gamma = polarToGamma(polar);
        const rho = polar.magnitude;

        const sample: DayPathSample = {
            minuteOfDay: m,
            hours: m / 60,
            date: stamp,
            polar,
            gamma,
            zNorm: gammaToNormalizedImpedance(gamma),
            yNorm: gammaToNormalizedAdmittance(gamma),
            vswr: swrFromRho(rho),
            returnLossDb: returnLossDbFromRho(rho)
        };
        samples.push(sample);

        if (!bestMatch || rho < bestMatch.polar.magnitude) bestMatch = sample;
        if (!worstMatch || rho > worstMatch.polar.magnitude) worstMatch = sample;
    }

    return { samples, bestMatch: bestMatch!, worstMatch: worstMatch!, dayStart };
}

/**
 * The day path is identical for every frame of a given day, so it is kept
 * and rebuilt only when the calendar day, the sample rate or the pair changes.
 */
export class DayPathCache {
    private cache: DayPathSummary | null = null;
    private cacheKey: string = '';

    public get(date: Date, sampleMinutes: number, pair: PlotPairDef): DayPathSummary {
        const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
            + `-${sampleMinutes}-${pair.id}`;
        if (!this.cache || this.cacheKey !== key) {
            this.cache = buildDayPath(date, sampleMinutes, pair);
            this.cacheKey = key;
        }
        return this.cache;
    }
}
