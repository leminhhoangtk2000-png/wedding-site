'use client';

import { useEffect, useRef } from 'react';
import { animate } from 'animejs';

export default function FloatingDecor() {
  const containerRef = useRef(null);

  useEffect(() => {
    // Check user preference for reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const container = containerRef.current;
    if (!container) return;

    // Petal SVGs & spark shapes
    const petalColors = ['#e8b4b8', '#f3d1d5', '#d4a373', '#faedcd', '#eed7c5'];
    const count = 16;
    const animations = [];
    const elements = [];

    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'floating-petal';
      const isSpark = i % 4 === 0;
      const size = isSpark ? Math.random() * 6 + 4 : Math.random() * 14 + 10;
      const color = petalColors[Math.floor(Math.random() * petalColors.length)];

      el.style.position = 'fixed';
      el.style.pointerEvents = 'none';
      el.style.zIndex = '2';
      el.style.width = `${size}px`;
      el.style.height = `${size * (isSpark ? 1 : 1.4)}px`;
      el.style.borderRadius = isSpark ? '50%' : '50% 0 50% 50%';
      el.style.backgroundColor = color;
      el.style.opacity = '0';
      el.style.boxShadow = isSpark ? `0 0 10px ${color}` : 'none';
      el.style.filter = isSpark ? 'blur(0.5px)' : 'none';
      el.style.top = '-40px';
      el.style.left = `${Math.random() * 100}vw`;

      container.appendChild(el);
      elements.push(el);

      const startDelay = Math.random() * 6000;
      const duration = Math.random() * 8000 + 9000;
      const swayDistance = (Math.random() - 0.5) * 160;

      // Anime.js v4 animation
      const anim = animate(el, {
        translateY: [
          { to: '105vh', ease: 'linear' },
        ],
        translateX: [
          { to: swayDistance * 0.5, ease: 'sine.inOut', duration: duration * 0.4 },
          { to: -swayDistance * 0.5, ease: 'sine.inOut', duration: duration * 0.6 },
        ],
        rotate: [
          { to: Math.random() * 360, ease: 'linear', duration: duration },
        ],
        opacity: [
          { to: Math.random() * 0.35 + 0.15, duration: 1500, ease: 'quad.out' },
          { to: 0, duration: 1800, delay: duration - 1800, ease: 'quad.in' },
        ],
        duration: duration,
        delay: startDelay,
        loop: true,
      });

      animations.push(anim);
    }

    return () => {
      animations.forEach(anim => {
        if (anim && typeof anim.revert === 'function') {
          anim.revert();
        }
      });
      elements.forEach(el => el.remove());
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="floating-decor-container"
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 2,
        overflow: 'hidden',
      }}
    />
  );
}
