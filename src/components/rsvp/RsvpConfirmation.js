'use client';

import Link from 'next/link';
import { WEDDING_EVENT, ATTENDANCE_VALUES, generateGoogleCalendarUrl } from '@/lib/rsvpConstants';
import {
  HanddrawnCalendar,
  HanddrawnMapPin,
  HanddrawnCelebration,
  HanddrawnEnvelope,
  HanddrawnLeaf,
  HanddrawnClock,
} from '@/components/icons/HanddrawnIcons';
import styles from '@/app/rsvp/rsvp.module.css';

export default function RsvpConfirmation({
  rsvpData,
  canEdit = true,
  onEdit,
}) {
  const isAttending = rsvpData?.attendance === ATTENDANCE_VALUES.ATTENDING;
  const guestCount = rsvpData?.attendee_count || 1;
  const guestName = rsvpData?.full_name || rsvpData?.guest_name || 'Valued Guest';

  return (
    <div className={styles.banquetCard} aria-live="polite">
      <div className={styles.formHeader}>
        <div className={styles.badgePill}>
          <span className={styles.badgeSparkle}>✦</span>
          <span>{isAttending ? 'RESPONSE CONFIRMED' : 'THANK YOU FOR REPLYING'}</span>
          <span className={styles.badgeSparkle}>✦</span>
        </div>

        <h2 className={styles.cardTitleScript}>
          {isAttending ? 'We Look Forward to Seeing You!' : 'Thank You for Your Warm Wishes'}
        </h2>

        <div className={styles.goldFiligreeDivider} aria-hidden="true">
          <div className={styles.goldFiligreeLine} />
          <span className={styles.goldFiligreeKnot}>✦</span>
          <div className={styles.goldFiligreeLine} />
        </div>
      </div>

      {isAttending ? (
        <div className={styles.confirmationBlock}>
          <div className={styles.guestHighlightBox}>
            <span className={styles.guestHighlightIcon}>
              <HanddrawnCelebration size={28} />
            </span>
            <div>
              <strong className={styles.guestHighlightName}>{guestName}</strong>
              <div className={styles.guestHighlightCount}>
                Attendance confirmed: <strong>{guestCount}</strong> {guestCount === 1 ? 'guest' : 'guests'}
              </div>
            </div>
          </div>

          <p className={styles.cardSubtitle} style={{ marginTop: 14 }}>
            Hoàng &amp; Duyên are thrilled and cannot wait to celebrate our special day with you!
          </p>

          <div className={styles.invitationVenueCard}>
            <div className={styles.eventInfoList}>
              <div className={styles.eventInfoItem}>
                <span className={styles.eventInfoIcon}>
                  <HanddrawnCalendar size={18} />
                </span>
                <div>
                  <strong>Time:</strong> {WEDDING_EVENT.dateDisplay} ({WEDDING_EVENT.timeDisplay})
                </div>
              </div>
              <div className={styles.eventInfoItem}>
                <span className={styles.eventInfoIcon}>
                  <HanddrawnMapPin size={18} />
                </span>
                <div>
                  <strong>Venue:</strong> {WEDDING_EVENT.venueName} — {WEDDING_EVENT.venueAddress}
                </div>
              </div>
              {rsvpData?.arrival_time && (
                <div className={styles.eventInfoItem}>
                  <span className={styles.eventInfoIcon}>
                    <HanddrawnClock size={18} />
                  </span>
                  <div>
                    <strong>Expected arrival:</strong> {rsvpData.arrival_time}
                  </div>
                </div>
              )}
              {rsvpData?.dietary_notes && (
                <div className={styles.eventInfoItem}>
                  <span className={styles.eventInfoIcon}>
                    <HanddrawnLeaf size={18} />
                  </span>
                  <div>
                    <strong>Dietary requests:</strong> {rsvpData.dietary_notes}
                  </div>
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
              <HanddrawnCalendar size={18} />
              <span>Add to Google Calendar</span>
            </a>

            <a
              href={WEDDING_EVENT.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.invitationButtonOutline}
            >
              <HanddrawnMapPin size={18} />
              <span>Get Directions</span>
            </a>
          </div>

          {/* Edit action */}
          {canEdit && (
            <div className={styles.editPrompt}>
              <button
                type="button"
                onClick={onEdit}
                className={styles.textLinkBtn}
              >
                Need to update your plans or guest count? Click here to edit
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.confirmationBlock}>
          <div className={styles.guestHighlightBox}>
            <span className={styles.guestHighlightIcon}>
              <HanddrawnEnvelope size={28} />
            </span>
            <div>
              <strong className={styles.guestHighlightName}>{guestName}</strong>
              <div className={styles.guestHighlightCount}>Sending warmest blessings from afar</div>
            </div>
          </div>

          <p className={styles.cardSubtitle} style={{ maxWidth: 520, margin: '16px auto 24px' }}>
            Though we will miss having you with us, Hoàng &amp; Duyên truly cherish your love, support, and warm blessings on this new journey.
          </p>

          <div className={styles.invitationActions}>
            <Link href="/wishes" className={styles.submitBtn} style={{ textDecoration: 'none', display: 'inline-flex' }}>
              <span>Leave a Message in Our Guestbook →</span>
            </Link>

            {canEdit && (
              <button
                type="button"
                onClick={onEdit}
                className={styles.invitationButtonOutline}
              >
                <span>Changed your mind? Update your RSVP</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
