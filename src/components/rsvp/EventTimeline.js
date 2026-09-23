'use client';

import Image from 'next/image';
import {
  HanddrawnChampagne,
  HanddrawnDove,
  HanddrawnCamera,
  HanddrawnDinner,
  HanddrawnCake,
} from '@/components/icons/HanddrawnIcons';
import styles from '@/app/rsvp/rsvp.module.css';

const TIMELINE_EVENTS = [
  {
    time: '16:00',
    title: 'Welcome & Afternoon Tea',
    desc: 'Enjoy welcome drinks, delicate treats, and soft acoustic melodies.',
    icon: HanddrawnChampagne,
  },
  {
    time: '17:30',
    title: 'Wedding Ceremony',
    desc: 'The sacred moment of exchanging rings and vows under the open sky.',
    icon: HanddrawnDove,
  },
  {
    time: '18:00',
    title: 'Golden Hour & Photos',
    desc: 'Capture memorable moments and golden hour portraits with Hoàng & Duyên.',
    icon: HanddrawnCamera,
  },
  {
    time: '18:30',
    title: 'Intimate Dinner Banquet',
    desc: 'Savor an exquisite candlelit dinner and raise a celebratory toast.',
    icon: HanddrawnDinner,
  },
  {
    time: '19:30',
    title: 'Cake Cutting & After Party',
    desc: 'Dance under the stars, enjoy wedding games, and celebrate together!',
    icon: HanddrawnCake,
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
