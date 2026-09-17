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
  const guestName = rsvpData?.full_name || rsvpData?.guest_name || 'Bạn';

  return (
    <div className={styles.confirmationCard} aria-live="polite">
      <div className={styles.confirmationBadge} aria-hidden="true">
        {isAttending ? '🌸' : '🌿'}
      </div>

      <h2 className={styles.confirmationTitle}>
        {isAttending ? 'Hẹn Gặp Bạn Nhé!' : 'Cảm Ơn Bạn!'}
      </h2>

      {isAttending ? (
        <>
          <div className={styles.confirmationParty}>
            {guestName} · {guestCount} người tham dự
          </div>
          <p className={styles.confirmationText}>
            Tụi mình đã ghi nhận thông tin và rất háo hức được đón tiếp bạn trong ngày vui của tụi mình!
          </p>

          <div className={styles.confirmationDetailsBox}>
            <div className={styles.confirmDetailItem}>
              <span className={styles.confirmDetailIcon} aria-hidden="true">📅</span>
              <span><strong>Thời gian:</strong> {WEDDING_EVENT.timeDisplay}</span>
            </div>
            <div className={styles.confirmDetailItem}>
              <span className={styles.confirmDetailIcon} aria-hidden="true">📍</span>
              <span><strong>Địa điểm:</strong> {WEDDING_EVENT.venueName} — {WEDDING_EVENT.venueAddress}</span>
            </div>
            {rsvpData?.dietary_notes && (
              <div className={styles.confirmDetailItem}>
                <span className={styles.confirmDetailIcon} aria-hidden="true">🥗</span>
                <span><strong>Ghi chú:</strong> {rsvpData.dietary_notes}</span>
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
              <span>Tải file lịch (.ics)</span>
            </button>

            <a
              href={WEDDING_EVENT.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.confirmActionBtn} ${styles.confirmActionSecondary}`}
            >
              <span>Bản đồ đường đi</span>
            </a>
          </div>
        </>
      ) : (
        <>
          <div className={styles.confirmationParty}>
            {guestName}
          </div>
          <p className={styles.confirmationText}>
            Tụi mình đã nhận được phản hồi. Cảm ơn bạn đã dành thời gian báo cho tụi mình biết nhé. Dù không thể chung vui trực tiếp, những lời chúc tốt đẹp của bạn vẫn luôn là món quà quý giá đối với tụi mình!
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
            ✏️ Chỉnh sửa phản hồi
          </button>
          <p style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
            Bạn có thể chỉnh sửa phản hồi trước {WEDDING_EVENT.cutoffDisplay}.
          </p>
        </div>
      ) : (
        <div className={styles.editNoticeBox}>
          Phản hồi đã được chốt để tụi mình chuẩn bị chu đáo. Nếu cần thay đổi gấp, vui lòng liên hệ trực tiếp với tụi mình qua điện thoại hoặc tin nhắn.
        </div>
      )}
    </div>
  );
}
