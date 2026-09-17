'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export default function QuoteSection() {
  const sectionRef = useRef(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 75%',
          toggleActions: 'play none none reverse',
        },
      });

      tl.from('.quote-section__title', {
        y: 40,
        opacity: 0,
        scale: 0.92,
        duration: 1.2,
        ease: 'power3.out',
      })
      .from('.quote-section__line', {
        y: 24,
        opacity: 0,
        stagger: 0.22,
        duration: 0.9,
        ease: 'power2.out',
      }, '-=0.6');
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className="quote-section" id="quote" ref={sectionRef}>
      <h2 className="quote-section__title">&lsquo;Bạn&rsquo;</h2>
      <p className="quote-section__subtitle">
        <span className="quote-section__line" style={{ display: 'block' }}>
          Tụi tui thích định nghĩa mối quan hệ của mình bằng chữ &lsquo;Bạn&rsquo;
        </span>
        <span className="quote-section__line" style={{ display: 'block' }}>
          Một danh xưng không ràng buộc, không sở hữu.
        </span>
        <span className="quote-section__line" style={{ display: 'block' }}>
          Sự gắn kết hoàn toàn đến từ tự nguyện và bình đẳng.
        </span>
      </p>
    </section>
  );
}
