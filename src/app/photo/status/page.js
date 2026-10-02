'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  HanddrawnCheck,
  HanddrawnCamera,
  HanddrawnSparkles,
  HanddrawnBook,
  HanddrawnEnvelope,
  HanddrawnHeart,
  HanddrawnAlert,
  HanddrawnInfo,
} from '@/components/icons/HanddrawnIcons';
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
      <div className={styles.heroCandlelightGlow} aria-hidden="true" />

      <main className={styles.mainContent}>
        {/* Missing or Malformed Fragment */}
        {paramsLoaded && !authParams && (
          <div className={styles.card}>
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

            <div className={styles.cardHeader}>
              <div className={styles.badgePill}>
                <span className={styles.badgeSparkle}>✦</span>
                <span>THÔNG TIN KHÔNG KHẢ DỤNG</span>
                <span className={styles.badgeSparkle}>✦</span>
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

            <div className={styles.cardHeader}>
              <div className={styles.badgePill}>
                <span className={styles.badgeSparkle}>✦</span>
                <span>TIẾN ĐỘ IN ẢNH</span>
                <span className={styles.badgeSparkle}>✦</span>
              </div>
              <h1 className={styles.cardTitle}>Trạng Thái Ảnh Của Bạn</h1>
              <p className={styles.cardSubtitle}>
                Hệ thống tự động cập nhật tiến độ thực tế từ trạm in ảnh tại tiệc cưới.
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
                <span className={styles.alertIcon} aria-hidden="true">
                  <HanddrawnAlert size={22} />
                </span>
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
                aria-label="Sao chép mã nhận ảnh"
              >
                {copiedCode ? (
                  <>
                    <HanddrawnCheck size={16} />
                    <span>Đã sao chép</span>
                  </>
                ) : (
                  <span>📋 Sao chép mã</span>
                )}
              </button>
            </div>

            {/* Current Status Box */}
            <div className={styles.trackingStatusBox}>
              <div className={styles.trackingMetaRow}>
                <div>
                  <span style={{ fontSize: '0.85rem', color: '#6b5c47', fontWeight: 500 }}>Trạng thái hiện tại:</span>
                  <div style={{ marginTop: 6 }}>
                    <StatusBadge status={requestData.status} />
                  </div>
                </div>
                {requestData.created_at && (
                  <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#6b5c47' }}>
                    Thời gian gửi:
                    <div style={{ color: '#231d16', fontWeight: 600, marginTop: 2 }}>
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
                    padding: '16px 20px',
                    borderRadius: 14,
                    background: '#EDF7ED',
                    border: '1.5px solid #2E7D32',
                    color: '#1E4620',
                    fontSize: '0.95rem',
                    textAlign: 'center',
                    lineHeight: 1.5,
                  }}
                >
                  🎉 <strong>Ảnh của bạn đã in xong!</strong> Hãy đến bàn in ảnh và xuất trình mã{' '}
                  <strong style={{ color: '#8c6720' }}>{requestData.pickup_code}</strong> để nhận ảnh nhé!
                </div>
              )}

              {requestData.status === 'rejected' && (
                <div
                  style={{
                    marginTop: 20,
                    padding: '16px 20px',
                    borderRadius: 14,
                    background: '#FDEDEC',
                    border: '1.5px solid #E74C3C',
                    color: '#78281F',
                    fontSize: '0.95rem',
                    textAlign: 'center',
                    lineHeight: 1.5,
                  }}
                >
                  Yêu cầu in này đã bị từ chối bởi người trực trạm. Bạn có thể chọn và gửi một ảnh khác phù hợp hơn.
                </div>
              )}

              {requestData.status === 'review' && (
                <div
                  style={{
                    marginTop: 20,
                    padding: '16px 20px',
                    borderRadius: 14,
                    background: '#FEF9E7',
                    border: '1.5px solid #F39C12',
                    color: '#7D5A00',
                    fontSize: '0.95rem',
                    textAlign: 'center',
                    lineHeight: 1.5,
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
              <Link href="/photo" className={styles.btnPrimary}>
                <HanddrawnCamera size={18} />
                <span>Gửi thêm ảnh khác</span>
              </Link>
              <Link href="/" className={styles.btnSecondary}>
                <span>Về trang chủ</span>
              </Link>
            </div>
          </div>
        )}

        {/* BOTTOM EXPLORE NAVIGATION CARDS (Matching RSVP) */}
        <section className={`${styles.card} ${styles.navSectionCard}`} aria-label="Khám phá trang đám cưới">
          <div className={styles.badgePill}>
            <span className={styles.badgeSparkle}>✦</span>
            <span>KHÁM PHÁ ĐÁM CƯỚI</span>
            <span className={styles.badgeSparkle}>✦</span>
          </div>

          <h2 className={styles.cardTitle}>Chuyện Tình Yêu &amp; Lời Chúc</h2>
          <p className={styles.cardSubtitle}>
            Cùng đón xem hành trình 10 năm của Hoàng &amp; Duyên, xác nhận tham dự hoặc gửi lời chúc mừng.
          </p>

          <div className={styles.filigreeDivider} aria-hidden="true">
            <div className={styles.filigreeLine} />
            <span className={styles.filigreeKnot}>✦</span>
            <div className={styles.filigreeLine} />
          </div>

          <div className={styles.navButtonGroup}>
            <Link href="/" className={styles.navActionCard} aria-label="Xem câu chuyện tình yêu">
              <div className={styles.navCardMain}>
                <div className={styles.navCardIcon} aria-hidden="true">
                  <HanddrawnBook size={24} />
                </div>
                <div className={styles.navCardTitle}>Our Story</div>
              </div>
              <div className={styles.navCardArrow} aria-hidden="true">→</div>
            </Link>

            <Link href="/rsvp" className={styles.navActionCard} aria-label="Xác nhận tham dự">
              <div className={styles.navCardMain}>
                <div className={styles.navCardIcon} aria-hidden="true">
                  <HanddrawnEnvelope size={24} />
                </div>
                <div className={styles.navCardTitle}>RSVP</div>
              </div>
              <div className={styles.navCardArrow} aria-hidden="true">→</div>
            </Link>

            <Link href="/wishes" className={`${styles.navActionCard} ${styles.navActionCardPrimary}`} aria-label="Gửi lời chúc mừng">
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
            ⚙️ Quản trị trạm in ảnh
          </Link>
        </div>
      </main>
    </div>
  );
}
