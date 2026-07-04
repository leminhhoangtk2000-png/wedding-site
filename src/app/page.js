'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import HeroSection from '@/components/HeroSection';
import QuoteSection from '@/components/QuoteSection';
import SectionChon from '@/components/SectionChon';
import GallerySection from '@/components/GallerySection';
import ImageLightbox from '@/components/ImageLightbox';
import { gallerySections } from '@/lib/storyData';
import Link from 'next/link';
import Script from 'next/script';

const phases = [
  { key: '6', label: '6', subtitle: 'bạn học', prefix: 'HS' },
  { key: '9', label: '9', subtitle: 'bạn gái', prefix: 'TT' },
  { key: '69', label: '69', subtitle: 'bạn đời', prefix: 'Cưới' },
];

export default function HomePage() {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [activePhase, setActivePhase] = useState('6');
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

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

  // Auto-next tab when scrolling to bottom
  useEffect(() => {
    const marker = document.getElementById('gallery-end-marker');
    if (!marker) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const currentIndex = phases.findIndex(p => p.key === activePhase);
          if (currentIndex >= 0 && currentIndex < phases.length - 1) {
            const nextPhaseKey = phases[currentIndex + 1].key;
            
            // Switch phase
            setActivePhase(nextPhaseKey);
            
            // Jump to the top of the gallery so they can start reading the new tab
            setTimeout(() => {
              const el = document.getElementById('story-gallery');
              if (el) {
                // Determine offset of header/tabs so we scroll to the exact beginning of gallery
                const y = el.getBoundingClientRect().top + window.scrollY - 80;
                window.scrollTo({ top: y, behavior: 'instant' });
              }
            }, 0);
          }
        }
      },
      { threshold: 0, rootMargin: '100px 0px 0px 0px' }
    );

    observer.observe(marker);
    return () => observer.disconnect();
  }, [activePhase]);

  return (
    <>
      <HeroSection />
      
      <div style={{ position: 'relative', width: '100%', maxWidth: 'calc(90vh * (4/3))', aspectRatio: '4/3', margin: '0 auto', overflow: 'hidden', backgroundColor: '#000' }}>
        {!isVideoPlaying ? (
          <div 
            onClick={() => setIsVideoPlaying(true)}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundImage: 'url(/images/000069-2.webp)', backgroundSize: 'cover', backgroundPosition: 'center' }}
            className="video-facade"
          >
            {/* Dark overlay */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.3)' }}></div>
            {/* Play Button */}
            <div className="play-button" style={{ position: 'relative', zIndex: 1, width: 70, height: 70, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', transition: 'transform 0.2s' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="var(--color-accent-dark)" stroke="var(--color-accent-dark)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 6 }}>
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </div>
          </div>
        ) : (
          <iframe 
            src="https://player.vimeo.com/video/1206395637?badge=0&autopause=0&player_id=0&app_id=58479&autoplay=1&loop=1&muted=0" 
            frameBorder="0" 
            allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share" 
            referrerPolicy="strict-origin-when-cross-origin" 
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} 
            title="PreWedding HOANG&DUYEN: Project 69"
            loading="lazy"
          ></iframe>
        )}
      </div>
      {isVideoPlaying && <Script src="https://player.vimeo.com/api/player.js" strategy="lazyOnload" />}

      <div className="story-wish-cta reveal">
        <Link href="/wishes" className="wish-cta-button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
          <span>Gửi lời chúc cho tụi mình nhé!</span>
        </Link>
      </div>

      <QuoteSection />

      {/* Section Chon (original image cards) */}
      <SectionChon onPhaseChange={handlePhaseChange} activePhase={activePhase} />

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
      <div className="phase-content" id="story-gallery" key={activePhase}>
        {activeSections.map((section) => (
          <GallerySection
            key={section.id}
            section={section}
            allImages={activeImages}
            onImageClick={handleImageClick}
          />
        ))}
        {/* End marker for auto-next tab */}
        {activePhase !== '69' && (
          <div id="gallery-end-marker" style={{ height: '2px', width: '100%' }} />
        )}
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
