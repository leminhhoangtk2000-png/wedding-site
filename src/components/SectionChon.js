'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { animate } from 'animejs';

const cards = [
  { image: '/images/000062.webp', text: '6 năm\nbạn học', phaseKey: '6' },
  { image: '/images/000042-4.webp', text: '9 năm\nbạn gái', phaseKey: '9' },
  { image: '/images/000046-4.webp', text: '69 năm\nbạn đời', phaseKey: '69' },
];

export default function SectionChon({ onPhaseChange, activePhase }) {
  const sectionRef = useRef(null);
  const cardsRef = useRef([]);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      gsap.from('.section-chon__card', {
        y: 60,
        opacity: 0,
        scale: 0.94,
        stagger: 0.18,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 80%',
          toggleActions: 'play none none reverse',
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  // Anime.js feedback when activePhase changes
  useEffect(() => {
    const activeIndex = cards.findIndex(c => c.phaseKey === activePhase);
    if (activeIndex >= 0 && cardsRef.current[activeIndex]) {
      const activeEl = cardsRef.current[activeIndex];
      const textEl = activeEl.querySelector('.section-chon__card-text');
      if (textEl) {
        animate(textEl, {
          scale: [0.9, 1.08, 1],
          opacity: [0.8, 1],
          duration: 500,
          ease: 'spring(1, 80, 10, 0)',
        });
      }
    }
  }, [activePhase]);

  const handleClick = (phaseKey, index, e) => {
    const cardEl = cardsRef.current[index];
    if (cardEl) {
      animate(cardEl, {
        scale: [1, 0.95, 1.02, 1],
        duration: 500,
        ease: 'spring(1, 80, 12, 0)',
      });
    }

    if (onPhaseChange) {
      onPhaseChange(phaseKey);
    }
  };

  return (
    <section className="section-chon" id="section-chon" ref={sectionRef}>
      <div className="section-chon__grid">
        {cards.map((card, idx) => (
          <div
            key={card.phaseKey}
            ref={(el) => (cardsRef.current[idx] = el)}
            className={`section-chon__card ${activePhase === card.phaseKey ? 'section-chon__card--active' : ''}`}
            onClick={(e) => handleClick(card.phaseKey, idx, e)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick(card.phaseKey, idx, e);
              }
            }}
          >
            <img src={card.image} alt={card.text.replace('\n', ' ')} className="section-chon__card-image" />
            <div className="section-chon__card-overlay">
              <span className="section-chon__card-text">{card.text}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
