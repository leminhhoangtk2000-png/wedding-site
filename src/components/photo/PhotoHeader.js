'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function PhotoHeader({ subtitle = 'Keepsake Photo Printing' }) {
  const pathname = usePathname();

  return (
    <header className="photo-header" role="banner">
      <div className="photo-header-inner">
        <div className="photo-header-brand">
          <Link href="/" className="photo-brand-link" aria-label="Back to wedding home page">
            <span className="photo-brand-names">Hoàng &amp; Duyên</span>
            <span className="photo-brand-dot">•</span>
            <span className="photo-brand-project">69 Project</span>
          </Link>
          <span className="photo-header-tagline">{subtitle}</span>
        </div>

        <nav className="photo-header-nav" aria-label="Photo booth navigation">
          <Link
            href="/"
            className={`photo-nav-item ${pathname === '/' ? 'active' : ''}`}
          >
            Home
          </Link>
          <Link
            href="/photo"
            className={`photo-nav-item ${pathname === '/photo' ? 'active' : ''}`}
          >
            Photo Booth
          </Link>
          <Link
            href="/admin/printing"
            className={`photo-nav-item ${pathname.startsWith('/admin/printing') ? 'active' : ''}`}
          >
            Print Admin
          </Link>
        </nav>
      </div>

      <style jsx>{`
        .photo-header {
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(14, 18, 23, 0.92);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(232, 223, 200, 0.15);
          padding: 10px 16px;
          color: #fdfaf5;
          width: 100%;
        }
        .photo-header-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .photo-header-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .photo-brand-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-heading), 'Fraunces', serif;
          font-size: 1.05rem;
          color: #d4af37;
          text-decoration: none;
          font-weight: 600;
          letter-spacing: 0.02em;
        }
        .photo-brand-link:hover,
        .photo-brand-link:focus-visible {
          color: #f3df95;
          outline: none;
        }
        .photo-brand-names {
          color: #fdfaf5;
        }
        .photo-brand-dot {
          color: #d4af37;
          opacity: 0.8;
        }
        .photo-brand-project {
          color: #d4af37;
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .photo-header-tagline {
          font-size: 0.82rem;
          color: rgba(253, 250, 245, 0.65);
          border-left: 1px solid rgba(232, 223, 200, 0.2);
          padding-left: 10px;
        }
        .photo-header-nav {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .photo-nav-item {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 0.88rem;
          color: rgba(253, 250, 245, 0.85);
          text-decoration: none;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .photo-nav-item:hover {
          color: #fdfaf5;
          background: rgba(255, 255, 255, 0.08);
        }
        .photo-nav-item.active {
          color: #d4af37;
          background: rgba(212, 175, 55, 0.12);
          font-weight: 600;
        }
        .photo-nav-item:focus-visible {
          outline: 2px solid #d4af37;
          outline-offset: 2px;
        }
        @media (max-width: 640px) {
          .photo-header {
            padding: 8px 12px;
          }
          .photo-header-tagline {
            display: none;
          }
          .photo-nav-item {
            padding: 6px 10px;
            font-size: 0.82rem;
          }
        }
      `}</style>
    </header>
  );
}
