'use client';

import styles from '@/app/rsvp/rsvp.module.css';

export default function GuestCountField({ value, onChange, error, disabled }) {
  const count = parseInt(value, 10) || 1;

  const handleDecrement = () => {
    if (count > 1 && !disabled) {
      onChange(count - 1);
    }
  };

  const handleIncrement = () => {
    if (!disabled && count < 2) {
      onChange(count + 1);
    }
  };

  const handleQuickSelect = (num) => {
    if (!disabled) {
      onChange(num);
    }
  };

  return (
    <div className={styles.formGroup}>
      <label htmlFor="rsvp-guest-count" className={styles.label}>
        Số lượng người tham dự (bao gồm bạn) <span className={styles.requiredStar}>*</span>
      </label>

      <div className={styles.stepperContainer}>
        {/* Stepper (- / count / +) */}
        <div className={styles.stepperWrapper}>
          <button
            type="button"
            onClick={handleDecrement}
            disabled={disabled || count <= 1}
            className={styles.stepperBtn}
            aria-label="Giảm 1 người"
          >
            –
          </button>

          <div className={styles.stepperDisplay}>
            <span className={styles.stepperNumber}>{count}</span>
            <span className={styles.stepperUnit}>người</span>
          </div>

          <button
            type="button"
            onClick={handleIncrement}
            disabled={disabled || count >= 2}
            className={styles.stepperBtn}
            aria-label="Tăng 1 người"
          >
            +
          </button>
        </div>

        {/* Quick count chips */}
        <div className={styles.quickCountGroup} role="group" aria-label="Chọn nhanh số lượng khách">
          {[1, 2].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleQuickSelect(num)}
              disabled={disabled}
              className={`${styles.quickCountBtn} ${count === num ? styles.quickCountBtnActive : ''}`}
            >
              {num} {num === 1 ? 'người' : 'khách'}
            </button>
          ))}
        </div>
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
