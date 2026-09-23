'use client';

import { useState } from 'react';
import { DRESSCODE_PALETTE } from '@/lib/rsvpConstants';
import { HanddrawnCheck } from '@/components/icons/HanddrawnIcons';
import styles from '@/app/rsvp/rsvp.module.css';

export default function DressCodeSection() {
  const [copiedHex, setCopiedHex] = useState(null);

  const handleCopyHex = (hex) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(hex);
      setCopiedHex(hex);
      setTimeout(() => setCopiedHex(null), 1500);
    }
  };

  return (
    <section
      id="rsvp-dresscode-section"
      className={styles.banquetCard}
      aria-label="Wedding dress code guidelines"
    >
      {/* Header */}
      <div className={styles.formHeader} style={{ marginBottom: 18 }}>
        <div className={styles.badgePill}>
          <span className={styles.badgeSparkle}>✦</span>
          <span>DRESS CODE</span>
          <span className={styles.badgeSparkle}>✦</span>
        </div>

        <h2 className={styles.cardTitleScript}>Dress Code</h2>

        <p className={styles.cardSubtitle} style={{ marginBottom: 0 }}>
          Warm Earthy &amp; Natural Tones
        </p>

        {/* Gold Filigree Divider */}
        <div className={styles.goldFiligreeDivider} aria-hidden="true">
          <div className={styles.goldFiligreeLine} />
          <span className={styles.goldFiligreeKnot}>✦</span>
          <div className={styles.goldFiligreeLine} />
        </div>
      </div>

      {/* Seamless Color Palette Ribbon */}
      <div className={styles.cleanPaletteRibbon} aria-hidden="true">
        {DRESSCODE_PALETTE.map((color) => (
          <div
            key={color.id}
            className={styles.cleanPaletteSegment}
            style={{ backgroundColor: color.hex }}
          />
        ))}
      </div>

      {/* Clean Color Swatches Grid */}
      <div className={styles.cleanSwatchesGrid} role="list" aria-label="Dress code color palette">
        {DRESSCODE_PALETTE.map((color) => {
          const isCopied = copiedHex === color.hex;
          return (
            <button
              key={color.id}
              type="button"
              onClick={() => handleCopyHex(color.hex)}
              className={`${styles.cleanSwatchCard} ${isCopied ? styles.cleanSwatchCardCopied : ''}`}
              title={`Click to copy color code ${color.name}: ${color.hex}`}
              aria-label={`${color.name} ${color.hex}`}
            >
              <div
                className={styles.cleanSwatchCircle}
                style={{
                  backgroundColor: color.hex,
                  borderColor: color.border || 'rgba(0, 0, 0, 0.1)',
                }}
              >
                {isCopied && (
                  <span className={styles.cleanSwatchCheck}>
                    <HanddrawnCheck size={14} strokeWidth={2.8} />
                  </span>
                )}
              </div>
              <span className={styles.cleanSwatchName}>{color.name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
