'use client';

import { ATTENDANCE_VALUES } from '@/lib/rsvpConstants';
import styles from '@/app/rsvp/rsvp.module.css';

export default function AttendanceChoice({ value, onChange, disabled }) {
  const isAttending = value === ATTENDANCE_VALUES.ATTENDING;
  const isDeclined = value === ATTENDANCE_VALUES.DECLINED;

  return (
    <fieldset className={styles.attendanceFieldset}>
      <legend className={styles.attendanceLegend}>
        Bạn có thể đến chung vui cùng tụi mình không? <span className={styles.requiredStar}>*</span>
      </legend>

      <div className={styles.attendanceGrid}>
        {/* Option: Attending */}
        <label
          className={`${styles.attendanceCard} ${isAttending ? styles.attendanceCardActive : ''}`}
          htmlFor="attendance-attending"
        >
          <input
            type="radio"
            id="attendance-attending"
            name="attendance"
            value={ATTENDANCE_VALUES.ATTENDING}
            checked={isAttending}
            disabled={disabled}
            onChange={() => onChange(ATTENDANCE_VALUES.ATTENDING)}
            className={styles.attendanceRadioInput}
          />
          <div className={styles.attendanceIcon} aria-hidden="true">
            {isAttending ? '✨' : '🌿'}
          </div>
          <span className={styles.attendanceLabelText}>Có, mình sẽ tham dự</span>
        </label>

        {/* Option: Declined */}
        <label
          className={`${styles.attendanceCard} ${isDeclined ? styles.attendanceCardActive : ''}`}
          htmlFor="attendance-declined"
        >
          <input
            type="radio"
            id="attendance-declined"
            name="attendance"
            value={ATTENDANCE_VALUES.DECLINED}
            checked={isDeclined}
            disabled={disabled}
            onChange={() => onChange(ATTENDANCE_VALUES.DECLINED)}
            className={styles.attendanceRadioInput}
          />
          <div className={styles.attendanceIcon} aria-hidden="true">
            {isDeclined ? '💌' : '🍃'}
          </div>
          <span className={styles.attendanceLabelText}>Rất tiếc, mình không thể tham dự</span>
        </label>
      </div>
    </fieldset>
  );
}
