# Admin request editing

Implemented and verified on 2026-10-02 (Asia/Ho_Chi_Minh).

Pending requests expose **Edit request** on desktop, mobile, and the photo lightbox. Operators can edit the guest name, orientation, replace the photo (center crop), and apply brightness/warmth/contrast or monochrome. **Save changes** persists without approving and refreshes the saved JPEG preview. **Save & approve** saves and creates one queued print attempt atomically. The preview always represents the saved print, rather than unsaved slider changes.

Only pending requests are editable. Operator-review requests retain the existing explicit ready/reprint workflow, so editing cannot create a queued attempt behind an unresolved review attempt. A per-request revision prevents two admins from silently overwriting each other. Stale saves preserve the draft and allow reloading the latest request before retrying. An unknown save result keeps the exact payload and operation key for retry; successful retries return the persisted result and image without rendering or queuing again.

Both framed and legacy unframed images are supported. The original film snapshot remains intact; image edits are marked separately and listed as **Admin edited**. Name-only edits retain the existing film label.

## Database

`supabase/migrations/20261002180000_photo_admin_edit_safe.sql` adds request revision/image-edit metadata and operation fingerprint/result metadata, then wraps the current queue command without duplicating its unrelated logic. Apply after the existing printing/quota/film migrations. The migration is safe to rerun and keeps anonymous/authenticated RPC access revoked.

Applied successfully through the existing Supabase SQL Editor to the project matching `.env.local`. Verified the final columns and `edit_retry` RPC through the service-role REST client. No real requests were edited or approved as part of verification.

## Verification

- `npm run test:photo`: 21/21 passed, including actual PATCH handler → Supabase HTTP fixture → embedded PostgreSQL → private image storage → station claim. Covers exact retries after approval/status changes, changed-payload rejection, concurrent admins, hardware gating, review rejection, retained legacy queue commands, and legacy-image content preservation.
- ESLint passed for the changed admin page/editor/API/server/image and regression test.
- `npm run build`: passed.
- Actual Next UI against isolated fixture: saved name/orientation, reloaded to verify persistence, saved/approved on desktop and 390×844 mobile. Printed-image metadata verified at 300 DPI; station claim uses the updated path/orientation.
- Existing local admin at `localhost:3001` against configured Supabase: editor opened successfully and was cancelled without changing real requests.
- Screenshots: `admin-edit-qa/approved.jpg`, `admin-edit-qa/mobile-saved.jpg`.

Public-site deployment and physical printer output were not performed in this change.
