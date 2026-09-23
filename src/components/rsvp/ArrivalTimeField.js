'use client';

import { useState, useEffect } from 'react';
import { ARRIVAL_TIME_OPTIONS } from '@/lib/rsvpConstants';
import { HanddrawnClock, HanddrawnCheck } from '@/components/icons/HanddrawnIcons';
import styles from '@/app/rsvp/rsvp.module.css';

export default function ArrivalTimeField({ value, onChange, error, disabled }) {
  const isPreset = ARRIVAL_TIME_OPTIONS.some((opt) => opt.value === value);
  const [isCustomManual, setIsCustomManual] = useState(null);
  const isCustom = isCustomManual !== null ? isCustomManual : Boolean(value && !isPreset);
  const [customText, setCustomText] = useState(() => (Boolean(value && !isPreset) ? value : ''));

  const handleSelectPreset = (optValue) => {
    if (disabled) return;
    setIsCustomManual(false);
    onChange(optValue);
  };

  const handleSelectCustom = () => {
    if (disabled) return;
    setIsCustomManual(true);
    onChange(customText || 'Other time');
  };

  const handleCustomTextChange = (e) => {
    const text = e.target.value;
    setCustomText(text);
    onChange(text);
  };

  return (
    <fieldset className={styles.formGroup} style={{ border: 'none', padding: 0, margin: 0 }}>
      <legend className={styles.label} style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
        <HanddrawnClock size={16} style={{ color: '#b08d4f' }} />
        <span>Expected Arrival Time</span>
        <span className={styles.requiredStar}>*</span>
      </legend>

      <div className={styles.fieldHint} style={{ marginBottom: 10 }}>
        When do you plan to join Hoàng &amp; Duyên?
      </div>

      <div className={styles.arrivalTimeList} role="radiogroup" aria-label="Select expected arrival time">
        {ARRIVAL_TIME_OPTIONS.map((opt) => {
          const isSelected = !isCustom && value === opt.value;
          const inputId = `arrival-time-${opt.id}`;
          return (
            <label
              key={opt.id}
              htmlFor={inputId}
              className={`${styles.arrivalTimeCard} ${isSelected ? styles.arrivalTimeCardActive : ''}`}
            >
              <input
                type="radio"
                id={inputId}
                name="arrival_time"
                value={opt.value}
                checked={isSelected}
                disabled={disabled}
                onChange={() => handleSelectPreset(opt.value)}
                className={styles.attendanceRadioInput}
              />
              <div className={styles.arrivalTimeBadge}>
                {opt.time}
              </div>
              <div className={styles.arrivalTimeInfo}>
                <div className={styles.arrivalTimeTitle}>{opt.title}</div>
                <div className={styles.arrivalTimeDesc}>{opt.desc}</div>
              </div>
              <div className={styles.arrivalTimeCheckWrapper}>
                <span className={`${styles.arrivalTimeRadioDot} ${isSelected ? styles.arrivalTimeRadioDotActive : ''}`}>
                  {isSelected && <HanddrawnCheck size={11} strokeWidth={2.4} />}
                </span>
              </div>
            </label>
          );
        })}

        {/* Custom time option */}
        <label
          htmlFor="arrival-time-custom"
          className={`${styles.arrivalTimeCard} ${isCustom ? styles.arrivalTimeCardActive : ''}`}
        >
          <input
            type="radio"
            id="arrival-time-custom"
            name="arrival_time"
            value="custom"
            checked={isCustom}
            disabled={disabled}
            onChange={handleSelectCustom}
            className={styles.attendanceRadioInput}
          />
          <div className={styles.arrivalTimeBadge} style={{ fontSize: 12 }}>
            Other...
          </div>
          <div className={styles.arrivalTimeInfo}>
            <div className={styles.arrivalTimeTitle}>Other Arrival Time</div>
            <div className={styles.arrivalTimeDesc}>Arriving at a different time</div>
          </div>
          <div className={styles.arrivalTimeCheckWrapper}>
            <span className={`${styles.arrivalTimeRadioDot} ${isCustom ? styles.arrivalTimeRadioDotActive : ''}`}>
              {isCustom && <HanddrawnCheck size={11} strokeWidth={2.4} />}
            </span>
          </div>
        </label>
      </div>

      {/* Custom time text input */}
      {isCustom && (
        <div className={styles.customTimeWrapper}>
          <label htmlFor="custom-arrival-time-input" className={styles.visuallyHidden}>
            Specify arrival time
          </label>
          <input
            id="custom-arrival-time-input"
            type="text"
            placeholder="Please specify your arrival time (e.g., 4:30 PM, after 7:00 PM...)"
            maxLength={50}
            value={customText}
            onChange={handleCustomTextChange}
            disabled={disabled}
            className={styles.input}
            autoFocus
          />
        </div>
      )}

      {error && (
        <p className={styles.fieldError} role="alert" style={{ marginTop: 6 }}>
          {error}
        </p>
      )}
    </fieldset>
  );
}
