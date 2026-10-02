'use client';

import { PHOTO_STATUS_LABELS } from '@/lib/photo/client';

export default function StatusBadge({ status, className = '' }) {
  const label = PHOTO_STATUS_LABELS[status] || status || 'Unknown';

  const getStatusConfig = (st) => {
    switch (st) {
      case 'pending':
        return { bg: '#FEF9E7', text: '#8C6720', border: '#E8CB93', icon: '⏳' };
      case 'approved':
        return { bg: '#F0F9FF', text: '#0369A1', border: '#BAE6FD', icon: '📥' };
      case 'claimed':
      case 'submitting':
        return { bg: '#FAF5FF', text: '#7E22CE', border: '#E9D5FF', icon: '🔄' };
      case 'submitted':
        return { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE', icon: '🖨️' };
      case 'review':
        return { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA', icon: '⚠️' };
      case 'ready':
        return { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0', icon: '✨' };
      case 'rejected':
        return { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA', icon: '✕' };
      default:
        return { bg: '#F9FAFB', text: '#4B5563', border: '#E5E7EB', icon: '•' };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span
      className={`status-badge ${className}`}
      role="status"
      style={{
        backgroundColor: config.bg,
        color: config.text,
        borderColor: config.border,
      }}
    >
      <span className="status-badge-icon" aria-hidden="true">{config.icon}</span>
      <span className="status-badge-text">{label}</span>

      <style jsx>{`
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 0.8rem;
          font-weight: 500;
          border: 1px solid;
          white-space: nowrap;
          line-height: 1.2;
        }
        .status-badge-icon {
          font-size: 0.85rem;
          line-height: 1;
        }
        .status-badge-text {
          letter-spacing: 0.01em;
        }
      `}</style>
    </span>
  );
}
