'use client';

import { useEffect, useRef, useState } from 'react';
import { getPrintingAdmin, photoFetch } from '@/lib/photo/client';
import styles from '@/app/admin/printing/printing.module.css';

const neutral = () => ({ brightness: 0, warmth: 0, contrast: 0, monochrome: false });

export default function AdminRequestEditor({ request, password, onSaved, onClose }) {
  const [saved, setSaved] = useState(request);
  const [name, setName] = useState(request.guest_name);
  const [orientation, setOrientation] = useState(request.orientation);
  const [file, setFile] = useState(null);
  const [adjustments, setAdjustments] = useState(neutral);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const [notice, setNotice] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const operation = useRef(null);
  const busy = useRef(false);
  const input = useRef(null);
  const panel = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    panel.current?.querySelector('input')?.focus();
    return () => { if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape' && !saving && !uncertain) { e.preventDefault(); onClose(); }
      if (e.key !== 'Tab') return;
      const controls = Array.from(panel.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)'));
      const first=controls[0], last=controls[controls.length-1];
      if (e.shiftKey && document.activeElement===first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement===last) { e.preventDefault(); first?.focus(); }
    };
    const node=panel.current; node.addEventListener('keydown',onKey);
    return () => node.removeEventListener('keydown',onKey);
  }, [saving,uncertain,onClose]);

  const save = async approve => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true); setError(''); setNotice('');
    // Keep the same immutable payload and key when the response is lost.
    if (!operation.current) {
      const body = new FormData();
      body.set('action', 'edit'); body.set('id', saved.id);
      body.set('operation_key', crypto.randomUUID());
      body.set('expected_revision', String(saved.edit_revision));
      body.set('guest_name', name.trim()); body.set('orientation', orientation);
      body.set('adjustments', JSON.stringify(adjustments));
      body.set('approve', String(approve));
      if (file) body.set('file', file);
      operation.current = { body, approve };
    }
    try {
      const result = await photoFetch('/api/admin/printing', {
        method: 'PATCH', headers: { 'x-admin-password': password }, body: operation.current.body,
      });
      const updated = { ...saved, ...result.request, preview_url: result.preview_url };
      setSaved(updated); setName(updated.guest_name); setOrientation(updated.orientation);
      setFile(null); setAdjustments(neutral());
      if (input.current) input.current.value = '';
      setNotice(updated.status === 'approved' ? 'Changes saved and request queued for printing.' : 'Changes saved. Review the updated photo before approving.');
      operation.current = null; setUncertain(false); setStale(false); onSaved(updated);
    } catch (err) {
      setStale(err.code === 'STATE_CONFLICT');
      setError(err.message || 'Unable to save. Your changes are preserved.');
      // Only a definitive rejection allows a different payload. For a lost response,
      // require exact retry before editing or approving again.
      if (err.status && err.status < 500) { operation.current = null; setUncertain(false); }
      else setUncertain(true);
    } finally { busy.current = false; setSaving(false); }
  };

  const reloadLatest = async () => {
    if (busy.current) return;
    busy.current = true; setSaving(true);
    try {
      const result = await getPrintingAdmin(password);
      const latest = result.requests.find(item => item.id === saved.id);
      if (!latest) throw new Error('Request no longer available.');
      setSaved(latest); setStale(false); setError('');
      setNotice(`Latest saved request: ${latest.guest_name}, ${latest.orientation}, ${latest.status}. Your draft is preserved; review it before saving again.`);
    } catch (err) { setError(err.message); }
    finally { busy.current = false; setSaving(false); }
  };

  const locked = saving || uncertain || saved.status !== 'pending';
  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="edit-request-title">
      <section ref={panel} className={`${styles.modalContent} ${styles.requestEditor}`}>
        <h2 id="edit-request-title">Edit print request</h2>
        <p>Pickup code: <strong>{saved.pickup_code}</strong></p>
        {saved.preview_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.editPreview} src={saved.preview_url} alt={`Saved print for ${saved.guest_name}`} />
        )}
        {saved.status === 'pending' && <p className={styles.editHint}>The preview shows the saved print. Save changes to see the new photo, orientation and adjustments.</p>}
        <form onSubmit={e => { e.preventDefault(); save(false); }}>
          {saved.status === 'pending' ? <fieldset disabled={locked} className={styles.editFields}>
            <label>Guest name<input required maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label>
            <label>Orientation<select value={orientation} onChange={e => setOrientation(e.target.value)}>
              <option value="portrait">Portrait</option><option value="landscape">Landscape</option>
            </select></label>
            <label>Replace photo<input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
            <p className={styles.editHint}>Replacement photos are cropped to the center. Color adjustments apply to the photo on this save.</p>
            {['brightness','warmth','contrast'].map(key => <label key={key}>
              {key[0].toUpperCase() + key.slice(1)}: {adjustments[key]}
              <input type="range" min="-100" max="100" value={adjustments[key]} onChange={e => setAdjustments(prev => ({ ...prev, [key]: Number(e.target.value) }))} />
            </label>)}
            <label><input type="checkbox" checked={adjustments.monochrome} onChange={e => setAdjustments(prev => ({ ...prev, monochrome: e.target.checked }))} /> Black and white</label>
          </fieldset> : <p>Guest: <strong>{saved.guest_name}</strong> · {saved.orientation}</p>}
          {error && <p role="alert">{error}</p>}
          {stale && <button type="button" className={`${styles.btnAction} ${styles.btnEdit}`} disabled={saving} onClick={reloadLatest}>Reload latest request</button>}
          {notice && <p role="status">{notice}</p>}
          {uncertain && <p role="status">The save result is unknown. Retry the same save before making more changes.</p>}
          <div className={styles.actionGroup}>
            {!uncertain && saved.status === 'pending' && <>
              <button className={`${styles.btnAction} ${styles.btnEdit}`} type="submit" disabled={saving || stale || !name.trim()}>Save changes</button>
              <button className={`${styles.btnAction} ${styles.btnApprove}`} type="button" disabled={saving || stale || !name.trim()} onClick={() => save(true)}>Save &amp; approve</button>
            </>}
            {uncertain && <button className={`${styles.btnAction} ${styles.btnEdit}`} type="button" disabled={saving} onClick={() => save(operation.current.approve)}>Retry save</button>}
            <button className={`${styles.btnAction} ${styles.btnEdit}`} type="button" disabled={saving || uncertain} onClick={onClose}>{saved.status === 'approved' ? 'Close' : 'Cancel'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
