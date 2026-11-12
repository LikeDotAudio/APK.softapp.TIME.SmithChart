// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
        // ==========================================
        // 1. RF MATH & SMITH CHART COMPUTATIONS
        // ==========================================
        /**
         * Every colour the moving parts are drawn in, in one place so the panel
         * can offer them all and the render can read them back each frame.
         */
        const PALETTE = {
            dayAxis:   { label: 'Day axis (hours)',    value: '#fde047' },
            arcMorning:{ label: 'x = +1 arc (1..12)',   value: '#fb923c' },
            arcEvening:{ label: 'x = -1 arc (0..-12)',  value: '#22c55e' },
            hour:     { label: 'Hour vector',        value: '#f43f5e' },
            minute:   { label: 'Minute vector',      value: '#38bdf8' },
            second:   { label: 'Second needle',      value: '#facc15' },
            sigma:    { label: 'Interference sum',   value: '#a855f7' },
            date:     { label: 'Date wheel',         value: '#10b981' },
            month:    { label: 'Month wheel',        value: '#f59e0b' },
            year:     { label: 'Year wheel',         value: '#94a3b8' },
            trail:    { label: 'Day trail (future)', value: '#22d3ee' },
            pivotPath:{ label: 'Pivot trace',        value: '#fb7185' },
            triangle: { label: 'Anchor triangle',    value: '#ffffff' },
            clock:    { label: 'Clock readout',      value: '#f43f5e' }
        };

        const paint = key => PALETTE[key].value;

        /** #rrggbb plus an alpha, as an rgba() string. */
        function tint(key, alpha) {
            const hex = PALETTE[key].value.replace('#', '');
            const n = parseInt(hex, 16);
            return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
        }

        // Magnitudes of each wheel. Slower wheels sit closer to the matched centre.
        const HAND_MAGS = {
            minute: 0.95,
            second: 0.85,
            hour: 0.60,
            date: 0.45,
            month: 0.30,
            year: 0.18
        };

        /**
         * The gradations a printed Smith chart actually carries.
         *
         * Both the resistance circles and the reactance arcs use the same value
         * set: coarse near the matched centre, opening out towards the open
         * circuit, so the rendered spacing stays roughly even across the chart.
         */
        const GRID_MAJOR = [
            0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
            1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 3.0, 4.0, 5.0, 10, 20, 50
        ];

        const GRID_MINOR = (() => {
            const out = [];
            const span = (from, to, step) => {
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
            return out.filter(v => !GRID_MAJOR.includes(v));
        })();

        // Which circles and arcs carry a printed number
        const R_LABELLED = [0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 1.0, 1.5, 2.0, 3.0, 5.0, 10, 20];
        const X_LABELLED = [0.2, 0.4, 0.6, 0.8, 1.0, 1.5, 2.0, 3.0, 5.0, 10];

        /**
         * Which two wheels are crossed to make the plotted locus.
         *
         * The trail has always been the hour and minute arms added together;
         * any other pair is the same construction on different wheels, so the
         * chart can be asked to correlate whichever two the reader cares about.
         */
        const PLOT_PAIRS = [
            { id: 'hour+minute', color: '#22d3ee',   label: 'Hour × Minute',  a: 'hour',   b: 'minute' },
            { id: 'hour+second', color: '#f472b6',   label: 'Hour × Second',  a: 'hour',   b: 'second' },
            { id: 'minute+second', color: '#a3e635', label: 'Minute × Second', a: 'minute', b: 'second' },
            { id: 'hour+date', color: '#fbbf24',     label: 'Hour × Date',    a: 'hour',   b: 'date' },
            { id: 'minute+date', color: '#818cf8',   label: 'Minute × Date',  a: 'minute', b: 'date' },
            { id: 'date+month', color: '#2dd4bf',    label: 'Date × Month',   a: 'date',   b: 'month' },
            { id: 'month+year', color: '#f87171',    label: 'Month × Year',   a: 'month',  b: 'year' }
        ];

        /**
         * Which wheels each time field is assigned to drive.
         *
         * A field can drive two things: one wheel's angle and one wheel's
         * length, its |Gamma|. Either can be left as none. By default every
         * field turns its namesake and drives no length, but the dropdowns let
         * any field be routed to any wheel: point the Day slider at the hour
         * vector and the hour arm starts reading days, or set the minute as the
         * hour arm's length and it stretches out as the hour goes by. Two fields
         * on one wheel is allowed; the later field in this list wins it.
         */
        const FIELD_ORDER = ['second', 'minute', 'hour', 'day', 'month', 'year'];
        const WHEELS = ['second', 'minute', 'hour', 'date', 'month', 'year'];
        const WHEEL_LABELS = {
            second: 'Second needle', minute: 'Minute vector', hour: 'Hour vector',
            date: 'Date wheel', month: 'Month wheel', year: 'Year wheel'
        };

        const fieldToWheel = {
            second: 'second', minute: 'minute', hour: 'hour',
            day: 'date', month: 'month', year: 'year'
        };

        // Nothing drives a length until it is asked to
        const fieldToLength = {
            second: 'none', minute: 'none', hour: 'none',
            day: 'none', month: 'none', year: 'none'
        };

        // The anchor triangle's corners, as length targets. The second and
        // date corners ride their wheels' rings, so they share those lengths;
        // the hour corner is the dot on the day axis, from 0 at the short
        // circuit to 1 at the open circuit.
        const CORNER_TARGETS = { 'corner:hour': 'dayAxis', 'corner:second': 'second', 'corner:date': 'date' };

        // Everything else a field can stretch, beyond the rings. Arms and the
        // sum run from the pivot toward the rim, 0 to all the way; the pivot's
        // distance is from the chart centre, 0 to the rim; a triangle side is
        // 0 to the full diameter, moving its second-named corner.
        const LENGTH_GROUPS = [
            { label: 'Arms (pivot → rim)', options: {
                'arm:hour': 'Hour arm', 'arm:minute': 'Minute arm', 'arm:second': 'Second arm',
                'arm:date': 'Date arm', 'arm:month': 'Month arm', 'arm:year': 'Year arm',
                'arm:sigma': 'Σ vector'
            } },
            { label: 'Triangle', options: {
                'corner:hour': 'Hour corner', 'corner:second': 'Second corner', 'corner:date': 'Date corner',
                'pivot': 'Pivot distance',
                'side:hour-second': 'Side H–S', 'side:hour-date': 'Side H–D', 'side:second-date': 'Side S–D'
            } }
        ];

        /** The palette colour a dropdown's choice is drawn in, for its swatch. */
        function swatchKeyOf(target) {
            if (!target || target === 'none') return null;
            if (target === 'corner:hour') return 'dayAxis';
            if (target === 'pivot') return 'pivotPath';
            if (target.startsWith('side:')) return 'triangle';
            const key = target.replace(/^(arm|corner):/, '');
            return PALETTE[key] ? key : null;
        }

        /** wheel -> the field feeding it in the given assignment map. */
        function sourcesFrom(assignments) {
            const out = {};
            for (const field of FIELD_ORDER) {
                const target = assignments[field];
                if (target && target !== 'none') out[CORNER_TARGETS[target] || target] = field;
            }
            return out;
        }

        /** wheel -> the field currently turning it, or none. */
        const wheelSources = () => sourcesFrom(fieldToWheel);

        /** wheel -> the field currently setting its length, or none. */
        const lengthSources = () => sourcesFrom(fieldToLength);

        const plotPair = () =>
            PLOT_PAIRS.find(pr => pr.id === config.plotPair) || PLOT_PAIRS[0];

        class SmithMath {
            static polarToCartesian(mag, phase, centerX, centerY, scaleRadius) {
                return {
                    x: centerX + (mag * scaleRadius * Math.cos(phase)),
                    y: centerY + (mag * scaleRadius * Math.sin(phase))
                };
            }

            static cartesianToPolar(x, y, centerX, centerY, scaleRadius) {
                const dx = (x - centerX) / scaleRadius;
                const dy = (y - centerY) / scaleRadius;
                const mag = Math.min(1.0, Math.sqrt(dx * dx + dy * dy));
                const phase = Math.atan2(dy, dx);
                return { mag, phase };
            }

            static gammaToImpedance(gammaRe, gammaIm, z0 = 50) {
                const denom = (1 - gammaRe) * (1 - gammaRe) + (gammaIm * gammaIm);
                if (denom < 1e-7) return { r: Infinity, x: Infinity, R: Infinity, X: Infinity };

                const r = (1 - (gammaRe * gammaRe) - (gammaIm * gammaIm)) / denom;
                const x = (2 * gammaIm) / denom;
                return {
                    r: Math.max(0, r),
                    x: x,
                    R: Math.max(0, r * z0),
                    X: x * z0
                };
            }

            // y = Y/Y0 = 1/z = (1 - G)/(1 + G). Same radius as z, phase turned 180 deg.
            static gammaToAdmittance(gammaRe, gammaIm, z0 = 50) {
                const denom = (1 + gammaRe) * (1 + gammaRe) + (gammaIm * gammaIm);
                if (denom < 1e-7) return { g: Infinity, b: Infinity, G: Infinity, B: Infinity };
                const g = (1 - (gammaRe * gammaRe) - (gammaIm * gammaIm)) / denom;
                const b = (-2 * gammaIm) / denom;
                return { g: Math.max(0, g), b, G: Math.max(0, g) / z0, B: b / z0 };
            }

            static daysInMonth(date) {
                return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
            }

            static daysInYear(date) {
                const y = date.getFullYear();
                return ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 366 : 365;
            }

            static dayOfYear(date) {
                return (date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / 86400000;
            }

            /**
             * Every clock wheel as a phasor. Each turns once per its own period
             * and rides its own constant-VSWR circle: the faster the wheel, the
             * further out it sits. Twelve o'clock is up, hence the -PI/2 offset.
             */
            /** Every time field as a ratio of its whole, keyed by wheel. */
            static fieldNormals(date) {
                const seconds = date.getSeconds() + date.getMilliseconds() / 1000;
                const minutes = date.getMinutes() + seconds / 60;
                const dim = SmithMath.daysInMonth(date);
                const dayFrac = (date.getDate() - 1) + (date.getHours() + minutes / 60) / 24;
                const monthFrac = (date.getMonth() + 1) + dayFrac / dim;
                return {
                    second: seconds / 60,
                    minute: minutes / 60,
                    hour: (date.getHours() + minutes / 60) / 24,
                    date: dayFrac / dim,
                    month: monthFrac / 12,
                    year: (date.getFullYear() % 100) / 100
                };
            }

            static handVectors(date) {
                const seconds = date.getSeconds() + date.getMilliseconds() / 1000;
                const minutes = date.getMinutes() + seconds / 60;
                const hours12 = (date.getHours() % 12) + minutes / 60;

                const dim = SmithMath.daysInMonth(date);
                const dayFrac = (date.getDate() - 1) + (date.getHours() + minutes / 60) / 24;
                // Twelve months onto the twelve of the dial: January points at
                // the 1, December at the 12, and each month creeps toward the
                // next across its own days, the way an hour hand does.
                const monthFrac = (date.getMonth() + 1) + dayFrac / dim;
                // The year turns once per year, swept by the day of the year:
                // 365 days across 360 degrees. Its radius is the two-digit year
                // against a scale of 0 to 100, so 2026 sits at 0.26.
                const dayOfYearFrac = SmithMath.dayOfYear(date) / SmithMath.daysInYear(date);
                const yearTwoDigit = date.getFullYear() % 100;

                const turn = (f, whole) => (f / whole) * (2 * Math.PI) - (Math.PI / 2);

                const pad = n => n.toString().padStart(2, '0');

                // Normalized to 1, the same move the chart makes with impedance:
                // divide by the whole and keep the ratio. A day is 1, an hour is
                // 1, a minute is 1 -- so each reading is already a |Gamma|.
                const normal = SmithMath.fieldNormals(date);

                // Either every wheel sits on its own fixed circle, or each one's
                // radius is its own normalized value -- half past putting the
                // minute arm at |Gamma| = 0.5.
                // The year always rides its own 0-to-100 scale; the rest only do
                // when the reader asks for normalized radii.
                const radiusOf = id => (config.normalizedRadius || id === 'year')
                    ? Math.max(0.02, Math.min(1, normal[id]))
                    : HAND_MAGS[id];

                // Every field's own angle and ratio, before routing
                const fields = {
                    second: { phase: turn(seconds, 60), normal: normal.second, value: pad(Math.floor(seconds)) },
                    minute: { phase: turn(minutes, 60), normal: normal.minute, value: pad(date.getMinutes()) },
                    hour:   { phase: turn(hours12, 12), normal: normal.hour,   value: pad((date.getHours() % 12) || 12) },
                    day:    { phase: turn(dayFrac, dim), normal: normal.date,  value: pad(date.getDate()) },
                    month:  { phase: turn(monthFrac, 12), normal: normal.month, value: pad(date.getMonth() + 1) },
                    year:   { phase: turn(dayOfYearFrac, 1), normal: normal.year, value: pad(yearTwoDigit) }
                };

                const sources = wheelSources();
                const lengths = lengthSources();
                const wheel = (id, fallbackField) => {
                    const field = sources[id] || fallbackField;
                    const f = fields[field];
                    // An assigned length is that field's own ratio, read as
                    // |Gamma|. Without one the wheel keeps its usual radius.
                    const lengthField = lengths[id] || null;
                    const mag = lengthField
                        ? Math.max(0.02, Math.min(1, fields[lengthField].normal))
                        : (config.normalizedRadius || id === 'year')
                            ? Math.max(0.02, Math.min(1, f.normal))
                            : HAND_MAGS[id];
                    return { mag, normal: f.normal, phase: f.phase, value: f.value, field, lengthField };
                };

                return {
                    second: { ...wheel('second', 'second'), label: 'S' },
                    minute: { ...wheel('minute', 'minute'), label: 'M' },
                    hour:   { ...wheel('hour', 'hour'),     label: 'H' },
                    date:   { ...wheel('date', 'day'),      label: 'D' },
                    month:  { ...wheel('month', 'month'),   label: 'MO' },
                    year:   { ...wheel('year', 'year'),     label: 'Y' }
                };
            }

/**
             * The composite reflection coefficient: hour + minute as vectors,
             * renormalised so the pair can never leave the unit circle. This is
             * the point the day path traces and the parameter cursor reads.
             */
            static compositePolar(date, pair) {
                const pr = pair || plotPair();
                const h = SmithMath.handVectors(date);
                const a = h[pr.a];
                const b = h[pr.b];
                const re = a.mag * Math.cos(a.phase) + b.mag * Math.cos(b.phase);
                const im = a.mag * Math.sin(a.phase) + b.mag * Math.sin(b.phase);
                const norm = a.mag + b.mag;
                return {
                    mag: Math.min(1.0, Math.sqrt(re * re + im * im) / norm),
                    phase: Math.atan2(im, re)
                };
            }

            /**
             * A full local day of normalization and reflection, read off the
             * clock arms: midnight to midnight, Gamma -> z -> y -> VSWR.
             */
            static buildDayPath(date, sampleMinutes = 2, pair) {
                const pr = pair || plotPair();
                const step = Math.max(1, Math.min(60, Math.round(sampleMinutes)));
                const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);

                const samples = [];
                let best = null, worst = null;

                for (let minuteOfDay = 0; minuteOfDay <= 1440; minuteOfDay += step) {
                    const m = Math.min(1440, minuteOfDay);
                    const stamp = new Date(dayStart.getTime() + m * 60000);
                    const polar = SmithMath.compositePolar(stamp, pr);
                    const rho = polar.mag;
                    const gammaRe = rho * Math.cos(polar.phase);
                    const gammaIm = rho * Math.sin(polar.phase);

                    const sample = {
                        minuteOfDay: m,
                        date: stamp,
                        polar,
                        gammaRe,
                        gammaIm,
                        z: SmithMath.gammaToImpedance(gammaRe, gammaIm, config.z0),
                        y: SmithMath.gammaToAdmittance(gammaRe, gammaIm, config.z0),
                        vswr: rho >= 0.9999 ? Infinity : (1 + rho) / (1 - rho),
                        rl: rho > 1e-5 ? -20 * Math.log10(rho) : Infinity
                    };
                    samples.push(sample);
                    if (!best || rho < best.polar.mag) best = sample;
                    if (!worst || rho > worst.polar.mag) worst = sample;
                }

                return { samples, best, worst, dayStart };
            }

            static computeDateDNA(date) {
                const month = date.getMonth() + 1;
                const day = date.getDate();
                const year = date.getFullYear();
                const yearLastTwo = Math.abs(year) % 100;

                const r = Math.min(255, 200 + month);
                const g = Math.min(255, 100 + day);
                const b = Math.min(255, yearLastTwo);

                const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
                return { r, g, b, hex, formula: `R:200+${month}=${r}, G:100+${day}=${g}, B:${yearLastTwo}` };
            }

            static computeMood(date) {
                const start = new Date(date.getFullYear(), 0, 0);
                const diff = date.getTime() - start.getTime();
                const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

                let hue = ((dayOfYear / 365.25) * 360) + 100;
                hue = (hue % 360 + 360) % 360;

                const hours = date.getHours() + (date.getMinutes() / 60) + (date.getSeconds() / 3600);
                const lightness = 30 + (40 * Math.sin((hours / 24) * Math.PI));

                let season = 'Winter';
                if (hue >= 60 && hue < 150) season = 'Spring';
                else if (hue >= 150 && hue < 270) season = 'Summer';
                else if (hue >= 270 && hue < 350) season = 'Late Summer/Autumn';

                return {
                    hue,
                    lightness,
                    hsl: `hsl(${Math.round(hue)}, 85%, ${Math.round(lightness)}%)`,
                    season
                };
            }
        }

        // ==========================================
        // 1b. RADIALLY SCALED PARAMETERS
        // ==========================================
        // Every ruler on the strip beneath the chart is plotted against the same
        // radius rho = |Gamma|: rho = 1 at the rim, rho = 0 at the matched centre.
        // A ruler is therefore fully described by the pair of functions that
        // convert between its printed value and that radius.
        const INF = Infinity;
        const rhoFromSwr = swr => (swr === INF ? 1 : (swr - 1) / (swr + 1));
        const swrFromRho = rho => (rho >= 0.9999 ? INF : (1 + rho) / (1 - rho));

        const RADIAL_SCALES = [
            {
                id: 'swr', row: 0, side: 'left', label: 'SWR', precision: 2,
                formula: 'SWR = (1 + |Γ|) / (1 − |Γ|)',
                rhoOf: rhoFromSwr, valueOf: swrFromRho,
                ticks: [INF, 100, 40, 20, 10, 5, 4, 3, 2.5, 2, 1.8, 1.6, 1.4, 1.2, 1.1, 1]
            },
            {
                id: 'dbs', row: 1, side: 'left', label: 'dBS', precision: 2,
                formula: 'dBS = 20·log₁₀(SWR)',
                rhoOf: d => (d === INF ? 1 : rhoFromSwr(Math.pow(10, d / 20))),
                valueOf: rho => (rho >= 0.9999 ? INF : 20 * Math.log10(swrFromRho(rho))),
                ticks: [INF, 40, 30, 20, 15, 10, 8, 6, 5, 4, 3, 2, 1, 0]
            },
            {
                id: 'rtnLoss', row: 2, side: 'left', label: 'RTN. LOSS [dB]', precision: 2,
                formula: 'RL = −20·log₁₀|Γ|',
                rhoOf: l => (l === INF ? 0 : Math.pow(10, -l / 20)),
                valueOf: rho => (rho > 1e-5 ? -20 * Math.log10(rho) : INF),
                ticks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 20, 30, INF]
            },
            {
                id: 'rflCoeffE', row: 3, side: 'left', label: 'RFL. COEFF. E or I', precision: 3,
                formula: '|Γ| = (SWR − 1)/(SWR + 1)',
                rhoOf: v => v, valueOf: rho => rho,
                ticks: [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.05, 0.01, 0]
            },
            {
                id: 'rflCoeffP', row: 4, side: 'left', label: 'RFL. COEFF. P', precision: 3,
                formula: '|Γ|² = reflected / incident power',
                rhoOf: v => Math.sqrt(Math.max(0, v)), valueOf: rho => rho * rho,
                ticks: [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0]
            },

            {
                id: 'atten', row: 0, side: 'right', label: 'ATTEN. [dB]', precision: 2,
                formula: 'A = −10·log₁₀|Γ|  (1 dB steps of line loss)',
                rhoOf: a => (a === INF ? 0 : Math.pow(10, -a / 10)),
                valueOf: rho => (rho > 1e-5 ? -10 * Math.log10(rho) : INF),
                ticks: [1, 2, 3, 4, 5, 7, 10, 15]
            },
            {
                id: 'swLossCoeff', row: 1, side: 'right', label: 'S.W. LOSS COEFF', precision: 3,
                formula: '(1 + |Γ|²) / (1 − |Γ|²)',
                rhoOf: c => (c === INF ? 1 : Math.sqrt(Math.max(0, (c - 1) / (c + 1)))),
                valueOf: rho => (rho >= 0.9999 ? INF : (1 + rho * rho) / (1 - rho * rho)),
                ticks: [1, 1.1, 1.2, 1.3, 1.4, 1.6, 1.8, 2, 3, 4, 5, 10, 20, INF]
            },
            {
                id: 'rflLoss', row: 2, side: 'right', label: 'RFL. LOSS [dB]', precision: 3,
                formula: 'ML = −10·log₁₀(1 − |Γ|²)',
                rhoOf: l => (l === INF ? 1 : Math.sqrt(Math.max(0, 1 - Math.pow(10, -l / 10)))),
                valueOf: rho => (rho >= 0.9999 ? INF : -10 * Math.log10(1 - rho * rho)),
                ticks: [0, 0.1, 0.2, 0.4, 0.6, 0.8, 1, 1.5, 2, 3, 4, 5, 6, 10, 15, INF]
            },
            {
                id: 'swPeak', row: 3, side: 'right', label: 'S.W. PEAK (CONST. P)', precision: 3,
                formula: '√((1 + |Γ|) / (1 − |Γ|))',
                rhoOf: pk => (pk === INF ? 1 : (pk * pk - 1) / (pk * pk + 1)),
                valueOf: rho => (rho >= 0.9999 ? INF : Math.sqrt((1 + rho) / (1 - rho))),
                ticks: [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2, 2.5, 3, 4, 5, 10, INF]
            },
            {
                id: 'transmP', row: 4, side: 'right', label: 'TRANSM. COEFF. P', precision: 3,
                formula: '1 − |Γ|² = transmitted / incident power',
                rhoOf: t => Math.sqrt(Math.max(0, 1 - t)), valueOf: rho => 1 - rho * rho,
                ticks: [1, 0.99, 0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0]
            },

            {
                // Linear in Gamma itself, not in |Gamma|, so this ruler spans the
                // whole width: 0 at the ORIGIN, 1 at CENTER, 2 at the open circuit.
                id: 'transmE', row: 5, side: 'full', label: 'TRANSM. COEFF. E or I', precision: 3,
                formula: 'τ = 1 + Γ   (0 at the short, 2 at the open)',
                rhoOf: v => Math.abs(v - 1), valueOf: rho => 1 + rho,
                ticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1,
                        1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2]
            }
        ];

        function formatScaleValue(v, precision = 2) {
            if (!isFinite(v)) return '∞';
            if (Number.isInteger(v)) return v.toString();
            return parseFloat(v.toFixed(precision)).toString();
        }

