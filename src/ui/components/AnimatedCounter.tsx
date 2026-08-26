import React, { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
  value: number;
  decimals?: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  style?: React.CSSProperties;
  className?: string;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  decimals = 1,
  duration = 600,
  suffix = '',
  prefix = '',
  style,
  className,
}) => {
  const spanRef = useRef<HTMLSpanElement>(null);
  const raf = useRef<number>(0);
  const startTime = useRef<number | null>(null);
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
    // respect reduced motion — no animation
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        if (spanRef.current) {
          const formatted = decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
          spanRef.current.textContent = `${prefix}${formatted}${suffix}`;
        }
        return;
      }
    } catch {}
    // lightweight duration cap for many counters
    const dur = Math.min(duration, 500);
    startTime.current = null;
    const animate = (timestamp: number) => {
      if (startTime.current == null) startTime.current = timestamp;
      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / dur, 1);
      const eased = easeOutCubic(progress);
      const cur = valueRef.current * eased;
      const formatted = decimals > 0 ? cur.toFixed(decimals) : String(Math.round(cur));
      if (spanRef.current) spanRef.current.textContent = `${prefix}${formatted}${suffix}`;
      if (progress < 1) {
        raf.current = requestAnimationFrame(animate);
      } else if (spanRef.current) {
        const finalFormatted = decimals > 0 ? valueRef.current.toFixed(decimals) : String(Math.round(valueRef.current));
        spanRef.current.textContent = `${prefix}${finalFormatted}${suffix}`;
      }
    };
    raf.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf.current);
  }, [value, decimals, duration, prefix, suffix]);

  // initial render shows final value until effect runs (no flash)
  const initial = decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
  return (
    <span ref={spanRef} className={className} style={{ display: 'inline-block', ...style }}>
      {prefix}{initial}{suffix}
    </span>
  );
};
