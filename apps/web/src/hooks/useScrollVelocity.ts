import { useEffect, useRef } from 'react';

/**
 * Hook to track scroll velocity of a container.
 * Returns a ref to attach to the scrollable element and a CSS variable object
 * containing the smoothed velocity, perfect for applying spring-like CSS transforms.
 */
export function useScrollVelocity() {
    const scrollRef = useRef<HTMLDivElement>(null);
    const lastScrollY = useRef(0);
    const lastTime = useRef(0);
    const velocityRef = useRef(0);
    const rafId = useRef<number>();

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        let isScrolling = false;

        const handleScroll = () => {
            const now = performance.now();
            const currentScrollY = el.scrollTop;

            if (lastTime.current !== 0) {
                const dt = now - lastTime.current;
                const dy = currentScrollY - lastScrollY.current;

                if (dt > 0) {
                    // Calculate raw velocity (pixels per ms)
                    // Multiply by a larger factor to make the effect pronounced
                    const v = (dy / dt) * 15;

                    // Smooth the velocity (exponential moving average)
                    velocityRef.current = velocityRef.current * 0.2 + v * 0.8;

                    // Clamp velocity to prevent extreme distortion, but allow enough to be visible
                    const clamped = Math.max(-100, Math.min(100, velocityRef.current));
                    // Optional: round to 1 decimal place to prevent too many fractional DOM updates
                    el.style.setProperty('--scroll-velocity', `${clamped.toFixed(1)}px`);
                }
            }

            lastScrollY.current = currentScrollY;
            lastTime.current = now;
            isScrolling = true;

            // Start the decay loop if not already running
            if (!rafId.current) {
                decayVelocity();
            }
        };

        const decayVelocity = () => {
            if (!isScrolling) {
                // Decay velocity back to 0 when scrolling stops
                velocityRef.current *= 0.90; // Slower decay for more "elastic" feel

                if (Math.abs(velocityRef.current) < 0.5) {
                    velocityRef.current = 0;
                    el.style.setProperty('--scroll-velocity', '0px');
                    rafId.current = undefined;
                    return; // Stop the loop
                }
                el.style.setProperty('--scroll-velocity', `${velocityRef.current.toFixed(1)}px`);
            }

            isScrolling = false;
            rafId.current = requestAnimationFrame(decayVelocity);
        };

        el.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            el.removeEventListener('scroll', handleScroll);
            if (rafId.current) {
                cancelAnimationFrame(rafId.current);
            }
        };
    }, []);

    return {
        scrollRef,
        style: {} as React.CSSProperties,
    };
}
