/**
 * The real axis read as one day: hour ticks, the elapsed bar and the dot.
 */

import { dayFraction as dayFractionOf } from '../time/wheels';
import type { Layer } from './geometry';
import { overlayColors } from './theme';

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
export function drawDayAxis(layer: Layer, now: Date): void {
    const { ctx, geo, options } = layer;
    const colors = overlayColors(options.theme);

    const dayFraction = dayFractionOf(now);

    const xOfFraction = (f: number): number => geo.centerX + (2 * f - 1) * geo.scaleRadius;
    const axisY = geo.centerY;

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
    ctx.moveTo(geo.centerX - geo.scaleRadius, axisY);
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
