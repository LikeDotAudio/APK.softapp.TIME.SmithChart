/**
 * The Date-DNA historical spiral: one turn per year, out from the centre.
 */

import type { CartesianCoordinate } from '../types';
import { computeDateDNA, spiralSegmentColour } from '../colour/engines';
import type { Layer } from './geometry';

/**
 * Draws the Historical Date-DNA Spiral
 */
export function drawHistoricalSpiral(layer: Layer, currentDate: Date): void {
    const { ctx, geo, options } = layer;
    if (!options.showHistoricalSpiral) return;

    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const currentDay = currentDate.getDate();

    const startYear = options.spiralStartYear;
    const endYear = Math.max(options.spiralEndYear, currentYear + 10);
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
            x: geo.centerX + (normalizedRadius * geo.scaleRadius * Math.cos(angle)),
            y: geo.centerY + (normalizedRadius * geo.scaleRadius * Math.sin(angle))
        };

        if (prevPoint) {
            // Compute Date-DNA color for this segment
            const simDate = new Date(simYearInt, 0, Math.max(1, simDayOfYear));
            ctx.strokeStyle = spiralSegmentColour(options.colorEngine, simDate, simYears);
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
        const dna = computeDateDNA(currentDate);
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
