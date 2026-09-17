'use client';

import { useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export default function GallerySection({ section, allImages = [], onImageClick }) {
  const sectionRef = useRef(null);
  const spiralTriggerRef = useRef(null);
  const img1Ref = useRef(null);
  const img2Ref = useRef(null);
  const text1Ref = useRef(null);
  const text2Ref = useRef(null);

  const isSection6 = section.id === 'section-6';
  const isSpinningRef = useRef(false);

  // Play full 360-degree vortex spin and land back at exact original position
  const playSpiralSpin = useCallback(() => {
    if (isSpinningRef.current) return;
    isSpinningRef.current = true;

    const tl = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      onComplete: () => {
        // Reset cleanly to exact original properties
        if (img1Ref.current) {
          gsap.set(img1Ref.current, { rotation: -180, scale: 1.0 });
        }
        if (img2Ref.current) {
          gsap.set(img2Ref.current, { rotation: 90, scale: 1.0, xPercent: -50, yPercent: -50 });
        }
        isSpinningRef.current = false;
      }
    });

    if (img1Ref.current) {
      tl.fromTo(
        img1Ref.current,
        { rotation: -180, scale: 1.0 },
        {
          rotation: 180, // Exact 360 deg turn (-180 to 180)
          keyframes: [
            { scale: 1.22, duration: 0.75, ease: 'power1.out' },
            { scale: 1.0, duration: 0.75, ease: 'power1.in' }
          ],
          duration: 1.5,
        },
        0
      );
    }

    if (img2Ref.current) {
      tl.fromTo(
        img2Ref.current,
        { rotation: 90, scale: 1.0, xPercent: -50, yPercent: -50 },
        {
          rotation: 450, // Exact 360 deg turn (90 to 450)
          keyframes: [
            { scale: 1.22, duration: 0.75, ease: 'power1.out' },
            { scale: 1.0, duration: 0.75, ease: 'power1.in' }
          ],
          duration: 1.5,
        },
        0
      );
    }

    if (text1Ref.current && text2Ref.current) {
      tl.fromTo(
        [text1Ref.current, text2Ref.current],
        { opacity: 0.75, scale: 0.98 },
        { opacity: 1.0, scale: 1.0, duration: 1.2, ease: 'power2.out' },
        0.2
      );
    }
  }, []);

  useEffect(() => {
    if (!isSection6) return;

    gsap.registerPlugin(ScrollTrigger);

    // Initial setup: ensure exact original positions
    if (img1Ref.current) {
      gsap.set(img1Ref.current, {
        rotation: -180,
        scale: 1.0,
        transformOrigin: '50% 50%',
      });
    }

    if (img2Ref.current) {
      gsap.set(img2Ref.current, {
        xPercent: -50,
        yPercent: -50,
        rotation: 90,
        scale: 1.0,
        transformOrigin: '50% 50%',
      });
    }

    const st = ScrollTrigger.create({
      trigger: spiralTriggerRef.current,
      start: 'top 70%',
      onEnter: () => playSpiralSpin(),
      onEnterBack: () => playSpiralSpin(),
    });

    return () => {
      st.kill();
    };
  }, [isSection6, playSpiralSpin]);

  return (
    <section className="gallery" id={section.id} ref={sectionRef}>
      {section.chapterTitle && (
        <div className="chapter-header reveal">
          <h2 className="chapter-header__title">{section.chapterTitle}</h2>
          {section.chapterSubtitle && (
            <p className="chapter-header__subtitle">{section.chapterSubtitle}</p>
          )}
        </div>
      )}

      <div 
        className="gallery__mosaic-container"
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: `${section.width} / ${section.height}`,
          overflow: 'hidden',
          containerType: 'inline-size'
        }}
      >
        {/* Scroll trigger zone specifically for the spiral transition block */}
        {isSection6 && (
          <div
            ref={spiralTriggerRef}
            className="spiral-trigger-zone"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '11.5%',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        )}

        {section.items.map((item, index) => {
          if (item.type === 'image') {
            const isRotated90 = Math.abs(item.rotation || 0) === 90;
            const isSpiral1 = isSection6 && item.src === '/images/000072.webp';
            const isSpiral2 = isSection6 && item.src === '/images/000042-3.webp';
            
            return (
              <div
                key={index}
                className={`gallery__item ${isSpiral1 || isSpiral2 ? 'gallery__item--spiral' : ''}`}
                style={{
                  position: 'absolute',
                  top: `${item.y}%`,
                  left: `${item.x}%`,
                  width: `${item.w}%`,
                  height: `${item.h}%`,
                  cursor: 'pointer',
                  overflow: 'hidden',
                  containerType: isRotated90 ? 'size' : 'normal'
                }}
                onClick={() => onImageClick && onImageClick(item.src)}
                onMouseEnter={() => (isSpiral1 || isSpiral2) && playSpiralSpin()}
              >
                {isSpiral1 ? (
                  <img 
                    ref={img1Ref}
                    src={item.src} 
                    alt="" 
                    loading="lazy"
                    decoding="async"
                    className="gallery__item-image gallery__spiral-img gallery__spiral-img--1"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                      transformOrigin: '50% 50%',
                      transform: 'rotate(-180deg)',
                      willChange: 'transform',
                    }} 
                  />
                ) : isSpiral2 ? (
                  <img 
                    ref={img2Ref}
                    src={item.src} 
                    alt="" 
                    loading="lazy"
                    decoding="async"
                    className="gallery__item-image gallery__spiral-img gallery__spiral-img--2"
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: '100cqh',
                      height: '100cqw',
                      objectFit: 'cover',
                      display: 'block',
                      transformOrigin: '50% 50%',
                      transform: 'translate(-50%, -50%) rotate(90deg)',
                      willChange: 'transform',
                    }} 
                  />
                ) : (
                  <img 
                    src={item.src} 
                    alt="" 
                    loading="lazy"
                    decoding="async"
                    className="gallery__item-image"
                    style={{
                      objectFit: 'cover',
                      display: 'block',
                      ...(isRotated90 ? {
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: '100cqh',
                        height: '100cqw',
                        transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`
                      } : {
                        width: '100%',
                        height: '100%',
                        transform: item.rotation ? `rotate(${item.rotation}deg)` : 'none'
                      })
                    }} 
                  />
                )}
              </div>
            );
          }
          
          if (item.type === 'text') {
            const isText1 = isSection6 && item.textData?.[0]?.text?.includes('Từ 6 năm');
            const isText2 = isSection6 && item.textData?.[0]?.text?.includes('đến 9 năm');

            return (
              <div
                key={index}
                ref={isText1 ? text1Ref : (isText2 ? text2Ref : null)}
                className={`gallery__text-panel ${isText1 || isText2 ? 'gallery__spiral-text' : ''}`}
                style={{
                  position: 'absolute',
                  top: `${item.y}%`,
                  left: `${item.x}%`,
                  width: `${item.w}%`,
                  height: `${item.h}%`,
                  padding: item.w >= 95 ? '2% 2%' : '2%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  zIndex: 10
                }}
              >
                <div style={{ width: '100%' }}>
                  {item.textData && item.textData.map((t, ti) => {
                    // Map Figma font family to CSS variables
                    let fontVar = 'var(--font-body)';
                    if (t.fontFamily.includes('Fraunces')) fontVar = 'var(--font-heading)';
                    if (t.fontFamily.includes('Inter')) fontVar = 'var(--font-nav)';
                    
                    return (
                      <p key={ti} style={{
                        marginBottom: ti < item.textData.length - 1 ? '2cqw' : 0,
                        whiteSpace: 'pre-line',
                        // Scale font size exactly to the container's width using cqw
                        fontSize: `calc(${t.fontSize} / ${section.width} * 100cqw)`,
                        fontFamily: `${fontVar}, "${t.fontFamily}", sans-serif`,
                        fontWeight: t.fontWeight,
                        textAlign: t.textAlign === 'CENTER' ? 'center' : (t.textAlign === 'RIGHT' ? 'right' : 'left'),
                        lineHeight: `calc(${t.lineHeight} / ${section.width} * 100cqw)`,
                        color: 'inherit'
                      }}>
                        {t.text}
                      </p>
                    );
                  })}
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>
    </section>
  );
}
