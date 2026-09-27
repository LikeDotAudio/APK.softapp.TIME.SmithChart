/**
 * SmithChartClock.ts
 * 
 * High-Precision Smith Chart Clock, Chronobiological Mood Engine, 
 * Date-DNA Historical Spiral, and RF Phasor Vector System.
 * 
 * Developed for OneThing / OpenAir libControl
 */

import type {
    CartesianCoordinate, ClockAnchors, ComplexNumber, DateDNA, DayPathSummary, HandVector,
    ImpedanceMetrics, MoodData, PlotPairDef, PolarCoordinate, RadialScaleDef, SmithChartClockOptions
} from './SmithChartClock/types';
import { HAND_MAGNITUDES, PLOT_PAIRS, plotPairById } from './SmithChartClock/time/wheels';
import { SmithChartRFMath } from './SmithChartClock/math/rfMath';
import { RADIAL_SCALES, formatScaleValue } from './SmithChartClock/scales/radialScales';

export type * from './SmithChartClock/types';
export { HAND_MAGNITUDES, PLOT_PAIRS, plotPairById, SmithChartRFMath, RADIAL_SCALES, formatScaleValue };

/**
 * Unified Smith Chart Clock & Chronograph Implementation
 */
export class SmithChartClock {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private centerX: number = 0;
    private centerY: number = 0;
    private scaleRadius: number = 0;
    private dpr: number = 1;

    // Simulation / Custom Time Control
    private isLiveTime: boolean = true;
    private customTime: Date = new Date();
    private animationFrameId: number | null = null;
    private lastFrameTime: number = 0;

    // Configuration Options
    public options: Required<SmithChartClockOptions>;

    // Vertical band reserved beneath the chart for the radially scaled parameters
    private stripTop: number = 0;
    private stripHeight: number = 0;

    // Where the chart would sit unzoomed. The parameter strip stays pinned to
    // these, so only the chart itself moves under zoom and pan.
    private baseCenterX: number = 0;
    private baseCenterY: number = 0;
    private baseRadius: number = 0;

    // Zoom magnifies the chart radius rather than applying a canvas transform,
    // so line widths and type stay at their natural pixel size and the fine
    // gradations become readable as they spread apart.
    private view = { zoom: 1, panX: 0, panY: 0 };
    private static readonly MAX_ZOOM = 24;
    private dragFrom: { x: number; y: number; panX: number; panY: number } | null = null;

    // Rim readings pending placement for this frame
    private rimReadings: Array<{ phase: number; color: string; text: string }> = [];

    // The day path is identical for every frame of a given day, so cache it
    private dayPathCache: DayPathSummary | null = null;
    private dayPathCacheKey: string = '';

    // The gradations a printed Smith chart actually carries. Both the
    // resistance circles and the reactance arcs use the same value set: coarse
    // near the matched centre, opening out towards the open circuit, so the
    // rendered spacing stays roughly even across the chart.
    private static readonly GRID_MAJOR: number[] = [
        0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
        1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 3.0, 4.0, 5.0, 10, 20, 50
    ];

    private static readonly GRID_MINOR: number[] = (() => {
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

    // Which circles and arcs carry a printed number
    private static readonly R_LABELLED: number[] = [0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 1.0, 1.5, 2.0, 3.0, 5.0, 10, 20];
    private static readonly X_LABELLED: number[] = [0.2, 0.4, 0.6, 0.8, 1.0, 1.5, 2.0, 3.0, 5.0, 10];

    constructor(canvas: HTMLCanvasElement, options?: SmithChartClockOptions) {
        this.canvas = canvas;
        const context = canvas.getContext('2d');
        if (!context) throw new Error("Could not initialize 2D canvas context");
        this.ctx = context;

        this.options = {
            characteristicImpedance: options?.characteristicImpedance ?? 50,
            theme: options?.theme ?? 'cyber-dark',
            showSecondHand: options?.showSecondHand ?? true,
            showCompositeVector: options?.showCompositeVector ?? true,
            showReactanceArcs: options?.showReactanceArcs ?? true,
            showResistanceCircles: options?.showResistanceCircles ?? true,
            // The Date-DNA spiral is a decorative overlay, not an RF reading, and it
            // obscures the day path. It stays available, but it is off by default.
            showHistoricalSpiral: options?.showHistoricalSpiral ?? false,
            showAngleScale: options?.showAngleScale ?? true,
            showCalendarHands: options?.showCalendarHands ?? true,
            showVswrCircles: options?.showVswrCircles ?? true,
            showDayPath: options?.showDayPath ?? true,
            showAdmittancePath: options?.showAdmittancePath ?? false,
            showRadialScales: options?.showRadialScales ?? true,
            showRimScales: options?.showRimScales ?? true,
            dayPathSampleMinutes: options?.dayPathSampleMinutes ?? 2,
            plotPair: options?.plotPair ?? PLOT_PAIRS[0].id,
            spiralStartYear: options?.spiralStartYear ?? 1900,
            spiralEndYear: options?.spiralEndYear ?? 2050,
            colorEngine: options?.colorEngine ?? 'rf-phasor'
        };

        this.resize();
        window.addEventListener('resize', this.onWindowResize);
        this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
        this.canvas.addEventListener('mousedown', this.onPointerDown);
        this.canvas.addEventListener('mousemove', this.onPointerMove);
        this.canvas.addEventListener('dblclick', this.onDoubleClick);
        window.addEventListener('mouseup', this.onPointerUp);
    }

    private onWindowResize = (): void => {
        this.resize();
    };

    /**
     * Resizes canvas for Crisp High-DPI Rendering
     */
    public resize(): void {
        this.dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        
        const width = rect.width || this.canvas.width || 600;
        const height = rect.height || this.canvas.height || 600;

        this.canvas.width = width * this.dpr;
        this.canvas.height = height * this.dpr;

        this.ctx.resetTransform?.();
        this.ctx.scale(this.dpr, this.dpr);

        // Reserve a band at the foot of the canvas for the radially scaled
        // parameters, then centre the chart in whatever is left above it.
        this.stripHeight = this.options.showRadialScales
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
    private applyView(): void {
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
        const next = Math.min(SmithChartClock.MAX_ZOOM, Math.max(1, previous * factor));
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

    private onWheel = (e: WheelEvent): void => {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        // A small step, so the fine gradations can be crept up on
        this.zoomAbout(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0012));
    };

    private onPointerDown = (e: MouseEvent): void => {
        const rect = this.canvas.getBoundingClientRect();
        this.dragFrom = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            panX: this.view.panX,
            panY: this.view.panY
        };
    };

    private onPointerMove = (e: MouseEvent): void => {
        if (!this.dragFrom) return;
        const rect = this.canvas.getBoundingClientRect();
        this.view.panX = this.dragFrom.panX + (e.clientX - rect.left - this.dragFrom.x);
        this.view.panY = this.dragFrom.panY + (e.clientY - rect.top - this.dragFrom.y);
        this.applyView();
    };

    private onPointerUp = (): void => {
        this.dragFrom = null;
    };

    private onDoubleClick = (): void => {
        this.resetView();
    };

    /**
     * Prints as many of the candidate labels as will actually fit.
     *
     * Every gradation offers a label; which ones survive is decided by whether
     * they collide with one already down. That is what makes the chart densify
     * as it is zoomed: the same candidates spread apart, so more get through.
     * Feed majors before minors, because earlier candidates win.
     */
    private placeLabels(
        candidates: Array<{ x: number; y: number; text: string; color: string; font: string }>,
        pad: number = 3
    ): void {
        const ctx = this.ctx;
        const width = this.canvas.width / this.dpr;
        const placed: Array<{ x: number; y: number; w: number; h: number }> = [];

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (const item of candidates) {
            if (item.x < -40 || item.x > width + 40) continue;
            if (item.y < -20 || item.y > this.stripTop + 20) continue;

            ctx.font = item.font;
            const w = ctx.measureText(item.text).width + pad * 2;
            const h = 9 + pad;

            const clash = placed.some(q =>
                Math.abs(item.x - q.x) < (w + q.w) / 2 &&
                Math.abs(item.y - q.y) < (h + q.h) / 2);
            if (clash) continue;

            placed.push({ x: item.x, y: item.y, w, h });
            ctx.fillStyle = item.color;
            ctx.fillText(item.text, item.x, item.y);
        }
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

    /**
     * Get theme color palette
     */
    private getThemeColors() {
        const theme = this.options.theme;
        switch (theme) {
            case 'smith-classic':
                return {
                    background: '#f8fafc',
                    outerCircle: '#334155',
                    realAxis: '#475569',
                    gridMinor: '#cbd5e1',
                    gridMajor: '#94a3b8',
                    text: '#0f172a',
                    hourHand: '#dc2626',
                    minuteHand: '#2563eb',
                    secondHand: '#ea580c',
                    compositeHand: '#7c3aed',
                    centerDot: '#0f172a',
                    spiralGlow: 'rgba(217, 119, 6, 0.25)',
                    spiralCore: '#d97706'
                };
            case 'radar-green':
                return {
                    background: '#041308',
                    outerCircle: '#10b981',
                    realAxis: '#059669',
                    gridMinor: '#064e3b',
                    gridMajor: '#047857',
                    text: '#34d399',
                    hourHand: '#f59e0b',
                    minuteHand: '#10b981',
                    secondHand: '#ef4444',
                    compositeHand: '#06b6d4',
                    centerDot: '#10b981',
                    spiralGlow: 'rgba(16, 185, 129, 0.2)',
                    spiralCore: '#34d399'
                };
            case 'solar-light':
                return {
                    background: '#ffffff',
                    outerCircle: '#1e293b',
                    realAxis: '#334155',
                    gridMinor: '#e2e8f0',
                    gridMajor: '#cbd5e1',
                    text: '#0f172a',
                    hourHand: '#e11d48',
                    minuteHand: '#0284c7',
                    secondHand: '#f59e0b',
                    compositeHand: '#9333ea',
                    centerDot: '#0f172a',
                    spiralGlow: 'rgba(234, 88, 12, 0.2)',
                    spiralCore: '#ea580c'
                };
            case 'cyber-dark':
            default:
                return {
                    background: '#0a0d14',
                    outerCircle: '#38bdf8',
                    realAxis: '#0284c7',
                    gridMinor: '#1e293b',
                    gridMajor: '#334155',
                    text: '#94a3b8',
                    hourHand: '#ff3366',
                    minuteHand: '#38bdf8',
                    secondHand: '#facc15',
                    compositeHand: '#a855f7',
                    centerDot: '#38bdf8',
                    spiralGlow: 'rgba(244, 63, 94, 0.25)',
                    spiralCore: '#f43f5e'
                };
        }
    }

    /**
     * Renders high-accuracy Smith Chart Background
     */
    private drawSmithChartGrid(): void {
        const colors = this.getThemeColors();
        const ctx = this.ctx;
        const R = this.scaleRadius;

        // 1. Draw Outer Boundary (Gamma = 1.0, |Gamma| = 1 Circle)
        ctx.strokeStyle = colors.outerCircle;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, R, 0, 2 * Math.PI);
        ctx.stroke();

        // 2. Draw Prime Real Axis Horizontal Line (-1 to +1)
        ctx.strokeStyle = colors.realAxis;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(this.centerX - R, this.centerY);
        ctx.lineTo(this.centerX + R, this.centerY);
        ctx.stroke();

        // 3. Draw Constant Resistance (r) Circles, minor gradations first.
        // Circle center: (r / (1 + r), 0) in Gamma plane, radius 1 / (1 + r)
        if (this.options.showResistanceCircles) {
            const drawR = (r: number, stroke: string, lw: number): void => {
                ctx.strokeStyle = stroke;
                ctx.lineWidth = lw;
                ctx.beginPath();
                ctx.arc(this.centerX + (r / (1 + r)) * R, this.centerY, R / (1 + r), 0, 2 * Math.PI);
                ctx.stroke();
            };

            SmithChartClock.GRID_MINOR.forEach(r => drawR(r, colors.gridMinor, 0.4));
            SmithChartClock.GRID_MAJOR.forEach(r =>
                drawR(r, r === 1.0 ? colors.gridMajor : colors.gridMinor, r === 1.0 ? 1.3 : 0.75));

            // Printed values on the real axis. Majors are offered first so they
            // win the collision test, then the minor gradations fill in whatever
            // room is left once the chart is zoomed.
            const rLabel = (r: number, major: boolean) => ({
                x: this.centerX + ((r - 1) / (r + 1)) * R,
                y: this.centerY - 7,
                text: r.toString(),
                color: major ? colors.text : colors.gridMajor,
                font: major ? '8px ui-monospace, monospace' : '7px ui-monospace, monospace'
            });
            this.placeLabels([
                ...SmithChartClock.GRID_MAJOR.map(r => rLabel(r, true)),
                ...SmithChartClock.GRID_MINOR.map(r => rLabel(r, false))
            ]);
        }

        // 4. Draw Constant Reactance (x) Arcs
        // Center: (1, 1/x), Radius: 1/|x|, clipped inside |Gamma| <= 1
        if (this.options.showReactanceArcs) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(this.centerX, this.centerY, R, 0, 2 * Math.PI);
            ctx.clip();

            const drawX = (val: number, stroke: string, lw: number): void => {
                ctx.strokeStyle = stroke;
                ctx.lineWidth = lw;
                ctx.beginPath();
                ctx.arc(this.centerX + R, this.centerY - (1 / val) * R, (1 / Math.abs(val)) * R, 0, 2 * Math.PI);
                ctx.stroke();
            };

            SmithChartClock.GRID_MINOR.forEach(x => {
                drawX(x, colors.gridMinor, 0.4);
                drawX(-x, colors.gridMinor, 0.4);
            });
            SmithChartClock.GRID_MAJOR.forEach(x => {
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
                    x: this.centerX + rr * Math.cos(angle),
                    y: this.centerY - rr * Math.sin(angle),
                    text: (val > 0 ? '+j' : '-j') + Math.abs(val),
                    color: major ? colors.text : colors.gridMajor,
                    font: major ? '8px ui-monospace, monospace' : '7px ui-monospace, monospace'
                };
            };
            this.placeLabels([
                ...SmithChartClock.GRID_MAJOR.flatMap(x => [xLabel(x, true), xLabel(-x, true)]),
                ...SmithChartClock.GRID_MINOR.flatMap(x => [xLabel(x, false), xLabel(-x, false)])
            ]);
        }

        // 5. Draw Prime Center Marker (Matched 50 Ohm Point Gamma = 0)
        ctx.fillStyle = colors.centerDot;
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, 4, 0, 2 * Math.PI);
        ctx.fill();

        // 5b. Calibrated rim rings
        if (this.options.showRimScales) this.drawChartRimScales(R);

        // 6. Draw Peripheral Degree & Clock Hour Ticks
        if (this.options.showAngleScale) {
            ctx.font = '10px sans-serif';
            ctx.fillStyle = colors.text;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            for (let i = 0; i < 12; i++) {
                const angle = (i / 12) * (2 * Math.PI) - (Math.PI / 2);
                const innerRadius = R + 4;
                const outerRadius = R + 10;
                const textRadius = R + 20;

                const x1 = this.centerX + innerRadius * Math.cos(angle);
                const y1 = this.centerY + innerRadius * Math.sin(angle);
                const x2 = this.centerX + outerRadius * Math.cos(angle);
                const y2 = this.centerY + outerRadius * Math.sin(angle);

                ctx.strokeStyle = colors.outerCircle;
                ctx.lineWidth = (i % 3 === 0) ? 2 : 1;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();

                const tx = this.centerX + textRadius * Math.cos(angle);
                const ty = this.centerY + textRadius * Math.sin(angle);
                const hourNum = i === 0 ? 12 : i;
                ctx.fillText(hourNum.toString(), tx, ty);
            }
        }
    }

    /**
     * Draws the Historical Date-DNA Spiral
     */
    private drawHistoricalSpiral(currentDate: Date): void {
        if (!this.options.showHistoricalSpiral) return;

        const ctx = this.ctx;
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();
        const currentDay = currentDate.getDate();

        const startYear = this.options.spiralStartYear;
        const endYear = Math.max(this.options.spiralEndYear, currentYear + 10);
        const totalYearSpan = endYear - startYear;

        const yearsElapsed = currentYear - startYear + (currentDate.getMonth() / 12) + (currentDay / 365.25);
        if (yearsElapsed <= 0) return;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Step resolution: 24 steps per year for smooth rendering
        const totalSteps = Math.floor(yearsElapsed * 16);
        if (totalSteps < 2) {
            ctx.restore();
            return;
        }

        let prevPoint: CartesianCoordinate | null = null;

        for (let i = 0; i <= totalSteps; i++) {
            const progress = i / totalSteps;
            const simYears = startYear + (progress * yearsElapsed);
            const simYearInt = Math.floor(simYears);
            const fracYear = simYears - simYearInt;
            const simDayOfYear = Math.floor(fracYear * 365.25);

            // Normalized radius expanding outward from center (0) to edge (1)
            const normalizedRadius = Math.min(0.98, Math.max(0.02, (simYears - startYear) / totalYearSpan));

            // Angle: Day of Year (1..365) maps to 0..2*PI (starting at top -PI/2)
            const angle = (simDayOfYear / 365.25) * (2 * Math.PI) - (Math.PI / 2);

            const pt: CartesianCoordinate = {
                x: this.centerX + (normalizedRadius * this.scaleRadius * Math.cos(angle)),
                y: this.centerY + (normalizedRadius * this.scaleRadius * Math.sin(angle))
            };

            if (prevPoint) {
                // Compute Date-DNA color for this segment
                const simDate = new Date(simYearInt, 0, Math.max(1, simDayOfYear));
                let strokeStyle: string;

                if (this.options.colorEngine === 'date-dna') {
                    const dna = SmithChartRFMath.computeDateDNA(simDate);
                    strokeStyle = `rgba(${dna.r}, ${dna.g}, ${dna.b}, 0.75)`;
                } else if (this.options.colorEngine === 'mood') {
                    const mood = SmithChartRFMath.computeMood(simDate);
                    strokeStyle = `hsla(${Math.round(mood.hue)}, 85%, ${Math.round(mood.lightness)}%, 0.75)`;
                } else {
                    // Cyber glow orange/magenta gradient
                    const hue = (simYears * 13) % 360;
                    strokeStyle = `hsla(${hue}, 90%, 60%, 0.7)`;
                }

                ctx.strokeStyle = strokeStyle;
                ctx.lineWidth = 2.0;
                ctx.beginPath();
                ctx.moveTo(prevPoint.x, prevPoint.y);
                ctx.lineTo(pt.x, pt.y);
                ctx.stroke();
            }

            prevPoint = pt;
        }

        // Draw glowing head of the timeline at current date
        if (prevPoint) {
            const dna = SmithChartRFMath.computeDateDNA(currentDate);
            ctx.fillStyle = dna.hex;
            ctx.shadowColor = dna.hex;
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(prevPoint.x, prevPoint.y, 4.5, 0, 2 * Math.PI);
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        ctx.restore();
    }

    /**
     * Draws an RF Phasor Vector with optional arrow head and glow
     */
    private drawPhasorVector(
        polar: PolarCoordinate,
        color: string,
        lineWidth: number,
        label?: string,
        glow: boolean = true,
        origin?: CartesianCoordinate,
        anchor?: CartesianCoordinate,
        reachRim: boolean = false
    ): CartesianCoordinate {
        const ctx = this.ctx;

        // The arms no longer grow out of the chart centre: they emanate from the
        // hour of day, the dot riding the real axis.
        const o = origin ?? { x: this.centerX, y: this.centerY };

        // Some arms take their direction from a triangle corner rather than from
        // their own wheel phase, so the arm and the corner cannot drift apart.
        // Either way the arm runs out to the main circle.
        const angle = anchor
            ? Math.atan2(anchor.y - o.y, anchor.x - o.x)
            : polar.phase;

        // Where that ray leaves the unit circle, so no arm overshoots the chart
        // once its origin has slid away from the middle.
        const ox = o.x - this.centerX;
        const oy = o.y - this.centerY;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        const proj = ox * dx + oy * dy;
        const limit = -proj + Math.sqrt(
            Math.max(0, proj * proj + this.scaleRadius * this.scaleRadius - (ox * ox + oy * oy))
        );
        // Arms bound to a triangle corner run on through it to the rim; every
        // other arm keeps its own radius, which is what puts it on its own
        // constant-VSWR circle.
        const length = reachRim ? limit * 0.97 : Math.min(polar.magnitude * this.scaleRadius, limit * 0.97);
        const target: CartesianCoordinate = { x: o.x + length * dx, y: o.y + length * dy };

        ctx.save();
        if (glow) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 8;
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';

        // Draw main vector shaft
        ctx.beginPath();
        ctx.moveTo(o.x, o.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();

        // Draw phasor arrowhead
        const headLength = Math.max(6, lineWidth * 2.5);
        const arrowAngle = Math.PI / 7;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(target.x, target.y);
        ctx.lineTo(
            target.x - headLength * Math.cos(angle - arrowAngle),
            target.y - headLength * Math.sin(angle - arrowAngle)
        );
        ctx.lineTo(
            target.x - headLength * Math.cos(angle + arrowAngle),
            target.y - headLength * Math.sin(angle + arrowAngle)
        );
        ctx.closePath();
        ctx.fill();

        // The corner the arm passes through, marked on the shaft
        if (anchor && reachRim) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#0a0d14';
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(anchor.x, anchor.y, 4, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
        }

        // Draw label if provided
        if (label) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = color;
            ctx.font = 'bold 14px monospace';
            const labelDist = Math.max(16, lineWidth * 2.6);
            const lx = target.x + labelDist * Math.cos(angle);
            const ly = target.y + labelDist * Math.sin(angle);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, lx, ly);
        }

        ctx.restore();
        return target;
    }

    /** The pair of wheels currently crossed to make the plotted locus. */
    public plotPair(): PlotPairDef {
        return plotPairById(this.options.plotPair);
    }

    /**
     * Accent colours for the overlays that the base palette does not name.
     */
    private getOverlayColors() {
        const base = this.getThemeColors();
        const light = this.options.theme === 'smith-classic' || this.options.theme === 'solar-light';
        return {
            ...base,
            stripRule: light ? '#334155' : '#3f4c63',
            stripTick: light ? '#475569' : '#55657f',
            stripText: light ? '#0f172a' : '#9fb0c7',
            stripTitle: light ? '#1e293b' : '#cbd5e1',
            stripCursor: light ? '#dc2626' : '#f43f5e',
            dayPathPast: light ? '#0f766e' : '#22d3ee',
            dayPathFuture: light ? 'rgba(15, 118, 110, 0.22)' : 'rgba(34, 211, 238, 0.18)',
            vswrCircle: light ? 'rgba(220, 38, 38, 0.35)' : 'rgba(244, 63, 94, 0.35)',
            admittance: light ? 'rgba(124, 58, 237, 0.45)' : 'rgba(168, 85, 247, 0.4)'
        };
    }

    /**
     * Returns the day path for the given date, rebuilding it only when the
     * calendar day or the sample rate actually changes.
     */
    public getDayPath(date: Date = this.getEffectiveTime()): DayPathSummary {
        const pair = this.plotPair();
        const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
            + `-${this.options.dayPathSampleMinutes}-${pair.id}`;
        if (!this.dayPathCache || this.dayPathCacheKey !== key) {
            this.dayPathCache = SmithChartRFMath.buildDayPath(date, this.options.dayPathSampleMinutes, pair);
            this.dayPathCacheKey = key;
        }
        return this.dayPathCache;
    }

    /**
     * Constant-VSWR circles: centred on the origin with radius |Gamma|.
     *
     * Each clock wheel rides one of these, so the dial rings and the RF reading
     * are literally the same curve. The composite phasor's circle moves.
     */
    private drawVswrCircles(compositeRho: number): void {
        const ctx = this.ctx;
        const colors = this.getOverlayColors();
        const R = this.scaleRadius;

        const rings: Array<{ rho: number; strong: boolean; note: string }> = [
            { rho: HAND_MAGNITUDES.minute, strong: false, note: 'M' },
            { rho: HAND_MAGNITUDES.hour, strong: false, note: 'H' },
            { rho: compositeRho, strong: true, note: 'Σ' }
        ];
        if (this.options.showCalendarHands) {
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
            ctx.arc(this.centerX, this.centerY, ring.rho * R, 0, 2 * Math.PI);
            ctx.stroke();

            // Label each circle at its own angle, so the readings do not pile
            // up along a single diagonal. -2.356 rad is 135 deg in canvas space.
            const swr = ring.rho >= 0.9999 ? '∞' : ((1 + ring.rho) / (1 - ring.rho)).toFixed(2);
            const a = -2.356 + rings.indexOf(ring) * 0.34;
            ctx.setLineDash([]);
            ctx.fillStyle = ring.strong ? colors.stripCursor : colors.stripTick;
            ctx.font = ring.strong ? 'bold 9px ui-monospace, monospace' : '8px ui-monospace, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
                `${ring.note} ${swr}:1`,
                this.centerX + ring.rho * R * Math.cos(a),
                this.centerY + ring.rho * R * Math.sin(a)
            );
        }
        ctx.restore();
    }

    /**
     * The path of the day: 24 hours of reflection coefficient, traced out by
     * the hour and minute arms and coloured by time of day. The portion already
     * elapsed is drawn solid; the rest of the day is a faint preview.
     */
    private drawDayPath(now: Date): void {
        const ctx = this.ctx;
        const colors = this.getOverlayColors();
        const path = this.getDayPath(now);
        const nowMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Optional admittance locus: the same day reflected through the origin,
        // because y = 1/z sits diametrically opposite z on the chart.
        if (this.options.showAdmittancePath) {
            ctx.strokeStyle = colors.admittance;
            ctx.lineWidth = 1.0;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            path.samples.forEach((sample, i) => {
                const pt = this.polarToCartesian({
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
        let prev = this.polarToCartesian(path.samples[0].polar);
        for (let i = 1; i < path.samples.length; i++) {
            const sample = path.samples[i];
            const pt = this.polarToCartesian(sample.polar);
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
            const pt = this.polarToCartesian(sample.polar);
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
            const pt = this.polarToCartesian(mark.sample.polar);
            ctx.strokeStyle = mark.color;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 4.5, 0, 2 * Math.PI);
            ctx.stroke();
        }

        ctx.restore();
    }

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
    private drawChartRimScales(R: number): void {
        const ctx = this.ctx;
        const colors = this.getOverlayColors();

        const at = (angle: number, radius: number): CartesianCoordinate => ({
            x: this.centerX + radius * Math.cos(angle),
            y: this.centerY - radius * Math.sin(angle)
        });

        const rings = [R, R - 9, R - 18, R - 27];

        ctx.save();

        // Ring separators
        ctx.strokeStyle = colors.realAxis;
        ctx.lineWidth = 0.6;
        for (const radius of rings.slice(1)) {
            ctx.beginPath();
            ctx.arc(this.centerX, this.centerY, radius, 0, 2 * Math.PI);
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

    /**
     * The point on the real axis that stands for the current hour of day.
     */
    public dayOriginFor(now: Date): CartesianCoordinate {
        const secondsIntoDay =
            now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000;
        return {
            x: this.centerX + (2 * (secondsIntoDay / 86400) - 1) * this.scaleRadius,
            y: this.centerY
        };
    }

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
    public clockAnchorsFor(now: Date): ClockAnchors {
        const hands = SmithChartRFMath.handVectorsForTime(now);
        const at = (id: HandVector['id']): CartesianCoordinate =>
            this.polarToCartesian(hands.find(h => h.id === id)!.polar);

        const hour = this.dayOriginFor(now);
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
    private drawPivotTriangle(anchors: ClockAnchors): void {
        const ctx = this.ctx;
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
    private drawPivotMark(pivot: CartesianCoordinate): void {
        const ctx = this.ctx;
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

    /**
     * The ghost of a hand: the traditional clock reading.
     *
     * The solid arms emanate from the hour of day, which slides along the real
     * axis, so they no longer line up with the dial numbers. This faint line
     * runs from the matched centre out to the rim in the same direction, which
     * is what actually points at the 10 at twenty to eleven.
     */
    /** Where a wheel's ghost ray meets the rim, and so where its chip sits. */
    private rimPointFor(phase: number): CartesianCoordinate {
        return {
            x: this.centerX + this.scaleRadius * Math.cos(phase),
            y: this.centerY + this.scaleRadius * Math.sin(phase)
        };
    }

    private drawGhostHand(polar: PolarCoordinate, color: string, reading?: string): void {
        const ctx = this.ctx;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(this.centerX, this.centerY);
        ctx.lineTo(
            this.centerX + this.scaleRadius * Math.cos(polar.phase),
            this.centerY + this.scaleRadius * Math.sin(polar.phase)
        );
        ctx.stroke();

        // and a bead where the arm's own magnitude falls on that line
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.65;
        ctx.fillStyle = color;
        const bead = this.polarToCartesian(polar);
        ctx.beginPath();
        ctx.arc(bead.x, bead.y, 2.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();

        // The value this line is reading, printed where it leaves the chart.
        // Queued rather than drawn, so coincident wheels can be spread out once
        // the whole set is known.
        if (reading) this.rimReadings.push({ phase: polar.phase, color, text: reading });
    }

    /**
     * Prints what each ghost line reads, just outside the rim it points at.
     *
     * A dotted line on its own only says which way a wheel is facing; the chip
     * says what it is facing at. Each gets a dark pill so it stays legible
     * where it crosses a dial number, and chips step outwards when two wheels
     * happen to point almost the same way.
     */
    private flushRimReadings(): void {
        const ctx = this.ctx;
        ctx.save();
        ctx.font = 'bold 9px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const placed: Array<{ cx: number; cy: number; w: number; h: number }> = [];

        for (const reading of this.rimReadings) {
            const w = ctx.measureText(reading.text).width + 7;
            const h = 13;

            let rr = this.scaleRadius + 30;
            let box = { cx: 0, cy: 0, w, h };
            for (let attempt = 0; attempt < 4; attempt++) {
                box = {
                    cx: this.centerX + rr * Math.cos(reading.phase),
                    cy: this.centerY + rr * Math.sin(reading.phase),
                    w,
                    h
                };
                const clash = placed.some(q =>
                    Math.abs(box.cx - q.cx) < (box.w + q.w) / 2 + 3 &&
                    Math.abs(box.cy - q.cy) < (box.h + q.h) / 2 + 3);
                if (!clash) break;
                rr += 16;
            }
            placed.push(box);

            const left = box.cx - w / 2;
            const top = box.cy - h / 2;
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
            ctx.fillText(reading.text, box.cx, box.cy);
        }

        ctx.restore();
        this.rimReadings = [];
    }

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
    private drawDayAxis(now: Date): void {
        const ctx = this.ctx;
        const colors = this.getOverlayColors();

        const secondsIntoDay =
            now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000;
        const dayFraction = secondsIntoDay / 86400;

        const xOfFraction = (f: number): number => this.centerX + (2 * f - 1) * this.scaleRadius;
        const axisY = this.centerY;

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
        ctx.moveTo(this.centerX - this.scaleRadius, axisY);
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

    // ---------------------------------------------------------------- strip

    /** Horizontal position of a radius on one ruler of the nomograph. */
    private stripX(scale: RadialScaleDef, rho: number, rowLeft: number, rowRight: number): number {
        const cx = this.centerX;
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
    private drawRadialParameterScales(cursorRho: number, cursorGammaRe: number): void {
        if (!this.options.showRadialScales || this.stripHeight < 60) return;

        const ctx = this.ctx;
        const colors = this.getOverlayColors();
        const width = this.canvas.width / this.dpr;

        // The diagonal end labels lean out past the rulers, so the strip needs
        // real gutters or they run off the canvas.
        const padX = 58;
        const left = padX;
        const right = width - padX;
        const cx = this.centerX;

        const titleY = this.stripTop + 11;
        const dirY = this.stripTop + 24;
        const rowsTop = this.stripTop + 30;
        // 14px of tail so the bottom ruler's ORIGIN mark stays inside the canvas
        const rowH = (this.stripHeight - 36 - 14) / 6;
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
            this.drawRadialRuler(scale, g, rowH, colors);
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
            const x = this.stripX(probe, cursorRho, g.rowLeft, g.rowRight);
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
    private drawRadialRuler(
        scale: RadialScaleDef,
        g: { y: number; rowLeft: number; rowRight: number },
        rowH: number,
        colors: ReturnType<SmithChartClock['getOverlayColors']>
    ): void {
        const ctx = this.ctx;
        const isFull = scale.side === 'full';

        const xOf = (value: number): number => {
            if (isFull) return g.rowLeft + (value / 2) * (g.rowRight - g.rowLeft);
            return this.stripX(scale, scale.rhoOf(value), g.rowLeft, g.rowRight);
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
        void rowH;
    }

    /**
     * Main Animation & Render Frame Tick
     */
    public tick = (timestamp: number = 0): void => {
        const now = this.getEffectiveTime();
        const colors = this.getThemeColors();

        const milliseconds = now.getMilliseconds();
        const seconds = now.getSeconds() + (milliseconds / 1000);
        const minutes = now.getMinutes() + (seconds / 60);
        const hours = (now.getHours() % 12) + (minutes / 60);

        // 1. Clear, then fence the chart into its own area so a zoomed-in view
        //    cannot spill over the parameter strip below it.
        this.ctx.fillStyle = colors.background;
        this.ctx.fillRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(0, 0, this.canvas.width / this.dpr, this.stripTop);
        this.ctx.clip();

        this.drawSmithChartGrid();

        // 2. Draw Historical Date-DNA Spiral (decorative, off by default)
        this.drawHistoricalSpiral(now);

        // 2b. The composite phasor drives the day path, the VSWR rings and the
        //     radially scaled parameter cursor, so compute it once up front.
        const composite = SmithChartRFMath.compositePolarForTime(now, this.plotPair());
        const compositeGamma = SmithChartRFMath.polarToGamma(composite);

        // 2c. A full day of reflection, traced by the hour and minute arms
        if (this.options.showDayPath) {
            this.drawDayPath(now);
        }

        // 2d. Constant-VSWR circles: radius |Gamma|, centred on the origin
        if (this.options.showVswrCircles) {
            this.drawVswrCircles(composite.magnitude);
        }

        // 2e. The day bar, then the three anchors that fix the pivot. Both are
        //     drawn before the arms, because every arm hangs off the centroid
        //     of that triangle.
        const anchors = this.clockAnchorsFor(now);
        const dayOrigin = anchors.pivot;
        this.drawDayAxis(now);
        this.drawPivotTriangle(anchors);

        // 3. Compute Hand Phasors
        // Minute Hand: 60 min = 2*PI, offset by -PI/2 to start at top (12 o'clock)
        const minPhase = (minutes / 60.0) * (2 * Math.PI) - (Math.PI / 2);
        const minVector: PolarCoordinate = { magnitude: 0.95, phase: minPhase };

        // Hour Hand: 12 hr = 2*PI, offset by -PI/2
        const hrPhase = (hours / 12.0) * (2 * Math.PI) - (Math.PI / 2);
        const hrVector: PolarCoordinate = { magnitude: 0.60, phase: hrPhase };

        // Second Hand: 60 sec = 2*PI
        const secPhase = (seconds / 60.0) * (2 * Math.PI) - (Math.PI / 2);
        const secVector: PolarCoordinate = { magnitude: 0.85, phase: secPhase };

        // Determine Vector Colors based on active engine
        let hrColor = colors.hourHand;
        let minColor = colors.minuteHand;
        let secColor = colors.secondHand;

        if (this.options.colorEngine === 'date-dna') {
            const dna = SmithChartRFMath.computeDateDNA(now);
            hrColor = dna.hex;
            minColor = `rgba(${dna.r}, ${dna.g}, ${dna.b}, 0.8)`;
            secColor = colors.secondHand;
        } else if (this.options.colorEngine === 'mood') {
            const mood = SmithChartRFMath.computeMood(now);
            hrColor = mood.hslString;
            minColor = `hsla(${Math.round(mood.hue)}, 85%, ${Math.round(mood.lightness)}%, 0.7)`;
            secColor = colors.secondHand;
        }

        // 4. Render Composite Phasor Vector (Hour + Minute Sum)
        if (this.options.showCompositeVector) {
            const pair = this.plotPair();
            const wheels = SmithChartRFMath.handVectorsForTime(now);
            const minCart = this.polarToCartesian(wheels.find(h => h.id === pair.a)!.polar);
            const hrCart = this.polarToCartesian(wheels.find(h => h.id === pair.b)!.polar);

            const compX = (minCart.x - this.centerX) + (hrCart.x - this.centerX);
            const compY = (minCart.y - this.centerY) + (hrCart.y - this.centerY);

            const compMagNorm = composite.magnitude;
            const compPhase = composite.phase;
            void compX; void compY;

            // Draw dashed parallelogram lines
            this.ctx.save();
            this.ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([3, 3]);
            this.ctx.beginPath();
            this.ctx.moveTo(minCart.x, minCart.y);
            this.ctx.lineTo(this.centerX + compX, this.centerY + compY);
            this.ctx.lineTo(hrCart.x, hrCart.y);
            this.ctx.stroke();
            this.ctx.restore();

            // Draw resultant vector
            this.drawPhasorVector(
                { magnitude: compMagNorm, phase: compPhase },
                colors.compositeHand,
                5.0,
                'Σ',
                false,
                dayOrigin
            );
        }

        // 5. Render Main Phasor Hands, deliberately overscaled so they stay
        //    legible on top of a full day of interference-sum history.
        // Ghosts first: centre-to-rim lines that still read against the dial,
        // each printing its own value at the edge it points to.
        const wheelsNow = SmithChartRFMath.handVectorsForTime(now);
        const readingFor = (id: HandVector['id']): string => {
            const wheel = wheelsNow.find(h => h.id === id)!;
            return `${wheel.label} ${wheel.value}`;
        };
        this.drawGhostHand(hrVector, hrColor, readingFor('hour'));
        this.drawGhostHand(minVector, minColor, readingFor('minute'));
        if (this.options.showSecondHand) this.drawGhostHand(secVector, secColor, readingFor('second'));

        // Hour Hand (Low frequency, thick)
        // Each arm is aimed at its own rim value, so the minute arm points at the
        // minute reading and the hour arm at the hour, even though both now start
        // from the pivot rather than the centre of the chart.
        this.drawPhasorVector(hrVector, hrColor, 9.0, 'H', true, dayOrigin, this.rimPointFor(hrPhase));

        // Minute Hand (High frequency, medium)
        this.drawPhasorVector(minVector, minColor, 6.0, 'M', true, dayOrigin, this.rimPointFor(minPhase));

        // Second Hand (Sweep needle) runs through its corner and on to the rim
        if (this.options.showSecondHand) {
            this.drawPhasorVector(secVector, secColor, 2.8, undefined, true, dayOrigin, anchors.second, true);

            // Counterweight, opposite the way the arm actually points
            const tailAngle = Math.atan2(
                anchors.second.y - dayOrigin.y,
                anchors.second.x - dayOrigin.x
            ) + Math.PI;
            const tailLen = this.scaleRadius * 0.18;
            this.ctx.save();
            this.ctx.strokeStyle = secColor;
            this.ctx.lineWidth = 4.0;
            this.ctx.beginPath();
            this.ctx.moveTo(dayOrigin.x, dayOrigin.y);
            this.ctx.lineTo(
                dayOrigin.x + tailLen * Math.cos(tailAngle),
                dayOrigin.y + tailLen * Math.sin(tailAngle)
            );
            this.ctx.stroke();
            this.ctx.restore();
        }

        // 6. Calendar wheels: date, month and year, each on its own VSWR circle
        if (this.options.showCalendarHands) {
            const calendarColors: Record<string, string> = {
                date: '#10b981',
                month: '#f59e0b',
                year: '#94a3b8'
            };
            for (const hand of SmithChartRFMath.handVectorsForTime(now)) {
                if (hand.id !== 'date' && hand.id !== 'month' && hand.id !== 'year') continue;
                this.drawGhostHand(hand.polar, calendarColors[hand.id], `${hand.label} ${hand.value}`);
                // The date arm is a triangle corner too, so it runs through it
                this.drawPhasorVector(
                    hand.polar, calendarColors[hand.id], 4.5, hand.label, true, dayOrigin,
                    hand.id === 'date' ? anchors.date : this.rimPointFor(hand.polar.phase),
                    hand.id === 'date'
                );
            }
        }

        this.flushRimReadings();
        this.drawPivotMark(dayOrigin);

        this.ctx.restore(); // end of the chart's clip

        // 7. Mark where the composite phasor stands on its own locus right now
        const nowPoint = this.polarToCartesian(composite);
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1.2;
        this.ctx.beginPath();
        this.ctx.arc(nowPoint.x, nowPoint.y, 3.2, 0, 2 * Math.PI);
        this.ctx.stroke();

        // 8. Radially scaled parameters, cursored at the composite radius
        this.drawRadialParameterScales(composite.magnitude, compositeGamma.re);

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
        const now = this.getEffectiveTime();
        const z0 = this.options.characteristicImpedance;
        const hands = SmithChartRFMath.handVectorsForTime(now);

        const minPolar = hands.find(h => h.id === 'minute')!.polar;
        const hrPolar = hands.find(h => h.id === 'hour')!.polar;
        const compositePolar = SmithChartRFMath.compositePolarForTime(now, this.plotPair());

        const minute = SmithChartRFMath.computeMetrics(minPolar, z0, hrPolar);
        const hour = SmithChartRFMath.computeMetrics(hrPolar, z0, minPolar);
        const composite = SmithChartRFMath.computeMetrics(compositePolar, z0, hrPolar);

        return {
            minute,
            hour,
            composite,
            hands,
            dayPath: this.getDayPath(now),
            now,
            dna: SmithChartRFMath.computeDateDNA(now),
            mood: SmithChartRFMath.computeMood(now)
        };
    }

    /**
     * Reads every ruler of the radially scaled parameter strip at the current
     * composite radius, so a panel can print the whole nomograph as numbers.
     */
    public readRadialScales(): Array<{ id: string; label: string; formula: string; value: string }> {
        const composite = SmithChartRFMath.compositePolarForTime(this.getEffectiveTime(), this.plotPair());
        const gamma = SmithChartRFMath.polarToGamma(composite);
        const rho = composite.magnitude;

        return RADIAL_SCALES.map(scale => ({
            id: scale.id,
            label: scale.label,
            formula: scale.formula,
            value: formatScaleValue(
                scale.side === 'full' ? 1 + gamma.re : scale.valueOf(rho),
                scale.precision
            )
        }));
    }

    /**
     * The chart's own arithmetic, written out with this moment's numbers
     * substituted in. Intended to be printed straight into a panel so the
     * reading and the formula that produced it sit side by side.
     */
    public getFormulaBreakdown(): Array<{
        section: string;
        title: string;
        symbolic: string;
        substituted: string;
        note?: string;
    }> {
        const z0 = this.options.characteristicImpedance;
        const { composite } = this.getCurrentMetrics();

        const f = (v: number, d: number = 3): string => (isFinite(v) ? v.toFixed(d) : '∞');
        const cx = (c: ComplexNumber, d: number = 3): string => {
            if (!isFinite(c.re) || !isFinite(c.im)) return '∞';
            return `${c.re.toFixed(d)} ${c.im >= 0 ? '+' : '−'} j${Math.abs(c.im).toFixed(d)}`;
        };

        const g = composite.gamma;
        const z = composite.zNorm;
        const y = composite.yNorm;
        const Z = composite.zActual;
        const rho = composite.gammaMag;

        return [
            {
                section: '1. Normalization',
                title: 'Normalized impedance',
                symbolic: 'z = Z / Z₀ = r + jx',
                substituted: `z = (${cx(Z, 1)}) Ω / ${z0} Ω = ${cx(z)}`,
                note: 'Every radius on the chart is a ratio to the line impedance, never an absolute ohm value.'
            },
            {
                section: '1. Normalization',
                title: 'Normalized admittance',
                symbolic: 'y = Y / Y₀ = 1 / z = g + jb',
                substituted: `y = 1 / (${cx(z)}) = ${cx(y)}`,
                note: 'y sits diametrically opposite z: same radius, phase rotated by 180°.'
            },
            {
                section: '2. Reflection Coefficient',
                title: 'Definition',
                symbolic: 'Γ = (Zₗ − Z₀) / (Zₗ + Z₀) = |Γ| e^{jθ}',
                substituted: `Γ = ${cx(g)} = ${f(rho)} ∠ ${f(composite.gammaPhaseDeg, 1)}°`,
                note: 'The composite phasor: the hour and minute arms added, renormalised to the unit circle.'
            },
            {
                section: '2. Reflection Coefficient',
                title: 'In terms of normalized impedance',
                symbolic: 'Γ = (z − 1) / (z + 1)',
                substituted: `Γ = ((${cx(z)}) − 1) / ((${cx(z)}) + 1) = ${cx(g)}`
            },
            {
                section: '2. Reflection Coefficient',
                title: 'Inverting for normalized impedance',
                symbolic: 'z = (1 + Γ) / (1 − Γ)',
                substituted: `z = (1 + ${cx(g)}) / (1 − ${cx(g)}) = ${cx(z)}`
            },
            {
                section: '2. Reflection Coefficient',
                title: 'Magnitude, from VSWR',
                symbolic: '|Γ| = (VSWR − 1) / (VSWR + 1)',
                substituted: `|Γ| = (${f(composite.vswr, 2)} − 1) / (${f(composite.vswr, 2)} + 1) = ${f(rho)}`
            },
            {
                section: '3. Voltage Standing Wave Ratio',
                title: 'Definition',
                symbolic: 'VSWR = Vₘₐₓ / Vₘᵢₙ = (1 + |Γ|) / (1 − |Γ|)',
                substituted: `VSWR = (1 + ${f(rho)}) / (1 − ${f(rho)}) = ${f(composite.vswr, 2)} : 1`
            },
            {
                section: '3. Voltage Standing Wave Ratio',
                title: 'Graphical use',
                symbolic: 'circle centred on r = 1, x = 0, radius |Γ|',
                substituted: `constant-VSWR circle of radius ${f(rho)} about the matched centre`,
                note: 'Drawn on the chart in red. Each clock arm rides its own constant-VSWR circle.'
            },
            {
                section: '4. Derived losses',
                title: 'Return loss',
                symbolic: 'RL = −20·log₁₀|Γ|',
                substituted: `RL = −20·log₁₀(${f(rho)}) = ${f(composite.returnLossDb, 2)} dB`
            },
            {
                section: '4. Derived losses',
                title: 'Reflection (mismatch) loss',
                symbolic: 'ML = −10·log₁₀(1 − |Γ|²)',
                substituted: `ML = −10·log₁₀(1 − ${f(rho * rho)}) = ${f(composite.mismatchLossDb, 3)} dB`
            },
            {
                section: '4. Derived losses',
                title: 'Transmission coefficient',
                symbolic: 'τ = 1 + Γ,   τₚ = 1 − |Γ|²',
                substituted: `τ = ${f(composite.transmCoeffE)},  τₚ = ${f(composite.transmCoeffP)}`
            }
        ];
    }

    public destroy(): void {
        this.stop();
        window.removeEventListener('resize', this.onWindowResize);
        this.canvas.removeEventListener('wheel', this.onWheel);
        this.canvas.removeEventListener('mousedown', this.onPointerDown);
        this.canvas.removeEventListener('mousemove', this.onPointerMove);
        this.canvas.removeEventListener('dblclick', this.onDoubleClick);
        window.removeEventListener('mouseup', this.onPointerUp);
    }
}
