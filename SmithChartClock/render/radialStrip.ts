/**
 * The RADIALLY SCALED PARAMETERS strip beneath the chart: every ruler of the
 * nomograph and the live cursor at the composite radius.
 */

import type { RadialScaleDef } from '../types';
import { formatScaleValue, RADIAL_SCALES } from '../scales/radialScales';
import type { ChartGeometry, Layer } from './geometry';
import { overlayColors, type OverlayColors } from './theme';

/** Horizontal position of a radius on one ruler of the nomograph. */
export function stripX(geo: ChartGeometry, scale: RadialScaleDef, rho: number, rowLeft: number, rowRight: number): number {
    const cx = geo.centerX;
    const clamped = Math.max(0, Math.min(1, rho));
    if (scale.side === 'left') return cx - clamped * (cx - rowLeft);
    if (scale.side === 'right') return cx + clamped * (rowRight - cx);
    // 'full': linear in Gamma, 0 at the origin, 1 at the centre, 2 at the open
    return rowLeft + ((1 + clamped) / 2) * (rowRight - rowLeft);
}

/**
 * Renders the classic "RADIALLY SCALED PARAMETERS" nomograph beneath the
 * chart, with a live cursor at the composite phasor's radius.
 *
 * Every ruler is scaled against the same radius |Gamma|, so one vertical
 * line through the strip reads SWR, return loss, reflection and transmission
 * coefficients for the current moment all at once.
 */
export function drawRadialParameterScales(layer: Layer, cursorRho: number, cursorGammaRe: number): void {
    const { ctx, geo, options } = layer;
    if (!options.showRadialScales || geo.stripHeight < 60) return;

    const colors = overlayColors(options.theme);
    const width = geo.width;

    // The diagonal end labels lean out past the rulers, so the strip needs
    // real gutters or they run off the canvas.
    const padX = 58;
    const left = padX;
    const right = width - padX;
    const cx = geo.centerX;

    const titleY = geo.stripTop + 11;
    const dirY = geo.stripTop + 24;
    const rowsTop = geo.stripTop + 30;
    // 14px of tail so the bottom ruler's ORIGIN mark stays inside the canvas
    const rowH = (geo.stripHeight - 36 - 14) / 6;
    const slant = 4; // gentle trapezoid, exactly as on a printed chart

    ctx.save();
    ctx.textBaseline = 'alphabetic';

    // Title and the two directions of travel along the line
    ctx.fillStyle = colors.stripTitle;
    ctx.font = '9px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RADIALLY SCALED PARAMETERS', cx, titleY);

    ctx.fillStyle = colors.stripTick;
    ctx.font = '8px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('TOWARD LOAD →', left + (cx - left) / 2, dirY);
    ctx.fillText('← TOWARD GENERATOR', cx + (right - cx) / 2, dirY);

    const rowGeometry = (row: number) => {
        const inset = row >= 5 ? 0 : (4 - row) * slant;
        return {
            y: rowsTop + (row + 1) * rowH,
            rowLeft: left + inset,
            rowRight: right - inset
        };
    };

    // Rule line per row, plus the vertical end caps of the trapezoid
    ctx.strokeStyle = colors.stripRule;
    ctx.lineWidth = 0.8;
    for (let row = 0; row < 6; row++) {
        const g = rowGeometry(row);
        ctx.beginPath();
        ctx.moveTo(g.rowLeft, g.y);
        ctx.lineTo(g.rowRight, g.y);
        ctx.stroke();
    }
    const top = rowGeometry(0);
    const bottom = rowGeometry(4);
    ctx.beginPath();
    ctx.moveTo(top.rowLeft, top.y - rowH);
    ctx.lineTo(bottom.rowLeft, bottom.y);
    ctx.moveTo(top.rowRight, top.y - rowH);
    ctx.lineTo(bottom.rowRight, bottom.y);
    ctx.stroke();

    // Every ruler: minor ticks, printed values, and the diagonal end label
    for (const scale of RADIAL_SCALES) {
        const g = rowGeometry(scale.row);
        drawRadialRuler(layer, scale, g, colors);
    }

    // CENTER and ORIGIN reference marks
    const bar = rowGeometry(5);
    const triangle = (x: number, y: number, label: string) => {
        ctx.fillStyle = colors.stripTitle;
        ctx.beginPath();
        ctx.moveTo(x, y - 4);
        ctx.lineTo(x - 3.5, y + 1);
        ctx.lineTo(x + 3.5, y + 1);
        ctx.closePath();
        ctx.fill();
        ctx.font = '7px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, x, y + 9);
    };
    triangle(cx, bar.y - rowH + 2, 'CENTER');
    triangle(bar.rowLeft, bar.y + 1, 'ORIGIN');

    // Live cursor: one vertical line per half, at the current radius
    const cursorRows = [rowGeometry(0), rowGeometry(4)];
    const yTop = cursorRows[0].y - rowH;
    const yBot = cursorRows[1].y;
    ctx.strokeStyle = colors.stripCursor;
    ctx.lineWidth = 1.2;
    for (const side of ['left', 'right'] as const) {
        const probe = RADIAL_SCALES.find(sc => sc.side === side)!;
        const g = rowGeometry(probe.row);
        const x = stripX(geo, probe, cursorRho, g.rowLeft, g.rowRight);
        ctx.beginPath();
        ctx.moveTo(x, yTop);
        ctx.lineTo(x, yBot);
        ctx.stroke();
    }
    // and one on the full-width transmission ruler, which is linear in Gamma
    const tau = 1 + cursorGammaRe;
    const tauX = bar.rowLeft + (tau / 2) * (bar.rowRight - bar.rowLeft);
    ctx.beginPath();
    ctx.moveTo(tauX, bar.y - rowH + 4);
    ctx.lineTo(tauX, bar.y);
    ctx.stroke();

    ctx.restore();
}

/**
 * Draws one ruler: its ticks, its printed values and its diagonal label.
 */
export function drawRadialRuler(layer: Layer, 
    scale: RadialScaleDef,
    g: { y: number; rowLeft: number; rowRight: number },
    colors: OverlayColors
): void {
    const { ctx, geo } = layer;
    const isFull = scale.side === 'full';

    const xOf = (value: number): number => {
        if (isFull) return g.rowLeft + (value / 2) * (g.rowRight - g.rowLeft);
        return stripX(geo, scale, scale.rhoOf(value), g.rowLeft, g.rowRight);
    };

    // Minor ticks, interpolated in value space between the printed majors
    ctx.strokeStyle = colors.stripTick;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let i = 0; i < scale.ticks.length - 1; i++) {
        const a = scale.ticks[i];
        const b = scale.ticks[i + 1];
        if (!isFinite(a) || !isFinite(b)) continue;
        for (let k = 1; k < 5; k++) {
            const v = a + ((b - a) * k) / 5;
            const x = xOf(v);
            if (x < g.rowLeft - 0.5 || x > g.rowRight + 0.5) continue;
            ctx.moveTo(x, g.y);
            ctx.lineTo(x, g.y - 2.5);
        }
    }
    ctx.stroke();

    // Major ticks and their printed values, skipping any that would collide
    ctx.strokeStyle = colors.stripRule;
    ctx.lineWidth = 0.9;
    ctx.fillStyle = colors.stripText;
    ctx.font = '6.5px ui-monospace, monospace';
    ctx.textAlign = 'center';

    // Several rulers count downwards, so the values have to be placed left
    // to right rather than in tick order, or the overlap test below never
    // fires and the numbers run together.
    const placed = scale.ticks
        .map(value => ({ value, x: xOf(value) }))
        .filter(t => isFinite(t.x) && t.x >= g.rowLeft - 0.5 && t.x <= g.rowRight + 0.5)
        .sort((a, b) => a.x - b.x);

    let lastLabelRight = -Infinity;
    for (const tick of placed) {
        ctx.beginPath();
        ctx.moveTo(tick.x, g.y);
        ctx.lineTo(tick.x, g.y - 4);
        ctx.stroke();

        const text = formatScaleValue(tick.value, scale.precision);
        const halfWidth = ctx.measureText(text).width / 2 + 1.5;
        if (tick.x - halfWidth < lastLabelRight) continue;
        ctx.fillText(text, tick.x, g.y - 5.5);
        lastLabelRight = tick.x + halfWidth;
    }

    // Diagonal end label, set at 45 deg the way a printed chart sets them
    ctx.save();
    ctx.fillStyle = colors.stripTitle;
    ctx.font = '7px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textBaseline = 'middle';
    if (scale.side === 'right' || isFull) {
        ctx.translate(g.rowRight + 3, g.y);
        ctx.rotate(-Math.PI / 4);
        ctx.textAlign = 'left';
        ctx.fillText(scale.label, 0, 0);
    } else {
        ctx.translate(g.rowLeft - 3, g.y);
        ctx.rotate(-Math.PI / 4);
        ctx.textAlign = 'right';
        ctx.fillText(scale.label, 0, 0);
    }
    ctx.restore();
}
