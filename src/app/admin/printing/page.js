'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import AdminRequestEditor from '@/components/photo/AdminRequestEditor';
import { startPolling } from '@/lib/photo/poll.mjs';
import PhotoHeader from '@/components/photo/PhotoHeader';
import StatusBadge from '@/components/photo/StatusBadge';
import PhotoboothCard from '@/components/photo/PhotoboothCard';
import {
  DEFAULT_PRESETS,
  computeEffectiveFilter,
  defaultAdjustments,
} from '@/lib/photo/presets';
import { getPrintingAdmin, mutatePrintingAdmin, PHOTO_STATUS_LABELS } from '@/lib/photo/client';
import styles from './printing.module.css';

export default function AdminPrintingPage() {
  // Authentication: Initialize from shared admin session (same account as /admin)
  const [password, setPassword] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      const storedAuth = sessionStorage.getItem('admin_auth');
      const storedPass = sessionStorage.getItem('admin_pass');
      return storedAuth === 'true' && storedPass ? storedPass : '';
    } catch {
      return '';
    }
  });
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
  const [lightboxItem, setLightboxItem] = useState(null); // request object for large preview modal

  const [editItem, setEditItem] = useState(null);

  // Admin Preset Configuration State
  const [adminPresets,setAdminPresets]=useState(DEFAULT_PRESETS);
  const [selectedPresetId,setSelectedPresetId]=useState('soft_wedding');
  const [configVersion,setConfigVersion]=useState(null);
  const [savingPresets,setSavingPresets]=useState(false);
  const configDirtyRef=useRef(false), savePresetOpRef=useRef(null);
  const applyConfig = config => {
    if(!config)return;
    setAdminPresets(config.presets);setConfigVersion(config.version);
    configDirtyRef.current=false;
  };
  const [adminPreviewOrientation, setAdminPreviewOrientation] = useState('portrait');
  const [presetSavedNotice, setPresetSavedNotice] = useState('');
  const [isConfigCollapsed, setIsConfigCollapsed] = useState(false);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [query, setQuery] = useState({page:1,status:'all',search:''});
  const queryRef = useRef(query), fetchBusy = useRef(null);
  useEffect(() => { queryRef.current=query; }, [query]);
  useEffect(() => {
    const timer=setTimeout(()=>setQuery({page:1,status:statusFilter,search:searchQuery.trim()}),300);
    return ()=>clearTimeout(timer);
  }, [statusFilter,searchQuery]);

  const [stationOnline, setStationOnline] = useState(false);

  // Fetch authoritative admin data
  const fetchData = useCallback(
    async (isBackground = false) => {
      if (!password) return;
      while (fetchBusy.current) {
        await fetchBusy.current.promise;
        if (JSON.stringify(queryRef.current)!==JSON.stringify(query)) return;
      }
      let release;
      fetchBusy.current={promise:new Promise(resolve=>{release=resolve;})};
      if (!isBackground) setLoading(true);
      else setRefreshing(true);

      try {
        const res = await getPrintingAdmin(password,query);
        if (JSON.stringify(queryRef.current)!==JSON.stringify(query)) return;
        if (res && res.session) {
          setData(res);
          if(!configDirtyRef.current)applyConfig(res.preset_config);
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
          setAuthError('Incorrect admin password.');
          setIsAuthenticated(false);
        } else {
          setMutationError(err.message || 'Error connecting to print admin server.');
          if (isBackground) throw err;
        }
      } finally {
        fetchBusy.current=null; release();
        setLoading(false);
        setRefreshing(false);
      }
    },
    [password,query]
  );

  // Auto-authenticate if password was loaded from shared sessionStorage
  useEffect(() => {
    let active=true;
    if (password && !isAuthenticated) {
      Promise.resolve().then(()=>{if(active)fetchData(false);});
    }
    return ()=>{active=false;};
  }, [password, isAuthenticated, fetchData]);

  useEffect(() => {
    if (!isAuthenticated || !password) return;
    const poll=startPolling(async()=> { await fetchData(true); }, {interval:10000});
    return ()=>poll.stop();
  }, [isAuthenticated,password,fetchData]);

  // Handle Login submission
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setMutationError('');
    const entered = inputPassword.trim();
    if (!entered) {
      setAuthError('Please enter admin password.');
      return;
    }

    setLoading(true);
    try {
      const res = await getPrintingAdmin(entered);
      if (res && res.session) {
        setPassword(entered);
        setData(res);
        applyConfig(res.preset_config);
        setIsAuthenticated(true);
        try {
          sessionStorage.setItem('admin_auth', 'true');
          sessionStorage.setItem('admin_pass', entered);
        } catch {}
      }
    } catch (err) {
      if (err.status === 401 || err.code === 'UNAUTHORIZED') {
        setAuthError('Incorrect admin password.');
      } else {
        setAuthError(err.message || 'Unable to sign in to print station system.');
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
    try {
      sessionStorage.removeItem('admin_auth');
      sessionStorage.removeItem('admin_pass');
    } catch {}
  };

  // Close modals on Escape key
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (lightboxItem) setLightboxItem(null);
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
  }, [lightboxItem, confirmReprintModal, confirmRejectModal]);

  // Preset configuration handlers
  const activePreset = adminPresets.find((p) => p.id === selectedPresetId) || adminPresets[0];

  const handleUpdateSlider = (key, value) => {
    configDirtyRef.current=true;setPresetSavedNotice('');
    setAdminPresets((prev) =>
      prev.map((p) =>
        p.id === selectedPresetId
          ? {
              ...p,
              settings: {
                ...p.settings,
                [key]: Number(value),
              },
            }
          : p
      )
    );
  };

  const handleToggleEnable = (id, e) => {
    e.stopPropagation();
    configDirtyRef.current=true;setPresetSavedNotice('');
    setAdminPresets((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const handleSetDefault = (id, e) => {
    e.stopPropagation();
    configDirtyRef.current=true;setPresetSavedNotice('');
    setAdminPresets((prev) =>
      prev.map((p) => ({
        ...p,
        isDefault: p.id === id,
        enabled: p.id === id ? true : p.enabled,
      }))
    );
  };

  const handleSavePresets = async () => {
    if(savingPresets||configVersion==null)return;
    setSavingPresets(true);setPresetSavedNotice('');
    const signature=JSON.stringify({presets:adminPresets,expected_version:configVersion});
    if(savePresetOpRef.current?.signature!==signature)savePresetOpRef.current={signature,operation_key:crypto.randomUUID()};
    try {
      const res=await mutatePrintingAdmin(password,{action:'save_presets',presets:adminPresets,expected_version:configVersion,operation_key:savePresetOpRef.current.operation_key});
      applyConfig(res.preset_config);savePresetOpRef.current=null;
      setPresetSavedNotice(`✓ Presets saved on server (v${res.preset_config.version}).`);
    }catch(error){setPresetSavedNotice(error.message||'Unable to save configuration. Your changes are preserved.');}
    finally{setSavingPresets(false);}
  };
  const handleResetPresets = () => {
    if(window.confirm('Reset presets to standard defaults? Click Save to apply to guests.')) {
      setAdminPresets(DEFAULT_PRESETS);configDirtyRef.current=true;
      setPresetSavedNotice('Reset to defaults; not yet saved to server.');
    }
  };
  const handleReloadPresets = async () => {
    if(configDirtyRef.current&&!window.confirm('Discard unsaved changes and reload config from server?'))return;
    try {const res=await getPrintingAdmin(password);applyConfig(res.preset_config);savePresetOpRef.current=null;setPresetSavedNotice('Reloaded latest config from server.');}
    catch(error){setPresetSavedNotice(error.message);}
  };

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
      setMutationError(`${prefix}${err.message || `Error executing action ${action}.`}`);
    } finally {
      setActiveMutationId(null);
    }
  };

  // Filtering and counts cover the whole queue, independently of the current page.
  const filteredRequests = data?.requests || [];
  const pendingCount = data?.counts?.pending || 0;
  const reviewCount = data?.counts?.review || 0;

  return (
    <div className={styles.adminContainer}>
      <PhotoHeader subtitle="Print Station Control Panel" />

      <main className={styles.mainWrapper}>
        {/* LOGIN SCREEN */}
        {!isAuthenticated ? (
          <div className={styles.loginCard}>
            <div className={styles.loginIcon} aria-hidden="true">
              🔒
            </div>
            <h1 className={styles.loginTitle}>Print Station Sign In</h1>
            <p className={styles.loginSubtitle}>
              Enter admin password to manage the wedding photo print queue. Password is kept in session memory.
            </p>

            {authError && (
              <div className={styles.errorBanner} style={{ marginBottom: 16 }}>
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className={styles.loginForm}>
              <div>
                <label htmlFor="admin-pass-input" style={{ fontSize: '0.85rem', color: 'rgba(253,250,245,0.8)' }}>
                  Print station password
                </label>
                <input
                  id="admin-pass-input"
                  type="password"
                  value={inputPassword}
                  onChange={(e) => setInputPassword(e.target.value)}
                  placeholder="Enter admin password..."
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
                {loading ? 'Checking...' : 'Sign In to Dashboard →'}
              </button>
            </form>

            <div style={{ marginTop: 24, fontSize: '0.82rem', color: 'rgba(253,250,245,0.5)' }}>
              <Link href="/admin" style={{ color: '#d4af37', textDecoration: 'underline' }}>
                Back to wedding admin
              </Link>
            </div>
          </div>
        ) : (
          /* AUTHENTICATED DASHBOARD */
          <div>
            {/* Top Header */}
            <div className={styles.dashHeader}>
              <div className={styles.dashTitleBlock}>
                <h1>Photo Print Queue (FIFO)</h1>
                <p>
                  Track print requests, review photos, and monitor Mac printer connection
                  {refreshing && ' • Syncing...'}
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
                      ? 'Updating status...'
                      : data.session.accepting
                      ? '⏸ Pause Submissions'
                      : '▶ Resume Submissions'}
                  </button>
                )}

                <Link
                  href="/admin"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    minHeight: 44,
                    padding: '8px 14px',
                    borderRadius: 8,
                    background: 'rgba(212, 175, 55, 0.15)',
                    border: '1px solid rgba(212, 175, 55, 0.4)',
                    color: '#d4af37',
                    textDecoration: 'none',
                    fontWeight: 500,
                    fontSize: '0.88rem',
                  }}
                >
                  ← Back to Admin
                </Link>

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
                  title="Reload data"
                >
                  🔄 Refresh
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
                  Sign Out
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
                          Submissions blocked by server (PHOTO_PRINT_HARDWARE_VERIFIED):
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
                  aria-label="Close error notice"
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
                  <strong>Mac print station is offline or lost heartbeat signal (&gt;15s)</strong>
                  <div>
                    You can still review and approve print requests normally. Approved requests will be securely queued and automatically printed once the Mac station reconnects.
                    {data?.station?.error && ` (Error details: ${data.station.error})`}
                  </div>
                </div>
              </div>
            )}

            {/* STATS OVERVIEW GRID */}
            <div className={styles.statsGrid}>
              {/* Stat 1: Total prints / quota */}
              <div className={styles.statCard}>
                <span className={styles.statCardLabel}>
                  {data?.session?.capacity != null ? 'Wedding Print Quota' : 'Total Prints Received'}
                </span>
                <div className={styles.statCardValue}>
                  {data?.session?.capacity != null ? (
                    <>
                      <span style={{ color: '#d4af37' }}>{data?.session?.remaining ?? 0}</span>
                      <span style={{ fontSize: '1rem', color: 'rgba(253,250,245,0.5)', fontWeight: 400 }}>
                        / {data.session.capacity} prints
                      </span>
                    </>
                  ) : (
                    <>
                      <span style={{ color: '#d4af37' }}>{data?.session?.reserved ?? 0}</span>
                      <span style={{ fontSize: '1rem', color: 'rgba(253,250,245,0.5)', fontWeight: 400 }}>
                        prints (Unlimited)
                      </span>
                    </>
                  )}
                </div>
                <span className={styles.statCardDesc}>
                  Received: {data?.session?.reserved ?? 0} • Status:{' '}
                  {data?.session?.accepting ? 'Open' : 'Paused'}
                </span>
              </div>

              {/* Stat 2: Pending review */}
              <div className={styles.statCard}>
                <span className={styles.statCardLabel}>Pending Approval</span>
                <div className={styles.statCardValue}>
                  <span style={{ color: pendingCount > 0 ? '#eab308' : '#fdfaf5' }}>{pendingCount}</span>
                  <span style={{ fontSize: '0.85rem', color: 'rgba(253,250,245,0.5)', fontWeight: 400 }}>photos</span>
                </div>
                <span className={styles.statCardDesc}>Review content before sending to printer queue</span>
              </div>

              {/* Stat 3: Needs review */}
              <div className={styles.statCard}>
                <span className={styles.statCardLabel}>Needs Review</span>
                <div className={styles.statCardValue}>
                  <span style={{ color: reviewCount > 0 ? '#f97316' : '#fdfaf5' }}>{reviewCount}</span>
                  <span style={{ fontSize: '0.85rem', color: 'rgba(253,250,245,0.5)', fontWeight: 400 }}>photos</span>
                </div>
                <span className={styles.statCardDesc}>Printer dispatch error or station disconnected</span>
              </div>

              {/* Stat 4: Mac print station */}
              <div className={styles.statCard}>
                <span className={styles.statCardLabel}>Mac Print Station Status</span>
                <div className={styles.statCardValue}>
                  {stationOnline ? (
                    <span className={styles.stationOnline}>● Online</span>
                  ) : (
                    <span className={styles.stationOffline}>○ Offline</span>
                  )}
                </div>
                <span className={styles.statCardDesc}>
                  {data?.station?.printer ? `Printer: ${data.station.printer}` : 'CUPS printer not detected'}
                </span>
              </div>
            </div>

            {/* =========================================================
               PRESET CONFIGURATION SECTION (Before Event)
               ========================================================= */}
            <section className={styles.presetConfigSection} aria-labelledby="preset-config-heading">
              <div className={styles.configSectionHeader}>
                <div>
                  <h2 id="preset-config-heading" className={styles.configHeaderTitle}>
                    <span>🎨</span> Photobooth Film Tone Configuration (Pre-Event)
                  </h2>
                  <p className={styles.configHeaderSubtitle}>
                    Preview with real wedding floral frames, fine-tune 6 film parameters, enable/disable presets, and choose the default tone for guests.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {presetSavedNotice && (
                    <span style={{ fontSize: '0.85rem', color: presetSavedNotice.startsWith('✓')?'#86efac':'#fbbf24', fontWeight: 600 }}>
                      {presetSavedNotice}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsConfigCollapsed(!isConfigCollapsed)}
                    className="btnSecondary"
                    style={{
                      minHeight: 38,
                      padding: '6px 14px',
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: '#fdfaf5',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    {isConfigCollapsed ? '▼ Expand Settings' : '▲ Collapse'}
                  </button>
                </div>
              </div>

              {!isConfigCollapsed && (
                <div className={styles.configGrid}>
                  {/* Column 1: Sample preview with vintage floral frame */}
                  <div className={styles.configPreviewCol}>
                    <div className={styles.previewToggleRow}>
                      <button
                        type="button"
                        className={`${styles.previewToggleBtn} ${adminPreviewOrientation === 'portrait' ? styles.active : ''}`}
                        onClick={() => setAdminPreviewOrientation('portrait')}
                      >
                        📱 Portrait (10×14.8)
                      </button>
                      <button
                        type="button"
                        className={`${styles.previewToggleBtn} ${adminPreviewOrientation === 'landscape' ? styles.active : ''}`}
                        onClick={() => setAdminPreviewOrientation('landscape')}
                      >
                        🖼️ Landscape (14.8×10)
                      </button>
                    </div>

                    <div style={{ width: '100%', maxWidth: adminPreviewOrientation === 'portrait' ? 280 : 380, margin: '8px auto' }}>
                      <PhotoboothCard
                        imageUrl="/images/000045.webp"
                        orientation={adminPreviewOrientation}
                        filter={computeEffectiveFilter(activePreset,defaultAdjustments(activePreset))}
                      />
                    </div>

                    <div style={{ textAlign: 'center', fontSize: '0.82rem', color: 'rgba(253,250,245,0.65)' }}>
                      Sample preview: <strong style={{ color: '#d4af37' }}>{activePreset.name}</strong> • Floral frame &amp; typography remain unchanged
                    </div>
                  </div>

                  {/* Column 2: Presets list and 6 deep fine-tuning sliders */}
                  <div className={styles.configSettingsCol}>
                    <button type="button" onClick={handleReloadPresets} disabled={savingPresets} style={{minHeight:44,marginBottom:12}}>Reload config from server</button>
                    <div className={styles.adminPresetList}>
                      {adminPresets.map((p) => {
                        const isSelected = p.id === selectedPresetId;
                        return (
                          <div
                            key={p.id}
                            className={`${styles.adminPresetItem} ${isSelected ? styles.active : ''}`}
                            onClick={() => setSelectedPresetId(p.id)}
                            onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelectedPresetId(p.id);}}}
                            role="button"
                            tabIndex={0}
                          >
                            <div className={styles.presetItemTop}>
                              <span className={styles.presetItemName}>
                                <span>{p.icon}</span> {p.name}
                                {p.isDefault && <span className={styles.presetBadgeDefault}>Default</span>}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: p.enabled ? '#86efac' : '#fca5a5' }}>
                                {p.enabled ? '● Enabled' : '○ Hidden'}
                              </span>
                            </div>

                            <div style={{ fontSize: '0.75rem', color: 'rgba(253,250,245,0.6)' }}>
                              {p.subtitle}
                            </div>

                            <div className={styles.presetItemActions}>
                              <label
                                className={styles.presetToggleLabel}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="radio"
                                  name="defaultPresetRadio"
                                  checked={p.isDefault}
                                  disabled={savingPresets}
                                  onChange={(e) => handleSetDefault(p.id, e)}
                                  style={{ accentColor: '#d4af37' }}
                                />
                                <span>Set default</span>
                              </label>

                              <label
                                className={styles.presetToggleLabel}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={p.enabled}
                                  disabled={savingPresets || p.id==='natural'}
                                  onChange={(e) => handleToggleEnable(p.id, e)}
                                  style={{ accentColor: '#22c55e' }}
                                />
                                <span>Visible</span>
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Fine-Tuning Panel: 6 deep parameters */}
                    <div className={styles.adminSlidersCard}>
                      <div className={styles.adminSlidersHeader}>
                        <span className={styles.adminSlidersTitle}>
                          ⚙️ Deep Adjustments for: <strong>{activePreset.name}</strong>
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'rgba(253,250,245,0.5)' }}>
                          Saved on server and applied across all guest devices
                        </span>
                      </div>

                      <div className={styles.adminSlidersGrid}>
                        {/* 1. Brightness (-50 .. 50) */}
                        <div className={styles.adminSliderRow}>
                          <div className={styles.adminSliderLabelRow}>
                            <span>Brightness</span>
                            <span className={styles.adminSliderVal}>
                              {activePreset.settings.brightness > 0 ? `+${activePreset.settings.brightness}` : activePreset.settings.brightness}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="-50"
                            max="50"
                            value={activePreset.settings.brightness}
                            disabled={savingPresets || activePreset.id==='natural'}
                            onChange={(e) => handleUpdateSlider('brightness', e.target.value)}
                            style={{ accentColor: '#d4af37', width: '100%' }}
                          />
                        </div>

                        {/* 2. Warmth (-50 .. 50) */}
                        <div className={styles.adminSliderRow}>
                          <div className={styles.adminSliderLabelRow}>
                            <span>Warmth / Temp</span>
                            <span className={styles.adminSliderVal}>
                              {activePreset.settings.warmth > 0 ? `+${activePreset.settings.warmth}` : activePreset.settings.warmth}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="-50"
                            max="50"
                            value={activePreset.settings.warmth}
                            disabled={savingPresets || activePreset.id==='natural'}
                            onChange={(e) => handleUpdateSlider('warmth', e.target.value)}
                            style={{ accentColor: '#d4af37', width: '100%' }}
                          />
                        </div>

                        {/* 3. Contrast (-50 .. 50) */}
                        <div className={styles.adminSliderRow}>
                          <div className={styles.adminSliderLabelRow}>
                            <span>Contrast</span>
                            <span className={styles.adminSliderVal}>
                              {activePreset.settings.contrast > 0 ? `+${activePreset.settings.contrast}` : activePreset.settings.contrast}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="-50"
                            max="50"
                            value={activePreset.settings.contrast}
                            disabled={savingPresets || activePreset.id==='natural'}
                            onChange={(e) => handleUpdateSlider('contrast', e.target.value)}
                            style={{ accentColor: '#d4af37', width: '100%' }}
                          />
                        </div>

                        {/* 4. Saturation (-100 .. 50) */}
                        <div className={styles.adminSliderRow}>
                          <div className={styles.adminSliderLabelRow}>
                            <span>Saturation</span>
                            <span className={styles.adminSliderVal}>
                              {activePreset.settings.saturation > 0 ? `+${activePreset.settings.saturation}` : activePreset.settings.saturation}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="-100"
                            max="50"
                            value={activePreset.settings.saturation}
                            disabled={savingPresets || activePreset.id==='natural'}
                            onChange={(e) => handleUpdateSlider('saturation', e.target.value)}
                            style={{ accentColor: '#d4af37', width: '100%' }}
                          />
                        </div>

                        {/* 5. Fade (0 .. 50) */}
                        <div className={styles.adminSliderRow}>
                          <div className={styles.adminSliderLabelRow}>
                            <span>Matte Fade</span>
                            <span className={styles.adminSliderVal}>{activePreset.settings.fade}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="50"
                            value={activePreset.settings.fade}
                            disabled={savingPresets || activePreset.id==='natural'}
                            onChange={(e) => handleUpdateSlider('fade', e.target.value)}
                            style={{ accentColor: '#d4af37', width: '100%' }}
                          />
                        </div>

                        {/* 6. Grain (0 .. 50) */}
                        <div className={styles.adminSliderRow}>
                          <div className={styles.adminSliderLabelRow}>
                            <span>Classic Grain</span>
                            <span className={styles.adminSliderVal}>{activePreset.settings.grain}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="50"
                            value={activePreset.settings.grain}
                            disabled={savingPresets || activePreset.id==='natural'}
                            onChange={(e) => handleUpdateSlider('grain', e.target.value)}
                            style={{ accentColor: '#d4af37', width: '100%' }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Action buttons: Save & Reset */}
                    <div className={styles.configActionRow}>
                      <button
                        type="button"
                        onClick={handleResetPresets}
                        disabled={savingPresets}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 8,
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          color: 'rgba(253,250,245,0.8)',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                        }}
                      >
                        ↺ Reset to Defaults
                      </button>

                      <button
                        type="button"
                        onClick={handleSavePresets}
                        disabled={savingPresets || configVersion==null}
                        className="btnPrimary"
                        style={{
                          minHeight: 42,
                          padding: '8px 20px',
                          borderRadius: 8,
                          background: 'linear-gradient(135deg, #d4af37, #b08d4f)',
                          color: '#0E1217',
                          fontWeight: 600,
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                        }}
                      >
                        💾 Save Film Presets
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* TOOLBAR: Filter tabs & search */}
            <div className={styles.toolbar}>
              <div className={styles.filterTabs} role="tablist" aria-label="Status filters">
                <button
                  type="button"
                  className={`${styles.filterTab} ${statusFilter === 'all' ? styles.active : ''}`}
                  onClick={() => setStatusFilter('all')}
                >
                  All ({data?.pagination?.total || 0})
                </button>
                <button
                  type="button"
                  className={`${styles.filterTab} ${statusFilter === 'pending' ? styles.active : ''}`}
                  onClick={() => setStatusFilter('pending')}
                >
                  Pending Review ({pendingCount})
                </button>
                <button
                  type="button"
                  className={`${styles.filterTab} ${statusFilter === 'processing' ? styles.active : ''}`}
                  onClick={() => setStatusFilter('processing')}
                >
                  Queued / Printing
                </button>
                <button
                  type="button"
                  className={`${styles.filterTab} ${statusFilter === 'review' ? styles.active : ''}`}
                  onClick={() => setStatusFilter('review')}
                >
                  Needs Review ({reviewCount})
                </button>
                <button
                  type="button"
                  className={`${styles.filterTab} ${statusFilter === 'ready' ? styles.active : ''}`}
                  onClick={() => setStatusFilter('ready')}
                >
                  Ready for Pickup
                </button>
                <button
                  type="button"
                  className={`${styles.filterTab} ${statusFilter === 'rejected' ? styles.active : ''}`}
                  onClick={() => setStatusFilter('rejected')}
                >
                  Declined
                </button>
              </div>

              <input
                type="search"
                placeholder="Search guest name or pickup code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
                aria-label="Search print requests"
              />
            </div>

            <div className={styles.toolbar} aria-label="Queue pagination">
              <button type="button" disabled={query.page<=1 || refreshing} onClick={()=>setQuery(prev=>({...prev,page:prev.page-1}))}>Previous</button>
              <span>Page {query.page} · {data?.pagination?.matched || 0} matching requests</span>
              <button type="button" disabled={query.page*25 >= (data?.pagination?.matched || 0) || refreshing} onClick={()=>setQuery(prev=>({...prev,page:prev.page+1}))}>Next</button>
            </div>
            {/* QUEUE TABLE (DESKTOP) */}
            <div className={styles.tableContainer}>
              {filteredRequests.length === 0 ? (
                <div className={styles.emptyState}>
                  No print requests match the current filter.
                </div>
              ) : (
                <table className={styles.requestsTable}>
                  <thead>
                    <tr>
                      <th style={{ width: 80 }}>Photo</th>
                      <th>Guest</th>
                      <th>Pickup Code</th>
                      <th>Orientation</th>
                      <th>Film Tone</th>
                      <th>Time</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
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
                            onClick={() => req.preview_url && setLightboxItem(req)}
                            title="Click to view full framed preview"
                            role="button"
                            tabIndex={0}
                          >
                            {req.preview_url ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img loading="lazy" src={req.thumbnail_url || req.preview_url} alt={`Photo from ${req.guest_name}`} className={styles.thumbnailImg} />
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
                              Error: {req.attempts[0].error}
                            </div>
                          )}
                        </td>

                        {/* Pickup Code */}
                        <td className={styles.pickupCodeCell}>{req.pickup_code}</td>

                        {/* Orientation */}
                        <td>
                          <span style={{ fontSize: '0.82rem', color: 'rgba(253,250,245,0.7)' }}>
                            {req.orientation === 'portrait' ? '📱 Portrait (10×14.8)' : '🖼️ Landscape (14.8×10)'}
                          </span>
                        </td>

                        {/* Tone Film Preset */}
                        <td>
                          <span className={styles.presetTag}>
                            🎞️ {req.preset_name || 'Saved (no preset)'}
                          </span>
                        </td>

                        {/* Timestamps */}
                        <td style={{ fontSize: '0.82rem', color: 'rgba(253,250,245,0.6)' }}>
                          {new Date(req.created_at).toLocaleTimeString('en-US', {
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
                            {/* Open Lightbox Preview Button */}
                            <button
                              type="button"
                              className={styles.btnPreviewSmall}
                              onClick={() => setLightboxItem(req)}
                              title="View complete framed photo before printing"
                            >
                              🔍 View
                            </button>

                            {req.status === 'pending' && <button type="button" className={`${styles.btnAction} ${styles.btnEdit}`} disabled={activeMutationId !== null} onClick={() => setEditItem(req)}>Edit request</button>}
                            {/* For pending: Approve or Reject */}
                            {req.status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  className={`${styles.btnAction} ${styles.btnApprove}`}
                                  disabled={activeMutationId === req.id}
                                  onClick={() => performMutation('approve', req.id)}
                                >
                                  {activeMutationId === req.id ? 'Approving...' : '✓ Approve'}
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.btnAction} ${styles.btnReject}`}
                                  disabled={activeMutationId === req.id}
                                  onClick={() => setConfirmRejectModal(req)}
                                >
                                  ✕ Reject
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
                                ✕ Reject
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
                                {activeMutationId === req.id ? 'Updating...' : '✨ Mark Ready'}
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
                                🔄 Reprint
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
                  No print requests match the current filter.
                </div>
              ) : (
                filteredRequests.map((req) => (
                  <div key={req.id} className={styles.mobileCard}>
                    <div className={styles.mobileCardTop}>
                      <div
                        className={`${styles.thumbnailWrapper} ${
                          req.orientation === 'landscape' ? styles.landscape : ''
                        }`}
                        onClick={() => req.preview_url && setLightboxItem(req)}
                      >
                        {req.preview_url && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img loading="lazy" src={req.thumbnail_url || req.preview_url} alt={req.guest_name} className={styles.thumbnailImg} />
                        )}
                      </div>

                      <div className={styles.mobileCardInfo}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <strong style={{ color: '#fdfaf5', fontSize: '1rem' }}>{req.guest_name}</strong>
                          <span className={styles.pickupCodeCell}>{req.pickup_code}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                          <StatusBadge status={req.status} />
                          <span className={styles.presetTag}>
                            🎞️ {req.preset_name || 'Saved (no preset)'}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'rgba(253,250,245,0.6)' }}>
                            {req.orientation === 'portrait' ? 'Portrait' : 'Landscape'}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'rgba(253,250,245,0.5)' }}>
                            {new Date(req.created_at).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions on mobile */}
                    <div className={styles.actionGroup}>
                      <button
                        type="button"
                        className={styles.btnPreviewSmall}
                        onClick={() => setLightboxItem(req)}
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        🔍 View Complete Print Preview
                      </button>

                      {req.status === 'pending' && <button type="button" className={`${styles.btnAction} ${styles.btnEdit}`} disabled={activeMutationId !== null} onClick={() => setEditItem(req)}>Edit request</button>}
                      {req.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            className={`${styles.btnAction} ${styles.btnApprove}`}
                            style={{ flex: 1 }}
                            disabled={activeMutationId === req.id}
                            onClick={() => performMutation('approve', req.id)}
                          >
                            ✓ Approve
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
                          ✕ Reject
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
                          ✨ Mark Ready for Pickup
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
                          🔄 Request Reprint
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
                  <h3 className={styles.modalTitle}>Confirm Rejection</h3>
                  <div className={styles.modalBody}>
                    <p>
                      Are you sure you want to decline the print request for{' '}
                      <strong>{confirmRejectModal.guest_name}</strong> (Code:{' '}
                      <code>{confirmRejectModal.pickup_code}</code>)?
                    </p>
                    <p style={{ color: 'rgba(253,250,245,0.6)', fontSize: '0.85rem' }}>
                      This print credit will be refunded to the wedding quota. The guest can submit another photo.
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
                      Cancel
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
                      {activeMutationId === confirmRejectModal.id ? 'Declining...' : 'Confirm Decline'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL: Reprint Confirmation with Physical Check & Quota Warning */}
            {confirmReprintModal && (
              <div className={styles.modalOverlay} role="dialog" aria-modal="true">
                <div className={styles.modalContent}>
                  <h3 className={styles.modalTitle}>Confirm Photo Reprint</h3>
                  <div className={styles.modalBody}>
                    <p>
                      Reprint request for <strong>{confirmReprintModal.guest_name}</strong> (Code:{' '}
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
                      {data?.session?.capacity != null && (
                        <div>
                          ⚠️ <strong>Quota Notice:</strong> Reprinting will consume 1 additional print from the wedding quota.
                        </div>
                      )}
                      {confirmReprintModal.status === 'review' && (
                        <div>
                          🛠️ <strong>Inspection Required:</strong> Please ensure the previous print job on the Mac printer has stopped or been canceled before resending.
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
                        I have verified the physical printer and confirm consuming 1 additional print from the quota.
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
                      Cancel
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
                      {activeMutationId === confirmReprintModal.id ? 'Sending print command...' : 'Confirm Reprint'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {editItem && <AdminRequestEditor key={editItem.id} request={editItem} password={password} onClose={() => setEditItem(null)} onSaved={updated => { setEditItem(updated); fetchData(true); }} />}

            {/* LIGHTBOX MODAL WITH FULL PREVIEW & SPECS */}
            {lightboxItem && (
              <div
                className={styles.modalOverlay}
                onClick={() => setLightboxItem(null)}
                role="dialog"
                aria-modal="true"
              >
                <div
                  className={styles.lightboxModal}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '24px 20px',
                    maxWidth: '92vw',
                    maxHeight: '92vh',
                    overflowY: 'auto',
                  }}
                >
                  <button
                    type="button"
                    className={styles.lightboxCloseBtn}
                    onClick={() => setLightboxItem(null)}
                    aria-label="Close preview"
                  >
                    ✕
                  </button>

                  {/* Render the full framed preview from backend */}
                  <div
                    style={{
                      maxWidth: lightboxItem.orientation === 'portrait' ? 360 : 540,
                      width: '100%',
                      marginBottom: 16,
                      borderRadius: 8,
                      overflow: 'hidden',
                      boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
                    }}
                  >
                    {lightboxItem.preview_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={lightboxItem.preview_url}
                        alt={`Framed preview of ${lightboxItem.guest_name}`}
                        className={styles.lightboxImg}
                        style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '65vh', objectFit: 'contain' }}
                      />
                    ) : (
                      <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
                        Complete preview file not yet available from backend
                      </div>
                    )}
                  </div>

                  {/* Lightbox Details & Specs */}
                  <div className={styles.lightboxDetails}>
                    <div className={styles.lightboxMetaRow}>
                      <span>Guest: <strong style={{ color: '#fdfaf5' }}>{lightboxItem.guest_name}</strong></span>
                      <span>Pickup Code: <strong className={styles.pickupCodeCell}>{lightboxItem.pickup_code}</strong></span>
                      <span>
                        Size: <strong style={{ color: '#d4af37' }}>
                          {lightboxItem.orientation === 'portrait' ? 'Portrait (10×14.8 cm)' : 'Landscape (14.8×10 cm)'}
                        </strong>
                      </span>
                      <span className={styles.presetTag}>
                        Tone: {lightboxItem.preset_name || 'Saved (no preset)'}
                      </span>
                      <StatusBadge status={lightboxItem.status} />
                    </div>

                    {lightboxItem.status === 'pending' && <button type="button" className={`${styles.btnAction} ${styles.btnEdit}`} disabled={activeMutationId !== null} onClick={() => { setEditItem(lightboxItem); setLightboxItem(null); }}>Edit request</button>}
                    {/* Quick action buttons in Lightbox */}
                    <div className={styles.actionGroup} style={{ marginTop: 8, justifyContent: 'center' }}>
                      {lightboxItem.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            className={`${styles.btnAction} ${styles.btnApprove}`}
                            disabled={activeMutationId === lightboxItem.id}
                            onClick={async () => {
                              await performMutation('approve', lightboxItem.id);
                              setLightboxItem(null);
                            }}
                          >
                            {activeMutationId === lightboxItem.id ? 'Approving...' : '✓ Approve Now'}
                          </button>
                          <button
                            type="button"
                            className={`${styles.btnAction} ${styles.btnReject}`}
                            disabled={activeMutationId === lightboxItem.id}
                            onClick={() => {
                              setConfirmRejectModal(lightboxItem);
                              setLightboxItem(null);
                            }}
                          >
                            ✕ Reject
                          </button>
                        </>
                      )}

                      {lightboxItem.status === 'approved' && (
                        <button
                          type="button"
                          className={`${styles.btnAction} ${styles.btnReject}`}
                          disabled={activeMutationId === lightboxItem.id}
                          onClick={() => {
                            setConfirmRejectModal(lightboxItem);
                            setLightboxItem(null);
                          }}
                        >
                          ✕ Reject
                        </button>
                      )}

                      {(lightboxItem.status === 'submitted' || lightboxItem.status === 'review') && (
                        <button
                          type="button"
                          className={`${styles.btnAction} ${styles.btnReady}`}
                          disabled={activeMutationId === lightboxItem.id}
                          onClick={async () => {
                            await performMutation('ready', lightboxItem.id);
                            setLightboxItem(null);
                          }}
                        >
                          {activeMutationId === lightboxItem.id ? 'Updating...' : '✨ Mark Ready for Pickup'}
                        </button>
                      )}

                      {(lightboxItem.status === 'ready' || lightboxItem.status === 'review') && (
                        <button
                          type="button"
                          className={`${styles.btnAction} ${styles.btnReprint}`}
                          disabled={activeMutationId === lightboxItem.id}
                          onClick={() => {
                            setConfirmReprintModal(lightboxItem);
                            setReprintConfirmedCheckbox(false);
                            setLightboxItem(null);
                          }}
                        >
                          🔄 Request Reprint
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
