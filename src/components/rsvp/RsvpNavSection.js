'use client';

import Link from 'next/link';
import { HanddrawnBook, HanddrawnEnvelope } from '@/components/icons/HanddrawnIcons';
import styles from '@/app/rsvp/rsvp.module.css';

export default function RsvpNavSection() {
  return (
    <section className={`${styles.banquetCard} ${styles.navSectionCard}`} aria-label="Khám phá câu chuyện và sổ lưu bút">
      {/* Header */}
      <div className={styles.badgePill}>
        <span className={styles.badgeSparkle}>✦</span>
        <span>CÂU CHUYỆN</span>
        <span className={styles.badgeSparkle}>✦</span>
      </div>

      <h2 className={styles.cardTitleScript}>Câu Chuyện &amp; Sổ Lưu Bút</h2>
      <p className={styles.cardSubtitle}>
        Khám phá câu chuyện 10 năm của Hoàng &amp; Duyên hoặc gửi gắm những lời chúc kỷ niệm trên sổ lưu bút nhé!
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
        <Link href="/" className={styles.navActionCard} aria-label="Xem câu chuyện">
          <div className={styles.navCardMain}>
            <div className={styles.navCardIcon} aria-hidden="true">
              <HanddrawnBook size={24} />
            </div>
            <div>
              <div className={styles.navCardTitle}>Câu Chuyện</div>
              <div className={styles.navCardSub}>10 năm bên nhau</div>
            </div>
          </div>
          <div className={styles.navCardArrow} aria-hidden="true">
            →
          </div>
        </Link>

        {/* Button 2: Wishes Board */}
        <Link
          href="/wishes"
          className={`${styles.navActionCard} ${styles.navActionCardPrimary}`}
          aria-label="Gửi lời chúc trên Sổ Lưu Bút"
        >
          <div className={styles.navCardMain}>
            <div className={`${styles.navCardIcon} ${styles.navCardIconGold}`} aria-hidden="true">
              <HanddrawnEnvelope size={24} />
            </div>
            <div>
              <div className={styles.navCardTitle}>Sổ Lưu Bút</div>
              <div className={styles.navCardSub}>Gửi lời chúc &amp; hình ảnh</div>
            </div>
          </div>
          <div className={styles.navCardArrow} aria-hidden="true">
            →
          </div>
        </Link>
      </div>
    </section>
  );
}
