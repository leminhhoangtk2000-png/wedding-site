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
      <label className={styles.label}>
        Số lượng người tham dự (bao gồm bạn) <span className={styles.requiredStar}>*</span>
      </label>

      <div className={styles.guestCountGrid} role="radiogroup" aria-label="Số lượng khách tham dự">
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
            <span className={styles.guestCountTitle}>1 người</span>
            <span className={styles.guestCountDesc}>Tham dự một mình</span>
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
            <span className={styles.guestCountTitle}>2 người</span>
            <span className={styles.guestCountDesc}>Đi cùng người thương</span>
          </div>
        </button>
      </div>

      <div id="guest-count-hint" className={styles.fieldHint}>
        Bao gồm bạn và người thương hoặc bạn bè đi cùng nhé.
      </div>

      {error && (
        <p className={styles.fieldError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
