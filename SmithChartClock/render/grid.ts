/**
 * The chart itself: resistance circles, reactance arcs and their printed
 * values, the matched centre, and the twelve-hour dial round the rim.
 */

import type { Layer } from './geometry';
import { placeLabels } from './labels';
import { themeColors } from './theme';
import { drawChartRimScales } from './rimScales';

// The gradations a printed Smith chart actually carries. Both the
// resistance circles and the reactance arcs use the same value set: coarse
// near the matched centre, opening out towards the open circuit, so the
// rendered spacing stays roughly even across the chart.
export const GRID_MAJOR: number[] = [
    0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
    1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 3.0, 4.0, 5.0, 10, 20, 50
];

export const GRID_MINOR: number[] = (() => {
    const out: number[] = [];
    const span = (from: number, to: number, step: number): void => {
        for (let v = from; v < to - 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
    };
    span(0.02, 0.2, 0.02);
    span(0.2, 1.0, 0.05);
    span(1.0, 2.0, 0.1);
    span(2.0, 3.0, 0.2);
    span(3.0, 5.0, 0.5);
    span(5.0, 10, 1);
    span(10, 20, 2);
    span(20, 50, 10);
    return out;
})();

/**
 * Renders high-accuracy Smith Chart Background
 */
export function drawSmithChartGrid(layer: Layer): void {
    const { ctx, geo, options } = layer;
    const colors = themeColors(options.theme);
    const R = geo.scaleRadius;

    // 1. Draw Outer Boundary (Gamma = 1.0, |Gamma| = 1 Circle)
    ctx.strokeStyle = colors.outerCircle;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(geo.centerX, geo.centerY, R, 0, 2 * Math.PI);
    ctx.stroke();

    // 2. Draw Prime Real Axis Horizontal Line (-1 to +1)
    ctx.strokeStyle = colors.realAxis;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(geo.centerX - R, geo.centerY);
    ctx.lineTo(geo.centerX + R, geo.centerY);
    ctx.stroke();

    // 3. Draw Constant Resistance (r) Circles, minor gradations first.
    // Circle center: (r / (1 + r), 0) in Gamma plane, radius 1 / (1 + r)
    if (options.showResistanceCircles) {
        const drawR = (r: number, stroke: string, lw: number): void => {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = lw;
            ctx.beginPath();
            ctx.arc(geo.centerX + (r / (1 + r)) * R, geo.centerY, R / (1 + r), 0, 2 * Math.PI);
            ctx.stroke();
        };

        GRID_MINOR.forEach(r => drawR(r, colors.gridMinor, 0.4));
        GRID_MAJOR.forEach(r =>
            drawR(r, r === 1.0 ? colors.gridMajor : colors.gridMinor, r === 1.0 ? 1.3 : 0.75));

        // Printed values on the real axis. Majors are offered first so they
        // win the collision test, then the minor gradations fill in whatever
        // room is left once the chart is zoomed.
        const rLabel = (r: number, major: boolean) => ({
            x: geo.centerX + ((r - 1) / (r + 1)) * R,
            y: geo.centerY - 7,
            text: r.toString(),
            color: major ? colors.text : colors.gridMajor,
            font: major ? '8px ui-monospace, monospace' : '7px ui-monospace, monospace'
        });
        placeLabels(layer, [
            ...GRID_MAJOR.map(r => rLabel(r, true)),
            ...GRID_MINOR.map(r => rLabel(r, false))
        ]);
    }

    // 4. Draw Constant Reactance (x) Arcs
    // Center: (1, 1/x), Radius: 1/|x|, clipped inside |Gamma| <= 1
    if (options.showReactanceArcs) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(geo.centerX, geo.centerY, R, 0, 2 * Math.PI);
        ctx.clip();

        const drawX = (val: number, stroke: string, lw: number): void => {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = lw;
            ctx.beginPath();
            ctx.arc(geo.centerX + R, geo.centerY - (1 / val) * R, (1 / Math.abs(val)) * R, 0, 2 * Math.PI);
            ctx.stroke();
        };

        GRID_MINOR.forEach(x => {
            drawX(x, colors.gridMinor, 0.4);
            drawX(-x, colors.gridMinor, 0.4);
        });
        GRID_MAJOR.forEach(x => {
            const stroke = x === 1.0 ? colors.gridMajor : colors.gridMinor;
            const lw = x === 1.0 ? 1.2 : 0.7;
            drawX(x, stroke, lw);
            drawX(-x, stroke, lw);
        });

        ctx.restore();

        // Printed values, where each arc meets the rim. z = jx puts that
        // meeting point at Gamma = (jx - 1)/(jx + 1), always on |Gamma| = 1.
        // The grid draws +jx in the upper half, so the imaginary axis is
        // flipped here: (cos, -sin).
        const xLabel = (val: number, major: boolean) => {
            const denom = 1 + val * val;
            const angle = Math.atan2((2 * val) / denom, (val * val - 1) / denom);
            const rr = R - 30;
            return {
                x: geo.centerX + rr * Math.cos(angle),
                y: geo.centerY - rr * Math.sin(angle),
                text: (val > 0 ? '+j' : '-j') + Math.abs(val),
                color: major ? colors.text : colors.gridMajor,
                font: major ? '8px ui-monospace, monospace' : '7px ui-monospace, monospace'
            };
        };
        placeLabels(layer, [
            ...GRID_MAJOR.flatMap(x => [xLabel(x, true), xLabel(-x, true)]),
            ...GRID_MINOR.flatMap(x => [xLabel(x, false), xLabel(-x, false)])
        ]);
    }

    // 5. Draw Prime Center Marker (Matched 50 Ohm Point Gamma = 0)
    ctx.fillStyle = colors.centerDot;
    ctx.beginPath();
    ctx.arc(geo.centerX, geo.centerY, 4, 0, 2 * Math.PI);
    ctx.fill();

    // 5b. Calibrated rim rings
    if (options.showRimScales) drawChartRimScales(layer, R);

    // 6. Draw Peripheral Degree & Clock Hour Ticks
    if (options.showAngleScale) {
        ctx.font = '10px sans-serif';
        ctx.fillStyle = colors.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * (2 * Math.PI) - (Math.PI / 2);
            const innerRadius = R + 4;
            const outerRadius = R + 10;
            const textRadius = R + 20;

            const x1 = geo.centerX + innerRadius * Math.cos(angle);
            const y1 = geo.centerY + innerRadius * Math.sin(angle);
            const x2 = geo.centerX + outerRadius * Math.cos(angle);
            const y2 = geo.centerY + outerRadius * Math.sin(angle);

            ctx.strokeStyle = colors.outerCircle;
            ctx.lineWidth = (i % 3 === 0) ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            const tx = geo.centerX + textRadius * Math.cos(angle);
            const ty = geo.centerY + textRadius * Math.sin(angle);
            const hourNum = i === 0 ? 12 : i;
            ctx.fillText(hourNum.toString(), tx, ty);
        }
    }
}
