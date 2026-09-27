/**
 * Where the chart sits on the canvas: layout, the zoom/pan view, and the
 * conversions between chart polar coordinates and canvas pixels.
 */

import type { CartesianCoordinate, PolarCoordinate, SmithChartClockOptions } from '../types';
import { dayFraction } from '../time/wheels';

const MAX_ZOOM = 24;

export class ChartGeometry {
    public centerX: number = 0;
    public centerY: number = 0;
    public scaleRadius: number = 0;
    public dpr: number = 1;

    // Vertical band reserved beneath the chart for the radially scaled parameters
    public stripTop: number = 0;
    public stripHeight: number = 0;

    // Where the chart would sit unzoomed. The parameter strip stays pinned to
    // these, so only the chart itself moves under zoom and pan.
    private baseCenterX: number = 0;
    private baseCenterY: number = 0;
    private baseRadius: number = 0;

    // Zoom magnifies the chart radius rather than applying a canvas transform,
    // so line widths and type stay at their natural pixel size and the fine
    // gradations become readable as they spread apart.
    public view = { zoom: 1, panX: 0, panY: 0 };

    constructor(private readonly canvas: HTMLCanvasElement) {}

    /** Canvas width in CSS pixels. */
    public get width(): number {
        return this.canvas.width / this.dpr;
    }

    /** Canvas height in CSS pixels. */
    public get height(): number {
        return this.canvas.height / this.dpr;
    }

    /**
     * Reserve a band at the foot of the canvas for the radially scaled
     * parameters, then centre the chart in whatever is left above it.
     */
    public layout(width: number, height: number, showRadialScales: boolean): void {
        this.stripHeight = showRadialScales
            ? Math.max(120, Math.min(210, height * 0.28))
            : 0;
        this.stripTop = height - this.stripHeight;

        const chartHeight = height - this.stripHeight;
        this.baseCenterX = width / 2;
        this.baseCenterY = chartHeight / 2;
        // Outside the rim sit the dial numbers and, beyond them, the value each
        // ghost line is reading. Both need clearance.
        this.baseRadius = Math.max(10, Math.min(width / 2, chartHeight / 2) - 52);
        this.applyView();
    }

    /** Folds the current zoom and pan into the geometry the renderers use. */
    public applyView(): void {
        this.centerX = this.baseCenterX + this.view.panX;
        this.centerY = this.baseCenterY + this.view.panY;
        this.scaleRadius = this.baseRadius * this.view.zoom;
    }

    /** Current magnification, 1 being the whole chart. */
    public getZoom(): number {
        return this.view.zoom;
    }

    /** Zooms about a point on the canvas, keeping whatever is under it still. */
    public zoomAbout(px: number, py: number, factor: number): void {
        const previous = this.view.zoom;
        const next = Math.min(MAX_ZOOM, Math.max(1, previous * factor));
        if (next === previous) return;

        const k = next / previous;
        this.view.panX = px - k * (px - this.centerX) - this.baseCenterX;
        this.view.panY = py - k * (py - this.centerY) - this.baseCenterY;
        this.view.zoom = next;
        this.applyView();
    }

    /** Returns the chart to the whole-view framing. */
    public resetView(): void {
        this.view = { zoom: 1, panX: 0, panY: 0 };
        this.applyView();
    }

    /**
     * Converts normalized Polar coordinate (magnitude [0,1], phase [rad]) to Canvas Pixel X/Y
     */
    public polarToCartesian(polar: PolarCoordinate): CartesianCoordinate {
        return {
            x: this.centerX + (polar.magnitude * this.scaleRadius * Math.cos(polar.phase)),
            y: this.centerY + (polar.magnitude * this.scaleRadius * Math.sin(polar.phase))
        };
    }

    /**
     * Converts Canvas Pixel X/Y to normalized Polar Coordinate
     */
    public cartesianToPolar(x: number, y: number): PolarCoordinate {
        const dx = (x - this.centerX) / this.scaleRadius;
        const dy = (y - this.centerY) / this.scaleRadius;
        const magnitude = Math.min(1.0, Math.sqrt(dx * dx + dy * dy));
        const phase = Math.atan2(dy, dx);
        return { magnitude, phase };
    }

    /** Where a wheel's ghost ray meets the rim, and so where its chip sits. */
    public rimPointFor(phase: number): CartesianCoordinate {
        return {
            x: this.centerX + this.scaleRadius * Math.cos(phase),
            y: this.centerY + this.scaleRadius * Math.sin(phase)
        };
    }

    /**
     * The point on the real axis that stands for the current hour of day.
     */
    public dayOriginFor(now: Date): CartesianCoordinate {
        return {
            x: this.centerX + (2 * dayFraction(now) - 1) * this.scaleRadius,
            y: this.centerY
        };
    }
}

/** What every renderer draws with, in place of the class's `this`. */
export interface Layer {
    ctx: CanvasRenderingContext2D;
    geo: ChartGeometry;
    options: Required<SmithChartClockOptions>;
}
