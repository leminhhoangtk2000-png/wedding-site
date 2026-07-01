'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import HeroSection from '@/components/HeroSection';
import QuoteSection from '@/components/QuoteSection';
import GallerySection from '@/components/GallerySection';
import ImageLightbox from '@/components/ImageLightbox';
import { gallerySections } from '@/lib/storyData';
import Link from 'next/link';

const phases = [
  { key: '6', label: '6', subtitle: 'bạn học', prefix: 'HS' },
  { key: '9', label: '9', subtitle: 'bạn gái', prefix: 'TT' },
  { key: '69', label: '69', subtitle: 'bạn đời', prefix: 'Cưới' },
];

export default function HomePage() {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [activePhase, setActivePhase] = useState('6');

  // Group sections by phase prefix
  const sectionsByPhase = useMemo(() => {
    return {
      '6': gallerySections.filter(s => s.name.startsWith('HS')),
      '9': gallerySections.filter(s => s.name.startsWith('TT')),
      '69': gallerySections.filter(s => s.name.startsWith('Cưới')),
    };
  }, []);

  // Active sections for current tab
  const activeSections = sectionsByPhase[activePhase] || [];

  // Collect images from active sections for lightbox
  const activeImages = useMemo(() => {
    const images = [];
    activeSections.forEach(section => {
      section.items.forEach(item => {
        if (item.type === 'image' && item.src) {
          images.push(item.src);
        }
      });
    });
    return images;
  }, [activeSections]);

  const handleImageClick = useCallback((src) => {
    const idx = activeImages.indexOf(src);
    if (idx >= 0) {
      setLightboxIndex(idx);
      setLightboxOpen(true);
    }
  }, [activeImages]);

  const handlePhaseChange = useCallback((key) => {
    setActivePhase(key);
    // Scroll to gallery area smoothly
    const el = document.getElementById('story-gallery');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Scroll reveal animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [activePhase]);

  return (
    <>
      <HeroSection />
      
      <div className="story-wish-cta reveal">
        <Link href="/wishes" className="wish-cta-button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
          <span>Gửi lời chúc cho tụi mình nhé!</span>
        </Link>
      </div>

      <QuoteSection />

      {/* Phase Tab Bar */}
      <div className="phase-tab-bar" id="story-gallery">
        {phases.map(phase => (
          <button
            key={phase.key}
            className={`phase-tab ${activePhase === phase.key ? 'phase-tab--active' : ''}`}
            onClick={() => handlePhaseChange(phase.key)}
          >
            <span className="phase-tab__number">{phase.label}</span>
            <span className="phase-tab__label">năm {phase.subtitle}</span>
          </button>
        ))}
      </div>

      {/* Sidebar Navigation */}
      <div className="phase-sidebar">
        {phases.map(phase => (
          <button
            key={phase.key}
            className={`phase-sidebar__btn ${activePhase === phase.key ? 'phase-sidebar__btn--active' : ''}`}
            onClick={() => handlePhaseChange(phase.key)}
            title={`${phase.label} năm ${phase.subtitle}`}
          >
            {phase.label}
          </button>
        ))}
      </div>

      {/* Gallery Content for Active Phase */}
      <div className="phase-content" key={activePhase}>
        {activeSections.map((section) => (
          <GallerySection
            key={section.id}
            section={section}
            allImages={activeImages}
            onImageClick={handleImageClick}
          />
        ))}
      </div>

      {lightboxOpen && (
        <ImageLightbox
          images={activeImages}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          onNavigate={setLightboxIndex}
        />
      )}
    </>
  );
}
