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
    <div className={styles.banquetCard} aria-live="polite">
      {/* Gilded Corner Filigree Accents */}
      <div className={`${styles.cardCornerFoil} ${styles.cornerTopLeft}`} aria-hidden="true" />
      <div className={`${styles.cardCornerFoil} ${styles.cornerTopRight}`} aria-hidden="true" />
      <div className={`${styles.cardCornerFoil} ${styles.cornerBottomLeft}`} aria-hidden="true" />
      <div className={`${styles.cardCornerFoil} ${styles.cornerBottomRight}`} aria-hidden="true" />

      <div className={styles.confirmationBadge} aria-hidden="true">
        {isAttending ? '🕊️' : '💌'}
      </div>

      <span className={styles.cardEyebrow}>Response Confirmed</span>
      <h2 className={styles.cardTitleScript}>
        {isAttending ? 'See You There!' : 'Thank You!'}
      </h2>

      <div className={styles.goldFiligreeDivider} aria-hidden="true">
        <div className={styles.goldFiligreeLine} />
        <span className={styles.goldFiligreeKnot}>❧</span>
        <div className={styles.goldFiligreeLine} />
      </div>

      {isAttending ? (
        <div className={styles.confirmationBlock}>
          <div className={styles.invitationDateBig}>
            {guestName} · {guestCount} {guestCount === 1 ? 'guest attending' : 'guests attending'}
          </div>
          <p className={styles.cardSubtitle}>
            Your RSVP has been saved. We cannot wait to celebrate our special day together with you!
          </p>

          <div className={styles.invitationVenueCard}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <strong>📅 Date &amp; Time:</strong> {WEDDING_EVENT.dateDisplay} ({WEDDING_EVENT.timeDisplay})
              </div>
              <div>
                <strong>📍 Venue:</strong> {WEDDING_EVENT.venueName} — {WEDDING_EVENT.venueAddress}
              </div>
              {rsvpData?.dietary_notes && (
                <div>
                  <strong>🥗 Special Requests:</strong> {rsvpData.dietary_notes}
                </div>
              )}
            </div>
          </div>

          {/* Calendar & Map Actions */}
          <div className={styles.invitationActions}>
            <a
              href={generateGoogleCalendarUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.invitationButtonOutline}
            >
              <span>📅 Google Calendar</span>
            </a>

            <button
              type="button"
              onClick={downloadIcsFile}
              className={styles.invitationButtonOutline}
            >
              <span>🗓️ Download (.ics)</span>
            </button>

            <a
              href={WEDDING_EVENT.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.invitationButtonOutline}
            >
              <span>📍 Directions &amp; Map</span>
            </a>
          </div>
        </div>
      ) : (
        <div className={styles.confirmationBlock}>
          <div className={styles.invitationDateBig}>
            {guestName}
          </div>
          <p className={styles.cardSubtitle} style={{ maxWidth: 480 }}>
            We have received your response. Thank you so much for letting us know! Although you won&apos;t be able to join us in person, your warm wishes and thoughtful love mean the world to us.
          </p>
        </div>
      )}

      {/* Edit availability check */}
      <div style={{ marginTop: 28, textAlign: 'center' }}>
        {canEdit ? (
          <>
            <button
              type="button"
              onClick={onEdit}
              className={styles.invitationButtonOutline}
              style={{ padding: '10px 24px', fontSize: 16 }}
            >
              ✏️ Edit Your Response
            </button>
            <p style={{ fontSize: 12, color: '#728495', marginTop: 8 }}>
              You may update your response anytime until {WEDDING_EVENT.cutoffDisplay}.
            </p>
          </>
        ) : (
          <div style={{ fontSize: 14, color: '#888', fontStyle: 'italic', marginTop: 12 }}>
            RSVP responses are now finalized for event preparation. If you need any urgent changes, please contact the couple directly.
          </div>
        )}
      </div>
    </div>
  );
}
