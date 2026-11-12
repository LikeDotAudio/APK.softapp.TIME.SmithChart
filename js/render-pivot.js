// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
        /**
         * The real axis, read as one day.
         *
         * The horizontal line across the chart runs from the short circuit on the
         * left to the open circuit on the right -- the same span the transmission
         * coefficient ruler covers, tau = 1 + Gamma going 0 to 2. Mapping local
         * midnight to midnight onto it turns that axis into a day bar, and the
         * bright dot riding it says how far through the day we are.
         */
        function dayFractionOf(now) {
            return (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000) / 86400;
        }

        /** The point on the real axis that stands for the current hour of day. */
        /**
         * The 0-to-1 value of whichever field is assigned to stretch this
         * length target, or null when nothing is.
         */
        function stretchOf(target, now) {
            const field = lengthSources()[target];
            if (!field) return null;
            return Math.max(0, Math.min(1, SmithMath.fieldNormals(now)[field === 'day' ? 'date' : field]));
        }

        function dayOriginOf(now) {
            // A field assigned to the hour corner slides it along the axis
            // instead of the time of day
            const t = stretchOf('dayAxis', now) ?? dayFractionOf(now);
            return { x: centerX + (2 * t - 1) * scaleRadius, y: centerY };
        }

        /**
         * The three points that fix where the clock pivots.
         *
         * The hour anchor is the white dot riding the real axis -- the vital one,
         * since it alone says how far through the day we are. It is paired with
         * the second wheel and then with the date wheel, each taken on its own
         * constant-VSWR circle at its own phase. Those three corners make a
         * triangle, and the clock hangs off its centroid.
         *
         * All three are measured from the chart centre, never from the pivot,
         * so the construction cannot chase its own tail.
         */
        function clockAnchorsOf(now) {
            const hands = SmithMath.handVectors(now);
            const at = h => SmithMath.polarToCartesian(h.mag, h.phase, centerX, centerY, scaleRadius);

            const hour = dayOriginOf(now);
            let second = at(hands.second);
            let date = at(hands.date);

            // A stretched side keeps its direction and moves its far corner
            const toward = (from, to, length) => {
                const dx = to.x - from.x, dy = to.y - from.y;
                const d = Math.hypot(dx, dy) || 1;
                return { x: from.x + (dx / d) * length, y: from.y + (dy / d) * length };
            };
            const diameter = 2 * scaleRadius;
            const hs = stretchOf('side:hour-second', now);
            if (hs !== null) second = toward(hour, second, hs * diameter);
            const hd = stretchOf('side:hour-date', now);
            if (hd !== null) date = toward(hour, date, hd * diameter);
            const sd = stretchOf('side:second-date', now);
            if (sd !== null) date = toward(second, date, sd * diameter);

            let pivot = {
                x: (hour.x + second.x + date.x) / 3,
                y: (hour.y + second.y + date.y) / 3
            };
            // and a stretched pivot keeps its bearing from the chart centre
            const pv = stretchOf('pivot', now);
            if (pv !== null) pivot = toward({ x: centerX, y: centerY }, pivot, pv * scaleRadius);

            return { hour, second, date, pivot };
        }

        /**
         * A rolling trace of where the pivot has been.
         *
         * The centroid moves as all three anchors move, which is a different
         * curve from any single wheel and from the interference sum. Samples are
         * kept in chart coordinates rather than pixels, so the trace stays put
         * under zoom and pan.
         */
        const pivotTrace = [];
        const PIVOT_TRACE_MAX = 900;
        let pivotTraceLast = 0;

        function recordPivot(pivot, timestamp) {
            if (timestamp - pivotTraceLast < 40) return; // ~25 samples a second
            pivotTraceLast = timestamp;
            pivotTrace.push({
                u: (pivot.x - centerX) / scaleRadius,
                v: (pivot.y - centerY) / scaleRadius
            });
            if (pivotTrace.length > PIVOT_TRACE_MAX) pivotTrace.shift();
        }

        function drawPivotTrace() {
            if (!config.showPivotTrace || pivotTrace.length < 2) return;

            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            const n = pivotTrace.length;
            for (let i = 1; i < n; i++) {
                const a = pivotTrace[i - 1];
                const b = pivotTrace[i];
                const freshness = i / n;

                ctx.strokeStyle = tint('pivotPath', 0.06 + 0.8 * freshness * freshness);
                ctx.lineWidth = 0.6 + 3.4 * freshness * freshness;
                ctx.beginPath();
                ctx.moveTo(centerX + a.u * scaleRadius, centerY + a.v * scaleRadius);
                ctx.lineTo(centerX + b.u * scaleRadius, centerY + b.v * scaleRadius);
                ctx.stroke();
            }

            ctx.restore();
        }

        /**
         * Draws the solution triangle and the pivot it resolves to.
         */
        function drawPivotTriangle(anchors) {
            const { hour, second, date, pivot } = anchors;

            ctx.save();

            // The triangle itself
            ctx.strokeStyle = tint('triangle', 0.75);
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(hour.x, hour.y);
            ctx.lineTo(second.x, second.y);
            ctx.lineTo(date.x, date.y);
            ctx.closePath();
            ctx.stroke();

            // Medians, so the centroid reads as a construction rather than a guess
            ctx.strokeStyle = tint('triangle', 0.28);
            ctx.setLineDash([2, 5]);
            ctx.beginPath();
            [[hour, second, date], [second, date, hour], [date, hour, second]].forEach(([a, b, c]) => {
                ctx.moveTo(c.x, c.y);
                ctx.lineTo((a.x + b.x) / 2, (a.y + b.y) / 2);
            });
            ctx.stroke();
            ctx.setLineDash([]);

            // The three corners
            ctx.font = 'bold 9px ui-monospace, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            [
                { pt: hour, color: paint('triangle'), tag: 'HR', r: 4.5 },
                { pt: second, color: paint('second'), tag: 'SEC', r: 3.2 },
                { pt: date, color: paint('date'), tag: 'DATE', r: 3.2 }
            ].forEach(corner => {
                ctx.fillStyle = corner.color;
                ctx.beginPath();
                ctx.arc(corner.pt.x, corner.pt.y, corner.r, 0, 2 * Math.PI);
                ctx.fill();
                // The hour anchor already carries the time stamp above it, so
                // its own label goes underneath to stay clear.
                const dy = corner.tag === 'HR' ? corner.r + 8 : -(corner.r + 7);
                ctx.fillText(corner.tag, corner.pt.x, corner.pt.y + dy);
            });

            void pivot; // the pivot mark is drawn last, over the arms
            ctx.restore();
        }

        /**
         * The centroid of the anchor triangle: the point every arm hangs off.
         * Drawn after the arms so it is always visible, never buried under them.
         */
        function drawPivotMark(pivot) {
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

        function drawDayAxis(now) {
            const dayFraction = dayFractionOf(now);
            const xOfFraction = f => centerX + (2 * f - 1) * scaleRadius;
            const axisY = centerY;

            ctx.save();

            // Hour ticks along the axis, taller at the quarter days
            ctx.strokeStyle = tint('dayAxis', 0.55);
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            for (let h = 0; h <= 24; h++) {
                const x = xOfFraction(h / 24);
                const len = (h % 6 === 0) ? 7 : (h % 3 === 0 ? 4.5 : 2.5);
                ctx.moveTo(x, axisY - len);
                ctx.lineTo(x, axisY + len);
            }
            ctx.stroke();

            ctx.fillStyle = '#64748b';
            ctx.font = '7px ui-monospace, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            for (let h = 0; h <= 24; h += 6) {
                ctx.fillText(`${h.toString().padStart(2, '0')}h`, xOfFraction(h / 24), axisY + 9);
            }

            // Elapsed portion of the day, drawn over the axis
            // The dot is the triangle's hour corner, which a field can reassign
            const dotX = dayOriginOf(now).x;
            ctx.strokeStyle = tint('dayAxis', 0.9);
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.moveTo(centerX - scaleRadius, axisY);
            ctx.lineTo(dotX, axisY);
            ctx.stroke();

            // The dot itself
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = paint('dayAxis');
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(dotX, axisY, 5, 0, 2 * Math.PI);
            ctx.fill();
            ctx.shadowBlur = 0;

            // and the time it stands for
            const stamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${Math.floor(now.getSeconds()).toString().padStart(2, '0')}`;
            ctx.fillStyle = '#e2e8f0';
            ctx.font = 'bold 10px ui-monospace, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(stamp, dotX, axisY - 10);

            ctx.fillStyle = '#64748b';
            ctx.font = '7px ui-monospace, monospace';
            ctx.fillText(`${(dayFraction * 100).toFixed(2)}% of day`, dotX, axisY - 21);

            ctx.restore();
        }

        /**
         * Plots the moment itself: the day bar along the real axis, plus a marker
         * where the day path has actually reached.
         */
        function drawTimePlot(now, composite) {
            // Where the interference sum stands on its own locus right now
            const p = SmithMath.polarToCartesian(composite.mag, composite.phase, centerX, centerY, scaleRadius);
            ctx.save();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3.2, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.restore();
        }

        /**
         * The ghost of a hand: the traditional clock reading.
         *
         * The solid arms emanate from the hour of day, which slides along the
         * real axis, so they no longer line up with the dial numbers. This faint
         * line runs from the matched centre out to the rim in the same direction,
         * which is what actually points at the 10 at twenty to eleven.
         */
        /** Where a wheel's ghost ray meets the rim, and so where its chip sits. */
        function rimPointFor(phase) {
            return {
                x: centerX + scaleRadius * Math.cos(phase),
                y: centerY + scaleRadius * Math.sin(phase)
            };
        }

        function drawGhostHand(mag, phase, color, reading) {
            ctx.save();
            ctx.strokeStyle = color;
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(centerX + scaleRadius * Math.cos(phase), centerY + scaleRadius * Math.sin(phase));
            ctx.stroke();

            // and a bead where the arm's own magnitude falls on that line
            ctx.setLineDash([]);
            ctx.globalAlpha = 0.65;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(
                centerX + mag * scaleRadius * Math.cos(phase),
                centerY + mag * scaleRadius * Math.sin(phase),
                2.5, 0, 2 * Math.PI
            );
            ctx.fill();
            ctx.restore();

            // The value this line is reading, printed where it leaves the chart.
            // Queued rather than drawn, so coincident wheels can be spread out
            // once the whole set is known.
            if (reading) rimReadings.push({ phase, color, text: reading });
        }

        // Rim readings pending placement for this frame
        let rimReadings = [];

        /**
         * Prints what a ghost line reads, just outside the rim it points at.
         *
         * A dotted line on its own only says which way a wheel is facing; the
         * chip says what it is facing at. It gets a dark pill behind it so it
         * stays legible where it crosses a dial number.
         */
        function flushRimReadings() {
            ctx.save();
            ctx.font = 'bold 9px ui-monospace, monospace';

            const placed = [];
            for (const reading of rimReadings) {
                const w = ctx.measureText(reading.text).width + 7;
                const h = 13;

                // Two wheels can point almost the same way, so step the chip
                // outwards until it clears everything already placed.
                let rr = scaleRadius + 30;
                let box = null;
                for (let attempt = 0; attempt < 4; attempt++) {
                    const cx = centerX + rr * Math.cos(reading.phase);
                    const cy = centerY + rr * Math.sin(reading.phase);
                    box = { x: cx - w / 2, y: cy - h / 2, w, h, cx, cy };

                    const clash = placed.some(q =>
                        Math.abs(box.cx - q.cx) < (box.w + q.w) / 2 + 3 &&
                        Math.abs(box.cy - q.cy) < (box.h + q.h) / 2 + 3);
                    if (!clash) break;
                    rr += 16;
                }

                placed.push(box);
                drawRimReading(box, reading.color, reading.text);
            }

            ctx.restore();
            rimReadings = [];
        }

        function drawRimReading(box, color, text) {
            const { cx: x, cy: y, w, h } = box;

            ctx.save();
            ctx.font = 'bold 9px ui-monospace, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            ctx.fillStyle = 'rgba(10, 13, 20, 0.92)';
            ctx.strokeStyle = color;
            ctx.lineWidth = 0.8;
            ctx.globalAlpha = 0.95;
            ctx.beginPath();
            const r = 3;
            const left = x - w / 2, top = y - h / 2;
            ctx.moveTo(left + r, top);
            ctx.arcTo(left + w, top, left + w, top + h, r);
            ctx.arcTo(left + w, top + h, left, top + h, r);
            ctx.arcTo(left, top + h, left, top, r);
            ctx.arcTo(left, top, left + w, top, r);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.globalAlpha = 1;
            ctx.fillStyle = color;
            ctx.fillText(text, x, y);
            ctx.restore();
        }


