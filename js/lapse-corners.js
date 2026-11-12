// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
        // ==========================================
        // 2b. TIME LAPSE PLAYBACK
        // ==========================================
        // Runs simulated time forward at a fixed ratio: a whole day, week or year
        // replayed inside a chosen number of real seconds, looping until stopped.
        let lapse = null;

        const LAPSE_SPANS = {
            day: {
                label: 'day',
                start: d => new Date(d.getFullYear(), d.getMonth(), d.getDate()),
                end: d => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
            },
            week: {
                label: 'week',
                // The week the current day falls in, starting Sunday
                start: d => new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()),
                end: d => new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay() + 7)
            },
            year: {
                label: 'year',
                start: d => new Date(d.getFullYear(), 0, 1),
                end: d => new Date(d.getFullYear() + 1, 0, 1)
            }
        };

        function startLapse(spanKey, durationMs) {
            const span = LAPSE_SPANS[spanKey];
            if (!span) return;

            isLive = false;
            btnToggleLive.classList.remove('active');
            btnToggleLive.innerHTML = '⏸ CUSTOM';

            const anchor = new Date(simDate);
            const from = span.start(anchor).getTime();
            const to = span.end(anchor).getTime();

            lapse = {
                key: spanKey,
                label: span.label,
                from,
                spanMs: to - from,
                durationMs,
                startedAt: performance.now()
            };
        }

        function stopLapse() {
            lapse = null;
            document.getElementById('lapseStatus').textContent = 'stopped';
        }

        /** Advances simDate for this frame. Returns true if the lapse drove it. */
        function advanceLapse() {
            if (!lapse) return false;

            const elapsed = performance.now() - lapse.startedAt;
            const progress = (elapsed % lapse.durationMs) / lapse.durationMs;
            simDate = new Date(lapse.from + progress * lapse.spanMs);
            syncSlidersFromDate(simDate);

            const seconds = (lapse.durationMs / 1000).toFixed(0);
            document.getElementById('lapseStatus').textContent =
                `1 ${lapse.label} / ${seconds} s · ${(progress * 100).toFixed(1)}%`;
            return true;
        }

        function roundedRectPath(left, top, w, h, r) {
            ctx.beginPath();
            ctx.moveTo(left + r, top);
            ctx.arcTo(left + w, top, left + w, top + h, r);
            ctx.arcTo(left + w, top + h, left, top + h, r);
            ctx.arcTo(left, top + h, left, top, r);
            ctx.arcTo(left, top, left + w, top, r);
            ctx.closePath();
        }

        const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

        /**
         * Live readouts in the corners of the chart's square.
         *
         * The dial is round and the canvas is not, so the three corners the
         * probe overlay leaves free carry the time, every wheel's reading and
         * the interference sum. They go down before the arms and rim chips, so
         * a chip or a zoomed-in chart that reaches that far lands on top.
         */
        function drawCornerPanels(now, composite, colors) {
            const s = Math.max(0.7, Math.min(1.4, cssWidth / 740));
            const margin = 8 * s;
            const pad = 8 * s;
            const rowH = 15 * s;
            const titleH = 12 * s;
            const bottom = stripTop - margin;
            const p2 = n => n.toString().padStart(2, '0');

            const plate = (left, top, w, h, accent) => {
                ctx.fillStyle = 'rgba(10, 13, 20, 0.82)';
                ctx.strokeStyle = accent;
                ctx.lineWidth = 1;
                roundedRectPath(left, top, w, h, 6 * s);
                ctx.fill();
                ctx.stroke();
            };
            const title = (text, x, y) => {
                ctx.font = `600 ${8.5 * s}px -apple-system, BlinkMacSystemFont, sans-serif`;
                ctx.fillStyle = '#64748b';
                ctx.textAlign = 'left';
                ctx.fillText(text, x, y);
            };

            ctx.save();
            ctx.textBaseline = 'middle';

            // Bottom left: the time and date in plain figures, and the day so far
            {
                const timeText = `${p2(now.getHours())}:${p2(now.getMinutes())}:${p2(Math.floor(now.getSeconds()))}`;
                const dateText = `${WEEKDAYS[now.getDay()]} ${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}`;
                const timeSize = 26 * s;
                ctx.font = `bold ${timeSize}px ui-monospace, monospace`;
                const w = ctx.measureText(timeText).width + pad * 2;
                const h = pad * 2 + titleH + timeSize * 1.2 + 14 * s + 6 * s;
                const left = margin, top = bottom - h;
                plate(left, top, w, h, 'rgba(56, 189, 248, 0.35)');

                let y = top + pad;
                title('LOCAL TIME', left + pad, y + titleH / 2);
                y += titleH;
                ctx.font = `bold ${timeSize}px ui-monospace, monospace`;
                ctx.fillStyle = paint('clock');
                ctx.fillText(timeText, left + pad, y + timeSize * 0.6);
                y += timeSize * 1.2;
                ctx.font = `${10 * s}px ui-monospace, monospace`;
                ctx.fillStyle = '#cbd5e1';
                ctx.fillText(dateText, left + pad, y + 7 * s);
                y += 14 * s + 2 * s;

                const barW = w - pad * 2;
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(left + pad, y, barW, 3 * s);
                ctx.fillStyle = paint('dayAxis');
                ctx.fillRect(left + pad, y, barW * dayFractionOf(now), 3 * s);
            }

            // Top right: every wheel's reading, time on the left, calendar right
            {
                const hands = SmithMath.handVectors(now);
                const columns = [
                    [['hour', colors.hour, true], ['minute', colors.minute, true], ['second', colors.second, config.showSecond]],
                    [['date', paint('date'), config.showCalendar], ['month', paint('month'), config.showCalendar], ['year', paint('year'), config.showCalendar]]
                ];
                const colW = 68 * s;
                const w = pad * 2 + colW * 2;
                const h = pad * 2 + titleH + rowH * 3;
                const left = cssWidth - margin - w, top = margin;
                plate(left, top, w, h, 'rgba(255, 255, 255, 0.12)');
                title('WHEELS', left + pad, top + pad + titleH / 2);

                columns.forEach((column, c) => {
                    column.forEach(([id, color, shown], r) => {
                        const x = left + pad + c * colW;
                        const y = top + pad + titleH + rowH * (r + 0.5);
                        ctx.globalAlpha = shown ? 1 : 0.35;
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        ctx.arc(x + 3 * s, y, 3 * s, 0, 2 * Math.PI);
                        ctx.fill();
                        ctx.font = `bold ${11 * s}px ui-monospace, monospace`;
                        ctx.textAlign = 'left';
                        ctx.fillText(hands[id].label, x + 10 * s, y);
                        ctx.fillStyle = '#e2e8f0';
                        ctx.textAlign = 'right';
                        ctx.fillText(hands[id].value, x + colW - 8 * s, y);
                    });
                });
                ctx.globalAlpha = 1;
            }

            // Bottom right: the interference sum, read as a reflection coefficient
            {
                const rho = composite.mag;
                const vswr = rho < 1 ? (1 + rho) / (1 - rho) : Infinity;
                const rl = rho > 1e-5 ? -20 * Math.log10(rho) : Infinity;
                const num = (v, d) => isFinite(v) ? v.toFixed(d) : '∞';
                const rows = [
                    ['|Γ|', `${rho.toFixed(3)} ∠ ${(composite.phase * 180 / Math.PI).toFixed(1)}°`],
                    ['VSWR', `${num(vswr, 2)} : 1`],
                    ['RL', `${num(rl, 2)} dB`]
                ];
                const w = pad * 2 + 160 * s;
                const h = pad * 2 + titleH + rowH * 3;
                const left = cssWidth - margin - w, top = bottom - h;
                plate(left, top, w, h, tint('sigma', 0.45));
                title('Σ INTERFERENCE SUM', left + pad, top + pad + titleH / 2);

                rows.forEach(([label, value], r) => {
                    const y = top + pad + titleH + rowH * (r + 0.5);
                    ctx.font = `${11 * s}px ui-monospace, monospace`;
                    ctx.textAlign = 'left';
                    ctx.fillStyle = paint('sigma');
                    ctx.fillText(label, left + pad, y);
                    ctx.textAlign = 'right';
                    ctx.fillStyle = '#e2e8f0';
                    ctx.fillText(value, left + w - pad, y);
                });
            }

            ctx.restore();
        }

