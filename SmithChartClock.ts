/**
 * SmithChartClock.ts
 * 
 * High-Precision Smith Chart Clock, Chronobiological Mood Engine, 
 * Date-DNA Historical Spiral, and RF Phasor Vector System.
 * 
 * Developed for OneThing / OpenAir libControl
 */

export interface PolarCoordinate {
    magnitude: number; // Normalized from 0.0 (center, matched) to 1.0 (outer boundary, total reflection)
    phase: number;     // Phase angle in radians (-PI to +PI or 0 to 2*PI)
}

export interface CartesianCoordinate {
    x: number; // In canvas pixel coordinates or normalized [-1, 1]
    y: number;
}

export interface ComplexNumber {
    re: number;
    im: number;
}

export interface ImpedanceMetrics {
    gamma: ComplexNumber;       // Reflection coefficient Gamma = re + j*im
    gammaMag: number;           // |Gamma| (0 to 1)
    gammaPhaseDeg: number;      // Angle in degrees (-180 to +180)
    zNorm: ComplexNumber;       // Normalized impedance z = r + jx
    zActual: ComplexNumber;     // Actual impedance Z = R + jX (Ohms)
    vswr: number;               // Voltage Standing Wave Ratio (1 to Infinity)
    returnLossDb: number;       // Return loss in dB (-20 * log10(|Gamma|))
    mismatchLossDb: number;     // Mismatch loss in dB
    interferencePhaseDeg: number; // Phase difference between hands
    interferenceRatio: number;  // Normalized constructive/destructive factor (0 to 2)
}

export interface DateDNA {
    r: number;
    g: number;
    b: number;
    hex: string;
    rgbString: string;
}

export interface MoodData {
    hue: number;
    saturation: number;
    lightness: number;
    hslString: string;
    dayOfYear: number;
    solarLightness: number;
}

export interface SmithChartClockOptions {
    characteristicImpedance?: number; // Default 50 Ohms
    theme?: 'cyber-dark' | 'smith-classic' | 'radar-green' | 'solar-light';
    showSecondHand?: boolean;
    showCompositeVector?: boolean;
    showReactanceArcs?: boolean;
    showResistanceCircles?: boolean;
    showHistoricalSpiral?: boolean;
    showAngleScale?: boolean;
    spiralStartYear?: number;
    spiralEndYear?: number;
    colorEngine?: 'date-dna' | 'mood' | 'rf-phasor' | 'custom';
}

/**
 * RF Mathematics Engine for Smith Chart Computations
 */
export class SmithChartRFMath {
    /**
     * Converts normalized polar reflection coefficient (Gamma) to Cartesian (U, V)
     */
    public static polarToGamma(polar: PolarCoordinate): ComplexNumber {
        return {
            re: polar.magnitude * Math.cos(polar.phase),
            im: polar.magnitude * Math.sin(polar.phase)
        };
    }

    /**
     * Converts Cartesian reflection coefficient (Gamma_r, Gamma_i) to Polar (Mag, Phase)
     */
    public static gammaToPolar(gamma: ComplexNumber): PolarCoordinate {
        const mag = Math.sqrt(gamma.re * gamma.re + gamma.im * gamma.im);
        const phase = Math.atan2(gamma.im, gamma.re);
        return { magnitude: Math.min(1.0, mag), phase };
    }

    /**
     * Transforms Reflection Coefficient Gamma into Normalized Impedance z = (1 + Gamma) / (1 - Gamma)
     */
    public static gammaToNormalizedImpedance(gamma: ComplexNumber): ComplexNumber {
        const denom = (1 - gamma.re) * (1 - gamma.re) + (gamma.im * gamma.im);
        if (denom < 1e-7) {
            // Singularity at Gamma = (1, 0) -> Open Circuit
            return { re: Infinity, im: Infinity };
        }
        const r = (1 - (gamma.re * gamma.re) - (gamma.im * gamma.im)) / denom;
        const x = (2 * gamma.im) / denom;
        return { re: Math.max(0, r), im: x };
    }

    /**
     * Transforms Normalized Impedance z = r + jx to Reflection Coefficient Gamma = (z - 1) / (z + 1)
     */
    public static normalizedImpedanceToGamma(z: ComplexNumber): ComplexNumber {
        if (!isFinite(z.re) || !isFinite(z.im)) {
            return { re: 1.0, im: 0.0 };
        }
        const denom = (z.re + 1) * (z.re + 1) + (z.im * z.im);
        if (denom < 1e-7) return { re: 1.0, im: 0.0 };

        const gammaRe = ((z.re * z.re) + (z.im * z.im) - 1) / denom;
        const gammaIm = (2 * z.im) / denom;
        return { re: gammaRe, im: gammaIm };
    }

    /**
     * Calculates complete impedance metrics from a polar coordinate point
     */
    public static computeMetrics(
        polar: PolarCoordinate,
        z0: number = 50,
        otherHandPolar?: PolarCoordinate
    ): ImpedanceMetrics {
        const gamma = this.polarToGamma(polar);
        const gammaMag = polar.magnitude;
        let gammaPhaseDeg = (polar.phase * 180) / Math.PI;
        // Normalize angle to [-180, 180]
        while (gammaPhaseDeg > 180) gammaPhaseDeg -= 360;
        while (gammaPhaseDeg < -180) gammaPhaseDeg += 360;

        const zNorm = this.gammaToNormalizedImpedance(gamma);
        const zActual: ComplexNumber = {
            re: isFinite(zNorm.re) ? zNorm.re * z0 : Infinity,
            im: isFinite(zNorm.im) ? zNorm.im * z0 : Infinity
        };

        // VSWR = (1 + |Gamma|) / (1 - |Gamma|)
        let vswr = 1.0;
        if (gammaMag >= 0.9999) {
            vswr = Infinity;
        } else {
            vswr = (1 + gammaMag) / (1 - gammaMag);
        }

        // Return Loss (dB) = -20 * log10(|Gamma|)
        let returnLossDb = Infinity;
        if (gammaMag > 1e-5) {
            returnLossDb = -20 * Math.log10(gammaMag);
        }

        // Mismatch Loss = -10 * log10(1 - |Gamma|^2)
        let mismatchLossDb = 0;
        const powerTransmission = 1 - (gammaMag * gammaMag);
        if (powerTransmission > 1e-5) {
            mismatchLossDb = -10 * Math.log10(powerTransmission);
        } else {
            mismatchLossDb = Infinity;
        }

        // Phase difference and interference ratio with another hand (e.g. Hour hand)
        let interferencePhaseDeg = 0;
        let interferenceRatio = 1.0;
        if (otherHandPolar) {
            let delta = Math.abs(polar.phase - otherHandPolar.phase);
            delta = delta % (2 * Math.PI);
            if (delta > Math.PI) delta = 2 * Math.PI - delta;
            interferencePhaseDeg = (delta * 180) / Math.PI;

            // Interference amplitude: |e^(j*theta1) + e^(j*theta2)| = 2 * cos(delta/2)
            interferenceRatio = 2 * Math.cos(delta / 2);
        }

        return {
            gamma,
            gammaMag,
            gammaPhaseDeg,
            zNorm,
            zActual,
            vswr,
            returnLossDb,
            mismatchLossDb,
            interferencePhaseDeg,
            interferenceRatio
        };
    }

    /**
     * Calculates the "Date DNA" color
     * Formula:
     * R: 200 + Month (1..12 -> 201..212)
     * G: 100 + Day (1..31 -> 101..131)
     * B: Last 2 digits of Year (e.g. 1944 -> 44, 2026 -> 26)
     */
    public static computeDateDNA(date: Date): DateDNA {
        const month = date.getMonth() + 1; // 1 to 12
        const day = date.getDate();        // 1 to 31
        const year = date.getFullYear();
        const yearLastTwo = Math.abs(year) % 100;

        const r = Math.min(255, 200 + month);
        const g = Math.min(255, 100 + day);
        const b = Math.min(255, yearLastTwo);

        const hexR = r.toString(16).padStart(2, '0');
        const hexG = g.toString(16).padStart(2, '0');
        const hexB = b.toString(16).padStart(2, '0');
        const hex = `#${hexR}${hexG}${hexB}`;

        return {
            r,
            g,
            b,
            hex,
            rgbString: `rgb(${r}, ${g}, ${b})`
        };
    }

    /**
     * Calculates the Chronobiological Mood Color
     * - Day of year mapped to seasonal hue (Winter: Blue, Spring: Green, Summer: Yellow, Autumn: Red/Magenta)
     * - Solar cycle mapped to lightness (Noon = 70%, Midnight = 30%)
     */
    public static computeMood(date: Date): MoodData {
        // 1. Day of the Year
        const start = new Date(date.getFullYear(), 0, 0);
        const diff = date.getTime() - start.getTime();
        const oneDay = 1000 * 60 * 60 * 24;
        const dayOfYear = Math.max(1, Math.min(366, Math.floor(diff / oneDay)));

        // 2. Seasonal Hue: Offset by ~100 deg
        let hue = ((dayOfYear / 365.25) * 360) + 100;
        hue = (hue % 360 + 360) % 360;

        // 3. Solar Cycle Lightness (Midnight=30%, Noon=70%)
        const hours = date.getHours() + (date.getMinutes() / 60) + (date.getSeconds() / 3600);
        const solarLightness = 30 + (40 * Math.sin((hours / 24) * Math.PI));

        const saturation = 85;
        const hslString = `hsl(${Math.round(hue)}, ${saturation}%, ${Math.round(solarLightness)}%)`;

        return {
            hue,
            saturation,
            lightness: solarLightness,
            hslString,
            dayOfYear,
            solarLightness
        };
    }
}

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

    // Pre-calculated Smith Chart Grid geometry cache
    private static readonly RESISTANCE_CIRCLES = [0, 0.2, 0.5, 1.0, 2.0, 5.0];
    private static readonly REACTANCE_ARCS = [0.2, 0.5, 1.0, 2.0, 5.0];

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
            showHistoricalSpiral: options?.showHistoricalSpiral ?? true,
            showAngleScale: options?.showAngleScale ?? true,
            spiralStartYear: options?.spiralStartYear ?? 1900,
            spiralEndYear: options?.spiralEndYear ?? 2050,
            colorEngine: options?.colorEngine ?? 'rf-phasor'
        };

        this.resize();
        window.addEventListener('resize', this.onWindowResize);
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

        this.centerX = width / 2;
        this.centerY = height / 2;
        // Leave 28px padding for angle & wavelength calibrations
        this.scaleRadius = Math.max(10, Math.min(this.centerX, this.centerY) - 32);
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

        // Clear canvas
        ctx.fillStyle = colors.background;
        ctx.fillRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);

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

        // 3. Draw Constant Resistance (r) Circles
        // Circle center: (r / (1 + r), 0) in Gamma plane
        // Radius: 1 / (1 + r)
        if (this.options.showResistanceCircles) {
            SmithChartClock.RESISTANCE_CIRCLES.forEach(r => {
                if (r === 0) return; // Outer boundary already drawn
                const circleRadius = R / (1 + r);
                const circleCenterOffsetX = (r / (1 + r)) * R;
                const circleCenterX = this.centerX + circleCenterOffsetX;

                ctx.strokeStyle = (r === 1.0) ? colors.gridMajor : colors.gridMinor;
                ctx.lineWidth = (r === 1.0) ? 1.5 : 1.0;
                ctx.beginPath();
                ctx.arc(circleCenterX, this.centerY, circleRadius, 0, 2 * Math.PI);
                ctx.stroke();

                // Draw small label along the real axis
                ctx.fillStyle = colors.text;
                ctx.font = '9px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                const labelX = this.centerX + ((r - 1) / (r + 1)) * R;
                if (Math.abs(labelX - this.centerX) > 10 && labelX < this.centerX + R - 15) {
                    ctx.fillText(`r=${r}`, labelX, this.centerY - 2);
                }
            });
        }

        // 4. Draw Constant Reactance (x) Arcs
        // Center: (1, 1/x), Radius: 1/|x|
        // Arcs are clipped inside the unit circle |Gamma| <= 1
        if (this.options.showReactanceArcs) {
            ctx.save();
            // Create circular clipping path matching unit circle
            ctx.beginPath();
            ctx.arc(this.centerX, this.centerY, R, 0, 2 * Math.PI);
            ctx.clip();

            SmithChartClock.REACTANCE_ARCS.forEach(x => {
                // Inductive arc (+jx, Upper plane) & Capacitive arc (-jx, Lower plane)
                [x, -x].forEach(reactanceVal => {
                    const arcRadius = (1 / Math.abs(reactanceVal)) * R;
                    const arcCenterY = this.centerY - (1 / reactanceVal) * R;
                    const arcCenterX = this.centerX + R;

                    ctx.strokeStyle = (Math.abs(reactanceVal) === 1.0) ? colors.gridMajor : colors.gridMinor;
                    ctx.lineWidth = (Math.abs(reactanceVal) === 1.0) ? 1.2 : 0.8;
                    ctx.setLineDash([4, 2]);

                    ctx.beginPath();
                    ctx.arc(arcCenterX, arcCenterY, arcRadius, 0, 2 * Math.PI);
                    ctx.stroke();
                });
            });

            ctx.setLineDash([]);
            ctx.restore();
        }

        // 5. Draw Prime Center Marker (Matched 50 Ohm Point Gamma = 0)
        ctx.fillStyle = colors.centerDot;
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, 4, 0, 2 * Math.PI);
        ctx.fill();

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
        glow: boolean = true
    ): CartesianCoordinate {
        const target = this.polarToCartesian(polar);
        const ctx = this.ctx;

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
        ctx.moveTo(this.centerX, this.centerY);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();

        // Draw phasor arrowhead
        const headLength = Math.max(6, lineWidth * 2.5);
        const angle = polar.phase;
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

        // Draw label if provided
        if (label) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = color;
            ctx.font = 'bold 11px monospace';
            const labelDist = 14;
            const lx = target.x + labelDist * Math.cos(angle);
            const ly = target.y + labelDist * Math.sin(angle);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, lx, ly);
        }

        ctx.restore();
        return target;
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

        // 1. Draw Smith Chart Background Grid
        this.drawSmithChartGrid();

        // 2. Draw Historical Date-DNA Spiral
        this.drawHistoricalSpiral(now);

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
            const minCart = this.polarToCartesian(minVector);
            const hrCart = this.polarToCartesian(hrVector);

            const compX = (minCart.x - this.centerX) + (hrCart.x - this.centerX);
            const compY = (minCart.y - this.centerY) + (hrCart.y - this.centerY);

            const compMagPx = Math.sqrt(compX * compX + compY * compY);
            const compMagNorm = Math.min(1.0, compMagPx / (this.scaleRadius * 1.55));
            const compPhase = Math.atan2(compY, compX);

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
                2.0,
                'Σ',
                false
            );
        }

        // 5. Render Main Phasor Hands
        // Hour Hand (Low frequency, thick)
        this.drawPhasorVector(hrVector, hrColor, 4.5, 'H');

        // Minute Hand (High frequency, medium)
        this.drawPhasorVector(minVector, minColor, 3.0, 'M');

        // Second Hand (Sweep needle)
        if (this.options.showSecondHand) {
            this.drawPhasorVector(secVector, secColor, 1.5, undefined, true);

            // Counterweight on second hand
            const tailAngle = secPhase + Math.PI;
            const tailLen = this.scaleRadius * 0.18;
            this.ctx.save();
            this.ctx.strokeStyle = secColor;
            this.ctx.lineWidth = 2.5;
            this.ctx.beginPath();
            this.ctx.moveTo(this.centerX, this.centerY);
            this.ctx.lineTo(
                this.centerX + tailLen * Math.cos(tailAngle),
                this.centerY + tailLen * Math.sin(tailAngle)
            );
            this.ctx.stroke();
            this.ctx.restore();
        }

        // Center Cap
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 3.5, 0, 2 * Math.PI);
        this.ctx.fill();

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
        now: Date;
        dna: DateDNA;
        mood: MoodData;
    } {
        const now = this.getEffectiveTime();
        const minutes = now.getMinutes() + (now.getSeconds() / 60);
        const hours = (now.getHours() % 12) + (minutes / 60);

        const minPhase = (minutes / 60.0) * (2 * Math.PI) - (Math.PI / 2);
        const hrPhase = (hours / 12.0) * (2 * Math.PI) - (Math.PI / 2);

        const minPolar: PolarCoordinate = { magnitude: 0.95, phase: minPhase };
        const hrPolar: PolarCoordinate = { magnitude: 0.60, phase: hrPhase };

        const minute = SmithChartRFMath.computeMetrics(minPolar, this.options.characteristicImpedance, hrPolar);
        const hour = SmithChartRFMath.computeMetrics(hrPolar, this.options.characteristicImpedance, minPolar);
        const dna = SmithChartRFMath.computeDateDNA(now);
        const mood = SmithChartRFMath.computeMood(now);

        return { minute, hour, now, dna, mood };
    }

    public destroy(): void {
        this.stop();
        window.removeEventListener('resize', this.onWindowResize);
    }
}
