'use client';
import Link from 'next/link';
import { WEDDING_EVENT } from '@/lib/rsvpConstants';

export default function HomeRsvpCard() {
  return (
    <section className="home-rsvp-section reveal" id="home-rsvp" aria-label="Xác nhận tham dự tiệc cưới">
      <div className="home-rsvp-card">
        {/* Subtle decorative gold badge */}
        <div className="home-rsvp-card__badge">
          <span className="home-rsvp-card__sparkle">✦</span>
          <span>THIỆP MỜI & XÁC NHẬN</span>
          <span className="home-rsvp-card__sparkle">✦</span>
        </div>

        <h2 className="home-rsvp-card__title">
          Bạn sẽ đến chung vui cùng tụi mình chứ?
        </h2>

        <p className="home-rsvp-card__subtitle">
          Sự hiện diện của bạn là niềm hạnh phúc vô giá đối với Hoàng &amp; Duyên. Hãy xác nhận sớm để chúng mình có thể đón tiếp bạn một cách trọn vẹn và chu đáo nhất nhé!
        </p>

        {/* Event Quick Info Pills */}
        <div className="home-rsvp-card__info-grid">
          <div className="home-rsvp-card__info-item">
            <div className="home-rsvp-card__info-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div className="home-rsvp-card__info-text">
              <span className="home-rsvp-card__info-label">Thời gian</span>
              <span className="home-rsvp-card__info-val"><strong>{WEDDING_EVENT.dateFormatted}</strong> · 16:00</span>
            </div>
          </div>

          <div className="home-rsvp-card__info-item">
            <div className="home-rsvp-card__info-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div className="home-rsvp-card__info-text">
              <span className="home-rsvp-card__info-label">Địa điểm</span>
              <span className="home-rsvp-card__info-val"><strong>{WEDDING_EVENT.venueName}</strong> · Bình Quới, TP. HCM</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="home-rsvp-card__actions">
          <Link href="/rsvp" className="home-rsvp-btn home-rsvp-btn--primary">
            <span>Xác nhận tham dự ngay</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>

          <a
            href={WEDDING_EVENT.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="home-rsvp-btn home-rsvp-btn--secondary"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11" />
            </svg>
            <span>Xem bản đồ đường đi</span>
          </a>
        </div>
      </div>
    </section>
  );
}
