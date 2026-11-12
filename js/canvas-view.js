// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
        // Resize Canvas with DevicePixelRatio
        let dpr = window.devicePixelRatio || 1;
        let centerX = 340;
        let centerY = 340;
        let scaleRadius = 290;
        let stripTop = 680;
        let stripHeight = 0;
        let cssWidth = 680;
        let cssHeight = 880;

        // Where the chart would sit unzoomed. The parameter strip stays pinned to
        // these, so only the chart itself moves under zoom and pan.
        let baseCenterX = 340;
        let baseCenterY = 340;
        let baseRadius = 290;

        // Zoom magnifies the chart radius rather than applying a canvas
        // transform, so line widths and type stay at their natural pixel size
        // and the fine gradations become readable as they spread apart.
        const view = { zoom: 1, panX: 0, panY: 0 };
        const MAX_ZOOM = 24;

        function applyView() {
            centerX = baseCenterX + view.panX;
            centerY = baseCenterY + view.panY;
            scaleRadius = baseRadius * view.zoom;
        }

        function resetView() {
            view.zoom = 1;
            view.panX = 0;
            view.panY = 0;
            applyView();
        }

        /** Zooms about a point on the canvas, keeping whatever is under it still. */
        function zoomAbout(px, py, factor) {
            const previous = view.zoom;
            const next = Math.min(MAX_ZOOM, Math.max(1, previous * factor));
            if (next === previous) return;

            const k = next / previous;
            view.panX = px - k * (px - centerX) - baseCenterX;
            view.panY = py - k * (py - centerY) - baseCenterY;
            view.zoom = next;
            applyView();

            const badge = document.getElementById('zoomBadge');
            if (badge) badge.textContent = `${view.zoom.toFixed(2)}\u00d7`;
        }

        // Room the card's own padding and border, plus the layout's bottom
        // padding, need underneath the canvas. The legend is left below the
        // fold so the chart can run to the foot of the window.
        const CANVAS_CHROME_PX = 24;

        // How far the parameter strip rises into the rim clearance below the
        // dial. Enough to reclaim the dead band, short of the rim chips.
        const STRIP_TUCK_PX = 20;

        function resizeCanvas() {
            dpr = window.devicePixelRatio || 1;

            // Measure the column, not the card: the card hugs the canvas, so
            // asking it how wide it is would just echo the last size back.
            const card = canvas.parentElement;
            const column = card ? card.parentElement : null;
            const availableWidth = column ? column.clientWidth - 12 : window.innerWidth - 400;

            // The canvas is a square chart with the parameter strip stacked under
            // it, so its height is always a fixed multiple of its width. Work that
            // backwards from the viewport so the whole thing fits on screen
            // without scrolling, then take whichever limit bites first.
            const cardTop = card ? card.getBoundingClientRect().top : 0;
            const availableHeight = window.innerHeight - cardTop - CANVAS_CHROME_PX;
            const stripRatio = config.showRadialScales ? 0.28 : 0;
            const tuck = config.showRadialScales ? STRIP_TUCK_PX : 0;
            const widthFromHeight = (availableHeight + tuck) / (1 + stripRatio);

            const width = Math.max(320, Math.floor(Math.min(availableWidth, widthFromHeight)));

            // Reserve a band at the foot of the canvas for the parameter strip,
            // then centre the chart in whatever is left above it. The strip
            // tucks up into the rim clearance under the dial, since the clock
            // readout that used to sit there has moved into a corner.
            stripHeight = config.showRadialScales
                ? Math.max(120, Math.min(210, width * 0.28))
                : 0;
            const height = width - tuck + stripHeight;
            stripTop = height - stripHeight;

            cssWidth = width;
            cssHeight = height;

            canvas.style.width = width + 'px';
            canvas.style.height = height + 'px';
            canvas.width = width * dpr;
            canvas.height = height * dpr;

            ctx.resetTransform?.();
            ctx.scale(dpr, dpr);

            baseCenterX = width / 2;
            baseCenterY = width / 2;
            // Outside the rim sit the dial numbers and, beyond them, the value
            // each ghost line is reading. Both need clearance.
            baseRadius = (width / 2) - 52;
            applyView();
        }

        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        // Audio Oscillator Ticking
        function playTickSound() {
            if (!audioTickEnabled) return;
            try {
                if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
                if (audioContext.state === 'suspended') audioContext.resume();

                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1800, audioContext.currentTime);
                osc.frequency.exponentialRampToValueAtTime(300, audioContext.currentTime + 0.03);

                gain.gain.setValueAtTime(0.06, audioContext.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.03);

                osc.connect(gain);
                gain.connect(audioContext.destination);
                osc.start();
                osc.stop(audioContext.currentTime + 0.035);
            } catch (e) {}
        }

        window.toggleAudioTick = function() {
            audioTickEnabled = !audioTickEnabled;
            const btn = document.getElementById('btnAudio');
            if (audioTickEnabled) {
                btn.classList.add('active');
                btn.innerHTML = '🔊 Audio Tick ON';
                try {
                    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
                } catch (e) {
                    /* No Web Audio here: put the button back and say so, instead of a tick that never comes. */
                    audioTickEnabled = false;
                    btn.classList.remove('active');
                    btn.innerHTML = '🔇 Audio Tick';
                    if (window.APKSoftapp) window.APKSoftapp.showProblem('unsupported_browser', {
                        subject: 'Audio Tick', detail: String(e && e.message || e),
                        fix: ['The chart keeps running without sound. A current Chrome, Edge, Firefox or Safari has Web Audio.']
                    });
                }
            } else {
                btn.classList.remove('active');
                btn.innerHTML = '🔇 Audio Tick';
            }
        };

        // Live Toggle & Slider bindings
        btnToggleLive.addEventListener('click', () => {
            stopLapse(); // going back to live, or to manual, ends any playback
            isLive = !isLive;
            if (isLive) {
                btnToggleLive.classList.add('active');
                btnToggleLive.innerHTML = '● LIVE';
            } else {
                btnToggleLive.classList.remove('active');
                btnToggleLive.innerHTML = '⏸ CUSTOM';
            }
        });

        function syncSlidersFromDate(d) {
            sliderYear.value = d.getFullYear();
            sliderMonth.value = d.getMonth() + 1;
            sliderDay.value = d.getDate();
            sliderHour.value = d.getHours();
            sliderMinute.value = d.getMinutes();

            labelYear.textContent = d.getFullYear();
            labelMonth.textContent = (d.getMonth() + 1).toString().padStart(2, '0');
            labelDay.textContent = d.getDate().toString().padStart(2, '0');
            labelHour.textContent = d.getHours().toString().padStart(2, '0') + ':00';
            labelMinute.textContent = d.getMinutes().toString().padStart(2, '0') + 'm';
        }

        [sliderYear, sliderMonth, sliderDay, sliderHour, sliderMinute].forEach(slider => {
            slider.addEventListener('input', () => {
                isLive = false;
                btnToggleLive.classList.remove('active');
                btnToggleLive.innerHTML = '⏸ CUSTOM';

                simDate = new Date(
                    parseInt(sliderYear.value),
                    parseInt(sliderMonth.value) - 1,
                    parseInt(sliderDay.value),
                    parseInt(sliderHour.value),
                    parseInt(sliderMinute.value),
                    0
                );
                syncSlidersFromDate(simDate);
            });
        });

        // Historical Presets
        window.applyPreset = function(type) {
            isLive = false;
            btnToggleLive.classList.remove('active');
            btnToggleLive.innerHTML = '⏸ CUSTOM';

            switch (type) {
                case 'now':
                    isLive = true;
                    btnToggleLive.classList.add('active');
                    btnToggleLive.innerHTML = '● LIVE';
                    simDate = new Date();
                    break;
                case 'smith1939':
                    simDate = new Date(1939, 0, 1, 10, 30, 0);
                    break;
                case 'radar1944':
                    simDate = new Date(1944, 3, 4, 14, 15, 0); // April 4, 1944
                    break;
                case 'apollo1969':
                    simDate = new Date(1969, 6, 20, 20, 17, 0); // July 20, 1969
                    break;
                case 'tech1999':
                    simDate = new Date(1999, 0, 22, 9, 45, 0); // Jan 22, 1999
                    break;
                case 'y2k':
                    simDate = new Date(2000, 0, 1, 0, 0, 0);
                    break;
            }
            syncSlidersFromDate(simDate);
        };

        // Snapshot Export
        window.exportSnapshot = function() {
            const link = document.createElement('a');
            link.download = `smith-chart-clock-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        };

        // Wheel zooms about the cursor. The step is deliberately small so the
        // fine gradations can be crept up on rather than jumped past.
        canvas.addEventListener('wheel', e => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            zoomAbout(
                e.clientX - rect.left,
                e.clientY - rect.top,
                Math.exp(-e.deltaY * 0.0012)
            );
        }, { passive: false });

        // Drag to pan once zoomed in
        let dragging = null;
        canvas.addEventListener('mousedown', e => {
            const rect = canvas.getBoundingClientRect();
            dragging = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                panX: view.panX,
                panY: view.panY
            };
            canvas.style.cursor = 'grabbing';
        });

        window.addEventListener('mouseup', () => {
            dragging = null;
            canvas.style.cursor = 'crosshair';
        });

        canvas.addEventListener('dblclick', () => {
            resetView();
            const badge = document.getElementById('zoomBadge');
            if (badge) badge.textContent = '1.00×';
        });

        // Mouse hover probe on canvas
        canvas.addEventListener('mousemove', e => {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.clientX - rect.left;
            const clientY = e.clientY - rect.top;

            if (dragging) {
                view.panX = dragging.panX + (clientX - dragging.x);
                view.panY = dragging.panY + (clientY - dragging.y);
                applyView();
            }

            const polar = SmithMath.cartesianToPolar(clientX, clientY, centerX, centerY, scaleRadius);
            const gammaRe = polar.mag * Math.cos(polar.phase);
            const gammaIm = polar.mag * Math.sin(polar.phase);
            const imp = SmithMath.gammaToImpedance(gammaRe, gammaIm, config.z0);

            const vswr = polar.mag >= 0.999 ? '∞' : ((1 + polar.mag) / (1 - polar.mag)).toFixed(2);
            const angleDeg = (polar.phase * 180 / Math.PI).toFixed(1);

            probeGamma.textContent = `|Γ|: ${polar.mag.toFixed(3)} ∠ ${angleDeg}°`;
            probeZ.textContent = `Z: ${imp.R.toFixed(1)} ${imp.X >= 0 ? '+' : '-'} j${Math.abs(imp.X).toFixed(1)} Ω`;
            probeVswr.textContent = `VSWR: ${vswr} : 1`;
        });

