'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import PhotoHeader from '@/components/photo/PhotoHeader';
import PhotoCropper, { computeNormalizedCrop } from '@/components/photo/PhotoCropper';
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
          request_key,
          tracking_token,
          submitted: false,
        })
      );
    } catch {
      // ignore
    }
  }, [uploadData, guestName, orientation, crop, hasSubmittedDraft]);

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
      setErrorMessage(uploadErr.message || 'Không thể tải ảnh lên máy chủ. Vui lòng thử lại.');
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
        setErrorMessage('Vui lòng nhập tên của bạn (tối đa 80 ký tự).');
        return;
      }
      if (trimmedName.length > 80) {
        setErrorMessage('Tên quá dài (tối đa 80 ký tự).');
        return;
      }
      if (!uploadData || !uploadData.id || !uploadData.token) {
        setErrorMessage('Chưa có ảnh được tải lên hoàn tất.');
        return;
      }
      if (!crop) {
        setErrorMessage('Vui lòng điều chỉnh khung ảnh trước khi gửi.');
        return;
      }

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
      };

      // Set immutable body ref BEFORE POST
      const immutableSnapshot = {
        ...payloadToSend,
        preview_url: uploadData.preview_url,
        width: uploadData.width,
        height: uploadData.height,
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
        throw new Error('Không nhận được phản hồi hợp lệ từ máy chủ.');
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
        setErrorMessage(err.message || 'Yêu cầu in ảnh không được chấp nhận. Vui lòng kiểm tra lại.');
      } else {
        // Ambiguous result (network drop, timeout, 5xx server crash, lost response)
        // Keep submittedPayloadRef.current and hasSubmittedDraft = true!
        // Storage retains submitted: true so reloads continue in idempotent retry mode.
        setErrorMessage(
          err.message ||
            'Chưa nhận được phản hồi từ máy chủ. Yêu cầu của bạn có thể đã được lưu. Vui lòng bấm "Gửi lại yêu cầu" để nhận mã mà không bị tính thêm lượt in.'
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
  const isSessionFull = sessionData ? sessionData.remaining <= 0 : false;
  // If retrying an already submitted payload, do NOT block! Request may have already committed on server.
  const isBlocked = !hasSubmittedDraft && (isSessionFull || !isSessionAccepting);

  return (
    <div className={styles.pageContainer}>
      <PhotoHeader subtitle="Trạm In Ảnh Kỷ Niệm" />

      <main className={styles.mainContent}>
        {/* Hidden File Inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleFilePicked}
          aria-label="Chụp ảnh mới bằng camera"
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFilePicked}
          aria-label="Chọn ảnh có sẵn từ thư viện"
        />

        {/* Unavailable Banner */}
        {sessionUnavailable && (
          <div className={`${styles.alertBanner} ${styles.alertUnavailable}`} role="alert">
            <span className={styles.alertIcon} aria-hidden="true">⚙️</span>
            <div>
              <strong>Trạm in chưa sẵn sàng</strong>
              <div>Hệ thống in ảnh hiện đang được chuẩn bị hoặc máy chủ tạm gián đoạn. Bạn vẫn có thể thử chọn ảnh trước.</div>
            </div>
          </div>
        )}

        {/* Paused Banner */}
        {sessionData && !sessionData.accepting && (
          <div className={`${styles.alertBanner} ${styles.alertPaused}`} role="alert">
            <span className={styles.alertIcon} aria-hidden="true">⏸</span>
            <div>
              <strong>Tạm dừng nhận ảnh</strong>
              <div>Trạm in đang tạm thời ngưng nhận yêu cầu để xử lý các ảnh trước đó. Vui lòng chờ người trực mở lại.</div>
            </div>
          </div>
        )}

        {/* Full Banner */}
        {sessionData && sessionData.remaining <= 0 && (
          <div className={`${styles.alertBanner} ${styles.alertFull}`} role="alert">
            <span className={styles.alertIcon} aria-hidden="true">🚫</span>
            <div>
              <strong>Đã đủ số lượng ảnh in</strong>
              <div>Hôm nay trạm in đã đạt tối đa {sessionData.capacity} ảnh. Cảm ơn bạn đã gửi những khoảnh khắc đẹp!</div>
            </div>
          </div>
        )}

        {/* Recovered Draft Notice */}
        {hasSubmittedDraft && !submissionSuccess && (
          <div className={`${styles.alertBanner} ${styles.alertPaused}`} role="status">
            <span className={styles.alertIcon} aria-hidden="true">🔄</span>
            <div>
              <strong>Đang giữ yêu cầu in ảnh trước đó</strong>
              <div>
                Hệ thống đang khóa và giữ nguyên ảnh cùng tên bạn đã gửi. Bấm &quot;Gửi lại yêu cầu in ảnh&quot; bên dưới để nhận mã nhận ảnh mà không bị tính thêm lượt in.
              </div>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className={`${styles.alertBanner} ${styles.alertError}`} role="alert">
            <span className={styles.alertIcon} aria-hidden="true">⚠️</span>
            <div>{errorMessage}</div>
          </div>
        )}

        {/* MAIN CARD */}
        <div className={styles.card}>
          {/* SUCCESS STATE */}
          {submissionSuccess ? (
            <div className={styles.successCard}>
              <div className={styles.badgePill}>
                <span>✦ YÊU CẦU ĐÃ ĐƯỢC GỬI ✦</span>
              </div>

              <h1 className={styles.cardTitle}>In Ảnh Kỷ Niệm</h1>
              <p className={styles.cardSubtitle}>
                Cảm ơn bạn, <strong>{guestName}</strong>! Ảnh của bạn đã được đưa vào danh sách chờ in tại tiệc cưới Hoàng &amp; Duyên.
              </p>

              <div className={styles.filigreeDivider} aria-hidden="true">
                <div className={styles.filigreeLine} />
                <span className={styles.filigreeKnot}>✦</span>
                <div className={styles.filigreeLine} />
              </div>

              {/* Pickup Code Display */}
              <div className={styles.pickupHighlight}>
                <span className={styles.pickupTitle}>MÃ NHẬN ẢNH CỦA BẠN</span>
                <span className={styles.pickupCode}>{submissionSuccess.request.pickup_code}</span>
                <button
                  type="button"
                  className={styles.pickupCopyBtn}
                  onClick={() => handleCopyCode(submissionSuccess.request.pickup_code)}
                >
                  <span>{copiedCode ? '✓ Đã sao chép' : '📋 Sao chép mã'}</span>
                </button>
              </div>

              <p className={styles.successInstructions}>
                Hãy chụp màn hình hoặc lưu lại mã trên. Khi ảnh in hoàn tất, bạn có thể đọc mã này tại bàn trực in ảnh để nhận bức ảnh xinh xắn của mình!
              </p>

              <div className={styles.successActions}>
                <a
                  href={`/photo/status#id=${submissionSuccess.request.id}&token=${submissionSuccess.tracking_token}`}
                  className={styles.btnPrimary}
                  rel="noreferrer"
                >
                  <span>Xem tiến độ in ảnh trực tiếp →</span>
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
                    setErrorMessage('');
                    try {
                      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
                    } catch {
                      // ignore
                    }
                  }}
                >
                  <span>Gửi thêm ảnh khác</span>
                </button>
              </div>
            </div>
          ) : (
            /* UPLOAD & CROP FLOW */
            <div>
              <div className={styles.cardHeader}>
                <div className={styles.badgePill}>
                  <span>✦ CHỤP &amp; IN ẢNH LẤY LIỀN ✦</span>
                </div>
                <h1 className={styles.cardTitle}>In Ảnh Kỷ Niệm</h1>
                <p className={styles.cardSubtitle}>
                  Lưu giữ khoảnh khắc đáng nhớ cùng cô dâu chú rể. Ảnh sẽ được in trực tiếp tại tiệc cưới.
                </p>
                <div className={styles.filigreeDivider} aria-hidden="true">
                  <div className={styles.filigreeLine} />
                  <span className={styles.filigreeKnot}>✦</span>
                  <div className={styles.filigreeLine} />
                </div>
              </div>

              {/* Quota indicator */}
              {sessionData && (
                <div className={styles.quotaBox}>
                  <span className={styles.quotaLabel}>Hạn mức trạm in:</span>
                  <span className={styles.quotaValue}>
                    <span>Còn {sessionData.remaining} / {sessionData.capacity} lượt in</span>
                  </span>
                </div>
              )}

              {/* State 1: No upload yet */}
              {!uploadData && !isUploading && (
                <div className={styles.pickerSection}>
                  <div className={styles.pickerIconBox} aria-hidden="true">
                    📷
                  </div>
                  <div className={styles.pickerPrompt}>
                    Chụp ảnh mới hoặc chọn ảnh từ máy của bạn
                  </div>
                  <div className={styles.pickerHint}>
                    Hỗ trợ ảnh JPEG, PNG, WebP (tự động nén tối ưu) hoặc ảnh HEIC (tối đa 3MB).
                  </div>

                  <div className={styles.pickerButtons}>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={isBlocked}
                    >
                      <span>📸 Chụp ảnh ngay</span>
                    </button>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => galleryInputRef.current?.click()}
                      disabled={isBlocked}
                    >
                      <span>🖼️ Chọn ảnh có sẵn</span>
                    </button>
                  </div>
                </div>
              )}

              {/* State 2: Uploading */}
              {isUploading && (
                <div className={styles.uploadingNotice}>
                  <div className={styles.spinner} aria-hidden="true" />
                  <div className={styles.uploadingText}>Đang tải ảnh lên máy chủ...</div>
                  <div className={styles.uploadingSubtext}>
                    Đang chuẩn hoá kích thước và chuẩn bị khung căn chỉnh
                  </div>
                </div>
              )}

              {/* State 3: Uploaded -> Crop & Submit */}
              {uploadData && !isUploading && (
                <form onSubmit={handleSubmit} className={styles.cropperWrapper}>
                  {/* Photo Cropper Component */}
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
                  />

                  {/* Guest Name input & details */}
                  <div className={styles.formFields}>
                    <div className={styles.fieldGroup}>
                      <div className={styles.fieldLabelRow}>
                        <label htmlFor="guest-name">
                          Tên của bạn hoặc lời nhắn ngắn <span style={{ color: '#d4af37' }}>*</span>
                        </label>
                        <span className={styles.charCounter}>{guestName.length}/80</span>
                      </div>
                      <input
                        id="guest-name"
                        type="text"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="VD: Bạn Minh, Bàn 5, Team Bạn Thân..."
                        maxLength={80}
                        required
                        className={styles.textInput}
                        disabled={isSubmitting || hasSubmittedDraft}
                      />
                    </div>
                  </div>

                  {/* Submission Action */}
                  <div className={styles.submitBar}>
                    <button
                      type="submit"
                      className={styles.btnPrimary}
                      disabled={isSubmitting || isBlocked || (!hasSubmittedDraft && !guestName.trim())}
                    >
                      {isSubmitting ? (
                        <>
                          <div
                            className={styles.spinner}
                            style={{ width: 20, height: 20, borderWidth: 2 }}
                            aria-hidden="true"
                          />
                          <span>{hasSubmittedDraft ? 'Đang gửi lại yêu cầu in...' : 'Đang gửi yêu cầu in...'}</span>
                        </>
                      ) : (
                        <span>{hasSubmittedDraft ? '🔄 Thử gửi lại yêu cầu in ảnh' : '🖨️ Gửi yêu cầu in ảnh'}</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
