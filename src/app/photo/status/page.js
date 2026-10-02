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
  HanddrawnRefresh,
  HanddrawnCopy,
  HanddrawnClock,
  HanddrawnCelebration,
  HanddrawnSettings,
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
            setErrorMessage(err.message || 'Unable to update photo print status.');
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
                <span>INFORMATION UNAVAILABLE</span>
                <span className={styles.badgeSparkle}>✦</span>
              </div>
              <h1 className={styles.cardTitle}>Photo Request Not Found</h1>
              <p className={styles.cardSubtitle}>
                The tracking link is missing a valid identifier or security token.
              </p>
              <div className={styles.filigreeDivider} aria-hidden="true">
                <div className={styles.filigreeLine} />
                <span className={styles.filigreeKnot}>✦</span>
                <div className={styles.filigreeLine} />
              </div>
            </div>

            <div className={styles.successInstructions} style={{ textAlign: 'center' }}>
              Please check the link you received after submitting your photo, or take and submit a new photo at the booth.
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
              <Link href="/photo" className={styles.btnPrimary}>
                <span>← Back to Photo Booth</span>
              </Link>
            </div>
          </div>
        )}

        {/* 404 Not Found */}
        {paramsLoaded && authParams && isNotFound && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.badgePill}>
                <span>✦ 404 NOT FOUND ✦</span>
              </div>
              <h1 className={styles.cardTitle}>Request Does Not Exist</h1>
              <p className={styles.cardSubtitle}>
                The photo print request was not found on the system or has expired.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 20 }}>
              <Link href="/photo" className={styles.btnPrimary}>
                <span>Submit New Photo</span>
              </Link>
            </div>
          </div>
        )}

        {/* Server Error / Unavailable */}
        {paramsLoaded && authParams && !loading && !requestData && !isNotFound && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.badgePill}>
                <span>✦ PRINT STATION UNAVAILABLE ✦</span>
              </div>
              <h1 className={styles.cardTitle}>Could Not Load Status</h1>
              <p className={styles.cardSubtitle}>
                {errorMessage || 'The print station system is being prepared or the connection is temporarily interrupted.'}
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
                        setErrorMessage(err.message || 'Unable to update photo print status.');
                      }
                    })
                    .finally(() => setLoading(false));
                }}
              >
                <HanddrawnRefresh size={16} />
                <span>Retry</span>
              </button>
              <Link href="/photo" className={styles.btnSecondary}>
                <span>Back to Photo Booth</span>
              </Link>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && authParams && (
          <div className={styles.card}>
            <div className={styles.uploadingNotice}>
              <div className={styles.spinner} aria-hidden="true" />
              <div className={styles.uploadingText}>Checking photo printing progress...</div>
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
                <span>LIVE PRINTING PROGRESS</span>
                <span className={styles.badgeSparkle}>✦</span>
              </div>
              <h1 className={styles.cardTitle}>Your Photo Print Status</h1>
              <p className={styles.cardSubtitle}>
                Real-time status updates directly from the photo print station at the wedding.
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
              <span className={styles.pickupTitle}>YOUR PICKUP CODE</span>
              <span className={styles.pickupCode}>{requestData.pickup_code}</span>
              <button
                type="button"
                className={styles.pickupCopyBtn}
                onClick={() => handleCopyCode(requestData.pickup_code)}
                aria-label="Copy pickup code"
              >
                {copiedCode ? (
                  <>
                    <HanddrawnCheck size={16} />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <HanddrawnCopy size={16} />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>

            {/* Current Status Box */}
            <div className={styles.trackingStatusBox}>
              <div className={styles.trackingMetaRow}>
                <div>
                  <span style={{ fontSize: '0.85rem', color: '#6b5c47', fontWeight: 500 }}>Current status:</span>
                  <div style={{ marginTop: 6 }}>
                    <StatusBadge status={requestData.status} />
                  </div>
                </div>
                {requestData.created_at && (
                  <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#6b5c47' }}>
                    Submitted at:
                    <div style={{ color: '#231d16', fontWeight: 600, marginTop: 2 }}>
                      {new Date(requestData.created_at).toLocaleTimeString('en-US', {
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
                    {getStepStatus(0, requestData.status) === 'completed' ? (
                      <HanddrawnCheck size={12} strokeWidth={2.4} />
                    ) : (
                      '1'
                    )}
                  </div>
                  <div className={styles.timelineStepTitle}>1. Request Received</div>
                  <div className={styles.timelineStepDesc}>
                    Your photo request was received and is awaiting operator review and printer setup.
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
                    {getStepStatus(1, requestData.status) === 'completed' ? (
                      <HanddrawnCheck size={12} strokeWidth={2.4} />
                    ) : (
                      '2'
                    )}
                  </div>
                  <div className={styles.timelineStepTitle}>2. Approved for Print</div>
                  <div className={styles.timelineStepDesc}>
                    Your photo was approved and is queued for the printer.
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
                    {getStepStatus(2, requestData.status) === 'completed' ? (
                      <HanddrawnCheck size={12} strokeWidth={2.4} />
                    ) : (
                      '3'
                    )}
                  </div>
                  <div className={styles.timelineStepTitle}>3. Printing in Progress</div>
                  <div className={styles.timelineStepDesc}>
                    {requestData.status === 'review' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <HanddrawnAlert size={14} strokeWidth={2} />
                        <span>Operator inspection required. Our booth attendant is handling it.</span>
                      </span>
                    ) : (
                      'The print station is spooling and printing your postcard photo.'
                    )}
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
                    {getStepStatus(3, requestData.status) === 'completed' ? (
                      <HanddrawnSparkles size={13} strokeWidth={1.8} />
                    ) : (
                      '4'
                    )}
                  </div>
                  <div className={styles.timelineStepTitle}>4. Ready for Pickup!</div>
                  <div className={styles.timelineStepDesc}>
                    Printing complete! Please head over to the photo booth table with your pickup code.
                  </div>
                </div>
              </div>

              {/* Status Explanations for Special States */}
              {requestData.status === 'pending' && (
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
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, verticalAlign: 'middle', marginRight: 4 }}>
                    <HanddrawnClock size={16} strokeWidth={2} />
                  </span>
                  <strong>Request received:</strong> Your photo has been safely recorded and is awaiting operator and print station setup. Printing will start after the print station is configured; your request will remain pending.
                </div>
              )}

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
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, verticalAlign: 'middle', marginRight: 4 }}>
                    <HanddrawnCelebration size={18} strokeWidth={1.8} />
                  </span>
                  <strong>Your photo is ready!</strong> Please head over to the photo booth table and present code{' '}
                  <strong style={{ color: '#8c6720' }}>{requestData.pickup_code}</strong> to collect your print!
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
                  This photo submission was declined by the booth operator. Feel free to choose and submit another photo.
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
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, verticalAlign: 'middle', marginRight: 4 }}>
                    <HanddrawnAlert size={16} strokeWidth={2} />
                  </span>
                  This print request requires a quick check on the printer. No need to resubmit, our operator is working on it.
                </div>
              )}
            </div>

            {/* Live Polling Footnote */}
            <div className={styles.pollingNotice} aria-live="polite">
              <span className={styles.pollingDot} aria-hidden="true" />
              <span>
                Auto-refreshing every 5 seconds
                {lastUpdated && ` • Last updated ${lastUpdated.toLocaleTimeString('en-US')}`}
              </span>
            </div>

            {/* Navigation Actions */}
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/photo" className={styles.btnPrimary}>
                <HanddrawnCamera size={18} />
                <span>Submit Another Photo</span>
              </Link>
              <Link href="/" className={styles.btnSecondary}>
                <span>Back to Home</span>
              </Link>
            </div>
          </div>
        )}

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
            <HanddrawnSettings size={14} />
            <span>Print Station Admin</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
