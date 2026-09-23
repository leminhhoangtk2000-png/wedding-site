'use client';

import Link from 'next/link';
import { HanddrawnBook, HanddrawnEnvelope } from '@/components/icons/HanddrawnIcons';
import styles from '@/app/rsvp/rsvp.module.css';

export default function RsvpNavSection() {
  return (
    <section className={`${styles.banquetCard} ${styles.navSectionCard}`} aria-label="Explore our story and guestbook">
      {/* Header */}
      <div className={styles.badgePill}>
        <span className={styles.badgeSparkle}>✦</span>
        <span>OUR LOVE STORY</span>
        <span className={styles.badgeSparkle}>✦</span>
      </div>

      <h2 className={styles.cardTitleScript}>Love Story &amp; Guestbook</h2>
      <p className={styles.cardSubtitle}>
        Discover Hoàng &amp; Duyên&apos;s 10-year journey together, or leave heartfelt blessings in our guestbook.
      </p>

      {/* Gold Filigree Divider */}
      <div className={styles.goldFiligreeDivider} aria-hidden="true">
        <div className={styles.goldFiligreeLine} />
        <span className={styles.goldFiligreeKnot}>✦</span>
        <div className={styles.goldFiligreeLine} />
      </div>

      {/* 2 Navigation Action Buttons */}
      <div className={styles.navButtonGroup}>
        {/* Button 1: Our Story */}
        <Link href="/" className={styles.navActionCard} aria-label="Read our love story">
          <div className={styles.navCardMain}>
            <div className={styles.navCardIcon} aria-hidden="true">
              <HanddrawnBook size={24} />
            </div>
            <div className={styles.navCardTitle}>Our Story</div>
          </div>
          <div className={styles.navCardArrow} aria-hidden="true">
            →
          </div>
        </Link>

        {/* Button 2: Wishes Board */}
        <Link
          href="/wishes"
          className={`${styles.navActionCard} ${styles.navActionCardPrimary}`}
          aria-label="Sign our guestbook"
        >
          <div className={styles.navCardMain}>
            <div className={`${styles.navCardIcon} ${styles.navCardIconGold}`} aria-hidden="true">
              <HanddrawnEnvelope size={24} />
            </div>
            <div className={styles.navCardTitle}>Wishes Board</div>
          </div>
          <div className={styles.navCardArrow} aria-hidden="true">
            →
          </div>
        </Link>
      </div>
    </section>
  );
}
