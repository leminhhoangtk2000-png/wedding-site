'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  HanddrawnCamera,
  HanddrawnSparkles,
  HanddrawnCheck,
  HanddrawnBook,
  HanddrawnEnvelope,
  HanddrawnHeart,
  HanddrawnAlert,
  HanddrawnInfo,
} from '@/components/icons/HanddrawnIcons';
import PhotoCropper, { computeNormalizedCrop } from '@/components/photo/PhotoCropper';
import PhotoboothCard from '@/components/photo/PhotoboothCard';
import {
  DEFAULT_PRESETS,
  DEFAULT_GUEST_ADJUSTMENTS,
  LEGACY_PRESETS,
  defaultAdjustments,
  computeEffectiveFilter,
} from '@/lib/photo/presets';
import FilmPhoto from '@/components/photo/FilmPhoto';
import { processImageForUpload } from '@/components/photo/imageCompressor';
import { getPhotoSession, uploadPhoto, createPhotoRequest } from '@/lib/photo/client';
import styles from './photo.module.css';

const DRAFT_STORAGE_KEY = 'photo_print_draft_keys';

function readStoredDraft() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getInitialSubmittedDraft() {
  const draft = readStoredDraft();
  if (draft?.submitted && draft?.upload_id && draft?.request_key && draft?.crop) {
    return draft;
  }
  return null;
}

export default function PhotoPage() {
  // Session / Quota state
  const [sessionData, setSessionData] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionUnavailable, setSessionUnavailable] = useState(false);

  // File & Upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState(null);

  // Immutable submitted payload ref for idempotent retry across network loss/reloads
  const submittedPayloadRef = useRef(getInitialSubmittedDraft());

  const [hasSubmittedDraft, setHasSubmittedDraft] = useState(() =>
    Boolean(getInitialSubmittedDraft())
  );

  // Restore draft from sessionStorage using lazy initializers
  const [uploadData, setUploadData] = useState(() => {
    const draft = readStoredDraft();
    if (draft?.upload_id && draft?.upload_token && draft?.preview_url) {
      return {
        id: draft.upload_id,
        token: draft.upload_token,
        preview_url: draft.preview_url,
        width: draft.width,
        height: draft.height,
      };
    }
    return null;
  });

  const [guestName, setGuestName] = useState(() => {
    const draft = readStoredDraft();
    return draft?.guest_name || '';
  });

  const [orientation, setOrientation] = useState(() => {
    const draft = readStoredDraft();
    return draft?.orientation || 'portrait';
  });

  const [crop, setCrop] = useState(() => {
    const draft = readStoredDraft();
    return draft?.crop || null;
  });

  // Presets & Filter state
  const [presets,setPresets]=useState(DEFAULT_PRESETS);
  const [configVersion,setConfigVersion]=useState(()=>readStoredDraft()?.config_version??null);
  const [colorPreviewState,setColorPreviewState]=useState('loading');
  const [selectedPresetId,setSelectedPresetId]=useState(()=>readStoredDraft()?.preset_id||'soft_wedding');
  const [guestAdjustments, setGuestAdjustments] = useState(() => {
    const draft = readStoredDraft();
    return draft?.adjustments || DEFAULT_GUEST_ADJUSTMENTS;
  });

  // Current Step in 3-step photobooth flow:
  // 1: Framing (Orientation & Crop)
  // 2: Film Tone (Presets & Sliders)
  // 3: Review & Submit (Review & Print)
  const [currentStep, setCurrentStep] = useState(() => {
    const draft = readStoredDraft();
    return draft?.step || 1;
  });

  // Compute active effective filter
  const activePreset =
    presets.find((p) => p.id === selectedPresetId) || LEGACY_PRESETS.find(p=>p.id===selectedPresetId) || DEFAULT_PRESETS.find(p=>p.id===selectedPresetId) || DEFAULT_PRESETS[1];
  const effectiveFilter = computeEffectiveFilter(activePreset, guestAdjustments);

  // Submission & Retry state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submissionSuccess, setSubmissionSuccess] = useState(null); // { request, tracking_url, tracking_token }
  const [copiedCode, setCopiedCode] = useState(false);

  // Keys ref for idempotent retry
  const draftKeysRef = useRef({
    request_key: null,
    tracking_token: null,
    upload_id: null,
  });

  // Restore keys to ref on mount
  useEffect(() => {
    const draft = readStoredDraft();
    if (draft?.request_key && draft?.tracking_token) {
      draftKeysRef.current = {
        request_key: draft.request_key,
        tracking_token: draft.tracking_token,
        upload_id: draft.upload_id,
      };
    }
  }, []);

  // File input refs
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  // Fetch session status on mount
  useEffect(() => {
    let active = true;
    getPhotoSession()
      .then((res) => {
        if (!active) return;
        if (res && res.session) {
          setSessionData(res.session);
          const draft=readStoredDraft();
          const config=draft?.preset_config?.version!=null?draft.preset_config:res.preset_config;
          if(config) {
            const restoredLegacy=LEGACY_PRESETS.find(p=>p.id===draft?.preset_id);
            setPresets([...config.presets.filter(p=>p.enabled),...(restoredLegacy&&!config.presets.some(p=>p.id===restoredLegacy.id)?[restoredLegacy]:[])]);
            setConfigVersion(draft?.config_version??config.version);
            if(!draft?.preset_id) {
              const def=config.presets.find(p=>p.enabled&&p.isDefault);
              setSelectedPresetId(def.id);setGuestAdjustments(defaultAdjustments(def));
            }
          }
          setSessionUnavailable(false);
        } else {
          setSessionUnavailable(true);
        }
      })
      .catch(() => {
        if (!active) return;
        setSessionUnavailable(true);
      })
      .finally(() => {
        if (active) setSessionLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Sync draft changes to sessionStorage - ONLY when NOT in submitted/immutable state!
  useEffect(() => {
    if (hasSubmittedDraft || submittedPayloadRef.current) return;
    if (!uploadData?.id) return;
    try {
      const { request_key, tracking_token } = draftKeysRef.current;
      sessionStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
          upload_id: uploadData.id,
          upload_token: uploadData.token,
          preview_url: uploadData.preview_url,
          width: uploadData.width,
          height: uploadData.height,
          guest_name: guestName.trim(),
          orientation,
          crop,
          preset_id: selectedPresetId,
          config_version: configVersion,
          preset_config: {version:configVersion,presets},
          adjustments: guestAdjustments,
          step: currentStep,
          request_key,
          tracking_token,
          submitted: false,
        })
      );
    } catch {
      // ignore
    }
  }, [uploadData, guestName, orientation, crop, selectedPresetId, guestAdjustments, currentStep, hasSubmittedDraft, configVersion, presets]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  // Handle file selection from Camera or Gallery
  const handleFilePicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';

    if (!file) {
      // Cancel file picker leaves current draft intact
      return;
    }

    if (isUploading) return;
    if (hasSubmittedDraft || submittedPayloadRef.current) return;

    // Immediately lock mutex starting from precompression and invalidate old uploadData & crop
    setIsUploading(true);
    setUploadData(null);
    setCrop(null);
    setErrorMessage('');
    setHasSubmittedDraft(false);
    submittedPayloadRef.current = null;

    // Precompress if needed
    const result = await processImageForUpload(file);
    if (!result.ok) {
      setErrorMessage(result.error);
      setIsUploading(false);
      return;
    }

    const processedFile = result.file;
    setSelectedFile(processedFile);

    // Create temporary local preview (does not claim server upload completed)
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }
    const objectUrl = URL.createObjectURL(processedFile);
    setLocalPreviewUrl(objectUrl);

    // Upload to server
    try {
      const uploadRes = await uploadPhoto(processedFile);
      if (uploadRes && uploadRes.upload) {
        setUploadData(uploadRes.upload);
        // Initialize default crop centered
        const initialCrop = computeNormalizedCrop(
          uploadRes.upload.width,
          uploadRes.upload.height,
          orientation,
          1,
          0.5,
          0.5
        );
        setCrop(initialCrop);

        // Generate and persist new submission keys for this draft if upload changed
        const newKeys = {
          request_key: crypto.randomUUID(),
          tracking_token: crypto.randomUUID(),
          upload_id: uploadRes.upload.id,
        };
        draftKeysRef.current = newKeys;

        try {
          sessionStorage.setItem(
            DRAFT_STORAGE_KEY,
            JSON.stringify({
              upload_id: uploadRes.upload.id,
              upload_token: uploadRes.upload.token,
              preview_url: uploadRes.upload.preview_url,
              width: uploadRes.upload.width,
              height: uploadRes.upload.height,
              guest_name: guestName.trim(),
              orientation,
              crop: initialCrop,
              request_key: newKeys.request_key,
              tracking_token: newKeys.tracking_token,
              submitted: false,
            })
          );
        } catch {
          // ignore
        }
      }
    } catch (uploadErr) {
      setErrorMessage(uploadErr.message || 'Unable to upload photo to server. Please try again.');
      // uploadData remains null so old photo cannot be submitted with new preview
    } finally {
      setIsUploading(false);
    }
  };

  const handleChangePhoto = () => {
    // Only allowed if no pending/unresolved submission exists
    if (hasSubmittedDraft || submittedPayloadRef.current) return;
    setUploadData(null);
    setSelectedFile(null);
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
      setLocalPreviewUrl(null);
    }
    setCrop(null);
    setErrorMessage('');
    setHasSubmittedDraft(false);
    submittedPayloadRef.current = null;
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const handleOrientationChange = (newOrientation) => {
    if (hasSubmittedDraft || submittedPayloadRef.current) return;
    setOrientation(newOrientation);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    let payloadToSend;

    if (submittedPayloadRef.current) {
      // RETRY MODE: Use immutable submitted payload ref directly!
      // Strictly preserves original crop, guest_name, orientation, keys, and tokens.
      payloadToSend = {
        upload_id: submittedPayloadRef.current.upload_id,
        upload_token: submittedPayloadRef.current.upload_token,
        request_key: submittedPayloadRef.current.request_key,
        tracking_token: submittedPayloadRef.current.tracking_token,
        guest_name: submittedPayloadRef.current.guest_name,
        orientation: submittedPayloadRef.current.orientation,
        ...(submittedPayloadRef.current.filter ? {filter:submittedPayloadRef.current.filter} : {}),
        crop: {
          x: submittedPayloadRef.current.crop.x,
          y: submittedPayloadRef.current.crop.y,
          width: submittedPayloadRef.current.crop.width,
          height: submittedPayloadRef.current.crop.height,
        },
      };
    } else {
      // INITIAL SUBMISSION: Validate and establish immutable payload
      const trimmedName = guestName.trim();
      if (!trimmedName) {
        setErrorMessage('Please enter your name (up to 80 characters).');
        return;
      }
      if (trimmedName.length > 80) {
        setErrorMessage('Name is too long (up to 80 characters).');
        return;
      }
      if (!uploadData || !uploadData.id || !uploadData.token) {
        setErrorMessage('Photo upload is not complete yet.');
        return;
      }
      if (!crop) {
        setErrorMessage('Please adjust photo framing before submitting.');
        return;
      }

      if(configVersion==null||colorPreviewState!=='ready'){setErrorMessage('Please wait for color settings and preview to load before submitting.');return;}

      // Ensure persistent retry keys
      let { request_key, tracking_token, upload_id } = draftKeysRef.current;
      if (!request_key || !tracking_token || upload_id !== uploadData.id) {
        request_key = crypto.randomUUID();
        tracking_token = crypto.randomUUID();
        const updatedKeys = { request_key, tracking_token, upload_id: uploadData.id };
        draftKeysRef.current = updatedKeys;
      }

      payloadToSend = {
        upload_id: uploadData.id,
        upload_token: uploadData.token,
        request_key,
        tracking_token,
        guest_name: trimmedName,
        orientation,
        crop: {
          x: crop.x,
          y: crop.y,
          width: crop.width,
          height: crop.height,
        },
        filter: {
          preset_id: selectedPresetId,
          config_version: LEGACY_PRESETS.some(p=>p.id===selectedPresetId)?0:configVersion,
          adjustments: guestAdjustments,
        },
      };

      // Set immutable body ref BEFORE POST
      const immutableSnapshot = {
        ...payloadToSend,
        preview_url: uploadData.preview_url,
        width: uploadData.width,
        height: uploadData.height,
        preset_id: selectedPresetId,
        config_version: configVersion,
        preset_config: {version:configVersion,presets},
        adjustments: guestAdjustments,
        step: 3,
        submitted: true,
      };
      submittedPayloadRef.current = immutableSnapshot;
      setHasSubmittedDraft(true);

      // Save to sessionStorage before POST for reload safety
      try {
        sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(immutableSnapshot));
      } catch {
        // ignore
      }
    }

    setIsSubmitting(true);

    try {
      const res = await createPhotoRequest(payloadToSend);
      if (res && res.request) {
        // Confirmed success: clear draft keys and unlock
        try {
          sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        } catch {
          // ignore
        }
        submittedPayloadRef.current = null;
        setHasSubmittedDraft(false);
        setSubmissionSuccess({
          request: res.request,
          tracking_url: res.tracking_url,
          tracking_token: payloadToSend.tracking_token,
        });
      } else {
        throw new Error('Invalid response received from server.');
      }
    } catch (err) {
      // Distinguish definitive server rejections from ambiguous network/server errors
      const definitiveRejectionCodes = [
        'UPLOAD_NOT_FOUND',
        'INVALID_CROP',
        'INVALID_INPUT',
        'INVALID_IMAGE',
        'HEIC_UNSUPPORTED',
        'PAUSED',
        'FULL',
        'UPLOAD_LIMIT',
        'IDEMPOTENCY_CONFLICT',
      ];

      const isDefinitiveFailure = err.code && definitiveRejectionCodes.includes(err.code);

      if (isDefinitiveFailure) {
        // Server definitively confirmed request was NOT created
        // Unlock editing, clear submitted payload ref and storage
        submittedPayloadRef.current = null;
        setHasSubmittedDraft(false);
        try {
          sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        } catch {
          // ignore
        }
        setErrorMessage(err.message || 'Photo print request was not accepted. Please try again.');
      } else {
        // Ambiguous result (network drop, timeout, 5xx server crash, lost response)
        // Keep submittedPayloadRef.current and hasSubmittedDraft = true!
        // Storage retains submitted: true so reloads continue in idempotent retry mode.
        setErrorMessage(
          err.message ||
            'Could not connect to server. Your request may already be saved. Please click "Resubmit Print Request" to retrieve your code without using an extra print credit.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      // Fallback
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const isSessionAccepting = sessionData ? sessionData.accepting : true;
  const isSessionFull = sessionData && sessionData.capacity != null ? sessionData.remaining <= 0 : false;
  // If retrying an already submitted payload, do NOT block! Request may have already committed on server.
  const isBlocked = !hasSubmittedDraft && (isSessionFull || !isSessionAccepting);

  return (
    <div className={styles.pageContainer}>
      <div className={styles.heroCandlelightGlow} aria-hidden="true" />

      <main className={styles.mainContent}>
        {/* Hidden File Inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleFilePicked}
          aria-label="Take new photo using camera"
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFilePicked}
          aria-label="Choose photo from photo library"
        />

        {/* Unavailable Banner */}
        {sessionUnavailable && (
          <div className={`${styles.alertBanner} ${styles.alertUnavailable}`} role="alert">
            <span className={styles.alertIcon} aria-hidden="true">
              <HanddrawnInfo size={22} />
            </span>
            <div>
              <strong>Print Station Not Ready</strong>
              <div>The photo printing system is being prepared or temporarily interrupted. You can still select and crop your photo ahead of time.</div>
            </div>
          </div>
        )}

        {/* Paused Banner */}
        {sessionData && !sessionData.accepting && (
          <div className={`${styles.alertBanner} ${styles.alertPaused}`} role="alert">
            <span className={styles.alertIcon} aria-hidden="true">
              <HanddrawnAlert size={22} />
            </span>
            <div>
              <strong>Submissions Temporarily Paused</strong>
              <div>The photo station is temporarily paused to process existing prints. Please wait for our operator to reopen submissions.</div>
            </div>
          </div>
        )}

        {/* Full Banner */}
        {sessionData && sessionData.capacity != null && sessionData.remaining <= 0 && (
          <div className={`${styles.alertBanner} ${styles.alertFull}`} role="alert">
            <span className={styles.alertIcon} aria-hidden="true">
              <HanddrawnAlert size={22} />
            </span>
            <div>
              <strong>Print Capacity Reached</strong>
              <div>The photo station has reached its maximum quota of {sessionData.capacity} prints today. Thank you for sharing your wonderful memories!</div>
            </div>
          </div>
        )}

        {/* Trial Submissions / Intake Only Banner */}
        {sessionData && sessionData.intake_only && sessionData.accepting && (sessionData.capacity == null || sessionData.remaining > 0) && (
          <div className={`${styles.alertBanner} ${styles.alertInfo}`} role="status" aria-live="polite">
            <span className={styles.alertIcon} aria-hidden="true">
              <HanddrawnInfo size={22} />
            </span>
            <div>
              <strong>Trial submissions are open</strong>
              <div>
                You can submit a photo now. Printing will start after the print station is configured; your request will remain pending.
              </div>
            </div>
          </div>
        )}

        {/* Recovered Draft Notice */}
        {hasSubmittedDraft && !submissionSuccess && (
          <div className={`${styles.alertBanner} ${styles.alertPaused}`} role="status">
            <span className={styles.alertIcon} aria-hidden="true">
              <HanddrawnInfo size={22} />
            </span>
            <div>
              <strong>Previous Print Request Held</strong>
              <div>
                Your submitted photo and name have been preserved. Click &quot;Resubmit Print Request&quot; below to retrieve your pickup code without consuming an extra print.
              </div>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className={`${styles.alertBanner} ${styles.alertError}`} role="alert">
            <span className={styles.alertIcon} aria-hidden="true">
              <HanddrawnAlert size={22} />
            </span>
            <div>{errorMessage}</div>
          </div>
        )}

        {/* MAIN CARD */}
        <div className={styles.card}>
          {/* Corner Gilded Filigree Flourishes */}
          <svg className={`${styles.cardCornerFoil} ${styles.cornerTopLeft}`} viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M4 24V8a4 4 0 0 1 4-4h16" />
            <path d="M8 8l4 4" strokeDasharray="1 2" />
            <circle cx="8" cy="8" r="1.5" fill="currentColor" />
          </svg>
          <svg className={`${styles.cardCornerFoil} ${styles.cornerTopRight}`} viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M4 24V8a4 4 0 0 1 4-4h16" />
            <path d="M8 8l4 4" strokeDasharray="1 2" />
            <circle cx="8" cy="8" r="1.5" fill="currentColor" />
          </svg>
          <svg className={`${styles.cardCornerFoil} ${styles.cornerBottomLeft}`} viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M4 24V8a4 4 0 0 1 4-4h16" />
            <path d="M8 8l4 4" strokeDasharray="1 2" />
            <circle cx="8" cy="8" r="1.5" fill="currentColor" />
          </svg>
          <svg className={`${styles.cardCornerFoil} ${styles.cornerBottomRight}`} viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M4 24V8a4 4 0 0 1 4-4h16" />
            <path d="M8 8l4 4" strokeDasharray="1 2" />
            <circle cx="8" cy="8" r="1.5" fill="currentColor" />
          </svg>

          {/* SUCCESS STATE */}
          {submissionSuccess ? (
            <div className={styles.successCard}>
              <div className={styles.badgePill}>
                <span className={styles.badgeSparkle}>✦</span>
                <span>PRINT REQUEST RECEIVED</span>
                <span className={styles.badgeSparkle}>✦</span>
              </div>

              <h1 className={styles.cardTitle}>Wedding Keepsake Photo</h1>
              <p className={styles.cardSubtitle}>
                Thank you, <strong>{guestName}</strong>! Your photo has been added to the printing queue at Hoàng &amp; Duyên&apos;s wedding.
              </p>

              <div className={styles.filigreeDivider} aria-hidden="true">
                <div className={styles.filigreeLine} />
                <span className={styles.filigreeKnot}>✦</span>
                <div className={styles.filigreeLine} />
              </div>

              {/* Pickup Code Display */}
              <div className={styles.pickupHighlight}>
                <span className={styles.pickupTitle}>YOUR PICKUP CODE</span>
                <span className={styles.pickupCode}>{submissionSuccess.request.pickup_code}</span>
                <button
                  type="button"
                  className={styles.pickupCopyBtn}
                  onClick={() => handleCopyCode(submissionSuccess.request.pickup_code)}
                  aria-label="Copy pickup code"
                >
                  {copiedCode ? (
                    <>
                      <HanddrawnCheck size={16} />
                      <span>Copied</span>
                    </>
                  ) : (
                    <span>📋 Copy Code</span>
                  )}
                </button>
              </div>

              <p className={styles.successInstructions}>
                Please take a screenshot or save this code. When the system indicates it is ready, present your code at the Photo Booth station to collect your keepsake photo!
              </p>

              <div className={styles.successActions}>
                <a
                  href={`/photo/status#id=${submissionSuccess.request.id}&token=${submissionSuccess.tracking_token}`}
                  className={styles.btnPrimary}
                  rel="noreferrer"
                >
                  <span>Track Live Printing Status →</span>
                </a>

                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => {
                    setSubmissionSuccess(null);
                    submittedPayloadRef.current = null;
                    setHasSubmittedDraft(false);
                    setUploadData(null);
                    setSelectedFile(null);
                    if (localPreviewUrl) {
                      URL.revokeObjectURL(localPreviewUrl);
                      setLocalPreviewUrl(null);
                    }
                    setCrop(null);
                    setCurrentStep(1);
                    const defaultPreset=presets.find(p=>p.isDefault&&p.enabled)||presets[0];
                    setSelectedPresetId(defaultPreset.id);
                    setGuestAdjustments(defaultAdjustments(defaultPreset));
                    setErrorMessage('');
                    try {
                      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
                    } catch {
                      // ignore
                    }
                  }}
                >
                  <span>Print Another Photo</span>
                </button>
              </div>
            </div>
          ) : (
            /* UPLOAD & MULTI-STEP FLOW */
            <div>
              <div className={styles.cardHeader}>
                <div className={styles.badgePill}>
                  <span className={styles.badgeSparkle}>✦</span>
                  <span>WEDDING KEEPSAKE • PHOTO BOOTH</span>
                  <span className={styles.badgeSparkle}>✦</span>
                </div>
                <h1 className={styles.cardTitle}>Print Your Keepsake Photo</h1>
                <p className={styles.cardSubtitle}>
                  Capture and print your memorable moments with Hoàng &amp; Duyên on high-quality keepsake postcards.
                </p>
                <div className={styles.filigreeDivider} aria-hidden="true">
                  <div className={styles.filigreeLine} />
                  <span className={styles.filigreeKnot}>✦</span>
                  <div className={styles.filigreeLine} />
                </div>
              </div>

              {/* Quota indicator - only shown if a capacity quota is explicitly configured */}
              {sessionData && sessionData.capacity != null && (
                <div className={styles.quotaBox}>
                  <span className={styles.quotaLabel}>Print station quota:</span>
                  <span className={styles.quotaValue}>
                    <span>{sessionData.remaining} of {sessionData.capacity} prints available today</span>
                  </span>
                </div>
              )}

              {/* State 1: No upload yet */}
              {!uploadData && !isUploading && (
                <div className={styles.pickerSection}>
                  <div className={styles.pickerIconBox} aria-hidden="true">
                    <HanddrawnCamera size={38} />
                  </div>
                  <div className={styles.pickerPrompt}>
                    Take a new photo or choose from your device
                  </div>
                  <div className={styles.pickerHint}>
                    Supports phone photos (JPEG, PNG, WebP, or HEIC, automatically optimized).
                  </div>

                  <div className={styles.pickerButtons}>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={isBlocked}
                    >
                      <HanddrawnCamera size={18} />
                      <span>Take New Photo</span>
                    </button>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => galleryInputRef.current?.click()}
                      disabled={isBlocked}
                    >
                      <HanddrawnSparkles size={18} />
                      <span>Choose from Library</span>
                    </button>
                  </div>
                </div>
              )}

              {/* State 2: Uploading */}
              {isUploading && (
                <div className={styles.uploadingNotice}>
                  <div className={styles.spinner} aria-hidden="true" />
                  <div className={styles.uploadingText}>Uploading and processing photo...</div>
                  <div className={styles.uploadingSubtext}>
                    Optimizing resolution and fitting into wedding postcard frame
                  </div>
                </div>
              )}

              {/* State 3: Uploaded -> Multi-Step Photobooth Flow */}
              {uploadData && !isUploading && (
                <div className={styles.cropperWrapper}>
                  {/* Stepper Progress Bar */}
                  <div className={styles.stepperBar} role="navigation" aria-label="Photo booth steps">
                    <button
                      type="button"
                      className={`${styles.stepItem} ${currentStep === 1 ? styles.active : ''} ${currentStep > 1 ? styles.completed : ''}`}
                      onClick={() => !hasSubmittedDraft && setCurrentStep(1)}
                      disabled={hasSubmittedDraft}
                    >
                      <span className={styles.stepDot}>{currentStep > 1 ? '✓' : '1'}</span>
                      <span>Framing</span>
                    </button>
                    <div className={styles.stepSeparator} />
                    <button
                      type="button"
                      className={`${styles.stepItem} ${currentStep === 2 ? styles.active : ''} ${currentStep > 2 ? styles.completed : ''}`}
                      onClick={() => !hasSubmittedDraft && setCurrentStep(2)}
                      disabled={hasSubmittedDraft}
                    >
                      <span className={styles.stepDot}>{currentStep > 2 ? '✓' : '2'}</span>
                      <span>Film Tone</span>
                    </button>
                    <div className={styles.stepSeparator} />
                    <button
                      type="button"
                      className={`${styles.stepItem} ${currentStep === 3 ? styles.active : ''}`}
                      onClick={() => !hasSubmittedDraft && setCurrentStep(3)}
                      disabled={hasSubmittedDraft}
                    >
                      <span className={styles.stepDot}>3</span>
                      <span>Review &amp; Print</span>
                    </button>
                  </div>

                  {/* STEP 1: FRAMING (Orientation & Cropping) */}
                  {currentStep === 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ textAlign: 'center', marginBottom: 4 }}>
                        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', color: '#231d16', margin: 0 }}>
                          Adjust Framing
                        </h2>
                        <p style={{ fontSize: '0.88rem', color: '#635b52', marginTop: 4 }}>
                          Select portrait or landscape, then drag to reposition and zoom within the floral frame.
                        </p>
                      </div>

                      <PhotoCropper
                        imageUrl={uploadData.preview_url}
                        imageWidth={uploadData.width}
                        imageHeight={uploadData.height}
                        orientation={orientation}
                        onOrientationChange={handleOrientationChange}
                        crop={crop}
                        onCropChange={setCrop}
                        onChangePhoto={handleChangePhoto}
                        locked={hasSubmittedDraft}
                        filter={effectiveFilter}
                        showControls={true}
                      />

                      <div className={styles.stepNavRow}>
                        <button
                          type="button"
                          className={styles.btnBack}
                          onClick={handleChangePhoto}
                          disabled={hasSubmittedDraft}
                        >
                          <span>🖼️ Change Photo</span>
                        </button>
                        <button
                          type="button"
                          className={styles.btnForward}
                          onClick={() => setCurrentStep(2)}
                        >
                          <span>Continue: Choose Film Tone →</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: FILM TONE (Presets & Sliders) */}
                  {currentStep === 2 && (
                    <div className={styles.presetSection}>
                      <div style={{ textAlign: 'center', marginBottom: 2 }}>
                        <h2 className={styles.presetSectionTitle}>Choose Film Tone Style</h2>
                        <p style={{ fontSize: '0.88rem', color: '#635b52', marginTop: 4 }}>
                          Filters apply only to your photo; the vintage floral border and typography remain pristine.
                        </p>
                      </div>

                      {/* Real-time framed preview */}
                      <PhotoboothCard
                        imageUrl={uploadData.preview_url}
                        crop={crop}
                        orientation={orientation}
                        filter={effectiveFilter}
                        seed={uploadData.id}
                        onStateChange={setColorPreviewState}
                        locked={hasSubmittedDraft}
                      />

                      {/* Presets Grid */}
                      <div className={styles.presetGrid} role="radiogroup" aria-label="Film tone filters">
                        {presets.map((preset) => {
                          const isSelected = preset.id === selectedPresetId;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              className={`${styles.presetCard} ${isSelected ? styles.activePreset : ''}`}
                              onClick={() => {
                                if (!hasSubmittedDraft) {
                                  setSelectedPresetId(preset.id);
                                  setGuestAdjustments(defaultAdjustments(preset));
                                }
                              }}
                              role="radio"
                              aria-checked={isSelected}
                              disabled={hasSubmittedDraft}
                            >
                              <span style={{position:'relative',display:'block',width:'100%',aspectRatio:'4/3',overflow:'hidden',borderRadius:8}}>
                                <FilmPhoto imageUrl={uploadData.preview_url} crop={crop} orientation={orientation} filter={computeEffectiveFilter(preset,defaultAdjustments(preset))} seed={uploadData.id} thumbnail />
                              </span>
                              <span className={styles.presetName}>{preset.name}</span>
                              <span className={styles.presetSub}>{preset.subtitle}</span>
                              <span className={styles.presetSub}>{preset.tags?.join(" · ")}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Fine-Tuning Panel */}
                      <div className={styles.fineTunePanel}>
                        <div className={styles.fineTuneHeader}>
                          <span className={styles.fineTuneTitle}>Fine-Tune Tone</span>
                          <button
                            type="button"
                            className={styles.resetFilterBtn}
                            onClick={() => {
                              if (!hasSubmittedDraft) {
                                setGuestAdjustments(defaultAdjustments(activePreset));
                              }
                            }}
                            disabled={hasSubmittedDraft}
                            title="Reset adjustments to preset defaults"
                          >
                            ↺ Reset Preset
                          </button>
                        </div>

                        <div className={styles.sliderGroup}>
                          {/* Slider 1: Intensity */}
                          <div className={styles.sliderItem}>
                            <div className={styles.sliderLabelRow}>
                              <label htmlFor="intensity-range">Film Intensity ({guestAdjustments.intensity}%)</label>
                              <span className={styles.sliderValue}>{guestAdjustments.intensity}%</span>
                            </div>
                            <input
                              id="intensity-range"
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={guestAdjustments.intensity}
                              onChange={(e) =>
                                !hasSubmittedDraft &&
                                setGuestAdjustments((prev) => ({
                                  ...prev,
                                  intensity: parseInt(e.target.value, 10),
                                }))
                              }
                              className={styles.rangeInput}
                              disabled={hasSubmittedDraft}
                              aria-label="Film tone intensity"
                            />
                          </div>

                          {/* Slider 2: Brightness */}
                          <div className={styles.sliderItem}>
                            <div className={styles.sliderLabelRow}>
                              <label htmlFor="brightness-range">
                                Brightness ({guestAdjustments.brightness > 0 ? `+${guestAdjustments.brightness}` : guestAdjustments.brightness})
                              </label>
                              <span className={styles.sliderValue}>
                                {guestAdjustments.brightness > 0 ? `+${guestAdjustments.brightness}` : guestAdjustments.brightness}
                              </span>
                            </div>
                            <input
                              id="brightness-range"
                              type="range"
                              min="-40"
                              max="40"
                              step="2"
                              value={guestAdjustments.brightness}
                              onChange={(e) =>
                                !hasSubmittedDraft &&
                                setGuestAdjustments((prev) => ({
                                  ...prev,
                                  brightness: parseInt(e.target.value, 10),
                                }))
                              }
                              className={styles.rangeInput}
                              disabled={hasSubmittedDraft}
                              aria-label="Photo brightness"
                            />
                          </div>

                          {/* Slider 3: Warmth */}
                          {!activePreset.monochrome && <div className={styles.sliderItem}>
                            <div className={styles.sliderLabelRow}>
                              <label htmlFor="warmth-range">
                                Warmth ({guestAdjustments.warmth > 0 ? `+${guestAdjustments.warmth}` : guestAdjustments.warmth})
                              </label>
                              <span className={styles.sliderValue}>
                                {guestAdjustments.warmth > 0 ? `+${guestAdjustments.warmth}` : guestAdjustments.warmth}
                              </span>
                            </div>
                            <input
                              id="warmth-range"
                              type="range"
                              min="-40"
                              max="40"
                              step="2"
                              value={guestAdjustments.warmth}
                              onChange={(e) =>
                                !hasSubmittedDraft &&
                                setGuestAdjustments((prev) => ({
                                  ...prev,
                                  warmth: parseInt(e.target.value, 10),
                                }))
                              }
                              className={styles.rangeInput}
                              disabled={hasSubmittedDraft}
                              aria-label="Photo warmth"
                            />
                          </div>}
                        </div>
                      </div>

                      {/* Step 2 Navigation */}
                      <div className={styles.stepNavRow}>
                        <button
                          type="button"
                          className={styles.btnBack}
                          onClick={() => setCurrentStep(1)}
                        >
                          <span>← Back to Framing</span>
                        </button>
                        <button
                          type="button"
                          className={styles.btnForward}
                          onClick={() => setCurrentStep(3)}
                        >
                          <span>Continue: Review &amp; Print →</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: REVIEW & SUBMIT */}
                  {currentStep === 3 && (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                      <div style={{ textAlign: 'center', marginBottom: 2 }}>
                        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', color: '#231d16', margin: 0 }}>
                          Review Your Print Preview
                        </h2>
                        <p style={{ fontSize: '0.88rem', color: '#635b52', marginTop: 4 }}>
                          Check your composition and tone. Printed colors may vary slightly from screen display.
                        </p>
                      </div>

                      {/* Final Complete Keepsake Card Preview */}
                      <PhotoboothCard
                        imageUrl={uploadData.preview_url}
                        crop={crop}
                        orientation={orientation}
                        filter={effectiveFilter}
                        seed={uploadData.id}
                        onStateChange={setColorPreviewState}
                        locked={hasSubmittedDraft}
                      />

                      {/* Print Specifications Badges */}
                      <div className={styles.reviewSpecsGrid}>
                        <div className={styles.reviewSpecBadge}>
                          <span className={styles.reviewSpecIcon}>📐</span>
                          <div className={styles.reviewSpecInfo}>
                            <span className={styles.reviewSpecLabel}>Print Size</span>
                            <span className={styles.reviewSpecVal}>
                              {orientation === 'portrait' ? 'Portrait (10×14.8 cm)' : 'Landscape (14.8×10 cm)'}
                            </span>
                          </div>
                        </div>

                        <div className={styles.reviewSpecBadge}>
                          <span className={styles.reviewSpecIcon}>{activePreset.icon}</span>
                          <div className={styles.reviewSpecInfo}>
                            <span className={styles.reviewSpecLabel}>Film Tone</span>
                            <span className={styles.reviewSpecVal}>
                              {activePreset.name} ({guestAdjustments.intensity}%)
                            </span>
                          </div>
                        </div>

                        <div className={styles.reviewSpecBadge}>
                          <span className={styles.reviewSpecIcon}>🖨️</span>
                          <div className={styles.reviewSpecInfo}>
                            <span className={styles.reviewSpecLabel}>Specification</span>
                            <span className={styles.reviewSpecVal}>Single-sided Postcard</span>
                          </div>
                        </div>
                      </div>

                      {/* Guest Name input & details */}
                      <div className={styles.formFields}>
                        <div className={styles.fieldGroup}>
                          <div className={styles.fieldLabelRow}>
                            <label htmlFor="guest-name">
                              Your name or short message <span style={{ color: '#d4af37' }}>*</span>
                            </label>
                            <span className={styles.charCounter}>{guestName.length}/80</span>
                          </div>
                          <input
                            id="guest-name"
                            type="text"
                            value={guestName}
                            onChange={(e) => setGuestName(e.target.value)}
                            placeholder="e.g. Sarah, Bride's friend, Table 6..."
                            maxLength={80}
                            required
                            className={styles.textInput}
                            disabled={isSubmitting || hasSubmittedDraft}
                          />
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className={styles.stepNavRow}>
                        {!hasSubmittedDraft && (
                          <button
                            type="button"
                            className={styles.btnBack}
                            onClick={() => setCurrentStep(2)}
                            disabled={isSubmitting}
                          >
                            <span>← Back to Tone</span>
                          </button>
                        )}

                        <button
                          type="submit"
                          className={styles.btnForward}
                          style={{ minHeight: 52 }}
                          disabled={isSubmitting || isBlocked || (!hasSubmittedDraft && (!guestName.trim() || configVersion==null || colorPreviewState!=='ready'))}
                        >
                          {isSubmitting ? (
                            <>
                              <div
                                className={styles.spinner}
                                style={{ width: 20, height: 20, borderWidth: 2 }}
                                aria-hidden="true"
                              />
                              <span>
                                {hasSubmittedDraft ? 'Resubmitting print request...' : 'Submitting print request...'}
                              </span>
                            </>
                          ) : (
                            <>
                              <HanddrawnSparkles size={18} />
                              <span>{hasSubmittedDraft ? 'Resubmit Print Request' : 'Submit Print Request'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* BOTTOM EXPLORE NAVIGATION CARDS (Matching RSVP) */}
        <section className={`${styles.card} ${styles.navSectionCard}`} aria-label="Explore our wedding">
          <div className={styles.badgePill}>
            <span className={styles.badgeSparkle}>✦</span>
            <span>EXPLORE OUR WEDDING</span>
            <span className={styles.badgeSparkle}>✦</span>
          </div>

          <h2 className={styles.cardTitle}>Our Story &amp; Guestbook</h2>
          <p className={styles.cardSubtitle}>
            Discover Hoàng &amp; Duyên&apos;s 10-year journey together, RSVP, or leave heartfelt blessings in our guestbook.
          </p>

          <div className={styles.filigreeDivider} aria-hidden="true">
            <div className={styles.filigreeLine} />
            <span className={styles.filigreeKnot}>✦</span>
            <div className={styles.filigreeLine} />
          </div>

          <div className={styles.navButtonGroup}>
            <Link href="/" className={styles.navActionCard} aria-label="Read our love story">
              <div className={styles.navCardMain}>
                <div className={styles.navCardIcon} aria-hidden="true">
                  <HanddrawnBook size={24} />
                </div>
                <div className={styles.navCardTitle}>Our Story</div>
              </div>
              <div className={styles.navCardArrow} aria-hidden="true">→</div>
            </Link>

            <Link href="/rsvp" className={styles.navActionCard} aria-label="Confirm attendance (RSVP)">
              <div className={styles.navCardMain}>
                <div className={styles.navCardIcon} aria-hidden="true">
                  <HanddrawnEnvelope size={24} />
                </div>
                <div className={styles.navCardTitle}>RSVP</div>
              </div>
              <div className={styles.navCardArrow} aria-hidden="true">→</div>
            </Link>

            <Link href="/wishes" className={`${styles.navActionCard} ${styles.navActionCardPrimary}`} aria-label="Send wedding blessings">
              <div className={styles.navCardMain}>
                <div className={styles.navCardIcon} aria-hidden="true">
                  <HanddrawnHeart size={24} />
                </div>
                <div className={styles.navCardTitle}>Wishes Board</div>
              </div>
              <div className={styles.navCardArrow} aria-hidden="true">→</div>
            </Link>
          </div>
        </section>

        {/* Discreet admin link */}
        <div className={styles.adminFootnote}>
          <Link href="/admin/printing" className={styles.adminFootnoteLink}>
            ⚙️ Print Station Admin
          </Link>
        </div>
      </main>
    </div>
  );
}
