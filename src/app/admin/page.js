'use client';

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';
import { getAdminRsvps, updateAdminRsvp, deleteAdminRsvp } from '@/lib/rsvpApi';
import { ATTENDANCE_VALUES, WEDDING_EVENT } from '@/lib/rsvpConstants';
import {
  HanddrawnLock,
  HanddrawnAlert,
  HanddrawnCalendar,
  HanddrawnEnvelope,
  HanddrawnSettings,
  HanddrawnCelebration,
  HanddrawnGuests,
  HanddrawnDove,
  HanddrawnLeaf,
  HanddrawnStar,
} from '@/components/icons/HanddrawnIcons';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [adminToken, setAdminToken] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      const storedAuth = sessionStorage.getItem('admin_auth');
      const storedPass = sessionStorage.getItem('admin_pass');
      return storedAuth === 'true' && storedPass ? storedPass : '';
    } catch {
      return '';
    }
  });
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const storedAuth = sessionStorage.getItem('admin_auth');
      const storedPass = sessionStorage.getItem('admin_pass');
      return Boolean(storedAuth === 'true' && storedPass);
    } catch {
      return false;
    }
  });

  // Active Tab: 'rsvp' | 'wishes' | 'settings'
  const [activeTab, setActiveTab] = useState('rsvp');

  // --- RSVP STATE ---
  const [rsvps, setRsvps] = useState([]);
  const [rsvpMetrics, setRsvpMetrics] = useState({
    total_responses: 0,
    total_attending_parties: 0,
    total_expected_attendees: 0,
    total_declined_parties: 0,
    total_special_requests: 0,
  });
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [rsvpError, setRsvpError] = useState('');
  const [rsvpDbMissing, setRsvpDbMissing] = useState(false);

  // RSVP Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAttendance, setFilterAttendance] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // RSVP Modal / Edit State
  const [selectedRsvp, setSelectedRsvp] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalForm, setModalForm] = useState({
    full_name: '',
    phone: '',
    attendance: ATTENDANCE_VALUES.ATTENDING,
    attendee_count: 1,
    arrival_time: '',
    dietary_notes: '',
    message: '',
  });

  // --- WISHES STATE ---
  const [wishes, setWishes] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editMessage, setEditMessage] = useState('');

  // --- SETTINGS STATE ---
  const [gridSize, setGridSize] = useState('50');
  const [savingSettings, setSavingSettings] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [isStale, setIsStale] = useState(false);

  // Hydration check using official React useSyncExternalStore pattern
  const isClientMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Fetch Wishes & Settings
  const fetchWishes = useCallback(async () => {
    const { data, error } = await supabase
      .from('wishes')
      .select('*')
      .order('created_at', { ascending: false });

    if (data && !error) {
      setWishes(data);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'grid_size')
      .single();

    if (data && !error && data.value) {
      setGridSize(data.value);
    }
  }, []);

  // Fetch RSVPs
  const fetchRsvps = useCallback(async () => {
    if (!adminToken) return;
    setRsvpLoading(true);
    setRsvpError('');
    try {
      const res = await getAdminRsvps(adminToken, {
        search: searchTerm,
        attendance: filterAttendance,
        sort: sortBy,
      });

      if (res.success) {
        setRsvps(res.rsvps || []);
        if (res.metrics) {
          setRsvpMetrics(res.metrics);
        }
        setRsvpDbMissing(false);
        setLastRefreshedAt(new Date());
        setIsStale(false);
      }
    } catch (err) {
      console.error('Fetch admin RSVPs error:', err);
      // Retain previous data and mark it as stale
      setIsStale(true);
      if (err.code === 'TABLE_NOT_FOUND' || err.status === 503) {
        setRsvpDbMissing(true);
        setRsvpError('Bảng "rsvps" chưa được khởi tạo trên Supabase.');
      } else {
        setRsvpError(err.message || 'Lỗi khi tải dữ liệu RSVP.');
      }
    } finally {
      setRsvpLoading(false);
    }
  }, [adminToken, searchTerm, filterAttendance, sortBy]);

  // Load data when authenticated
  useEffect(() => {
    if (isAuthenticated && adminToken) {
      const timer = setTimeout(() => {
        fetchRsvps();
        fetchWishes();
        fetchSettings();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, adminToken, fetchRsvps, fetchWishes, fetchSettings]);

  // Server-authenticated Login
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!password) {
      setLoginError('Vui lòng nhập mật khẩu quản trị.');
      return;
    }
    setLoginLoading(true);
    setLoginError('');

    try {
      // Validate credentials against server endpoint
      const res = await getAdminRsvps(password);
      setIsAuthenticated(true);
      setAdminToken(password);
      sessionStorage.setItem('admin_auth', 'true');
      sessionStorage.setItem('admin_pass', password);
      if (res.rsvps) {
        setRsvps(res.rsvps);
      }
      if (res.metrics) {
        setRsvpMetrics(res.metrics);
      }
      setLastRefreshedAt(new Date());
      setIsStale(false);
    } catch (err) {
      if (err.status === 401) {
        setLoginError('Mật khẩu quản trị không chính xác.');
      } else if (err.code === 'TABLE_NOT_FOUND' || err.status === 503) {
        // Authenticated but table not yet migrated
        setIsAuthenticated(true);
        setAdminToken(password);
        sessionStorage.setItem('admin_auth', 'true');
        sessionStorage.setItem('admin_pass', password);
        setRsvpDbMissing(true);
        setRsvpError('Bảng "rsvps" chưa được khởi tạo trên Supabase.');
      } else {
        setLoginError(err.message || 'Lỗi kết nối đến máy chủ.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAdminToken('');
    sessionStorage.removeItem('admin_auth');
    sessionStorage.removeItem('admin_pass');
  };

  // --- RSVP ACTIONS ---
  const handleOpenEditModal = (rsvp) => {
    setSelectedRsvp(rsvp);
    setModalForm({
      full_name: rsvp.full_name || '',
      phone: rsvp.phone || '',
      attendance: rsvp.attendance || ATTENDANCE_VALUES.ATTENDING,
      attendee_count: rsvp.attendee_count || 1,
      arrival_time: rsvp.arrival_time || '',
      dietary_notes: rsvp.dietary_notes || '',
      message: rsvp.message || '',
    });
    setModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setSelectedRsvp(null);
    setModalOpen(false);
  };

  const handleSaveRsvpModal = async (e) => {
    e.preventDefault();
    if (!selectedRsvp) return;
    setModalSaving(true);
    try {
      await updateAdminRsvp(adminToken, selectedRsvp.id, {
        full_name: modalForm.full_name,
        phone: modalForm.phone,
        attendance: modalForm.attendance,
        attendee_count: modalForm.attendance === ATTENDANCE_VALUES.ATTENDING ? modalForm.attendee_count : 0,
        arrival_time: modalForm.attendance === ATTENDANCE_VALUES.ATTENDING ? modalForm.arrival_time : null,
        dietary_notes: modalForm.dietary_notes,
        message: modalForm.message,
      });
      handleCloseEditModal();
      fetchRsvps();
    } catch (err) {
      alert(err.message || 'Lỗi khi cập nhật RSVP.');
    } finally {
      setModalSaving(false);
    }
  };

  const handleDeleteRsvp = async (id, name) => {
    if (confirm(`Bạn có chắc chắn muốn xoá phản hồi RSVP của "${name || 'khách này'}" không?`)) {
      try {
        await deleteAdminRsvp(adminToken, id);
        fetchRsvps();
      } catch (err) {
        alert(err.message || 'Lỗi khi xoá RSVP.');
      }
    }
  };

  // Export CSV with UTF-8 BOM
  const handleExportCsv = () => {
    if (!rsvps || rsvps.length === 0) {
      alert('Không có dữ liệu RSVP để xuất file.');
      return;
    }

    const headers = [
      'STT',
      'Họ và tên',
      'Số điện thoại',
      'Trạng thái',
      'Số lượng khách',
      'Thời gian có mặt',
      'Yêu cầu ăn uống/dị ứng',
      'Lời nhắn gửi',
      'Ngày gửi phản hồi',
    ];

    const rows = rsvps.map((item, index) => {
      const attendanceStr = item.attendance === ATTENDANCE_VALUES.ATTENDING ? 'Tham dự' : 'Không tham dự';
      const attendeeCountStr = item.attendance === ATTENDANCE_VALUES.ATTENDING ? item.attendee_count : 0;
      const arrivalTimeStr = item.attendance === ATTENDANCE_VALUES.ATTENDING ? (item.arrival_time || '') : '';
      const createdAtStr = item.created_at ? new Date(item.created_at).toLocaleString('vi-VN') : '';

      const sanitize = (val) => `"${String(val || '').replace(/"/g, '""')}"`;

      return [
        index + 1,
        sanitize(item.full_name),
        sanitize(item.phone),
        sanitize(attendanceStr),
        attendeeCountStr,
        sanitize(arrivalTimeStr),
        sanitize(item.dietary_notes),
        sanitize(item.message),
        sanitize(createdAtStr),
      ].join(',');
    });

    // Add UTF-8 BOM so Excel opens Vietnamese characters correctly
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute('download', `danh-sach-rsvp-hoang-duyen-${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- WISHES ACTIONS ---
  const handleApprove = async (id) => {
    const { error } = await supabase.from('wishes').update({ status: 'approved' }).eq('id', id);
    if (!error) {
      setWishes(wishes.map((w) => (w.id === id ? { ...w, status: 'approved' } : w)));
    }
  };

  const handleUnapprove = async (id) => {
    const { error } = await supabase.from('wishes').update({ status: 'pending' }).eq('id', id);
    if (!error) {
      setWishes(wishes.map((w) => (w.id === id ? { ...w, status: 'pending' } : w)));
    }
  };

  const handleDeleteWish = async (id) => {
    if (confirm('Bạn có chắc muốn xóa lời chúc này?')) {
      const { error } = await supabase.from('wishes').delete().eq('id', id);
      if (!error) {
        setWishes(wishes.filter((w) => w.id !== id));
      }
    }
  };

  const handleEditStart = (wish) => {
    setEditingId(wish.id);
    setEditName(wish.guest_name);
    setEditMessage(wish.message);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditName('');
    setEditMessage('');
  };

  const handleEditSave = async () => {
    const { error } = await supabase
      .from('wishes')
      .update({ guest_name: editName, message: editMessage })
      .eq('id', editingId);

    if (!error) {
      setWishes(
        wishes.map((w) => (w.id === editingId ? { ...w, guest_name: editName, message: editMessage } : w))
      );
      setEditingId(null);
    } else {
      alert('Lỗi khi lưu lời chúc!');
    }
  };

  // --- SETTINGS ACTIONS ---
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'grid_size', value: gridSize }, { onConflict: 'key' });

    setSavingSettings(false);
    if (!error) {
      alert('Đã lưu cài đặt!');
    } else {
      console.error('Lỗi Supabase:', error);
      alert('Có lỗi khi lưu cài đặt! Lỗi: ' + error.message);
    }
  };

  if (!isClientMounted) return null;

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="admin-login-wrapper">
        <form onSubmit={handleLogin} className="admin-login-card">
          <div className="admin-login-icon">
            <HanddrawnLock size={36} />
          </div>
          <h1 className="admin-login-title">Quản Trị Viên</h1>
          <p className="admin-login-sub">Đám Cưới Hoàng &amp; Duyên</p>
          <input
            type="password"
            placeholder="Nhập mật khẩu quản trị..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="admin-login-input"
            autoFocus
          />
          {loginError && (
            <p className="admin-login-error" role="alert" style={{ color: '#d32f2f', fontSize: 13.5, margin: '8px 0 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <HanddrawnAlert size={16} />
              <span>{loginError}</span>
            </p>
          )}
          <button type="submit" className="admin-login-btn" disabled={loginLoading}>
            {loginLoading ? 'Đang xác thực…' : 'Đăng nhập hệ thống'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-container">
      {/* Top Navigation Bar */}
      <header className="admin-header">
        <div className="admin-brand">
          <h1 className="admin-title">Bảng Quản Trị Hôn Lễ</h1>
          <span className="admin-date-badge">Hoàng &amp; Duyên · {WEDDING_EVENT.dateFormatted}</span>
        </div>
        <div className="admin-header-actions">
          <button onClick={handleLogout} className="admin-logout-btn">
            Đăng xuất
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="admin-tabs" aria-label="Khu vực quản lý">
        <button
          className={`admin-tab-btn ${activeTab === 'rsvp' ? 'admin-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('rsvp')}
        >
          <span className="admin-tab-icon"><HanddrawnCalendar size={18} /></span>
          <span>Xác nhận tham dự (RSVP)</span>
          {rsvpMetrics.total_responses > 0 && (
            <span className="admin-tab-pill">{rsvpMetrics.total_responses}</span>
          )}
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'wishes' ? 'admin-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('wishes')}
        >
          <span className="admin-tab-icon"><HanddrawnEnvelope size={18} /></span>
          <span>Sổ lưu bút &amp; Lời chúc</span>
          {wishes.length > 0 && <span className="admin-tab-pill">{wishes.length}</span>}
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'settings' ? 'admin-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <span className="admin-tab-icon"><HanddrawnSettings size={18} /></span>
          <span>Cài đặt hệ thống</span>
        </button>
      </nav>

      {/* ==================== TAB 1: RSVP ==================== */}
      {activeTab === 'rsvp' && (
        <div className="admin-tab-content">
          {/* Database Missing Warning Banner */}
          {rsvpDbMissing && (
            <div className="admin-alert admin-alert--warning" role="alert">
              <div className="admin-alert__title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <HanddrawnAlert size={18} />
                <span>Bảng cơ sở dữ liệu `rsvps` chưa được khởi tạo</span>
              </div>
              <p>
                Để lưu trữ và quản lý danh sách khách mời xác nhận tham dự, bạn cần mở Supabase Dashboard, vào mục{' '}
                <strong>SQL Editor</strong> và dán nội dung từ file sau:
              </p>
              <code>wedding-site/supabase/migrations/20260916_create_rsvps_table.sql</code>
            </div>
          )}

          {rsvpError && !rsvpDbMissing && (
            <div className="admin-alert admin-alert--error" role="alert">
              <span>{rsvpError}</span>
              <button onClick={fetchRsvps} className="admin-alert__retry-btn">
                Thử tải lại
              </button>
            </div>
          )}

          {/* 5 Truth Metrics Cards */}
          <div className="admin-metrics-grid">
            <div className="admin-metric-card">
              <div className="admin-metric-card__header">
                <span className="admin-metric-card__label">Tổng lượt phản hồi</span>
                <span className="admin-metric-card__icon"><HanddrawnEnvelope size={22} /></span>
              </div>
              <div className="admin-metric-card__val">{rsvpMetrics.total_responses}</div>
              <span className="admin-metric-card__sub">Khách đã gửi biểu mẫu</span>
            </div>

            <div className="admin-metric-card admin-metric-card--success">
              <div className="admin-metric-card__header">
                <span className="admin-metric-card__label">Lượt tham dự</span>
                <span className="admin-metric-card__icon"><HanddrawnCelebration size={22} /></span>
              </div>
              <div className="admin-metric-card__val">{rsvpMetrics.total_attending_parties}</div>
              <span className="admin-metric-card__sub">Nhóm / cá nhân đồng ý</span>
            </div>

            <div className="admin-metric-card admin-metric-card--primary">
              <div className="admin-metric-card__header">
                <span className="admin-metric-card__label">Tổng khách dự kiến</span>
                <span className="admin-metric-card__icon"><HanddrawnGuests size={22} /></span>
              </div>
              <div className="admin-metric-card__val">{rsvpMetrics.total_expected_attendees}</div>
              <span className="admin-metric-card__sub">Tổng người (để chốt tiệc)</span>
            </div>

            <div className="admin-metric-card admin-metric-card--muted">
              <div className="admin-metric-card__header">
                <span className="admin-metric-card__label">Không thể tham gia</span>
                <span className="admin-metric-card__icon"><HanddrawnDove size={22} /></span>
              </div>
              <div className="admin-metric-card__val">{rsvpMetrics.total_declined_parties}</div>
              <span className="admin-metric-card__sub">Gửi lời chúc từ xa</span>
            </div>

            <div className="admin-metric-card admin-metric-card--amber">
              <div className="admin-metric-card__header">
                <span className="admin-metric-card__label">Ăn kiêng / Dị ứng</span>
                <span className="admin-metric-card__icon"><HanddrawnLeaf size={22} /></span>
              </div>
              <div className="admin-metric-card__val">{rsvpMetrics.total_special_requests}</div>
              <span className="admin-metric-card__sub">Cần chuẩn bị món riêng</span>
            </div>
          </div>

          {/* Search, Filter & Export Toolbar */}
          <div className="admin-toolbar">
            <div className="admin-toolbar__left">
              {/* Search Box */}
              <div className="admin-search-wrapper">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Tìm kiếm tên, số điện thoại..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="admin-search-input"
                />
              </div>

              {/* Attendance Filter */}
              <select
                value={filterAttendance}
                onChange={(e) => setFilterAttendance(e.target.value)}
                className="admin-select"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value={ATTENDANCE_VALUES.ATTENDING}>Chắc chắn tham dự</option>
                <option value={ATTENDANCE_VALUES.DECLINED}>Không thể tham gia</option>
                <option value="special_requests">Có yêu cầu đặc biệt</option>
              </select>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="admin-select"
              >
                <option value="newest">Mới nhất trước</option>
                <option value="oldest">Cũ nhất trước</option>
                <option value="name_asc">Tên (A → Z)</option>
                <option value="attendees_desc">Số người nhiều nhất</option>
              </select>
            </div>

            <div className="admin-toolbar__right">
              {lastRefreshedAt && (
                <span
                  style={{
                    fontSize: 12.5,
                    color: isStale ? '#C0392B' : '#777',
                    fontWeight: isStale ? 600 : 400,
                    marginRight: 4,
                  }}
                >
                  {isStale ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <HanddrawnAlert size={14} /> Dữ liệu cũ (lỗi tải mới)
                    </span>
                  ) : (
                    `Cập nhật: ${lastRefreshedAt.toLocaleTimeString('vi-VN')}`
                  )}
                </span>
              )}
              <button
                type="button"
                onClick={fetchRsvps}
                disabled={rsvpLoading}
                className="admin-btn admin-btn--secondary"
                title="Làm mới danh sách"
              >
                {rsvpLoading ? 'Đang tải…' : '↻ Làm mới'}
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                className="admin-btn admin-btn--export"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Xuất file Excel (CSV)</span>
              </button>
            </div>
          </div>

          {/* RSVP Data Table / Mobile Card List */}
          <div className="admin-table-container">
            {rsvpLoading && rsvps.length === 0 ? (
              <div className="admin-empty-state">Đang tải danh sách phản hồi...</div>
            ) : rsvps.length === 0 ? (
              <div className="admin-empty-state">
                {searchTerm || filterAttendance !== 'all'
                  ? 'Không tìm thấy kết quả phù hợp với bộ lọc hiện tại.'
                  : 'Chưa có khách mời nào gửi phản hồi RSVP.'}
              </div>
            ) : (
              <>
                {/* Desktop View Table */}
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Khách mời</th>
                      <th>Số điện thoại</th>
                      <th>Trạng thái</th>
                      <th>Số khách</th>
                      <th>Giờ có mặt</th>
                      <th>Yêu cầu ăn uống</th>
                      <th>Lời nhắn</th>
                      <th>Thời gian gửi</th>
                      <th style={{ textAlign: 'right' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rsvps.map((rsvp) => (
                      <tr key={rsvp.id}>
                        <td>
                          <strong>{rsvp.full_name}</strong>
                        </td>
                        <td>{rsvp.phone ? <code>{rsvp.phone}</code> : <span className="admin-text-muted">—</span>}</td>
                        <td>
                          {rsvp.attendance === ATTENDANCE_VALUES.ATTENDING ? (
                            <span className="admin-badge admin-badge--attending">Tham dự</span>
                          ) : (
                            <span className="admin-badge admin-badge--declined">Không tham gia</span>
                          )}
                        </td>
                        <td>
                          {rsvp.attendance === ATTENDANCE_VALUES.ATTENDING ? (
                            <span className="admin-attendee-count">
                              <strong>{rsvp.attendee_count}</strong> người
                            </span>
                          ) : (
                            <span className="admin-text-muted">0</span>
                          )}
                        </td>
                        <td>
                          {rsvp.attendance === ATTENDANCE_VALUES.ATTENDING && rsvp.arrival_time ? (
                            <span
                              className="admin-badge"
                              style={{
                                background: '#f6f1e7',
                                color: '#7a5a1e',
                                border: '1px solid #e5d7c3',
                                fontSize: '12px',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              🕒 {rsvp.arrival_time}
                            </span>
                          ) : (
                            <span className="admin-text-muted">—</span>
                          )}
                        </td>
                        <td className="admin-td-notes">
                          {rsvp.dietary_notes ? (
                            <span className="admin-dietary-pill">{rsvp.dietary_notes}</span>
                          ) : (
                            <span className="admin-text-muted">—</span>
                          )}
                        </td>
                        <td className="admin-td-message">
                          {rsvp.message ? (
                            <span title={rsvp.message}>{rsvp.message}</span>
                          ) : (
                            <span className="admin-text-muted">—</span>
                          )}
                        </td>
                        <td className="admin-td-time">
                          {rsvp.created_at ? new Date(rsvp.created_at).toLocaleString('vi-VN') : ''}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="admin-action-group">
                            <button
                              onClick={() => handleOpenEditModal(rsvp)}
                              className="admin-btn-action admin-btn-action--edit"
                              title="Xem & Sửa thông tin"
                            >
                              Sửa
                            </button>
                            <button
                              onClick={() => handleDeleteRsvp(rsvp.id, rsvp.full_name)}
                              className="admin-btn-action admin-btn-action--delete"
                              title="Xoá phản hồi này"
                            >
                              Xoá
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile View Card Stack */}
                <div className="admin-cards-mobile">
                  {rsvps.map((rsvp) => (
                    <div key={rsvp.id} className="admin-guest-card">
                      <div className="admin-guest-card__top">
                        <div>
                          <h3 className="admin-guest-card__name">{rsvp.full_name}</h3>
                          {rsvp.phone && <div className="admin-guest-card__phone">{rsvp.phone}</div>}
                        </div>
                        {rsvp.attendance === ATTENDANCE_VALUES.ATTENDING ? (
                          <span className="admin-badge admin-badge--attending">Tham dự ({rsvp.attendee_count})</span>
                        ) : (
                          <span className="admin-badge admin-badge--declined">Không tham gia</span>
                        )}
                      </div>

                      {rsvp.attendance === ATTENDANCE_VALUES.ATTENDING && rsvp.arrival_time && (
                        <div className="admin-guest-card__section">
                          <span className="admin-guest-card__label">Giờ có mặt:</span>
                          <span style={{ fontWeight: 600, color: '#7a5a1e' }}>🕒 {rsvp.arrival_time}</span>
                        </div>
                      )}

                      {rsvp.dietary_notes && (
                        <div className="admin-guest-card__section">
                          <span className="admin-guest-card__label">Ăn uống:</span>
                          <span className="admin-dietary-pill">{rsvp.dietary_notes}</span>
                        </div>
                      )}

                      {rsvp.message && (
                        <div className="admin-guest-card__section">
                          <span className="admin-guest-card__label">Lời nhắn:</span>
                          <p className="admin-guest-card__msg">{rsvp.message}</p>
                        </div>
                      )}

                      <div className="admin-guest-card__bottom">
                        <span className="admin-guest-card__date">
                          {rsvp.created_at ? new Date(rsvp.created_at).toLocaleString('vi-VN') : ''}
                        </span>
                        <div className="admin-action-group">
                          <button
                            onClick={() => handleOpenEditModal(rsvp)}
                            className="admin-btn-action admin-btn-action--edit"
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => handleDeleteRsvp(rsvp.id, rsvp.full_name)}
                            className="admin-btn-action admin-btn-action--delete"
                          >
                            Xoá
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB 2: WISHES ==================== */}
      {activeTab === 'wishes' && (
        <div className="admin-tab-content">
          <div className="admin-wishes-list">
            {wishes.map((wish) => (
              <div
                key={wish.id}
                className={`admin-wish-item ${wish.status === 'pending' ? 'admin-wish-item--pending' : ''}`}
              >
                <div className="admin-wish-top">
                  <div className="admin-wish-meta">
                    {editingId === wish.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="admin-login-input"
                        style={{ maxWidth: 300 }}
                      />
                    ) : (
                      <strong className="admin-wish-author">{wish.guest_name}</strong>
                    )}
                    <span className="admin-wish-time">{new Date(wish.created_at).toLocaleString('vi-VN')}</span>
                  </div>

                  <div className="admin-wish-badges">
                    <span
                      className={`admin-badge ${
                        wish.status === 'approved' ? 'admin-badge--approved' : 'admin-badge--pending'
                      }`}
                    >
                      {wish.status === 'approved' ? 'Đã duyệt' : 'Chờ duyệt'}
                    </span>
                    {wish.is_highlighted && (
                      <span
                        className="admin-badge admin-badge--highlighted"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <HanddrawnStar size={12} /> Nổi bật
                      </span>
                    )}
                  </div>
                </div>

                {editingId === wish.id ? (
                  <textarea
                    value={editMessage}
                    onChange={(e) => setEditMessage(e.target.value)}
                    rows={3}
                    className="rsvp-textarea"
                    style={{ marginBottom: 12 }}
                  />
                ) : (
                  <p className="admin-wish-body">{wish.message}</p>
                )}

                {wish.media && wish.media.length > 0 && (
                  <div className="admin-wish-media-scroll">
                    {wish.media.map((m, i) =>
                      m.type === 'image' ? (
                        <img key={i} src={m.dataUrl} alt="" className="admin-wish-thumb" />
                      ) : (
                        <video key={i} src={m.dataUrl} className="admin-wish-thumb" controls />
                      )
                    )}
                  </div>
                )}

                <div className="admin-wish-actions">
                  {editingId === wish.id ? (
                    <>
                      <button onClick={handleEditSave} className="admin-btn-action admin-btn-action--save">
                        Lưu
                      </button>
                      <button onClick={handleEditCancel} className="admin-btn-action admin-btn-action--cancel">
                        Hủy
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleEditStart(wish)} className="admin-btn-action admin-btn-action--edit">
                        Sửa
                      </button>
                      {wish.status === 'pending' && (
                        <button
                          onClick={() => handleApprove(wish.id)}
                          className="admin-btn-action admin-btn-action--approve"
                        >
                          Duyệt
                        </button>
                      )}
                      {wish.status === 'approved' && (
                        <>
                          <button
                            onClick={() => handleUnapprove(wish.id)}
                            className="admin-btn-action admin-btn-action--unapprove"
                          >
                            Hủy duyệt
                          </button>
                          <button
                            onClick={async () => {
                              const isCurrentlyHighlighted = wish.is_highlighted;
                              if (!isCurrentlyHighlighted) {
                                const highlightedCount = wishes.filter((w) => w.is_highlighted).length;
                                if (highlightedCount >= 20) {
                                  alert('Chỉ được ghim tối đa 20 lời chúc! Vui lòng bỏ ghim lời chúc khác trước.');
                                  return;
                                }
                              }
                              const { error } = await supabase
                                .from('wishes')
                                .update({ is_highlighted: !isCurrentlyHighlighted })
                                .eq('id', wish.id);
                              if (!error) {
                                setWishes(
                                  wishes.map((w) =>
                                    w.id === wish.id ? { ...w, is_highlighted: !isCurrentlyHighlighted } : w
                                  )
                                );
                              } else {
                                alert('Có lỗi khi ghim! Đảm bảo bạn đã thêm cột is_highlighted trong db.');
                              }
                            }}
                            className="admin-btn-action admin-btn-action--highlight"
                          >
                            {wish.is_highlighted ? 'Bỏ Ghim' : 'Ghim nổi bật'}
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDeleteWish(wish.id)}
                        className="admin-btn-action admin-btn-action--delete"
                      >
                        Xóa
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}

            {wishes.length === 0 && <div className="admin-empty-state">Chưa có lời chúc nào được gửi.</div>}
          </div>
        </div>
      )}

      {/* ==================== TAB 3: SETTINGS ==================== */}
      {activeTab === 'settings' && (
        <div className="admin-tab-content">
          <div className="admin-settings-card">
            <h2 className="admin-settings-title">Cài đặt ma trận Wishes Board (Hình số 69)</h2>
            <div className="admin-settings-row">
              <label htmlFor="gridSizeSelect" className="admin-settings-label">
                Kích thước số lượng ô hiển thị:
              </label>
              <select
                id="gridSizeSelect"
                value={gridSize}
                onChange={(e) => setGridSize(e.target.value)}
                className="admin-select"
              >
                <option value="25">~25 ô (Nhỏ)</option>
                <option value="50">~50 ô (Vừa)</option>
                <option value="75">~75 ô (Lớn)</option>
                <option value="100">~100 ô (Rất lớn)</option>
                <option value="200">~200 ô (Khổng lồ)</option>
                <option value="300">~300 ô</option>
                <option value="400">~400 ô</option>
                <option value="500">~500 ô</option>
                <option value="600">~600 ô</option>
                <option value="699">~699 ô (Tối đa)</option>
              </select>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="admin-btn admin-btn--export"
              >
                {savingSettings ? 'Đang lưu...' : 'Lưu cấu hình'}
              </button>
            </div>
            <p className="admin-settings-hint">
              * Cài đặt này thay đổi số lượng ô xếp thành hình 69 trên trang chủ. Bạn cần bảng `settings` trong Supabase để lưu trữ giá trị này.
            </p>
          </div>
        </div>
      )}

      {/* ==================== EDIT RSVP MODAL ==================== */}
      {modalOpen && (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true">
          <div className="admin-modal-card">
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Chỉnh sửa phản hồi RSVP</h2>
              <button onClick={handleCloseEditModal} className="admin-modal-close-btn" aria-label="Đóng">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRsvpModal} className="admin-modal-body">
              <div className="rsvp-field">
                <label className="rsvp-label">Họ và tên khách mời *</label>
                <input
                  type="text"
                  required
                  value={modalForm.full_name}
                  onChange={(e) => setModalForm({ ...modalForm, full_name: e.target.value })}
                  className="rsvp-input"
                />
              </div>

              <div className="rsvp-field">
                <label className="rsvp-label">Số điện thoại</label>
                <input
                  type="tel"
                  value={modalForm.phone}
                  onChange={(e) => setModalForm({ ...modalForm, phone: e.target.value })}
                  className="rsvp-input"
                />
              </div>

              <div className="rsvp-field">
                <label className="rsvp-label">Trạng thái tham dự</label>
                <select
                  value={modalForm.attendance}
                  onChange={(e) => setModalForm({ ...modalForm, attendance: e.target.value })}
                  className="admin-select"
                  style={{ width: '100%' }}
                >
                  <option value={ATTENDANCE_VALUES.ATTENDING}>Chắc chắn tham dự</option>
                  <option value={ATTENDANCE_VALUES.DECLINED}>Không thể tham gia</option>
                </select>
              </div>

              {modalForm.attendance === ATTENDANCE_VALUES.ATTENDING && (
                <>
                  <div className="rsvp-field">
                    <label className="rsvp-label">Số lượng khách (người)</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={modalForm.attendee_count}
                      onChange={(e) =>
                        setModalForm({ ...modalForm, attendee_count: parseInt(e.target.value, 10) || 1 })
                      }
                      className="rsvp-input"
                    />
                  </div>

                  <div className="rsvp-field">
                    <label className="rsvp-label">Thời gian có mặt dự kiến</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: 16:00 (Đón khách & Tiệc trà)"
                      value={modalForm.arrival_time}
                      onChange={(e) => setModalForm({ ...modalForm, arrival_time: e.target.value })}
                      className="rsvp-input"
                    />
                  </div>
                </>
              )}

              <div className="rsvp-field">
                <label className="rsvp-label">Yêu cầu ăn uống / Dị ứng</label>
                <input
                  type="text"
                  value={modalForm.dietary_notes}
                  onChange={(e) => setModalForm({ ...modalForm, dietary_notes: e.target.value })}
                  className="rsvp-input"
                />
              </div>

              <div className="rsvp-field">
                <label className="rsvp-label">Lời nhắn gửi</label>
                <textarea
                  rows={3}
                  value={modalForm.message}
                  onChange={(e) => setModalForm({ ...modalForm, message: e.target.value })}
                  className="rsvp-textarea"
                />
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="admin-btn admin-btn--secondary"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={modalSaving}
                  className="admin-btn admin-btn--export"
                >
                  {modalSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
