/**
 * The six clock wheels: which pairs can be crossed, how far out each rides,
 * the calendar arithmetic behind them, and a Date turned into wheel phasors.
 */

import type { HandVector, PlotPairDef, PolarCoordinate } from '../types';

export const PLOT_PAIRS: PlotPairDef[] = [
    { id: 'hour+minute', label: 'Hour × Minute', a: 'hour', b: 'minute' },
    { id: 'hour+second', label: 'Hour × Second', a: 'hour', b: 'second' },
    { id: 'minute+second', label: 'Minute × Second', a: 'minute', b: 'second' },
    { id: 'hour+date', label: 'Hour × Date', a: 'hour', b: 'date' },
    { id: 'minute+date', label: 'Minute × Date', a: 'minute', b: 'date' },
    { id: 'date+month', label: 'Date × Month', a: 'date', b: 'month' },
    { id: 'month+year', label: 'Month × Year', a: 'month', b: 'year' }
];

export function plotPairById(id: string): PlotPairDef {
    return PLOT_PAIRS.find(pair => pair.id === id) ?? PLOT_PAIRS[0];
}

/** Magnitudes of each wheel. Slower wheels sit closer to the matched centre. */
export const HAND_MAGNITUDES = {
    minute: 0.95,
    second: 0.85,
    hour: 0.60,
    date: 0.45,
    month: 0.30,
    year: 0.18
} as const;

/**
 * Days in the given month (1-based month index is taken from the Date).
 */
export function daysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Days in the given year (365 or 366).
 */
export function daysInYear(date: Date): number {
    const y = date.getFullYear();
    return ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 366 : 365;
}

/**
 * Fractional day-of-year, 0 at midnight on Jan 1.
 */
export function dayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 1);
    return (date.getTime() - start.getTime()) / 86400000;
}

/**
 * Every clock wheel as a phasor on the chart.
 *
 * Each wheel turns once per its own period and rides its own constant-VSWR
 * circle: the faster the wheel, the further from the matched centre it sits.
 * Twelve o'clock is straight up, so every phase is offset by -PI/2.
 */
export function handVectorsForTime(date: Date): HandVector[] {
    const ms = date.getMilliseconds();
    const seconds = date.getSeconds() + ms / 1000;
    const minutes = date.getMinutes() + seconds / 60;
    const hours12 = (date.getHours() % 12) + minutes / 60;

    const dim = daysInMonth(date);
    const dayFrac = (date.getDate() - 1) + (date.getHours() + minutes / 60) / 24;
    const monthFrac = date.getMonth() + dayFrac / dim;
    const yearFrac = (date.getFullYear() % 10) + dayOfYear(date) / daysInYear(date);

    const turn = (fraction: number, whole: number): number =>
        (fraction / whole) * (2 * Math.PI) - (Math.PI / 2);

    const pad = (n: number): string => n.toString().padStart(2, '0');

    return [
        {
            id: 'second', label: 'S', period: '60 s per revolution',
            value: pad(Math.floor(seconds)),
            polar: { magnitude: HAND_MAGNITUDES.second, phase: turn(seconds, 60) }
        },
        {
            id: 'minute', label: 'M', period: '60 min per revolution',
            value: pad(date.getMinutes()),
            polar: { magnitude: HAND_MAGNITUDES.minute, phase: turn(minutes, 60) }
        },
        {
            id: 'hour', label: 'H', period: '12 h per revolution',
            value: pad((date.getHours() % 12) || 12),
            polar: { magnitude: HAND_MAGNITUDES.hour, phase: turn(hours12, 12) }
        },
        {
            id: 'date', label: 'D', period: 'one month per revolution',
            value: pad(date.getDate()),
            polar: { magnitude: HAND_MAGNITUDES.date, phase: turn(dayFrac, dim) }
        },
        {
            id: 'month', label: 'MO', period: 'one year per revolution',
            value: pad(date.getMonth() + 1),
            polar: { magnitude: HAND_MAGNITUDES.month, phase: turn(monthFrac, 12) }
        },
        {
            id: 'year', label: 'Y', period: 'one decade per revolution',
            value: date.getFullYear().toString(),
            polar: { magnitude: HAND_MAGNITUDES.year, phase: turn(yearFrac, 10) }
        }
    ];
}

/**
 * The composite reflection coefficient: the vector sum of the hour and
 * minute phasors, renormalised so the pair can never leave the unit circle.
 *
 * This single point is what the day path traces, what the radially scaled
 * parameter cursor reads, and what the live formula panel substitutes into.
 */
export function compositePolarForTime(
    date: Date,
    pair: PlotPairDef = PLOT_PAIRS[0]
): PolarCoordinate {
    const hands = handVectorsForTime(date);
    const a = hands.find(h => h.id === pair.a)!.polar;
    const b = hands.find(h => h.id === pair.b)!.polar;

    const sumRe = a.magnitude * Math.cos(a.phase) + b.magnitude * Math.cos(b.phase);
    const sumIm = a.magnitude * Math.sin(a.phase) + b.magnitude * Math.sin(b.phase);

    const norm = a.magnitude + b.magnitude; // the reachable maximum for this pair
    return {
        magnitude: Math.min(1.0, Math.sqrt(sumRe * sumRe + sumIm * sumIm) / norm),
        phase: Math.atan2(sumIm, sumRe)
    };
}

/** How far through the local day `now` is, 0 at midnight, 1 at the next. */
export function dayFraction(now: Date): number {
    const secondsIntoDay =
        now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000;
    return secondsIntoDay / 86400;
}
