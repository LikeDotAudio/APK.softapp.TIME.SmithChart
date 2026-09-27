/**
 * Putting text where it does not collide: the gradation labels, and the
 * reading chips each ghost line prints just outside the rim.
 */

import type { Layer } from './geometry';

/** A text box by its centre and size. */
export interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** True when two centred boxes overlap, with `pad` of clearance required. */
export function overlaps(a: Box, b: Box, pad: number = 0): boolean {
    return Math.abs(a.x - b.x) < (a.w + b.w) / 2 + pad &&
        Math.abs(a.y - b.y) < (a.h + b.h) / 2 + pad;
}

/**
 * Prints as many of the candidate labels as will actually fit.
 *
 * Every gradation offers a label; which ones survive is decided by whether
 * they collide with one already down. That is what makes the chart densify
 * as it is zoomed: the same candidates spread apart, so more get through.
 * Feed majors before minors, because earlier candidates win.
 */
export function placeLabels(
    { ctx, geo }: Layer,
    candidates: Array<{ x: number; y: number; text: string; color: string; font: string }>,
    pad: number = 3
): void {
    const width = geo.width;
    const placed: Box[] = [];

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const item of candidates) {
        if (item.x < -40 || item.x > width + 40) continue;
        if (item.y < -20 || item.y > geo.stripTop + 20) continue;

        ctx.font = item.font;
        const w = ctx.measureText(item.text).width + pad * 2;
        const h = 9 + pad;

        const box = { x: item.x, y: item.y, w, h };
        if (placed.some(q => overlaps(box, q))) continue;

        placed.push(box);
        ctx.fillStyle = item.color;
        ctx.fillText(item.text, item.x, item.y);
    }
}

/**
 * The value each ghost line is reading, queued rather than drawn, so
 * coincident wheels can be spread out once the whole set is known.
 */
export class RimReadings {
    private pending: Array<{ phase: number; color: string; text: string }> = [];

    public push(reading: { phase: number; color: string; text: string }): void {
        this.pending.push(reading);
    }

    /**
     * Prints what each ghost line reads, just outside the rim it points at.
     *
     * A dotted line on its own only says which way a wheel is facing; the chip
     * says what it is facing at. Each gets a dark pill so it stays legible
     * where it crosses a dial number, and chips step outwards when two wheels
     * happen to point almost the same way.
     */
    public flush({ ctx, geo }: Layer): void {
        ctx.save();
        ctx.font = 'bold 9px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const placed: Box[] = [];

        for (const reading of this.pending) {
            const w = ctx.measureText(reading.text).width + 7;
            const h = 13;

            let rr = geo.scaleRadius + 30;
            let box: Box = { x: 0, y: 0, w, h };
            for (let attempt = 0; attempt < 4; attempt++) {
                box = {
                    x: geo.centerX + rr * Math.cos(reading.phase),
                    y: geo.centerY + rr * Math.sin(reading.phase),
                    w,
                    h
                };
                if (!placed.some(q => overlaps(box, q, 3))) break;
                rr += 16;
            }
            placed.push(box);

            const left = box.x - w / 2;
            const top = box.y - h / 2;
            const r = 3;

            ctx.fillStyle = 'rgba(10, 13, 20, 0.92)';
            ctx.strokeStyle = reading.color;
            ctx.lineWidth = 0.8;
            ctx.globalAlpha = 0.95;
            ctx.beginPath();
            ctx.moveTo(left + r, top);
            ctx.arcTo(left + w, top, left + w, top + h, r);
            ctx.arcTo(left + w, top + h, left, top + h, r);
            ctx.arcTo(left, top + h, left, top, r);
            ctx.arcTo(left, top, left + w, top, r);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.globalAlpha = 1;
            ctx.fillStyle = reading.color;
            ctx.fillText(reading.text, box.x, box.y);
        }

        ctx.restore();
        this.pending = [];
    }
}
