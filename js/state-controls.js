// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
        // ==========================================
        // 2. SMITH CHART CLOCK APPLICATION STATE
        // ==========================================
        const canvas = document.getElementById('smithClockCanvas');
        const ctx = canvas.getContext('2d');

        let isLive = true;
        let simDate = new Date();
        let audioContext = null;
        let audioTickEnabled = false;
        let lastTickedSecond = -1;

        // Configuration
        const config = {
            z0: 50,
            // The Date-DNA spiral is decorative, not an RF reading, and it buries
            // the day path. It stays available, but it is off by default.
            showSpiral: false,
            showComposite: true,
            showSecond: true,
            showReactance: true,
            showResistance: true,
            showDayPath: true,
            showAdmittance: false,
            showVswrCircles: true,
            showCalendar: true,
            showRadialScales: true,
            showRimScales: true,
            showPivotTrace: true,
            normalizedRadius: false,
            showTimeLandmarks: true,
            showRegions: true,
            plotPair: 'hour+minute',
            // Every intersection currently being logged. The primary one above
            // drives the Sigma arm, the parameter cursor and the day history;
            // the rest are drawn alongside it as their own loci.
            loggedPairs: ['hour+minute'],
            // How much of the past each logged trail shows brightly, in minutes.
            trailMinutes: 240,
            dayPathSampleMinutes: 2,
            colorEngine: 'rf-phasor', // 'date-dna' | 'mood' | 'rf-phasor'
            spiralStartYear: 1900,
            spiralEndYear: 2050
        };

        // The day path is the same for every frame of a given day, so cache it.
        let dayPathCache = new Map();
        function getDayPath(date, pair) {
            const pr = pair || plotPair();
            const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
                + `-${config.dayPathSampleMinutes}-${config.z0}-${pr.id}-${config.normalizedRadius}`;
            let hit = dayPathCache.get(pr.id);
            if (!hit || hit.key !== key) {
                hit = { key, path: SmithMath.buildDayPath(date, config.dayPathSampleMinutes, pr) };
                dayPathCache.set(pr.id, hit);
            }
            return hit.path;
        }

        // DOM Elements
        const liveDateStr = document.getElementById('liveDateStr');
        const liveTimeStr = document.getElementById('liveTimeStr');
        const btnToggleLive = document.getElementById('btnToggleLive');
        const sliderYear = document.getElementById('sliderYear');
        const sliderMonth = document.getElementById('sliderMonth');
        const sliderDay = document.getElementById('sliderDay');
        const sliderHour = document.getElementById('sliderHour');
        const sliderMinute = document.getElementById('sliderMinute');

        const labelYear = document.getElementById('labelYear');
        const labelMonth = document.getElementById('labelMonth');
        const labelDay = document.getElementById('labelDay');
        const labelHour = document.getElementById('labelHour');
        const labelMinute = document.getElementById('labelMinute');

        const valPhaseDelta = document.getElementById('valPhaseDelta');
        const valInterferenceRatio = document.getElementById('valInterferenceRatio');
        const valMinVswr = document.getElementById('valMinVswr');
        const valHrRl = document.getElementById('valHrRl');
        const interferenceBadge = document.getElementById('interferenceBadge');
        const interferenceBar = document.getElementById('interferenceBar');

        const dnaSwatch = document.getElementById('dnaSwatch');
        const dnaFormulaStr = document.getElementById('dnaFormulaStr');
        const dnaHexStr = document.getElementById('dnaHexStr');
        const moodDescStr = document.getElementById('moodDescStr');
        const colorEngineSelect = document.getElementById('colorEngineSelect');

        const probeOverlay = document.getElementById('probeOverlay');
        const probeGamma = document.getElementById('probeGamma');
        const probeZ = document.getElementById('probeZ');
        const probeVswr = document.getElementById('probeVswr');

        // Switches
        document.getElementById('chkSpiral').addEventListener('change', e => config.showSpiral = e.target.checked);
        document.getElementById('chkComposite').addEventListener('change', e => config.showComposite = e.target.checked);
        document.getElementById('chkSecond').addEventListener('change', e => config.showSecond = e.target.checked);
        document.getElementById('chkReactance').addEventListener('change', e => config.showReactance = e.target.checked);
        document.getElementById('chkResistance').addEventListener('change', e => config.showResistance = e.target.checked);
        document.getElementById('chkDayPath').addEventListener('change', e => config.showDayPath = e.target.checked);
        document.getElementById('chkAdmittance').addEventListener('change', e => config.showAdmittance = e.target.checked);
        document.getElementById('chkVswr').addEventListener('change', e => config.showVswrCircles = e.target.checked);
        document.getElementById('chkCalendar').addEventListener('change', e => config.showCalendar = e.target.checked);
        // Zoom buttons work from the middle of the chart
        function nudgeZoom(factor) {
            zoomAbout(baseCenterX, baseCenterY, factor);
        }

        function resetZoom() {
            resetView();
            document.getElementById('zoomBadge').textContent = '1.00\u00d7';
        }

        // Each time field says which wheel's angle, and which wheel's length,
        // it is driving
        document.querySelectorAll('.assign-select').forEach(select => {
            const field = select.dataset.field;
            const assignments = select.dataset.target === 'length' ? fieldToLength : fieldToWheel;
            const option = (value, label) =>
                `<option value="${value}"${assignments[field] === value ? ' selected' : ''}>${label}</option>`;
            const wheelOptions = WHEELS.map(w => option(w, WHEEL_LABELS[w])).join('');
            select.innerHTML = select.dataset.target === 'length'
                ? option('none', '(none)')
                    + `<optgroup label="Ring |Γ| (normalized)">${wheelOptions}</optgroup>`
                    + LENGTH_GROUPS.map(g => `<optgroup label="${g.label}">${
                        Object.entries(g.options).map(([value, label]) => option(value, label)).join('')}</optgroup>`).join('')
                : option('none', '(none)') + wheelOptions;
            select.addEventListener('change', e => {
                assignments[field] = e.target.value;
                dayPathCache.clear();
                pivotTrace.length = 0;
                refreshAssignSwatches();
            });
        });

        // Each dropdown carries a swatch in the colour of what it drives
        function refreshAssignSwatches() {
            document.querySelectorAll('.assign-select').forEach(select => {
                const key = swatchKeyOf(select.value);
                select.style.boxShadow = key ? `inset 7px 0 0 ${paint(key)}` : 'none';
            });
        }
        refreshAssignSwatches();

        // How far back every logged trail reaches
        const sliderTrail = document.getElementById('sliderTrail');
        const labelTrail = document.getElementById('labelTrail');
        const showTrailLength = () => {
            const m = config.trailMinutes;
            labelTrail.textContent = m >= 60
                ? `${Math.floor(m / 60)}h ${(m % 60).toString().padStart(2, '0')}m`
                : `${m}m`;
        };
        sliderTrail.addEventListener('input', e => {
            config.trailMinutes = parseInt(e.target.value, 10);
            showTrailLength();
        });
        showTrailLength();

        // Which intersections are being logged, each in its own colour
        const loggedHost = document.getElementById('loggedPairs');
        loggedHost.innerHTML = PLOT_PAIRS.map(pr => `
            <label class="palette-row">
                <input type="checkbox" data-pair="${pr.id}"${config.loggedPairs.includes(pr.id) ? ' checked' : ''}>
                <span style="display:inline-block;width:14px;height:8px;border-radius:2px;background:${pr.color}"></span>
                <span>${pr.label}</span>
            </label>`).join('');
        loggedHost.addEventListener('change', e => {
            const id = e.target.dataset.pair;
            if (!id) return;
            const at = config.loggedPairs.indexOf(id);
            if (e.target.checked && at === -1) config.loggedPairs.push(id);
            if (!e.target.checked && at !== -1) config.loggedPairs.splice(at, 1);
        });

        // Populate and wire the plotted-intersection selector
        const plotPairSelect = document.getElementById('plotPairSelect');
        plotPairSelect.innerHTML = PLOT_PAIRS
            .map(pr => `<option value="${pr.id}"${pr.id === config.plotPair ? ' selected' : ''}>${pr.label}</option>`)
            .join('');
        plotPairSelect.addEventListener('change', e => {
            config.plotPair = e.target.value;
            if (!config.loggedPairs.includes(e.target.value)) {
                config.loggedPairs.push(e.target.value);
                const box = loggedHost.querySelector(`[data-pair="${e.target.value}"]`);
                if (box) box.checked = true;
            }
            dayPathCache.clear(); // the locus is a different curve now
        });

        document.getElementById('chkNormalized').addEventListener('change', e => {
            config.normalizedRadius = e.target.checked;
            dayPathCache.clear();   // the locus is a different curve now
            pivotTrace.length = 0; // and so is the pivot's path
        });
        document.getElementById('chkRegions').addEventListener('change', e => config.showRegions = e.target.checked);
        document.getElementById('chkLandmarks').addEventListener('change', e => config.showTimeLandmarks = e.target.checked);
        document.getElementById('chkPivotTrace').addEventListener('change', e => {
            config.showPivotTrace = e.target.checked;
            if (!e.target.checked) pivotTrace.length = 0;
        });
        document.getElementById('chkRimScales').addEventListener('change', e => config.showRimScales = e.target.checked);

        // ==========================================
        // LAYER STYLES
        // ==========================================
        // Every switchable layer can be recoloured, thickened or thinned, and
        // redrawn solid, long-dashed, short-dashed or dotted. Rather than thread
        // a style through every draw routine, each layer is drawn inside
        // pushLayer/popLayer, and the context's stroke and fill apply the
        // style of whichever layer is on top at the moment they are called.
        // A swatch is the starting colour for layers drawn in their own fixed
        // colours; layers drawn from the palette are recoloured through it.
        const LAYER_STYLES = {
            hour:         {},
            minute:       {},
            second:       {},
            calendar:     {},
            composite:    {},
            dayPath:      {},
            admittance:   { swatch: '#a855f7' },
            pivotTrace:   {},
            triangle:     {},
            vswr:         { swatch: '#64748b' },
            resistance:   { swatch: '#60a5fa' },
            reactance:    { swatch: '#c084fc' },
            landmarks:    {},
            regions:      { swatch: '#94a3b8' },
            rimScales:    { swatch: '#38bdf8' },
            radialScales: { swatch: '#9fb0c7' },
            spiral:       { swatch: '#f59e0b' }
        };
        for (const style of Object.values(LAYER_STYLES)) {
            style.color = null;    // null draws in the layer's own colours
            style.width = 1;       // multiplier on every line it draws
            style.dash = 'drawn';  // 'drawn' keeps whatever dashes it uses
        }

        const LAYER_WIDTHS = [['0.5', 'Thin'], ['1', 'Normal'], ['2', 'Fat'], ['3.5', 'Big fat']];
        const LAYER_DASHES = [['drawn', 'As drawn'], ['solid', 'Solid'], ['long', 'Long dash'], ['short', 'Short dash'], ['dotted', 'Dotted']];

        const layerStack = [];
        const pushLayer = key => layerStack.push(key);
        const popLayer = () => layerStack.pop();

        function activeLayerStyle() {
            const style = LAYER_STYLES[layerStack[layerStack.length - 1]];
            if (!style) return null;
            return (style.color || style.width !== 1 || style.dash !== 'drawn') ? style : null;
        }

        /** '#rrggbb' or 'rgba(r, g, b, a)', as the context reports them. */
        function parseCanvasColour(value) {
            if (typeof value !== 'string') return null;
            if (value[0] === '#' && value.length === 7) {
                const n = parseInt(value.slice(1), 16);
                return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
            }
            const m = value.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
            return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
        }

        /** The chosen colour at the original's alpha, so faint lines stay faint. */
        function recolour(original, hex) {
            const c = parseCanvasColour(original);
            if (!c) return original;
            const n = parseInt(hex.slice(1), 16);
            return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${c.a})`;
        }

        const nativeStroke = ctx.stroke;
        ctx.stroke = function (...args) {
            const style = activeLayerStyle();
            if (!style) return nativeStroke.apply(this, args);
            this.save();
            if (style.color) this.strokeStyle = recolour(this.strokeStyle, style.color);
            this.lineWidth = this.lineWidth * style.width;
            const lw = this.lineWidth;
            if (style.dash === 'solid') this.setLineDash([]);
            if (style.dash === 'long') this.setLineDash([lw * 6 + 6, lw * 3 + 4]);
            if (style.dash === 'short') this.setLineDash([lw * 2 + 3, lw * 2 + 3]);
            if (style.dash === 'dotted') {
                this.lineCap = 'round';
                this.setLineDash([0, lw * 2 + 3]);
            }
            nativeStroke.apply(this, args);
            this.restore();
        };

        // Fills and text take the colour too, except the dark backing plates
        // that keep labels readable, which have to stay dark.
        ['fill', 'fillText'].forEach(name => {
            const native = ctx[name];
            ctx[name] = function (...args) {
                const style = activeLayerStyle();
                const c = style && style.color ? parseCanvasColour(this.fillStyle) : null;
                if (!c || (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255 < 0.15) {
                    return native.apply(this, args);
                }
                this.save();
                this.fillStyle = recolour(this.fillStyle, style.color);
                native.apply(this, args);
                this.restore();
            };
        });

        // Fill in each row of the layers table: its colours, weight, style and
        // a reset. Palette colours are shared with everything else drawn in
        // them, the assignment swatches included.
        const PALETTE_DEFAULTS = Object.fromEntries(Object.entries(PALETTE).map(([k, e]) => [k, e.value]));

        document.querySelectorAll('.layer-row').forEach(row => {
            const style = LAYER_STYLES[row.dataset.layer] || null;
            const paletteKeys = row.dataset.palette ? row.dataset.palette.split(',') : [];

            const colours = document.createElement('span');
            colours.className = 'layer-colours';
            colours.innerHTML = paletteKeys.length
                ? paletteKeys.map(k =>
                    `<input type="color" data-palette="${k}" value="${PALETTE[k].value}" title="${PALETTE[k].label}">`).join('')
                : style ? `<input type="color" value="${style.swatch}" title="Colour">` : '';
            colours.addEventListener('input', e => {
                const key = e.target.dataset.palette;
                if (key) {
                    PALETTE[key].value = e.target.value;
                    refreshAssignSwatches();
                } else if (style) {
                    style.color = e.target.value;
                }
            });

            const select = (title, options, selected, onChange) => {
                const el = document.createElement('select');
                el.title = title;
                el.innerHTML = options.map(([v, l]) =>
                    `<option value="${v}"${v === selected ? ' selected' : ''}>${l}</option>`).join('');
                el.addEventListener('change', () => onChange(el.value));
                return el;
            };
            const blank = () => document.createElement('span');
            const weight = style
                ? select('Line weight', LAYER_WIDTHS, '1', v => { style.width = parseFloat(v); })
                : blank();
            const dash = style
                ? select('Line style', LAYER_DASHES, 'drawn', v => { style.dash = v; })
                : blank();

            const reset = document.createElement('button');
            reset.type = 'button';
            reset.title = 'Reset this layer';
            reset.innerHTML = '&#8634;';
            reset.addEventListener('click', () => {
                paletteKeys.forEach(k => { PALETTE[k].value = PALETTE_DEFAULTS[k]; });
                colours.querySelectorAll('input').forEach(input => {
                    input.value = input.dataset.palette ? PALETTE_DEFAULTS[input.dataset.palette] : style.swatch;
                });
                if (style) {
                    style.color = null;
                    style.width = 1;
                    style.dash = 'drawn';
                    weight.value = '1';
                    dash.value = 'drawn';
                }
                refreshAssignSwatches();
            });

            row.append(colours, weight, dash, reset);
        });

        document.getElementById('chkRadialScales').addEventListener('change', e => {
            config.showRadialScales = e.target.checked;
            resizeCanvas();
        });
        colorEngineSelect.addEventListener('change', e => config.colorEngine = e.target.value);

