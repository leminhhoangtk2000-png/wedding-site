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
    onChange(customText || 'Khung giờ khác');
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
        <span>Thời gian bạn sẽ có mặt</span>
        <span className={styles.requiredStar}>*</span>
      </legend>

      <div className={styles.fieldHint} style={{ marginBottom: 10 }}>
        Bạn dự kiến sẽ đến chung vui cùng Hoàng &amp; Duyên vào khung giờ nào nhé?
      </div>

      <div className={styles.arrivalTimeList} role="radiogroup" aria-label="Chọn thời gian bạn sẽ có mặt">
        {ARRIVAL_TIME_OPTIONS.map((opt) => {
          const isSelected = !isCustom && value === opt.value;
          return (
            <label
              key={opt.id}
              className={`${styles.arrivalTimeCard} ${isSelected ? styles.arrivalTimeCardActive : ''}`}
            >
              <input
                type="radio"
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
          className={`${styles.arrivalTimeCard} ${isCustom ? styles.arrivalTimeCardActive : ''}`}
        >
          <input
            type="radio"
            name="arrival_time"
            value="custom"
            checked={isCustom}
            disabled={disabled}
            onChange={handleSelectCustom}
            className={styles.attendanceRadioInput}
          />
          <div className={styles.arrivalTimeBadge} style={{ fontSize: 12 }}>
            Khác...
          </div>
          <div className={styles.arrivalTimeInfo}>
            <div className={styles.arrivalTimeTitle}>Khung giờ khác</div>
            <div className={styles.arrivalTimeDesc}>Bạn sẽ đến vào một thời gian đặc biệt khác</div>
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
          <input
            type="text"
            placeholder="Ghi rõ thời gian bạn dự kiến có mặt (ví dụ: 16:30, sau 19:00...)"
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
