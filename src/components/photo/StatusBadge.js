'use client';

import { PHOTO_STATUS_LABELS } from '@/lib/photo/client';

export default function StatusBadge({ status, className = '' }) {
  const label = PHOTO_STATUS_LABELS[status] || status || 'Không rõ';

  const getStatusConfig = (st) => {
    switch (st) {
      case 'pending':
        return { bg: 'rgba(212, 175, 55, 0.15)', text: '#d4af37', border: 'rgba(212, 175, 55, 0.4)', icon: '⏳' };
      case 'approved':
        return { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.4)', icon: '📥' };
      case 'claimed':
      case 'submitting':
        return { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.4)', icon: '🔄' };
      case 'submitted':
        return { bg: 'rgba(99, 102, 241, 0.15)', text: '#818cf8', border: 'rgba(99, 102, 241, 0.4)', icon: '🖨️' };
      case 'review':
        return { bg: 'rgba(249, 115, 22, 0.18)', text: '#fb923c', border: 'rgba(249, 115, 22, 0.45)', icon: '⚠️' };
      case 'ready':
        return { bg: 'rgba(34, 197, 94, 0.18)', text: '#4ade80', border: 'rgba(34, 197, 94, 0.45)', icon: '✨' };
      case 'rejected':
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.4)', icon: '✕' };
      default:
        return { bg: 'rgba(255, 255, 255, 0.1)', text: '#e5e7eb', border: 'rgba(255, 255, 255, 0.2)', icon: '•' };
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
