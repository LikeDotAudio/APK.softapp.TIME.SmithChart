import type { CartesianCoordinate } from '../types';
import type { Layer } from './geometry';
import { overlayColors } from './theme';

/**
 * The three calibrated rings a printed Smith chart carries around its rim.
 *
 * Outermost is wavelengths toward the generator, which advance clockwise
 * from the short circuit at the left; inside it the same scale running the
 * other way, toward the load; innermost the angle of the reflection
 * coefficient in degrees. One full turn of the chart is half a wavelength,
 * which is why both wavelength rings close at 0.5.
 *
 * The grid puts +jx in the upper half, so every angle here is drawn with the
 * imaginary axis flipped: (cos, -sin).
 */
export function drawChartRimScales(layer: Layer, R: number): void {
    const { ctx, geo, options } = layer;
    const colors = overlayColors(options.theme);

    const at = (angle: number, radius: number): CartesianCoordinate => ({
        x: geo.centerX + radius * Math.cos(angle),
        y: geo.centerY - radius * Math.sin(angle)
    });

    const rings = [R, R - 9, R - 18, R - 27];

    ctx.save();

    // Ring separators
    ctx.strokeStyle = colors.realAxis;
    ctx.lineWidth = 0.6;
    for (const radius of rings.slice(1)) {
        ctx.beginPath();
        ctx.arc(geo.centerX, geo.centerY, radius, 0, 2 * Math.PI);
        ctx.stroke();
    }

    ctx.font = '6px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Two wavelength rings: 0 at the short circuit, half a wavelength per turn
    const wavelengthRings: Array<{ outer: number; sign: 1 | -1; color: string }> = [
        { outer: rings[0], sign: 1, color: colors.outerCircle },
        { outer: rings[1], sign: -1, color: colors.stripTick }
    ];

    for (const { outer, sign, color } of wavelengthRings) {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        for (let step = 0; step < 250; step++) {
            const wl = step * 0.002;
            const angle = Math.PI + sign * (wl / 0.5) * 2 * Math.PI;
            const thousandths = Math.round(wl * 1000);
            const major = thousandths % 10 === 0;
            const depth = major ? 6 : 2;

            const a = at(angle, outer);
            const b = at(angle, outer - depth);
            ctx.lineWidth = major ? 0.8 : 0.4;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();

            if (thousandths % 50 === 0) {
                const t = at(angle, outer - 4.5);
                ctx.save();
                ctx.translate(t.x, t.y);
                ctx.rotate(-angle + Math.PI / 2);
                ctx.fillText(wl.toFixed(2).slice(1), 0, 0);
                ctx.restore();
            }
        }
    }

    // Angle of the reflection coefficient, +180 back round to -180
    const angleRingOuter = rings[2];
    ctx.strokeStyle = colors.stripCursor;
    ctx.fillStyle = colors.stripCursor;
    for (let deg = -180; deg < 180; deg += 2) {
        const angle = (deg * Math.PI) / 180;
        const major = deg % 10 === 0;
        const a = at(angle, angleRingOuter);
        const b = at(angle, angleRingOuter - (major ? 6 : 2.5));
        ctx.lineWidth = major ? 0.7 : 0.35;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        if (deg % 30 === 0) {
            const t = at(angle, angleRingOuter - 4.5);
            ctx.save();
            ctx.translate(t.x, t.y);
            ctx.rotate(-angle + Math.PI / 2);
            ctx.fillText(deg.toString(), 0, 0);
            ctx.restore();
        }
    }

    ctx.restore();
}
