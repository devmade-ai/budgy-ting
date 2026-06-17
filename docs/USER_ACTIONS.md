# User Actions

<!-- Manual actions requiring user intervention outside the codebase. Clear when completed. -->

## Regenerate app icons from the Farlume logomark

**Why:** The DaisyUI→Farlume facelift restyled the entire UI, but the PWA/app icons
and favicon (`public/pwa-192x192.png`, `pwa-512x512.png`, `pwa-maskable-1024x1024.png`,
`apple-touch-icon.png`, `favicon-48x48.png`, `favicon.ico`, `public/icon.svg`) still show
the pre-facelift mark. The brand logomark now lives at `src/assets/brand/logo-mark.svg`
(a rising forecast line into an amber beacon on deep ink).

**Steps:**
1. Decide the master icon (the logomark on a paper/ink tile, with maskable safe-zone padding).
2. Run `npm run generate-icons` (regenerates the PNG set; requires the `sharp` dependency —
   install if the script fails). Update `public/icon.svg` to the Farlume mark.
3. The build's `iconVersion`/`ICONS_HASH` flow (vite.config.ts) will hash the new bytes,
   bust caches, and surface the standalone-mode reinstall banner to installed users.
4. Verify the favicon + installed-PWA icon both show the new mark.

This needs a design decision on the exact icon composition + the `sharp` toolchain, so it's
flagged here rather than done blind.
