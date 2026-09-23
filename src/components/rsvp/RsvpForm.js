'use client';

import { useState, useRef, useMemo } from 'react';
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
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const nameInputRef = useRef(null);

  const isAttending = attendance === ATTENDANCE_VALUES.ATTENDING;

  // Active steps dynamically computed based on Attendance decision
  const activeSteps = useMemo(() => {
    if (isAttending) {
      return [
        {
          id: 'name',
          title: 'Your Full Name',
          question: 'What is your full name?',
          hint: 'Please share your name so Hoàng & Duyên can give you a warm welcome.',
        },
        {
          id: 'attendance',
          title: 'Will You Attend?',
          question: 'Will you be able to celebrate with us?',
          hint: 'Your presence would mean the world to Hoàng & Duyên.',
        },
        {
          id: 'count',
          title: 'Guest Count',
          question: 'How many guests will be attending?',
          hint: 'Including yourself and any plus-ones or companions.',
        },
        {
          id: 'time',
          title: 'Arrival Time',
          question: 'What time do you plan to arrive?',
          hint: 'Helps us prepare seating and welcome you warmly.',
        },
        {
          id: 'dietary',
          title: 'Dietary & Allergies',
          question: 'Do you have any dietary requirements?',
          hint: 'We will happily prepare special meals tailored to your needs (optional).',
        },
        {
          id: 'message',
          title: 'Message & Confirmation',
          question: 'Leave a Message & Confirm RSVP',
          hint: 'Send your heartfelt wishes and review your response before submitting.',
        },
      ];
    }
    return [
      {
        id: 'name',
        title: 'Your Full Name',
        question: 'What is your full name?',
        hint: 'Please share your name so we can record your warm blessings.',
      },
      {
        id: 'attendance',
        title: 'Will You Attend?',
        question: 'Will you be able to celebrate with us?',
        hint: 'Hoàng & Duyên would love to see you, but we completely understand if you cannot make it.',
      },
      {
        id: 'message',
        title: 'Warm Blessings',
        question: 'Send Warm Wishes & Submit',
        hint: 'Leave a sweet message or blessing for the couple.',
      },
    ];
  }, [isAttending]);

  // Safe clamped index
  const safeStepIndex = Math.min(currentStepIndex, activeSteps.length - 1);
  const currentStep = activeSteps[safeStepIndex];

  // Validation function per step
  const validateStep = (stepId) => {
    const errs = { ...errors };
    let isValid = true;

    if (stepId === 'name') {
      const trimmed = fullName.trim();
      if (!trimmed) {
        errs.fullName = 'Please enter your full name.';
        isValid = false;
      } else if (trimmed.length < 2) {
        errs.fullName = 'Full name is too short (minimum 2 characters).';
        isValid = false;
      } else if (trimmed.length > 100) {
        errs.fullName = 'Full name must not exceed 100 characters.';
        isValid = false;
      } else {
        delete errs.fullName;
      }
    }

    if (stepId === 'count' && isAttending) {
      const count = parseInt(attendeeCount, 10);
      if (isNaN(count) || count < 1) {
        errs.attendeeCount = 'Guest count must be at least 1.';
        isValid = false;
      } else if (count > 10) {
        errs.attendeeCount = 'Maximum of 10 guests allowed.';
        isValid = false;
      } else {
        delete errs.attendeeCount;
      }
    }

    if (stepId === 'time' && isAttending) {
      if (!arrivalTime || !arrivalTime.trim()) {
        errs.arrivalTime = 'Please select your expected arrival time.';
        isValid = false;
      } else {
        delete errs.arrivalTime;
      }
    }

    if (stepId === 'dietary' && isAttending) {
      if (dietaryNotes && dietaryNotes.length > 500) {
        errs.dietaryNotes = 'Dietary notes must not exceed 500 characters.';
        isValid = false;
      } else {
        delete errs.dietaryNotes;
      }
    }

    if (stepId === 'message') {
      if (message && message.length > 1000) {
        errs.message = 'Message must not exceed 1,000 characters.';
        isValid = false;
      } else {
        delete errs.message;
      }
    }

    setErrors(errs);
    return isValid;
  };

  const handleNext = () => {
    if (!validateStep(currentStep.id)) {
      return;
    }

    if (safeStepIndex < activeSteps.length - 1) {
      setCurrentStepIndex(safeStepIndex + 1);
    } else {
      // Final step -> trigger submission
      triggerFinalSubmit();
    }
  };

  const handleBack = () => {
    if (safeStepIndex > 0) {
      setCurrentStepIndex(safeStepIndex - 1);
    }
  };

  const handleStepJump = (idx) => {
    if (idx === safeStepIndex) return;

    if (idx < safeStepIndex) {
      // Allowed: can always go back to earlier visited steps
      setCurrentStepIndex(idx);
    } else {
      // Forward jump requires validating current step
      if (validateStep(currentStep.id)) {
        setCurrentStepIndex(idx);
      }
    }
  };

  const handleAddPresetDietary = (preset) => {
    if (dietaryNotes.includes(preset)) {
      const updated = dietaryNotes
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== preset)
        .join(', ');
      setDietaryNotes(updated);
    } else {
      const updated = dietaryNotes ? `${dietaryNotes.trim()}, ${preset}` : preset;
      setDietaryNotes(updated);
    }
  };

  const triggerFinalSubmit = () => {
    if (submitting) return;

    // Validate entire form state before sending
    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setErrors((prev) => ({ ...prev, fullName: 'Please enter your full name.' }));
      setCurrentStepIndex(0);
      return;
    }

    if (isAttending && (!arrivalTime || !arrivalTime.trim())) {
      setErrors((prev) => ({ ...prev, arrivalTime: 'Please select your expected arrival time.' }));
      const timeIdx = activeSteps.findIndex((s) => s.id === 'time');
      if (timeIdx !== -1) setCurrentStepIndex(timeIdx);
      return;
    }

    const payload = {
      full_name: trimmedName,
      guest_name: trimmedName,
      attendance,
      attendee_count: isAttending ? parseInt(attendeeCount, 10) || 1 : 0,
      arrival_time: isAttending && arrivalTime.trim() ? arrivalTime.trim() : null,
      dietary_notes: isAttending && dietaryNotes.trim() ? dietaryNotes.trim() : null,
      special_requests: isAttending && dietaryNotes.trim() ? dietaryNotes.trim() : null,
      message: message.trim() || null,
    };

    onSubmit(payload);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      handleNext();
    }
  };

  return (
    <div className={styles.banquetCard} id="rsvp-form-section">
      {/* Decorative dashed inner frame is handled via CSS ::before */}

      {/* Form Top Title & Header */}
      <div className={styles.formHeader}>
        <div className={styles.badgePill}>
          <span className={styles.badgeSparkle}>✦</span>
          <span>{isEditing ? 'UPDATE RSVP' : 'KINDLY REPLY BY SEPTEMBER 30, 2026'}</span>
          <span className={styles.badgeSparkle}>✦</span>
        </div>

        <h2 className={styles.cardTitleScript}>
          {isEditing ? 'Update Your RSVP' : 'RSVP'}
        </h2>

        <p className={styles.cardSubtitle}>
          {isEditing
            ? 'Please update your plans so Hoàng & Duyên can prepare the best experience for you!'
            : 'Please let Hoàng & Duyên know your plans so we can prepare the best experience for you!'}
        </p>

        <div className={styles.goldFiligreeDivider} aria-hidden="true">
          <div className={styles.goldFiligreeLine} />
          <span className={styles.goldFiligreeKnot}>✦</span>
          <div className={styles.goldFiligreeLine} />
        </div>
      </div>

      {/* Step Progress Stepper Bar */}
      <div className={styles.stepProgressContainer} aria-label="Form completion progress">
        <div className={styles.stepProgressInfo}>
          <span className={styles.stepProgressBadge}>
            Step {safeStepIndex + 1} of {activeSteps.length}
          </span>
          <span className={styles.stepProgressCurrentTitle}>
            {currentStep.title}
          </span>
        </div>

        <div className={styles.stepDotsBar} role="tablist" aria-label="Step progress indicator">
          {activeSteps.map((step, idx) => {
            const isCompleted = idx < safeStepIndex;
            const isActive = idx === safeStepIndex;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => handleStepJump(idx)}
                className={`${styles.stepDotBtn} ${isActive ? styles.stepDotBtnActive : ''} ${
                  isCompleted ? styles.stepDotBtnCompleted : ''
                }`}
                aria-label={`Step ${idx + 1}: ${step.title}`}
                aria-current={isActive ? 'step' : undefined}
                title={`Step ${idx + 1}: ${step.title}`}
              >
                {isCompleted ? '✓' : idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Step Cards Carousel Viewport */}
      <div className={styles.stepSliderViewport} onKeyDown={handleKeyDown}>
        <div
          className={styles.stepSliderTrack}
          style={{ transform: `translateX(-${safeStepIndex * 100}%)` }}
        >
          {/* STEP 1: YOUR FULL NAME */}
          <div
            className={styles.stepSlide}
            aria-hidden={safeStepIndex !== 0}
            inert={safeStepIndex !== 0}
          >
            <div className={styles.stepCardHeader}>
              <h3 className={styles.stepCardQuestion}>What is your full name?</h3>
              <p className={styles.stepCardHint}>Please share your full name so Hoàng &amp; Duyên can prepare your invitation.</p>
            </div>

            <div className={styles.stepCardBody}>
              <div className={styles.stepBigInputWrap}>
                <label htmlFor="rsvp-fullname" className={styles.visuallyHidden}>
                  What is your full name?
                </label>
                <input
                  ref={nameInputRef}
                  id="rsvp-fullname"
                  type="text"
                  placeholder="e.g. Eleanor Vance"
                  maxLength={100}
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: null }));
                  }}
                  disabled={submitting}
                  className={`${styles.stepBigInput} ${errors.fullName ? styles.inputError : ''}`}
                  aria-required="true"
                  aria-invalid={Boolean(errors.fullName)}
                  aria-describedby={errors.fullName ? 'fullname-error' : undefined}
                />
                <div className={styles.stepInputHint}>
                  <span>Press ↵ Enter to proceed to the next step</span>
                  <span suppressHydrationWarning>{fullName.length}/100</span>
                </div>
              </div>
              {errors.fullName && (
                <p id="fullname-error" className={styles.fieldError} role="alert">
                  {errors.fullName}
                </p>
              )}
            </div>
          </div>

          {/* STEP 2: WILL YOU ATTEND? */}
          <div
            className={styles.stepSlide}
            aria-hidden={safeStepIndex !== 1}
            inert={safeStepIndex !== 1}
          >
            <div className={styles.stepCardHeader}>
              <h3 className={styles.stepCardQuestion}>Will you be able to celebrate with us?</h3>
              <p className={styles.stepCardHint}>Your presence would mean the world to Hoàng &amp; Duyên.</p>
            </div>

            <div className={styles.stepCardBody}>
              <AttendanceChoice
                value={attendance}
                onChange={(newVal) => setAttendance(newVal)}
                disabled={submitting}
              />
            </div>
          </div>

          {/* STEPS FOR ATTENDING GUESTS */}
          {isAttending && (
            <>
              {/* STEP 3: GUEST COUNT */}
              <div
                className={styles.stepSlide}
                aria-hidden={safeStepIndex !== 2}
                inert={safeStepIndex !== 2}
              >
                <div className={styles.stepCardHeader}>
                  <h3 className={styles.stepCardQuestion}>How many guests will be attending?</h3>
                  <p className={styles.stepCardHint}>Including yourself and any plus-ones or companions.</p>
                </div>

                <div className={styles.stepCardBody}>
                  <GuestCountField
                    value={attendeeCount}
                    onChange={(val) => setAttendeeCount(val)}
                    error={errors.attendeeCount}
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* STEP 4: ARRIVAL TIME */}
              <div
                className={styles.stepSlide}
                aria-hidden={safeStepIndex !== 3}
                inert={safeStepIndex !== 3}
              >
                <div className={styles.stepCardHeader}>
                  <h3 className={styles.stepCardQuestion}>What time do you plan to arrive?</h3>
                  <p className={styles.stepCardHint}>Helps us prepare seating and welcome you warmly.</p>
                </div>

                <div className={styles.stepCardBody}>
                  <ArrivalTimeField
                    value={arrivalTime}
                    onChange={(val) => {
                      setArrivalTime(val);
                      if (errors.arrivalTime) setErrors((prev) => ({ ...prev, arrivalTime: null }));
                    }}
                    error={errors.arrivalTime}
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* STEP 5: DIETARY RESTRICTIONS & SPECIAL REQUESTS */}
              <div
                className={styles.stepSlide}
                aria-hidden={safeStepIndex !== 4}
                inert={safeStepIndex !== 4}
              >
                <div className={styles.stepCardHeader}>
                  <h3 className={styles.stepCardQuestion}>Dietary restrictions &amp; special requests</h3>
                  <p className={styles.stepCardHint}>We will happily prepare special meals tailored to your needs (optional).</p>
                </div>

                <div className={styles.stepCardBody}>
                  {/* Preset chips */}
                  <div className={styles.chipsContainer} role="group" aria-label="Dietary restrictions presets">
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
                  <label htmlFor="rsvp-dietary" className={styles.visuallyHidden}>
                    Dietary restrictions and special requests
                  </label>

                  <textarea
                    id="rsvp-dietary"
                    rows={3}
                    maxLength={500}
                    placeholder="Additional notes regarding dietary needs or accommodations..."
                    value={dietaryNotes}
                    onChange={(e) => setDietaryNotes(e.target.value)}
                    disabled={submitting}
                    className={styles.textarea}
                  />
                  {errors.dietaryNotes && (
                    <p className={styles.fieldError} role="alert">
                      {errors.dietaryNotes}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* FINAL STEP: LỜI NHẮN & XÁC NHẬN GỬI */}
          <div
            className={styles.stepSlide}
            aria-hidden={safeStepIndex !== activeSteps.length - 1}
            inert={safeStepIndex !== activeSteps.length - 1}
          >
            <div className={styles.stepCardHeader}>
              <h3 className={styles.stepCardQuestion}>
                {isAttending ? 'Leave a Message & Confirm RSVP' : 'Send Warm Blessings'}
              </h3>
              <p className={styles.stepCardHint}>
                {isAttending
                  ? 'Send your heartfelt wishes and review your response before submitting.'
                  : 'Leave a sweet message or blessing for Hoàng & Duyên.'}
              </p>
            </div>

            <div className={styles.stepCardBody}>
              {/* Quick Summary Card */}
              <div className={styles.stepReviewSummary}>
                <h4 className={styles.stepReviewTitle}>
                  <span>✦</span>
                  <span>Summary of Your Response</span>
                </h4>
                <div className={styles.stepReviewRow}>
                  <span className={styles.stepReviewLabel}>Full Name:</span>
                  <span className={styles.stepReviewValue} suppressHydrationWarning>
                    {fullName || 'Not entered'}
                    <button
                      type="button"
                      onClick={() => handleStepJump(0)}
                      className={styles.stepReviewEditLink}
                    >
                      (edit)
                    </button>
                  </span>
                </div>
                <div className={styles.stepReviewRow}>
                  <span className={styles.stepReviewLabel}>Attendance:</span>
                  <span className={styles.stepReviewValue} suppressHydrationWarning>
                    {isAttending ? 'Joyfully Attending 🎉' : 'Regretfully Declining 💌'}
                    <button
                      type="button"
                      onClick={() => handleStepJump(1)}
                      className={styles.stepReviewEditLink}
                    >
                      (edit)
                    </button>
                  </span>
                </div>
                {isAttending && (
                  <>
                    <div className={styles.stepReviewRow}>
                      <span className={styles.stepReviewLabel}>Guest Count:</span>
                      <span className={styles.stepReviewValue} suppressHydrationWarning>
                        {attendeeCount} {attendeeCount === 1 ? 'guest' : 'guests'}
                        <button
                          type="button"
                          onClick={() => handleStepJump(2)}
                          className={styles.stepReviewEditLink}
                        >
                          (edit)
                        </button>
                      </span>
                    </div>
                    <div className={styles.stepReviewRow}>
                      <span className={styles.stepReviewLabel}>Arrival Time:</span>
                      <span className={styles.stepReviewValue} suppressHydrationWarning>
                        {arrivalTime || 'Not selected'}
                        <button
                          type="button"
                          onClick={() => handleStepJump(3)}
                          className={styles.stepReviewEditLink}
                        >
                          (edit)
                        </button>
                      </span>
                    </div>
                    {dietaryNotes && (
                      <div className={styles.stepReviewRow}>
                        <span className={styles.stepReviewLabel}>Dietary &amp; Allergies:</span>
                        <span className={styles.stepReviewValue} suppressHydrationWarning>{dietaryNotes}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Heartfelt Message Textarea */}
              <div className={styles.formGroup} style={{ marginTop: 4 }}>
                <label htmlFor="rsvp-message" className={styles.label}>
                  Personal message for Hoàng &amp; Duyên <span className={styles.optionalTag}>(optional)</span>
                </label>
                <textarea
                  id="rsvp-message"
                  rows={3}
                  maxLength={1000}
                  placeholder="Share your warm wishes, a favorite memory, or songs you'd love to hear..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={submitting}
                  className={styles.textarea}
                />
              </div>

              {/* Submit Error feedback */}
              {submitError && (
                <div
                  className={styles.fieldError}
                  role="alert"
                  style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <HanddrawnAlert size={16} />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Privacy reassurance */}
              <p
                className={styles.privacyNotice}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: '4px 0 0' }}
              >
                <HanddrawnLock size={15} />
                <span>Your response is kept strictly confidential and used solely for wedding planning.</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Horizontal Navigation Row */}
      <div className={styles.stepNavigationRow}>
        {safeStepIndex > 0 ? (
          <button
            type="button"
            onClick={handleBack}
            disabled={submitting}
            className={styles.stepBackBtn}
            aria-label="Go back to previous step"
          >
            <span>←</span>
            <span>Back</span>
          </button>
        ) : (
          <div style={{ width: 100 }} aria-hidden="true" />
        )}

        {safeStepIndex < activeSteps.length - 1 ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={submitting}
            className={styles.stepNextBtn}
            aria-label="Continue to next step"
          >
            <span>Continue</span>
            <span>→</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            disabled={submitting || offline}
            className={`${styles.stepNextBtn} ${styles.stepSubmitBtn} ${!isAttending ? styles.submitBtnDecline : ''}`}
            aria-label={isAttending ? 'Confirm Attendance Now' : 'Send Regretful Decline'}
          >
            {submitting ? (
              <span className={styles.submittingInner}>
                <span className={styles.spinner} aria-hidden="true" />
                <span>Saving response...</span>
              </span>
            ) : isAttending ? (
              <span className={styles.submitBtnContent}>
                <span>{isEditing ? 'Save RSVP Update' : 'Confirm Attendance Now'}</span>
                <span className={styles.submitArrow}>→</span>
              </span>
            ) : (
              <span className={styles.submitBtnContent}>
                <span>{isEditing ? 'Save Regretful Decline' : 'Send Regretful Decline'}</span>
                <HanddrawnEnvelope size={16} />
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
