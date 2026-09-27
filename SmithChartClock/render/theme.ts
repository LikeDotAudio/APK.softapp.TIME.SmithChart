/**
 * Every palette colour, named per theme: the base chart palette and the
 * overlay accents (strip, day path, VSWR rings, admittance) laid over it.
 */

import type { SmithChartClockOptions } from '../types';

type Theme = Required<SmithChartClockOptions>['theme'];

export interface ThemeColors {
    background: string;
    outerCircle: string;
    realAxis: string;
    gridMinor: string;
    gridMajor: string;
    text: string;
    hourHand: string;
    minuteHand: string;
    secondHand: string;
    compositeHand: string;
    centerDot: string;
    spiralGlow: string;
    spiralCore: string;
}

export interface OverlayColors extends ThemeColors {
    stripRule: string;
    stripTick: string;
    stripText: string;
    stripTitle: string;
    stripCursor: string;
    dayPathPast: string;
    dayPathFuture: string;
    vswrCircle: string;
    admittance: string;
}

/**
 * Get theme color palette
 */
export function themeColors(theme: Theme): ThemeColors {
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
 * Accent colours for the overlays that the base palette does not name.
 */
export function overlayColors(theme: Theme): OverlayColors {
    const base = themeColors(theme);
    const light = theme === 'smith-classic' || theme === 'solar-light';
    return {
        ...base,
        stripRule: light ? '#334155' : '#3f4c63',
        stripTick: light ? '#475569' : '#55657f',
        stripText: light ? '#0f172a' : '#9fb0c7',
        stripTitle: light ? '#1e293b' : '#cbd5e1',
        stripCursor: light ? '#dc2626' : '#f43f5e',
        dayPathPast: light ? '#0f766e' : '#22d3ee',
        dayPathFuture: light ? 'rgba(15, 118, 110, 0.22)' : 'rgba(34, 211, 238, 0.18)',
        vswrCircle: light ? 'rgba(220, 38, 38, 0.35)' : 'rgba(244, 63, 94, 0.35)',
        admittance: light ? 'rgba(124, 58, 237, 0.45)' : 'rgba(168, 85, 247, 0.4)'
    };
}
