'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import PhotoboothCard from './PhotoboothCard';
import {
  HanddrawnOrientationPortrait,
  HanddrawnOrientationLandscape,
  HanddrawnRefresh,
  HanddrawnImage,
} from '@/components/icons/HanddrawnIcons';

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
  orientation = 'portrait',
  onOrientationChange,
  crop,
  onCropChange,
  onChangePhoto,
  locked = false,
  filter,
  cssFilter,
  showControls = true,
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
          <div className="btn-text-col">
            <span className="btn-main-label">Portrait</span>
            <span className="btn-sub-label">10 × 14.8 cm</span>
          </div>
        </button>
        <button
          type="button"
          className={`orientation-btn ${!isPortrait ? 'active' : ''}`}
          onClick={() => handleOrientationToggle('landscape')}
          aria-pressed={!isPortrait}
          disabled={locked}
        >
          <span className="icon-landscape" aria-hidden="true">▭</span>
          <div className="btn-text-col">
            <span className="btn-main-label">Landscape</span>
            <span className="btn-sub-label">14.8 × 10 cm</span>
          </div>
        </button>
      </div>

      {/* 2. Framed Interactive Workspace */}
      <div className="crop-workspace">
        <PhotoboothCard
          imageUrl={imageUrl}
          crop={crop}
          orientation={orientation}
          filter={filter}
          cssFilter={cssFilter}
          interactive={true}
          viewportRef={viewportRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={handleKeyDown}
          showGrid={true}
          locked={locked}
        />
      </div>

      {/* 3. Range Controls for Accessibility & Fine-Tuning */}
      {showControls && (
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
              aria-label="Zoom photo"
              disabled={locked}
            />
          </div>

          <div className="control-grid-sliders">
            <div className="control-row">
              <div className="control-label-row">
                <label htmlFor="pan-x-range">Horizontal position (X)</label>
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
                <label htmlFor="pan-y-range">Vertical position (Y)</label>
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
              title="Reset photo to center position"
            >
              <span>↺ Center Photo</span>
            </button>

            {onChangePhoto && !locked && (
              <button
                type="button"
                className="crop-btn tertiary"
                onClick={onChangePhoto}
                title="Choose another photo from device"
              >
                <span>🖼️ Change Photo</span>
              </button>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .cropper-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
          width: 100%;
        }

        .orientation-selector {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          width: 100%;
        }

        .orientation-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 12px;
          background: #fdfaf5;
          border: 1.5px solid #e8dfc8;
          color: #635b52;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s ease;
          min-height: 52px;
        }

        .orientation-btn:hover:not(:disabled) {
          border-color: #d4af37;
          background: #fff;
          transform: translateY(-1px);
        }

        .orientation-btn.active {
          border-color: #d4af37;
          background: #fdf6e7;
          color: #8c6818;
          box-shadow: 0 4px 14px rgba(212, 175, 55, 0.18);
          font-weight: 600;
        }

        .orientation-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .icon-portrait {
          font-size: 20px;
          line-height: 1;
        }

        .icon-landscape {
          font-size: 20px;
          line-height: 1;
        }

        .btn-text-col {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
        }

        .btn-main-label {
          font-size: 14px;
          font-weight: 600;
          line-height: 1.2;
        }

        .btn-sub-label {
          font-size: 11px;
          opacity: 0.75;
          line-height: 1.2;
        }

        .crop-workspace {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .crop-controls {
          background: #fbf9f4;
          border: 1px solid #e8dfc8;
          border-radius: 14px;
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .control-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .control-label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12.5px;
          color: #554f46;
          font-weight: 500;
        }

        .control-value {
          font-size: 11.5px;
          color: #8c6818;
          font-weight: 600;
        }

        .slider-input {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 6px;
          border-radius: 3px;
          background: #e2d8c3;
          outline: none;
          cursor: pointer;
        }

        .slider-input::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #d4af37;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
          cursor: grab;
        }

        .slider-input::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #d4af37;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
          cursor: grab;
        }

        .control-grid-sliders {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        @media (max-width: 500px) {
          .control-grid-sliders {
            grid-template-columns: 1fr;
          }
        }

        .crop-action-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-top: 4px;
          flex-wrap: wrap;
        }

        .crop-btn {
          font-family: inherit;
          font-size: 12.5px;
          font-weight: 500;
          padding: 8px 14px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .crop-btn.secondary {
          background: #ffffff;
          border: 1px solid #dcd4c0;
          color: #4a443c;
        }

        .crop-btn.secondary:hover:not(:disabled) {
          border-color: #d4af37;
          background: #fdfaf5;
        }

        .crop-btn.tertiary {
          background: transparent;
          border: 1px dashed #c4b9a2;
          color: #7d5a00;
        }

        .crop-btn.tertiary:hover:not(:disabled) {
          background: rgba(212, 175, 55, 0.08);
          border-color: #d4af37;
        }

        .crop-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
