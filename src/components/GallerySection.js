'use client';

import Image from 'next/image';

export default function GallerySection({ section, allImages = [], onImageClick }) {
  // Use padding-top hack to maintain the container's exact aspect ratio
  // section.height and section.width are the raw Figma dimensions
  const paddingTop = `${(section.height / section.width) * 100}%`;

  return (
    <section className="gallery" id={section.id}>
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
          paddingTop: paddingTop,
          overflow: 'hidden',
          containerType: 'inline-size' // Enable container queries for exact scaling
        }}
      >
        {section.items.map((item, index) => {
          if (item.type === 'image') {
            return (
              <div
                key={index}
                className="gallery__item"
                style={{
                  position: 'absolute',
                  top: `${item.y}%`,
                  left: `${item.x}%`,
                  width: `${item.w}%`,
                  height: `${item.h}%`,
                  cursor: 'pointer'
                }}
                onClick={() => onImageClick && onImageClick(item.src)}
              >
                <img 
                  src={item.src} 
                  alt="" 
                  loading="lazy"
                  decoding="async"
                  className="gallery__item-image"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block'
                  }} 
                />
              </div>
            );
          }
          
          if (item.type === 'text') {
            return (
              <div
                key={index}
                className="gallery__text-panel"
                style={{
                  position: 'absolute',
                  top: `${item.y}%`,
                  left: `${item.x}%`,
                  width: `${item.w}%`,
                  height: `${item.h}%`,
                  padding: item.w >= 95 ? '2% 2%' : '2%', // Use percentage padding
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
