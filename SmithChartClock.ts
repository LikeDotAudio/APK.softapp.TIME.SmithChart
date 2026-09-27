/**
 * SmithChartClock.ts
 * 
 * High-Precision Smith Chart Clock, Chronobiological Mood Engine, 
 * Date-DNA Historical Spiral, and RF Phasor Vector System.
 * 
 * Developed for OneThing / OpenAir libControl
 */

import type {
    CartesianCoordinate, ClockAnchors, DateDNA, DayPathSummary, HandVector, ImpedanceMetrics,
    MoodData, PlotPairDef, PolarCoordinate, SmithChartClockOptions
} from './SmithChartClock/types';
import { polarToGamma } from './SmithChartClock/math/complex';
import { compositePolarForTime, handVectorsForTime, plotPairById } from './SmithChartClock/time/wheels';
import { DayPathCache } from './SmithChartClock/time/dayPath';
import { resolveOptions } from './SmithChartClock/options';
import * as readouts from './SmithChartClock/readouts';
import { ChartGeometry, type Layer } from './SmithChartClock/render/geometry';
import { attachViewControls } from './SmithChartClock/render/input';
import { RimReadings } from './SmithChartClock/render/labels';
import { themeColors } from './SmithChartClock/render/theme';
import { drawSmithChartGrid } from './SmithChartClock/render/grid';
import { drawHistoricalSpiral } from './SmithChartClock/render/spiral';
import { drawDayPath, drawVswrCircles } from './SmithChartClock/render/loci';
import { drawDayAxis } from './SmithChartClock/render/dayAxis';
import { clockAnchorsFor, drawPivotMark, drawPivotTriangle } from './SmithChartClock/render/pivot';
import { drawHands } from './SmithChartClock/render/handsLayer';
import { drawRadialParameterScales } from './SmithChartClock/render/radialStrip';

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
        const colors = themeColors(this.options.theme);
        const ctx = this.ctx;
        const layer = this.layer;
        const hands = handVectorsForTime(now);

        // 1. Clear, then fence the chart into its own area so a zoomed-in view
        //    cannot spill over the parameter strip below it.
        ctx.fillStyle = colors.background;
        ctx.fillRect(0, 0, this.geo.width, this.geo.height);

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, this.geo.width, this.geo.stripTop);
        ctx.clip();

        drawSmithChartGrid(layer);

        // 2. Historical Date-DNA Spiral (decorative, off by default)
        drawHistoricalSpiral(layer, now);

        // 2b. The composite phasor drives the day path, the VSWR rings and the
        //     radially scaled parameter cursor, so compute it once up front.
        const pair = this.plotPair();
        const composite = compositePolarForTime(now, pair);
        const compositeGamma = polarToGamma(composite);

        // 2c. A full day of reflection, traced by the plotted pair of arms
        if (this.options.showDayPath) drawDayPath(layer, now, this.getDayPath(now));

        // 2d. Constant-VSWR circles: radius |Gamma|, centred on the origin
        if (this.options.showVswrCircles) drawVswrCircles(layer, composite.magnitude);

        // 2e. The day bar, then the three anchors that fix the pivot. Both are
        //     drawn before the arms, because every arm hangs off the centroid
        //     of that triangle.
        const anchors = clockAnchorsFor(this.geo, now, hands);
        drawDayAxis(layer, now);
        drawPivotTriangle(ctx, anchors);

        // 3–6. Composite, H/M/S and calendar arms, then their rim chips
        drawHands(layer, { now, hands, composite, anchors, pair, colors, rim: this.rimReadings });
        this.rimReadings.flush(layer);
        drawPivotMark(ctx, anchors.pivot);

        ctx.restore(); // end of the chart's clip

        // 7. Mark where the composite phasor stands on its own locus right now
        const nowPoint = this.geo.polarToCartesian(composite);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(nowPoint.x, nowPoint.y, 3.2, 0, 2 * Math.PI);
        ctx.stroke();

        // 8. Radially scaled parameters, cursored at the composite radius
        drawRadialParameterScales(layer, composite.magnitude, compositeGamma.re);

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

export type * from './SmithChartClock/types';
export { HAND_MAGNITUDES, PLOT_PAIRS, plotPairById } from './SmithChartClock/time/wheels';
export { SmithChartRFMath } from './SmithChartClock/math/rfMath';
export { RADIAL_SCALES, formatScaleValue } from './SmithChartClock/scales/radialScales';
