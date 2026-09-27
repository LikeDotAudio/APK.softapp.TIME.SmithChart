/**
 * One frame of the clock, in draw order: clear, clip, grid, spiral, loci,
 * day axis, pivot, hands, rim chips, pivot mark, then the parameter strip.
 */

import type { DayPathSummary, PlotPairDef } from '../types';
import { polarToGamma } from '../math/complex';
import { compositePolarForTime, handVectorsForTime } from '../time/wheels';
import type { Layer } from './geometry';
import type { RimReadings } from './labels';
import { themeColors } from './theme';
import { drawSmithChartGrid } from './grid';
import { drawHistoricalSpiral } from './spiral';
import { drawDayPath, drawVswrCircles } from './loci';
import { drawDayAxis } from './dayAxis';
import { clockAnchorsFor, drawPivotMark, drawPivotTriangle } from './pivot';
import { drawHands } from './handsLayer';
import { drawRadialParameterScales } from './radialStrip';

export function drawFrame(
    layer: Layer,
    now: Date,
    pair: PlotPairDef,
    dayPath: () => DayPathSummary,
    rim: RimReadings
): void {
    const { ctx, geo, options } = layer;
    const colors = themeColors(options.theme);
    const hands = handVectorsForTime(now);

    // 1. Clear, then fence the chart into its own area so a zoomed-in view
    //    cannot spill over the parameter strip below it.
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, geo.width, geo.height);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, geo.width, geo.stripTop);
    ctx.clip();

    drawSmithChartGrid(layer);

    // 2. Historical Date-DNA Spiral (decorative, off by default)
    drawHistoricalSpiral(layer, now);

    // 2b. The composite phasor drives the day path, the VSWR rings and the
    //     radially scaled parameter cursor, so compute it once up front.
    const composite = compositePolarForTime(now, pair);
    const compositeGamma = polarToGamma(composite);

    // 2c. A full day of reflection, traced by the plotted pair of arms
    if (options.showDayPath) drawDayPath(layer, now, dayPath());

    // 2d. Constant-VSWR circles: radius |Gamma|, centred on the origin
    if (options.showVswrCircles) drawVswrCircles(layer, composite.magnitude);

    // 2e. The day bar, then the three anchors that fix the pivot. Both are
    //     drawn before the arms, because every arm hangs off the centroid
    //     of that triangle.
    const anchors = clockAnchorsFor(geo, now, hands);
    drawDayAxis(layer, now);
    drawPivotTriangle(ctx, anchors);

    // 3–6. Composite, H/M/S and calendar arms, then their rim chips
    drawHands(layer, { now, hands, composite, anchors, pair, colors, rim });
    rim.flush(layer);
    drawPivotMark(ctx, anchors.pivot);

    ctx.restore(); // end of the chart's clip

    // 7. Mark where the composite phasor stands on its own locus right now
    const nowPoint = geo.polarToCartesian(composite);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(nowPoint.x, nowPoint.y, 3.2, 0, 2 * Math.PI);
    ctx.stroke();

    // 8. Radially scaled parameters, cursored at the composite radius
    drawRadialParameterScales(layer, composite.magnitude, compositeGamma.re);
}
