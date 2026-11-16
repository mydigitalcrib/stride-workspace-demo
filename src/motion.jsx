import { useEffect, useRef, useState } from 'react';

// Small pieces of motion for the Glass look. Everything here stays still for people whose computer asks
// for less motion (Windows: Settings > Accessibility > Visual effects > Animation effects).

export const prefersReducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** A whole number that counts up to its value when it first appears, and glides to new values. */
export function CountUp({ value, duration = 800 }) {
  const target = Number(value);
  const animate = Number.isInteger(target) && !prefersReducedMotion();
  const [shown, setShown] = useState(animate ? 0 : value);
  const current = useRef(animate ? 0 : target);

  useEffect(() => {
    if (!animate) {
      current.current = target;
      setShown(value);
      return undefined;
    }
    const from = current.current;
    const start = performance.now();
    let frame;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const next = Math.round(from + (target - from) * (1 - (1 - t) ** 3));
      current.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, value, animate, duration]);

  return shown;
}

// The same specks every time, so the background doesn't jump around between visits.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Tiny specks of light drifting slowly down behind the glass. Drawn on a canvas about 30 times a second,
 * paused while the tab is hidden, and drawn once (still) when less motion is preferred.
 */
export function GlassBackdrop({ mode }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return undefined;
    const still = prefersReducedMotion();
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const rand = seeded(7);
    const specks = Array.from({ length: 44 }, () => ({
      x: rand(),
      y: rand(),
      r: 0.5 + rand() * 1.2,
      alpha: 0.12 + rand() * 0.38,
      speed: 0.005 + rand() * 0.016, // share of the screen height per second
      phase: rand() * Math.PI * 2,
    }));
    const rgb = mode === 'dark' ? '255,255,255' : '60,60,66';
    const strength = mode === 'dark' ? 1 : 0.55;
    let width = 0;
    let height = 0;
    let frame = 0;
    let last = 0;

    const draw = (time) => {
      ctx.clearRect(0, 0, width, height);
      const seconds = time / 1000;
      for (const s of specks) {
        const y = ((s.y + seconds * s.speed) % 1) * (height + 20) - 10;
        const x = s.x * width + Math.sin(seconds / 4 + s.phase) * 12;
        const twinkle = 0.7 + 0.3 * Math.sin(seconds * 0.8 + s.phase * 3);
        ctx.fillStyle = `rgba(${rgb},${(s.alpha * twinkle * strength).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw(last || performance.now());
    };
    const loop = (now) => {
      frame = requestAnimationFrame(loop);
      if (now - last < 33) return;
      last = now;
      draw(now);
    };
    const onVisibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden && !still) frame = requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    if (!still) frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [mode]);

  return <canvas ref={canvasRef} className="glassSpecks" aria-hidden="true" />;
}
