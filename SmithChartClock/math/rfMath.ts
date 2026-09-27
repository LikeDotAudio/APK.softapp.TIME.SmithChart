/**
 * SmithChartRFMath: the static API the clock has always exposed. The code
 * lives as free functions in math/, time/ and colour/; this only binds them.
 */

import { gammaToNormalizedAdmittance, gammaToNormalizedImpedance, gammaToPolar, normalizedImpedanceToGamma, polarToGamma, reciprocal } from './complex';
import { computeMetrics } from './metrics';
import { compositePolarForTime, dayOfYear, daysInMonth, daysInYear, handVectorsForTime } from '../time/wheels';
import { buildDayPath } from '../time/dayPath';
import { computeDateDNA, computeMood } from '../colour/engines';

/**
 * RF Mathematics Engine for Smith Chart Computations
 */
export class SmithChartRFMath {
    public static polarToGamma = polarToGamma;
    public static gammaToPolar = gammaToPolar;
    public static gammaToNormalizedImpedance = gammaToNormalizedImpedance;
    public static normalizedImpedanceToGamma = normalizedImpedanceToGamma;
    public static gammaToNormalizedAdmittance = gammaToNormalizedAdmittance;
    public static reciprocal = reciprocal;
    public static computeMetrics = computeMetrics;
    public static daysInMonth = daysInMonth;
    public static daysInYear = daysInYear;
    public static dayOfYear = dayOfYear;
    public static handVectorsForTime = handVectorsForTime;
    public static compositePolarForTime = compositePolarForTime;
    public static buildDayPath = buildDayPath;
    public static computeDateDNA = computeDateDNA;
    public static computeMood = computeMood;
}
