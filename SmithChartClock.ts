/**
 * SmithChartClock.ts
 * 
 * High-Precision Smith Chart Clock, Chronobiological Mood Engine, 
 * Date-DNA Historical Spiral, and RF Phasor Vector System.
 * 
 * Developed for OneThing / OpenAir libControl
 */

export interface PolarCoordinate {
    magnitude: number; // Normalized from 0.0 (center, matched) to 1.0 (outer boundary, total reflection)
    phase: number;     // Phase angle in radians (-PI to +PI or 0 to 2*PI)
}

export interface CartesianCoordinate {
    x: number; // In canvas pixel coordinates or normalized [-1, 1]
    y: number;
}

export interface ComplexNumber {
    re: number;
    im: number;
}

export interface ImpedanceMetrics {
    gamma: ComplexNumber;       // Reflection coefficient Gamma = re + j*im
    gammaMag: number;           // |Gamma| (0 to 1)
    gammaPhaseDeg: number;      // Angle in degrees (-180 to +180)
    zNorm: ComplexNumber;       // Normalized impedance z = Z/Z0 = r + jx
    zActual: ComplexNumber;     // Actual impedance Z = R + jX (Ohms)
    yNorm: ComplexNumber;       // Normalized admittance y = Y/Y0 = 1/z = g + jb
    yActual: ComplexNumber;     // Actual admittance Y = G + jB (Siemens)
    vswr: number;               // Voltage Standing Wave Ratio (1 to Infinity)
    returnLossDb: number;       // Return loss in dB (-20 * log10(|Gamma|))
    mismatchLossDb: number;     // Mismatch (reflection) loss in dB
    transmCoeffP: number;       // Power transmission coefficient 1 - |Gamma|^2
    transmCoeffE: number;       // Voltage transmission coefficient |1 + Gamma| (0 to 2)
    swLossCoeff: number;        // Standing wave loss coefficient (1 + |G|^2)/(1 - |G|^2)
    swPeakConstP: number;       // Standing wave peak, constant P: sqrt((1+|G|)/(1-|G|))
    interferencePhaseDeg: number; // Phase difference between hands
    interferenceRatio: number;  // Normalized constructive/destructive factor (0 to 2)
}

/** One sample of the 24-hour "path of the day" traced by the clock hands. */
export interface DayPathSample {
    minuteOfDay: number;        // 0 .. 1439
    hours: number;              // fractional hours since local midnight
    date: Date;
    polar: PolarCoordinate;     // composite reflection coefficient, polar form
    gamma: ComplexNumber;       // composite reflection coefficient, cartesian form
    zNorm: ComplexNumber;       // normalized impedance z = (1 + G)/(1 - G)
    yNorm: ComplexNumber;       // normalized admittance y = 1/z = (1 - G)/(1 + G)
    vswr: number;
    returnLossDb: number;
}

export interface DayPathSummary {
    samples: DayPathSample[];
    bestMatch: DayPathSample;   // lowest |Gamma| of the day
    worstMatch: DayPathSample;  // highest |Gamma| of the day
    dayStart: Date;
}

/**
 * The three points that fix where the clock pivots, and the pivot itself.
 */
export interface ClockAnchors {
    /** The white dot riding the real axis: how far through the day we are. */
    hour: CartesianCoordinate;
    second: CartesianCoordinate;
    date: CartesianCoordinate;
    /** Centroid of the three. Every arm hangs off this point. */
    pivot: CartesianCoordinate;
}

/** The full set of clock hands, slowest wheel nearest the matched centre. */
export interface HandVector {
    id: 'second' | 'minute' | 'hour' | 'date' | 'month' | 'year';
    label: string;
    polar: PolarCoordinate;
    /** Human readable description of what one revolution means. */
    period: string;
}

export interface DateDNA {
    r: number;
    g: number;
    b: number;
    hex: string;
    rgbString: string;
}

export interface MoodData {
    hue: number;
    saturation: number;
    lightness: number;
    hslString: string;
    dayOfYear: number;
    solarLightness: number;
}

export interface SmithChartClockOptions {
    characteristicImpedance?: number; // Default 50 Ohms
    theme?: 'cyber-dark' | 'smith-classic' | 'radar-green' | 'solar-light';
    showSecondHand?: boolean;
    showCompositeVector?: boolean;
    showReactanceArcs?: boolean;
    showResistanceCircles?: boolean;
    /** Date-DNA spiral. Off by default -- it is decorative, not an RF reading. */
    showHistoricalSpiral?: boolean;
    showAngleScale?: boolean;
    /** Calendar wheels: date-of-month, month-of-year and year-of-decade hands. */
    showCalendarHands?: boolean;
    /** Constant-VSWR circles: radius |Gamma|, centred on the origin. */
    showVswrCircles?: boolean;
    /** The 24-hour locus traced by the composite hour+minute phasor. */
    showDayPath?: boolean;
    /** Mirror of the day path through the origin (y = 1/z lives at -Gamma). */
    showAdmittancePath?: boolean;
    /** Classic "RADIALLY SCALED PARAMETERS" nomograph beneath the chart. */
    showRadialScales?: boolean;
    /** Calibrated rim rings: wavelengths toward generator / load, and angle of Gamma. */
    showRimScales?: boolean;
    /** Minutes between day-path samples. 1 = every minute (1440 points). */
    dayPathSampleMinutes?: number;
    spiralStartYear?: number;
    spiralEndYear?: number;
    colorEngine?: 'date-dna' | 'mood' | 'rf-phasor' | 'custom';
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
 * RF Mathematics Engine for Smith Chart Computations
 */
export class SmithChartRFMath {
    /**
     * Converts normalized polar reflection coefficient (Gamma) to Cartesian (U, V)
     */
    public static polarToGamma(polar: PolarCoordinate): ComplexNumber {
        return {
            re: polar.magnitude * Math.cos(polar.phase),
            im: polar.magnitude * Math.sin(polar.phase)
        };
    }

    /**
     * Converts Cartesian reflection coefficient (Gamma_r, Gamma_i) to Polar (Mag, Phase)
     */
    public static gammaToPolar(gamma: ComplexNumber): PolarCoordinate {
        const mag = Math.sqrt(gamma.re * gamma.re + gamma.im * gamma.im);
        const phase = Math.atan2(gamma.im, gamma.re);
        return { magnitude: Math.min(1.0, mag), phase };
    }

    /**
     * Transforms Reflection Coefficient Gamma into Normalized Impedance z = (1 + Gamma) / (1 - Gamma)
     */
    public static gammaToNormalizedImpedance(gamma: ComplexNumber): ComplexNumber {
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
    public static normalizedImpedanceToGamma(z: ComplexNumber): ComplexNumber {
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
    public static gammaToNormalizedAdmittance(gamma: ComplexNumber): ComplexNumber {
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
    public static reciprocal(z: ComplexNumber): ComplexNumber {
        if (!isFinite(z.re) || !isFinite(z.im)) return { re: 0, im: 0 };
        const denom = (z.re * z.re) + (z.im * z.im);
        if (denom < 1e-12) return { re: Infinity, im: Infinity };
        return { re: z.re / denom, im: -z.im / denom };
    }

    /**
     * Calculates complete impedance metrics from a polar coordinate point
     */
    public static computeMetrics(
        polar: PolarCoordinate,
        z0: number = 50,
        otherHandPolar?: PolarCoordinate
    ): ImpedanceMetrics {
        const gamma = this.polarToGamma(polar);
        const gammaMag = polar.magnitude;
        let gammaPhaseDeg = (polar.phase * 180) / Math.PI;
        // Normalize angle to [-180, 180]
        while (gammaPhaseDeg > 180) gammaPhaseDeg -= 360;
        while (gammaPhaseDeg < -180) gammaPhaseDeg += 360;

        const zNorm = this.gammaToNormalizedImpedance(gamma);
        const zActual: ComplexNumber = {
            re: isFinite(zNorm.re) ? zNorm.re * z0 : Infinity,
            im: isFinite(zNorm.im) ? zNorm.im * z0 : Infinity
        };

        // y = Y/Y0 = 1/z = g + jb, sitting diametrically opposite z on the chart
        const yNorm = this.gammaToNormalizedAdmittance(gamma);
        const yActual: ComplexNumber = {
            re: isFinite(yNorm.re) ? yNorm.re / z0 : Infinity,
            im: isFinite(yNorm.im) ? yNorm.im / z0 : Infinity
        };

        // VSWR = (1 + |Gamma|) / (1 - |Gamma|)
        let vswr = 1.0;
        if (gammaMag >= 0.9999) {
            vswr = Infinity;
        } else {
            vswr = (1 + gammaMag) / (1 - gammaMag);
        }

        // Return Loss (dB) = -20 * log10(|Gamma|)
        let returnLossDb = Infinity;
        if (gammaMag > 1e-5) {
            returnLossDb = -20 * Math.log10(gammaMag);
        }

        // Reflection (mismatch) Loss = -10 * log10(1 - |Gamma|^2)
        let mismatchLossDb = 0;
        const powerTransmission = 1 - (gammaMag * gammaMag);
        if (powerTransmission > 1e-5) {
            mismatchLossDb = -10 * Math.log10(powerTransmission);
        } else {
            mismatchLossDb = Infinity;
        }

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

    /**
     * Days in the given month (1-based month index is taken from the Date).
     */
    public static daysInMonth(date: Date): number {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    }

    /**
     * Days in the given year (365 or 366).
     */
    public static daysInYear(date: Date): number {
        const y = date.getFullYear();
        return ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 366 : 365;
    }

    /**
     * Fractional day-of-year, 0 at midnight on Jan 1.
     */
    public static dayOfYear(date: Date): number {
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
    public static handVectorsForTime(date: Date): HandVector[] {
        const ms = date.getMilliseconds();
        const seconds = date.getSeconds() + ms / 1000;
        const minutes = date.getMinutes() + seconds / 60;
        const hours12 = (date.getHours() % 12) + minutes / 60;

        const dim = this.daysInMonth(date);
        const dayFrac = (date.getDate() - 1) + (date.getHours() + minutes / 60) / 24;
        const monthFrac = date.getMonth() + dayFrac / dim;
        const yearFrac = (date.getFullYear() % 10) + this.dayOfYear(date) / this.daysInYear(date);

        const turn = (fraction: number, whole: number): number =>
            (fraction / whole) * (2 * Math.PI) - (Math.PI / 2);

        return [
            {
                id: 'second', label: 'S', period: '60 s per revolution',
                polar: { magnitude: HAND_MAGNITUDES.second, phase: turn(seconds, 60) }
            },
            {
                id: 'minute', label: 'M', period: '60 min per revolution',
                polar: { magnitude: HAND_MAGNITUDES.minute, phase: turn(minutes, 60) }
            },
            {
                id: 'hour', label: 'H', period: '12 h per revolution',
                polar: { magnitude: HAND_MAGNITUDES.hour, phase: turn(hours12, 12) }
            },
            {
                id: 'date', label: 'D', period: 'one month per revolution',
                polar: { magnitude: HAND_MAGNITUDES.date, phase: turn(dayFrac, dim) }
            },
            {
                id: 'month', label: 'MO', period: 'one year per revolution',
                polar: { magnitude: HAND_MAGNITUDES.month, phase: turn(monthFrac, 12) }
            },
            {
                id: 'year', label: 'Y', period: 'one decade per revolution',
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
    public static compositePolarForTime(date: Date): PolarCoordinate {
        const seconds = date.getSeconds() + date.getMilliseconds() / 1000;
        const minutes = date.getMinutes() + seconds / 60;
        const hours12 = (date.getHours() % 12) + minutes / 60;

        const minPhase = (minutes / 60) * (2 * Math.PI) - (Math.PI / 2);
        const hrPhase = (hours12 / 12) * (2 * Math.PI) - (Math.PI / 2);

        const sumRe = HAND_MAGNITUDES.minute * Math.cos(minPhase) + HAND_MAGNITUDES.hour * Math.cos(hrPhase);
        const sumIm = HAND_MAGNITUDES.minute * Math.sin(minPhase) + HAND_MAGNITUDES.hour * Math.sin(hrPhase);

        const norm = HAND_MAGNITUDES.minute + HAND_MAGNITUDES.hour; // 1.55, the reachable maximum
        return {
            magnitude: Math.min(1.0, Math.sqrt(sumRe * sumRe + sumIm * sumIm) / norm),
            phase: Math.atan2(sumIm, sumRe)
        };
    }

    /**
     * A full day of normalization and reflection, read off the clock arms.
     *
     * Walks local midnight to midnight, and at every sample converts the hour +
     * minute arm positions into Gamma, then into z = (1+G)/(1-G), y = 1/z and
     * VSWR = (1+|G|)/(1-|G|). The result is the locus the clock draws over 24 h.
     */
    public static buildDayPath(date: Date, sampleMinutes: number = 2): DayPathSummary {
        const step = Math.max(1, Math.min(60, Math.round(sampleMinutes)));
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);

        const samples: DayPathSample[] = [];
        let bestMatch: DayPathSample | null = null;
        let worstMatch: DayPathSample | null = null;

        for (let minuteOfDay = 0; minuteOfDay <= 1440; minuteOfDay += step) {
            const m = Math.min(1440, minuteOfDay);
            const stamp = new Date(dayStart.getTime() + m * 60000);
            const polar = this.compositePolarForTime(stamp);
            const gamma = this.polarToGamma(polar);
            const rho = polar.magnitude;

            const sample: DayPathSample = {
                minuteOfDay: m,
                hours: m / 60,
                date: stamp,
                polar,
                gamma,
                zNorm: this.gammaToNormalizedImpedance(gamma),
                yNorm: this.gammaToNormalizedAdmittance(gamma),
                vswr: rho >= 0.9999 ? Infinity : (1 + rho) / (1 - rho),
                returnLossDb: rho > 1e-5 ? -20 * Math.log10(rho) : Infinity
            };
            samples.push(sample);

            if (!bestMatch || rho < bestMatch.polar.magnitude) bestMatch = sample;
            if (!worstMatch || rho > worstMatch.polar.magnitude) worstMatch = sample;
        }

        return { samples, bestMatch: bestMatch!, worstMatch: worstMatch!, dayStart };
    }

    /**
     * Calculates the "Date DNA" color
     * Formula:
     * R: 200 + Month (1..12 -> 201..212)
     * G: 100 + Day (1..31 -> 101..131)
     * B: Last 2 digits of Year (e.g. 1944 -> 44, 2026 -> 26)
     */
    public static computeDateDNA(date: Date): DateDNA {
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
    public static computeMood(date: Date): MoodData {
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
}

/**
 * One ruler of the classic "RADIALLY SCALED PARAMETERS" nomograph.
 *
 * Every ruler on that strip is plotted against the same radial distance
 * rho = |Gamma|: rho = 1 at the outer rim of the chart, rho = 0 at the matched
 * centre. A ruler is therefore fully described by the pair of functions that
 * convert between its printed value and that radius.
 */
export interface RadialScaleDef {
    id: string;
    row: number;                        // 0 = top ruler
    side: 'left' | 'right' | 'full';    // which half of the strip it occupies
    label: string;                      // the diagonal end label
    formula: string;                    // shown in the live readout / tooltips
    /** printed value -> rho in [0, 1] */
    rhoOf: (value: number) => number;
    /** rho in [0, 1] -> printed value */
    valueOf: (rho: number) => number;
    /** printed ticks, ordered from the outer rim inwards */
    ticks: number[];
    /** decimal places for the live cursor readout */
    precision: number;
}

const INF = Infinity;

/** rho from SWR, and back. */
const rhoFromSwr = (swr: number): number => (swr === INF ? 1 : (swr - 1) / (swr + 1));
const swrFromRho = (rho: number): number => (rho >= 0.9999 ? INF : (1 + rho) / (1 - rho));

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
        valueOf: (rho) => (rho > 1e-5 ? -20 * Math.log10(rho) : INF),
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

/**
 * Unified Smith Chart Clock & Chronograph Implementation
 */
export class SmithChartClock {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private centerX: number = 0;
    private centerY: number = 0;
    private scaleRadius: number = 0;
    private dpr: number = 1;

    // Simulation / Custom Time Control
    private isLiveTime: boolean = true;
    private customTime: Date = new Date();
    private animationFrameId: number | null = null;
    private lastFrameTime: number = 0;

    // Configuration Options
    public options: Required<SmithChartClockOptions>;

    // Vertical band reserved beneath the chart for the radially scaled parameters
    private stripTop: number = 0;
    private stripHeight: number = 0;

    // The day path is identical for every frame of a given day, so cache it
    private dayPathCache: DayPathSummary | null = null;
    private dayPathCacheKey: string = '';

    // The gradations a printed Smith chart actually carries. Both the
    // resistance circles and the reactance arcs use the same value set: coarse
    // near the matched centre, opening out towards the open circuit, so the
    // rendered spacing stays roughly even across the chart.
    private static readonly GRID_MAJOR: number[] = [
        0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
        1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 3.0, 4.0, 5.0, 10, 20, 50
    ];

    private static readonly GRID_MINOR: number[] = (() => {
        const out: number[] = [];
        const span = (from: number, to: number, step: number): void => {
            for (let v = from; v < to - 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
        };
        span(0.02, 0.2, 0.02);
        span(0.2, 1.0, 0.05);
        span(1.0, 2.0, 0.1);
        span(2.0, 3.0, 0.2);
        span(3.0, 5.0, 0.5);
        span(5.0, 10, 1);
        span(10, 20, 2);
        span(20, 50, 10);
        return out;
    })();

    // Which circles and arcs carry a printed number
    private static readonly R_LABELLED: number[] = [0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 1.0, 1.5, 2.0, 3.0, 5.0, 10, 20];
    private static readonly X_LABELLED: number[] = [0.2, 0.4, 0.6, 0.8, 1.0, 1.5, 2.0, 3.0, 5.0, 10];

    constructor(canvas: HTMLCanvasElement, options?: SmithChartClockOptions) {
        this.canvas = canvas;
        const context = canvas.getContext('2d');
        if (!context) throw new Error("Could not initialize 2D canvas context");
        this.ctx = context;

        this.options = {
            characteristicImpedance: options?.characteristicImpedance ?? 50,
            theme: options?.theme ?? 'cyber-dark',
            showSecondHand: options?.showSecondHand ?? true,
            showCompositeVector: options?.showCompositeVector ?? true,
            showReactanceArcs: options?.showReactanceArcs ?? true,
            showResistanceCircles: options?.showResistanceCircles ?? true,
            // The Date-DNA spiral is a decorative overlay, not an RF reading, and it
            // obscures the day path. It stays available, but it is off by default.
            showHistoricalSpiral: options?.showHistoricalSpiral ?? false,
            showAngleScale: options?.showAngleScale ?? true,
            showCalendarHands: options?.showCalendarHands ?? true,
            showVswrCircles: options?.showVswrCircles ?? true,
            showDayPath: options?.showDayPath ?? true,
            showAdmittancePath: options?.showAdmittancePath ?? false,
            showRadialScales: options?.showRadialScales ?? true,
            showRimScales: options?.showRimScales ?? true,
            dayPathSampleMinutes: options?.dayPathSampleMinutes ?? 2,
            spiralStartYear: options?.spiralStartYear ?? 1900,
            spiralEndYear: options?.spiralEndYear ?? 2050,
            colorEngine: options?.colorEngine ?? 'rf-phasor'
        };

        this.resize();
        window.addEventListener('resize', this.onWindowResize);
    }

    private onWindowResize = (): void => {
        this.resize();
    };

    /**
     * Resizes canvas for Crisp High-DPI Rendering
     */
    public resize(): void {
        this.dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        
        const width = rect.width || this.canvas.width || 600;
        const height = rect.height || this.canvas.height || 600;

        this.canvas.width = width * this.dpr;
        this.canvas.height = height * this.dpr;

        this.ctx.resetTransform?.();
        this.ctx.scale(this.dpr, this.dpr);

        // Reserve a band at the foot of the canvas for the radially scaled
        // parameters, then centre the chart in whatever is left above it.
        this.stripHeight = this.options.showRadialScales
            ? Math.max(120, Math.min(210, height * 0.28))
            : 0;
        this.stripTop = height - this.stripHeight;

        const chartHeight = height - this.stripHeight;
        this.centerX = width / 2;
        this.centerY = chartHeight / 2;
        // Leave 32px padding for angle & wavelength calibrations
        this.scaleRadius = Math.max(10, Math.min(width / 2, chartHeight / 2) - 32);
    }

    /**
     * Converts normalized Polar coordinate (magnitude [0,1], phase [rad]) to Canvas Pixel X/Y
     */
    public polarToCartesian(polar: PolarCoordinate): CartesianCoordinate {
        return {
            x: this.centerX + (polar.magnitude * this.scaleRadius * Math.cos(polar.phase)),
            y: this.centerY + (polar.magnitude * this.scaleRadius * Math.sin(polar.phase))
        };
    }

    /**
     * Converts Canvas Pixel X/Y to normalized Polar Coordinate
     */
    public cartesianToPolar(x: number, y: number): PolarCoordinate {
        const dx = (x - this.centerX) / this.scaleRadius;
        const dy = (y - this.centerY) / this.scaleRadius;
        const magnitude = Math.min(1.0, Math.sqrt(dx * dx + dy * dy));
        const phase = Math.atan2(dy, dx);
        return { magnitude, phase };
    }

    /**
     * Sets clock to live system time
     */
    public setLiveTime(live: boolean = true): void {
        this.isLiveTime = live;
    }

    /**
     * Sets custom date/time for time-travel inspection
     */
    public setCustomTime(date: Date): void {
        this.isLiveTime = false;
        this.customTime = new Date(date);
    }

    public getEffectiveTime(): Date {
        return this.isLiveTime ? new Date() : this.customTime;
    }

    /**
     * Get theme color palette
     */
    private getThemeColors() {
        const theme = this.options.theme;
        switch (theme) {
            case 'smith-classic':
                return {
                    background: '#f8fafc',
                    outerCircle: '#334155',
                    realAxis: '#475569',
                    gridMinor: '#cbd5e1',
                    gridMajor: '#94a3b8',
                    text: '#0f172a',
                    hourHand: '#dc2626',
                    minuteHand: '#2563eb',
                    secondHand: '#ea580c',
                    compositeHand: '#7c3aed',
                    centerDot: '#0f172a',
                    spiralGlow: 'rgba(217, 119, 6, 0.25)',
                    spiralCore: '#d97706'
                };
            case 'radar-green':
                return {
                    background: '#041308',
                    outerCircle: '#10b981',
                    realAxis: '#059669',
                    gridMinor: '#064e3b',
                    gridMajor: '#047857',
                    text: '#34d399',
                    hourHand: '#f59e0b',
                    minuteHand: '#10b981',
                    secondHand: '#ef4444',
                    compositeHand: '#06b6d4',
                    centerDot: '#10b981',
                    spiralGlow: 'rgba(16, 185, 129, 0.2)',
                    spiralCore: '#34d399'
                };
            case 'solar-light':
                return {
                    background: '#ffffff',
                    outerCircle: '#1e293b',
                    realAxis: '#334155',
                    gridMinor: '#e2e8f0',
                    gridMajor: '#cbd5e1',
                    text: '#0f172a',
                    hourHand: '#e11d48',
                    minuteHand: '#0284c7',
                    secondHand: '#f59e0b',
                    compositeHand: '#9333ea',
                    centerDot: '#0f172a',
                    spiralGlow: 'rgba(234, 88, 12, 0.2)',
                    spiralCore: '#ea580c'
                };
            case 'cyber-dark':
            default:
                return {
                    background: '#0a0d14',
                    outerCircle: '#38bdf8',
                    realAxis: '#0284c7',
                    gridMinor: '#1e293b',
                    gridMajor: '#334155',
                    text: '#94a3b8',
                    hourHand: '#ff3366',
                    minuteHand: '#38bdf8',
                    secondHand: '#facc15',
                    compositeHand: '#a855f7',
                    centerDot: '#38bdf8',
                    spiralGlow: 'rgba(244, 63, 94, 0.25)',
                    spiralCore: '#f43f5e'
                };
        }
    }

    /**
     * Renders high-accuracy Smith Chart Background
     */
    private drawSmithChartGrid(): void {
        const colors = this.getThemeColors();
        const ctx = this.ctx;
        const R = this.scaleRadius;

        // Clear canvas
        ctx.fillStyle = colors.background;
        ctx.fillRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);

        // 1. Draw Outer Boundary (Gamma = 1.0, |Gamma| = 1 Circle)
        ctx.strokeStyle = colors.outerCircle;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, R, 0, 2 * Math.PI);
        ctx.stroke();

        // 2. Draw Prime Real Axis Horizontal Line (-1 to +1)
        ctx.strokeStyle = colors.realAxis;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(this.centerX - R, this.centerY);
        ctx.lineTo(this.centerX + R, this.centerY);
        ctx.stroke();

        // 3. Draw Constant Resistance (r) Circles, minor gradations first.
        // Circle center: (r / (1 + r), 0) in Gamma plane, radius 1 / (1 + r)
        if (this.options.showResistanceCircles) {
            const drawR = (r: number, stroke: string, lw: number): void => {
                ctx.strokeStyle = stroke;
                ctx.lineWidth = lw;
                ctx.beginPath();
                ctx.arc(this.centerX + (r / (1 + r)) * R, this.centerY, R / (1 + r), 0, 2 * Math.PI);
                ctx.stroke();
            };

            SmithChartClock.GRID_MINOR.forEach(r => drawR(r, colors.gridMinor, 0.4));
            SmithChartClock.GRID_MAJOR.forEach(r =>
                drawR(r, r === 1.0 ? colors.gridMajor : colors.gridMinor, r === 1.0 ? 1.3 : 0.75));

            // Printed values, sitting on the real axis
            ctx.fillStyle = colors.text;
            ctx.font = '7px ui-monospace, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            SmithChartClock.R_LABELLED.forEach(r => {
                const labelX = this.centerX + ((r - 1) / (r + 1)) * R;
                if (labelX < this.centerX + R - 12) ctx.fillText(r.toString(), labelX, this.centerY - 3);
            });
        }

        // 4. Draw Constant Reactance (x) Arcs
        // Center: (1, 1/x), Radius: 1/|x|, clipped inside |Gamma| <= 1
        if (this.options.showReactanceArcs) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(this.centerX, this.centerY, R, 0, 2 * Math.PI);
            ctx.clip();

            const drawX = (val: number, stroke: string, lw: number): void => {
                ctx.strokeStyle = stroke;
                ctx.lineWidth = lw;
                ctx.beginPath();
                ctx.arc(this.centerX + R, this.centerY - (1 / val) * R, (1 / Math.abs(val)) * R, 0, 2 * Math.PI);
                ctx.stroke();
            };

            SmithChartClock.GRID_MINOR.forEach(x => {
                drawX(x, colors.gridMinor, 0.4);
                drawX(-x, colors.gridMinor, 0.4);
            });
            SmithChartClock.GRID_MAJOR.forEach(x => {
                const stroke = x === 1.0 ? colors.gridMajor : colors.gridMinor;
                const lw = x === 1.0 ? 1.2 : 0.7;
                drawX(x, stroke, lw);
                drawX(-x, stroke, lw);
            });

            ctx.restore();

            // Printed values, where each arc meets the rim. z = jx puts that
            // meeting point at Gamma = (jx - 1)/(jx + 1), always on |Gamma| = 1.
            // The grid draws +jx in the upper half, so the imaginary axis is
            // flipped here: (cos, -sin).
            ctx.fillStyle = colors.text;
            ctx.font = '7px ui-monospace, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            SmithChartClock.X_LABELLED.forEach(x => {
                [x, -x].forEach(val => {
                    const denom = 1 + val * val;
                    const angle = Math.atan2((2 * val) / denom, (val * val - 1) / denom);
                    const rr = R - 30;
                    ctx.fillText(
                        (val > 0 ? '+j' : '-j') + Math.abs(val),
                        this.centerX + rr * Math.cos(angle),
                        this.centerY - rr * Math.sin(angle)
                    );
                });
            });
        }

        // 5. Draw Prime Center Marker (Matched 50 Ohm Point Gamma = 0)
        ctx.fillStyle = colors.centerDot;
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, 4, 0, 2 * Math.PI);
        ctx.fill();

        // 5b. Calibrated rim rings
        if (this.options.showRimScales) this.drawChartRimScales(R);

        // 6. Draw Peripheral Degree & Clock Hour Ticks
        if (this.options.showAngleScale) {
            ctx.font = '10px sans-serif';
            ctx.fillStyle = colors.text;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            for (let i = 0; i < 12; i++) {
                const angle = (i / 12) * (2 * Math.PI) - (Math.PI / 2);
                const innerRadius = R + 4;
                const outerRadius = R + 10;
                const textRadius = R + 20;

                const x1 = this.centerX + innerRadius * Math.cos(angle);
                const y1 = this.centerY + innerRadius * Math.sin(angle);
                const x2 = this.centerX + outerRadius * Math.cos(angle);
                const y2 = this.centerY + outerRadius * Math.sin(angle);

                ctx.strokeStyle = colors.outerCircle;
                ctx.lineWidth = (i % 3 === 0) ? 2 : 1;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();

                const tx = this.centerX + textRadius * Math.cos(angle);
                const ty = this.centerY + textRadius * Math.sin(angle);
                const hourNum = i === 0 ? 12 : i;
                ctx.fillText(hourNum.toString(), tx, ty);
            }
        }
    }

    /**
     * Draws the Historical Date-DNA Spiral
     */
    private drawHistoricalSpiral(currentDate: Date): void {
        if (!this.options.showHistoricalSpiral) return;

        const ctx = this.ctx;
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();
        const currentDay = currentDate.getDate();

        const startYear = this.options.spiralStartYear;
        const endYear = Math.max(this.options.spiralEndYear, currentYear + 10);
        const totalYearSpan = endYear - startYear;

        const yearsElapsed = currentYear - startYear + (currentDate.getMonth() / 12) + (currentDay / 365.25);
        if (yearsElapsed <= 0) return;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Step resolution: 24 steps per year for smooth rendering
        const totalSteps = Math.floor(yearsElapsed * 16);
        if (totalSteps < 2) {
            ctx.restore();
            return;
        }

        let prevPoint: CartesianCoordinate | null = null;

        for (let i = 0; i <= totalSteps; i++) {
            const progress = i / totalSteps;
            const simYears = startYear + (progress * yearsElapsed);
            const simYearInt = Math.floor(simYears);
            const fracYear = simYears - simYearInt;
            const simDayOfYear = Math.floor(fracYear * 365.25);

            // Normalized radius expanding outward from center (0) to edge (1)
            const normalizedRadius = Math.min(0.98, Math.max(0.02, (simYears - startYear) / totalYearSpan));

            // Angle: Day of Year (1..365) maps to 0..2*PI (starting at top -PI/2)
            const angle = (simDayOfYear / 365.25) * (2 * Math.PI) - (Math.PI / 2);

            const pt: CartesianCoordinate = {
                x: this.centerX + (normalizedRadius * this.scaleRadius * Math.cos(angle)),
                y: this.centerY + (normalizedRadius * this.scaleRadius * Math.sin(angle))
            };

            if (prevPoint) {
                // Compute Date-DNA color for this segment
                const simDate = new Date(simYearInt, 0, Math.max(1, simDayOfYear));
                let strokeStyle: string;

                if (this.options.colorEngine === 'date-dna') {
                    const dna = SmithChartRFMath.computeDateDNA(simDate);
                    strokeStyle = `rgba(${dna.r}, ${dna.g}, ${dna.b}, 0.75)`;
                } else if (this.options.colorEngine === 'mood') {
                    const mood = SmithChartRFMath.computeMood(simDate);
                    strokeStyle = `hsla(${Math.round(mood.hue)}, 85%, ${Math.round(mood.lightness)}%, 0.75)`;
                } else {
                    // Cyber glow orange/magenta gradient
                    const hue = (simYears * 13) % 360;
                    strokeStyle = `hsla(${hue}, 90%, 60%, 0.7)`;
                }

                ctx.strokeStyle = strokeStyle;
                ctx.lineWidth = 2.0;
                ctx.beginPath();
                ctx.moveTo(prevPoint.x, prevPoint.y);
                ctx.lineTo(pt.x, pt.y);
                ctx.stroke();
            }

            prevPoint = pt;
        }

        // Draw glowing head of the timeline at current date
        if (prevPoint) {
            const dna = SmithChartRFMath.computeDateDNA(currentDate);
            ctx.fillStyle = dna.hex;
            ctx.shadowColor = dna.hex;
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(prevPoint.x, prevPoint.y, 4.5, 0, 2 * Math.PI);
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        ctx.restore();
    }

    /**
     * Draws an RF Phasor Vector with optional arrow head and glow
     */
    private drawPhasorVector(
        polar: PolarCoordinate,
        color: string,
        lineWidth: number,
        label?: string,
        glow: boolean = true,
        origin?: CartesianCoordinate
    ): CartesianCoordinate {
        const ctx = this.ctx;

        // The arms no longer grow out of the chart centre: they emanate from the
        // hour of day, the dot riding the real axis.
        const o = origin ?? { x: this.centerX, y: this.centerY };

        // Where that ray leaves the unit circle, so no arm overshoots the chart
        // once its origin has slid away from the middle.
        const ox = o.x - this.centerX;
        const oy = o.y - this.centerY;
        const dx = Math.cos(polar.phase);
        const dy = Math.sin(polar.phase);
        const proj = ox * dx + oy * dy;
        const limit = -proj + Math.sqrt(
            Math.max(0, proj * proj + this.scaleRadius * this.scaleRadius - (ox * ox + oy * oy))
        );
        const length = Math.min(polar.magnitude * this.scaleRadius, limit * 0.97);
        const target: CartesianCoordinate = { x: o.x + length * dx, y: o.y + length * dy };

        ctx.save();
        if (glow) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 8;
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';

        // Draw main vector shaft
        ctx.beginPath();
        ctx.moveTo(o.x, o.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();

        // Draw phasor arrowhead
        const headLength = Math.max(6, lineWidth * 2.5);
        const angle = polar.phase;
        const arrowAngle = Math.PI / 7;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(target.x, target.y);
        ctx.lineTo(
            target.x - headLength * Math.cos(angle - arrowAngle),
            target.y - headLength * Math.sin(angle - arrowAngle)
        );
        ctx.lineTo(
            target.x - headLength * Math.cos(angle + arrowAngle),
            target.y - headLength * Math.sin(angle + arrowAngle)
        );
        ctx.closePath();
        ctx.fill();

        // Draw label if provided
        if (label) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = color;
            ctx.font = 'bold 14px monospace';
            const labelDist = Math.max(16, lineWidth * 2.6);
            const lx = target.x + labelDist * Math.cos(angle);
            const ly = target.y + labelDist * Math.sin(angle);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, lx, ly);
        }

        ctx.restore();
        return target;
    }

    /**
     * Accent colours for the overlays that the base palette does not name.
     */
    private getOverlayColors() {
        const base = this.getThemeColors();
        const light = this.options.theme === 'smith-classic' || this.options.theme === 'solar-light';
        return {
            ...base,
            stripRule: light ? '#334155' : '#3f4c63',
            stripTick: light ? '#475569' : '#55657f',
            stripText: light ? '#0f172a' : '#9fb0c7',
            stripTitle: light ? '#1e293b' : '#cbd5e1',
            stripCursor: light ? '#dc2626' : '#f43f5e',
            dayPathPast: light ? '#0f766e' : '#22d3ee',
            dayPathFuture: light ? 'rgba(15, 118, 110, 0.22)' : 'rgba(34, 211, 238, 0.18)',
            vswrCircle: light ? 'rgba(220, 38, 38, 0.35)' : 'rgba(244, 63, 94, 0.35)',
            admittance: light ? 'rgba(124, 58, 237, 0.45)' : 'rgba(168, 85, 247, 0.4)'
        };
    }

    /**
     * Returns the day path for the given date, rebuilding it only when the
     * calendar day or the sample rate actually changes.
     */
    public getDayPath(date: Date = this.getEffectiveTime()): DayPathSummary {
        const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${this.options.dayPathSampleMinutes}`;
        if (!this.dayPathCache || this.dayPathCacheKey !== key) {
            this.dayPathCache = SmithChartRFMath.buildDayPath(date, this.options.dayPathSampleMinutes);
            this.dayPathCacheKey = key;
        }
        return this.dayPathCache;
    }

    /**
     * Constant-VSWR circles: centred on the origin with radius |Gamma|.
     *
     * Each clock wheel rides one of these, so the dial rings and the RF reading
     * are literally the same curve. The composite phasor's circle moves.
     */
    private drawVswrCircles(compositeRho: number): void {
        const ctx = this.ctx;
        const colors = this.getOverlayColors();
        const R = this.scaleRadius;

        const rings: Array<{ rho: number; strong: boolean; note: string }> = [
            { rho: HAND_MAGNITUDES.minute, strong: false, note: 'M' },
            { rho: HAND_MAGNITUDES.hour, strong: false, note: 'H' },
            { rho: compositeRho, strong: true, note: 'Σ' }
        ];
        if (this.options.showCalendarHands) {
            rings.splice(2, 0,
                { rho: HAND_MAGNITUDES.date, strong: false, note: 'D' },
                { rho: HAND_MAGNITUDES.month, strong: false, note: 'MO' },
                { rho: HAND_MAGNITUDES.year, strong: false, note: 'Y' }
            );
        }

        ctx.save();
        for (const ring of rings) {
            if (ring.rho <= 0.005) continue;
            ctx.strokeStyle = ring.strong ? colors.stripCursor : colors.vswrCircle;
            ctx.lineWidth = ring.strong ? 1.6 : 0.9;
            ctx.setLineDash(ring.strong ? [] : [2, 4]);
            ctx.beginPath();
            ctx.arc(this.centerX, this.centerY, ring.rho * R, 0, 2 * Math.PI);
            ctx.stroke();

            // Label each circle at its own angle, so the readings do not pile
            // up along a single diagonal. -2.356 rad is 135 deg in canvas space.
            const swr = ring.rho >= 0.9999 ? '∞' : ((1 + ring.rho) / (1 - ring.rho)).toFixed(2);
            const a = -2.356 + rings.indexOf(ring) * 0.34;
            ctx.setLineDash([]);
            ctx.fillStyle = ring.strong ? colors.stripCursor : colors.stripTick;
            ctx.font = ring.strong ? 'bold 9px ui-monospace, monospace' : '8px ui-monospace, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
                `${ring.note} ${swr}:1`,
                this.centerX + ring.rho * R * Math.cos(a),
                this.centerY + ring.rho * R * Math.sin(a)
            );
        }
        ctx.restore();
    }

    /**
     * The path of the day: 24 hours of reflection coefficient, traced out by
     * the hour and minute arms and coloured by time of day. The portion already
     * elapsed is drawn solid; the rest of the day is a faint preview.
     */
    private drawDayPath(now: Date): void {
        const ctx = this.ctx;
        const colors = this.getOverlayColors();
        const path = this.getDayPath(now);
        const nowMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Optional admittance locus: the same day reflected through the origin,
        // because y = 1/z sits diametrically opposite z on the chart.
        if (this.options.showAdmittancePath) {
            ctx.strokeStyle = colors.admittance;
            ctx.lineWidth = 1.0;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            path.samples.forEach((sample, i) => {
                const pt = this.polarToCartesian({
                    magnitude: sample.polar.magnitude,
                    phase: sample.polar.phase + Math.PI
                });
                if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
            });
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // A whole day of the interference sum is twenty-odd loops, so it is
        // drawn as a history rather than a solid curve: the day so far sits far
        // back, and only the last few hours come forward as a bright trail.
        const TRAIL_MINUTES = 180;
        let prev = this.polarToCartesian(path.samples[0].polar);
        for (let i = 1; i < path.samples.length; i++) {
            const sample = path.samples[i];
            const pt = this.polarToCartesian(sample.polar);
            const age = nowMinutes - sample.minuteOfDay;
            const hue = 190 + (sample.minuteOfDay / 1440) * 150; // dawn cyan -> dusk magenta

            if (age < 0) {
                ctx.strokeStyle = colors.dayPathFuture;
                ctx.lineWidth = 0.6;
            } else if (age <= TRAIL_MINUTES) {
                const freshness = 1 - age / TRAIL_MINUTES;
                ctx.strokeStyle = `hsla(${hue.toFixed(0)}, 90%, 62%, ${(0.2 + 0.7 * freshness).toFixed(3)})`;
                ctx.lineWidth = 0.8 + 1.2 * freshness;
            } else {
                ctx.strokeStyle = `hsla(${hue.toFixed(0)}, 70%, 58%, 0.32)`;
                ctx.lineWidth = 0.9;
            }

            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(pt.x, pt.y);
            ctx.stroke();
            prev = pt;
        }

        // Hour stations around the locus
        ctx.font = '8px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const sample of path.samples) {
            if (sample.minuteOfDay % 60 !== 0 || sample.minuteOfDay === 1440) continue;
            const pt = this.polarToCartesian(sample.polar);
            const elapsed = sample.minuteOfDay <= nowMinutes;
            ctx.fillStyle = elapsed ? colors.dayPathPast : colors.dayPathFuture;
            ctx.globalAlpha = elapsed ? 0.55 : 1;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, sample.minuteOfDay % 360 === 0 ? 2.4 : 1.2, 0, 2 * Math.PI);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        // Best and worst match of the day
        for (const mark of [
            { sample: path.bestMatch, color: '#10b981', tag: 'MIN |Γ|' },
            { sample: path.worstMatch, color: '#ef4444', tag: 'MAX |Γ|' }
        ]) {
            const pt = this.polarToCartesian(mark.sample.polar);
            ctx.strokeStyle = mark.color;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 4.5, 0, 2 * Math.PI);
            ctx.stroke();
        }

        ctx.restore();
    }

    /**
     * The three calibrated rings a printed Smith chart carries around its rim.
     *
     * Outermost is wavelengths toward the generator, which advance clockwise
     * from the short circuit at the left; inside it the same scale running the
     * other way, toward the load; innermost the angle of the reflection
     * coefficient in degrees. One full turn of the chart is half a wavelength,
     * which is why both wavelength rings close at 0.5.
     *
     * The grid puts +jx in the upper half, so every angle here is drawn with the
     * imaginary axis flipped: (cos, -sin).
     */
    private drawChartRimScales(R: number): void {
        const ctx = this.ctx;
        const colors = this.getOverlayColors();

        const at = (angle: number, radius: number): CartesianCoordinate => ({
            x: this.centerX + radius * Math.cos(angle),
            y: this.centerY - radius * Math.sin(angle)
        });

        const rings = [R, R - 9, R - 18, R - 27];

        ctx.save();

        // Ring separators
        ctx.strokeStyle = colors.realAxis;
        ctx.lineWidth = 0.6;
        for (const radius of rings.slice(1)) {
            ctx.beginPath();
            ctx.arc(this.centerX, this.centerY, radius, 0, 2 * Math.PI);
            ctx.stroke();
        }

        ctx.font = '6px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Two wavelength rings: 0 at the short circuit, half a wavelength per turn
        const wavelengthRings: Array<{ outer: number; sign: 1 | -1; color: string }> = [
            { outer: rings[0], sign: 1, color: colors.outerCircle },
            { outer: rings[1], sign: -1, color: colors.stripTick }
        ];

        for (const { outer, sign, color } of wavelengthRings) {
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            for (let step = 0; step < 250; step++) {
                const wl = step * 0.002;
                const angle = Math.PI + sign * (wl / 0.5) * 2 * Math.PI;
                const thousandths = Math.round(wl * 1000);
                const major = thousandths % 10 === 0;
                const depth = major ? 6 : 2;

                const a = at(angle, outer);
                const b = at(angle, outer - depth);
                ctx.lineWidth = major ? 0.8 : 0.4;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();

                if (thousandths % 50 === 0) {
                    const t = at(angle, outer - 4.5);
                    ctx.save();
                    ctx.translate(t.x, t.y);
                    ctx.rotate(-angle + Math.PI / 2);
                    ctx.fillText(wl.toFixed(2).slice(1), 0, 0);
                    ctx.restore();
                }
            }
        }

        // Angle of the reflection coefficient, +180 back round to -180
        const angleRingOuter = rings[2];
        ctx.strokeStyle = colors.stripCursor;
        ctx.fillStyle = colors.stripCursor;
        for (let deg = -180; deg < 180; deg += 2) {
            const angle = (deg * Math.PI) / 180;
            const major = deg % 10 === 0;
            const a = at(angle, angleRingOuter);
            const b = at(angle, angleRingOuter - (major ? 6 : 2.5));
            ctx.lineWidth = major ? 0.7 : 0.35;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();

            if (deg % 30 === 0) {
                const t = at(angle, angleRingOuter - 4.5);
                ctx.save();
                ctx.translate(t.x, t.y);
                ctx.rotate(-angle + Math.PI / 2);
                ctx.fillText(deg.toString(), 0, 0);
                ctx.restore();
            }
        }

        ctx.restore();
    }

    /**
     * The point on the real axis that stands for the current hour of day.
     */
    public dayOriginFor(now: Date): CartesianCoordinate {
        const secondsIntoDay =
            now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000;
        return {
            x: this.centerX + (2 * (secondsIntoDay / 86400) - 1) * this.scaleRadius,
            y: this.centerY
        };
    }

    /**
     * The three points that fix where the clock pivots.
     *
     * The hour anchor is the white dot riding the real axis -- the vital one,
     * since it alone says how far through the day we are. It is paired with the
     * second wheel and then with the date wheel, each taken on its own
     * constant-VSWR circle at its own phase. Those three corners make a
     * triangle, and the clock hangs off its centroid.
     *
     * All three are measured from the chart centre, never from the pivot, so
     * the construction cannot chase its own tail.
     */
    public clockAnchorsFor(now: Date): ClockAnchors {
        const hands = SmithChartRFMath.handVectorsForTime(now);
        const at = (id: HandVector['id']): CartesianCoordinate =>
            this.polarToCartesian(hands.find(h => h.id === id)!.polar);

        const hour = this.dayOriginFor(now);
        const second = at('second');
        const date = at('date');

        return {
            hour,
            second,
            date,
            pivot: {
                x: (hour.x + second.x + date.x) / 3,
                y: (hour.y + second.y + date.y) / 3
            }
        };
    }

    /**
     * Draws the solution triangle and its three corners. The pivot itself is
     * drawn later, over the arms, by drawPivotMark.
     */
    private drawPivotTriangle(anchors: ClockAnchors): void {
        const ctx = this.ctx;
        const { hour, second, date } = anchors;

        ctx.save();

        // The triangle itself
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(hour.x, hour.y);
        ctx.lineTo(second.x, second.y);
        ctx.lineTo(date.x, date.y);
        ctx.closePath();
        ctx.stroke();

        // Medians, so the centroid reads as a construction rather than a guess
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.setLineDash([2, 5]);
        ctx.beginPath();
        ([[hour, second, date], [second, date, hour], [date, hour, second]] as const).forEach(([a, b, c]) => {
            ctx.moveTo(c.x, c.y);
            ctx.lineTo((a.x + b.x) / 2, (a.y + b.y) / 2);
        });
        ctx.stroke();
        ctx.setLineDash([]);

        // The three corners
        ctx.font = 'bold 9px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const corners = [
            { pt: hour, color: '#ffffff', tag: 'HR', r: 4.5 },
            { pt: second, color: '#facc15', tag: 'SEC', r: 3.2 },
            { pt: date, color: '#10b981', tag: 'DATE', r: 3.2 }
        ];
        for (const corner of corners) {
            ctx.fillStyle = corner.color;
            ctx.beginPath();
            ctx.arc(corner.pt.x, corner.pt.y, corner.r, 0, 2 * Math.PI);
            ctx.fill();

            // The hour anchor already carries the time stamp above it, so its
            // own label goes underneath to stay clear.
            const dy = corner.tag === 'HR' ? corner.r + 8 : -(corner.r + 7);
            ctx.fillText(corner.tag, corner.pt.x, corner.pt.y + dy);
        }

        ctx.restore();
    }

    /**
     * The centroid of the anchor triangle: the point every arm hangs off.
     * Drawn after the arms so it is always visible, never buried under them.
     */
    private drawPivotMark(pivot: CartesianCoordinate): void {
        const ctx = this.ctx;
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 4;

        ctx.beginPath();
        ctx.arc(pivot.x, pivot.y, 7, 0, 2 * Math.PI);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(pivot.x - 11, pivot.y);
        ctx.lineTo(pivot.x - 3, pivot.y);
        ctx.moveTo(pivot.x + 3, pivot.y);
        ctx.lineTo(pivot.x + 11, pivot.y);
        ctx.moveTo(pivot.x, pivot.y - 11);
        ctx.lineTo(pivot.x, pivot.y - 3);
        ctx.moveTo(pivot.x, pivot.y + 3);
        ctx.lineTo(pivot.x, pivot.y + 11);
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(pivot.x, pivot.y, 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
    }

    /**
     * The ghost of a hand: the traditional clock reading.
     *
     * The solid arms emanate from the hour of day, which slides along the real
     * axis, so they no longer line up with the dial numbers. This faint line
     * runs from the matched centre out to the rim in the same direction, which
     * is what actually points at the 10 at twenty to eleven.
     */
    private drawGhostHand(polar: PolarCoordinate, color: string): void {
        const ctx = this.ctx;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(this.centerX, this.centerY);
        ctx.lineTo(
            this.centerX + this.scaleRadius * Math.cos(polar.phase),
            this.centerY + this.scaleRadius * Math.sin(polar.phase)
        );
        ctx.stroke();

        // and a bead where the arm's own magnitude falls on that line
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.65;
        ctx.fillStyle = color;
        const bead = this.polarToCartesian(polar);
        ctx.beginPath();
        ctx.arc(bead.x, bead.y, 2.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
    }

    /**
     * The real axis, read as one day.
     *
     * The horizontal line across the chart runs from the short circuit on the
     * left to the open circuit on the right -- the same span the transmission
     * coefficient ruler covers, tau = 1 + Gamma going 0 to 2. Mapping local
     * midnight to midnight onto it turns that axis into a day bar, and the
     * bright dot riding it says how far through the day we are: 00:00 sits hard
     * left, 23:59 hard right.
     */
    private drawDayAxis(now: Date): void {
        const ctx = this.ctx;
        const colors = this.getOverlayColors();

        const secondsIntoDay =
            now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000;
        const dayFraction = secondsIntoDay / 86400;

        const xOfFraction = (f: number): number => this.centerX + (2 * f - 1) * this.scaleRadius;
        const axisY = this.centerY;

        ctx.save();

        // Hour ticks along the axis, taller at the quarter days
        ctx.strokeStyle = colors.realAxis;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let h = 0; h <= 24; h++) {
            const x = xOfFraction(h / 24);
            const len = (h % 6 === 0) ? 7 : (h % 3 === 0 ? 4.5 : 2.5);
            ctx.moveTo(x, axisY - len);
            ctx.lineTo(x, axisY + len);
        }
        ctx.stroke();

        ctx.fillStyle = colors.stripTick;
        ctx.font = '7px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let h = 0; h <= 24; h += 6) {
            ctx.fillText(`${h.toString().padStart(2, '0')}h`, xOfFraction(h / 24), axisY + 9);
        }

        // Elapsed portion of the day, drawn over the axis
        const dotX = xOfFraction(dayFraction);
        ctx.strokeStyle = colors.dayPathPast;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(this.centerX - this.scaleRadius, axisY);
        ctx.lineTo(dotX, axisY);
        ctx.stroke();

        // The dot itself
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = colors.dayPathPast;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(dotX, axisY, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.shadowBlur = 0;

        // and the time it stands for
        const pad = (n: number): string => n.toString().padStart(2, '0');
        ctx.fillStyle = colors.stripTitle;
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`, dotX, axisY - 10);

        ctx.fillStyle = colors.stripTick;
        ctx.font = '7px ui-monospace, monospace';
        ctx.fillText(`${(dayFraction * 100).toFixed(2)}% of day`, dotX, axisY - 21);

        ctx.restore();
    }

    // ---------------------------------------------------------------- strip

    /** Horizontal position of a radius on one ruler of the nomograph. */
    private stripX(scale: RadialScaleDef, rho: number, rowLeft: number, rowRight: number): number {
        const cx = this.centerX;
        const clamped = Math.max(0, Math.min(1, rho));
        if (scale.side === 'left') return cx - clamped * (cx - rowLeft);
        if (scale.side === 'right') return cx + clamped * (rowRight - cx);
        // 'full': linear in Gamma, 0 at the origin, 1 at the centre, 2 at the open
        return rowLeft + ((1 + clamped) / 2) * (rowRight - rowLeft);
    }

    /**
     * Renders the classic "RADIALLY SCALED PARAMETERS" nomograph beneath the
     * chart, with a live cursor at the composite phasor's radius.
     *
     * Every ruler is scaled against the same radius |Gamma|, so one vertical
     * line through the strip reads SWR, return loss, reflection and transmission
     * coefficients for the current moment all at once.
     */
    private drawRadialParameterScales(cursorRho: number, cursorGammaRe: number): void {
        if (!this.options.showRadialScales || this.stripHeight < 60) return;

        const ctx = this.ctx;
        const colors = this.getOverlayColors();
        const width = this.canvas.width / this.dpr;

        // The diagonal end labels lean out past the rulers, so the strip needs
        // real gutters or they run off the canvas.
        const padX = 58;
        const left = padX;
        const right = width - padX;
        const cx = this.centerX;

        const titleY = this.stripTop + 11;
        const dirY = this.stripTop + 24;
        const rowsTop = this.stripTop + 30;
        // 14px of tail so the bottom ruler's ORIGIN mark stays inside the canvas
        const rowH = (this.stripHeight - 36 - 14) / 6;
        const slant = 4; // gentle trapezoid, exactly as on a printed chart

        ctx.save();
        ctx.textBaseline = 'alphabetic';

        // Title and the two directions of travel along the line
        ctx.fillStyle = colors.stripTitle;
        ctx.font = '9px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('RADIALLY SCALED PARAMETERS', cx, titleY);

        ctx.fillStyle = colors.stripTick;
        ctx.font = '8px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText('TOWARD LOAD →', left + (cx - left) / 2, dirY);
        ctx.fillText('← TOWARD GENERATOR', cx + (right - cx) / 2, dirY);

        const rowGeometry = (row: number) => {
            const inset = row >= 5 ? 0 : (4 - row) * slant;
            return {
                y: rowsTop + (row + 1) * rowH,
                rowLeft: left + inset,
                rowRight: right - inset
            };
        };

        // Rule line per row, plus the vertical end caps of the trapezoid
        ctx.strokeStyle = colors.stripRule;
        ctx.lineWidth = 0.8;
        for (let row = 0; row < 6; row++) {
            const g = rowGeometry(row);
            ctx.beginPath();
            ctx.moveTo(g.rowLeft, g.y);
            ctx.lineTo(g.rowRight, g.y);
            ctx.stroke();
        }
        const top = rowGeometry(0);
        const bottom = rowGeometry(4);
        ctx.beginPath();
        ctx.moveTo(top.rowLeft, top.y - rowH);
        ctx.lineTo(bottom.rowLeft, bottom.y);
        ctx.moveTo(top.rowRight, top.y - rowH);
        ctx.lineTo(bottom.rowRight, bottom.y);
        ctx.stroke();

        // Every ruler: minor ticks, printed values, and the diagonal end label
        for (const scale of RADIAL_SCALES) {
            const g = rowGeometry(scale.row);
            this.drawRadialRuler(scale, g, rowH, colors);
        }

        // CENTER and ORIGIN reference marks
        const bar = rowGeometry(5);
        const triangle = (x: number, y: number, label: string) => {
            ctx.fillStyle = colors.stripTitle;
            ctx.beginPath();
            ctx.moveTo(x, y - 4);
            ctx.lineTo(x - 3.5, y + 1);
            ctx.lineTo(x + 3.5, y + 1);
            ctx.closePath();
            ctx.fill();
            ctx.font = '7px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(label, x, y + 9);
        };
        triangle(cx, bar.y - rowH + 2, 'CENTER');
        triangle(bar.rowLeft, bar.y + 1, 'ORIGIN');

        // Live cursor: one vertical line per half, at the current radius
        const cursorRows = [rowGeometry(0), rowGeometry(4)];
        const yTop = cursorRows[0].y - rowH;
        const yBot = cursorRows[1].y;
        ctx.strokeStyle = colors.stripCursor;
        ctx.lineWidth = 1.2;
        for (const side of ['left', 'right'] as const) {
            const probe = RADIAL_SCALES.find(sc => sc.side === side)!;
            const g = rowGeometry(probe.row);
            const x = this.stripX(probe, cursorRho, g.rowLeft, g.rowRight);
            ctx.beginPath();
            ctx.moveTo(x, yTop);
            ctx.lineTo(x, yBot);
            ctx.stroke();
        }
        // and one on the full-width transmission ruler, which is linear in Gamma
        const tau = 1 + cursorGammaRe;
        const tauX = bar.rowLeft + (tau / 2) * (bar.rowRight - bar.rowLeft);
        ctx.beginPath();
        ctx.moveTo(tauX, bar.y - rowH + 4);
        ctx.lineTo(tauX, bar.y);
        ctx.stroke();

        ctx.restore();
    }

    /**
     * Draws one ruler: its ticks, its printed values and its diagonal label.
     */
    private drawRadialRuler(
        scale: RadialScaleDef,
        g: { y: number; rowLeft: number; rowRight: number },
        rowH: number,
        colors: ReturnType<SmithChartClock['getOverlayColors']>
    ): void {
        const ctx = this.ctx;
        const isFull = scale.side === 'full';

        const xOf = (value: number): number => {
            if (isFull) return g.rowLeft + (value / 2) * (g.rowRight - g.rowLeft);
            return this.stripX(scale, scale.rhoOf(value), g.rowLeft, g.rowRight);
        };

        // Minor ticks, interpolated in value space between the printed majors
        ctx.strokeStyle = colors.stripTick;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (let i = 0; i < scale.ticks.length - 1; i++) {
            const a = scale.ticks[i];
            const b = scale.ticks[i + 1];
            if (!isFinite(a) || !isFinite(b)) continue;
            for (let k = 1; k < 5; k++) {
                const v = a + ((b - a) * k) / 5;
                const x = xOf(v);
                if (x < g.rowLeft - 0.5 || x > g.rowRight + 0.5) continue;
                ctx.moveTo(x, g.y);
                ctx.lineTo(x, g.y - 2.5);
            }
        }
        ctx.stroke();

        // Major ticks and their printed values, skipping any that would collide
        ctx.strokeStyle = colors.stripRule;
        ctx.lineWidth = 0.9;
        ctx.fillStyle = colors.stripText;
        ctx.font = '6.5px ui-monospace, monospace';
        ctx.textAlign = 'center';

        // Several rulers count downwards, so the values have to be placed left
        // to right rather than in tick order, or the overlap test below never
        // fires and the numbers run together.
        const placed = scale.ticks
            .map(value => ({ value, x: xOf(value) }))
            .filter(t => isFinite(t.x) && t.x >= g.rowLeft - 0.5 && t.x <= g.rowRight + 0.5)
            .sort((a, b) => a.x - b.x);

        let lastLabelRight = -Infinity;
        for (const tick of placed) {
            ctx.beginPath();
            ctx.moveTo(tick.x, g.y);
            ctx.lineTo(tick.x, g.y - 4);
            ctx.stroke();

            const text = formatScaleValue(tick.value, scale.precision);
            const halfWidth = ctx.measureText(text).width / 2 + 1.5;
            if (tick.x - halfWidth < lastLabelRight) continue;
            ctx.fillText(text, tick.x, g.y - 5.5);
            lastLabelRight = tick.x + halfWidth;
        }

        // Diagonal end label, set at 45 deg the way a printed chart sets them
        ctx.save();
        ctx.fillStyle = colors.stripTitle;
        ctx.font = '7px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textBaseline = 'middle';
        if (scale.side === 'right' || isFull) {
            ctx.translate(g.rowRight + 3, g.y);
            ctx.rotate(-Math.PI / 4);
            ctx.textAlign = 'left';
            ctx.fillText(scale.label, 0, 0);
        } else {
            ctx.translate(g.rowLeft - 3, g.y);
            ctx.rotate(-Math.PI / 4);
            ctx.textAlign = 'right';
            ctx.fillText(scale.label, 0, 0);
        }
        ctx.restore();
        void rowH;
    }

    /**
     * Main Animation & Render Frame Tick
     */
    public tick = (timestamp: number = 0): void => {
        const now = this.getEffectiveTime();
        const colors = this.getThemeColors();

        const milliseconds = now.getMilliseconds();
        const seconds = now.getSeconds() + (milliseconds / 1000);
        const minutes = now.getMinutes() + (seconds / 60);
        const hours = (now.getHours() % 12) + (minutes / 60);

        // 1. Draw Smith Chart Background Grid
        this.drawSmithChartGrid();

        // 2. Draw Historical Date-DNA Spiral (decorative, off by default)
        this.drawHistoricalSpiral(now);

        // 2b. The composite phasor drives the day path, the VSWR rings and the
        //     radially scaled parameter cursor, so compute it once up front.
        const composite = SmithChartRFMath.compositePolarForTime(now);
        const compositeGamma = SmithChartRFMath.polarToGamma(composite);

        // 2c. A full day of reflection, traced by the hour and minute arms
        if (this.options.showDayPath) {
            this.drawDayPath(now);
        }

        // 2d. Constant-VSWR circles: radius |Gamma|, centred on the origin
        if (this.options.showVswrCircles) {
            this.drawVswrCircles(composite.magnitude);
        }

        // 2e. The day bar, then the three anchors that fix the pivot. Both are
        //     drawn before the arms, because every arm hangs off the centroid
        //     of that triangle.
        const anchors = this.clockAnchorsFor(now);
        const dayOrigin = anchors.pivot;
        this.drawDayAxis(now);
        this.drawPivotTriangle(anchors);

        // 3. Compute Hand Phasors
        // Minute Hand: 60 min = 2*PI, offset by -PI/2 to start at top (12 o'clock)
        const minPhase = (minutes / 60.0) * (2 * Math.PI) - (Math.PI / 2);
        const minVector: PolarCoordinate = { magnitude: 0.95, phase: minPhase };

        // Hour Hand: 12 hr = 2*PI, offset by -PI/2
        const hrPhase = (hours / 12.0) * (2 * Math.PI) - (Math.PI / 2);
        const hrVector: PolarCoordinate = { magnitude: 0.60, phase: hrPhase };

        // Second Hand: 60 sec = 2*PI
        const secPhase = (seconds / 60.0) * (2 * Math.PI) - (Math.PI / 2);
        const secVector: PolarCoordinate = { magnitude: 0.85, phase: secPhase };

        // Determine Vector Colors based on active engine
        let hrColor = colors.hourHand;
        let minColor = colors.minuteHand;
        let secColor = colors.secondHand;

        if (this.options.colorEngine === 'date-dna') {
            const dna = SmithChartRFMath.computeDateDNA(now);
            hrColor = dna.hex;
            minColor = `rgba(${dna.r}, ${dna.g}, ${dna.b}, 0.8)`;
            secColor = colors.secondHand;
        } else if (this.options.colorEngine === 'mood') {
            const mood = SmithChartRFMath.computeMood(now);
            hrColor = mood.hslString;
            minColor = `hsla(${Math.round(mood.hue)}, 85%, ${Math.round(mood.lightness)}%, 0.7)`;
            secColor = colors.secondHand;
        }

        // 4. Render Composite Phasor Vector (Hour + Minute Sum)
        if (this.options.showCompositeVector) {
            const minCart = this.polarToCartesian(minVector);
            const hrCart = this.polarToCartesian(hrVector);

            const compX = (minCart.x - this.centerX) + (hrCart.x - this.centerX);
            const compY = (minCart.y - this.centerY) + (hrCart.y - this.centerY);

            const compMagNorm = composite.magnitude;
            const compPhase = composite.phase;
            void compX; void compY;

            // Draw dashed parallelogram lines
            this.ctx.save();
            this.ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([3, 3]);
            this.ctx.beginPath();
            this.ctx.moveTo(minCart.x, minCart.y);
            this.ctx.lineTo(this.centerX + compX, this.centerY + compY);
            this.ctx.lineTo(hrCart.x, hrCart.y);
            this.ctx.stroke();
            this.ctx.restore();

            // Draw resultant vector
            this.drawPhasorVector(
                { magnitude: compMagNorm, phase: compPhase },
                colors.compositeHand,
                5.0,
                'Σ',
                false,
                dayOrigin
            );
        }

        // 5. Render Main Phasor Hands, deliberately overscaled so they stay
        //    legible on top of a full day of interference-sum history.
        // Ghosts first: centre-to-rim lines that still read against the dial
        this.drawGhostHand(hrVector, hrColor);
        this.drawGhostHand(minVector, minColor);
        if (this.options.showSecondHand) this.drawGhostHand(secVector, secColor);

        // Hour Hand (Low frequency, thick)
        this.drawPhasorVector(hrVector, hrColor, 9.0, 'H', true, dayOrigin);

        // Minute Hand (High frequency, medium)
        this.drawPhasorVector(minVector, minColor, 6.0, 'M', true, dayOrigin);

        // Second Hand (Sweep needle)
        if (this.options.showSecondHand) {
            this.drawPhasorVector(secVector, secColor, 2.8, undefined, true, dayOrigin);

            // Counterweight on second hand
            const tailAngle = secPhase + Math.PI;
            const tailLen = this.scaleRadius * 0.18;
            this.ctx.save();
            this.ctx.strokeStyle = secColor;
            this.ctx.lineWidth = 4.0;
            this.ctx.beginPath();
            this.ctx.moveTo(dayOrigin.x, dayOrigin.y);
            this.ctx.lineTo(
                dayOrigin.x + tailLen * Math.cos(tailAngle),
                dayOrigin.y + tailLen * Math.sin(tailAngle)
            );
            this.ctx.stroke();
            this.ctx.restore();
        }

        // 6. Calendar wheels: date, month and year, each on its own VSWR circle
        if (this.options.showCalendarHands) {
            const calendarColors: Record<string, string> = {
                date: '#10b981',
                month: '#f59e0b',
                year: '#94a3b8'
            };
            for (const hand of SmithChartRFMath.handVectorsForTime(now)) {
                if (hand.id !== 'date' && hand.id !== 'month' && hand.id !== 'year') continue;
                this.drawGhostHand(hand.polar, calendarColors[hand.id]);
                this.drawPhasorVector(hand.polar, calendarColors[hand.id], 4.5, hand.label, true, dayOrigin);
            }
        }

        this.drawPivotMark(dayOrigin);

        // 7. Mark where the composite phasor stands on its own locus right now
        const nowPoint = this.polarToCartesian(composite);
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1.2;
        this.ctx.beginPath();
        this.ctx.arc(nowPoint.x, nowPoint.y, 3.2, 0, 2 * Math.PI);
        this.ctx.stroke();

        // 8. Radially scaled parameters, cursored at the composite radius
        this.drawRadialParameterScales(composite.magnitude, compositeGamma.re);

        this.animationFrameId = requestAnimationFrame(this.tick);
    };

    /**
     * Start clock animation loop
     */
    public start(): void {
        if (!this.animationFrameId) {
            this.tick();
        }
    }

    /**
     * Stop clock animation loop
     */
    public stop(): void {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * Get live impedance and RF metrics for the current hand positions
     */
    public getCurrentMetrics(): {
        minute: ImpedanceMetrics;
        hour: ImpedanceMetrics;
        composite: ImpedanceMetrics;
        hands: HandVector[];
        dayPath: DayPathSummary;
        now: Date;
        dna: DateDNA;
        mood: MoodData;
    } {
        const now = this.getEffectiveTime();
        const z0 = this.options.characteristicImpedance;
        const hands = SmithChartRFMath.handVectorsForTime(now);

        const minPolar = hands.find(h => h.id === 'minute')!.polar;
        const hrPolar = hands.find(h => h.id === 'hour')!.polar;
        const compositePolar = SmithChartRFMath.compositePolarForTime(now);

        const minute = SmithChartRFMath.computeMetrics(minPolar, z0, hrPolar);
        const hour = SmithChartRFMath.computeMetrics(hrPolar, z0, minPolar);
        const composite = SmithChartRFMath.computeMetrics(compositePolar, z0, hrPolar);

        return {
            minute,
            hour,
            composite,
            hands,
            dayPath: this.getDayPath(now),
            now,
            dna: SmithChartRFMath.computeDateDNA(now),
            mood: SmithChartRFMath.computeMood(now)
        };
    }

    /**
     * Reads every ruler of the radially scaled parameter strip at the current
     * composite radius, so a panel can print the whole nomograph as numbers.
     */
    public readRadialScales(): Array<{ id: string; label: string; formula: string; value: string }> {
        const composite = SmithChartRFMath.compositePolarForTime(this.getEffectiveTime());
        const gamma = SmithChartRFMath.polarToGamma(composite);
        const rho = composite.magnitude;

        return RADIAL_SCALES.map(scale => ({
            id: scale.id,
            label: scale.label,
            formula: scale.formula,
            value: formatScaleValue(
                scale.side === 'full' ? 1 + gamma.re : scale.valueOf(rho),
                scale.precision
            )
        }));
    }

    /**
     * The chart's own arithmetic, written out with this moment's numbers
     * substituted in. Intended to be printed straight into a panel so the
     * reading and the formula that produced it sit side by side.
     */
    public getFormulaBreakdown(): Array<{
        section: string;
        title: string;
        symbolic: string;
        substituted: string;
        note?: string;
    }> {
        const z0 = this.options.characteristicImpedance;
        const { composite } = this.getCurrentMetrics();

        const f = (v: number, d: number = 3): string => (isFinite(v) ? v.toFixed(d) : '∞');
        const cx = (c: ComplexNumber, d: number = 3): string => {
            if (!isFinite(c.re) || !isFinite(c.im)) return '∞';
            return `${c.re.toFixed(d)} ${c.im >= 0 ? '+' : '−'} j${Math.abs(c.im).toFixed(d)}`;
        };

        const g = composite.gamma;
        const z = composite.zNorm;
        const y = composite.yNorm;
        const Z = composite.zActual;
        const rho = composite.gammaMag;

        return [
            {
                section: '1. Normalization',
                title: 'Normalized impedance',
                symbolic: 'z = Z / Z₀ = r + jx',
                substituted: `z = (${cx(Z, 1)}) Ω / ${z0} Ω = ${cx(z)}`,
                note: 'Every radius on the chart is a ratio to the line impedance, never an absolute ohm value.'
            },
            {
                section: '1. Normalization',
                title: 'Normalized admittance',
                symbolic: 'y = Y / Y₀ = 1 / z = g + jb',
                substituted: `y = 1 / (${cx(z)}) = ${cx(y)}`,
                note: 'y sits diametrically opposite z: same radius, phase rotated by 180°.'
            },
            {
                section: '2. Reflection Coefficient',
                title: 'Definition',
                symbolic: 'Γ = (Zₗ − Z₀) / (Zₗ + Z₀) = |Γ| e^{jθ}',
                substituted: `Γ = ${cx(g)} = ${f(rho)} ∠ ${f(composite.gammaPhaseDeg, 1)}°`,
                note: 'The composite phasor: the hour and minute arms added, renormalised to the unit circle.'
            },
            {
                section: '2. Reflection Coefficient',
                title: 'In terms of normalized impedance',
                symbolic: 'Γ = (z − 1) / (z + 1)',
                substituted: `Γ = ((${cx(z)}) − 1) / ((${cx(z)}) + 1) = ${cx(g)}`
            },
            {
                section: '2. Reflection Coefficient',
                title: 'Inverting for normalized impedance',
                symbolic: 'z = (1 + Γ) / (1 − Γ)',
                substituted: `z = (1 + ${cx(g)}) / (1 − ${cx(g)}) = ${cx(z)}`
            },
            {
                section: '2. Reflection Coefficient',
                title: 'Magnitude, from VSWR',
                symbolic: '|Γ| = (VSWR − 1) / (VSWR + 1)',
                substituted: `|Γ| = (${f(composite.vswr, 2)} − 1) / (${f(composite.vswr, 2)} + 1) = ${f(rho)}`
            },
            {
                section: '3. Voltage Standing Wave Ratio',
                title: 'Definition',
                symbolic: 'VSWR = Vₘₐₓ / Vₘᵢₙ = (1 + |Γ|) / (1 − |Γ|)',
                substituted: `VSWR = (1 + ${f(rho)}) / (1 − ${f(rho)}) = ${f(composite.vswr, 2)} : 1`
            },
            {
                section: '3. Voltage Standing Wave Ratio',
                title: 'Graphical use',
                symbolic: 'circle centred on r = 1, x = 0, radius |Γ|',
                substituted: `constant-VSWR circle of radius ${f(rho)} about the matched centre`,
                note: 'Drawn on the chart in red. Each clock arm rides its own constant-VSWR circle.'
            },
            {
                section: '4. Derived losses',
                title: 'Return loss',
                symbolic: 'RL = −20·log₁₀|Γ|',
                substituted: `RL = −20·log₁₀(${f(rho)}) = ${f(composite.returnLossDb, 2)} dB`
            },
            {
                section: '4. Derived losses',
                title: 'Reflection (mismatch) loss',
                symbolic: 'ML = −10·log₁₀(1 − |Γ|²)',
                substituted: `ML = −10·log₁₀(1 − ${f(rho * rho)}) = ${f(composite.mismatchLossDb, 3)} dB`
            },
            {
                section: '4. Derived losses',
                title: 'Transmission coefficient',
                symbolic: 'τ = 1 + Γ,   τₚ = 1 − |Γ|²',
                substituted: `τ = ${f(composite.transmCoeffE)},  τₚ = ${f(composite.transmCoeffP)}`
            }
        ];
    }

    public destroy(): void {
        this.stop();
        window.removeEventListener('resize', this.onWindowResize);
    }
}
