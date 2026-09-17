'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { animate } from 'animejs';

export default function HeroSection() {
  const heroRef = useRef(null);
  const badgeTitleRef = useRef(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      // 1. Entrance timeline
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.from('.hero__image', {
        scale: 1.15,
        duration: 2.2,
        ease: 'power2.out',
      })
      .from('.hero__overlay', {
        opacity: 0,
        duration: 1.4,
        ease: 'power2.inOut',
      }, '-=1.7')
      .from('.hero__text-small', {
        y: 20,
        opacity: 0,
        duration: 0.9,
      }, '-=1.1')
      .from('.hero__text-name', {
        y: 35,
        opacity: 0,
        duration: 1.1,
      }, '-=0.8')
      .from('.hero__badge-title', {
        y: 35,
        opacity: 0,
        duration: 1.1,
      }, '-=1.0')
      .from('.hero__badge-item', {
        y: 18,
        opacity: 0,
        stagger: 0.15,
        duration: 0.8,
      }, '-=0.7');

      // 2. Parallax effect on scroll
      gsap.to('.hero__image', {
        yPercent: 18,
        ease: 'none',
        scrollTrigger: {
          trigger: heroRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });

      gsap.to('.hero__content', {
        yPercent: -12,
        opacity: 0.25,
        ease: 'none',
        scrollTrigger: {
          trigger: heroRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });
    }, heroRef);

    // Anime.js micro-glow on badge title
    let animeGlow = null;
    if (badgeTitleRef.current) {
      animeGlow = animate(badgeTitleRef.current, {
        opacity: [0.92, 1],
        letterSpacing: ['0px', '1px', '0px'],
        duration: 4000,
        ease: 'sine.inOut',
        loop: true,
      });
    }

    return () => {
      ctx.revert();
      if (animeGlow && typeof animeGlow.revert === 'function') {
        animeGlow.revert();
      }
    };
  }, []);

  return (
    <section className="hero" id="hero" ref={heroRef}>
      <div className="hero__image-wrapper">
        <img
          src="/images/000064-3.webp"
          alt="Hoàng & Duyên"
          className="hero__image"
        />
      </div>
      <div className="hero__overlay" />
      <div className="hero__content">
        <div className="hero__text">
          <p className="hero__text-small">Câu chuyện của</p>
          <h1 className="hero__text-name">
            Hoàng<br />& Duyên
          </h1>
        </div>
        <div className="hero__badge">
          <div className="hero__badge-title" ref={badgeTitleRef}>69 Project</div>
          <div className="hero__badge-list">
            <div className="hero__badge-item">6 năm bạn học...</div>
            <div className="hero__badge-item">9 năm bạn gái...</div>
            <div className="hero__badge-item">69 năm bạn đời, bạn nhậu, bạn làm ăn, bạn chung nhà, bạn già...</div>
          </div>
        </div>
      </div>
    </section>
  );
}
