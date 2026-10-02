# Photobooth film presets

## Implemented contract

Seven choices: Original, Soft Wedding (ASTIA inspired), Golden Memory (NOSTALGIC Neg. inspired), Clean Portrait (PRO Neg. Std inspired), Evening Cinema (ETERNA inspired), Classic Story (CLASSIC CHROME inspired), and Timeless B&W (ACROS inspired). These are original approximations for sRGB phone images, not official Fujifilm profiles or camera recipes.

Soft Wedding defaults to 70% intensity, other color looks to 60%, B&W to 100%. The shared `film.mjs` engine uses luminance curves, selective foliage/blue saturation, selective amber highlights/cool shadows, temperature channel balance, soft shadow lift and deterministic luminance grain. Neutral highlights resist amber tint; grain is suppressed in dark source pixels. Neither clipped whites nor severe mixed lighting can be recovered by these looks. Monochrome remains monochrome even at 0% intensity, and the guest warmth slider is hidden.

- `GET /api/photo/status` and authenticated `GET /api/admin/printing` include `preset_config: {version, presets}`. Guest drafts pin the version they previewed; previously published versions remain valid.
- Authenticated `PATCH /api/admin/printing` accepts `{action:'save_presets', expected_version, operation_key, presets}`. Settings are validated against the server catalog. One enabled default is required; Original remains enabled and neutral. Saves are idempotent and reject stale writes with `CONFIG_STALE`; the admin draft stays intact until explicitly reloaded/discarded.
- `POST /api/photo/requests` optionally accepts `filter: {preset_id, config_version, adjustments:{intensity,brightness,warmth}}`. Guest ranges are 0–100, −50–50, −50–50; brightness units map to 0.01 EV before clamping the combined offset. `computed`, display names, profiles and other client color values are ignored. Server resolves the immutable catalog version and stores a trusted render snapshot, engine/frame version and upload-derived seed.
- New framed requests render crop → shared pixel transform → floral overlay → sRGB JPEG at 300 dpi. Admin previews and worker downloads use that exact private JPEG. Reprints do not render again.
- Legacy IDs `warm_film`, `vintage_soft`, `bw_classic` remain supported under version 0 for restored drafts. Their identity is retained, but the new shared renderer replaces the old CSS preview approximation. Already accepted requests preserve their existing JPEG/fingerprint. Requests without `filter` keep the legacy unframed path.
- Browser Canvas and server Sharp share color code and final aperture dimensions. Their source resampling/JPEG encoding can differ slightly; the saved server JPEG is authoritative. Preview CORS/decode failures show an error and block new submission instead of displaying unprocessed color as a successful preview.
- Old localStorage admin settings are retained in the browser but are no longer authoritative and are not silently published to every guest.

## Installation

Apply `supabase/migrations/20261002_photo_film_presets.sql` after `20261002_photo_printing.sql` using the normal migration process. It adds an RLS-protected immutable version table, request snapshots, and a service-role-only `photo_print_film_command` RPC. The queue RPC is not replaced: configuration remains intact if a separate queue migration changes quota behavior. Missing migrations produce a real unavailable response; no browser-only save success is shown.

Deploy the application and migration together. Do not open intake or set hardware verification as part of installing presets. No production migration, deployment, real printer command or LaunchAgent setup was performed by the film implementation.

## Validation

`npm run test:photo`: shared transform identity/monochrome invariants, deterministic grain, white neutrality, seven distinct swatch outputs, both framed orientations at 300 dpi, unaffected border pixels, server/preview transform agreement, immutable config history, stale saves, RLS and existing queue/worker tests.

`npm run test:photo:api`: actual Next HTTP handlers with PGlite + private Storage fixture, ignored forged computed color, config publication/retry/stale save, invalid settings/presets, snapshot persistence, approval/station/report/reprint and exact worker JPEG bytes. It does not contact production Supabase or CP1500. `node tests/photo/api.integration.mjs --preview` exposes a temporary `/photo/film-qa` bootstrap for browser QA; this route never enters production source.

Verified locally on 2026-10-02: 16 photo tests, Next HTTP integration, production build, lint (0 errors; 20 existing warnings), and `git diff --check`. Browser fixture verified mobile width 390px without horizontal overflow, monochrome at 0% intensity with warmth hidden, guest submission, exact saved JPEG in admin, server preset save to v3, and Golden Memory / 60% restored after reload. Desktop browser tests do not replace iPhone/Android camera or physical printer verification.

Local `photo-film-qa/film-comparison.png` compares an existing website photo across all choices. The second row artificially darkens/warms the source; it is not a real evening photograph. Browser screenshots also use a fixture, not guest data. Calibrate with real afternoon, sunset, flash, warm indoor and LED-lit photos across skin tones, then physical CP1500 prints before approving print color.

## Research provenance

Fujifilm character descriptions are source facts; suitability labels and all coefficients are our initial design choices, not Fujifilm measurements.

- ASTIA: https://www.fujifilm-x.com/en-us/products/film-simulation/astia/
- NOSTALGIC Neg.: https://www.fujifilm-x.com/en-us/products/film-simulation/nostalgic-neg/
- PRO Neg. Std: https://www.fujifilm-x.com/en-ph/products/film-simulation/pro-neg-std/
- ETERNA: https://www.fujifilm-x.com/en-us/products/film-simulation/eterna/
- CLASSIC CHROME: https://www.fujifilm-x.com/en-us/products/film-simulation/classic-chrome/
- ACROS: https://www.fujifilm-x.com/en-us/products/film-simulation/acros/

## Stronger look revision (2026-10-02)

The v2 profiles separate the looks at the existing 70% / 60% starting strengths: Soft Wedding lifts midtones into airy pastels, Golden Memory adds selective amber/olive split tones, Clean Portrait stays neutral with clearer contrast, Evening Cinema combines desaturation with cool matte shadows, Classic Story deepens midtones with muted cool colors, and Timeless B&W adds a stronger tonal curve. Neutral highlights remain untinted; the floral frame uses no film processing.

Apply `20261002_photo_film_looks_v2.sql` after the initial film migration alongside the updated application. It publishes the new profile IDs in a new catalog version, retaining operator settings, enabled flags and default choice. Historical catalog rows and v1 transform coefficients remain unchanged, so pinned drafts keep their earlier appearance and accepted requests keep their existing JPEG. Saving presets from admin publishes the current v2 definitions. This migration has not been applied to production by Codex.

The revised regression check requires a mean RGB separation of at least six levels across representative skin, blue, green, amber and gray swatches for every pair of color presets at default intensity. This is a regression guard, not a perceptual or printer calibration claim. The comparison sheet uses the same website photo plus simulated evening lighting.
