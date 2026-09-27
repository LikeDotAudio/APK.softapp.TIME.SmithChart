/**
 * Numbers for side panels: live metrics, every ruler read at the composite
 * radius, and the chart's arithmetic written out with this moment's values.
 */

import type { ComplexNumber, DateDNA, DayPathSummary, HandVector, ImpedanceMetrics, MoodData, PlotPairDef } from './types';
import { polarToGamma } from './math/complex';
import { computeMetrics } from './math/metrics';
import { compositePolarForTime, handVectorsForTime } from './time/wheels';
import type { DayPathCache } from './time/dayPath';
import { computeDateDNA, computeMood } from './colour/engines';
import { formatScaleValue, RADIAL_SCALES } from './scales/radialScales';

/**
 * Get live impedance and RF metrics for the current hand positions
 */
export function getCurrentMetrics(
    now: Date,
    z0: number,
    pair: PlotPairDef,
    dayPaths: DayPathCache,
    sampleMinutes: number
): {
    minute: ImpedanceMetrics;
    hour: ImpedanceMetrics;
    composite: ImpedanceMetrics;
    hands: HandVector[];
    dayPath: DayPathSummary;
    now: Date;
    dna: DateDNA;
    mood: MoodData;
} {
    const hands = handVectorsForTime(now);

    const minPolar = hands.find(h => h.id === 'minute')!.polar;
    const hrPolar = hands.find(h => h.id === 'hour')!.polar;
    const compositePolar = compositePolarForTime(now, pair);

    const minute = computeMetrics(minPolar, z0, hrPolar);
    const hour = computeMetrics(hrPolar, z0, minPolar);
    const composite = computeMetrics(compositePolar, z0, hrPolar);

    return {
        minute,
        hour,
        composite,
        hands,
        dayPath: dayPaths.get(now, sampleMinutes, pair),
        now,
        dna: computeDateDNA(now),
        mood: computeMood(now)
    };
}

/**
 * Reads every ruler of the radially scaled parameter strip at the current
 * composite radius, so a panel can print the whole nomograph as numbers.
 */
export function readRadialScales(now: Date, pair: PlotPairDef): Array<{ id: string; label: string; formula: string; value: string }> {
    const composite = compositePolarForTime(now, pair);
    const gamma = polarToGamma(composite);
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
export function getFormulaBreakdown(composite: ImpedanceMetrics, z0: number): Array<{
    section: string;
    title: string;
    symbolic: string;
    substituted: string;
    note?: string;
}> {
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
