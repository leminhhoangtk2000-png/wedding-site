'use client';

import { WEDDING_EVENT, generateGoogleCalendarUrl, downloadIcsFile } from '@/lib/rsvpConstants';
import styles from '@/app/rsvp/rsvp.module.css';

export default function InvitationPanel() {
  return (
    <section className={styles.banquetCard} aria-label="Wedding Save The Date invitation details">
      {/* Gilded Corner Filigree Accents */}
      <div className={`${styles.cardCornerFoil} ${styles.cornerTopLeft}`} aria-hidden="true" />
      <div className={`${styles.cardCornerFoil} ${styles.cornerTopRight}`} aria-hidden="true" />
      <div className={`${styles.cardCornerFoil} ${styles.cornerBottomLeft}`} aria-hidden="true" />
      <div className={`${styles.cardCornerFoil} ${styles.cornerBottomRight}`} aria-hidden="true" />

      {/* Header */}
      <span className={styles.cardEyebrow}>Wedding Celebration</span>
      <h2 className={styles.cardTitleScript}>{WEDDING_EVENT.couple}</h2>
      <p className={styles.cardSubtitle}>
        Together with their families, invite you to celebrate their union
      </p>

      {/* Gold Filigree Divider */}
      <div className={styles.goldFiligreeDivider} aria-hidden="true">
        <div className={styles.goldFiligreeLine} />
        <span className={styles.goldFiligreeKnot}>❧</span>
        <div className={styles.goldFiligreeLine} />
      </div>

      {/* Date & Ceremony Highlights */}
      <div className={styles.invitationDetailsBlock}>
        <div className={styles.invitationDateBig}>{WEDDING_EVENT.dateDisplay}</div>
        <div className={styles.invitationTime}>{WEDDING_EVENT.timeDisplay}</div>

        {/* Venue Location Card */}
        <div className={styles.invitationVenueCard}>
          <h3 className={styles.invitationVenueName}>{WEDDING_EVENT.venueName}</h3>
          <p className={styles.invitationVenueAddr}>{WEDDING_EVENT.venueAddress}</p>
        </div>

        {/* Action Buttons: Calendar & Map */}
        <div className={styles.invitationActions}>
          <a
            href={generateGoogleCalendarUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.invitationButtonOutline}
            aria-label="Add wedding to Google Calendar"
          >
            <span>📅 Add to Google Calendar</span>
          </a>

          <button
            type="button"
            onClick={downloadIcsFile}
            className={styles.invitationButtonOutline}
            aria-label="Download ICS calendar file for Apple Calendar or Outlook"
          >
            <span>🗓️ Download .ICS</span>
          </button>

          <a
            href={WEDDING_EVENT.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.invitationButtonOutline}
            aria-label="Open venue address on Google Maps"
          >
            <span>📍 View on Google Maps</span>
          </a>
        </div>
      </div>
    </section>
  );
}
