'use client';

import { useState, useRef } from 'react';
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
      errs.fullName = 'Please enter your full name.';
    } else if (trimmedName.length < 2) {
      errs.fullName = 'Full name is too short (minimum 2 characters).';
    } else if (trimmedName.length > 100) {
      errs.fullName = 'Full name must not exceed 100 characters.';
    }

    if (attendance === ATTENDANCE_VALUES.ATTENDING) {
      const count = parseInt(attendeeCount, 10);
      if (isNaN(count) || count < 1) {
        errs.attendeeCount = 'Guest count must be at least 1.';
      }
    }

    if (dietaryNotes && dietaryNotes.length > 500) {
      errs.dietaryNotes = 'Special requests must not exceed 500 characters.';
    }

    if (message && message.length > 1000) {
      errs.message = 'Message must not exceed 1,000 characters.';
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
    <div className={styles.banquetCard} id="rsvp-form-section">
      {/* Gilded Corner Filigree Accents */}
      <div className={`${styles.cardCornerFoil} ${styles.cornerTopLeft}`} aria-hidden="true" />
      <div className={`${styles.cardCornerFoil} ${styles.cornerTopRight}`} aria-hidden="true" />
      <div className={`${styles.cardCornerFoil} ${styles.cornerBottomLeft}`} aria-hidden="true" />
      <div className={`${styles.cardCornerFoil} ${styles.cornerBottomRight}`} aria-hidden="true" />

      <div className={styles.formHeader}>
        <span className={styles.cardEyebrow}>
          {isEditing ? 'Update Details' : 'Kindly Reply by September 30, 2026'}
        </span>
        <h2 className={styles.cardTitleScript}>
          {isEditing ? 'Edit Response' : 'RSVP'}
        </h2>
        <p className={styles.cardSubtitle}>
          Please let Hoàng &amp; Duyên know your plans so we can prepare the best experience for you!
        </p>
        <div className={styles.goldFiligreeDivider} aria-hidden="true">
          <div className={styles.goldFiligreeLine} />
          <span className={styles.goldFiligreeKnot}>❧</span>
          <div className={styles.goldFiligreeLine} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.rsvpForm} noValidate>
        {/* Full Name */}
        <div className={styles.formGroup}>
          <label htmlFor="rsvp-fullname" className={styles.label}>
            Your Full Name <span className={styles.requiredStar}>*</span>
          </label>
          <input
            ref={nameInputRef}
            id="rsvp-fullname"
            type="text"
            placeholder="e.g. Eleanor Vance"
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
                Dietary restrictions &amp; special requests (optional)
              </label>
              <div className={styles.fieldHint}>
                e.g. Vegetarian, seafood allergy, or any special accommodations.
              </div>

              {/* Quick Preset Chips */}
              <div className={styles.chipsContainer} role="group" aria-label="Suggested dietary preferences">
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
                placeholder="Additional notes regarding dietary needs or accommodations..."
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
            Message for the Bride &amp; Groom (optional)
          </label>
          <textarea
            id="rsvp-message"
            rows={3}
            maxLength={1000}
            placeholder="Send something warm and lovely to Hoàng & Duyên..."
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
          🔒 Your response is confidential and will only be used to prepare for our wedding celebration.
        </p>

        {/* Submit CTA */}
        <button
          type="submit"
          disabled={submitting || offline}
          className={`${styles.submitBtn} ${!isAttending ? styles.submitBtnDecline : ''}`}
        >
          {submitting ? (
            <span>Saving your response…</span>
          ) : isAttending ? (
            <span>{isEditing ? 'Save Changes' : 'Confirm Attendance'}</span>
          ) : (
            <span>{isEditing ? 'Save Changes' : 'Decline Invitation'}</span>
          )}
        </button>
      </form>
    </div>
  );
}
