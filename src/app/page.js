'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import HeroSection from '@/components/HeroSection';
import QuoteSection from '@/components/QuoteSection';
import SectionChon from '@/components/SectionChon';
import GallerySection from '@/components/GallerySection';
import ImageLightbox from '@/components/ImageLightbox';
import { gallerySections } from '@/lib/storyData';

export default function HomePage() {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Collect ALL images from all sections for global lightbox navigation
  const allImages = useMemo(() => {
    const images = [];
    gallerySections.forEach(section => {
      section.items.forEach(item => {
        if (item.type === 'image' && item.src) {
          images.push(item.src);
        }
      });
    });
    return images;
  }, []);

  const handleImageClick = useCallback((src) => {
    const idx = allImages.indexOf(src);
    if (idx >= 0) {
      setLightboxIndex(idx);
      setLightboxOpen(true);
    }
  }, [allImages]);

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
  }, []);

  return (
    <>
      <HeroSection />
      <QuoteSection />
      <SectionChon />
      


      <div style={{ overflowX: 'auto', width: '100vw', display: 'flex', justifyContent: 'center', background: 'var(--color-bg)' }}>
        <div style={{ '--zoom': zoomLevel, width: `calc(100% * var(--zoom, 1))`, minWidth: '100%', transition: 'width 0.3s ease' }}>
          {gallerySections.map((section) => (
            <GallerySection
              key={section.id}
              section={section}
              allImages={allImages}
              onImageClick={handleImageClick}
            />
          ))}
        </div>
      </div>

      {lightboxOpen && (
        <ImageLightbox
          images={allImages}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          onNavigate={setLightboxIndex}
        />
      )}
    </>
  );
}
