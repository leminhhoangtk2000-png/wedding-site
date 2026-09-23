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
  const guestName = rsvpData?.full_name || rsvpData?.guest_name || 'Quý khách';

  return (
    <div className={styles.banquetCard} aria-live="polite">
      <div className={styles.formHeader}>
        <div className={styles.badgePill}>
          <span className={styles.badgeSparkle}>✦</span>
          <span>{isAttending ? 'ĐÃ GHI NHẬN PHẢN HỒI' : 'CẢM ƠN LỜI HỒI ĐÁP'}</span>
          <span className={styles.badgeSparkle}>✦</span>
        </div>

        <h2 className={styles.cardTitleScript}>
          {isAttending ? 'Hẹn Gặp Bạn Tại Buổi Tiệc!' : 'Cảm Ơn Tình Cảm Của Bạn'}
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
                Xác nhận tham dự: <strong>{guestCount}</strong> {guestCount === 1 ? 'người' : 'khách'}
              </div>
            </div>
          </div>

          <p className={styles.cardSubtitle} style={{ marginTop: 14 }}>
            Hoàng &amp; Duyên rất hạnh phúc và mong chờ được đón tiếp bạn trong ngày vui trọng đại của tụi mình!
          </p>

          <div className={styles.invitationVenueCard}>
            <div className={styles.eventInfoList}>
              <div className={styles.eventInfoItem}>
                <span className={styles.eventInfoIcon}>
                  <HanddrawnCalendar size={18} />
                </span>
                <div>
                  <strong>Thời gian:</strong> {WEDDING_EVENT.dateDisplay} ({WEDDING_EVENT.timeDisplay})
                </div>
              </div>
              <div className={styles.eventInfoItem}>
                <span className={styles.eventInfoIcon}>
                  <HanddrawnMapPin size={18} />
                </span>
                <div>
                  <strong>Địa điểm:</strong> {WEDDING_EVENT.venueName} — {WEDDING_EVENT.venueAddress}
                </div>
              </div>
              {rsvpData?.arrival_time && (
                <div className={styles.eventInfoItem}>
                  <span className={styles.eventInfoIcon}>
                    <HanddrawnClock size={18} />
                  </span>
                  <div>
                    <strong>Thời gian có mặt dự kiến:</strong> {rsvpData.arrival_time}
                  </div>
                </div>
              )}
              {rsvpData?.dietary_notes && (
                <div className={styles.eventInfoItem}>
                  <span className={styles.eventInfoIcon}>
                    <HanddrawnLeaf size={18} />
                  </span>
                  <div>
                    <strong>Khẩu phần ăn riêng:</strong> {rsvpData.dietary_notes}
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
              <span>Thêm vào Google Calendar</span>
            </a>

            <a
              href={WEDDING_EVENT.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.invitationButtonOutline}
            >
              <HanddrawnMapPin size={18} />
              <span>Xem chỉ đường Google Maps</span>
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
                Cần thay đổi thông tin hoặc số lượng người? Bấm vào đây để chỉnh sửa
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
              <div className={styles.guestHighlightCount}>Đã gửi lời chúc phúc từ xa</div>
            </div>
          </div>

          <p className={styles.cardSubtitle} style={{ maxWidth: 520, margin: '16px auto 24px' }}>
            Dù rất tiếc vì không thể gặp bạn trong ngày vui, Hoàng &amp; Duyên vô cùng trân trọng tình cảm và lời chúc phúc của bạn trên chặng đường mới này.
          </p>

          <div className={styles.invitationActions}>
            <Link href="/wishes" className={styles.submitBtn} style={{ textDecoration: 'none', display: 'inline-flex' }}>
              <span>Gửi lời chúc vào Sổ Lưu Bút →</span>
            </Link>

            {canEdit && (
              <button
                type="button"
                onClick={onEdit}
                className={styles.invitationButtonOutline}
              >
                <span>Thay đổi ý định? Cập nhật lại phản hồi</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
