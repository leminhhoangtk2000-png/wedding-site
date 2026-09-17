'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { animate } from 'animejs';

export default function WishSection() {
  const iconRef = useRef(null);

  useEffect(() => {
    if (!iconRef.current) return;
    const anim = animate(iconRef.current, {
      translateX: [0, 4, 0],
      translateY: [0, -4, 0],
      rotate: [0, -8, 0],
      duration: 2600,
      ease: 'sine.inOut',
      loop: true,
    });

    return () => {
      if (anim && typeof anim.revert === 'function') anim.revert();
    };
  }, []);

  return (
    <section className="wish-section reveal" id="wishes-invite">
      {/* Ambient warm champagne glow behind the card */}
      <div className="wish-section__ambient-glow" aria-hidden="true" />

      <div className="wish-section__container">
        <div className="wish-card">
          {/* Eyebrow badge */}
          <div className="wish-card__badge">
            <svg 
              width="14" 
              height="14" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <span>Sổ Lưu Bút</span>
          </div>

          {/* Card Title */}
          <h3 className="wish-card__title">
            Gửi Lời Chúc Đến Hoàng &amp; Duyên
          </h3>

          {/* Heartfelt invitation note - revised to be warm, respectful and inclusive for all ages */}
          <p className="wish-card__desc">
            Sự hiện diện và những lời chúc phúc ấm áp của quý người thân, bạn bè là món quà ý nghĩa nhất dành cho chúng mình trên chặng đường mới. Thân mời mọi người cùng gửi lại những dòng tâm tình, kỷ niệm hoặc một tấm hình thật đẹp nhé!
          </p>

          {/* Primary Action Button */}
          <div className="wish-card__action">
            <Link href="/wishes" className="wish-card__button">
              <span className="wish-card__button-icon" ref={iconRef}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              </span>
              <span>Gửi lời chúc &amp; chia sẻ ảnh</span>
              <span className="wish-card__button-arrow">→</span>
            </Link>
          </div>

          {/* Subtle footer note */}
          <div className="wish-card__hint">
            <span className="wish-card__hint-icon">✨</span>
            <span>Lời chúc sẽ được lưu giữ trang trọng trên Bảng Chúc Phúc</span>
          </div>
        </div>
      </div>
    </section>
  );
}
