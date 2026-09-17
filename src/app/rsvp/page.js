'use client';

import { useState, useEffect } from 'react';
import RsvpHero from '@/components/rsvp/RsvpHero';
import InvitationPanel from '@/components/rsvp/InvitationPanel';
import EventTimeline from '@/components/rsvp/EventTimeline';
import RsvpForm from '@/components/rsvp/RsvpForm';
import RsvpConfirmation from '@/components/rsvp/RsvpConfirmation';
import RsvpStatusNotice from '@/components/rsvp/RsvpStatusNotice';
import {
  submitRsvp,
  updateRsvp,
  getRsvpByToken,
  getStoredEditToken,
  clearStoredEditToken,
  getLastRsvpData,
} from '@/lib/rsvpApi';
import styles from './rsvp.module.css';

export default function RsvpPage() {
  const [offline, setOffline] = useState(false);
  const [existingToken, setExistingToken] = useState(() => getStoredEditToken());
  const [persistedRsvp, setPersistedRsvp] = useState(null);
  const [canEdit, setCanEdit] = useState(true);
  const [isEditingMode, setIsEditingMode] = useState(false);

  // Form submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [noticeState, setNoticeState] = useState(null); // { type: 'warn' | 'error', title, message }

  // Draft form data
  const [formData, setFormData] = useState(() => {
    return getLastRsvpData() || {};
  });

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setOffline(false);
      setNoticeState(null);
    };
    const handleOffline = () => {
      setOffline(true);
      setNoticeState({
        type: 'warn',
        title: 'Thiết bị ngoại tuyến',
        message: 'Bạn đang ngoại tuyến. Hãy kết nối lại mạng để gửi hoặc cập nhật phản hồi RSVP.',
      });
    };

    if (typeof window !== 'undefined') {
      if (!navigator.onLine) {
        handleOffline();
      }
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  // Fetch existing RSVP if token is present
  useEffect(() => {
    if (!existingToken) return;

    getRsvpByToken(existingToken)
      .then((res) => {
        if (res && (res.rsvp || res.data)) {
          const record = res.rsvp || res.data;
          setPersistedRsvp(record);
          setFormData(record);
          setCanEdit(res.can_edit !== false);
        }
      })
      .catch((err) => {
        console.warn('Could not load existing RSVP with stored token:', err);
        if (err.code === 'TABLE_NOT_FOUND') {
          setNoticeState({
            type: 'error',
            title: 'Cơ sở dữ liệu đang chờ khởi tạo',
            message: 'Bảng dữ liệu RSVP chưa được tạo trong Supabase. Quản trị viên vui lòng chạy migration trong supabase/migrations/20260916_create_rsvps_table.sql.',
          });
        }
      });
  }, [existingToken]);

  // Scroll smoothly down to the form card
  const handleScrollToForm = () => {
    const el = document.getElementById('rsvp-form-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Handle Form Submit (Create or Update)
  const handleSubmitForm = async (payload) => {
    setSubmitting(true);
    setSubmitError('');
    setNoticeState(null);

    try {
      if (existingToken && isEditingMode) {
        // Update existing record
        const res = await updateRsvp(existingToken, payload);
        const record = res.rsvp || res.data;
        setPersistedRsvp(record);
        setFormData(record);
        setCanEdit(res.can_edit !== false);
        setIsEditingMode(false);
      } else {
        // Submit new response
        const res = await submitRsvp(payload);
        const record = res.rsvp || res.data;
        setPersistedRsvp(record);
        setFormData(record);
        if (res.edit_token) {
          setExistingToken(res.edit_token);
        }
        setCanEdit(res.can_edit !== false);
        setIsEditingMode(false);
      }
    } catch (err) {
      console.error('RSVP submit error:', err);
      const errMsg = err.message || 'Chưa thể lưu phản hồi. Thông tin bạn nhập vẫn còn ở đây — vui lòng thử lại.';
      setSubmitError(errMsg);

      if (err.code === 'TABLE_NOT_FOUND' || err.status === 503) {
        setNoticeState({
          type: 'error',
          title: 'Hệ thống lưu trữ đang bảo trì',
          message: 'Bảng dữ liệu RSVP chưa được tạo trong cơ sở dữ liệu Supabase. Thông tin bạn nhập đã được giữ an toàn trên máy.',
        });
      } else if (err.code === 'OFFLINE') {
        setNoticeState({
          type: 'warn',
          title: 'Không có kết nối mạng',
          message: 'Bạn đang ngoại tuyến. Vui lòng kết nối mạng và bấm gửi lại.',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Handle edit action in confirmation card
  const handleStartEdit = () => {
    setIsEditingMode(true);
    handleScrollToForm();
  };

  return (
    <div className={styles.rsvpContainer}>
      {/* PANEL 1: CINEMATIC HERO */}
      <RsvpHero onScrollToForm={handleScrollToForm} />

      {/* TRIFOLD SEQUENCE: PANELS 2, 3, 4, 5 */}
      <main className={styles.trifoldSequence}>
        {/* Notice Banners (Offline, Missing DB Table, Stale) */}
        {noticeState && (
          <RsvpStatusNotice
            type={noticeState.type}
            title={noticeState.title}
            message={noticeState.message}
          />
        )}

        {/* PANEL 2: SAVE THE DATE CARD (FIGMA NODE 131:50) */}
        <InvitationPanel />

        {/* PANEL 3: EVENT TIMELINE CARD (FIGMA NODE 131:96) */}
        <EventTimeline />

        {/* PANEL 4 & 5: FORM CARD OR PERSISTED CONFIRMATION */}
        <section className={styles.trifoldCard} id="rsvp-form-section" aria-label="Xác nhận tham dự">
          {persistedRsvp && !isEditingMode ? (
            <RsvpConfirmation
              rsvpData={persistedRsvp}
              canEdit={canEdit}
              onEdit={handleStartEdit}
            />
          ) : (
            <RsvpForm
              key={formData?.id || (isEditingMode ? 'edit' : 'new')}
              initialData={formData}
              isEditing={Boolean(existingToken && isEditingMode)}
              submitting={submitting}
              submitError={submitError}
              offline={offline}
              onSubmit={handleSubmitForm}
            />
          )}
        </section>
      </main>
    </div>
  );
}
