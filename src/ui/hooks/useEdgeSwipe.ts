import { useRef } from "react";

type SwipeHandlers = {
    onTouchStart: (event: React.TouchEvent) => void;
    onTouchMove: (event: React.TouchEvent) => void;
    onTouchEnd: (event: React.TouchEvent) => void;
};

/**
 * Detects a left-to-right horizontal swipe and fires `onSwipeRight`, the
 * standard gesture for revealing a navigation drawer. Returns touch handlers to
 * spread onto the element that should listen.
 *
 * The swipe must start within `edgeWidth` px of the left. Pass a large value
 * (e.g. Infinity) to allow the gesture to start anywhere on screen. The
 * vertical-abort and `threshold` checks keep it from interfering with vertical
 * scrolling or small horizontal jitter.
 */
export function useEdgeSwipe({
    onSwipeRight,
    edgeWidth = 28,
    threshold = 56,
    enabled = true,
}: {
    onSwipeRight: () => void;
    edgeWidth?: number;
    threshold?: number;
    enabled?: boolean;
}): SwipeHandlers {
    const start = useRef<{ x: number; y: number } | null>(null);
    const tracking = useRef(false);

    const onTouchStart = (event: React.TouchEvent) => {
        if (!enabled || event.touches.length !== 1) {
            tracking.current = false;
            start.current = null;
            return;
        }
        const touch = event.touches[0];
        if (touch.clientX <= edgeWidth) {
            start.current = { x: touch.clientX, y: touch.clientY };
            tracking.current = true;
        } else {
            tracking.current = false;
            start.current = null;
        }
    };

    const onTouchMove = (event: React.TouchEvent) => {
        if (!tracking.current || !start.current) return;
        const touch = event.touches[0];
        const dx = touch.clientX - start.current.x;
        const dy = touch.clientY - start.current.y;
        // Abort once the gesture is clearly more vertical than horizontal.
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) {
            tracking.current = false;
            start.current = null;
        }
    };

    const onTouchEnd = (event: React.TouchEvent) => {
        if (!tracking.current || !start.current) return;
        const touch = event.changedTouches[0];
        const dx = touch.clientX - start.current.x;
        const dy = touch.clientY - start.current.y;
        if (dx >= threshold && Math.abs(dx) > Math.abs(dy)) {
            onSwipeRight();
        }
        tracking.current = false;
        start.current = null;
    };

    return { onTouchStart, onTouchMove, onTouchEnd };
}
