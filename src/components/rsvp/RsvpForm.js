'use client';

import { useState, useRef, useEffect } from 'react';
import { ATTENDANCE_VALUES, DIETARY_PRESETS } from '@/lib/rsvpConstants';
import AttendanceChoice from './AttendanceChoice';
import GuestCountField from './GuestCountField';
import styles from '@/app/rsvp/rsvp.module.css';

export default function RsvpForm({
  initialData = {},
  isEditing = false,
  submitting = false,
  submitError = '',
  offline = false,
  onSubmit,
}) {
  const [fullName, setFullName] = useState(initialData.full_name || initialData.guest_name || '');
  const [attendance, setAttendance] = useState(initialData.attendance || ATTENDANCE_VALUES.ATTENDING);
  const [attendeeCount, setAttendeeCount] = useState(
    initialData.attendee_count && initialData.attendee_count > 0 ? initialData.attendee_count : 1
  );
  const [dietaryNotes, setDietaryNotes] = useState(initialData.dietary_notes || initialData.special_requests || '');
  const [message, setMessage] = useState(initialData.message || '');
  const [errors, setErrors] = useState({});

  const nameInputRef = useRef(null);

  const validate = () => {
    const errs = {};
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      errs.fullName = 'Vui lòng nhập họ và tên của bạn.';
    } else if (trimmedName.length < 2) {
      errs.fullName = 'Họ và tên quá ngắn (tối thiểu 2 ký tự).';
    } else if (trimmedName.length > 100) {
      errs.fullName = 'Họ và tên tối đa 100 ký tự.';
    }

    if (attendance === ATTENDANCE_VALUES.ATTENDING) {
      const count = parseInt(attendeeCount, 10);
      if (isNaN(count) || count < 1) {
        errs.attendeeCount = 'Số lượng khách phải từ 1 người trở lên.';
      }
    }

    if (dietaryNotes && dietaryNotes.length > 500) {
      errs.dietaryNotes = 'Yêu cầu đặc biệt tối đa 500 ký tự.';
    }

    if (message && message.length > 1000) {
      errs.message = 'Lời nhắn tối đa 1000 ký tự.';
    }

    setErrors(errs);

    if (errs.fullName && nameInputRef.current) {
      nameInputRef.current.focus();
    }

    return Object.keys(errs).length === 0;
  };

  const handleAddPresetDietary = (preset) => {
    if (dietaryNotes.includes(preset)) {
      // Remove preset
      const updated = dietaryNotes
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== preset)
        .join(', ');
      setDietaryNotes(updated);
    } else {
      // Append preset
      const updated = dietaryNotes ? `${dietaryNotes.trim()}, ${preset}` : preset;
      setDietaryNotes(updated);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!validate()) {
      return;
    }

    const payload = {
      full_name: fullName.trim(),
      guest_name: fullName.trim(),
      attendance,
      attendee_count: attendance === ATTENDANCE_VALUES.ATTENDING ? parseInt(attendeeCount, 10) || 1 : 0,
      dietary_notes: attendance === ATTENDANCE_VALUES.ATTENDING && dietaryNotes.trim() ? dietaryNotes.trim() : null,
      special_requests: attendance === ATTENDANCE_VALUES.ATTENDING && dietaryNotes.trim() ? dietaryNotes.trim() : null,
      message: message.trim() || null,
    };

    onSubmit(payload);
  };

  const isAttending = attendance === ATTENDANCE_VALUES.ATTENDING;

  return (
    <div className={styles.rsvpFormCard} id="rsvp-form-section">
      <div className={styles.formHeader}>
        <span className={styles.formEyebrow}>
          {isEditing ? 'Cập nhật thông tin' : 'Lời mời chung vui'}
        </span>
        <h2 className={styles.formTitle}>
          {isEditing ? 'Chỉnh Sửa Phản Hồi' : 'Xác Nhận Tham Dự'}
        </h2>
        <p className={styles.formSubtitle}>
          Hãy cho Hoàng &amp; Duyên biết kế hoạch của bạn để chúng mình chuẩn bị đón tiếp thật chu đáo nhé!
        </p>
      </div>

      <form onSubmit={handleSubmit} className={styles.rsvpForm} noValidate>
        {/* Full Name */}
        <div className={styles.formGroup}>
          <label htmlFor="rsvp-fullname" className={styles.label}>
            Họ và tên của bạn <span className={styles.requiredStar}>*</span>
          </label>
          <input
            ref={nameInputRef}
            id="rsvp-fullname"
            type="text"
            placeholder="Ví dụ: Nguyễn Văn A"
            maxLength={100}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={submitting}
            className={`${styles.input} ${errors.fullName ? styles.inputError : ''}`}
            aria-required="true"
            aria-invalid={Boolean(errors.fullName)}
            aria-describedby={errors.fullName ? 'fullname-error' : undefined}
          />
          {errors.fullName && (
            <p id="fullname-error" className={styles.fieldError} role="alert">
              {errors.fullName}
            </p>
          )}
        </div>

        {/* Attendance Segmented Radio Choice */}
        <AttendanceChoice
          value={attendance}
          onChange={(newVal) => setAttendance(newVal)}
          disabled={submitting}
        />

        {/* Conditional Attendee Count & Special Requests when Attending */}
        {isAttending && (
          <>
            <GuestCountField
              value={attendeeCount}
              onChange={(val) => setAttendeeCount(val)}
              error={errors.attendeeCount}
              disabled={submitting}
            />

            {/* Special Requests (Dietary, Allergies) */}
            <div className={styles.formGroup}>
              <label htmlFor="rsvp-dietary" className={styles.label}>
                Yêu cầu đặc biệt về ẩm thực (nếu có)
              </label>
              <div className={styles.fieldHint}>
                Ví dụ: món chay, dị ứng thực phẩm hoặc hỗ trợ đặc biệt.
              </div>

              {/* Quick Preset Chips */}
              <div className={styles.chipsContainer} role="group" aria-label="Gợi ý yêu cầu món ăn">
                {DIETARY_PRESETS.map((preset) => {
                  const isActive = dietaryNotes.includes(preset);
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleAddPresetDietary(preset)}
                      disabled={submitting}
                      className={`${styles.chipButton} ${isActive ? styles.chipButtonActive : ''}`}
                    >
                      {isActive ? '✓ ' : '+ '}
                      {preset}
                    </button>
                  );
                })}
              </div>

              <textarea
                id="rsvp-dietary"
                rows={2}
                maxLength={500}
                placeholder="Ghi chú thêm về món ăn hoặc lưu ý khác..."
                value={dietaryNotes}
                onChange={(e) => setDietaryNotes(e.target.value)}
                disabled={submitting}
                className={styles.textarea}
              />
            </div>
          </>
        )}

        {/* Optional Message */}
        <div className={styles.formGroup}>
          <label htmlFor="rsvp-message" className={styles.label}>
            Lời nhắn gửi đến cô dâu &amp; chú rể (tùy chọn)
          </label>
          <textarea
            id="rsvp-message"
            rows={3}
            maxLength={1000}
            placeholder="Gửi gắm điều gì đó thật ấm áp nhé..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={submitting}
            className={styles.textarea}
          />
        </div>

        {/* Submit Error feedback */}
        {submitError && (
          <div className={styles.fieldError} role="alert" style={{ fontSize: 14 }}>
            ⚠️ {submitError}
          </div>
        )}

        {/* Privacy reassurance */}
        <p className={styles.privacyNotice}>
          🔒 Thông tin của bạn chỉ được dùng để chuẩn bị cho tiệc cưới này.
        </p>

        {/* Submit CTA */}
        <button
          type="submit"
          disabled={submitting || offline}
          className={`${styles.submitBtn} ${!isAttending ? styles.submitBtnDecline : ''}`}
        >
          {submitting ? (
            <span>Đang gửi phản hồi…</span>
          ) : isAttending ? (
            <span>{isEditing ? 'Lưu thay đổi' : 'Gửi xác nhận'}</span>
          ) : (
            <span>{isEditing ? 'Lưu thay đổi' : 'Xác nhận không tham dự'}</span>
          )}
        </button>
      </form>
    </div>
  );
}
