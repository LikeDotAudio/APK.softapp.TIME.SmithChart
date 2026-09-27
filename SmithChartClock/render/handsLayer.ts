/**
 * The whole hand set for one frame: the composite parallelogram and its
 * Sigma arm, the H/M/S ghosts and arms with the second's counterweight, and
 * the calendar wheels.
 */

import type { ClockAnchors, HandVector, PlotPairDef, PolarCoordinate } from '../types';
import { CALENDAR_COLOURS, handColours } from '../colour/engines';
import type { Layer } from './geometry';
import type { RimReadings } from './labels';
import { drawGhostHand, drawPhasorVector } from './phasor';
import type { ThemeColors } from './theme';

export interface HandsFrame {
    now: Date;
    /** This frame's wheels, from handVectorsForTime. */
    hands: HandVector[];
    composite: PolarCoordinate;
    anchors: ClockAnchors;
    pair: PlotPairDef;
    colors: ThemeColors;
    rim: RimReadings;
}

export function drawHands(layer: Layer, frame: HandsFrame): void {
    const { ctx, geo, options } = layer;
    const { now, hands, composite, anchors, pair, colors, rim } = frame;
    const dayOrigin = anchors.pivot;
    const wheel = (id: HandVector['id']): HandVector => hands.find(h => h.id === id)!;

    const hrVector = wheel('hour').polar;
    const minVector = wheel('minute').polar;
    const secVector = wheel('second').polar;

    // Vector colours for the active engine
    const { hour: hrColor, minute: minColor, second: secColor } = handColours(options.colorEngine, now, colors);

    // Composite phasor vector (the plotted pair's sum)
    if (options.showCompositeVector) {
        const minCart = geo.polarToCartesian(wheel(pair.a).polar);
        const hrCart = geo.polarToCartesian(wheel(pair.b).polar);

        const compX = (minCart.x - geo.centerX) + (hrCart.x - geo.centerX);
        const compY = (minCart.y - geo.centerY) + (hrCart.y - geo.centerY);

        // Draw dashed parallelogram lines
        ctx.save();
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(minCart.x, minCart.y);
        ctx.lineTo(geo.centerX + compX, geo.centerY + compY);
        ctx.lineTo(hrCart.x, hrCart.y);
        ctx.stroke();
        ctx.restore();

        // Draw resultant vector
        drawPhasorVector(
            layer,
            { magnitude: composite.magnitude, phase: composite.phase },
            colors.compositeHand,
            5.0,
            'Σ',
            false,
            dayOrigin
        );
    }

    // Main phasor hands, deliberately overscaled so they stay legible on top
    // of a full day of interference-sum history.
    // Ghosts first: centre-to-rim lines that still read against the dial,
    // each printing its own value at the edge it points to.
    const readingFor = (id: HandVector['id']): string => `${wheel(id).label} ${wheel(id).value}`;
    drawGhostHand(layer, rim, hrVector, hrColor, readingFor('hour'));
    drawGhostHand(layer, rim, minVector, minColor, readingFor('minute'));
    if (options.showSecondHand) drawGhostHand(layer, rim, secVector, secColor, readingFor('second'));

    // Hour Hand (Low frequency, thick)
    // Each arm is aimed at its own rim value, so the minute arm points at the
    // minute reading and the hour arm at the hour, even though both now start
    // from the pivot rather than the centre of the chart.
    drawPhasorVector(layer, hrVector, hrColor, 9.0, 'H', true, dayOrigin, geo.rimPointFor(hrVector.phase));

    // Minute Hand (High frequency, medium)
    drawPhasorVector(layer, minVector, minColor, 6.0, 'M', true, dayOrigin, geo.rimPointFor(minVector.phase));

    // Second Hand (Sweep needle) runs through its corner and on to the rim
    if (options.showSecondHand) {
        drawPhasorVector(layer, secVector, secColor, 2.8, undefined, true, dayOrigin, anchors.second, true);

        // Counterweight, opposite the way the arm actually points
        const tailAngle = Math.atan2(
            anchors.second.y - dayOrigin.y,
            anchors.second.x - dayOrigin.x
        ) + Math.PI;
        const tailLen = geo.scaleRadius * 0.18;
        ctx.save();
        ctx.strokeStyle = secColor;
        ctx.lineWidth = 4.0;
        ctx.beginPath();
        ctx.moveTo(dayOrigin.x, dayOrigin.y);
        ctx.lineTo(
            dayOrigin.x + tailLen * Math.cos(tailAngle),
            dayOrigin.y + tailLen * Math.sin(tailAngle)
        );
        ctx.stroke();
        ctx.restore();
    }

    // Calendar wheels: date, month and year, each on its own VSWR circle
    if (options.showCalendarHands) {
        for (const hand of hands) {
            if (hand.id !== 'date' && hand.id !== 'month' && hand.id !== 'year') continue;
            drawGhostHand(layer, rim, hand.polar, CALENDAR_COLOURS[hand.id], `${hand.label} ${hand.value}`);
            // The date arm is a triangle corner too, so it runs through it
            drawPhasorVector(
                layer, hand.polar, CALENDAR_COLOURS[hand.id], 4.5, hand.label, true, dayOrigin,
                hand.id === 'date' ? anchors.date : geo.rimPointFor(hand.polar.phase),
                hand.id === 'date'
            );
        }
    }
}
