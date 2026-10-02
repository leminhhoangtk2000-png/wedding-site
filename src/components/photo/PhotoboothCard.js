'use client';

import React from 'react';
import FilmPhoto from './FilmPhoto';
import { FRAMES } from '@/lib/photo/film.mjs';

/**
 * PhotoboothCard
 * Renders the wedding photo inside the official vintage floral frame.
 * Ensures the frame, typography, and florals remain untouched while color filters
 * only affect the guest photo.
 */
export default function PhotoboothCard({
  imageUrl,
  crop,
  orientation = 'portrait',
  filter,
  seed = 0,
  onStateChange,
  interactive = false,
  viewportRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onKeyDown,
  showGrid = false,
  locked = false,
  className = '',
  style = {},
}) {
  const isPortrait = orientation === 'portrait';

  // Frame asset path
  const frameSrc = isPortrait
    ? '/images/photobooth-frame-portrait.png'
    : '/images/photobooth-frame-landscape.png';

  const f=FRAMES[orientation];
  const apertureStyle={left:`${f.left/f.width*100}%`,top:`${f.top/f.height*100}%`,width:`${f.photoWidth/f.width*100}%`,height:`${f.photoHeight/f.height*100}%`};

  return (
    <div
      className={`photobooth-card-container ${isPortrait ? 'card-portrait' : 'card-landscape'} ${className}`}
      style={style}
    >
      <div className="photobooth-card-inner">
        {/* 1. Base Cream Paper Background */}
        <div className="photobooth-paper-base" aria-hidden="true" />

        {/* 2. Photo Aperture Viewport (Guest Photo sits inside) */}
        <div
          ref={viewportRef}
          className={`photobooth-aperture ${interactive && !locked ? 'interactive' : ''}`}
          style={apertureStyle}
          onPointerDown={interactive ? onPointerDown : undefined}
          onPointerMove={interactive ? onPointerMove : undefined}
          onPointerUp={interactive ? onPointerUp : undefined}
          onPointerCancel={interactive ? onPointerCancel : undefined}
          onKeyDown={interactive ? onKeyDown : undefined}
          tabIndex={interactive ? 0 : -1}
          role={interactive ? 'region' : undefined}
          aria-label={interactive ? 'Wedding photobooth frame. Drag mouse or finger to move photo.' : undefined}
        >
          {imageUrl && <FilmPhoto imageUrl={imageUrl} crop={crop} orientation={orientation} filter={filter} seed={seed} onStateChange={onStateChange} />}

          {/* Rule-of-thirds grid guides for cropping */}
          {showGrid && !locked && (
            <div className="aperture-grid-lines" aria-hidden="true">
              <div className="grid-line horizontal top" />
              <div className="grid-line horizontal bottom" />
              <div className="grid-line vertical left" />
              <div className="grid-line vertical right" />
            </div>
          )}

          {/* Subtle inner photo border */}
          <div className="aperture-inner-border" aria-hidden="true" />
        </div>

        {/* 3. Vintage Floral & Typography Frame Overlay (On top, untouched by filters) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={frameSrc}
          alt="Vintage floral frame Hoàng & Duyên"
          className="photobooth-frame-overlay"
          draggable={false}
          aria-hidden="true"
        />

        {/* 4. Touch drag hint badge (only when interactive) */}
        {interactive && (
          <div className="interactive-drag-badge" aria-hidden="true">
            <span>{locked ? '🔒 Frame locked' : '✦ Drag to adjust framing'}</span>
          </div>
        )}
      </div>

      <style jsx>{`
        .photobooth-card-container {
          position: relative;
          width: 100%;
          max-width: 100%;
          margin: 0 auto;
          user-select: none;
          touch-action: none;
          border-radius: 12px;
          overflow: hidden;
          box-shadow:
            0 14px 40px -10px rgba(0, 0, 0, 0.45),
            0 2px 10px rgba(0, 0, 0, 0.15),
            0 0 0 1px rgba(212, 175, 55, 0.3);
          transition: aspect-ratio 0.3s ease;
        }

        .card-portrait {
          aspect-ratio: 100 / 148;
          max-width: 380px;
        }

        .card-landscape {
          aspect-ratio: 148 / 100;
          max-width: 540px;
        }

        .photobooth-card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          background: #fdfaf5;
        }

        .photobooth-paper-base {
          position: absolute;
          inset: 0;
          background-color: #fdfaf5;
          z-index: 1;
        }

        /* Aperture Viewport */
        .photobooth-aperture {
          position: absolute;
          overflow: hidden;
          z-index: 2;
          background-color: #ebe4d8;
          box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.12);
        }

        .photobooth-aperture.interactive {
          cursor: grab;
        }

        .photobooth-aperture.interactive:active {
          cursor: grabbing;
        }

        .aperture-inner-border {
          position: absolute;
          inset: 0;
          border: 1px solid rgba(180, 150, 100, 0.25);
          pointer-events: none;
        }

        /* Grid lines */
        .aperture-grid-lines {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .grid-line {
          position: absolute;
          background-color: rgba(255, 255, 255, 0.55);
          box-shadow: 0 0 1px rgba(0, 0, 0, 0.4);
        }

        .grid-line.horizontal {
          left: 0;
          right: 0;
          height: 1px;
        }

        .grid-line.horizontal.top {
          top: 33.333%;
        }

        .grid-line.horizontal.bottom {
          top: 66.666%;
        }

        .grid-line.vertical {
          top: 0;
          bottom: 0;
          width: 1px;
        }

        .grid-line.vertical.left {
          left: 33.333%;
        }

        .grid-line.vertical.right {
          left: 66.666%;
        }

        /* Frame overlay sits above photo */
        .photobooth-frame-overlay {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: fill;
          pointer-events: none;
          z-index: 5;
        }

        .interactive-drag-badge {
          position: absolute;
          bottom: 12px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(14, 18, 23, 0.72);
          backdrop-filter: blur(8px);
          color: #fdfaf5;
          font-size: 11px;
          font-weight: 500;
          padding: 4px 12px;
          border-radius: 9999px;
          border: 1px solid rgba(212, 175, 55, 0.4);
          z-index: 10;
          pointer-events: none;
          letter-spacing: 0.02em;
          white-space: nowrap;
        }

        @media (max-width: 480px) {
          .card-portrait {
            max-width: 320px;
          }
          .card-landscape {
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
