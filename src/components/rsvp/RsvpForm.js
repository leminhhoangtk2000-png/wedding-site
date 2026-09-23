'use client';

import { useState, useRef } from 'react';
import { ATTENDANCE_VALUES, DIETARY_PRESETS, WEDDING_EVENT } from '@/lib/rsvpConstants';
import { HanddrawnAlert, HanddrawnLock, HanddrawnCheck, HanddrawnEnvelope } from '@/components/icons/HanddrawnIcons';
import AttendanceChoice from './AttendanceChoice';
import GuestCountField from './GuestCountField';
import ArrivalTimeField from './ArrivalTimeField';
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
  const [arrivalTime, setArrivalTime] = useState(initialData.arrival_time || initialData.attendance_time || '');
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
      errs.fullName = 'Họ và tên không vượt quá 100 ký tự.';
    }

    if (attendance === ATTENDANCE_VALUES.ATTENDING) {
      const count = parseInt(attendeeCount, 10);
      if (isNaN(count) || count < 1) {
        errs.attendeeCount = 'Số lượng khách phải từ 1 người trở lên.';
      }
      if (!arrivalTime || !arrivalTime.trim()) {
        errs.arrivalTime = 'Vui lòng chọn thời gian bạn dự kiến sẽ có mặt.';
      }
    }

    if (dietaryNotes && dietaryNotes.length > 500) {
      errs.dietaryNotes = 'Ghi chú ẩm thực không được vượt quá 500 ký tự.';
    }

    if (message && message.length > 1000) {
      errs.message = 'Lời nhắn không được vượt quá 1,000 ký tự.';
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
      arrival_time: attendance === ATTENDANCE_VALUES.ATTENDING && arrivalTime.trim() ? arrivalTime.trim() : null,
      dietary_notes: attendance === ATTENDANCE_VALUES.ATTENDING && dietaryNotes.trim() ? dietaryNotes.trim() : null,
      special_requests: attendance === ATTENDANCE_VALUES.ATTENDING && dietaryNotes.trim() ? dietaryNotes.trim() : null,
      message: message.trim() || null,
    };

    onSubmit(payload);
  };

  const isAttending = attendance === ATTENDANCE_VALUES.ATTENDING;

  return (
    <div className={styles.banquetCard} id="rsvp-form-section">
      {/* Decorative dashed inner frame is handled via CSS ::before */}

      <div className={styles.formHeader}>
        <div className={styles.badgePill}>
          <span className={styles.badgeSparkle}>✦</span>
          <span>{isEditing ? 'CẬP NHẬT THÔNG TIN' : 'THIỆP MỜI & XÁC NHẬN'}</span>
          <span className={styles.badgeSparkle}>✦</span>
        </div>

        <h2 className={styles.cardTitleScript}>
          {isEditing ? 'Cập Nhật Phản Hồi' : 'Xác Nhận Tham Dự'}
        </h2>

        <p className={styles.cardSubtitle}>
          Sự hiện diện của bạn là niềm vinh hạnh và hạnh phúc lớn của Hoàng &amp; Duyên. Xin vui lòng gửi phản hồi trước{' '}
          <strong>{WEDDING_EVENT.cutoffDisplay}</strong> nhé!
        </p>

        <div className={styles.goldFiligreeDivider} aria-hidden="true">
          <div className={styles.goldFiligreeLine} />
          <span className={styles.goldFiligreeKnot}>✦</span>
          <div className={styles.goldFiligreeLine} />
        </div>
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
            placeholder="Ví dụ: Nguyễn Văn An, Trần Thị Mai..."
            maxLength={100}
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: null }));
            }}
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
          <div className={styles.attendingDetailsWrapper}>
            <GuestCountField
              value={attendeeCount}
              onChange={(val) => setAttendeeCount(val)}
              error={errors.attendeeCount}
              disabled={submitting}
            />

            {/* Arrival Time Selection */}
            <ArrivalTimeField
              value={arrivalTime}
              onChange={(val) => {
                setArrivalTime(val);
                if (errors.arrivalTime) setErrors((prev) => ({ ...prev, arrivalTime: null }));
              }}
              error={errors.arrivalTime}
              disabled={submitting}
            />

            {/* Special Requests (Dietary, Allergies) */}
            <div className={styles.formGroup}>
              <label htmlFor="rsvp-dietary" className={styles.label}>
                Yêu cầu chế độ ăn uống &amp; Dị ứng <span className={styles.optionalTag}>(tuỳ chọn)</span>
              </label>
              <div className={styles.fieldHint}>
                Nhà hàng sẽ chuẩn bị khẩu phần ăn riêng phù hợp và chu đáo cho bạn.
              </div>

              {/* Quick Preset Chips */}
              <div className={styles.chipsContainer} role="group" aria-label="Gợi ý chế độ ăn uống">
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
                      {isActive ? (
                        <HanddrawnCheck size={12} strokeWidth={2.4} style={{ marginRight: 4 }} />
                      ) : (
                        <span style={{ marginRight: 4 }}>+</span>
                      )}
                      <span>{preset}</span>
                    </button>
                  );
                })}
              </div>

              <textarea
                id="rsvp-dietary"
                rows={2}
                maxLength={500}
                placeholder="Ghi chú thêm về món ăn hoặc khẩu vị đặc biệt (nếu có)..."
                value={dietaryNotes}
                onChange={(e) => setDietaryNotes(e.target.value)}
                disabled={submitting}
                className={styles.textarea}
              />
            </div>
          </div>
        )}

        {/* Optional Message */}
        <div className={styles.formGroup}>
          <label htmlFor="rsvp-message" className={styles.label}>
            Lời nhắn gửi đến Hoàng &amp; Duyên <span className={styles.optionalTag}>(tuỳ chọn)</span>
          </label>
          <textarea
            id="rsvp-message"
            rows={3}
            maxLength={1000}
            placeholder="Gửi gắm một lời chúc, kỷ niệm hoặc bài hát bạn muốn nghe trong tiệc cưới..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={submitting}
            className={styles.textarea}
          />
        </div>

        {/* Submit Error feedback */}
        {submitError && (
          <div className={styles.fieldError} role="alert" style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <HanddrawnAlert size={16} />
            <span>{submitError}</span>
          </div>
        )}

        {/* Privacy reassurance */}
        <p className={styles.privacyNotice} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <HanddrawnLock size={15} />
          <span>Thông tin phản hồi được lưu trữ bảo mật và chỉ dùng cho công tác tổ chức hôn lễ.</span>
        </p>

        {/* Submit CTA */}
        <div className={styles.submitRow}>
          <button
            type="submit"
            disabled={submitting || offline}
            className={`${styles.submitBtn} ${!isAttending ? styles.submitBtnDecline : ''}`}
          >
            {submitting ? (
              <span className={styles.submittingInner}>
                <span className={styles.spinner} aria-hidden="true" />
                <span>Đang ghi nhận...</span>
              </span>
            ) : isAttending ? (
              <span className={styles.submitBtnContent}>
                <span>{isEditing ? 'Lưu cập nhật phản hồi' : 'Xác nhận tham dự ngay'}</span>
                <span className={styles.submitArrow}>→</span>
              </span>
            ) : (
              <span className={styles.submitBtnContent}>
                <span>{isEditing ? 'Lưu phản hồi tiếc nuối' : 'Gửi phản hồi tiếc nuối'}</span>
                <HanddrawnEnvelope size={16} />
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
