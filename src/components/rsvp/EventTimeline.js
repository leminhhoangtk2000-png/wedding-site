'use client';

import Image from 'next/image';
import styles from '@/app/rsvp/rsvp.module.css';

const TIMELINE_EVENTS = [
  { time: '16:00', label: 'Meet & Greet' },
  { time: '16:30', label: 'The Ceremony' },
  { time: '17:30', label: 'Tea Break' },
  { time: '18:30', label: 'Dinner' },
  { time: '19:30', label: "Let's Party!", isCenter: true },
];

export default function EventTimeline() {
  return (
    <section className={styles.trifoldCard} aria-label="Wedding Event Timeline">
      <div className={styles.timelineCard}>
        {/* Vine Border Background Frame */}
        <Image
          src="/rsvp/layers/vine_frame.png"
          alt=""
          fill
          sizes="(max-width: 600px) 100vw, 588px"
          className={styles.cardVineBg}
          aria-hidden="true"
        />

        {/* Top Green Ribbons */}
        <Image
          src="/rsvp/layers/ribbon_left.png"
          alt=""
          width={130}
          height={195}
          className={styles.ribbonLeftCorner}
          aria-hidden="true"
        />
        <Image
          src="/rsvp/layers/ribbon_right.png"
          alt=""
          width={110}
          height={195}
          className={styles.ribbonRightCorner}
          aria-hidden="true"
        />

        {/* Title */}
        <h2 className={styles.timelineTitle}>Timeline</h2>

        {/* Timeline Grid (2 columns on tablet/desktop, 1 column on mobile) */}
        <div className={styles.timelineGrid}>
          {TIMELINE_EVENTS.map((event, index) => (
            <div
              key={index}
              className={`${styles.timelineItem} ${event.isCenter ? styles.timelineItemCenter : ''}`}
            >
              <div className={styles.timelineTime}>{event.time}</div>
              <div className={styles.timelineLabel}>{event.label}</div>
            </div>
          ))}
        </div>

        {/* Bottom Dining & Party Celebration Artwork (Figma Node 131:96) */}
        <div className={styles.timelineBottomDecor} aria-hidden="true">
          <Image
            src="/rsvp/layers/timeline_decor_left.png"
            alt=""
            width={280}
            height={170}
            className={styles.timelineDecorLeft}
          />
          <Image
            src="/rsvp/layers/timeline_decor_right.png"
            alt=""
            width={290}
            height={170}
            className={styles.timelineDecorRight}
          />
        </div>
      </div>
    </section>
  );
}
