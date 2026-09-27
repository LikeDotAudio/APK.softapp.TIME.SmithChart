/**
 * Mouse and wheel on the canvas: wheel zooms about the pointer, drag pans,
 * double-click resets. Returns the function that unwires it all again.
 */

import type { ChartGeometry } from './geometry';

export function attachViewControls(canvas: HTMLCanvasElement, geo: ChartGeometry): () => void {
    let dragFrom: { x: number; y: number; panX: number; panY: number } | null = null;

    const onWheel = (e: WheelEvent): void => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        // A small step, so the fine gradations can be crept up on
        geo.zoomAbout(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0012));
    };

    const onPointerDown = (e: MouseEvent): void => {
        const rect = canvas.getBoundingClientRect();
        dragFrom = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            panX: geo.view.panX,
            panY: geo.view.panY
        };
    };

    const onPointerMove = (e: MouseEvent): void => {
        if (!dragFrom) return;
        const rect = canvas.getBoundingClientRect();
        geo.view.panX = dragFrom.panX + (e.clientX - rect.left - dragFrom.x);
        geo.view.panY = dragFrom.panY + (e.clientY - rect.top - dragFrom.y);
        geo.applyView();
    };

    const onPointerUp = (): void => {
        dragFrom = null;
    };

    const onDoubleClick = (): void => {
        geo.resetView();
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('mousemove', onPointerMove);
    canvas.addEventListener('dblclick', onDoubleClick);
    window.addEventListener('mouseup', onPointerUp);

    return (): void => {
        canvas.removeEventListener('wheel', onWheel);
        canvas.removeEventListener('mousedown', onPointerDown);
        canvas.removeEventListener('mousemove', onPointerMove);
        canvas.removeEventListener('dblclick', onDoubleClick);
        window.removeEventListener('mouseup', onPointerUp);
    };
}
