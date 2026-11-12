// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
        function drawDateDNASpiral(currentDate) {
            if (!config.showSpiral) return;

            const curYear = currentDate.getFullYear();
            const startYear = config.spiralStartYear;
            const endYear = config.spiralEndYear;
            const span = endYear - startYear;

            const yearsElapsed = (curYear - startYear) + (currentDate.getMonth() / 12) + (currentDate.getDate() / 365.25);
            if (yearsElapsed <= 0) return;

            const steps = Math.floor(yearsElapsed * 16);
            let prevPt = null;

            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            for (let i = 0; i <= steps; i++) {
                const prog = i / steps;
                const simY = startYear + (prog * yearsElapsed);
                const simYInt = Math.floor(simY);
                const frac = simY - simYInt;
                const simDay = Math.floor(frac * 365.25);

                const normRadius = Math.min(0.96, Math.max(0.02, (simY - startYear) / span));
                const angle = (simDay / 365.25) * (2 * Math.PI) - (Math.PI / 2);

                const pt = {
                    x: centerX + (normRadius * scaleRadius * Math.cos(angle)),
                    y: centerY + (normRadius * scaleRadius * Math.sin(angle))
                };

                if (prevPt) {
                    const sDate = new Date(simYInt, 0, Math.max(1, simDay));
                    let color;

                    if (config.colorEngine === 'date-dna') {
                        const dna = SmithMath.computeDateDNA(sDate);
                        color = `rgba(${dna.r}, ${dna.g}, ${dna.b}, 0.75)`;
                    } else if (config.colorEngine === 'mood') {
                        const mood = SmithMath.computeMood(sDate);
                        color = mood.hsl;
                    } else {
                        const hue = (simY * 15) % 360;
                        color = `hsla(${hue}, 90%, 60%, 0.7)`;
                    }

                    ctx.strokeStyle = color;
                    ctx.lineWidth = 2.0;
                    ctx.beginPath();
                    ctx.moveTo(prevPt.x, prevPt.y);
                    ctx.lineTo(pt.x, pt.y);
                    ctx.stroke();
                }

                prevPt = pt;
            }

            // Glow tip
            if (prevPt) {
                const dna = SmithMath.computeDateDNA(currentDate);
                ctx.fillStyle = dna.hex;
                ctx.shadowColor = dna.hex;
                ctx.shadowBlur = 14;
                ctx.beginPath();
                ctx.arc(prevPt.x, prevPt.y, 4.5, 0, 2 * Math.PI);
                ctx.fill();
                ctx.shadowBlur = 0;
            }

            ctx.restore();
        }

        function drawPhasorVector(mag, phase, color, lineWidth, label, origin, endpoint, reachRim, stretch = null) {
            // The arms no longer grow out of the chart centre: they emanate from
            // the hour of day, the dot riding the real axis.
            const o = origin || { x: centerX, y: centerY };

            // Some arms take their direction from a triangle corner rather than
            // from their own wheel phase, so the arm and the corner cannot drift
            // apart. Either way the arm runs out to the main circle.
            const angle = endpoint
                ? Math.atan2(endpoint.y - o.y, endpoint.x - o.x)
                : phase;

            // Where that ray leaves the unit circle, so no arm overshoots the
            // chart once its origin has slid away from the middle.
            const ox = o.x - centerX;
            const oy = o.y - centerY;
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);
            const proj = ox * dx + oy * dy;
            const limit = -proj + Math.sqrt(
                Math.max(0, proj * proj + scaleRadius * scaleRadius - (ox * ox + oy * oy))
            );
            // Arms bound to a triangle corner run on through it to the rim;
            // every other arm keeps its own radius, which is what puts it on its
            // own constant-VSWR circle.
            // An arm a field is stretching goes that fraction of the way instead.
            const length = stretch !== null
                ? stretch * limit * 0.97
                : reachRim ? limit * 0.97 : Math.min(mag * scaleRadius, limit * 0.97);

            const target = { x: o.x + length * dx, y: o.y + length * dy };

            ctx.save();
            ctx.shadowColor = color;
            ctx.shadowBlur = 8;
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';

            // Shaft
            ctx.beginPath();
            ctx.moveTo(o.x, o.y);
            ctx.lineTo(target.x, target.y);
            ctx.stroke();

            // Arrow head
            const headLen = Math.max(7, lineWidth * 2.2);
            const arrowAngle = Math.PI / 7;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(target.x, target.y);
            ctx.lineTo(target.x - headLen * Math.cos(angle - arrowAngle), target.y - headLen * Math.sin(angle - arrowAngle));
            ctx.lineTo(target.x - headLen * Math.cos(angle + arrowAngle), target.y - headLen * Math.sin(angle + arrowAngle));
            ctx.closePath();
            ctx.fill();

            // The corner the arm passes through, marked on the shaft
            if (endpoint && reachRim) {
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#0a0d14';
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(endpoint.x, endpoint.y, 4, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
            }

            if (label) {
                ctx.shadowBlur = 0;
                ctx.fillStyle = color;
                ctx.font = 'bold 14px ui-monospace, monospace';
                const dist = Math.max(16, lineWidth * 2.6);
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, target.x + dist * Math.cos(angle), target.y + dist * Math.sin(angle));
            }

            ctx.restore();
            return target;
        }

        /**
         * Constant-VSWR circles: centred on the origin, radius |Gamma|.
         * Each clock wheel rides one, so the dial rings and the RF reading are
         * literally the same curve. Only the composite circle moves.
         */
        function drawVswrCircles(compositeRho) {
            const rings = [
                { rho: HAND_MAGS.minute, strong: false, note: 'M' },
                { rho: HAND_MAGS.hour, strong: false, note: 'H' }
            ];
            if (config.showCalendar) {
                rings.push(
                    { rho: HAND_MAGS.date, strong: false, note: 'D' },
                    { rho: HAND_MAGS.month, strong: false, note: 'MO' },
                    { rho: HAND_MAGS.year, strong: false, note: 'Y' }
                );
            }
            rings.push({ rho: compositeRho, strong: true, note: 'Σ' });

            ctx.save();
            for (const ring of rings) {
                if (ring.rho <= 0.005) continue;
                ctx.strokeStyle = ring.strong ? '#f43f5e' : 'rgba(244, 63, 94, 0.3)';
                ctx.lineWidth = ring.strong ? 1.6 : 0.9;
                ctx.setLineDash(ring.strong ? [] : [2, 4]);
                ctx.beginPath();
                ctx.arc(centerX, centerY, ring.rho * scaleRadius, 0, 2 * Math.PI);
                ctx.stroke();

                // Label each circle at its own angle, so the readings do not
                // pile up along a single diagonal.
                const swr = ring.rho >= 0.9999 ? '∞' : ((1 + ring.rho) / (1 - ring.rho)).toFixed(2);
                const a = -2.356 + rings.indexOf(ring) * 0.34;
                ctx.setLineDash([]);
                ctx.fillStyle = ring.strong ? '#f43f5e' : '#64748b';
                ctx.font = ring.strong ? 'bold 9px ui-monospace, monospace' : '8px ui-monospace, monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(
                    `${ring.note} ${swr}:1`,
                    centerX + ring.rho * scaleRadius * Math.cos(a),
                    centerY + ring.rho * scaleRadius * Math.sin(a)
                );
            }
            ctx.restore();
        }

        /**
         * The path of the day: 24 hours of reflection coefficient traced out by
         * the hour and minute arms, coloured by time of day. Elapsed is solid,
         * the rest of the day is a faint preview.
         */
        function drawDayPath(now) {
            // The secondary loci first, so the primary trail lands on top of them
            const primary = plotPair();
            for (const id of config.loggedPairs) {
                if (id === primary.id) continue;
                const pair = PLOT_PAIRS.find(pr => pr.id === id);
                if (pair) drawSecondaryLocus(now, pair);
            }

            const path = getDayPath(now, primary);
            const nowMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
            const pt = polar => SmithMath.polarToCartesian(polar.mag, polar.phase, centerX, centerY, scaleRadius);

            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // The admittance locus is the same day reflected through the origin,
            // because y = 1/z sits diametrically opposite z on the chart.
            pushLayer('admittance');
            if (config.showAdmittance) {
                ctx.strokeStyle = 'rgba(168, 85, 247, 0.45)';
                ctx.lineWidth = 1.0;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                path.samples.forEach((sample, i) => {
                    const p = pt({ mag: sample.polar.mag, phase: sample.polar.phase + Math.PI });
                    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
                });
                ctx.stroke();
                ctx.setLineDash([]);
            }
            popLayer();

            // The trail comes in fat and bright at the current moment and tapers
            // away behind it; the rest of the day stays as a thin history line so
            // the whole locus is still readable underneath.
            const TRAIL_MINUTES = config.trailMinutes;
            let prev = pt(path.samples[0].polar);
            for (let i = 1; i < path.samples.length; i++) {
                const sample = path.samples[i];
                const p = pt(sample.polar);
                const age = nowMinutes - sample.minuteOfDay;
                const hue = 190 + (sample.minuteOfDay / 1440) * 150; // dawn cyan -> dusk magenta

                if (age < 0) {
                    ctx.strokeStyle = tint('trail', 0.09);
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
                ctx.lineTo(p.x, p.y);
                ctx.stroke();
                prev = p;
            }

            // Hour stations around the locus
            ctx.font = '8px ui-monospace, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            for (const sample of path.samples) {
                if (sample.minuteOfDay % 60 !== 0 || sample.minuteOfDay === 1440) continue;
                const p = pt(sample.polar);
                const elapsed = sample.minuteOfDay <= nowMinutes;
                ctx.fillStyle = elapsed ? tint('trail', 0.55) : tint('trail', 0.14);
                ctx.beginPath();
                ctx.arc(p.x, p.y, sample.minuteOfDay % 360 === 0 ? 2.4 : 1.2, 0, 2 * Math.PI);
                ctx.fill();
            }

            // Best and worst match of the day
            [{ s: path.best, c: '#10b981' }, { s: path.worst, c: '#ef4444' }].forEach(mark => {
                const p = pt(mark.s.polar);
                ctx.strokeStyle = mark.c;
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 4.5, 0, 2 * Math.PI);
                ctx.stroke();
            });

            ctx.restore();
        }

        /**
         * One of the other logged intersections: the whole day as a thin line in
         * the pair's own colour, with the moment it has reached picked out.
         */
        function drawSecondaryLocus(now, pair) {
            const path = getDayPath(now, pair);
            const nowMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
            const pt = polar => SmithMath.polarToCartesian(polar.mag, polar.phase, centerX, centerY, scaleRadius);

            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = pair.color;

            // Same shape of trail as the primary, in this pair's own colour:
            // bright at the head, tapering back over the trail length, and the
            // rest of the day left as a thin line underneath.
            const trail = config.trailMinutes;
            let prev = pt(path.samples[0].polar);
            for (let i = 1; i < path.samples.length; i++) {
                const sample = path.samples[i];
                const p = pt(sample.polar);
                const age = nowMinutes - sample.minuteOfDay;

                if (age < 0) {
                    ctx.globalAlpha = 0.07;
                    ctx.lineWidth = 0.6;
                } else if (age <= trail) {
                    const weight = Math.pow(1 - age / trail, 3);
                    ctx.globalAlpha = 0.1 + 0.75 * weight;
                    ctx.lineWidth = 0.6 + 4.5 * weight;
                } else {
                    ctx.globalAlpha = 0.16;
                    ctx.lineWidth = 0.7;
                }

                ctx.beginPath();
                ctx.moveTo(prev.x, prev.y);
                ctx.lineTo(p.x, p.y);
                ctx.stroke();
                prev = p;
            }

            // Where this pair stands right now
            const head = pt(SmithMath.compositePolar(now, pair));
            ctx.globalAlpha = 1;
            ctx.fillStyle = pair.color;
            ctx.beginPath();
            ctx.arc(head.x, head.y, 3.4, 0, 2 * Math.PI);
            ctx.fill();

            ctx.font = 'bold 8px ui-monospace, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(pair.label, head.x, head.y - 6);

            ctx.restore();
        }

        // ---------------------------------------------- radially scaled strip

        function stripX(scale, rho, rowLeft, rowRight) {
            const clamped = Math.max(0, Math.min(1, rho));
            if (scale.side === 'left') return centerX - clamped * (centerX - rowLeft);
            if (scale.side === 'right') return centerX + clamped * (rowRight - centerX);
            return rowLeft + ((1 + clamped) / 2) * (rowRight - rowLeft);
        }

        /** One ruler: minor ticks, printed values, diagonal end label. */
        function drawRadialRuler(scale, g) {
            const isFull = scale.side === 'full';
            const xOf = value => isFull
                ? g.rowLeft + (value / 2) * (g.rowRight - g.rowLeft)
                : stripX(scale, scale.rhoOf(value), g.rowLeft, g.rowRight);

            // Minor ticks, interpolated in value space between the printed majors
            ctx.strokeStyle = '#55657f';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            for (let i = 0; i < scale.ticks.length - 1; i++) {
                const a = scale.ticks[i], b = scale.ticks[i + 1];
                if (!isFinite(a) || !isFinite(b)) continue;
                for (let k = 1; k < 5; k++) {
                    const x = xOf(a + ((b - a) * k) / 5);
                    if (x < g.rowLeft - 0.5 || x > g.rowRight + 0.5) continue;
                    ctx.moveTo(x, g.y);
                    ctx.lineTo(x, g.y - 2.5);
                }
            }
            ctx.stroke();

            // Major ticks and printed values, skipping any that would collide
            ctx.strokeStyle = '#3f4c63';
            ctx.lineWidth = 0.9;
            ctx.fillStyle = '#9fb0c7';
            ctx.font = '6.5px ui-monospace, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';

            // Several rulers count downwards, so the values have to be placed
            // left to right rather than in tick order, or the overlap test in
            // the loop below never fires and the numbers run together.
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
                const half = ctx.measureText(text).width / 2 + 1.5;
                if (tick.x - half < lastLabelRight) continue;
                ctx.fillText(text, tick.x, g.y - 5.5);
                lastLabelRight = tick.x + half;
            }

            // Diagonal end label, set at 45 deg the way a printed chart sets them
            ctx.save();
            ctx.fillStyle = '#cbd5e1';
            ctx.font = '7px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textBaseline = 'middle';
            if (scale.side === 'right' || isFull) {
                ctx.translate(g.rowRight + 3, g.y);
                ctx.rotate(-Math.PI / 4);
                ctx.textAlign = 'left';
            } else {
                ctx.translate(g.rowLeft - 3, g.y);
                ctx.rotate(-Math.PI / 4);
                ctx.textAlign = 'right';
            }
            ctx.fillText(scale.label, 0, 0);
            ctx.restore();
        }

        /**
         * The classic "RADIALLY SCALED PARAMETERS" nomograph, with a live cursor
         * at the composite phasor's radius. Because every ruler is scaled against
         * the same |Gamma|, one vertical line reads SWR, return loss, reflection
         * and transmission coefficients for this moment all at once.
         */
        function drawRadialScales(cursorRho, cursorGammaRe) {
            if (!config.showRadialScales || stripHeight < 60) return;

            // The diagonal end labels lean out past the rulers, so the strip
            // needs real gutters or they run off the canvas.
            const padX = 72;
            const left = padX;
            const right = cssWidth - padX;

            const titleY = stripTop + 11;
            const dirY = stripTop + 24;
            const rowsTop = stripTop + 30;
            // 14px of tail so the bottom ruler's ORIGIN mark and its labels
            // stay inside the canvas.
            const rowH = (stripHeight - 36 - 14) / 6;
            const slant = 4; // gentle trapezoid, exactly as on a printed chart

            ctx.save();
            ctx.textBaseline = 'alphabetic';

            ctx.fillStyle = '#cbd5e1';
            ctx.font = '9px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('RADIALLY SCALED PARAMETERS', centerX, titleY);

            ctx.fillStyle = '#55657f';
            ctx.font = '8px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.fillText('TOWARD LOAD →', left + (centerX - left) / 2, dirY);
            ctx.fillText('← TOWARD GENERATOR', centerX + (right - centerX) / 2, dirY);

            const rowGeometry = row => {
                const inset = row >= 5 ? 0 : (4 - row) * slant;
                return {
                    y: rowsTop + (row + 1) * rowH,
                    rowLeft: left + inset,
                    rowRight: right - inset
                };
            };

            // Rule line per row, plus the vertical end caps of the trapezoid
            ctx.strokeStyle = '#3f4c63';
            ctx.lineWidth = 0.8;
            for (let row = 0; row < 6; row++) {
                const g = rowGeometry(row);
                ctx.beginPath();
                ctx.moveTo(g.rowLeft, g.y);
                ctx.lineTo(g.rowRight, g.y);
                ctx.stroke();
            }
            const gTop = rowGeometry(0), gBot = rowGeometry(4);
            ctx.beginPath();
            ctx.moveTo(gTop.rowLeft, gTop.y - rowH);
            ctx.lineTo(gBot.rowLeft, gBot.y);
            ctx.moveTo(gTop.rowRight, gTop.y - rowH);
            ctx.lineTo(gBot.rowRight, gBot.y);
            ctx.stroke();

            RADIAL_SCALES.forEach(scale => drawRadialRuler(scale, rowGeometry(scale.row)));

            // CENTER and ORIGIN reference marks
            const bar = rowGeometry(5);
            const triangle = (x, y, label) => {
                ctx.fillStyle = '#cbd5e1';
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
            triangle(centerX, bar.y - rowH + 2, 'CENTER');
            triangle(bar.rowLeft, bar.y + 1, 'ORIGIN');

            // Live cursor: one vertical line per half, at the current radius
            ctx.strokeStyle = '#f43f5e';
            ctx.lineWidth = 1.2;
            ['left', 'right'].forEach(side => {
                const probe = RADIAL_SCALES.find(sc => sc.side === side);
                const g = rowGeometry(probe.row);
                const x = stripX(probe, cursorRho, g.rowLeft, g.rowRight);
                ctx.beginPath();
                ctx.moveTo(x, gTop.y - rowH);
                ctx.lineTo(x, gBot.y);
                ctx.stroke();
            });

            // and one on the full-width ruler, which is linear in Gamma itself
            const tauX = bar.rowLeft + ((1 + cursorGammaRe) / 2) * (bar.rowRight - bar.rowLeft);
            ctx.beginPath();
            ctx.moveTo(tauX, bar.y - rowH + 4);
            ctx.lineTo(tauX, bar.y);
            ctx.stroke();

            ctx.restore();
        }

