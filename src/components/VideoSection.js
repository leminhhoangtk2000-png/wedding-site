'use client';

import { useState, useEffect, useRef } from 'react';
import Script from 'next/script';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { animate } from 'animejs';

export default function VideoSection() {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const sectionRef = useRef(null);
  const iframeRef = useRef(null);
  const playBtnRef = useRef(null);

  // Scroll entrance animation using GSAP
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      gsap.from('.video-section__header', {
        y: 40,
        opacity: 0,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 80%',
          toggleActions: 'play none none reverse',
        },
      });

      gsap.from('.video-card-wrapper', {
        y: 50,
        opacity: 0,
        scale: 0.96,
        duration: 1.1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 75%',
          toggleActions: 'play none none reverse',
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  // Anime.js ripple wave on play button
  useEffect(() => {
    if (isVideoPlaying) return;

    let anim = null;
    try {
      anim = animate('.video-play-ripple', {
        scale: [1, 1.85],
        opacity: [0.65, 0],
        duration: 2200,
        delay: (el, i) => i * 1100,
        ease: 'quad.out',
        loop: true,
      });
    } catch (e) {
      console.error(e);
    }

    return () => {
      if (anim && typeof anim.revert === 'function') {
        anim.revert();
      }
    };
  }, [isVideoPlaying]);

  // Initialize Vimeo player when iframe is loaded
  useEffect(() => {
    if (isVideoPlaying && iframeRef.current && window.Vimeo) {
      const player = new window.Vimeo.Player(iframeRef.current);
      player.on('play', () => {
        window.dispatchEvent(new Event('pause-bg-music'));
      });
      player.on('pause', () => {
        window.dispatchEvent(new Event('play-bg-music'));
      });
      player.on('ended', () => {
        window.dispatchEvent(new Event('play-bg-music'));
      });
    }
  }, [isVideoPlaying]);

  const handleStartVideo = () => {
    if (playBtnRef.current) {
      animate(playBtnRef.current, {
        scale: [1, 0.85, 1.1, 0],
        opacity: [1, 0],
        duration: 350,
        ease: 'spring(1, 80, 10, 0)',
        onComplete: () => {
          setIsVideoPlaying(true);
          window.dispatchEvent(new Event('pause-bg-music'));
        },
      });
    } else {
      setIsVideoPlaying(true);
      window.dispatchEvent(new Event('pause-bg-music'));
    }
  };

  return (
    <section className="video-section reveal" id="prewedding-film" ref={sectionRef}>
      {/* Background ambient lighting effects */}
      <div className="video-section__ambient-glow" aria-hidden="true" />

      <div className="video-section__container">
        {/* Header introducing the film */}
        <div className="video-section__header">
          <h2 className="video-section__title">
            Chuyện Tụi Mình Trong Từng Thước Phim
          </h2>
        </div>

        {/* Video Card Frame */}
        <div className="video-card-wrapper">
          <div className="video-card-frame">
            {!isVideoPlaying ? (
              <div 
                onClick={handleStartVideo}
                className="video-facade"
                role="button"
                tabIndex={0}
                aria-label="Phát video Pre-Wedding Hoàng và Duyên"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleStartVideo();
                  }
                }}
              >
                {/* Facade image with zoom effect */}
                <div 
                  className="video-facade__image" 
                  style={{ backgroundImage: 'url(/images/000069-2.webp)' }}
                />

                {/* Cinematic Vignette Overlay */}
                <div className="video-facade__overlay" />

                {/* Aesthetic Film Badge */}
                <div className="video-facade__tag">
                  <span>PROJECT 69 • 4:3 FILM</span>
                </div>

                {/* Pulsing Interactive Play Button */}
                <div className="video-play-center">
                  <div className="video-play-ripple video-play-ripple--1" />
                  <div className="video-play-ripple video-play-ripple--2" />
                  <div className="video-play-btn" ref={playBtnRef}>
                    <svg 
                      width="30" 
                      height="30" 
                      viewBox="0 0 24 24" 
                      fill="currentColor" 
                      stroke="currentColor" 
                      strokeWidth="1"
                      className="video-play-icon"
                    >
                      <polygon points="6 4 20 12 6 20 6 4" />
                    </svg>
                  </div>
                </div>
              </div>
            ) : (
              <iframe 
                ref={iframeRef}
                src="https://player.vimeo.com/video/1206395637?badge=0&autopause=0&player_id=0&app_id=58479&autoplay=1&loop=1&muted=0" 
                frameBorder="0" 
                allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share" 
                referrerPolicy="strict-origin-when-cross-origin" 
                className="video-iframe"
                title="PreWedding HOANG&DUYEN: Project 69"
                loading="lazy"
              />
            )}
          </div>
        </div>
      </div>

      {/* Architectural Curve Divider (Phương án 3) */}
      <div className="video-section__divider" aria-hidden="true">
        <svg 
          viewBox="0 0 1440 80" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          className="video-section__curve-svg"
        >
          <path 
            d="M0,60 Q720,0 1440,60 L1440,80 L0,80 Z" 
            fill="var(--color-bg)" 
          />
          <path 
            d="M0,60 Q720,0 1440,60" 
            stroke="rgba(201, 169, 110, 0.4)" 
            strokeWidth="1.5" 
            fill="none" 
          />
        </svg>
      </div>

      {isVideoPlaying && (
        <Script src="https://player.vimeo.com/api/player.js" strategy="lazyOnload" />
      )}
    </section>
  );
}
