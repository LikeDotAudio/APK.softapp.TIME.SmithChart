/**
 * One clock arm: the solid phasor from the pivot with its head and label,
 * and the faint ghost from the matched centre that still reads the dial.
 */

import type { CartesianCoordinate, PolarCoordinate } from '../types';
import type { Layer } from './geometry';
import type { RimReadings } from './labels';

/**
 * Draws an RF Phasor Vector with optional arrow head and glow
 */
export function drawPhasorVector(layer: Layer, 
    polar: PolarCoordinate,
    color: string,
    lineWidth: number,
    label?: string,
    glow: boolean = true,
    origin?: CartesianCoordinate,
    anchor?: CartesianCoordinate,
    reachRim: boolean = false
): CartesianCoordinate {
    const { ctx, geo } = layer;

    // The arms no longer grow out of the chart centre: they emanate from the
    // hour of day, the dot riding the real axis.
    const o = origin ?? { x: geo.centerX, y: geo.centerY };

    // Some arms take their direction from a triangle corner rather than from
    // their own wheel phase, so the arm and the corner cannot drift apart.
    // Either way the arm runs out to the main circle.
    const angle = anchor
        ? Math.atan2(anchor.y - o.y, anchor.x - o.x)
        : polar.phase;

    // Where that ray leaves the unit circle, so no arm overshoots the chart
    // once its origin has slid away from the middle.
    const ox = o.x - geo.centerX;
    const oy = o.y - geo.centerY;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const proj = ox * dx + oy * dy;
    const limit = -proj + Math.sqrt(
        Math.max(0, proj * proj + geo.scaleRadius * geo.scaleRadius - (ox * ox + oy * oy))
    );
    // Arms bound to a triangle corner run on through it to the rim; every
    // other arm keeps its own radius, which is what puts it on its own
    // constant-VSWR circle.
    const length = reachRim ? limit * 0.97 : Math.min(polar.magnitude * geo.scaleRadius, limit * 0.97);
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

    // The corner the arm passes through, marked on the shaft
    if (anchor && reachRim) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0a0d14';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(anchor.x, anchor.y, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
    }

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
 * The ghost of a hand: the traditional clock reading.
 *
 * The solid arms emanate from the hour of day, which slides along the real
 * axis, so they no longer line up with the dial numbers. This faint line
 * runs from the matched centre out to the rim in the same direction, which
 * is what actually points at the 10 at twenty to eleven.
 */
export function drawGhostHand(
    layer: Layer,
    rim: RimReadings,
    polar: PolarCoordinate,
    color: string,
    reading?: string
): void {
    const { ctx, geo } = layer;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(geo.centerX, geo.centerY);
    ctx.lineTo(
        geo.centerX + geo.scaleRadius * Math.cos(polar.phase),
        geo.centerY + geo.scaleRadius * Math.sin(polar.phase)
    );
    ctx.stroke();

    // and a bead where the arm's own magnitude falls on that line
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = color;
    const bead = geo.polarToCartesian(polar);
    ctx.beginPath();
    ctx.arc(bead.x, bead.y, 2.5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();

    // The value this line is reading, printed where it leaves the chart.
    // Queued rather than drawn, so coincident wheels can be spread out once
    // the whole set is known.
    if (reading) rim.push({ phase: polar.phase, color, text: reading });
}
