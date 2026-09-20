'use client';

import Image from 'next/image';
import styles from '@/app/rsvp/rsvp.module.css';

const TIMELINE_EVENTS = [
  {
    time: '16:00',
    title: 'Meet & Greet',
    desc: 'Welcome drinks, handcrafted appetizers & gentle music on the lawn.',
    icon: '🥂',
  },
  {
    time: '16:30',
    title: 'The Ceremony',
    desc: 'Exchange of vows and wedding rings beneath the garden canopy.',
    icon: '🕊️',
  },
  {
    time: '17:30',
    title: 'Tea Break & Sunset',
    desc: 'Artisanal tea, refreshments & sunset photography with Hoàng & Duyên.',
    icon: '☕',
  },
  {
    time: '18:30',
    title: 'Dinner Banquet',
    desc: 'An intimate candlelit culinary feast, champagne toasts & stories.',
    icon: '🍽️',
  },
  {
    time: '19:30',
    title: "Let's Party!",
    desc: 'Wedding cake cutting, joyful live music & dancing beneath the stars.',
    icon: '✨',
  },
];

export default function EventTimeline() {
  return (
    <section
      id="rsvp-timeline-section"
      className={styles.banquetCard}
      aria-label="Wedding celebration timeline and order of events"
    >
      {/* Gilded Corner Filigree Accents */}
      <div className={`${styles.cardCornerFoil} ${styles.cornerTopLeft}`} aria-hidden="true" />
      <div className={`${styles.cardCornerFoil} ${styles.cornerTopRight}`} aria-hidden="true" />
      <div className={`${styles.cardCornerFoil} ${styles.cornerBottomLeft}`} aria-hidden="true" />
      <div className={`${styles.cardCornerFoil} ${styles.cornerBottomRight}`} aria-hidden="true" />

      {/* Header */}
      <span className={styles.cardEyebrow}>A Day to Remember</span>
      <h2 className={styles.cardTitleScript}>Order of Events</h2>
      <p className={styles.cardSubtitle}>
        Saturday, October 3rd, 2026 · Hidden Haven
      </p>

      {/* Gold Filigree Divider */}
      <div className={styles.goldFiligreeDivider} aria-hidden="true">
        <div className={styles.goldFiligreeLine} />
        <span className={styles.goldFiligreeKnot}>❧</span>
        <div className={styles.goldFiligreeLine} />
      </div>

      {/* Banquet Table Artistic Illustration */}
      <div className={styles.timelineBanquetTableArt} aria-hidden="true">
        <Image
          src="/rsvp/banquet_table_transparent.webp"
          alt="Rustic wedding candlelit banquet table setting"
          width={800}
          height={450}
          priority
          className={styles.timelineTableImage}
        />
      </div>

      {/* Vertical Interactive Timeline Trail */}
      <div className={styles.timelineTrail} role="list">
        {TIMELINE_EVENTS.map((event, idx) => (
          <div key={idx} className={styles.timelineItem} role="listitem">
            <div className={styles.timelineNode} aria-hidden="true">
              <span>{event.icon}</span>
            </div>
            <div className={styles.timelineContent}>
              <div className={styles.timelineTimeHeader}>
                <span className={styles.timelineTimeGold}>{event.time}</span>
                <span className={styles.timelineLabel}>{event.title}</span>
              </div>
              <p className={styles.timelineDesc}>{event.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
