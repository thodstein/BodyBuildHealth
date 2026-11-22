---
name: UI & APK Design
description: Style screens in src/ui, use the CSS tokens and keep the APK design markers (verify:apk-design) green
---

# UI and APK design

## Where UI code lives

- `src/ui/screens/` — 24 top-level `*Screen.tsx` plus `*_parts/`, `Calculator/`, `combat/`, `strength-sport/`,
  `ProfileScreen_v2/`, `Shared/`; `components/` (20), `cards/` (7), `hooks/` (4),
  `native/` (Capacitor-facing: `NativeFab.tsx`, `NativeOfflinePill.tsx`, `appearance.ts`, `dynamic-color.ts`,
  `useWakeLock.ts`, `nav-badges.ts`), `shared/apple-ui.ts`.
- Styling model: global CSS + CSS custom properties + inline `style={{}}` (≈3k occurrences). There is exactly one
  CSS module in the repo (`components/UnifiedInteractionCard.module.css`) — do not start a CSS-modules migration.

## Tokens

| File                                                                                                           | Used for       | `--accent` |
| -------------------------------------------------------------------------------------------------------------- | -------------- | ---------- |
| `src/styles.css`                                                                                               | web build      | `#00e68a`  |
| `src/styles-native.css` (483 KB, numbered sections up to `115.`)                                               | APK build      | `#c9f73a`  |
| `src/styles-native-pro.css`, `-labs`, `-arm`, `-strongman`, `-support`, `support-design.css`, `arm-design.css` | APK sub-themes | —          |

Always use the CSS variables (`var(--accent)`, …) instead of hex literals; the marker check fails on raw
`#c9f73a` / `#00e68a` outside the `--accent*` declarations.

## `npm run verify:apk-design` (`scripts/check-apk-markers.mjs`, ~149 asserts)

Read the script when touching APK-facing markup; it enforces at least:

1. `<HeroImg` imported **and** used in 10 named screens.
2. These files exist in `public/`: `hero-main.webp`, `training-hero.webp`, `pharma-hero.webp`, `risk-hero.webp`,
   `articles-hero.webp`, `profile-hero.webp`, `nutrition-hero.webp`, `lab-hero.webp`, `bg-profile.webp`
   (see the `asset-sync` skill for regenerating them).
3. Every selector in `styles-native*.css` starts with `html.app-native` — unscoped selectors fail as `UNSCOPED`.
4. No raw accent hex outside `--accent*` lines.
5. `App.tsx` keeps `data-tab`, `data-badge`, `<NativeFab`, `<NativeOfflinePill`; `main.tsx` dynamically imports
   `./styles-native.css` and calls `initApkAppearance()`.
6. Android manifest/res markers (tile service, shortcuts, backup rules, predictive back, locale config,
   `DynamicColorPlugin`, notification channels/drawables) and the `index.html` boot theme key `he_apk_theme_v1`.
7. Native-hostile APIs are banned in APK UI: `<select>`, `<input type="checkbox">`, `window.confirm`,
   `a.download`, `window.open`, `navigator.clipboard.writeText`; cardio/combat tap targets must be ≥ 44 px.
8. Required numbered section comments in `styles-native.css` (`67.` … `115.`), `object-fit: contain`,
   `data-lift="…"` hooks in `TrainingScreen_parts/LiftMasterCard.tsx`, and no U+FFFD mojibake in guarded files.

## Adding or changing an APK screen

1. New CSS goes into `src/styles-native.css` under a **new numbered section comment** and every selector is
   prefixed with `html.app-native`.
2. Hero screens use `<HeroImg>` with a matching `public/*.webp` (add `<picture>` + `<img>` fallback for old WebViews).
3. No native dialogs / downloads / clipboard writes — use the in-app equivalents.
4. Run `npm run verify:apk-design` (fast) and, for TSX changes, `npm run type-check` + `npm run test:ui`.

## Copy

- All user-facing strings are Russian. Plurals: `src/engines/ru-plural.ts` (`ruForm`, `ruCount`, `ruAdjCount`,
  `ruFracCount`, `RU_WEEKS`). Label maps follow `<DOMAIN>_LABEL_RU` (e.g. `BB_PHASE_LABEL_RU` in
  `bb-visual.engine.ts`). Escape/sanitize user text with `src/utils/text-sanitizer.ts`.
- Nav labels are in `App.tsx` (Главная / Тренинг / Питание / Анализы / Риски / Фарма / БАДы); keep that order.
