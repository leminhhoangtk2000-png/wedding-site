'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import PhotoHeader from '@/components/photo/PhotoHeader';
import StatusBadge from '@/components/photo/StatusBadge';
import { getPhotoRequest, PHOTO_STATUS_LABELS } from '@/lib/photo/client';
import styles from '../photo.module.css';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function PhotoStatusPage() {
  const [paramsLoaded, setParamsLoaded] = useState(false);
  const [authParams, setAuthParams] = useState(null); // { id, token }
  const [requestData, setRequestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isNotFound, setIsNotFound] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Parse fragment ONLY client-side (from window.location.hash)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const parseHash = () => {
      try {
        const hash = window.location.hash.replace(/^#/, '');
        if (!hash) {
          setAuthParams(null);
          setParamsLoaded(true);
          setLoading(false);
          return;
        }

        const searchParams = new URLSearchParams(hash);
        const id = searchParams.get('id');
        const token = searchParams.get('token');

        if (id && token && UUID_REGEX.test(id)) {
          setAuthParams({ id, token });
        } else {
          setAuthParams(null);
        }
      } catch {
        setAuthParams(null);
      } finally {
        setParamsLoaded(true);
      }
    };

    parseHash();
    window.addEventListener('hashchange', parseHash);
    return () => window.removeEventListener('hashchange', parseHash);
  }, []);

  // Initial fetch and 5-second polling
  useEffect(() => {
    if (!authParams?.id || !authParams?.token) return;

    let active = true;

    const runPoll = () => {
      getPhotoRequest(authParams.id, authParams.token)
        .then((res) => {
          if (!active) return;
          if (res && res.request) {
            setRequestData(res.request);
            setIsNotFound(false);
            setErrorMessage('');
            setLastUpdated(new Date());
          }
        })
        .catch((err) => {
          if (!active) return;
          if (err.status === 404 || err.code === 'NOT_FOUND') {
            setIsNotFound(true);
          } else {
            setErrorMessage(err.message || 'Không thể cập nhật trạng thái in ảnh.');
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };

    runPoll();

    const timer = setInterval(() => {
      runPoll();
    }, 5000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [authParams]);

  const handleCopyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const getStepStatus = (stepIndex, currentStatus) => {
    // 0: submitted (pending)
    // 1: approved
    // 2: printing (claimed, submitting, submitted)
    // 3: ready
    if (!currentStatus) return 'pending';
    if (currentStatus === 'rejected') return 'failed';

    const order = {
      pending: 0,
      approved: 1,
      claimed: 2,
      submitting: 2,
      submitted: 2,
      review: 2,
      ready: 3,
    };

    const currentOrder = order[currentStatus] ?? 0;
    if (currentOrder > stepIndex) return 'completed';
    if (currentOrder === stepIndex) return 'active';
    return 'upcoming';
  };

  return (
    <div className={styles.pageContainer}>
      <PhotoHeader subtitle="Theo Dõi Trạng Thái In Ảnh" />

      <main className={styles.mainContent}>
        {/* Missing or Malformed Fragment */}
        {paramsLoaded && !authParams && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.badgePill}>
                <span>✦ THÔNG TIN KHÔNG KHẢ DỤNG ✦</span>
              </div>
              <h1 className={styles.cardTitle}>Không Tìm Thấy Yêu Cầu</h1>
              <p className={styles.cardSubtitle}>
                Liên kết theo dõi không chứa mã định danh hoặc mã bảo mật hợp lệ.
              </p>
              <div className={styles.filigreeDivider} aria-hidden="true">
                <div className={styles.filigreeLine} />
                <span className={styles.filigreeKnot}>✦</span>
                <div className={styles.filigreeLine} />
              </div>
            </div>

            <div className={styles.successInstructions} style={{ textAlign: 'center' }}>
              Vui lòng kiểm tra lại liên kết bạn đã nhận được sau khi gửi ảnh, hoặc thực hiện chụp và gửi ảnh mới tại trạm in.
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
              <Link href="/photo" className={styles.btnPrimary}>
                <span>← Đến trang chụp ảnh</span>
              </Link>
            </div>
          </div>
        )}

        {/* 404 Not Found */}
        {paramsLoaded && authParams && isNotFound && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.badgePill}>
                <span>✦ 404 KHÔNG TÌM THẤY ✦</span>
              </div>
              <h1 className={styles.cardTitle}>Yêu Cầu Không Tồn Tại</h1>
              <p className={styles.cardSubtitle}>
                Yêu cầu in ảnh không tìm thấy trên hệ thống hoặc đã hết thời gian lưu trữ.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 20 }}>
              <Link href="/photo" className={styles.btnPrimary}>
                <span>Gửi ảnh mới</span>
              </Link>
            </div>
          </div>
        )}

        {/* Server Error / Unavailable */}
        {paramsLoaded && authParams && !loading && !requestData && !isNotFound && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.badgePill}>
                <span>✦ TRẠM IN CHƯA SẴN SÀNG ✦</span>
              </div>
              <h1 className={styles.cardTitle}>Chưa Thể Tải Trạng Thái</h1>
              <p className={styles.cardSubtitle}>
                {errorMessage || 'Hệ thống trạm in hiện đang được chuẩn bị hoặc kết nối máy chủ tạm gián đoạn.'}
              </p>
              <div className={styles.filigreeDivider} aria-hidden="true">
                <div className={styles.filigreeLine} />
                <span className={styles.filigreeKnot}>✦</span>
                <div className={styles.filigreeLine} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => {
                  setLoading(true);
                  getPhotoRequest(authParams.id, authParams.token)
                    .then((res) => {
                      if (res && res.request) {
                        setRequestData(res.request);
                        setIsNotFound(false);
                        setErrorMessage('');
                      }
                    })
                    .catch((err) => {
                      if (err.status === 404 || err.code === 'NOT_FOUND') {
                        setIsNotFound(true);
                      } else {
                        setErrorMessage(err.message || 'Không thể cập nhật trạng thái in ảnh.');
                      }
                    })
                    .finally(() => setLoading(false));
                }}
              >
                <span>🔄 Thử tải lại</span>
              </button>
              <Link href="/photo" className={styles.btnSecondary}>
                <span>Về trang chụp ảnh</span>
              </Link>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && authParams && (
          <div className={styles.card}>
            <div className={styles.uploadingNotice}>
              <div className={styles.spinner} aria-hidden="true" />
              <div className={styles.uploadingText}>Đang kiểm tra tiến độ in ảnh...</div>
            </div>
          </div>
        )}

        {/* Active Status Display */}
        {!loading && authParams && requestData && !isNotFound && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.badgePill}>
                <span>✦ TIẾN ĐỘ IN ẢNH ✦</span>
              </div>
              <h1 className={styles.cardTitle}>Trạng Thái Ảnh Của Bạn</h1>
              <p className={styles.cardSubtitle}>
                Hệ thống tự động cập nhật tiến độ thực tế từ trạm in ảnh.
              </p>
              <div className={styles.filigreeDivider} aria-hidden="true">
                <div className={styles.filigreeLine} />
                <span className={styles.filigreeKnot}>✦</span>
                <div className={styles.filigreeLine} />
              </div>
            </div>

            {/* Error banner if poll fails */}
            {errorMessage && (
              <div className={`${styles.alertBanner} ${styles.alertError}`} role="alert">
                <span className={styles.alertIcon} aria-hidden="true">⚠️</span>
                <div>{errorMessage}</div>
              </div>
            )}

            {/* Pickup Code Highlight */}
            <div className={styles.pickupHighlight}>
              <span className={styles.pickupTitle}>MÃ NHẬN ẢNH CỦA BẠN</span>
              <span className={styles.pickupCode}>{requestData.pickup_code}</span>
              <button
                type="button"
                className={styles.pickupCopyBtn}
                onClick={() => handleCopyCode(requestData.pickup_code)}
              >
                <span>{copiedCode ? '✓ Đã sao chép' : '📋 Sao chép mã'}</span>
              </button>
            </div>

            {/* Current Status Box */}
            <div className={styles.trackingStatusBox}>
              <div className={styles.trackingMetaRow}>
                <div>
                  <span style={{ fontSize: '0.82rem', color: 'rgba(253,250,245,0.6)' }}>Trạng thái hiện tại:</span>
                  <div style={{ marginTop: 4 }}>
                    <StatusBadge status={requestData.status} />
                  </div>
                </div>
                {requestData.created_at && (
                  <div style={{ textAlign: 'right', fontSize: '0.82rem', color: 'rgba(253,250,245,0.6)' }}>
                    Thời gian gửi:
                    <div style={{ color: '#FDFAF5', fontWeight: 500, marginTop: 2 }}>
                      {new Date(requestData.created_at).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Progress Timeline */}
              <div className={styles.trackingTimeline} role="list">
                {/* Step 1: Submitted */}
                <div
                  className={`${styles.timelineStep} ${
                    getStepStatus(0, requestData.status) === 'active'
                      ? styles.active
                      : getStepStatus(0, requestData.status) === 'completed'
                      ? styles.completed
                      : ''
                  }`}
                  role="listitem"
                >
                  <div className={styles.timelineStepDot} aria-hidden="true">
                    {getStepStatus(0, requestData.status) === 'completed' ? '✓' : '1'}
                  </div>
                  <div className={styles.timelineStepTitle}>1. Đã tiếp nhận yêu cầu</div>
                  <div className={styles.timelineStepDesc}>
                    Ảnh đã được gửi vào hàng đợi và đang chờ người trực duyệt in.
                  </div>
                </div>

                {/* Step 2: Approved */}
                <div
                  className={`${styles.timelineStep} ${
                    getStepStatus(1, requestData.status) === 'active'
                      ? styles.active
                      : getStepStatus(1, requestData.status) === 'completed'
                      ? styles.completed
                      : ''
                  }`}
                  role="listitem"
                >
                  <div className={styles.timelineStepDot} aria-hidden="true">
                    {getStepStatus(1, requestData.status) === 'completed' ? '✓' : '2'}
                  </div>
                  <div className={styles.timelineStepTitle}>2. Đã duyệt in</div>
                  <div className={styles.timelineStepDesc}>
                    Yêu cầu đã được chấp thuận và đang xếp hàng đợi máy in xử lý.
                  </div>
                </div>

                {/* Step 3: Printing / In-progress */}
                <div
                  className={`${styles.timelineStep} ${
                    getStepStatus(2, requestData.status) === 'active'
                      ? styles.active
                      : getStepStatus(2, requestData.status) === 'completed'
                      ? styles.completed
                      : ''
                  }`}
                  role="listitem"
                >
                  <div className={styles.timelineStepDot} aria-hidden="true">
                    {getStepStatus(2, requestData.status) === 'completed' ? '✓' : '3'}
                  </div>
                  <div className={styles.timelineStepTitle}>3. Đang chuyển tới máy in</div>
                  <div className={styles.timelineStepDesc}>
                    {requestData.status === 'review'
                      ? '⚠️ Cần kiểm tra trạm in. Người trực đang hỗ trợ xử lý.'
                      : 'Trạm in Mac đang tiếp nhận và in ảnh ra giấy postcard.'}
                  </div>
                </div>

                {/* Step 4: Ready */}
                <div
                  className={`${styles.timelineStep} ${
                    getStepStatus(3, requestData.status) === 'active'
                      ? styles.active
                      : getStepStatus(3, requestData.status) === 'completed'
                      ? styles.completed
                      : ''
                  }`}
                  role="listitem"
                >
                  <div className={styles.timelineStepDot} aria-hidden="true">
                    {getStepStatus(3, requestData.status) === 'completed' ? '✨' : '4'}
                  </div>
                  <div className={styles.timelineStepTitle}>4. Ảnh sẵn sàng nhận!</div>
                  <div className={styles.timelineStepDesc}>
                    Ảnh đã in hoàn tất! Mời bạn tới bàn trạm in đọc mã nhận ảnh để nhận bức ảnh kỷ niệm.
                  </div>
                </div>
              </div>

              {/* Status Explanations for Special States */}
              {requestData.status === 'ready' && (
                <div
                  style={{
                    marginTop: 20,
                    padding: '14px 18px',
                    borderRadius: 12,
                    background: 'rgba(34, 197, 94, 0.15)',
                    border: '1px solid rgba(34, 197, 94, 0.4)',
                    color: '#86efac',
                    fontSize: '0.92rem',
                    textAlign: 'center',
                  }}
                >
                  🎉 <strong>Ảnh của bạn đã in xong!</strong> Hãy đến bàn in ảnh và xuất trình mã{' '}
                  <strong style={{ color: '#d4af37' }}>{requestData.pickup_code}</strong> để nhận ảnh nhé!
                </div>
              )}

              {requestData.status === 'rejected' && (
                <div
                  style={{
                    marginTop: 20,
                    padding: '14px 18px',
                    borderRadius: 12,
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#fca5a5',
                    fontSize: '0.92rem',
                    textAlign: 'center',
                  }}
                >
                  Yêu cầu in này đã bị từ chối bởi người trực trạm. Bạn có thể chọn và gửi một ảnh khác phù hợp hơn.
                </div>
              )}

              {requestData.status === 'review' && (
                <div
                  style={{
                    marginTop: 20,
                    padding: '14px 18px',
                    borderRadius: 12,
                    background: 'rgba(249, 115, 22, 0.15)',
                    border: '1px solid rgba(249, 115, 22, 0.4)',
                    color: '#fdba74',
                    fontSize: '0.92rem',
                    textAlign: 'center',
                  }}
                >
                  ⚠️ Yêu cầu đang cần người trực trạm kiểm tra máy in. Bạn không cần gửi lại ảnh, người trực sẽ tiếp tục xử lý.
                </div>
              )}
            </div>

            {/* Live Polling Footnote */}
            <div className={styles.pollingNotice} aria-live="polite">
              <span className={styles.pollingDot} aria-hidden="true" />
              <span>
                Cập nhật tự động mỗi 5 giây
                {lastUpdated && ` • Lần cuối lúc ${lastUpdated.toLocaleTimeString('vi-VN')}`}
              </span>
            </div>

            {/* Navigation Actions */}
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/photo" className={styles.btnSecondary}>
                <span>📸 Gửi thêm ảnh khác</span>
              </Link>
              <Link href="/" className={styles.btnSecondary}>
                <span>Về trang chủ tiệc cưới</span>
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
