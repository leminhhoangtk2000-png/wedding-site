'use client';

/**
 * Handdrawn Line-Art Icons for Wedding Website
 * Aesthetic: Whimsical Tuscan fairytale, organic inking, delicate line art
 * Couple: Hoàng & Duyên
 */

const baseSvgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

// 1. Calendar (replaces 📅, 🗓️)
export function HanddrawnCalendar({ size = 20, className = '', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      className={`handdrawn-icon ${className}`}
      {...baseSvgProps}
      {...props}
    >
      {/* Binder rings */}
      <path d="M7.5 2v3.2M16.5 2v3.2" />
      {/* Calendar body */}
      <path d="M4.5 5.5c0-.9.7-1.7 1.7-1.7h11.6c.9 0 1.7.7 1.7 1.7v13.6c0 1-.8 1.9-1.9 1.9H6.4c-1.1 0-1.9-.9-1.9-1.9V5.5z" />
      {/* Header divider */}
      <path d="M4.8 9.2c4.2.4 10.2-.4 14.4.2" />
      {/* Sketched grid & heart on wedding date */}
      <path d="M8 12.5h.01M12 12.5h.01M16 12.5h.01M8 16.5h.01M16 16.5h.01" />
      <path
        d="M11.8 15.3c-.6-.7-1.4-.2-1.2.6.4.9 1.4 1.7 1.4 1.7s1-.8 1.4-1.7c.2-.8-.6-1.3-1.2-.6l-.2.3-.2-.3z"
        fill="currentColor"
        strokeWidth={0.5}
      />
    </svg>
  );
}

// 2. Map Pin / Location (replaces 📍)
export function HanddrawnMapPin({ size = 20, className = '', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      className={`handdrawn-icon ${className}`}
      {...baseSvgProps}
      {...props}
    >
      {/* Organic teardrop pin */}
      <path d="M12 2.6c-4.2 0-7.4 3.3-7.4 7.4 0 4.8 6 10.8 7 11.8.3.3.7.3 1 0 1-1 7-7 7-11.8 0-4.1-3.3-7.4-7.6-7.4z" />
      {/* Pin core / heart center */}
      <circle cx="12" cy="10" r="2.6" />
      {/* Sketchy ground shadow */}
      <path d="M7.8 22.4c2.5.8 6 .8 8.4 0" strokeDasharray="1 2.5" />
    </svg>
  );
}

// 3. Champagne Flutes Clinking (replaces 🥂)
export function HanddrawnChampagne({ size = 22, className = '', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      className={`handdrawn-icon ${className}`}
      {...baseSvgProps}
      {...props}
    >
      {/* Left flute */}
      <path d="M5.2 3.5l3.8.8-1 5c-.5 2-1.8 2.8-2.3 3.3l.8 5.6M4 18.5h4.6M5.8 7.2c.8.3 1.8.3 2.4.2" />
      {/* Right flute */}
      <path d="M18.8 3.5l-3.8.8 1 5c.5 2 1.8 2.8 2.3 3.3l-.8 5.6M15.4 18.5H20M18.2 7.2c-.8.3-1.8.3-2.4.2" />
      {/* Effervescence bubbles & celebration stars */}
      <path d="M12 2v2.8M10.6 3.4h2.8" strokeWidth={1.4} />
      <circle cx="11.2" cy="7.2" r="0.7" fill="currentColor" />
      <circle cx="13" cy="9.2" r="0.6" fill="currentColor" />
      <circle cx="11.8" cy="11.5" r="0.5" fill="currentColor" />
    </svg>
  );
}

// 4. Dove of Vows & Peace (replaces 🕊️)
export function HanddrawnDove({ size = 22, className = '', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      className={`handdrawn-icon ${className}`}
      {...baseSvgProps}
      {...props}
    >
      {/* Flying dove silhouette */}
      <path d="M4 13.8c2.2 0 4.2-1 5.6-3 1-2.2 1.8-5.8 4.6-7.2-.5 3 .2 5 2.2 6.4 2.4 1.8 5 1.4 5.4 3.2.4 1.8-2.6 2.8-4.6 2.8-1.5 0-2.5 1-3 2.4-1 2.4-2.5 3-3.5 1.5 0-1.5.5-3-.5-4-1.4-.4-3.4 1-4.8.5-1.4-.5-2-2.6-1.4-2.6z" />
      {/* Eye and olive sprig */}
      <circle cx="18.5" cy="12.5" r="0.6" fill="currentColor" />
      <path d="M21 13l2.2-1.2M22.5 10.8c.8-.5 1.5.4 1 1" />
    </svg>
  );
}

// 5. Intertwined Wedding Rings
export function HanddrawnRings({ size = 22, className = '', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      className={`handdrawn-icon ${className}`}
      {...baseSvgProps}
      {...props}
    >
      {/* Groom band */}
      <circle cx="9.2" cy="13.8" r="5.2" />
      {/* Bride band */}
      <circle cx="14.8" cy="10.2" r="5.2" />
      {/* Diamond spark on top band */}
      <path d="M13.5 4.8l1.3-1.6 1.3 1.6" />
      <path d="M14.8 1.8v1.4M13.2 2.6l3.2.6" strokeWidth={1.2} />
    </svg>
  );
}

// 6. Vintage Camera (replaces 📸)
export function HanddrawnCamera({ size = 22, className = '', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      className={`handdrawn-icon ${className}`}
      {...baseSvgProps}
      {...props}
    >
      {/* Body & prism */}
      <path d="M3.8 8.2c0-1 .7-1.7 1.8-1.7h1.8l1.3-2c.4-.5 1-.6 1.7-.6h3.2c.7 0 1.3.1 1.7.6l1.3 2h1.8c1.1 0 1.8.7 1.8 1.7v9.6c0 1.1-.9 1.9-1.9 1.9H5.6c-1 0-1.8-.8-1.8-1.9V8.2z" />
      {/* Lens */}
      <circle cx="12" cy="13" r="3.4" />
      <path d="M10.8 11.8a1.6 1.6 0 012.2-.2" strokeWidth={1.2} />
      {/* Shutter button & viewfinder */}
      <path d="M6.2 9h1.6M16.8 9h1.4" />
    </svg>
  );
}

// 7. Banquet Dinner Plate & Silverware (replaces 🍽️)
export function HanddrawnDinner({ size = 22, className = '', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      className={`handdrawn-icon ${className}`}
      {...baseSvgProps}
      {...props}
    >
      {/* Main plate */}
      <circle cx="12" cy="12.5" r="7.2" />
      {/* Inner ceramic rim */}
      <circle cx="12" cy="12.5" r="4.4" strokeDasharray="1.5 2" />
      {/* Fork on left */}
      <path d="M2.5 8.5v3.4c0 1.2.8 2 1.6 2.4l-.2 5.5M1.5 8.5v2.8M3.5 8.5v2.8" strokeWidth={1.5} />
      {/* Knife on right */}
      <path d="M21.5 8.5c-.8.8-.8 3.5-.8 5.5l-.2 5.8" strokeWidth={1.5} />
    </svg>
  );
}

// 8. Tiered Wedding Cake & Sparkles (replaces ✨ in after-party / cake)
export function HanddrawnCake({ size = 22, className = '', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      className={`handdrawn-icon ${className}`}
      {...baseSvgProps}
      {...props}
    >
      {/* Candle flame */}
      <path d="M12 2.2c-.3.5-.4 1-.2 1.5.2.3.6.4.8.2.3-.2.3-.5.2-.8-.1-.4-.5-.6-.8-.9z" fill="currentColor" />
      <path d="M12 3.8v1.4" />
      {/* Tier 1 */}
      <path d="M9.5 5.2h5c.4 0 .7.3.7.7v2.4H8.8V5.9c0-.4.3-.7.7-.7z" />
      {/* Tier 2 */}
      <path d="M7.2 8.3h9.6c.4 0 .7.3.7.7v3.2H6.5V9c0-.4.3-.7.7-.7z" />
      {/* Tier 3 */}
      <path d="M4.6 12.2h14.8c.4 0 .7.3.7.7v4.6H3.9v-4.6c0-.4.3-.7.7-.7z" />
      {/* Frosting loops */}
      <path d="M7 10c1.2.8 2 .8 3.2 0 1.2.8 2 .8 3.2 0 1.2.8 2 .8 3.2 0" strokeWidth={1.2} />
      {/* Cake pedestal */}
      <path d="M2.8 17.5h18.4M9.5 17.5l-1.2 3.8h7.4l-1.2-3.8" />
    </svg>
  );
}

// 9. Celebration Party Popper & Confetti (replaces 🎉)
export function HanddrawnCelebration({ size = 24, className = '', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      className={`handdrawn-icon ${className}`}
      {...baseSvgProps}
      {...props}
    >
      {/* Party horn cone */}
      <path d="M4.2 19.8l6.8-2.6-2.8-6.8-4 9.4z" />
      <path d="M5.8 16.2l3.4-1.3M7.2 12.8l2.6-1" strokeWidth={1.2} />
      {/* Streamer coils & ribbons */}
      <path d="M10.5 14.5c2.4.8 3.8-1 6.2.5M12.5 10.8c1.8-1 3.2.8 5.4-.8M8.5 7.8c1.8-1.5 3 .5 5.5-1.5" />
      {/* Confetti sparkle stars */}
      <path d="M15.5 16.8l.8 1.4 1.6-.4-.8-1.4z" fill="currentColor" strokeWidth={0.5} />
      <path d="M18.8 5.2l.6 1 1.2-.3-.6-1z" fill="currentColor" strokeWidth={0.5} />
      <path d="M13.2 3.5l.4 1.2 1.2.2-.9.8.3 1.2-1-.6-1 .6.3-1.2-.9-.8 1.2-.2z" fill="currentColor" strokeWidth={0.4} />
      <circle cx="19.2" cy="11.5" r="0.7" fill="currentColor" />
    </svg>
  );
}

// 10. Love Letter Envelope with Heart Wax Seal (replaces 💌)
export function HanddrawnEnvelope({ size = 24, className = '', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      className={`handdrawn-icon ${className}`}
      {...baseSvgProps}
      {...props}
    >
      {/* Envelope envelope body */}
      <path d="M3.6 5.8c0-1 .7-1.8 1.8-1.8h13.2c1.1 0 1.8.8 1.8 1.8v11.8c0 1.1-.7 1.8-1.8 1.8H5.4c-1.1 0-1.8-.7-1.8-1.8V5.8z" />
      {/* Flap lines */}
      <path d="M3.8 6l6.8 5.8c.8.7 1.8.7 2.6 0L20.2 6" />
      <path d="M4 17.5l5.2-4.6M20 17.5l-5.2-4.6" />
      {/* Heart seal */}
      <path
        d="M12 10.6c-.6-.6-1.5-.3-1.4.6.2.9 1.4 1.8 1.4 1.8s1.2-.9 1.4-1.8c.1-.9-.8-1.2-1.4-.6z"
        fill="currentColor"
        strokeWidth={0.4}
      />
    </svg>
  );
}

// 11. Botanical Leaf / Dietary Sprig (replaces 🥗)
export function HanddrawnLeaf({ size = 20, className = '', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      className={`handdrawn-icon ${className}`}
      {...baseSvgProps}
      {...props}
    >
      {/* Stem */}
      <path d="M4.2 19.8C8 16.5 11.8 12.8 17.8 4.2" />
      {/* Top leaf */}
      <path d="M17.8 4.2c1.4 3.8-1.8 5.6-4.6 4.4 1.4-2 2.8-3.4 4.6-4.4z" />
      {/* Left leaf */}
      <path d="M10.8 10.5C7.5 9.5 7 12.8 10 13.8c.8-1.4.8-2.3.8-3.3z" />
      {/* Right leaf */}
      <path d="M13.8 11.2c1.5 3.2 4.8 2.8 3.4.4-1.4-1-2.4-1-3.4-.4z" />
      {/* Bottom leaf */}
      <path d="M7.5 14.8c-2.4.4-2 3.2.4 2.8.5-1.2.2-2.2-.4-2.8z" />
    </svg>
  );
}

// 12. Padlock / Privacy & Security (replaces 🔒)
export function HanddrawnLock({ size = 18, className = '', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      className={`handdrawn-icon ${className}`}
      {...baseSvgProps}
      {...props}
    >
      {/* Shackle */}
      <path d="M7.5 10.5V6.8c0-2.4 1.9-4.2 4.5-4.2s4.5 1.8 4.5 4.2v3.7" />
      {/* Body */}
      <path d="M5.2 10.5c0-.9.8-1.5 1.7-1.5h10.2c.9 0 1.7.6 1.7 1.5v8.8c0 1-.8 1.7-1.7 1.7H6.9c-1 0-1.7-.7-1.7-1.7v-8.8z" />
      {/* Keyhole */}
      <circle cx="12" cy="14.2" r="1.4" fill="currentColor" />
      <path d="M12 15.6v2.2" strokeWidth={1.8} />
    </svg>
  );
}

// 13. Warning / Alert Triangle (replaces ⚠️)
export function HanddrawnAlert({ size = 18, className = '', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      className={`handdrawn-icon ${className}`}
      {...baseSvgProps}
      {...props}
    >
      {/* Hand-sketched soft triangle */}
      <path d="M10.6 3.6c.6-1.1 2.2-1.1 2.8 0l7.8 13.8c.6 1.1-.2 2.4-1.4 2.4H4.2c-1.2 0-2-1.3-1.4-2.4L10.6 3.6z" />
      {/* Exclamation stem and dot */}
      <path d="M12 8.5v4.2" strokeWidth={2} />
      <circle cx="12" cy="16.2" r="0.9" fill="currentColor" />
    </svg>
  );
}

// 14. Info Crest (replaces ℹ️)
export function HanddrawnInfo({ size = 18, className = '', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      className={`handdrawn-icon ${className}`}
      {...baseSvgProps}
      {...props}
    >
      <circle cx="12" cy="12" r="8.8" />
      <circle cx="12" cy="7.8" r="0.9" fill="currentColor" />
      <path d="M12 11v5M10.8 16h2.4" strokeWidth={1.8} />
    </svg>
  );
}

// 15. Handdrawn Checkmark (replaces ✓)
export function HanddrawnCheck({ size = 16, className = '', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      className={`handdrawn-icon ${className}`}
      {...baseSvgProps}
      {...props}
    >
      <path d="M4.5 12.6c1.8 1.4 3.4 3.4 4.8 5.2 3.2-4.6 6.8-9 10.2-12.8" strokeWidth={2.2} />
    </svg>
  );
}

// 16. Handdrawn Heart (replaces ♥, 💕)
export function HanddrawnHeart({ size = 18, className = '', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      className={`handdrawn-icon ${className}`}
      {...baseSvgProps}
      {...props}
    >
      <path d="M12 19.8c-.8-.6-6.8-5-6.8-9.8 0-2.8 2.2-4.6 4.8-4.6 1.8 0 3.2.9 3.8 2 0 0 .8-2 3.8-2 2.6 0 4.8 1.8 4.8 4.6 0 4.8-6 9.2-6.8 9.8l-1.8 1.4-1.8-1.4z" />
    </svg>
  );
}

// 17. Fairytale Story Book (replaces 📖)
export function HanddrawnBook({ size = 22, className = '', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      className={`handdrawn-icon ${className}`}
      {...baseSvgProps}
      {...props}
    >
      <path d="M12 6.2V19" />
      <path d="M12 6.2C9.4 4.8 5.8 5 3.2 6.2v12.2c2.6-1.2 6.2-1.4 8.8 0" />
      <path d="M12 6.2c2.6-1.4 6.2-1.2 8.8 0v12.2c-2.6-1.2-6.2-1.4-8.8 0" />
      {/* Bookmark ribbon */}
      <path d="M12 4.2c-.4-1.6.4-2.2 1.2-1.8-.4 1-.8 1.4-1.2 1.8z" fill="currentColor" />
    </svg>
  );
}

// 18. Whimsical Celestial Sparkles (replaces ✨)
export function HanddrawnSparkles({ size = 18, className = '', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      className={`handdrawn-icon ${className}`}
      {...baseSvgProps}
      {...props}
    >
      {/* Main 4-point star */}
      <path d="M12 2.5c0 3.8.8 4.8 4.8 4.8-4 0-4.8 1-4.8 4.8 0-3.8-.8-4.8-4.8-4.8 4 0 4.8-1 4.8-4.8z" />
      {/* Secondary sparkle */}
      <path d="M18.5 13.5c0 2.2.5 2.8 2.8 2.8-2.3 0-2.8.6-2.8 2.8 0-2.2-.5-2.8-2.8-2.8 2.3 0 2.8-.6 2.8-2.8z" />
      {/* Twinkle dot */}
      <circle cx="6.5" cy="17.5" r="0.9" fill="currentColor" />
    </svg>
  );
}

// 19. Companion Guests / People (replaces 👥)
export function HanddrawnGuests({ size = 20, className = '', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      className={`handdrawn-icon ${className}`}
      {...baseSvgProps}
      {...props}
    >
      {/* Person 1 */}
      <circle cx="8" cy="6" r="2.6" />
      <path d="M3.8 18.5c0-3 1.8-4.8 4.2-4.8s4.2 1.8 4.2 4.8" />
      {/* Person 2 */}
      <circle cx="16" cy="7" r="2.2" />
      <path d="M12.2 18.5c.2-2.4 1.6-4.2 3.8-4.2s3.8 1.8 3.8 4.2" />
    </svg>
  );
}

// 20. Handdrawn Settings Gear (replaces ⚙️)
export function HanddrawnSettings({ size = 18, className = '', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      className={`handdrawn-icon ${className}`}
      {...baseSvgProps}
      {...props}
    >
      <circle cx="12" cy="12" r="2.6" />
      <path d="M12 3.5l.8 1.8 1.9-.4.8 1.8 1.7.9-.1 2 1.4 1.4-.9 1.7.4 1.9-1.8.8-.4 1.9-1.9.1-.9 1.7-1.7-.9-1.4 1.4-1.7-.9-.9 1.7-1.9-.1-.4-1.9-1.8-.8.4-1.9-.9-1.7 1.4-1.4-.1-2 1.7-.9.8-1.8 1.9.4.8-1.8z" />
    </svg>
  );
}

// 21. Handdrawn 5-Point Star (replaces ⭐)
export function HanddrawnStar({ size = 18, className = '', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      className={`handdrawn-icon ${className}`}
      {...baseSvgProps}
      {...props}
    >
      <path d="M12 2.8l2.6 5.4 6 .8-4.4 4.2 1 6-5.2-2.8-5.2 2.8 1-6L3.4 9l6-.8 2.6-5.4z" />
    </svg>
  );
}

// 22. Handdrawn Clock (replaces 🕒, ⏰)
export function HanddrawnClock({ size = 20, className = '', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      className={`handdrawn-icon ${className}`}
      {...baseSvgProps}
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v4.5l3.2 2" />
    </svg>
  );
}

