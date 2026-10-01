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
      <div className="orientation-selector" role="group" aria-label="Chọn khổ giấy in">
        <button
          type="button"
          className={`orientation-btn ${isPortrait ? 'active' : ''}`}
          onClick={() => handleOrientationToggle('portrait')}
          aria-pressed={isPortrait}
          disabled={locked}
        >
          <span className="icon-portrait" aria-hidden="true">▯</span>
          <span>Khổ dọc (10 x 14.8 cm)</span>
        </button>
        <button
          type="button"
          className={`orientation-btn ${!isPortrait ? 'active' : ''}`}
          onClick={() => handleOrientationToggle('landscape')}
          aria-pressed={!isPortrait}
          disabled={locked}
        >
          <span className="icon-landscape" aria-hidden="true">▭</span>
          <span>Khổ ngang (14.8 x 10 cm)</span>
        </button>
      </div>

      {/* 2. Interactive Crop Framing & WYSIWYG Preview */}
      <div className="crop-workspace">
        <div className="crop-panel">
          <div className="crop-panel-title">
            <span>Kéo di chuyển hoặc dùng phím mũi tên / thanh trượt để căn chỉnh</span>
            <span className="crop-hint">Tỉ lệ {isPortrait ? '100:148' : '148:100'}</span>
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
            aria-label="Khung căn chỉnh ảnh. Kéo bằng chuột, ngón tay hoặc dùng các phím mũi tên để di chuyển ảnh"
          >
            {/* WYSIWYG Cropped Content */}
            <div className="crop-preview-box">
              {imageUrl && crop && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={imageUrl}
                  alt="Xem trước vùng ảnh cắt"
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
              <span>{locked ? '🔒 Khung ảnh đã chốt theo yêu cầu gửi' : '✦ Kéo để dịch chuyển'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Range Controls for Accessibility & Fine-Tuning */}
      <div className="crop-controls">
        <div className="control-row">
          <div className="control-label-row">
            <label htmlFor="zoom-range">Thu phóng ({zoom.toFixed(1)}x)</label>
            <span className="control-value">{Math.round((zoom - 1) * 50)}% phóng to</span>
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
            aria-label="Thu phóng ảnh"
            disabled={locked}
          />
        </div>

        <div className="control-grid-sliders">
          <div className="control-row">
            <div className="control-label-row">
              <label htmlFor="pan-x-range">Vị trí ngang (X)</label>
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
              aria-label="Vị trí ngang"
              disabled={locked}
            />
          </div>

          <div className="control-row">
            <div className="control-label-row">
              <label htmlFor="pan-y-range">Vị trí dọc (Y)</label>
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
              aria-label="Vị trí dọc"
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
            title="Đưa về căn giữa chuẩn"
          >
            <span>↺ Đặt lại căn giữa</span>
          </button>

          {onChangePhoto && !locked && (
            <button
              type="button"
              className="crop-btn tertiary"
              onClick={onChangePhoto}
              title="Chọn ảnh khác từ máy"
            >
              <span>🖼️ Chọn ảnh khác</span>
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
          min-height: 48px;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid rgba(232, 223, 200, 0.25);
          background: rgba(255, 255, 255, 0.04);
          color: #fdfaf5;
          font-size: 0.92rem;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.2s ease;
        }
        .orientation-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(212, 175, 55, 0.4);
        }
        .orientation-btn.active {
          background: rgba(212, 175, 55, 0.15);
          border-color: #d4af37;
          color: #d4af37;
          font-weight: 600;
          box-shadow: 0 0 16px rgba(212, 175, 55, 0.15);
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
          gap: 12px;
          width: 100%;
        }
        .crop-panel-title {
          display: flex;
          justify-content: space-between;
          width: 100%;
          font-size: 0.85rem;
          color: rgba(253, 250, 245, 0.7);
        }
        .crop-hint {
          color: #d4af37;
          font-weight: 600;
        }
        .crop-viewport {
          position: relative;
          background: #000;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
          border: 2px solid rgba(212, 175, 55, 0.4);
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
          background: rgba(255, 255, 255, 0.25);
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
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #fdfaf5;
          font-size: 0.75rem;
          padding: 4px 12px;
          border-radius: 9999px;
          pointer-events: none;
        }
        .crop-controls {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(232, 223, 200, 0.12);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .control-row {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .control-label-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          color: rgba(253, 250, 245, 0.85);
        }
        .control-value {
          color: #d4af37;
          font-family: monospace;
          font-size: 0.82rem;
        }
        .control-grid-sliders {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .slider-input {
          width: 100%;
          min-height: 44px;
          accent-color: #d4af37;
          cursor: pointer;
        }
        .crop-action-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          padding-top: 6px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }
        .crop-btn {
          min-height: 44px;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 0.88rem;
          font-weight: 500;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border: 1px solid transparent;
          transition: all 0.15s ease;
        }
        .crop-btn.secondary {
          background: rgba(255, 255, 255, 0.08);
          color: #fdfaf5;
          border-color: rgba(255, 255, 255, 0.15);
        }
        .crop-btn.secondary:hover {
          background: rgba(255, 255, 255, 0.14);
          border-color: rgba(212, 175, 55, 0.4);
        }
        .crop-btn.tertiary {
          background: transparent;
          color: rgba(253, 250, 245, 0.7);
        }
        .crop-btn.tertiary:hover {
          color: #fdfaf5;
          background: rgba(255, 255, 255, 0.06);
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
