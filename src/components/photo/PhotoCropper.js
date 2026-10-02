'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export function computeNormalizedCrop(imageWidth, imageHeight, orientation, zoom, panX, panY) {
  if (!imageWidth || !imageHeight) return { x: 0, y: 0, width: 1, height: 1 };
  const ratio = orientation === 'portrait' ? 100 / 148 : 148 / 100;
  let maxW, maxH;
  if (imageWidth / imageHeight > ratio) {
    maxH = imageHeight;
    maxW = Math.round(imageHeight * ratio);
    if (maxW > imageWidth) {
      maxW = imageWidth;
      maxH = Math.round(imageWidth / ratio);
    }
  } else {
    maxW = imageWidth;
    maxH = Math.round(imageWidth / ratio);
    if (maxH > imageHeight) {
      maxH = imageHeight;
      maxW = Math.round(imageHeight * ratio);
    }
  }

  const safeZoom = Math.max(1, Math.min(3, zoom || 1));
  const cropW = Math.max(100, Math.min(maxW, Math.round(maxW / safeZoom)));
  const cropH = Math.max(100, Math.min(maxH, Math.round(cropW / ratio)));

  const maxPanX = Math.max(0, imageWidth - cropW);
  const maxPanY = Math.max(0, imageHeight - cropH);

  const clampedPanX = Math.max(0, Math.min(1, panX));
  const clampedPanY = Math.max(0, Math.min(1, panY));

  const pixelX = Math.round(clampedPanX * maxPanX);
  const pixelY = Math.round(clampedPanY * maxPanY);

  return {
    x: pixelX / imageWidth,
    y: pixelY / imageHeight,
    width: cropW / imageWidth,
    height: cropH / imageHeight,
  };
}

export function computeInverseCropParams(imageWidth, imageHeight, orientation, crop) {
  if (!imageWidth || !imageHeight || !crop || typeof crop.width !== 'number') {
    return { zoom: 1, panX: 0.5, panY: 0.5 };
  }

  const ratio = orientation === 'portrait' ? 100 / 148 : 148 / 100;
  let maxW, maxH;
  if (imageWidth / imageHeight > ratio) {
    maxH = imageHeight;
    maxW = Math.round(imageHeight * ratio);
    if (maxW > imageWidth) {
      maxW = imageWidth;
      maxH = Math.round(imageWidth / ratio);
    }
  } else {
    maxW = imageWidth;
    maxH = Math.round(imageWidth / ratio);
    if (maxH > imageHeight) {
      maxH = imageHeight;
      maxW = Math.round(imageHeight * ratio);
    }
  }

  const cropPixelW = Math.round(crop.width * imageWidth);
  const cropPixelH = Math.round(crop.height * imageHeight);
  const cropPixelX = Math.round(crop.x * imageWidth);
  const cropPixelY = Math.round(crop.y * imageHeight);

  const rawZoom = cropPixelW > 0 ? maxW / cropPixelW : 1;
  const zoom = Math.max(1, Math.min(3, rawZoom));

  const maxPanX = Math.max(0, imageWidth - cropPixelW);
  const maxPanY = Math.max(0, imageHeight - cropPixelH);

  const panX = maxPanX > 0 ? Math.max(0, Math.min(1, cropPixelX / maxPanX)) : 0.5;
  const panY = maxPanY > 0 ? Math.max(0, Math.min(1, cropPixelY / maxPanY)) : 0.5;

  return { zoom, panX, panY };
}

export default function PhotoCropper({
  imageUrl,
  imageWidth,
  imageHeight,
  orientation,
  onOrientationChange,
  crop,
  onCropChange,
  onChangePhoto,
  locked = false,
}) {
  const [zoom, setZoom] = useState(() => {
    return computeInverseCropParams(imageWidth, imageHeight, orientation, crop).zoom;
  });
  const [panX, setPanX] = useState(() => {
    return computeInverseCropParams(imageWidth, imageHeight, orientation, crop).panX;
  });
  const [panY, setPanY] = useState(() => {
    return computeInverseCropParams(imageWidth, imageHeight, orientation, crop).panY;
  });

  // Track whether the user has actively modified the crop
  const hasUserModifiedRef = useRef(!crop);

  // Dragging state
  const isDraggingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0, initialPanX: 0.5, initialPanY: 0.5 });
  const viewportRef = useRef(null);

  // Recalculate crop when parameters change - strictly do not run if locked!
  useEffect(() => {
    if (locked) return;
    if (!imageWidth || !imageHeight) return;
    if (!hasUserModifiedRef.current) return;

    const nextCrop = computeNormalizedCrop(imageWidth, imageHeight, orientation, zoom, panX, panY);
    onCropChange(nextCrop);
  }, [locked, imageWidth, imageHeight, orientation, zoom, panX, panY, onCropChange]);

  const handleReset = () => {
    if (locked) return;
    hasUserModifiedRef.current = true;
    setZoom(1);
    setPanX(0.5);
    setPanY(0.5);
  };

  const handleOrientationToggle = (newOrientation) => {
    if (locked) return;
    if (newOrientation === orientation) return;
    hasUserModifiedRef.current = true;
    onOrientationChange(newOrientation);
    handleReset();
  };

  // Touch and Mouse pointer drag handler
  const handlePointerDown = (e) => {
    if (locked) return;
    if (e.button !== undefined && e.button !== 0) return;
    isDraggingRef.current = true;
    startPosRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialPanX: panX,
      initialPanY: panY,
    };
    if (viewportRef.current) {
      viewportRef.current.setPointerCapture?.(e.pointerId);
    }
  };

  const handlePointerMove = (e) => {
    if (locked) return;
    if (!isDraggingRef.current) return;
    hasUserModifiedRef.current = true;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;

    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const sensX = rect.width > 0 ? (dx / rect.width) * 1.5 : 0;
    const sensY = rect.height > 0 ? (dy / rect.height) * 1.5 : 0;

    // Moving mouse to the right moves crop to the left (pan ratio decreases)
    // Moving mouse to the left moves crop to the right
    setPanX((prev) => Math.max(0, Math.min(1, startPosRef.current.initialPanX - sensX)));
    setPanY((prev) => Math.max(0, Math.min(1, startPosRef.current.initialPanY - sensY)));
  };

  const handlePointerUp = (e) => {
    isDraggingRef.current = false;
    if (viewportRef.current && viewportRef.current.releasePointerCapture) {
      try {
        viewportRef.current.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const handleKeyDown = (e) => {
    if (locked) return;
    const STEP = 0.04;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      hasUserModifiedRef.current = true;
      setPanX((prev) => Math.max(0, Math.min(1, prev - STEP)));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      hasUserModifiedRef.current = true;
      setPanX((prev) => Math.max(0, Math.min(1, prev + STEP)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      hasUserModifiedRef.current = true;
      setPanY((prev) => Math.max(0, Math.min(1, prev - STEP)));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      hasUserModifiedRef.current = true;
      setPanY((prev) => Math.max(0, Math.min(1, prev + STEP)));
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      hasUserModifiedRef.current = true;
      setZoom((prev) => Math.min(3, prev + 0.1));
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      hasUserModifiedRef.current = true;
      setZoom((prev) => Math.max(1, prev - 0.1));
    }
  };

  const isPortrait = orientation === 'portrait';
  const ratio = isPortrait ? 100 / 148 : 148 / 100;

  return (
    <div className="cropper-container">
      {/* 1. Orientation Selector */}
      <div className="orientation-selector" role="group" aria-label="Select print orientation">
        <button
          type="button"
          className={`orientation-btn ${isPortrait ? 'active' : ''}`}
          onClick={() => handleOrientationToggle('portrait')}
          aria-pressed={isPortrait}
          disabled={locked}
        >
          <span className="icon-portrait" aria-hidden="true">▯</span>
          <span>Portrait (10 × 14.8 cm)</span>
        </button>
        <button
          type="button"
          className={`orientation-btn ${!isPortrait ? 'active' : ''}`}
          onClick={() => handleOrientationToggle('landscape')}
          aria-pressed={!isPortrait}
          disabled={locked}
        >
          <span className="icon-landscape" aria-hidden="true">▭</span>
          <span>Landscape (14.8 × 10 cm)</span>
        </button>
      </div>

      {/* 2. Interactive Crop Framing & WYSIWYG Preview */}
      <div className="crop-workspace">
        <div className="crop-panel">
          <div className="crop-panel-title">
            <span>Drag photo or use sliders below to adjust framing</span>
            <span className="crop-hint">Ratio {isPortrait ? '100:148' : '148:100'}</span>
          </div>

          <div
            ref={viewportRef}
            className={`crop-viewport ${isPortrait ? 'ratio-portrait' : 'ratio-landscape'}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="region"
            aria-label="Photo framing canvas. Drag with mouse/touch or use arrow keys to reposition"
          >
            {/* WYSIWYG Cropped Content */}
            <div className="crop-preview-box">
              {imageUrl && crop && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={imageUrl}
                  alt="Photo crop preview"
                  className="crop-preview-img"
                  style={{
                    width: `${crop.width > 0 ? (100 / crop.width).toFixed(3) : 100}%`,
                    height: `${crop.height > 0 ? (100 / crop.height).toFixed(3) : 100}%`,
                    left: `-${crop.width > 0 ? ((crop.x / crop.width) * 100).toFixed(3) : 0}%`,
                    top: `-${crop.height > 0 ? ((crop.y / crop.height) * 100).toFixed(3) : 0}%`,
                  }}
                  draggable={false}
                />
              )}
              {/* Overlay guides */}
              <div className="crop-grid-lines" aria-hidden="true">
                <div className="grid-line horizontal top" />
                <div className="grid-line horizontal bottom" />
                <div className="grid-line vertical left" />
                <div className="grid-line vertical right" />
              </div>
            </div>

            <div className="crop-drag-badge" aria-hidden="true">
              <span>{locked ? '🔒 Framing locked for submitted request' : '✦ Drag to reposition'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Range Controls for Accessibility & Fine-Tuning */}
      <div className="crop-controls">
        <div className="control-row">
          <div className="control-label-row">
            <label htmlFor="zoom-range">Zoom ({zoom.toFixed(1)}x)</label>
            <span className="control-value">{Math.round((zoom - 1) * 50)}% zoom</span>
          </div>
          <input
            id="zoom-range"
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(e) => {
              hasUserModifiedRef.current = true;
              setZoom(parseFloat(e.target.value));
            }}
            className="slider-input"
            aria-label="Photo zoom"
            disabled={locked}
          />
        </div>

        <div className="control-grid-sliders">
          <div className="control-row">
            <div className="control-label-row">
              <label htmlFor="pan-x-range">Horizontal Position (X)</label>
              <span className="control-value">{Math.round(panX * 100)}%</span>
            </div>
            <input
              id="pan-x-range"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={panX}
              onChange={(e) => {
                hasUserModifiedRef.current = true;
                setPanX(parseFloat(e.target.value));
              }}
              className="slider-input"
              aria-label="Horizontal position"
              disabled={locked}
            />
          </div>

          <div className="control-row">
            <div className="control-label-row">
              <label htmlFor="pan-y-range">Vertical Position (Y)</label>
              <span className="control-value">{Math.round(panY * 100)}%</span>
            </div>
            <input
              id="pan-y-range"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={panY}
              onChange={(e) => {
                hasUserModifiedRef.current = true;
                setPanY(parseFloat(e.target.value));
              }}
              className="slider-input"
              aria-label="Vertical position"
              disabled={locked}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="crop-action-bar">
          <button
            type="button"
            className="crop-btn secondary"
            onClick={handleReset}
            disabled={locked}
            title="Reset framing to center"
          >
            <span>↺ Reset to Center</span>
          </button>

          {onChangePhoto && !locked && (
            <button
              type="button"
              className="crop-btn tertiary"
              onClick={onChangePhoto}
              title="Choose a different photo from your device"
            >
              <span>🖼️ Choose Different Photo</span>
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        .cropper-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
          width: 100%;
        }
        .orientation-selector {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .orientation-btn {
          min-height: 52px;
          padding: 12px 16px;
          border-radius: 14px;
          border: 1.5px solid #ded6c9;
          background: #ffffff;
          color: #231d16;
          font-family: var(--font-body), sans-serif;
          font-size: 0.94rem;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
        }
        .orientation-btn:hover {
          background: #fffdf9;
          border-color: #c9a96e;
        }
        .orientation-btn.active {
          background: #fffcf6;
          border-color: #b08d4f;
          color: #8c6720;
          font-weight: 700;
          box-shadow: 0 4px 14px rgba(176, 141, 79, 0.18);
        }
        .orientation-btn:focus-visible {
          outline: 2px solid #d4af37;
          outline-offset: 2px;
        }
        .icon-portrait {
          font-size: 1.25rem;
          transform: scaleY(1.2);
        }
        .icon-landscape {
          font-size: 1.25rem;
          transform: scaleX(1.3);
        }
        .crop-workspace {
          display: flex;
          justify-content: center;
          width: 100%;
        }
        .crop-panel {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          width: 100%;
        }
        .crop-panel-title {
          display: flex;
          justify-content: space-between;
          width: 100%;
          font-size: 0.88rem;
          color: #5d564f;
          font-family: var(--font-body), sans-serif;
        }
        .crop-hint {
          color: #8c6720;
          font-weight: 600;
        }
        .crop-viewport {
          position: relative;
          background: #111;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 12px 35px rgba(0, 0, 0, 0.25), 0 0 20px rgba(212, 175, 55, 0.2);
          border: 2.5px solid #d4af37;
          touch-action: none;
          user-select: none;
          cursor: grab;
          max-width: 100%;
          height: auto;
          margin: 0 auto;
        }
        .crop-viewport:active {
          cursor: grabbing;
        }
        .crop-viewport.ratio-portrait {
          width: min(320px, 100%);
          aspect-ratio: 100 / 148;
          height: auto;
        }
        .crop-viewport.ratio-landscape {
          width: min(440px, 100%);
          aspect-ratio: 148 / 100;
          height: auto;
        }
        .crop-preview-box {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }
        .crop-preview-img {
          position: absolute;
          max-width: none;
          max-height: none;
          pointer-events: none;
          user-select: none;
        }
        .crop-grid-lines {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .grid-line {
          position: absolute;
          background: rgba(255, 255, 255, 0.35);
        }
        .grid-line.horizontal {
          left: 0;
          right: 0;
          height: 1px;
        }
        .grid-line.horizontal.top {
          top: 33.33%;
        }
        .grid-line.horizontal.bottom {
          top: 66.66%;
        }
        .grid-line.vertical {
          top: 0;
          bottom: 0;
          width: 1px;
        }
        .grid-line.vertical.left {
          left: 33.33%;
        }
        .grid-line.vertical.right {
          left: 66.66%;
        }
        .crop-drag-badge {
          position: absolute;
          bottom: 10px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(14, 18, 23, 0.82);
          backdrop-filter: blur(6px);
          border: 1px solid rgba(212, 175, 55, 0.4);
          color: #fdfaf5;
          font-size: 0.78rem;
          font-weight: 500;
          padding: 5px 14px;
          border-radius: 9999px;
          pointer-events: none;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        }
        .crop-controls {
          background: #fdfbf8;
          border: 1px solid #eae3d7;
          border-radius: 16px;
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          width: 100%;
          box-sizing: border-box;
        }
        .control-row {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .control-label-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.88rem;
          color: #251e18;
          font-weight: 500;
        }
        .control-value {
          color: #8c6720;
          font-family: monospace;
          font-size: 0.85rem;
          font-weight: 600;
        }
        .control-grid-sliders {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .slider-input {
          width: 100%;
          min-height: 44px;
          accent-color: #b08d4f;
          cursor: pointer;
        }
        .crop-action-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          padding-top: 14px;
          border-top: 1px solid #ebd9bf;
          width: 100%;
        }
        .crop-btn {
          min-height: 44px;
          padding: 10px 20px;
          border-radius: 100px;
          font-family: var(--font-body), sans-serif;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border: 1px solid transparent;
          transition: all 0.2s ease;
        }
        .crop-btn.secondary {
          background: #ffffff;
          color: #4a4135;
          border: 1.5px solid #dcd5c7;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }
        .crop-btn.secondary:hover {
          background: #fbf9f5;
          border-color: #b08d4f;
          color: #231d16;
          transform: translateY(-1px);
        }
        .crop-btn.tertiary {
          background: transparent;
          color: #6b5c47;
          border: 1.5px solid transparent;
        }
        .crop-btn.tertiary:hover {
          color: #231d16;
          background: #f6f1e7;
          border-color: #ebd9bf;
        }
        .crop-btn:focus-visible {
          outline: 2px solid #d4af37;
          outline-offset: 2px;
        }
        @media (max-width: 480px) {
          .control-grid-sliders {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .crop-action-bar {
            flex-direction: column;
            align-items: stretch;
          }
          .crop-btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
