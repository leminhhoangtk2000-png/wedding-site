'use client';

import Image from 'next/image';
import {
  HanddrawnChampagne,
  HanddrawnRings,
  HanddrawnTeaCup,
  HanddrawnDinner,
  HanddrawnCelebration,
} from '@/components/icons/HanddrawnIcons';
import styles from '@/app/rsvp/rsvp.module.css';

const TIMELINE_EVENTS = [
  {
    time: '16:00',
    title: 'Meet & Greet',
    desc: 'Welcome drinks, light refreshments, and warm greetings with Hoàng & Duyên.',
    icon: HanddrawnChampagne,
  },
  {
    time: '16:30',
    title: 'The Ceremony',
    desc: 'The sacred moment of exchanging rings and vows under the open sky.',
    icon: HanddrawnRings,
  },
  {
    time: '17:30',
    title: 'Tea Break',
    desc: 'Delicate treats, fragrant tea, sweet mingling, and golden hour photos.',
    icon: HanddrawnTeaCup,
  },
  {
    time: '18:30',
    title: 'Dinner',
    desc: 'Savor an exquisite candlelit wedding banquet and raise a celebratory toast.',
    icon: HanddrawnDinner,
  },
  {
    time: '19:30',
    title: "Let's Party!",
    desc: 'Dance under the stars, enjoy wedding games, music, and celebrate together!',
    icon: HanddrawnCelebration,
  },
];

export default function EventTimeline() {
  return (
    <section
      id="rsvp-timeline-section"
      className={styles.banquetCard}
      aria-label="Wedding timeline and schedule"
    >
      {/* Header */}
      <div className={styles.badgePill}>
        <span className={styles.badgeSparkle}>✦</span>
        <span>ORDER OF EVENTS</span>
        <span className={styles.badgeSparkle}>✦</span>
      </div>

      <h2 className={styles.cardTitleScript}>Wedding Timeline</h2>

      <p className={styles.cardSubtitle}>
        Saturday, October 3rd, 2026 · Hidden Haven
      </p>

      {/* Gold Filigree Divider */}
      <div className={styles.goldFiligreeDivider} aria-hidden="true">
        <div className={styles.goldFiligreeLine} />
        <span className={styles.goldFiligreeKnot}>✦</span>
        <div className={styles.goldFiligreeLine} />
      </div>

      {/* Banquet Table Artistic Illustration */}
      <div className={styles.timelineBanquetTableArt} aria-hidden="true">
        <Image
          src="/rsvp/banquet_table_transparent.webp"
          alt="Romantic candlelit wedding banquet table"
          width={800}
          height={450}
          priority
          className={styles.timelineTableImage}
        />
      </div>

      {/* Vertical Interactive Timeline Trail */}
      <div className={styles.timelineTrail} role="list">
        {TIMELINE_EVENTS.map((event, idx) => {
          const IconComp = event.icon;
          return (
            <div key={idx} className={styles.timelineItem} role="listitem">
              <div className={styles.timelineNode} aria-hidden="true">
                <IconComp size={22} />
              </div>
              <div className={styles.timelineContent}>
                <div className={styles.timelineTimeHeader}>
                  <span className={styles.timelineTimeGold}>{event.time}</span>
                  <span className={styles.timelineLabel}>{event.title}</span>
                </div>
                <p className={styles.timelineDesc}>{event.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
