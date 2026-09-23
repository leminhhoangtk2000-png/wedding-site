'use client';

import { ATTENDANCE_VALUES } from '@/lib/rsvpConstants';
import {
  HanddrawnCelebration,
  HanddrawnEnvelope,
  HanddrawnCheck,
} from '@/components/icons/HanddrawnIcons';
import styles from '@/app/rsvp/rsvp.module.css';

export default function AttendanceChoice({ value, onChange, disabled }) {
  const isAttending = value === ATTENDANCE_VALUES.ATTENDING;
  const isDeclined = value === ATTENDANCE_VALUES.DECLINED;

  return (
    <fieldset className={styles.attendanceFieldset}>
      <legend className={styles.attendanceLegend}>
        Will you be able to celebrate with us? <span className={styles.requiredStar}>*</span>
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
          <div className={styles.attendanceCardHeader}>
            <div className={styles.attendanceIcon} aria-hidden="true" style={{ color: '#b08d4f' }}>
              <HanddrawnCelebration size={26} />
            </div>
            {isAttending && (
              <span className={styles.attendanceCheckMark}>
                <HanddrawnCheck size={13} strokeWidth={2.4} />
              </span>
            )}
          </div>
          <div className={styles.attendanceMeta}>
            <span className={styles.attendanceLabelText}>Joyfully Accept</span>
            <span className={styles.attendanceSubText}>Delighted to attend and celebrate!</span>
          </div>
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
          <div className={styles.attendanceCardHeader}>
            <div className={styles.attendanceIcon} aria-hidden="true" style={{ color: '#8c7d6e' }}>
              <HanddrawnEnvelope size={26} />
            </div>
            {isDeclined && (
              <span className={styles.attendanceCheckMark}>
                <HanddrawnCheck size={13} strokeWidth={2.4} />
              </span>
            )}
          </div>
          <div className={styles.attendanceMeta}>
            <span className={styles.attendanceLabelText}>Regretfully Decline</span>
            <span className={styles.attendanceSubText}>Sending warm blessings from afar</span>
          </div>
        </label>
      </div>
    </fieldset>
  );
}
