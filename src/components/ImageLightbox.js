'use client';
import { useState, useEffect, useCallback } from 'react';

export default function ImageLightbox({ images = [], currentIndex = 0, onClose, onNavigate }) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setZoom(1);
  }, [currentIndex]);

  const goNext = useCallback(() => {
    onNavigate((currentIndex + 1) % images.length);
  }, [currentIndex, images.length, onNavigate]);

  const goPrev = useCallback(() => {
    onNavigate((currentIndex - 1 + images.length) % images.length);
  }, [currentIndex, images.length, onNavigate]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose, goNext, goPrev]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setZoom(prev => {
      const delta = e.deltaY > 0 ? -0.2 : 0.2;
      return Math.min(Math.max(prev + delta, 0.5), 4);
    });
  }, []);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!images.length) return null;
  const currentImage = typeof images[currentIndex] === 'string' ? images[currentIndex] : images[currentIndex]?.src;

  return (
    <div className="lightbox lightbox--open" onClick={handleBackdropClick} role="dialog" aria-modal="true">
      <button className="lightbox__close" onClick={onClose} aria-label="Close">✕</button>
      
      {images.length > 1 && (
        <button className="lightbox__nav lightbox__nav--prev" onClick={goPrev} aria-label="Previous">‹</button>
      )}
      
      <div className="lightbox__image-wrapper" onWheel={handleWheel}>
        {currentImage && (
          <img
            src={currentImage}
            alt={`Image ${currentIndex + 1}`}
            className="lightbox__image"
            style={{ transform: `scale(${zoom})` }}
          />
        )}
      </div>
      
      {images.length > 1 && (
        <button className="lightbox__nav lightbox__nav--next" onClick={goNext} aria-label="Next">›</button>
      )}
      
      {images.length > 1 && (
        <div className="lightbox__counter">{currentIndex + 1} / {images.length}</div>
      )}
    </div>
  );
}
