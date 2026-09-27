/**
 * Every colour derived from a date: Date-DNA, the chronobiological mood, the
 * spiral's per-segment colour, the hand colours per engine, and the calendar arms.
 */

import type { DateDNA, MoodData, SmithChartClockOptions } from '../types';

/**
 * Calculates the "Date DNA" color
 * Formula:
 * R: 200 + Month (1..12 -> 201..212)
 * G: 100 + Day (1..31 -> 101..131)
 * B: Last 2 digits of Year (e.g. 1944 -> 44, 2026 -> 26)
 */
export function computeDateDNA(date: Date): DateDNA {
    const month = date.getMonth() + 1; // 1 to 12
    const day = date.getDate();        // 1 to 31
    const year = date.getFullYear();
    const yearLastTwo = Math.abs(year) % 100;

    const r = Math.min(255, 200 + month);
    const g = Math.min(255, 100 + day);
    const b = Math.min(255, yearLastTwo);

    const hexR = r.toString(16).padStart(2, '0');
    const hexG = g.toString(16).padStart(2, '0');
    const hexB = b.toString(16).padStart(2, '0');
    const hex = `#${hexR}${hexG}${hexB}`;

    return {
        r,
        g,
        b,
        hex,
        rgbString: `rgb(${r}, ${g}, ${b})`
    };
}

/**
 * Calculates the Chronobiological Mood Color
 * - Day of year mapped to seasonal hue (Winter: Blue, Spring: Green, Summer: Yellow, Autumn: Red/Magenta)
 * - Solar cycle mapped to lightness (Noon = 70%, Midnight = 30%)
 */
export function computeMood(date: Date): MoodData {
    // 1. Day of the Year
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.max(1, Math.min(366, Math.floor(diff / oneDay)));

    // 2. Seasonal Hue: Offset by ~100 deg
    let hue = ((dayOfYear / 365.25) * 360) + 100;
    hue = (hue % 360 + 360) % 360;

    // 3. Solar Cycle Lightness (Midnight=30%, Noon=70%)
    const hours = date.getHours() + (date.getMinutes() / 60) + (date.getSeconds() / 3600);
    const solarLightness = 30 + (40 * Math.sin((hours / 24) * Math.PI));

    const saturation = 85;
    const hslString = `hsl(${Math.round(hue)}, ${saturation}%, ${Math.round(solarLightness)}%)`;

    return {
        hue,
        saturation,
        lightness: solarLightness,
        hslString,
        dayOfYear,
        solarLightness
    };
}

type ColorEngine = NonNullable<SmithChartClockOptions['colorEngine']>;

/** The colour of one segment of the Date-DNA historical spiral. */
export function spiralSegmentColour(engine: ColorEngine, simDate: Date, simYears: number): string {
    if (engine === 'date-dna') {
        const dna = computeDateDNA(simDate);
        return `rgba(${dna.r}, ${dna.g}, ${dna.b}, 0.75)`;
    } else if (engine === 'mood') {
        const mood = computeMood(simDate);
        return `hsla(${Math.round(mood.hue)}, 85%, ${Math.round(mood.lightness)}%, 0.75)`;
    }
    // Cyber glow orange/magenta gradient
    const hue = (simYears * 13) % 360;
    return `hsla(${hue}, 90%, 60%, 0.7)`;
}

/** Hour, minute and second hand colours for the active engine over a theme's own. */
export function handColours(
    engine: ColorEngine,
    now: Date,
    theme: { hourHand: string; minuteHand: string; secondHand: string }
): { hour: string; minute: string; second: string } {
    let hour = theme.hourHand;
    let minute = theme.minuteHand;
    const second = theme.secondHand;

    if (engine === 'date-dna') {
        const dna = computeDateDNA(now);
        hour = dna.hex;
        minute = `rgba(${dna.r}, ${dna.g}, ${dna.b}, 0.8)`;
    } else if (engine === 'mood') {
        const mood = computeMood(now);
        hour = mood.hslString;
        minute = `hsla(${Math.round(mood.hue)}, 85%, ${Math.round(mood.lightness)}%, 0.7)`;
    }
    return { hour, minute, second };
}

/** The date, month and year arms. */
export const CALENDAR_COLOURS: Record<string, string> = {
    date: '#10b981',
    month: '#f59e0b',
    year: '#94a3b8'
};
