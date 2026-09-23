'use client';

import { HanddrawnAlert, HanddrawnInfo } from '@/components/icons/HanddrawnIcons';
import styles from '@/app/rsvp/rsvp.module.css';

export default function RsvpStatusNotice({ type = 'warn', title, message, actionLabel, onAction }) {
  const isError = type === 'error';

  return (
    <aside
      className={`${styles.statusNotice} ${isError ? styles.statusNoticeError : styles.statusNoticeWarn}`}
      role="alert"
    >
      <div className={styles.statusNoticeIcon} aria-hidden="true">
        {isError ? <HanddrawnAlert size={22} /> : <HanddrawnInfo size={22} />}
      </div>
      <div style={{ flex: 1 }}>
        {title && <strong style={{ display: 'block', marginBottom: 4 }}>{title}</strong>}
        <div>{message}</div>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            style={{
              marginTop: 8,
              padding: '6px 14px',
              borderRadius: 8,
              border: '1px solid currentColor',
              background: 'transparent',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </aside>
  );
}
