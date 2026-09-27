/**
 * The anchor triangle that fixes where the clock pivots, its centroid, and
 * the pivot mark every arm hangs off.
 */

import type { CartesianCoordinate, ClockAnchors, HandVector } from '../types';
import type { ChartGeometry } from './geometry';

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
export function clockAnchorsFor(geo: ChartGeometry, now: Date, hands: HandVector[]): ClockAnchors {
    const at = (id: HandVector['id']): CartesianCoordinate =>
        geo.polarToCartesian(hands.find(h => h.id === id)!.polar);

    const hour = geo.dayOriginFor(now);
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
export function drawPivotTriangle(ctx: CanvasRenderingContext2D, anchors: ClockAnchors): void {
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
export function drawPivotMark(ctx: CanvasRenderingContext2D, pivot: CartesianCoordinate): void {
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
