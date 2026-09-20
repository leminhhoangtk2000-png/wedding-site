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
    if (!disabled) {
      onChange(count + 1);
    }
  };

  const handleInputChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (raw === '') {
      onChange('');
      return;
    }
    const val = parseInt(raw, 10);
    if (!isNaN(val) && val >= 1) {
      onChange(val);
    }
  };

  const handleBlur = () => {
    if (!value || parseInt(value, 10) < 1) {
      onChange(1);
    }
  };

  return (
    <div className={styles.formGroup}>
      <label htmlFor="rsvp-guest-count" className={styles.label}>
        How many guests should we prepare seats for, including yourself? <span className={styles.requiredStar}>*</span>
      </label>

      <div className={styles.stepperWrapper}>
        <button
          type="button"
          onClick={handleDecrement}
          disabled={disabled || count <= 1}
          className={styles.stepperBtn}
          aria-label="Decrease guest count by 1"
        >
          –
        </button>

        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          id="rsvp-guest-count"
          value={value}
          onChange={handleInputChange}
          onBlur={handleBlur}
          disabled={disabled}
          className={`${styles.stepperInput} ${error ? styles.inputError : ''}`}
          aria-describedby="guest-count-hint"
        />

        <button
          type="button"
          onClick={handleIncrement}
          disabled={disabled}
          className={styles.stepperBtn}
          aria-label="Increase guest count by 1"
        >
          +
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
