'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import gsap from 'gsap';
import { WEDDING_EVENT } from '@/lib/rsvpConstants';
import styles from '@/app/rsvp/rsvp.module.css';

export default function RsvpHero({ onScrollToForm }) {
  const heroRef = useRef(null);
  const heartRef = useRef(null);
  const [isOpened, setIsOpened] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });
  const [hasInteracted, setHasInteracted] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  const handleOpen = () => {
    setIsOpened(true);
    setHasInteracted(true);

    if (heartRef.current) {
      gsap.to(heartRef.current, {
        yPercent: -24,
        scale: 1.04,
        rotation: -0.5,
        duration: 1.2,
        ease: 'power3.out',
      });
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    // Auto-reveal card smoothly after initial entrance
    const timer = setTimeout(() => {
      handleOpen();
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  const handleToggle = () => {
    if (!isOpened) {
      handleOpen();
    } else {
      setIsOpened(false);
      if (heartRef.current) {
        gsap.to(heartRef.current, {
          yPercent: 42,
          scale: 0.85,
          rotation: 0,
          duration: 0.8,
          ease: 'power2.inOut',
        });
      }
    }
  };

  const handleReplay = () => {
    setIsOpened(false);
    if (heartRef.current) {
      gsap.set(heartRef.current, { yPercent: 42, scale: 0.85, rotation: 0 });
      setTimeout(() => {
        handleOpen();
      }, 300);
    }
  };

  const handleScrollDown = (e) => {
    e.preventDefault();
    if (onScrollToForm) {
      onScrollToForm();
    } else {
      const el = document.getElementById('rsvp-timeline-section') || document.getElementById('rsvp-form-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <section className={styles.rsvpHero} ref={heroRef} aria-label="Wedding invitation interactive envelope">
      {/* Atmosphere: Candlelight glow & Ambient banquet scene */}
      <div className={styles.heroAtmosphere}>
        <div className={styles.heroCandlelightGlow} aria-hidden="true" />
      </div>

      {/* Motion Controls: Replay */}
      <div className={styles.motionControls}>
        {hasInteracted && (
          <button
            type="button"
            className={styles.motionButton}
            onClick={handleReplay}
            aria-label="Replay invitation envelope opening"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            <span>Replay</span>
          </button>
        )}
      </div>

      {/* Central Envelope & Heart Lace Doily Interactive Stage */}
      <div className={styles.envelopeStage}>
        <div
          className={styles.envelopeContainer}
          onClick={handleToggle}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleToggle();
            }
          }}
          aria-label={isOpened ? 'Envelope opened with heart lace card. Click to close' : 'Click to open wedding invitation envelope'}
          aria-expanded={isOpened}
        >
          {/* Layer 1: Envelope Back + Open Flap with Gold Foil Lining */}
          <Image
            src="/rsvp/envelope_back.webp"
            alt="Powder blue envelope opened with gleaming gold foil lining"
            fill
            sizes="(max-width: 640px) 90vw, 440px"
            priority
            unoptimized
            className={styles.envelopeBackImage}
          />

          {/* Layer 2: Heart-Shaped Lace Doily Card (Slides up from inside the pocket) */}
          <div
            ref={heartRef}
            className={`${styles.heartCardWrapper} ${isOpened ? styles.heartCardOpened : ''}`}
          >
            <Image
              src="/rsvp/heart_lace.webp"
              alt="Heart-shaped white lace doily invitation card"
              fill
              sizes="(max-width: 640px) 75vw, 360px"
              priority
              unoptimized
              className={styles.heartLaceBg}
            />

            {/* Inner Content on the Heart Card */}
            <div className={styles.heartCardContent}>
              <h1 className={styles.heartSaveTheDate}>Save the Date</h1>
              <div className={styles.heartDate}>03 · 10 · 2026</div>

              <div className={styles.heartDivider}>
                <div className={styles.heartDividerLine} />
                <span className={styles.heartDividerIcon} aria-hidden="true">✦</span>
                <div className={styles.heartDividerLine} />
              </div>

              <div className={styles.heartCouple}>{WEDDING_EVENT.couple}</div>

              <div className={styles.heartVenueBlock}>
                <div className={styles.heartVenue}>Hidden Haven · Bình Quới</div>
              </div>
            </div>
          </div>

          {/* Layer 3: Envelope Front Pocket (Layers in front of the lower half of the card) */}
          <Image
            src="/rsvp/envelope_pocket.webp"
            alt=""
            fill
            sizes="(max-width: 640px) 90vw, 440px"
            priority
            unoptimized
            className={styles.envelopePocketImage}
            aria-hidden="true"
          />

          {/* Layer 4: "Click to Open" Script prompt on the front pocket */}
          <div className={`${styles.clickToOpenPrompt} ${isOpened ? styles.clickToOpenHidden : ''}`}>
            <span className={styles.clickToOpenScript}>Click to Open</span>
            <span className={styles.clickToOpenPulsingHint}>Tap envelope 💌</span>
          </div>
        </div>

        {/* Bottom CTA Action Button */}
        <div className={styles.heroBottomAction}>
          <a
            href="#rsvp-timeline-section"
            onClick={handleScrollDown}
            className={styles.heroRsvpButton}
            aria-label="Scroll down to wedding timeline and RSVP form"
          >
            <span>RSVP Now</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <polyline points="19 12 12 19 5 12" />
            </svg>
          </a>
          <span className={styles.heroScrollHint}>
            Scroll down to explore schedule &amp; RSVP
          </span>
        </div>
      </div>
    </section>
  );
}
