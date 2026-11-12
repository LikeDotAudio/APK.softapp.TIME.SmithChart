// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
        // ==========================================
        // 3. RENDER ENGINE & VISUAL LOOP
        // ==========================================
        /**
         * Prints as many of the candidate labels as will actually fit.
         *
         * Every gradation on the chart offers a label; which ones survive is
         * decided here by whether they collide with one already down. That is
         * what makes the chart densify as it is zoomed: the same candidates
         * spread apart, so more of them get through. Feed majors before minors,
         * because earlier candidates win.
         */
        function placeLabels(candidates, pad = 3) {
            const placed = [];
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            for (const item of candidates) {
                if (item.x < -40 || item.x > cssWidth + 40) continue;
                if (item.y < -20 || item.y > stripTop + 20) continue;

                ctx.font = item.font;
                const w = ctx.measureText(item.text).width + pad * 2;
                const h = 9 + pad;

                const clash = placed.some(q =>
                    Math.abs(item.x - q.x) < (w + q.w) / 2 &&
                    Math.abs(item.y - q.y) < (h + q.h) / 2);
                if (clash) continue;

                placed.push({ x: item.x, y: item.y, w, h });
                ctx.fillStyle = item.color;
                if (item.rotate) {
                    ctx.save();
                    ctx.translate(item.x, item.y);
                    ctx.rotate(item.rotate);
                    ctx.fillText(item.text, 0, 0);
                    ctx.restore();
                } else {
                    ctx.fillText(item.text, item.x, item.y);
                }
            }
        }

        /**
         * Labels written onto the grid lines themselves, for when the chart is
         * zoomed in far enough that the real axis and the rim are off screen.
         *
         * Each curve is sampled for the visible point nearest the middle of the
         * view, and the label goes there. Unzoomed this is off: the axis and rim
         * values are in shot and putting numbers on every curve only adds noise.
         */
        function onCurveLabels(R) {
            if (view.zoom < 1.6) return [];

            const viewCx = cssWidth / 2;
            const viewCy = stripTop / 2;
            const margin = 26;
            const candidates = [];

            // The visible point on a circle that sits nearest the middle of the
            // view, or null when none of it is on screen.
            const bestPointOn = (cx, cy, rad, insideUnitCircle) => {
                if (!isFinite(rad) || rad <= 0) return null;
                let best = null;
                let bestD = Infinity;
                const steps = 120;
                for (let i = 0; i < steps; i++) {
                    const a = (i / steps) * 2 * Math.PI;
                    const x = cx + rad * Math.cos(a);
                    const y = cy + rad * Math.sin(a);
                    if (x < margin || x > cssWidth - margin) continue;
                    if (y < margin || y > stripTop - margin) continue;
                    if (insideUnitCircle) {
                        const dx = x - centerX, dy = y - centerY;
                        if (dx * dx + dy * dy > R * R) continue;
                    }
                    const d = (x - viewCx) * (x - viewCx) + (y - viewCy) * (y - viewCy);
                    if (d < bestD) { bestD = d; best = { x, y }; }
                }
                return best;
            };

            const push = (pt, text, major, color) => {
                if (!pt) return;
                candidates.push({
                    x: pt.x, y: pt.y, text, color,
                    font: major ? 'bold 9px ui-monospace, monospace' : '8px ui-monospace, monospace'
                });
            };

            const resistance = (r, major) => push(
                bestPointOn(centerX + (r / (1 + r)) * R, centerY, R / (1 + r), false),
                `r=${r}`, major, major ? '#93c5fd' : '#60a5fa');

            const reactance = (x, major) => push(
                bestPointOn(centerX + R, centerY - (1 / x) * R, (1 / Math.abs(x)) * R, true),
                (x > 0 ? '+j' : '-j') + Math.abs(x), major, major ? '#f0abfc' : '#c084fc');

            if (config.showResistance) {
                GRID_MAJOR.forEach(r => resistance(r, true));
                GRID_MINOR.forEach(r => resistance(r, false));
            }
            if (config.showReactance) {
                GRID_MAJOR.forEach(x => { reactance(x, true); reactance(-x, true); });
                GRID_MINOR.forEach(x => { reactance(x, false); reactance(-x, false); });
            }

            return candidates;
        }

        /**
         * The three curves that carry the day, coloured the way the reference
         * chart colours them.
         *
         * Yellow is the real axis: the whole day laid end to end, midnight at the
         * short circuit on the left, midnight again at the open circuit on the
         * right, and noon dead centre where the chart is matched. Orange is the
         * x = +1 arc, walked from the top round to the open circuit and read as
         * hours 1 to 12; green is the x = -1 arc below it, read as 0 down to -12.
         * Both arcs converge on the open circuit, which is where the day ends.
         */
        function drawTimeLandmarks(R) {
            if (!config.showTimeLandmarks) return;

            // Gamma with the imaginary axis up, which is how the grid is drawn
            const at = (re, im) => ({ x: centerX + re * R, y: centerY - im * R });

            ctx.save();
            ctx.lineCap = 'round';

            // The two unit-reactance arcs. Each is a circle of radius R about
            // (1, +/-1) in Gamma, swept from its rim point to the open circuit.
            const arc = (sign, key, labels) => {
                const cx = centerX + R;
                const cy = centerY - sign * R;
                const from = Math.PI;
                const to = sign > 0 ? -Math.PI / 2 : Math.PI / 2;

                ctx.strokeStyle = paint(key);
                ctx.lineWidth = 2.2;
                ctx.globalAlpha = 0.85;
                ctx.beginPath();
                for (let i = 0; i <= 96; i++) {
                    const a = from + (to - from) * (i / 96);
                    const x = cx + R * Math.cos(a);
                    const y = cy + R * Math.sin(a);
                    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                ctx.stroke();

                // Hour marks walked along the arc in equal steps
                ctx.globalAlpha = 1;
                ctx.font = 'bold 9px ui-monospace, monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                labels.forEach((text, i) => {
                    const t = i / (labels.length - 1);
                    const a = from + (to - from) * t;
                    const x = cx + R * Math.cos(a);
                    const y = cy + R * Math.sin(a);
                    const inward = Math.atan2(centerY - y, centerX - x);

                    ctx.fillStyle = paint(key);
                    ctx.beginPath();
                    ctx.arc(x, y, 2.6, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.fillText(text, x + 13 * Math.cos(inward), y + 13 * Math.sin(inward));
                });
            };

            arc(+1, 'arcMorning', ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
            arc(-1, 'arcEvening', ['0', '-1', '-2', '-3', '-4', '-5', '-6', '-7', '-8', '-9', '-10', '-11', '-12']);

            // The endpoints the reference chart marks: short, matched, open --
            // which here are midnight, noon and midnight again.
            [
                { pt: at(-1, 0), color: '#ef4444', tag: '00:00' },
                { pt: at(0, 0), color: '#3b82f6', tag: '12:00' },
                { pt: at(1, 0), color: '#16a34a', tag: '24:00' }
            ].forEach(mark => {
                ctx.fillStyle = mark.color;
                ctx.beginPath();
                ctx.arc(mark.pt.x, mark.pt.y, 4.5, 0, 2 * Math.PI);
                ctx.fill();
                ctx.font = 'bold 9px ui-monospace, monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(mark.tag, mark.pt.x, mark.pt.y - 12);
            });

            ctx.restore();
        }

        /**
         * The eight regions the r = 1 circle and the x = +/-1 arcs cut the chart
         * into, each named by its inequalities and by the half of the day it
         * falls in.
         *
         * The x = +1 arc reads as hours 1 to 12 and the x = -1 arc as 0 down to
         * -12, so everything above the real axis is the morning half and
         * everything below it the afternoon half. A representative z is picked
         * inside each region and mapped through Gamma = (z - 1)/(z + 1).
         */
        const CHART_REGIONS = [
            { r: 0.4, x: 0.5,  lines: ['r < 1', '0 < x < 1'],  when: 'morning' },
            { r: 0.4, x: 2.2,  lines: ['r < 1', 'x > 1'],      when: 'late morning' },
            { r: 2.2, x: 0.5,  lines: ['r > 1', '0 < x < 1'],  when: 'morning' },
            { r: 2.2, x: 2.2,  lines: ['r > 1', 'x > 1'],      when: 'late morning' },
            { r: 0.4, x: -0.5, lines: ['r < 1', '-1 < x < 0'], when: 'afternoon' },
            { r: 0.4, x: -2.2, lines: ['r < 1', 'x < -1'],     when: 'evening' },
            { r: 2.2, x: -0.5, lines: ['r > 1', '-1 < x < 0'], when: 'afternoon' },
            { r: 2.2, x: -2.2, lines: ['r > 1', 'x < -1'],     when: 'evening' }
        ];

        function drawChartRegions(R) {
            if (!config.showRegions) return;

            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            for (const region of CHART_REGIONS) {
                // Gamma = (z - 1) / (z + 1), with the imaginary axis drawn upwards
                const denom = (region.r + 1) * (region.r + 1) + region.x * region.x;
                const gRe = (region.r * region.r + region.x * region.x - 1) / denom;
                const gIm = (2 * region.x) / denom;

                const x = centerX + gRe * R;
                const y = centerY - gIm * R;

                ctx.font = 'bold 10px ui-monospace, monospace';
                ctx.fillStyle = 'rgba(226, 232, 240, 0.72)';
                region.lines.forEach((line, i) => ctx.fillText(line, x, y + i * 12 - 10));

                ctx.font = '9px -apple-system, BlinkMacSystemFont, sans-serif';
                ctx.fillStyle = region.x > 0 ? tint('arcMorning', 0.9) : tint('arcEvening', 0.9);
                ctx.fillText(region.when, x, y + region.lines.length * 12 - 8);
            }

            ctx.restore();
        }

        function drawSmithChartGrid() {
            const R = scaleRadius;

            // Outer Unit Circle (|Gamma| = 1.0)
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.arc(centerX, centerY, R, 0, 2 * Math.PI);
            ctx.stroke();

            // Real Axis (Horizontal)
            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(centerX - R, centerY);
            ctx.lineTo(centerX + R, centerY);
            ctx.stroke();

            // Constant Resistance Circles (r), minor gradations first
            pushLayer('resistance');
            if (config.showResistance) {
                const drawR = (r, stroke, lw) => {
                    ctx.strokeStyle = stroke;
                    ctx.lineWidth = lw;
                    ctx.beginPath();
                    ctx.arc(centerX + (r / (1 + r)) * R, centerY, R / (1 + r), 0, 2 * Math.PI);
                    ctx.stroke();
                };

                GRID_MINOR.forEach(r => drawR(r, '#172033', 0.4));
                GRID_MAJOR.forEach(r => drawR(r, r === 1.0 ? '#5b6b85' : '#26344a', r === 1.0 ? 1.3 : 0.75));

                // Printed values on the real axis. Majors are offered first so
                // they win the collision test, then the minor gradations fill in
                // whatever room is left once the chart is zoomed.
                const rLabel = (r, major) => ({
                    x: centerX + ((r - 1) / (r + 1)) * R,
                    y: centerY - 7,
                    text: r.toString(),
                    color: major ? '#94a3b8' : '#5b6b85',
                    font: major ? '8px ui-monospace, monospace' : '7px ui-monospace, monospace'
                });
                placeLabels([
                    ...GRID_MAJOR.map(r => rLabel(r, true)),
                    ...GRID_MINOR.map(r => rLabel(r, false))
                ]);
            }

            popLayer();

            // Constant Reactance Arcs (±jx)
            pushLayer('reactance');
            if (config.showReactance) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(centerX, centerY, R, 0, 2 * Math.PI);
                ctx.clip();

                const drawX = (val, stroke, lw) => {
                    ctx.strokeStyle = stroke;
                    ctx.lineWidth = lw;
                    ctx.beginPath();
                    ctx.arc(centerX + R, centerY - (1 / val) * R, (1 / Math.abs(val)) * R, 0, 2 * Math.PI);
                    ctx.stroke();
                };

                GRID_MINOR.forEach(x => { drawX(x, '#152238', 0.4); drawX(-x, '#152238', 0.4); });
                GRID_MAJOR.forEach(x => {
                    const stroke = x === 1.0 ? '#4a5b78' : '#22304a';
                    const lw = x === 1.0 ? 1.2 : 0.7;
                    drawX(x, stroke, lw);
                    drawX(-x, stroke, lw);
                });

                ctx.restore();

                // Printed values, where each arc meets the rim. z = jx puts that
                // meeting point at Gamma = (jx - 1)/(jx + 1), always on |Gamma| = 1.
                const xLabel = (val, major) => {
                    const denom = 1 + val * val;
                    const angle = Math.atan2((2 * val) / denom, (val * val - 1) / denom);
                    const rr = R - 30;
                    return {
                        x: centerX + rr * Math.cos(angle),
                        y: centerY - rr * Math.sin(angle),
                        text: (val > 0 ? '+j' : '-j') + Math.abs(val),
                        color: major ? '#94a3b8' : '#5b6b85',
                        font: major ? '8px ui-monospace, monospace' : '7px ui-monospace, monospace'
                    };
                };
                placeLabels([
                    ...GRID_MAJOR.flatMap(x => [xLabel(x, true), xLabel(-x, true)]),
                    ...GRID_MINOR.flatMap(x => [xLabel(x, false), xLabel(-x, false)])
                ]);
            }

            popLayer();

            // Prime Center Dot (Matched Load: Z = 50 + j0, Gamma = 0)
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.arc(centerX, centerY, 4, 0, 2 * Math.PI);
            ctx.fill();

            // Values written onto the curves themselves, once zoomed in far
            // enough that the axis and the rim have left the view
            placeLabels(onCurveLabels(R), 4);

            pushLayer('regions');
            drawChartRegions(R);
            popLayer();
            pushLayer('landmarks');
            drawTimeLandmarks(R);
            popLayer();

            pushLayer('rimScales');
            if (config.showRimScales) drawChartRimScales(R);
            popLayer();

            // Clock Dial Numbers (1 to 12) & Angle Calibration
            ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            for (let i = 0; i < 12; i++) {
                const angle = (i / 12) * (2 * Math.PI) - (Math.PI / 2);
                const rTickInner = R + 3;
                const rTickOuter = R + 8;
                const rText = R + 17;

                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = (i % 3 === 0) ? 2 : 1;
                ctx.beginPath();
                ctx.moveTo(centerX + rTickInner * Math.cos(angle), centerY + rTickInner * Math.sin(angle));
                ctx.lineTo(centerX + rTickOuter * Math.cos(angle), centerY + rTickOuter * Math.sin(angle));
                ctx.stroke();

                const num = i === 0 ? 12 : i;
                ctx.fillText(num.toString(), centerX + rText * Math.cos(angle), centerY + rText * Math.sin(angle));
            }
        }

        /**
         * The three calibrated rings a printed Smith chart carries around its rim.
         *
         * Outermost is wavelengths toward the generator, which advance clockwise
         * from the short circuit at the left; inside it the same scale running
         * the other way, toward the load; innermost the angle of the reflection
         * coefficient in degrees. One full turn of the chart is half a wavelength,
         * which is why both wavelength rings close at 0.5.
         *
         * The grid puts +jx in the upper half, so every angle here is drawn with
         * the imaginary axis flipped: (cos, -sin).
         */
        function drawChartRimScales(R) {
            const at = (angle, radius) => ({
                x: centerX + radius * Math.cos(angle),
                y: centerY - radius * Math.sin(angle)
            });

            const rings = [
                { outer: R,      inner: R - 9,  label: 'WAVELENGTHS TOWARD GENERATOR' },
                { outer: R - 9,  inner: R - 18, label: 'WAVELENGTHS TOWARD LOAD' },
                { outer: R - 18, inner: R - 27, label: 'ANGLE OF REFLECTION COEFFICIENT' }
            ];

            ctx.save();

            // Ring separators
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
            ctx.lineWidth = 0.6;
            rings.forEach(ring => {
                ctx.beginPath();
                ctx.arc(centerX, centerY, ring.inner, 0, 2 * Math.PI);
                ctx.stroke();
            });

            ctx.font = '6px ui-monospace, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Two wavelength rings: 0 at the short circuit, half a wavelength per turn
            [
                { ring: rings[0], sign: +1, color: 'rgba(56, 189, 248, 0.75)' },
                { ring: rings[1], sign: -1, color: 'rgba(148, 163, 184, 0.7)' }
            ].forEach(({ ring, sign, color }) => {
                ctx.strokeStyle = color;
                ctx.fillStyle = color;
                for (let step = 0; step < 250; step++) {
                    const wl = step * 0.002;
                    const angle = Math.PI + sign * (wl / 0.5) * 2 * Math.PI;
                    const major = Math.abs(wl * 100 - Math.round(wl * 100)) < 1e-6 && Math.round(wl * 1000) % 10 === 0;
                    const mid = Math.round(wl * 1000) % 10 === 0;
                    const depth = major ? 6 : (mid ? 4 : 2);

                    const a = at(angle, ring.outer);
                    const b = at(angle, ring.outer - depth);
                    ctx.lineWidth = major ? 0.8 : 0.4;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();

                    if (Math.round(wl * 1000) % 50 === 0) {
                        const t = at(angle, ring.outer - 4.5);
                        ctx.save();
                        ctx.translate(t.x, t.y);
                        ctx.rotate(-angle + Math.PI / 2);
                        ctx.fillText(wl.toFixed(2).slice(1), 0, 0);
                        ctx.restore();
                    }
                }
            });

            // Angle of the reflection coefficient, +180 back round to -180
            const ring = rings[2];
            ctx.strokeStyle = 'rgba(244, 63, 94, 0.6)';
            ctx.fillStyle = 'rgba(244, 63, 94, 0.8)';
            for (let deg = -180; deg < 180; deg += 2) {
                const angle = (deg * Math.PI) / 180;
                const major = deg % 10 === 0;
                const depth = major ? 6 : 2.5;
                const a = at(angle, ring.outer);
                const b = at(angle, ring.outer - depth);
                ctx.lineWidth = major ? 0.7 : 0.35;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();

                if (deg % 30 === 0) {
                    const t = at(angle, ring.outer - 4.5);
                    ctx.save();
                    ctx.translate(t.x, t.y);
                    ctx.rotate(-angle + Math.PI / 2);
                    ctx.fillText(deg.toString(), 0, 0);
                    ctx.restore();
                }
            }

            ctx.restore();
        }

