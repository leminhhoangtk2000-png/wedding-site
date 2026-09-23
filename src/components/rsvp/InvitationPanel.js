'use client';

import { WEDDING_EVENT, generateGoogleCalendarUrl } from '@/lib/rsvpConstants';
import { HanddrawnCalendar, HanddrawnMapPin } from '@/components/icons/HanddrawnIcons';
import styles from '@/app/rsvp/rsvp.module.css';

export default function InvitationPanel() {
  return (
    <section className={styles.banquetCard} aria-label="Wedding Invitation Details">
      {/* Header */}
      <div className={styles.badgePill}>
        <span className={styles.badgeSparkle}>✦</span>
        <span>WEDDING INVITATION</span>
        <span className={styles.badgeSparkle}>✦</span>
      </div>

      <h2 className={styles.cardTitleScript}>{WEDDING_EVENT.couple}</h2>

      <p className={styles.cardSubtitle}>
        Cordially invite you to celebrate with us on our special day
      </p>

      {/* Gold Filigree Divider */}
      <div className={styles.goldFiligreeDivider} aria-hidden="true">
        <div className={styles.goldFiligreeLine} />
        <span className={styles.goldFiligreeKnot}>✦</span>
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
            <HanddrawnCalendar size={18} />
            <span>Google Calendar</span>
          </a>

          <a
            href={WEDDING_EVENT.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.invitationButtonOutline}
            aria-label="Open venue location on Google Maps"
          >
            <HanddrawnMapPin size={18} />
            <span>Get Directions</span>
          </a>
        </div>
      </div>
    </section>
  );
}
