'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * ScrollReveal wrapper component.
 * Uses IntersectionObserver to fade-in children when they enter the viewport.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Content to reveal
 * @param {number} [props.delay=0] - Delay class index (1-4) for staggered reveals
 * @param {'up'|'left'|'right'|'scale'} [props.direction='up'] - Direction of reveal animation
 * @param {number} [props.threshold=0.15] - IntersectionObserver threshold
 * @param {string} [props.className] - Additional CSS classes
 */
export default function ScrollReveal({
  children,
  delay = 0,
  direction = 'up',
  threshold = 0.15,
  className = '',
}) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(element);
        }
      },
      {
        threshold,
        rootMargin: '0px 0px -50px 0px',
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [threshold]);

  const directionClass = {
    up: '',
    left: 'scroll-reveal--from-left',
    right: 'scroll-reveal--from-right',
    scale: 'scroll-reveal--scale',
  }[direction] || '';

  const delayClass = delay > 0 ? `scroll-reveal--delay-${Math.min(delay, 4)}` : '';

  return (
    <div
      ref={ref}
      className={`scroll-reveal ${directionClass} ${delayClass} ${
        isVisible ? 'scroll-reveal--visible' : ''
      } ${className}`.trim()}
    >
      {children}
    </div>
  );
}
