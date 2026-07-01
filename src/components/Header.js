'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile nav on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile nav is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const navLinks = [
    { href: '/', label: 'Our Story' },
    { href: '/wishes', label: 'Wishes Board' },
  ];

  const isStoryPage = pathname === '/';
  const isHidden = scrolled && !hovered && !mobileOpen;

  return (
    <>
      {/* Invisible hover zone at top of screen to trigger header reveal */}
      {scrolled && (
        <div 
          className="header-hover-zone"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        />
      )}
      <header
        className={`header ${scrolled ? 'header--scrolled' : ''} ${isHidden ? 'header--hidden' : ''}`}
        id="site-header"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Link href="/" className="header__logo" aria-label="Home">
          <Image
            src="/images/logo.svg"
            alt="Hoàng & Duyên Logo"
            width={35}
            height={35}
            className="header__logo-img"
            priority
          />
        </Link>

        {/* Desktop Nav */}
        <nav className="header__nav" aria-label="Main navigation">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`header__nav-link ${
                pathname === link.href ? 'header__nav-link--active' : ''
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Hamburger Button */}
        <button
          className={`header__hamburger ${mobileOpen ? 'header__hamburger--open' : ''}`}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          <span className="header__hamburger-line" />
          <span className="header__hamburger-line" />
          <span className="header__hamburger-line" />
        </button>

        {/* Mobile Nav */}
        <div
          className={`header__mobile-nav ${mobileOpen ? 'header__mobile-nav--open' : ''}`}
          aria-hidden={!mobileOpen}
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="header__mobile-nav-link"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </header>
    </>
  );
}
