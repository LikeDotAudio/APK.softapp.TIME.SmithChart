/**
 * Curves of constant or tracked |Gamma|: the constant-VSWR rings, the path
 * of the day, and its admittance mirror.
 */

import type { DayPathSummary } from '../types';
import { swrFromRho } from '../math/metrics';
import { HAND_MAGNITUDES } from '../time/wheels';
import type { Layer } from './geometry';
import { overlayColors } from './theme';

/**
 * Constant-VSWR circles: centred on the origin with radius |Gamma|.
 *
 * Each clock wheel rides one of these, so the dial rings and the RF reading
 * are literally the same curve. The composite phasor's circle moves.
 */
export function drawVswrCircles(layer: Layer, compositeRho: number): void {
    const { ctx, geo, options } = layer;
    const colors = overlayColors(options.theme);
    const R = geo.scaleRadius;

    const rings: Array<{ rho: number; strong: boolean; note: string }> = [
        { rho: HAND_MAGNITUDES.minute, strong: false, note: 'M' },
        { rho: HAND_MAGNITUDES.hour, strong: false, note: 'H' },
        { rho: compositeRho, strong: true, note: 'Σ' }
    ];
    if (options.showCalendarHands) {
        rings.splice(2, 0,
            { rho: HAND_MAGNITUDES.date, strong: false, note: 'D' },
            { rho: HAND_MAGNITUDES.month, strong: false, note: 'MO' },
            { rho: HAND_MAGNITUDES.year, strong: false, note: 'Y' }
        );
    }

    ctx.save();
    for (const ring of rings) {
        if (ring.rho <= 0.005) continue;
        ctx.strokeStyle = ring.strong ? colors.stripCursor : colors.vswrCircle;
        ctx.lineWidth = ring.strong ? 1.6 : 0.9;
        ctx.setLineDash(ring.strong ? [] : [2, 4]);
        ctx.beginPath();
        ctx.arc(geo.centerX, geo.centerY, ring.rho * R, 0, 2 * Math.PI);
        ctx.stroke();

        // Label each circle at its own angle, so the readings do not pile
        // up along a single diagonal. -2.356 rad is 135 deg in canvas space.
        const ringSwr = swrFromRho(ring.rho);
        const swr = isFinite(ringSwr) ? ringSwr.toFixed(2) : '∞';
        const a = -2.356 + rings.indexOf(ring) * 0.34;
        ctx.setLineDash([]);
        ctx.fillStyle = ring.strong ? colors.stripCursor : colors.stripTick;
        ctx.font = ring.strong ? 'bold 9px ui-monospace, monospace' : '8px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
            `${ring.note} ${swr}:1`,
            geo.centerX + ring.rho * R * Math.cos(a),
            geo.centerY + ring.rho * R * Math.sin(a)
        );
    }
    ctx.restore();
}

/**
 * The path of the day: 24 hours of reflection coefficient, traced out by
 * the hour and minute arms and coloured by time of day. The portion already
 * elapsed is drawn solid; the rest of the day is a faint preview.
 */
export function drawDayPath(layer: Layer, now: Date, path: DayPathSummary): void {
    const { ctx, geo, options } = layer;
    const colors = overlayColors(options.theme);
    const nowMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Optional admittance locus: the same day reflected through the origin,
    // because y = 1/z sits diametrically opposite z on the chart.
    if (options.showAdmittancePath) {
        ctx.strokeStyle = colors.admittance;
        ctx.lineWidth = 1.0;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        path.samples.forEach((sample, i) => {
            const pt = geo.polarToCartesian({
                magnitude: sample.polar.magnitude,
                phase: sample.polar.phase + Math.PI
            });
            if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // The trail comes in fat and bright at the current moment and tapers
    // away behind it; the rest of the day stays as a thin history line so
    // the whole locus is still readable underneath.
    const TRAIL_MINUTES = 240;
    let prev = geo.polarToCartesian(path.samples[0].polar);
    for (let i = 1; i < path.samples.length; i++) {
        const sample = path.samples[i];
        const pt = geo.polarToCartesian(sample.polar);
        const age = nowMinutes - sample.minuteOfDay;
        const hue = 190 + (sample.minuteOfDay / 1440) * 150; // dawn cyan -> dusk magenta

        if (age < 0) {
            ctx.strokeStyle = colors.dayPathFuture;
            ctx.lineWidth = 0.6;
        } else if (age <= TRAIL_MINUTES) {
            const freshness = 1 - age / TRAIL_MINUTES;
            // Cubed so the head stays fat and the taper falls away fast
            const weight = freshness * freshness * freshness;
            ctx.strokeStyle = `hsla(${hue.toFixed(0)}, 95%, 65%, ${(0.12 + 0.85 * weight).toFixed(3)})`;
            ctx.lineWidth = 0.7 + 7.5 * weight;
        } else {
            ctx.strokeStyle = `hsla(${hue.toFixed(0)}, 70%, 58%, 0.22)`;
            ctx.lineWidth = 0.8;
        }

        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
        prev = pt;
    }

    // Hour stations around the locus
    ctx.font = '8px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const sample of path.samples) {
        if (sample.minuteOfDay % 60 !== 0 || sample.minuteOfDay === 1440) continue;
        const pt = geo.polarToCartesian(sample.polar);
        const elapsed = sample.minuteOfDay <= nowMinutes;
        ctx.fillStyle = elapsed ? colors.dayPathPast : colors.dayPathFuture;
        ctx.globalAlpha = elapsed ? 0.55 : 1;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, sample.minuteOfDay % 360 === 0 ? 2.4 : 1.2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    // Best and worst match of the day
    for (const mark of [
        { sample: path.bestMatch, color: '#10b981', tag: 'MIN |Γ|' },
        { sample: path.worstMatch, color: '#ef4444', tag: 'MAX |Γ|' }
    ]) {
        const pt = geo.polarToCartesian(mark.sample.polar);
        ctx.strokeStyle = mark.color;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4.5, 0, 2 * Math.PI);
        ctx.stroke();
    }

    ctx.restore();
}
