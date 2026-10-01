'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import PhotoHeader from '@/components/photo/PhotoHeader';
import StatusBadge from '@/components/photo/StatusBadge';
import { getPrintingAdmin, mutatePrintingAdmin, PHOTO_STATUS_LABELS } from '@/lib/photo/client';
import styles from './printing.module.css';

export default function AdminPrintingPage() {
  // Authentication: In component memory only (never localStorage/sessionStorage)
  const [password, setPassword] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Dashboard Data
  const [data, setData] = useState(null); // { session, requests, station }
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [mutationError, setMutationError] = useState('');

  // Active mutation lock & idempotent retry key
  const [activeMutationId, setActiveMutationId] = useState(null);
  const activeOpKeyRef = useRef({}); // map of requestId -> operation_key

  // Modal dialog states
  const [confirmRejectModal, setConfirmRejectModal] = useState(null); // request object
  const [confirmReprintModal, setConfirmReprintModal] = useState(null); // request object
  const [reprintConfirmedCheckbox, setReprintConfirmedCheckbox] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [stationOnline, setStationOnline] = useState(false);

  // Fetch authoritative admin data
  const fetchData = useCallback(
    async (isBackground = false) => {
      if (!password) return;
      if (!isBackground) setLoading(true);
      else setRefreshing(true);

      try {
        const res = await getPrintingAdmin(password);
        if (res && res.session) {
          setData(res);
          setIsAuthenticated(true);
          setAuthError('');
          const isOnline = Boolean(
            res.station?.last_seen &&
              Date.now() - new Date(res.station.last_seen).getTime() <= 15000
          );
          setStationOnline(isOnline);
        }
      } catch (err) {
        if (err.status === 401 || err.code === 'UNAUTHORIZED') {
          setAuthError('Mật khẩu quản trị không chính xác.');
          setIsAuthenticated(false);
        } else {
          setMutationError(err.message || 'Lỗi kết nối máy chủ quản trị in.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [password]
  );

  // 5-second polling when authenticated
  useEffect(() => {
    if (!isAuthenticated || !password) return;

    const timer = setInterval(() => {
      fetchData(true);
    }, 5000);

    return () => clearInterval(timer);
  }, [isAuthenticated, password, fetchData]);

  // Handle Login submission
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setMutationError('');
    const entered = inputPassword.trim();
    if (!entered) {
      setAuthError('Vui lòng nhập mật khẩu quản trị.');
      return;
    }

    setLoading(true);
    try {
      const res = await getPrintingAdmin(entered);
      if (res && res.session) {
        setPassword(entered);
        setData(res);
        setIsAuthenticated(true);
      }
    } catch (err) {
      if (err.status === 401 || err.code === 'UNAUTHORIZED') {
        setAuthError('Mật khẩu quản trị không đúng.');
      } else {
        setAuthError(err.message || 'Không thể đăng nhập vào hệ thống in.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setPassword('');
    setInputPassword('');
    setIsAuthenticated(false);
    setData(null);
    setAuthError('');
    setMutationError('');
    activeOpKeyRef.current = {};
  };

  // Close modals on Escape key
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (lightboxUrl) setLightboxUrl(null);
        else if (confirmReprintModal) {
          setConfirmReprintModal(null);
          setReprintConfirmedCheckbox(false);
        } else if (confirmRejectModal) {
          setConfirmRejectModal(null);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [lightboxUrl, confirmReprintModal, confirmRejectModal]);

  // Perform mutation with persisted operation_key
  const performMutation = async (action, requestId = null, extraPayload = {}) => {
    setMutationError('');

    const isSessionAction = action === 'pause' || action === 'resume';
    const keySlot = requestId ? `${action}_${requestId}` : action;
    if (!isSessionAction) {
      if (!activeOpKeyRef.current[keySlot]) {
        activeOpKeyRef.current[keySlot] = crypto.randomUUID();
      }
    }
    const operation_key = !isSessionAction ? activeOpKeyRef.current[keySlot] : undefined;

    setActiveMutationId(isSessionAction ? 'session_toggle' : requestId);

    try {
      const body = {
        action,
        ...(requestId ? { id: requestId, operation_key } : {}),
        ...extraPayload,
      };

      await mutatePrintingAdmin(password, body);

      // Successfully processed: clear persisted key
      if (!isSessionAction) {
        delete activeOpKeyRef.current[keySlot];
      }

      // Close open modals
      setConfirmRejectModal(null);
      setConfirmReprintModal(null);
      setReprintConfirmedCheckbox(false);

      // Refetch authoritative data immediately
      await fetchData(true);
    } catch (err) {
      // Keep operation_key in activeOpKeyRef.current[keySlot] for idempotent retry on network/server failure!
      const isHwError =
        err.code === 'HARDWARE_NOT_VERIFIED' ||
        err.message?.includes('PHOTO_PRINT_HARDWARE_VERIFIED');
      const prefix = isHwError ? '[409 PHOTO_PRINT_HARDWARE_VERIFIED] ' : '';
      setMutationError(`${prefix}${err.message || `Lỗi khi thực hiện thao tác ${action}.`}`);
    } finally {
      setActiveMutationId(null);
    }
  };

  // Filter requests
  const filteredRequests = (data?.requests || []).filter((req) => {
    // Status filter
    if (statusFilter === 'pending' && req.status !== 'pending') return false;
    if (statusFilter === 'processing' && !['approved', 'claimed', 'submitting', 'submitted'].includes(req.status))
      return false;
    if (statusFilter === 'review' && req.status !== 'review') return false;
    if (statusFilter === 'ready' && req.status !== 'ready') return false;
    if (statusFilter === 'rejected' && req.status !== 'rejected') return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchName = req.guest_name?.toLowerCase().includes(q);
      const matchCode = req.pickup_code?.toLowerCase().includes(q);
      return matchName || matchCode;
    }

    return true;
  });

  const pendingCount = (data?.requests || []).filter((r) => r.status === 'pending').length;
  const reviewCount = (data?.requests || []).filter((r) => r.status === 'review').length;

  return (
    <div className={styles.adminContainer}>
      <PhotoHeader subtitle="Bàn Điều Khiển Trạm In Ảnh" />

      <main className={styles.mainWrapper}>
        {/* LOGIN SCREEN */}
        {!isAuthenticated ? (
          <div className={styles.loginCard}>
            <div className={styles.loginIcon} aria-hidden="true">
              🔒
            </div>
            <h1 className={styles.loginTitle}>Đăng Nhập Quản Trị In</h1>
            <p className={styles.loginSubtitle}>
              Nhập mật khẩu quản trị để điều khiển hàng đợi in ảnh tiệc cưới. Mật khẩu được lưu trong phiên bộ nhớ.
            </p>

            {authError && (
              <div className={styles.errorBanner} style={{ marginBottom: 16 }}>
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className={styles.loginForm}>
              <div>
                <label htmlFor="admin-pass-input" style={{ fontSize: '0.85rem', color: 'rgba(253,250,245,0.8)' }}>
                  Mật khẩu trạm in
                </label>
                <input
                  id="admin-pass-input"
                  type="password"
                  value={inputPassword}
                  onChange={(e) => setInputPassword(e.target.value)}
                  placeholder="Nhập mật khẩu quản trị..."
                  className={styles.loginInput}
                  autoComplete="current-password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading || !inputPassword.trim()}
                className="btnPrimary"
                style={{
                  minHeight: 48,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #d4af37, #b08d4f)',
                  color: '#0E1217',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  marginTop: 8,
                }}
              >
                {loading ? 'Đang kiểm tra...' : 'Vào quản trị trạm in →'}
              </button>
            </form>

            <div style={{ marginTop: 24, fontSize: '0.82rem', color: 'rgba(253,250,245,0.5)' }}>
              <Link href="/admin" style={{ color: '#d4af37', textDecoration: 'underline' }}>
                Quay lại trang quản trị tiệc cưới
              </Link>
            </div>
          </div>
        ) : (
          /* AUTHENTICATED DASHBOARD */
          <div>
            {/* Top Header */}
            <div className={styles.dashHeader}>
              <div className={styles.dashTitleBlock}>
                <h1>Hàng Đợi In Ảnh (FIFO)</h1>
                <p>
                  Theo dõi yêu cầu in, phê duyệt và giám sát kết nối máy in Mac
                  {refreshing && ' • Đang đồng bộ...'}
                </p>
              </div>

              <div className={styles.dashHeaderActions}>
                {/* Pause / Resume Session Button */}
                {data?.session && (
                  <button
                    type="button"
                    className="btnAction"
                    style={{
                      minHeight: 44,
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: '1px solid',
                      cursor: 'pointer',
                      fontWeight: 600,
                      backgroundColor: data.session.accepting ? 'rgba(234, 179, 8, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                      borderColor: data.session.accepting ? '#eab308' : '#22c55e',
                      color: data.session.accepting ? '#fde047' : '#86efac',
                    }}
                    disabled={activeMutationId === 'session_toggle'}
                    onClick={() => performMutation(data.session.accepting ? 'pause' : 'resume')}
                  >
                    {activeMutationId === 'session_toggle'
                      ? 'Đang đổi trạng thái...'
                      : data.session.accepting
                      ? '⏸ Tạm dừng nhận ảnh'
                      : '▶ Mở nhận ảnh mới'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => fetchData(false)}
                  disabled={loading || refreshing}
                  style={{
                    minHeight: 44,
                    padding: '8px 14px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fdfaf5',
                    cursor: 'pointer',
                  }}
                  title="Tải lại dữ liệu"
                >
                  🔄 Làm mới
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    minHeight: 44,
                    padding: '8px 14px',
                    borderRadius: 8,
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#fca5a5',
                    cursor: 'pointer',
                  }}
                >
                  Đăng xuất
                </button>
              </div>
            </div>

            {/* Mutation / Server Error Banner */}
            {mutationError && (
              <div
                className={styles.errorBanner}
                style={
                  mutationError.includes('PHOTO_PRINT_HARDWARE_VERIFIED') ||
                  mutationError.includes('HARDWARE_NOT_VERIFIED')
                    ? {
                        backgroundColor: 'rgba(239, 68, 68, 0.22)',
                        borderColor: '#ef4444',
                        boxShadow: '0 4px 20px rgba(239, 68, 68, 0.25)',
                      }
                    : undefined
                }
                role="alert"
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: '1.25rem', lineHeight: 1 }} aria-hidden="true">⚠️</span>
                  <div>
                    {mutationError.includes('PHOTO_PRINT_HARDWARE_VERIFIED') ||
                    mutationError.includes('HARDWARE_NOT_VERIFIED') ? (
                      <>
                        <strong style={{ display: 'block', color: '#fecaca', marginBottom: 2 }}>
                          Chặn mở nhận ảnh từ Server (PHOTO_PRINT_HARDWARE_VERIFIED):
                        </strong>
                        <span>{mutationError}</span>
                      </>
                    ) : (
                      <span>{mutationError}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.errorCloseBtn}
                  onClick={() => setMutationError('')}
                  aria-label="Đóng thông báo lỗi"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Offline Station Notice (Does not block approvals) */}
            {!stationOnline && (
              <div className={styles.stationBanner} role="alert">
                <span style={{ fontSize: '1.3rem' }} aria-hidden="true">⚠️</span>
                <div>
                  <strong>Trạm in Mac hiện chưa kết nối hoặc mất tín hiệu heartbeat (&gt;15s)</strong>
                  <div>
                    Bạn vẫn có thể duyệt các ảnh chờ in bình thường. Các yêu cầu đã duyệt sẽ được lưu trữ an toàn trong hàng đợi và tự động in khi trạm Mac kết nối lại.
                    {data?.station?.error && ` (Chi tiết lỗi: ${data.station.error})`}
                  </div>
                </div>
              </div>
            )}

            {/* STATS OVERVIEW GRID */}
            <div className={styles.statsGrid}>
              {/* Stat 1: Hạn mức in */}
              <div className={styles.statCard}>
                <span className={styles.statCardLabel}>Hạn mức tiệc cưới</span>
                <div className={styles.statCardValue}>
                  <span style={{ color: '#d4af37' }}>{data?.session?.remaining ?? 0}</span>
                  <span style={{ fontSize: '1rem', color: 'rgba(253,250,245,0.5)', fontWeight: 400 }}>
                    / {data?.session?.capacity ?? 100} ảnh
                  </span>
                </div>
                <span className={styles.statCardDesc}>
                  Đã nhận: {data?.session?.reserved ?? 0} • Trạng thái:{' '}
                  {data?.session?.accepting ? 'Đang mở nhận' : 'Đang tạm dừng'}
                </span>
              </div>

              {/* Stat 2: Chờ duyệt */}
              <div className={styles.statCard}>
                <span className={styles.statCardLabel}>Yêu cầu chờ duyệt</span>
                <div className={styles.statCardValue}>
                  <span style={{ color: pendingCount > 0 ? '#eab308' : '#fdfaf5' }}>{pendingCount}</span>
                  <span style={{ fontSize: '0.85rem', color: 'rgba(253,250,245,0.5)', fontWeight: 400 }}>ảnh</span>
                </div>
                <span className={styles.statCardDesc}>Cần kiểm duyệt nội dung trước khi đưa vào hàng in</span>
              </div>

              {/* Stat 3: Cần kiểm tra (Review) */}
              <div className={styles.statCard}>
                <span className={styles.statCardLabel}>Cần kiểm tra lại</span>
                <div className={styles.statCardValue}>
                  <span style={{ color: reviewCount > 0 ? '#f97316' : '#fdfaf5' }}>{reviewCount}</span>
                  <span style={{ fontSize: '0.85rem', color: 'rgba(253,250,245,0.5)', fontWeight: 400 }}>ảnh</span>
                </div>
                <span className={styles.statCardDesc}>Lỗi gửi máy in hoặc trạm ngắt kết nối giữa chừng</span>
              </div>

              {/* Stat 4: Trạm in Mac */}
              <div className={styles.statCard}>
                <span className={styles.statCardLabel}>Trạng thái trạm in Mac</span>
                <div className={styles.statCardValue}>
                  {stationOnline ? (
                    <span className={styles.stationOnline}>● Trực tuyến</span>
                  ) : (
                    <span className={styles.stationOffline}>○ Ngoại tuyến</span>
                  )}
                </div>
                <span className={styles.statCardDesc}>
                  {data?.station?.printer ? `Máy in: ${data.station.printer}` : 'Chưa nhận diện máy in CUPS'}
                </span>
              </div>
            </div>

            {/* TOOLBAR: Filter tabs & search */}
            <div className={styles.toolbar}>
              <div className={styles.filterTabs} role="tablist" aria-label="Bộ lọc trạng thái">
                <button
                  type="button"
                  className={`${styles.filterTab} ${statusFilter === 'all' ? styles.active : ''}`}
                  onClick={() => setStatusFilter('all')}
                >
                  Tất cả ({data?.requests?.length || 0})
                </button>
                <button
                  type="button"
                  className={`${styles.filterTab} ${statusFilter === 'pending' ? styles.active : ''}`}
                  onClick={() => setStatusFilter('pending')}
                >
                  Chờ duyệt ({pendingCount})
                </button>
                <button
                  type="button"
                  className={`${styles.filterTab} ${statusFilter === 'processing' ? styles.active : ''}`}
                  onClick={() => setStatusFilter('processing')}
                >
                  Chờ in / Đang in
                </button>
                <button
                  type="button"
                  className={`${styles.filterTab} ${statusFilter === 'review' ? styles.active : ''}`}
                  onClick={() => setStatusFilter('review')}
                >
                  Cần kiểm tra ({reviewCount})
                </button>
                <button
                  type="button"
                  className={`${styles.filterTab} ${statusFilter === 'ready' ? styles.active : ''}`}
                  onClick={() => setStatusFilter('ready')}
                >
                  Ảnh sẵn sàng
                </button>
                <button
                  type="button"
                  className={`${styles.filterTab} ${statusFilter === 'rejected' ? styles.active : ''}`}
                  onClick={() => setStatusFilter('rejected')}
                >
                  Đã từ chối
                </button>
              </div>

              <input
                type="search"
                placeholder="Tìm tên khách hoặc mã nhận ảnh..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
                aria-label="Tìm kiếm yêu cầu in"
              />
            </div>

            {/* QUEUE TABLE (DESKTOP) */}
            <div className={styles.tableContainer}>
              {filteredRequests.length === 0 ? (
                <div className={styles.emptyState}>
                  Không có yêu cầu in nào phù hợp với bộ lọc hiện tại.
                </div>
              ) : (
                <table className={styles.requestsTable}>
                  <thead>
                    <tr>
                      <th style={{ width: 80 }}>Ảnh</th>
                      <th>Khách gửi</th>
                      <th>Mã nhận</th>
                      <th>Khổ ảnh</th>
                      <th>Thời gian</th>
                      <th>Trạng thái</th>
                      <th style={{ textAlign: 'right' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((req) => (
                      <tr key={req.id}>
                        {/* Thumbnail */}
                        <td>
                          <div
                            className={`${styles.thumbnailWrapper} ${
                              req.orientation === 'landscape' ? styles.landscape : ''
                            }`}
                            onClick={() => req.preview_url && setLightboxUrl(req.preview_url)}
                            title="Bấm để xem ảnh kích thước lớn"
                            role="button"
                            tabIndex={0}
                          >
                            {req.preview_url ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={req.preview_url} alt={`Ảnh của ${req.guest_name}`} className={styles.thumbnailImg} />
                            ) : (
                              <div style={{ color: '#666', fontSize: '0.7rem', textAlign: 'center', paddingTop: 20 }}>
                                N/A
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Guest Name */}
                        <td>
                          <strong style={{ color: '#fdfaf5' }}>{req.guest_name}</strong>
                          {req.attempts && req.attempts.length > 0 && req.attempts[0].cups_job_id && (
                            <div style={{ fontSize: '0.75rem', color: '#93c5fd', marginTop: 2 }}>
                              CUPS Job: {req.attempts[0].cups_job_id}
                            </div>
                          )}
                          {req.attempts && req.attempts.length > 0 && req.attempts[0].error && (
                            <div style={{ fontSize: '0.75rem', color: '#fca5a5', marginTop: 2 }}>
                              Lỗi: {req.attempts[0].error}
                            </div>
                          )}
                        </td>

                        {/* Pickup Code */}
                        <td className={styles.pickupCodeCell}>{req.pickup_code}</td>

                        {/* Orientation */}
                        <td>
                          <span style={{ fontSize: '0.82rem', color: 'rgba(253,250,245,0.7)' }}>
                            {req.orientation === 'portrait' ? 'Khổ dọc (10x14.8)' : 'Khổ ngang (14.8x10)'}
                          </span>
                        </td>

                        {/* Timestamps */}
                        <td style={{ fontSize: '0.82rem', color: 'rgba(253,250,245,0.6)' }}>
                          {new Date(req.created_at).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>

                        {/* Status Badge */}
                        <td>
                          <StatusBadge status={req.status} />
                        </td>

                        {/* Action buttons */}
                        <td>
                          <div className={styles.actionGroup} style={{ justifyContent: 'flex-end' }}>
                            {/* For pending: Approve or Reject */}
                            {req.status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  className={`${styles.btnAction} ${styles.btnApprove}`}
                                  disabled={activeMutationId === req.id}
                                  onClick={() => performMutation('approve', req.id)}
                                >
                                  {activeMutationId === req.id ? 'Đang duyệt...' : '✓ Duyệt in'}
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.btnAction} ${styles.btnReject}`}
                                  disabled={activeMutationId === req.id}
                                  onClick={() => setConfirmRejectModal(req)}
                                >
                                  ✕ Từ chối
                                </button>
                              </>
                            )}

                            {/* For approved: Reject only */}
                            {req.status === 'approved' && (
                              <button
                                type="button"
                                className={`${styles.btnAction} ${styles.btnReject}`}
                                disabled={activeMutationId === req.id}
                                onClick={() => setConfirmRejectModal(req)}
                              >
                                ✕ Từ chối
                              </button>
                            )}

                            {/* For submitted or review: Mark Ready */}
                            {(req.status === 'submitted' || req.status === 'review') && (
                              <button
                                type="button"
                                className={`${styles.btnAction} ${styles.btnReady}`}
                                disabled={activeMutationId === req.id}
                                onClick={() => performMutation('ready', req.id)}
                              >
                                {activeMutationId === req.id ? 'Đang lưu...' : '✨ Đã có ảnh'}
                              </button>
                            )}

                            {/* For ready or review: Reprint */}
                            {(req.status === 'ready' || req.status === 'review') && (
                              <button
                                type="button"
                                className={`${styles.btnAction} ${styles.btnReprint}`}
                                disabled={activeMutationId === req.id}
                                onClick={() => {
                                  setConfirmReprintModal(req);
                                  setReprintConfirmedCheckbox(false);
                                }}
                              >
                                🔄 In lại
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* MOBILE CARDS VIEW */}
            <div className={styles.mobileCardsList}>
              {filteredRequests.length === 0 ? (
                <div className={styles.emptyState}>
                  Không có yêu cầu in nào phù hợp với bộ lọc hiện tại.
                </div>
              ) : (
                filteredRequests.map((req) => (
                  <div key={req.id} className={styles.mobileCard}>
                    <div className={styles.mobileCardTop}>
                      <div
                        className={`${styles.thumbnailWrapper} ${
                          req.orientation === 'landscape' ? styles.landscape : ''
                        }`}
                        onClick={() => req.preview_url && setLightboxUrl(req.preview_url)}
                      >
                        {req.preview_url && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={req.preview_url} alt={req.guest_name} className={styles.thumbnailImg} />
                        )}
                      </div>

                      <div className={styles.mobileCardInfo}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <strong style={{ color: '#fdfaf5', fontSize: '1rem' }}>{req.guest_name}</strong>
                          <span className={styles.pickupCodeCell}>{req.pickup_code}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                          <StatusBadge status={req.status} />
                          <span style={{ fontSize: '0.75rem', color: 'rgba(253,250,245,0.5)' }}>
                            {new Date(req.created_at).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions on mobile */}
                    <div className={styles.actionGroup}>
                      {req.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            className={`${styles.btnAction} ${styles.btnApprove}`}
                            style={{ flex: 1 }}
                            disabled={activeMutationId === req.id}
                            onClick={() => performMutation('approve', req.id)}
                          >
                            ✓ Duyệt in
                          </button>
                          <button
                            type="button"
                            className={`${styles.btnAction} ${styles.btnReject}`}
                            disabled={activeMutationId === req.id}
                            onClick={() => setConfirmRejectModal(req)}
                          >
                            ✕
                          </button>
                        </>
                      )}

                      {req.status === 'approved' && (
                        <button
                          type="button"
                          className={`${styles.btnAction} ${styles.btnReject}`}
                          style={{ width: '100%' }}
                          disabled={activeMutationId === req.id}
                          onClick={() => setConfirmRejectModal(req)}
                        >
                          ✕ Từ chối in
                        </button>
                      )}

                      {(req.status === 'submitted' || req.status === 'review') && (
                        <button
                          type="button"
                          className={`${styles.btnAction} ${styles.btnReady}`}
                          style={{ width: '100%' }}
                          disabled={activeMutationId === req.id}
                          onClick={() => performMutation('ready', req.id)}
                        >
                          ✨ Xác nhận ảnh sẵn sàng
                        </button>
                      )}

                      {(req.status === 'ready' || req.status === 'review') && (
                        <button
                          type="button"
                          className={`${styles.btnAction} ${styles.btnReprint}`}
                          style={{ width: '100%' }}
                          disabled={activeMutationId === req.id}
                          onClick={() => {
                            setConfirmReprintModal(req);
                            setReprintConfirmedCheckbox(false);
                          }}
                        >
                          🔄 Yêu cầu in lại
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* MODAL: Reject Confirmation */}
            {confirmRejectModal && (
              <div className={styles.modalOverlay} role="dialog" aria-modal="true">
                <div className={styles.modalContent}>
                  <h3 className={styles.modalTitle}>Xác nhận từ chối in</h3>
                  <div className={styles.modalBody}>
                    <p>
                      Bạn có chắc chắn muốn từ chối yêu cầu in ảnh của khách{' '}
                      <strong>{confirmRejectModal.guest_name}</strong> (Mã:{' '}
                      <code>{confirmRejectModal.pickup_code}</code>)?
                    </p>
                    <p style={{ color: 'rgba(253,250,245,0.6)', fontSize: '0.85rem' }}>
                      Lượt in này sẽ được hoàn trả lại vào hạn mức tiệc cưới. Khách có thể gửi ảnh khác.
                    </p>
                  </div>
                  <div className={styles.modalActions}>
                    <button
                      type="button"
                      className="btnSecondary"
                      style={{
                        minHeight: 44,
                        padding: '8px 16px',
                        borderRadius: 8,
                        background: 'rgba(255,255,255,0.08)',
                        color: '#fdfaf5',
                        border: '1px solid rgba(255,255,255,0.2)',
                        cursor: 'pointer',
                      }}
                      onClick={() => setConfirmRejectModal(null)}
                      disabled={activeMutationId === confirmRejectModal.id}
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="button"
                      className="btnAction"
                      style={{
                        minHeight: 44,
                        padding: '8px 16px',
                        borderRadius: 8,
                        background: '#ef4444',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                      onClick={() => performMutation('reject', confirmRejectModal.id)}
                      disabled={activeMutationId === confirmRejectModal.id}
                    >
                      {activeMutationId === confirmRejectModal.id ? 'Đang từ chối...' : 'Xác nhận từ chối'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL: Reprint Confirmation with Physical Check & Quota Warning */}
            {confirmReprintModal && (
              <div className={styles.modalOverlay} role="dialog" aria-modal="true">
                <div className={styles.modalContent}>
                  <h3 className={styles.modalTitle}>Xác nhận In Lại Ảnh</h3>
                  <div className={styles.modalBody}>
                    <p>
                      Yêu cầu in lại cho khách <strong>{confirmReprintModal.guest_name}</strong> (Mã:{' '}
                      <code>{confirmReprintModal.pickup_code}</code>).
                    </p>
                    <div
                      style={{
                        background: 'rgba(249, 115, 22, 0.12)',
                        border: '1px solid rgba(249, 115, 22, 0.35)',
                        borderRadius: 10,
                        padding: '12px 14px',
                        fontSize: '0.85rem',
                        color: '#fdba74',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div>
                        ⚠️ <strong>Lưu ý về hạn mức (quota):</strong> In lại sẽ tiêu hao thêm 1 lượt in vào số lượng còn lại của tiệc cưới.
                      </div>
                      {confirmReprintModal.status === 'review' && (
                        <div>
                          🛠️ <strong>Trạng thái cần kiểm tra:</strong> Hãy xác nhận lệnh in cũ trên máy in Mac đã được dừng hoặc huỷ trước khi gửi lệnh in lại.
                        </div>
                      )}
                    </div>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        marginTop: 10,
                        cursor: 'pointer',
                        fontSize: '0.88rem',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={reprintConfirmedCheckbox}
                        onChange={(e) => setReprintConfirmedCheckbox(e.target.checked)}
                        style={{ marginTop: 3, width: 18, height: 18, accentColor: '#d4af37' }}
                      />
                      <span>
                        Tôi đã kiểm tra thực tế máy in và xác nhận tiêu hao thêm 1 lượt in vào hạn mức.
                      </span>
                    </label>
                  </div>

                  <div className={styles.modalActions}>
                    <button
                      type="button"
                      style={{
                        minHeight: 44,
                        padding: '8px 16px',
                        borderRadius: 8,
                        background: 'rgba(255,255,255,0.08)',
                        color: '#fdfaf5',
                        border: '1px solid rgba(255,255,255,0.2)',
                        cursor: 'pointer',
                      }}
                      onClick={() => setConfirmReprintModal(null)}
                      disabled={activeMutationId === confirmReprintModal.id}
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="button"
                      style={{
                        minHeight: 44,
                        padding: '8px 16px',
                        borderRadius: 8,
                        background: '#f97316',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 600,
                        opacity: !reprintConfirmedCheckbox ? 0.45 : 1,
                      }}
                      disabled={!reprintConfirmedCheckbox || activeMutationId === confirmReprintModal.id}
                      onClick={() => performMutation('reprint', confirmReprintModal.id)}
                    >
                      {activeMutationId === confirmReprintModal.id ? 'Đang gửi lệnh in...' : 'Xác nhận In Lại'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* LIGHTBOX MODAL */}
            {lightboxUrl && (
              <div
                className={styles.modalOverlay}
                onClick={() => setLightboxUrl(null)}
                role="dialog"
                aria-modal="true"
              >
                <div className={styles.lightboxModal} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className={styles.lightboxCloseBtn}
                    onClick={() => setLightboxUrl(null)}
                    aria-label="Đóng ảnh"
                  >
                    ✕
                  </button>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={lightboxUrl} alt="Ảnh in khổ lớn" className={styles.lightboxImg} />
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
