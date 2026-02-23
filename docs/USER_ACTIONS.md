# User Actions

<!-- Manual actions requiring user intervention outside the codebase. Clear when completed. -->

## Run `npm install`

**Why:** The npm registry was unavailable during development, so dependencies aren't installed yet.

**Steps:**
1. Open terminal in the project root
2. Run `npm install`
3. Verify with `npm run dev` — app should start on localhost

## Create PWA icon assets

**Why:** The PWA manifest references icon files that don't exist yet.

**Steps:**
1. Create a 512x512 app icon (green/emerald theme to match brand colour #10b981)
2. Export as: `public/pwa-512x512.png` (512x512), `public/pwa-192x192.png` (192x192), `public/apple-touch-icon.png` (180x180), `public/favicon.ico` (32x32)
3. Place all files in the `public/` directory
