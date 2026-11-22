---
description: APK release preflight and version plan
---

1. Call `project_apk_preflight` (Code Mode: `tools.project.apk_preflight({})`).
2. Load the `apk-release` skill if it is not already loaded.
3. Report: current `package.json` version vs `android/app/build.gradle` `versionName`/`versionCode`,
   APK marker result, workflow guard result, and whether a local build is possible.
4. Propose the next version (patch/minor/major) with the reasoning, then wait for approval before changing
   `package.json` or `android/app/build.gradle`.
5. Explain how to ship: tag `vX.Y.Z` or `gh workflow run android-apk.yml --ref main -f version=X.Y.Z -f publish=true`.

Requested action: $ARGUMENTS
