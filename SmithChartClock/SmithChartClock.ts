/**
 * The clock itself: owns the canvas, the clock source and the frame loop,
 * and delegates every layer to render/ and every number to the pure folders.
 */

import type {
    CartesianCoordinate, ClockAnchors, DateDNA, DayPathSummary, HandVector, ImpedanceMetrics,
    MoodData, PlotPairDef, PolarCoordinate, SmithChartClockOptions
} from './types';
import { handVectorsForTime, plotPairById } from './time/wheels';
import { DayPathCache } from './time/dayPath';
import { resolveOptions } from './options';
import * as readouts from './readouts';
import { ChartGeometry, type Layer } from './render/geometry';
import { attachViewControls } from './render/input';
import { RimReadings } from './render/labels';
import { clockAnchorsFor } from './render/pivot';
import { drawFrame } from './render/frame';

/**
 * Unified Smith Chart Clock & Chronograph Implementation
 */
export class SmithChartClock {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private geo: ChartGeometry;
    private layer: Layer;

    // Simulation / Custom Time Control
    private isLiveTime: boolean = true;
    private customTime: Date = new Date();
    private animationFrameId: number | null = null;

    // Configuration Options
    public options: Required<SmithChartClockOptions>;

    // Rim readings pending placement for this frame
    private rimReadings = new RimReadings();

    // The day path is identical for every frame of a given day, so cache it
    private dayPaths = new DayPathCache();

    private detachViewControls: () => void;

    constructor(canvas: HTMLCanvasElement, options?: SmithChartClockOptions) {
        this.canvas = canvas;
        const context = canvas.getContext('2d');
        if (!context) throw new Error("Could not initialize 2D canvas context");
        this.ctx = context;

        this.options = resolveOptions(options);
        this.geo = new ChartGeometry(canvas);
        this.layer = { ctx: this.ctx, geo: this.geo, options: this.options };

        this.resize();
        window.addEventListener('resize', this.onWindowResize);
        this.detachViewControls = attachViewControls(this.canvas, this.geo);
    }

    private onWindowResize = (): void => {
        this.resize();
    };

    /**
     * Resizes canvas for Crisp High-DPI Rendering
     */
    public resize(): void {
        this.geo.dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        
        const width = rect.width || this.canvas.width || 600;
        const height = rect.height || this.canvas.height || 600;

        this.canvas.width = width * this.geo.dpr;
        this.canvas.height = height * this.geo.dpr;

        this.ctx.resetTransform?.();
        this.ctx.scale(this.geo.dpr, this.geo.dpr);

        this.geo.layout(width, height, this.options.showRadialScales);
    }

    /** Current magnification, 1 being the whole chart. */
    public getZoom(): number {
        return this.geo.getZoom();
    }

    /** Zooms about a point on the canvas, keeping whatever is under it still. */
    public zoomAbout(px: number, py: number, factor: number): void {
        this.geo.zoomAbout(px, py, factor);
    }

    /** Returns the chart to the whole-view framing. */
    public resetView(): void {
        this.geo.resetView();
    }

    /** Converts normalized Polar coordinate (magnitude [0,1], phase [rad]) to Canvas Pixel X/Y */
    public polarToCartesian(polar: PolarCoordinate): CartesianCoordinate {
        return this.geo.polarToCartesian(polar);
    }

    /** Converts Canvas Pixel X/Y to normalized Polar Coordinate */
    public cartesianToPolar(x: number, y: number): PolarCoordinate {
        return this.geo.cartesianToPolar(x, y);
    }

    /**
     * Sets clock to live system time
     */
    public setLiveTime(live: boolean = true): void {
        this.isLiveTime = live;
    }

    /**
     * Sets custom date/time for time-travel inspection
     */
    public setCustomTime(date: Date): void {
        this.isLiveTime = false;
        this.customTime = new Date(date);
    }

    public getEffectiveTime(): Date {
        return this.isLiveTime ? new Date() : this.customTime;
    }

    /** The pair of wheels currently crossed to make the plotted locus. */
    public plotPair(): PlotPairDef {
        return plotPairById(this.options.plotPair);
    }

    /**
     * Returns the day path for the given date, rebuilding it only when the
     * calendar day or the sample rate actually changes.
     */
    public getDayPath(date: Date = this.getEffectiveTime()): DayPathSummary {
        return this.dayPaths.get(date, this.options.dayPathSampleMinutes, this.plotPair());
    }

    /** The point on the real axis that stands for the current hour of day. */
    public dayOriginFor(now: Date): CartesianCoordinate {
        return this.geo.dayOriginFor(now);
    }

    /** The three points that fix where the clock pivots, and their centroid. */
    public clockAnchorsFor(now: Date, hands: HandVector[] = handVectorsForTime(now)): ClockAnchors {
        return clockAnchorsFor(this.geo, now, hands);
    }

    /**
     * Main Animation & Render Frame Tick
     */
    public tick = (timestamp: number = 0): void => {
        const now = this.getEffectiveTime();
        drawFrame(this.layer, now, this.plotPair(), () => this.getDayPath(now), this.rimReadings);
        this.animationFrameId = requestAnimationFrame(this.tick);
    };

    /**
     * Start clock animation loop
     */
    public start(): void {
        if (!this.animationFrameId) {
            this.tick();
        }
    }

    /**
     * Stop clock animation loop
     */
    public stop(): void {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * Get live impedance and RF metrics for the current hand positions
     */
    public getCurrentMetrics(): {
        minute: ImpedanceMetrics;
        hour: ImpedanceMetrics;
        composite: ImpedanceMetrics;
        hands: HandVector[];
        dayPath: DayPathSummary;
        now: Date;
        dna: DateDNA;
        mood: MoodData;
    } {
        return readouts.getCurrentMetrics(
            this.getEffectiveTime(), this.options.characteristicImpedance, this.plotPair(),
            this.dayPaths, this.options.dayPathSampleMinutes
        );
    }

    /**
     * Reads every ruler of the radially scaled parameter strip at the current
     * composite radius, so a panel can print the whole nomograph as numbers.
     */
    public readRadialScales(): Array<{ id: string; label: string; formula: string; value: string }> {
        return readouts.readRadialScales(this.getEffectiveTime(), this.plotPair());
    }

    /**
     * The chart's own arithmetic, written out with this moment's numbers
     * substituted in, for printing straight into a panel.
     */
    public getFormulaBreakdown(): ReturnType<typeof readouts.getFormulaBreakdown> {
        const z0 = this.options.characteristicImpedance;
        const { composite } = this.getCurrentMetrics();
        return readouts.getFormulaBreakdown(composite, z0);
    }

    public destroy(): void {
        this.stop();
        window.removeEventListener('resize', this.onWindowResize);
        this.detachViewControls();
    }
}

