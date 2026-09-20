'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import gsap from 'gsap';
import { WEDDING_EVENT } from '@/lib/rsvpConstants';
import styles from '@/app/rsvp/rsvp.module.css';

export default function RsvpHero({ onScrollToForm }) {
  const heroRef = useRef(null);
  const timelineRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        paused: false,
        onComplete: () => {
          setIsPlaying(false);
          setIsCompleted(true);
        },
      });

      timelineRef.current = tl;

      if (prefersReducedMotion) {
        // Under prefers-reduced-motion, render final state immediately with gentle fade
        gsap.set(['.hero-invitation-card', '.hero-cta-wrap', '.hero-ribbon'], {
          opacity: 1,
          scale: 1,
          y: 0,
        });
        gsap.set(['.gate-left', '.gate-right'], {
          opacity: 0,
          scale: 1.1,
        });
        setIsPlaying(false);
        setIsCompleted(true);
        return;
      }

      // Initial state
      gsap.set('.hero-wash-bg', { opacity: 0 });
      gsap.set('.hero-venue-mid', { opacity: 0, scale: 1.15, filter: 'blur(8px)' });
      gsap.set('.gate-left', { xPercent: 0, opacity: 0 });
      gsap.set('.gate-right', { xPercent: 0, opacity: 0 });
      gsap.set('.hero-invitation-card', { opacity: 0, scale: 0.85, y: 30 });
      gsap.set('.hero-ribbon', { opacity: 0, y: -20 });
      gsap.set('.hero-reveal-text', { opacity: 0, y: 15 });
      gsap.set('.hero-cta-wrap', { opacity: 0, y: 20 });

      // Stage 1: 0 - 1.5s — Establishing watercolor wash
      tl.to('.hero-wash-bg', {
        opacity: 1,
        duration: 1.5,
        ease: 'power2.out',
      })
        .to(
          '.hero-venue-mid',
          {
            opacity: 0.85,
            scale: 1.05,
            filter: 'blur(0px)',
            duration: 3,
            ease: 'power1.out',
          },
          0.5
        )

        // Stage 2: 1.5 - 4.5s — Camera approach & foliage entrance reveals
        .to(
          ['.gate-left', '.gate-right'],
          {
            opacity: 1,
            duration: 1.5,
            ease: 'power2.out',
          },
          1.8
        )
        .to(
          '.hero-venue-mid',
          {
            scale: 1.0,
            duration: 3,
            ease: 'power1.inOut',
          },
          2.0
        )

        // Stage 3: 4.5 - 7.0s — Gate / foliage leaves part smoothly
        .to(
          '.gate-left',
          {
            xPercent: -85,
            opacity: 0.4,
            duration: 2.2,
            ease: 'power2.inOut',
          },
          4.5
        )
        .to(
          '.gate-right',
          {
            xPercent: 85,
            opacity: 0.4,
            duration: 2.2,
            ease: 'power2.inOut',
          },
          4.5
        )

        // Stage 4: 6.8 - 9.8s — Invitation card, ribbons, and date/names reveal
        .to(
          '.hero-invitation-card',
          {
            opacity: 1,
            scale: 1,
            y: 0,
            duration: 2.0,
            ease: 'back.out(1.1)',
          },
          6.5
        )
        .to(
          '.hero-ribbon',
          {
            opacity: 1,
            y: 0,
            duration: 1.2,
            stagger: 0.15,
            ease: 'power2.out',
          },
          7.2
        )
        .to(
          '.hero-reveal-text',
          {
            opacity: 1,
            y: 0,
            duration: 1.0,
            stagger: 0.2,
            ease: 'power2.out',
          },
          7.8
        )

        // Stage 5: 9.8 - 11.5s — CTA button settles
        .to(
          '.hero-cta-wrap',
          {
            opacity: 1,
            y: 0,
            duration: 1.2,
            ease: 'power2.out',
          },
          9.8
        );
    }, heroRef);

    return () => ctx.revert();
  }, []);

  const handleSkip = () => {
    if (timelineRef.current) {
      timelineRef.current.progress(1);
      setIsPlaying(false);
      setIsCompleted(true);
    }
  };

  const handleReplay = () => {
    if (timelineRef.current) {
      setIsCompleted(false);
      setIsPlaying(true);
      timelineRef.current.restart();
    }
  };

  const handleScrollToRsvp = (e) => {
    e.preventDefault();
    if (onScrollToForm) {
      onScrollToForm();
    } else {
      const el = document.getElementById('rsvp-form-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <section className={styles.rsvpHero} ref={heroRef} aria-label="Cinematic wedding invitation">
      {/* Motion Controls: Skip & Replay */}
      <div className={styles.motionControls}>
        {isPlaying && (
          <button
            type="button"
            className={styles.motionButton}
            onClick={handleSkip}
            aria-label="Skip animation"
          >
            <span>Skip</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 4 15 12 5 20 5 4" />
              <line x1="19" y1="5" x2="19" y2="19" />
            </svg>
          </button>
        )}
        {isCompleted && (
          <button
            type="button"
            className={styles.motionButton}
            onClick={handleReplay}
            aria-label="Replay invitation animation"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            <span>Replay</span>
          </button>
        )}
      </div>

      <div className={styles.heroStage}>
        {/* Layer 1: Watercolor wash background */}
        <div className={`${styles.heroWashBg} hero-wash-bg`} />

        {/* Layer 2: Midground venue photo / artistic illustration */}
        <div
          className={`${styles.heroVenueMidground} hero-venue-mid`}
          style={{ backgroundImage: 'url(/images/000064-3.webp)' }}
          aria-hidden="true"
        />

        {/* Layer 3: Left & Right Foliage / Gate layers parting */}
        <div
          className={`${styles.gateLeft} gate-left`}
          style={{
            backgroundImage: 'url(/rsvp/layers/vine_frame.png)',
            backgroundSize: '150% auto',
            backgroundPosition: 'left center',
          }}
          aria-hidden="true"
        />
        <div
          className={`${styles.gateRight} gate-right`}
          style={{
            backgroundImage: 'url(/rsvp/layers/vine_frame.png)',
            backgroundSize: '150% auto',
            backgroundPosition: 'right center',
          }}
          aria-hidden="true"
        />

        {/* Layer 4: Center Invitation Card */}
        <div className={`${styles.heroInvitationCard} hero-invitation-card`}>
          {/* Hand-drawn Green Vine Frame */}
          <Image
            src="/rsvp/layers/vine_frame.png"
            alt=""
            fill
            sizes="(max-width: 768px) 90vw, 460px"
            priority
            className={styles.cardVineOverlay}
            aria-hidden="true"
          />

          {/* Top Ribbons */}
          <Image
            src="/rsvp/layers/ribbon_left.png"
            alt=""
            width={120}
            height={180}
            className={`${styles.ribbonLeftCorner} hero-ribbon`}
            aria-hidden="true"
          />
          <Image
            src="/rsvp/layers/ribbon_right.png"
            alt=""
            width={100}
            height={180}
            className={`${styles.ribbonRightCorner} hero-ribbon`}
            aria-hidden="true"
          />

          {/* Typography reveal */}
          <div className={styles.heroCardContent}>
            <h1 className={`${styles.heroSaveTheDate} hero-reveal-text`}>Save The Date</h1>
            <div className={`${styles.heroDate} hero-reveal-text`}>October 3rd 2026</div>
            <div className={`${styles.heroCouple} hero-reveal-text`}>{WEDDING_EVENT.couple}</div>
            <div className={`${styles.heroVenue} hero-reveal-text`}>{WEDDING_EVENT.venueName}</div>
            <div className={`${styles.heroAddress} hero-reveal-text`}>393/21 Bình Quới</div>
          </div>

          {/* CTA Settle */}
          <div className={`${styles.heroCtaWrapper} hero-cta-wrap`}>
            <a
              href="#rsvp-form-section"
              onClick={handleScrollToRsvp}
              className={styles.heroCtaButton}
              aria-label="Scroll down to RSVP form"
            >
              <span>RSVP Now</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19 12 12 19 5 12" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
