'use client';

import { WEDDING_EVENT, ATTENDANCE_VALUES, generateGoogleCalendarUrl, downloadIcsFile } from '@/lib/rsvpConstants';
import styles from '@/app/rsvp/rsvp.module.css';

export default function RsvpConfirmation({
  rsvpData,
  canEdit = true,
  onEdit,
}) {
  const isAttending = rsvpData?.attendance === ATTENDANCE_VALUES.ATTENDING;
  const guestCount = rsvpData?.attendee_count || 1;
  const guestName = rsvpData?.full_name || rsvpData?.guest_name || 'Guest';

  return (
    <div className={styles.confirmationCard} aria-live="polite">
      <div className={styles.confirmationBadge} aria-hidden="true">
        {isAttending ? '🌸' : '🌿'}
      </div>

      <h2 className={styles.confirmationTitle}>
        {isAttending ? 'See You There!' : 'Thank You!'}
      </h2>

      {isAttending ? (
        <>
          <div className={styles.confirmationParty}>
            {guestName} · {guestCount} {guestCount === 1 ? 'guest attending' : 'guests attending'}
          </div>
          <p className={styles.confirmationText}>
            Your RSVP has been confirmed. We can&apos;t wait to celebrate our special day with you!
          </p>

          <div className={styles.confirmationDetailsBox}>
            <div className={styles.confirmDetailItem}>
              <span className={styles.confirmDetailIcon} aria-hidden="true">📅</span>
              <span><strong>Date &amp; Time:</strong> {WEDDING_EVENT.dateDisplay} ({WEDDING_EVENT.timeDisplay})</span>
            </div>
            <div className={styles.confirmDetailItem}>
              <span className={styles.confirmDetailIcon} aria-hidden="true">📍</span>
              <span><strong>Venue:</strong> {WEDDING_EVENT.venueName} — {WEDDING_EVENT.venueAddress}</span>
            </div>
            {rsvpData?.dietary_notes && (
              <div className={styles.confirmDetailItem}>
                <span className={styles.confirmDetailIcon} aria-hidden="true">🥗</span>
                <span><strong>Special Requests:</strong> {rsvpData.dietary_notes}</span>
              </div>
            )}
          </div>

          {/* Calendar & Map Actions */}
          <div className={styles.confirmationActions}>
            <a
              href={generateGoogleCalendarUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.confirmActionBtn} ${styles.confirmActionPrimary}`}
            >
              <span>+ Google Calendar</span>
            </a>

            <button
              type="button"
              onClick={downloadIcsFile}
              className={`${styles.confirmActionBtn} ${styles.confirmActionSecondary}`}
            >
              <span>Download (.ics)</span>
            </button>

            <a
              href={WEDDING_EVENT.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.confirmActionBtn} ${styles.confirmActionSecondary}`}
            >
              <span>Directions &amp; Map</span>
            </a>
          </div>
        </>
      ) : (
        <>
          <div className={styles.confirmationParty}>
            {guestName}
          </div>
          <p className={styles.confirmationText}>
            We have received your response. Thank you so much for letting us know! Although you won&apos;t be able to join us in person, your warm wishes and thoughtful love mean the world to us.
          </p>
        </>
      )}

      {/* Edit availability check */}
      {canEdit ? (
        <div style={{ marginTop: 28 }}>
          <button
            type="button"
            onClick={onEdit}
            className={`${styles.confirmActionBtn} ${styles.confirmActionSecondary}`}
            style={{ fontSize: 15 }}
          >
            ✏️ Edit Response
          </button>
          <p style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
            You can update your response until {WEDDING_EVENT.cutoffDisplay}.
          </p>
        </div>
      ) : (
        <div className={styles.editNoticeBox}>
          RSVP responses are now finalized for event preparation. If you need any urgent changes, please contact the couple directly.
        </div>
      )}
    </div>
  );
}
