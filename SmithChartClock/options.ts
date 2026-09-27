/**
 * One place for the option defaults.
 */

import type { SmithChartClockOptions } from './types';
import { PLOT_PAIRS } from './time/wheels';

export function resolveOptions(options?: SmithChartClockOptions): Required<SmithChartClockOptions> {
    return {
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
        plotPair: options?.plotPair ?? PLOT_PAIRS[0].id,
        spiralStartYear: options?.spiralStartYear ?? 1900,
        spiralEndYear: options?.spiralEndYear ?? 2050,
        colorEngine: options?.colorEngine ?? 'rf-phasor'
    };
}
