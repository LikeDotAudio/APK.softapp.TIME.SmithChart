/** The type vocabulary of the Smith chart clock. Types only, no code. */

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
    /** What the wheel currently reads, e.g. '09' for September. */
    value: string;
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
    /** Which two wheels are crossed to make the plotted locus. See PLOT_PAIRS. */
    plotPair?: string;
    spiralStartYear?: number;
    spiralEndYear?: number;
    colorEngine?: 'date-dna' | 'mood' | 'rf-phasor' | 'custom';
}

/**
 * Which two wheels are crossed to make the plotted locus.
 *
 * The trail has always been the hour and minute arms added together; any other
 * pair is the same construction on different wheels, so the chart can be asked
 * to correlate whichever two the reader cares about.
 */
export interface PlotPairDef {
    id: string;
    label: string;
    a: HandVector['id'];
    b: HandVector['id'];
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
