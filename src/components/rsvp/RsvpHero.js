'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { WEDDING_EVENT } from '@/lib/rsvpConstants';
import '@/app/hero-animated.css';

export default function RsvpHero({ onScrollToForm }) {
  const containerRef = useRef(null);
  const stickyRef = useRef(null);
  const canvasRef = useRef(null);
  const [activeChapter, setActiveChapter] = useState(0);

  // Smooth scroll down to RSVP form or invitation panel
  const handleScrollToRsvp = useCallback((e) => {
    e.preventDefault();
    if (onScrollToForm) {
      onScrollToForm();
    } else {
      const target = document.getElementById('rsvp-form-section');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [onScrollToForm]);

  const handleScrollToNext = useCallback(() => {
    if (containerRef.current) {
      const bottom = containerRef.current.offsetTop + containerRef.current.offsetHeight;
      window.scrollTo({ top: bottom + 20, behavior: 'smooth' });
    }
  }, []);

  const handleJumpToBeat = useCallback((ratio) => {
    if (containerRef.current) {
      const top = containerRef.current.offsetTop;
      const totalScrollable = containerRef.current.offsetHeight - window.innerHeight;
      window.scrollTo({ top: top + totalScrollable * ratio, behavior: 'smooth' });
    }
  }, []);

  // 1. GSAP ScrollTrigger Storyboard Timeline
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      // Main Scrubbed Timeline
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: 'bottom bottom',
          pin: stickyRef.current,
          scrub: 1,
          anticipatePin: 1,
          onUpdate: (self) => {
            const p = self.progress;
            if (p < 0.38) setActiveChapter(0);
            else if (p < 0.76) setActiveChapter(1);
            else setActiveChapter(2);
          },
        },
      });

      // ----------------------------------------------------
      // PHASE 1: THE APPROACH & RING VOW (0.0 -> 0.38)
      // ----------------------------------------------------

      // Initial Cue fades out immediately upon scrolling
      tl.to('.hero-s1-intro-cue', {
        opacity: 0,
        y: -20,
        duration: 0.05,
        ease: 'power1.out',
      }, 0);

      // Background subtle zoom & pan
      tl.to('.hero-s1-bg', {
        scale: 1.15,
        yPercent: 4,
        duration: 0.38,
        ease: 'none',
      }, 0);

      // Groom walks from left toward center
      tl.fromTo('.hero-char-groom',
        { xPercent: -120, opacity: 0 },
        { xPercent: 0, opacity: 1, duration: 0.20, ease: 'power2.out' },
        0
      );

      // Bride walks from right toward center
      tl.fromTo('.hero-char-bride',
        { xPercent: 120, opacity: 0 },
        { xPercent: 0, opacity: 1, duration: 0.20, ease: 'power2.out' },
        0
      );

      // Characters dissolve gracefully as hands close-up reveals
      tl.to(['.hero-char-groom', '.hero-char-bride'], {
        opacity: 0,
        scale: 1.06,
        duration: 0.08,
        ease: 'power2.inOut',
      }, 0.20);

      // Hands & Rings Close-up reveals as the focal point
      tl.fromTo('.hero-s1-hands-wrap',
        { scale: 0.82, opacity: 0, y: 20 },
        { scale: 1, opacity: 1, y: 0, duration: 0.12, ease: 'power2.out' },
        0.20
      );

      // Sparkle & Flare animation on wedding rings
      tl.fromTo('.hero-ring-sparkle',
        { scale: 0, rotation: -60, opacity: 0 },
        { scale: 1.5, rotation: 45, opacity: 1, duration: 0.10, stagger: 0.03, ease: 'back.out(2)' },
        0.24
      );

      // Seamless cross-fade from Hands to Twilight Garden (0.34 -> 0.44)
      tl.to('.hero-s1-hands-wrap', {
        opacity: 0,
        scale: 1.08,
        duration: 0.09,
        ease: 'power2.in',
      }, 0.34);

      tl.to('.hero-s1-bg-wrap', {
        opacity: 0,
        duration: 0.10,
        ease: 'power2.inOut',
      }, 0.35);

      // ----------------------------------------------------
      // PHASE 2: THE ENCHANTED TWILIGHT BANQUET (0.36 -> 0.78)
      // ----------------------------------------------------

      // Twilight Scene container fades in
      tl.to('.hero-s2', {
        opacity: 1,
        duration: 0.10,
        ease: 'power2.out',
      }, 0.36);

      // Starry sky background drift
      tl.fromTo('.hero-s2-bg',
        { scale: 1.15, yPercent: -4 },
        { scale: 1.0, yPercent: 2, duration: 0.42, ease: 'none' },
        0.36
      );

      // Grand Tree settles in with subtle depth
      tl.fromTo('.hero-s2-tree',
        { scale: 1.12, opacity: 0, y: -30 },
        { scale: 1.0, opacity: 1, y: 0, duration: 0.18, ease: 'power2.out' },
        0.38
      );

      // Foreground arch hangs in from top
      tl.fromTo('.hero-s2-arch',
        { yPercent: -25, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.18, ease: 'power2.out' },
        0.40
      );

      // Banquet Table glides up from bottom
      tl.fromTo('.hero-s2-table',
        { yPercent: 40, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.20, ease: 'power3.out' },
        0.44
      );

      // Cheering Guests pop up joyfully
      tl.fromTo('.hero-s2-guests',
        { yPercent: 30, scale: 0.9, opacity: 0 },
        { yPercent: 0, scale: 1, opacity: 1, duration: 0.20, ease: 'back.out(1.2)' },
        0.48
      );

      // ----------------------------------------------------
      // PHASE 3: GRAND WELCOME & RSVP CTA (0.74 -> 1.0)
      // ----------------------------------------------------

      // Settle the party layers slightly deeper for focus
      tl.to(['.hero-s2-table', '.hero-s2-guests'], {
        scale: 0.96,
        yPercent: 4,
        duration: 0.20,
        ease: 'power1.out',
      }, 0.74);

      // RSVP Floating Card glides into view
      tl.fromTo('.hero-rsvp-stage',
        { y: 50, opacity: 0, scale: 0.92 },
        { y: 0, opacity: 1, scale: 1, duration: 0.20, ease: 'back.out(1.3)' },
        0.74
      );

    }, containerRef);

    return () => {
      ctx.revert();
    };
  }, []);

  // 2. Firefly Particle Canvas Simulation (Optimized 60fps)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Generate Fireflies
    const count = window.innerWidth < 768 ? 22 : 45;
    const fireflies = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: 1.5 + Math.random() * 2.8,
      speedX: (Math.random() - 0.5) * 0.45,
      speedY: -0.2 - Math.random() * 0.55,
      alpha: 0.2 + Math.random() * 0.7,
      pulseSpeed: 0.015 + Math.random() * 0.03,
      pulse: Math.random() * Math.PI * 2,
    }));

    let isVisible = true;
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    }, { threshold: 0.05 });

    if (containerRef.current) observer.observe(containerRef.current);

    const render = () => {
      if (isVisible) {
        ctx.clearRect(0, 0, width, height);

        fireflies.forEach((f) => {
          f.x += f.speedX + Math.sin(f.pulse) * 0.3;
          f.y += f.speedY;
          f.pulse += f.pulseSpeed;

          // Wrap edges
          if (f.y < -20) f.y = height + 10;
          if (f.x < -20) f.x = width + 10;
          if (f.x > width + 20) f.x = -10;

          const currentAlpha = Math.max(0.1, Math.min(1, f.alpha + Math.sin(f.pulse) * 0.35));

          // Draw Glowing Firefly
          const gradient = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.size * 4);
          gradient.addColorStop(0, `rgba(255, 235, 140, ${currentAlpha})`);
          gradient.addColorStop(0.3, `rgba(245, 195, 80, ${currentAlpha * 0.7})`);
          gradient.addColorStop(1, 'rgba(235, 175, 45, 0)');

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.size * 4, 0, Math.PI * 2);
          ctx.fill();

          // Intense core
          ctx.fillStyle = `rgba(255, 255, 255, ${currentAlpha})`;
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.size * 0.7, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, []);

  const chapters = [
    { label: 'Gặp Gỡ & Kết Duyên', ratio: 0.18 },
    { label: 'Tiệc Cưới Sân Vườn', ratio: 0.58 },
    { label: 'Xác Nhận Tham Dự', ratio: 0.92 },
  ];

  return (
    <section className="hero-story-container" id="rsvp-animated-hero" ref={containerRef} aria-label="Animated Wedding Invitation Story">
      <div className="hero-sticky-stage" ref={stickyRef}>

        {/* ---------------------------------------------------------------- */}
        {/* SCENE 1: THE SUNSET ENCOUNTER & RING VOW */}
        {/* ---------------------------------------------------------------- */}
        <div className="hero-layer hero-s1">
          {/* Background Landscape */}
          <div className="hero-s1-bg-wrap">
            <Image
              src="/images/hero-animated/scene1-bg.webp"
              alt="Hoàng hôn thơ mộng sân vườn tiệc cưới"
              fill
              priority
              className="hero-s1-bg"
              sizes="100vw"
            />
            <div className="hero-s1-warm-overlay" />
          </div>

          {/* Initial Scroll Cue */}
          <div className="hero-s1-intro-cue">
            <div className="hero-s1-intro-badge">
              <span>✦</span>
              <span>Thiệp Cưới Hoàng &amp; Duyên</span>
              <span>✦</span>
            </div>
            <p className="hero-s1-intro-hint">Cuộn chuột để mở thiệp cưới</p>
            <div className="hero-s1-scroll-arrow" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19 12 12 19 5 12" />
              </svg>
            </div>
          </div>

          {/* Walking Characters */}
          <div className="hero-characters-wrap">
            {/* Groom from left */}
            <img
              src="/images/hero-animated/groom.webp"
              alt="Chú rể Hoàng"
              className="hero-char hero-char-groom"
            />
            {/* Bride from right */}
            <img
              src="/images/hero-animated/bride.webp"
              alt="Cô dâu Duyên"
              className="hero-char hero-char-bride"
            />
          </div>

          {/* Hands & Rings Spotlight Reveal */}
          <div className="hero-s1-hands-wrap">
            <div className="hero-s1-hands-card">
              <img
                src="/images/hero-animated/ring-hands.webp"
                alt="Đôi bàn tay đan chặt mang nhẫn cưới hạnh phúc"
                className="hero-s1-hands-img"
              />

              {/* Sparkle on Groom's Ring */}
              <div className="hero-ring-sparkle hero-ring-sparkle--groom" aria-hidden="true">
                <div className="sparkle-cross" />
                <div className="sparkle-flare" />
                <div className="sparkle-flare sparkle-flare--vert" />
                <div className="sparkle-flare sparkle-flare--diag" />
              </div>

              {/* Sparkle on Bride's Ring */}
              <div className="hero-ring-sparkle hero-ring-sparkle--bride" aria-hidden="true">
                <div className="sparkle-cross" />
                <div className="sparkle-flare" />
                <div className="sparkle-flare sparkle-flare--vert" />
                <div className="sparkle-flare sparkle-flare--diag" />
              </div>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* SCENE 2: ENCHANTED TWILIGHT GARDEN BANQUET */}
        {/* ---------------------------------------------------------------- */}
        <div className="hero-layer hero-s2">
          {/* Starry Night Sky Background */}
          <div className="hero-s2-bg-wrap">
            <Image
              src="/images/hero-animated/scene2-bg.webp"
              alt="Bầu trời đêm tiệc cưới sân vườn lung linh"
              fill
              className="hero-s2-bg"
              sizes="100vw"
            />
            <div className="hero-lantern-ambient-glow" />
          </div>

          {/* Grand Ancient Tree with Mason Jar Lanterns */}
          <div className="hero-s2-tree-wrap">
            <img
              src="/images/hero-animated/grand-tree.webp"
              alt="Cây đại thụ giăng đèn lãng mạn"
              className="hero-s2-tree"
            />
          </div>

          {/* Cheering & Toasting Guests */}
          <div className="hero-s2-guests-wrap">
            <img
              src="/images/hero-animated/guests.webp"
              alt="Khách mời vui vẻ nâng ly chúc phúc"
              className="hero-s2-guests"
            />
          </div>

          {/* Rustic Banquet Table */}
          <div className="hero-s2-table-wrap">
            <img
              src="/images/hero-animated/banquet-table.webp"
              alt="Bàn tiệc cưới gỗ mộc ngoài trời đầy hoa và nến"
              className="hero-s2-table"
            />
          </div>

          {/* Hanging Ivy & Flower Arch Foreground */}
          <div className="hero-s2-arch-wrap">
            <img
              src="/images/hero-animated/foreground-arch.webp"
              alt="Vòm hoa lá rủ tiền cảnh"
              className="hero-s2-arch"
            />
          </div>

          {/* Firefly Particle Layer */}
          <canvas ref={canvasRef} className="hero-firefly-canvas" />

          {/* -------------------------------------------------------------- */}
          {/* SCENE 4: GRAND WELCOME & RSVP CALL-TO-ACTION */}
          {/* -------------------------------------------------------------- */}
          <div className="hero-rsvp-stage">
            <div className="hero-rsvp-card">
              <div className="hero-rsvp-badge">
                <span>✦</span>
                <span>Lời Ngỏ Từ Hoàng &amp; Duyên</span>
                <span>✦</span>
              </div>
              <h2 className="hero-rsvp-title">
                Bạn Sẽ Đến Chung Vui Cùng Tụi Mình Chứ?
              </h2>
              <p className="hero-rsvp-subtitle">
                {WEDDING_EVENT.dateDisplay} · {WEDDING_EVENT.venueName}, TP. Hồ Chí Minh
              </p>
              <div className="hero-rsvp-btn-row">
                <button
                  type="button"
                  onClick={handleScrollToRsvp}
                  className="hero-rsvp-btn-main"
                >
                  <div className="hero-rsvp-btn-shimmer" />
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span>Xác Nhận Tham Dự Ngay</span>
                </button>

                <button
                  type="button"
                  onClick={handleScrollToNext}
                  className="hero-rsvp-btn-sec"
                >
                  <span>Xem thiệp mời chi tiết</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <polyline points="19 12 12 19 5 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* STORY CHAPTER PROGRESS DOTS */}
        {/* ---------------------------------------------------------------- */}
        <nav className="hero-progress-nav" aria-label="Tiến trình câu chuyện">
          {chapters.map((ch, idx) => (
            <button
              key={idx}
              type="button"
              className={`hero-progress-dot ${activeChapter === idx ? 'hero-progress-dot--active' : ''}`}
              onClick={() => handleJumpToBeat(ch.ratio)}
              aria-label={ch.label}
            >
              <span className="hero-progress-dot-tooltip">{ch.label}</span>
            </button>
          ))}
        </nav>

      </div>
    </section>
  );
}
