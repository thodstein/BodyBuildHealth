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
  const [display, setDisplay] = useState(0);
  const startTime = useRef<number | null>(null);
  const raf = useRef<number>(0);

  useEffect(() => {
    startTime.current = null;
    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;
      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      setDisplay(value * eased);
      if (progress < 1) {
        raf.current = requestAnimationFrame(animate);
      } else {
        setDisplay(value);
      }
    };
    raf.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);

  const formatted = decimals > 0 ? display.toFixed(decimals) : String(Math.round(display));

  return (
    <span className={className} style={{ display: 'inline-block', transition: 'opacity 0.3s', ...style }}>
      {prefix}{formatted}{suffix}
    </span>
  );
};
