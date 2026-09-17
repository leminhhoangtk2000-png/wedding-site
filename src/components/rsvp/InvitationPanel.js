'use client';

import Image from 'next/image';
import styles from '@/app/rsvp/rsvp.module.css';

export default function InvitationPanel() {
  return (
    <section className={styles.trifoldCard} aria-label="Thiệp mời Save The Date">
      <div className={styles.saveTheDateCard}>
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

        {/* Card Typography Content */}
        <div className={styles.saveDateContent}>
          <h2 className={styles.saveDateTitle}>Save The Date</h2>
          <div className={styles.saveDateTag}>October 3rd 2026</div>
          <div className={styles.saveDateNames}>Hoàng &amp; Duyên</div>
          <div className={styles.saveDateVenue}>Hidden Haven</div>
          <div className={styles.saveDateAddress}>393/21 Bình Quới</div>
        </div>

        {/* Bottom Celebration Illustrations (Figma Node 131:50) */}
        <div className={styles.saveDateIllustrations} aria-hidden="true">
          <Image
            src="/rsvp/layers/illustration_couple.png"
            alt=""
            width={240}
            height={320}
            className={styles.artCouple}
          />
          <Image
            src="/rsvp/layers/illustration_champagne.png"
            alt=""
            width={140}
            height={150}
            className={styles.artChampagne}
          />
          <Image
            src="/rsvp/layers/illustration_flower.png"
            alt=""
            width={100}
            height={98}
            className={styles.artFlower}
          />
          <Image
            src="/rsvp/layers/illustration_table.png"
            alt=""
            width={230}
            height={270}
            className={styles.artTable}
          />
        </div>
      </div>
    </section>
  );
}
