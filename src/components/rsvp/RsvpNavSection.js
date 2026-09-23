'use client';

import Link from 'next/link';
import { HanddrawnBook, HanddrawnEnvelope } from '@/components/icons/HanddrawnIcons';
import styles from '@/app/rsvp/rsvp.module.css';

export default function RsvpNavSection() {
  return (
    <section className={`${styles.banquetCard} ${styles.navSectionCard}`} aria-label="Explore wedding story and send wishes">
      {/* Gilded Corner Filigree Accents */}
      <div className={`${styles.cardCornerFoil} ${styles.cornerTopLeft}`} aria-hidden="true" />
      <div className={`${styles.cardCornerFoil} ${styles.cornerTopRight}`} aria-hidden="true" />
      <div className={`${styles.cardCornerFoil} ${styles.cornerBottomLeft}`} aria-hidden="true" />
      <div className={`${styles.cardCornerFoil} ${styles.cornerBottomRight}`} aria-hidden="true" />

      {/* Header */}
      <span className={styles.cardEyebrow}>Celebrate With Us</span>
      <h2 className={styles.cardTitleScript}>Our Story &amp; Wishes</h2>
      <p className={styles.cardSubtitle}>
        Explore the story of Hoàng &amp; Duyên or send your warmest blessings to our digital board
      </p>

      {/* Gold Filigree Divider */}
      <div className={styles.goldFiligreeDivider} aria-hidden="true">
        <div className={styles.goldFiligreeLine} />
        <span className={styles.goldFiligreeKnot}>❧</span>
        <div className={styles.goldFiligreeLine} />
      </div>

      {/* 2 Navigation Action Buttons */}
      <div className={styles.navButtonGroup}>
        {/* Button 1: Our Story */}
        <Link href="/" className={styles.navActionCard} aria-label="Go to Our Story">
          <div className={styles.navCardMain}>
            <div className={styles.navCardIcon} aria-hidden="true">
              <HanddrawnBook size={22} />
            </div>
            <span className={styles.navCardTitle}>Our Story</span>
          </div>
          <div className={styles.navCardArrow} aria-hidden="true">
            →
          </div>
        </Link>

        {/* Button 2: Wishes Board */}
        <Link
          href="/wishes"
          className={`${styles.navActionCard} ${styles.navActionCardPrimary}`}
          aria-label="Send your wishes on Wishes Board"
        >
          <div className={styles.navCardMain}>
            <div className={`${styles.navCardIcon} ${styles.navCardIconGold}`} aria-hidden="true">
              <HanddrawnEnvelope size={22} />
            </div>
            <span className={styles.navCardTitle}>Wishes Board</span>
          </div>
          <div className={styles.navCardArrow} aria-hidden="true">
            →
          </div>
        </Link>
      </div>
    </section>
  );
}
