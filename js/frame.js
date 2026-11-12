// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
        // Main Animation Frame
        function frame() {
            if (advanceLapse()) {
                // simDate is being driven by the time lapse
            } else if (isLive) {
                simDate = new Date();
                syncSlidersFromDate(simDate);
            }

            const now = simDate;
            const ms = now.getMilliseconds();
            const sec = now.getSeconds() + (ms / 1000);
            const min = now.getMinutes() + (sec / 60);
            const hr = (now.getHours() % 12) + (min / 60);

            // Tick Audio trigger
            const currentSecInt = Math.floor(sec);
            if (currentSecInt !== lastTickedSecond) {
                lastTickedSecond = currentSecInt;
                playTickSound();
            }

            // 1. Clear, then fence the chart into its own area so a zoomed-in
            //    view cannot spill over the parameter strip below it.
            ctx.fillStyle = '#0a0d14';
            ctx.fillRect(0, 0, cssWidth, cssHeight);

            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, cssWidth, stripTop);
            ctx.clip();

            drawSmithChartGrid();

            // 2. Draw Historical Date DNA Spiral (decorative, off by default)
            pushLayer('spiral');
            drawDateDNASpiral(now);
            popLayer();

            // 2b. The composite phasor drives the day path, the VSWR rings and
            //     the radially scaled parameter cursor. Compute it once.
            const composite = SmithMath.compositePolar(now);
            const compGammaRe = composite.mag * Math.cos(composite.phase);
            const compGammaIm = composite.mag * Math.sin(composite.phase);

            // 2c. A full day of reflection, traced by the hour and minute arms
            pushLayer('dayPath');
            if (config.showDayPath) drawDayPath(now);
            popLayer();

            // 2d. Constant-VSWR circles: radius |Gamma|, centred on the origin
            pushLayer('vswr');
            if (config.showVswrCircles) drawVswrCircles(composite.mag);
            popLayer();

            // 2e. The day bar, then the three anchors that fix the pivot. Both
            //     are drawn before the arms, because every arm hangs off the
            //     centroid of that triangle.
            const anchors = clockAnchorsOf(now);
            const dayOrigin = anchors.pivot;
            pushLayer('landmarks');
            drawDayAxis(now);
            popLayer();
            recordPivot(anchors.pivot, performance.now());
            pushLayer('pivotTrace');
            drawPivotTrace();
            popLayer();
            pushLayer('triangle');
            drawPivotTriangle(anchors);
            popLayer();

            // 3. Compute Phasor Angles
            const minPhase = (min / 60.0) * (2 * Math.PI) - (Math.PI / 2);
            const hrPhase = (hr / 12.0) * (2 * Math.PI) - (Math.PI / 2);
            const secPhase = (sec / 60.0) * (2 * Math.PI) - (Math.PI / 2);

            // The arms keep their usual lengths unless a field has been
            // assigned to set one
            const wheelsNow = SmithMath.handVectors(now);
            const lengthOr = (id, usual) => wheelsNow[id].lengthField ? wheelsNow[id].mag : usual;
            const minMag = lengthOr('minute', 0.95);
            const hrMag = lengthOr('hour', 0.60);
            const secMag = lengthOr('second', 0.85);

            // Determine hand colors
            const dna = SmithMath.computeDateDNA(now);
            const mood = SmithMath.computeMood(now);

            let hrColor = paint('hour');
            let minColor = paint('minute');
            let secColor = paint('second');

            if (config.colorEngine === 'date-dna') {
                hrColor = dna.hex;
                minColor = `rgba(${dna.r}, ${dna.g}, ${dna.b}, 0.85)`;
            } else if (config.colorEngine === 'mood') {
                hrColor = mood.hsl;
                minColor = `hsla(${Math.round(mood.hue)}, 85%, ${Math.round(mood.lightness)}%, 0.75)`;
            }

            // 4. Composite Resultant Vector (Σ)
            pushLayer('composite');
            if (config.showComposite) {
                const pr = plotPair();
                const wheels = SmithMath.handVectors(now);
                const minTarget = SmithMath.polarToCartesian(
                    wheels[pr.a].mag, wheels[pr.a].phase, dayOrigin.x, dayOrigin.y, scaleRadius);
                const hrTarget = SmithMath.polarToCartesian(
                    wheels[pr.b].mag, wheels[pr.b].phase, dayOrigin.x, dayOrigin.y, scaleRadius);

                const compX = (minTarget.x - dayOrigin.x) + (hrTarget.x - dayOrigin.x);
                const compY = (minTarget.y - dayOrigin.y) + (hrTarget.y - dayOrigin.y);

                const compMagNorm = composite.mag;
                const compPhase = composite.phase;

                // Parallelogram trace
                ctx.save();
                ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.moveTo(minTarget.x, minTarget.y);
                ctx.lineTo(dayOrigin.x + compX, dayOrigin.y + compY);
                ctx.lineTo(hrTarget.x, hrTarget.y);
                ctx.stroke();
                ctx.restore();

                drawPhasorVector(compMagNorm, compPhase, paint('sigma'), 5.0, 'Σ', dayOrigin,
                    undefined, false, stretchOf('arm:sigma', now));
            }
            popLayer();

            // 4b. Corner readouts, under the arms and rim chips
            drawCornerPanels(now, composite, { hour: hrColor, minute: minColor, second: secColor });

            // 5. Draw Clock Hands, deliberately overscaled so they stay legible
            //    on top of a full day of interference-sum history.
            // Ghosts first: centre-to-rim lines that still read against the dial,
            // each printing its own value at the edge it points to.
            pushLayer('hour');
            drawGhostHand(hrMag, hrPhase, hrColor, `H ${wheelsNow.hour.value}`);
            popLayer();
            pushLayer('minute');
            drawGhostHand(minMag, minPhase, minColor, `M ${wheelsNow.minute.value}`);
            popLayer();
            pushLayer('second');
            if (config.showSecond) drawGhostHand(secMag, secPhase, secColor, `S ${wheelsNow.second.value}`);
            popLayer();

            // Each arm is aimed at its own rim value, so the minute arm points at
            // the minute reading and the hour arm at the hour, even though both
            // now start from the pivot rather than the centre of the chart.
            pushLayer('hour');
            drawPhasorVector(hrMag, hrPhase, hrColor, 9.0, 'H', dayOrigin, rimPointFor(hrPhase),
                false, stretchOf('arm:hour', now));
            popLayer();
            pushLayer('minute');
            drawPhasorVector(minMag, minPhase, minColor, 6.0, 'M', dayOrigin, rimPointFor(minPhase),
                false, stretchOf('arm:minute', now));
            popLayer();

            pushLayer('second');
            if (config.showSecond) {
                drawPhasorVector(secMag, secPhase, secColor, 2.8, null, dayOrigin, anchors.second, true,
                    stretchOf('arm:second', now));

                // Counterweight tail, opposite the way the arm actually points
                const tailAngle = Math.atan2(
                    anchors.second.y - dayOrigin.y,
                    anchors.second.x - dayOrigin.x
                ) + Math.PI;
                const tailLen = scaleRadius * 0.18;
                ctx.save();
                ctx.strokeStyle = secColor;
                ctx.lineWidth = 4.0;
                ctx.beginPath();
                ctx.moveTo(dayOrigin.x, dayOrigin.y);
                ctx.lineTo(dayOrigin.x + tailLen * Math.cos(tailAngle), dayOrigin.y + tailLen * Math.sin(tailAngle));
                ctx.stroke();
                ctx.restore();
            }
            popLayer();

            // 6. Calendar wheels: date, month and year, each on its own circle
            pushLayer('calendar');
            if (config.showCalendar) {
                const hands = SmithMath.handVectors(now);
                const calColors = { date: paint('date'), month: paint('month'), year: paint('year') };
                ['date', 'month', 'year'].forEach(id => {
                    drawGhostHand(hands[id].mag, hands[id].phase, calColors[id],
                        `${hands[id].label} ${hands[id].value}`);
                    // The date arm is a triangle corner too, so it lands on it
                    drawPhasorVector(hands[id].mag, hands[id].phase, calColors[id], 4.5,
                        hands[id].label, dayOrigin,
                        id === 'date' ? anchors.date : rimPointFor(hands[id].phase),
                        id === 'date', stretchOf(`arm:${id}`, now));
                });
            }
            popLayer();

            // The hub travels with the arms, so it sits on the day dot. The
            // matched centre keeps only a faint reference cross.
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(centerX - 5, centerY);
            ctx.lineTo(centerX + 5, centerY);
            ctx.moveTo(centerX, centerY - 5);
            ctx.lineTo(centerX, centerY + 5);
            ctx.stroke();

            flushRimReadings();
            drawPivotMark(dayOrigin);

            ctx.restore(); // end of the chart's clip

            // 7. Mark where the interference sum has actually reached
            drawTimePlot(now, composite);

            // 8. Radially scaled parameters, cursored at the composite radius
            pushLayer('radialScales');
            drawRadialScales(composite.mag, compGammaRe);
            popLayer();

            // 9. Update Dashboard & Analytics Readouts
            updateAnalytics(now, minPhase, hrPhase, minMag, hrMag, dna, mood, composite, compGammaRe, compGammaIm);

            requestAnimationFrame(frame);
        }

        function updateAnalytics(now, minPhase, hrPhase, minMag, hrMag, dna, mood, composite, compGammaRe, compGammaIm) {
            // Header display
            const yr = now.getFullYear();
            const mo = (now.getMonth() + 1).toString().padStart(2, '0');
            const dy = now.getDate().toString().padStart(2, '0');
            const h = now.getHours().toString().padStart(2, '0');
            const m = now.getMinutes().toString().padStart(2, '0');
            const s = Math.floor(now.getSeconds()).toString().padStart(2, '0');

            liveDateStr.textContent = `${yr}-${mo}-${dy}`;
            liveTimeStr.textContent = `${h}:${m}:${s}`;

            // Phase Difference Delta
            let delta = Math.abs(minPhase - hrPhase);
            delta = delta % (2 * Math.PI);
            if (delta > Math.PI) delta = 2 * Math.PI - delta;
            const deltaDeg = (delta * 180 / Math.PI);

            valPhaseDelta.textContent = `${deltaDeg.toFixed(1)}°`;

            // Interference ratio: 2 * cos(delta/2)
            const ratio = 2 * Math.cos(delta / 2);
            valInterferenceRatio.textContent = `${ratio.toFixed(2)}x`;

            // Interference State Badge & Progress Bar
            const barPercent = Math.max(0, Math.min(100, (1 - (deltaDeg / 180)) * 100));
            interferenceBar.style.width = `${barPercent}%`;


            if (deltaDeg <= 20) {
                interferenceBadge.textContent = 'CONSTRUCTIVE';
                interferenceBadge.style.color = '#10b981';
                interferenceBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
            } else if (deltaDeg >= 160) {
                interferenceBadge.textContent = 'DESTRUCTIVE';
                interferenceBadge.style.color = '#ef4444';
                interferenceBadge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            } else {
                interferenceBadge.textContent = 'QUADRATURE';
                interferenceBadge.style.color = '#38bdf8';
                interferenceBadge.style.borderColor = 'rgba(56, 189, 248, 0.4)';
            }

            // Hand RF Metrics
            const minVswr = ((1 + minMag) / (1 - minMag)).toFixed(1);
            valMinVswr.textContent = `${minVswr} : 1`;

            const hrRl = (-20 * Math.log10(hrMag)).toFixed(2);
            valHrRl.textContent = `${hrRl} dB`;

            // Date DNA Swatch
            dnaSwatch.style.backgroundColor = dna.hex;
            dnaFormulaStr.textContent = dna.formula;
            dnaHexStr.textContent = `${dna.hex.toUpperCase()} | RGB(${dna.r}, ${dna.g}, ${dna.b})`;
            moodDescStr.textContent = `${mood.season} Season (Hue: ${Math.round(mood.hue)}°, Lum: ${Math.round(mood.lightness)}%)`;

            updateNormalizedPanel(now);
            updateRadialReadout(composite.mag, compGammaRe);
            updateFormulaPanel(now, composite, compGammaRe, compGammaIm);
            updateDayHistory(now, composite);
        }

        /** Every wheel as a ratio of its own whole, which is already a |Gamma|. */
        function updateNormalizedPanel(now) {
            const wheels = SmithMath.handVectors(now);
            const rows = [
                { key: 'second', label: 'Seconds / 60' },
                { key: 'minute', label: 'Minutes / 60' },
                { key: 'hour', label: 'Hours / 24' },
                { key: 'date', label: 'Day / month' },
                { key: 'month', label: 'Month / 12' },
                { key: 'year', label: 'Year / 100' }
            ];

            document.getElementById('normalizedPanel').innerHTML = rows.map(row => {
                const n = wheels[row.key].normal;
                const vswr = n >= 0.9999 ? '\u221e' : ((1 + n) / (1 - n)).toFixed(2);
                return `<div class="scale-cell">
                    <b>${row.label}</b>
                    <span style="color: ${paint(row.key)}">${n.toFixed(4)}</span>
                    <b style="text-transform: none;">VSWR ${vswr}</b>
                </div>`;
            }).join('');
        }

        /**
         * Prints every ruler of the nomograph as a number, read at the radius the
         * cursor is sitting on. Same arithmetic as the strip, without the ruler.
         */
        function updateRadialReadout(rho, gammaRe) {
            const host = document.getElementById('scaleReadout');
            host.innerHTML = RADIAL_SCALES.map(scale => {
                const value = scale.side === 'full' ? 1 + gammaRe : scale.valueOf(rho);
                return `<div class="scale-cell" title="${scale.formula}">
                    <b>${scale.label}</b>
                    <span>${formatScaleValue(value, scale.precision)}</span>
                </div>`;
            }).join('');
        }

        /**
         * The chart's own arithmetic with this moment's numbers substituted in,
         * so the reading and the formula that produced it sit side by side.
         */
        function updateFormulaPanel(now, composite, gammaRe, gammaIm) {
            const z0 = config.z0;
            const rho = composite.mag;
            const z = SmithMath.gammaToImpedance(gammaRe, gammaIm, z0);
            const y = SmithMath.gammaToAdmittance(gammaRe, gammaIm, z0);

            const vswr = rho >= 0.9999 ? Infinity : (1 + rho) / (1 - rho);
            const rl = rho > 1e-5 ? -20 * Math.log10(rho) : Infinity;
            const ml = rho >= 0.9999 ? Infinity : -10 * Math.log10(1 - rho * rho);
            const tau = Math.sqrt((1 + gammaRe) * (1 + gammaRe) + gammaIm * gammaIm);
            const phaseDeg = composite.phase * 180 / Math.PI;

            const f = (v, d = 3) => (isFinite(v) ? v.toFixed(d) : '∞');
            const cxs = (re, im, d = 3) =>
                (isFinite(re) && isFinite(im))
                    ? `${re.toFixed(d)} ${im >= 0 ? '+' : '−'} j${Math.abs(im).toFixed(d)}`
                    : '∞';

            const rows = [
                {
                    section: '1. Normalization',
                    title: 'Normalized impedance',
                    symbolic: 'z = Z / Z₀ = r + jx',
                    substituted: `z = (${cxs(z.R, z.X, 1)}) Ω / ${z0} Ω = ${cxs(z.r, z.x)}`,
                    note: 'Every radius on the chart is a ratio to the line impedance, never an absolute ohm value.'
                },
                {
                    section: '1. Normalization',
                    title: 'Normalized admittance',
                    symbolic: 'y = Y / Y₀ = 1 / z = g + jb',
                    substituted: `y = 1 / (${cxs(z.r, z.x)}) = ${cxs(y.g, y.b)}`,
                    note: 'y sits diametrically opposite z: same radius, phase rotated by 180°.'
                },
                {
                    section: '2. Reflection Coefficient (Γ)',
                    title: 'Definition',
                    symbolic: 'Γ = (Zₗ − Z₀) / (Zₗ + Z₀) = |Γ| e^{jθ}',
                    substituted: `Γ = ${cxs(gammaRe, gammaIm)} = ${f(rho)} ∠ ${f(phaseDeg, 1)}°`,
                    note: 'The Σ phasor: the hour and minute arms added, renormalised to the unit circle.'
                },
                {
                    section: '2. Reflection Coefficient (Γ)',
                    title: 'In terms of normalized impedance',
                    symbolic: 'Γ = (z − 1) / (z + 1)',
                    substituted: `Γ = ((${cxs(z.r, z.x)}) − 1) / ((${cxs(z.r, z.x)}) + 1) = ${cxs(gammaRe, gammaIm)}`
                },
                {
                    section: '2. Reflection Coefficient (Γ)',
                    title: 'Inverting for normalized impedance',
                    symbolic: 'z = (1 + Γ) / (1 − Γ)',
                    substituted: `z = (1 + ${cxs(gammaRe, gammaIm)}) / (1 − ${cxs(gammaRe, gammaIm)}) = ${cxs(z.r, z.x)}`
                },
                {
                    section: '2. Reflection Coefficient (Γ)',
                    title: 'Magnitude, from VSWR',
                    symbolic: '|Γ| = (VSWR − 1) / (VSWR + 1)',
                    substituted: `|Γ| = (${f(vswr, 2)} − 1) / (${f(vswr, 2)} + 1) = ${f(rho)}`
                },
                {
                    section: '3. Voltage Standing Wave Ratio',
                    title: 'Definition',
                    symbolic: 'VSWR = Vₘₐₓ / Vₘᵢₙ = (1 + |Γ|) / (1 − |Γ|)',
                    substituted: `VSWR = (1 + ${f(rho)}) / (1 − ${f(rho)}) = ${f(vswr, 2)} : 1`
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
                    substituted: `RL = −20·log₁₀(${f(rho)}) = ${f(rl, 2)} dB`
                },
                {
                    section: '4. Derived losses',
                    title: 'Reflection (mismatch) loss',
                    symbolic: 'ML = −10·log₁₀(1 − |Γ|²)',
                    substituted: `ML = −10·log₁₀(1 − ${f(rho * rho)}) = ${f(ml, 3)} dB`
                },
                {
                    section: '4. Derived losses',
                    title: 'Transmission coefficient',
                    symbolic: 'τ = 1 + Γ,  τₚ = 1 − |Γ|²',
                    substituted: `τ = ${f(tau)},  τₚ = ${f(1 - rho * rho)}`
                },
                {
                    section: '5. The day on the real axis',
                    title: 'Where the dot sits',
                    symbolic: 'x = 2·(seconds since midnight / 86400) − 1',
                    substituted: (() => {
                        const secs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
                        return `${secs} s / 86400 s = ${(secs / 86400 * 100).toFixed(2)}% → Γᵣ = ${(2 * secs / 86400 - 1).toFixed(3)}`;
                    })(),
                    note: 'Midnight is the short circuit at the far left; 23:59 is the open circuit at the far right.'
                }
            ];

            let html = '';
            let lastSection = null;
            for (const row of rows) {
                if (row.section !== lastSection) {
                    html += `<div class="formula-section">${row.section}</div>`;
                    lastSection = row.section;
                }
                html += `<div class="formula-row">
                    <div class="formula-symbolic">${row.symbolic}<span class="formula-title">${row.title}</span></div>
                    <div class="formula-substituted">${row.substituted}</div>
                    ${row.note ? `<div class="formula-note">${row.note}</div>` : ''}
                </div>`;
            }
            document.getElementById('formulaPanel').innerHTML = html;
            document.getElementById('formulaZ0Badge').textContent = `Z₀ = ${z0} Ω`;
        }

        /** A day's worth of normalization and reflection, summarised. */
        function updateDayHistory(now, composite) {
            const path = getDayPath(now);
            const hhmm = d => `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
            const rho = composite.mag;
            const vswr = rho >= 0.9999 ? '∞' : ((1 + rho) / (1 - rho)).toFixed(2);
            const rl = rho > 1e-5 ? (-20 * Math.log10(rho)).toFixed(2) : '∞';

            document.getElementById('dayHistoryPair').textContent = plotPair().label;
            document.getElementById('dayHistoryDate').textContent =
                `${path.dayStart.getFullYear()}-${(path.dayStart.getMonth() + 1).toString().padStart(2, '0')}-${path.dayStart.getDate().toString().padStart(2, '0')}`;
            document.getElementById('valBestMatch').textContent =
                `${hhmm(path.best.date)} · |Γ| ${path.best.polar.mag.toFixed(3)}`;
            document.getElementById('valWorstMatch').textContent =
                `${hhmm(path.worst.date)} · |Γ| ${path.worst.polar.mag.toFixed(3)}`;
            document.getElementById('valCompVswr').textContent = `${vswr} : 1`;
            document.getElementById('valCompRl').textContent = `${rl} dB`;
        }

        // What this page takes in, puts out and lets you control (the ? / F1 panel).
        if (window.APKSoftapp && typeof window.APKSoftapp.describe === 'function') window.APKSoftapp.describe({
            name: 'Smith Chart Clock',
            does: 'Reads the time as an RF impedance chart: each time field turns a wheel, and the locus gives SWR, return loss and reflection coefficient.',
            inputs: [
                { name: 'The time', from: "this browser's clock while LIVE; else the Year / Month / Day / Hour / Minute sliders, a preset or a time lapse" },
                { name: 'Wheel assignment', from: 'the angle / length pickers beside each slider: which wheel each time field drives' }
            ],
            outputs: [
                { name: 'The chart', to: 'the canvas on this page, with the parameter strip and day-history readouts' },
                { name: 'Snapshot PNG', to: 'smith-chart-clock-<ms>.png download', kind: 'file' },
                { name: 'Audio Tick', to: "a short tick on this browser's audio output each second", kind: 'audio' }
            ],
            controls: [
                { name: '● LIVE / ⏸ CUSTOM', how: 'click to follow the clock or hold the slider time; moving a slider goes CUSTOM' },
                { name: 'Time lapse', how: 'Today in 30 s / 1 min / 5 min, A week in 30 s, A year in 1 min; ■ Stop lapse' },
                { name: 'Presets', how: 'Current Live, Smith 1939, Radar 1944, Moon Landing 1969, 1999, Y2K' },
                { name: 'Zoom and pan', how: 'mouse wheel zooms about the cursor, drag pans, double-click or ◎ Fit resets; − Out / + In buttons' },
                { name: 'Plot pair, trail, layers', how: 'pick the two wheels crossed, the trail length, and tick the layers to draw' },
                { name: 'Colour engine', how: 'Date DNA, Solar Mood or RF Phasor Neon' }
            ],
            problems: ['unsupported_browser', 'script_error']
        });

        // Start Clock
        requestAnimationFrame(frame);
