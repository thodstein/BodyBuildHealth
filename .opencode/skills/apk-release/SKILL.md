---
name: APK Release
description: Release an Android APK via GitHub Actions — version bump, tags, keystore/secrets, required checks
---

# APK release (BodyBuildHealth)

## Facts about this environment

- The web app is built by Vite into `dist/`, then Capacitor syncs it into `android/`.
- Locally there is **no** `java`, `gradle` or `ANDROID_HOME` (verified) — an APK can only be built in
  GitHub Actions (`.github/workflows/android-apk.yml`).
- Release APKs are signed only when the keystore secrets exist (see `docs/NATIVE-APP.md` §7). Otherwise the
  workflow produces a debug APK.

## Version rules

- `package.json` `version` is the source of truth for `versionName`.
- `versionCode` = `major*1e6 + minor*1e3 + patch` (so `3.0.6` → `3000006`). Never decrease it.
- `node scripts/apk-version.mjs resolve --event push --ref refs/tags/vX.Y.Z` → tag defines the version.
- `node scripts/apk-version.mjs resolve --event workflow_dispatch --input-version ""` → patch + 1 over
  `package.json` / latest GitHub Release.
- `node scripts/apk-version.mjs apply --version X.Y.Z --code N` rewrites `package.json` and
  `android/app/build.gradle` (both files must stay in sync).

## How to release

1. Run `project_apk_preflight` (tool) — it checks version consistency, APK markers and the workflow guard.
2. Make sure `npm run type-check` and `npm run verify:apk-design` pass.
3. Either push a tag `vX.Y.Z`, or trigger the workflow:
   `gh workflow run android-apk.yml --ref main -f version=X.Y.Z -f publish=true`
4. `publish: true` creates the GitHub Release with APK + OTA (live update) assets, but only for a tag ref
   or `main`; `workflow_dispatch` on a branch that is not `main` cannot publish.
5. Never commit a keystore or secrets; `.gitignore`, `.opencodeignore` and `opencode.json` permissions
   already block editing `.env*`.
