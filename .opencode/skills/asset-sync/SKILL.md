---
name: Offline Asset Sync
description: Regenerate public/ assets for Tesseract OCR, MediaPipe pose and hero WebP images
---

# Generated assets — never edit `public/` by hand

`public/` holds artifacts produced by scripts from `node_modules`; regenerating overwrites them.

| Script                              | Command                         | What it does                                                                                                                                                                      |
| ----------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/sync-ocr-assets.mjs`       | `npm run sync-ocr-assets`       | Copies the Tesseract.js worker/core/lang data (eng, rus) and the pdfjs worker into `public/` so lab recognition works offline. Runs on `postinstall` and at the start of `build`. |
| `scripts/sync-mediapipe-assets.mjs` | `npm run sync-mediapipe-assets` | Copies MediaPipe `tasks-vision` wasm into `public/mediapipe/wasm/` and downloads `pose_landmarker_lite.task` if missing. Runs at the start of `build`.                            |
| `scripts/sync-hero-webp.mjs`        | `npm run sync-hero-webp`        | Converts hero `public/*.png                                                                                                                                                       | _.jpg` (`hero-_`, `bg-profile.*`) to `<name>.webp`(q80) using`@napi-rs/canvas`. |

## Rules

1. After bumping `tesseract.js`, `pdfjs-dist`, `@mediapipe/tasks-vision` or `@napi-rs/canvas`: re-run the
   matching sync script and check that `public/` is still gitignored/generated as expected.
2. WebP needs a `<picture>` fallback (`<source srcSet="/hero-main.webp" type="image/webp">` + `<img>` for
   old WebViews). If you add a new hero image, add both files and the `<picture>` markup.
3. Never add generated binaries to git; verify with `git status` that only source files changed.
4. `npm run verify:apk-design` guards the APK-specific markup (HeroImg in 10 places, CSS); run it after
   touching screens, `index.html` or `public/`.
