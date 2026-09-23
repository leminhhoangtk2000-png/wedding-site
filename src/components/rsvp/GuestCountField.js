'use client';

import { HanddrawnHeart, HanddrawnGuests, HanddrawnCheck } from '@/components/icons/HanddrawnIcons';
import styles from '@/app/rsvp/rsvp.module.css';

export default function GuestCountField({ value, onChange, error, disabled }) {
  const count = parseInt(value, 10) || 1;

  const handleSelect = (num) => {
    if (!disabled) {
      onChange(num);
    }
  };

  return (
    <div className={styles.formGroup}>
      <div id="guest-count-label" className={styles.label}>
        How many guests should we prepare seats for, including yourself? <span className={styles.requiredStar}>*</span>
      </div>

      <div className={styles.guestCountGrid} role="radiogroup" aria-labelledby="guest-count-label">
        {/* Option 1: 1 Guest */}
        <button
          type="button"
          role="radio"
          aria-checked={count === 1}
          disabled={disabled}
          onClick={() => handleSelect(1)}
          className={`${styles.guestCountCard} ${count === 1 ? styles.guestCountCardActive : ''}`}
        >
          <div className={styles.guestCountCardTop}>
            <div className={styles.guestCountIcon} aria-hidden="true">
              <HanddrawnHeart size={20} />
            </div>
            {count === 1 && (
              <span className={styles.guestCountCheckMark}>
                <HanddrawnCheck size={12} strokeWidth={2.4} />
              </span>
            )}
          </div>
          <div className={styles.guestCountCardBody}>
            <span className={styles.guestCountTitle}>1 Guest</span>
            <span className={styles.guestCountDesc}>Attending solo</span>
          </div>
        </button>

        {/* Option 2: 2 Guests */}
        <button
          type="button"
          role="radio"
          aria-checked={count === 2}
          disabled={disabled}
          onClick={() => handleSelect(2)}
          className={`${styles.guestCountCard} ${count === 2 ? styles.guestCountCardActive : ''}`}
        >
          <div className={styles.guestCountCardTop}>
            <div className={styles.guestCountIcon} aria-hidden="true">
              <HanddrawnGuests size={20} />
            </div>
            {count === 2 && (
              <span className={styles.guestCountCheckMark}>
                <HanddrawnCheck size={12} strokeWidth={2.4} />
              </span>
            )}
          </div>
          <div className={styles.guestCountCardBody}>
            <span className={styles.guestCountTitle}>2 Guests</span>
            <span className={styles.guestCountDesc}>Attending with a plus-one</span>
          </div>
        </button>
      </div>

      <div id="guest-count-hint" className={styles.fieldHint}>
        Including yourself and any plus-ones or companions attending.
      </div>

      {error && (
        <p className={styles.fieldError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
