# Photobooth draft hydration fix

Verified locally on 2026-10-02.

The server rendered an empty upload picker while the first client render read sessionStorage and rendered the saved cropper/review. All draft-dependent state/ref initializers now use deterministic defaults. A cancellable mount callback restores the saved upload, guest name, orientation, crop, preset configuration/version, adjustments, step, immutable submitted snapshot and retry keys as one batch. Draft persistence stays disabled until restoration finishes.

Browser comparison used isolated production builds of the original HEAD page and the corrected page, with a fixture session/config response and an existing local website photo. The original page logged React hydration error #418. The corrected page logged no browser errors for:

- A saved landscape draft: Classic Neg. Retro at 80%, brightness +4 and warmth +3 survived first load and reload.
- A submitted draft: restored the saved guest name, landscape orientation and preset on step 3; editing controls remained locked and the immutable retry path remained available after reload.
- No draft: displayed the image picker.
- Invalid JSON in sessionStorage: displayed the image picker without a hydration error.

Evidence screenshot: `photo-film-qa/hydration-fixed.jpg`. These browser checks cover hydration/restoration, not native camera or physical printing. No production request or printer job was submitted during these checks.

`npm run test:photo`: 19 tests passed. Lint passed with 20 existing warnings. Production build passed. The full API preview runner was blocked by the concurrent admin-edit testcase returning INVALID_INPUT at its missing expected_revision; an isolated browser fixture was used to verify this page change without altering that work.
