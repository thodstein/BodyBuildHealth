---
description: Запустить production quality gates BodyBuildHealth
---

Инструменты namespace `quality`:

- `quality.domain_guards` — pharma/lab/FOOD_DB/exercise/training invariants
- `quality.medical_safety` — sources, disclaimer, red flags, опасные инструкции
- `quality.ocr_benchmark` — nutrition/labs OCR fixtures (`domain: nutrition|labs|all`)
- `quality.security_privacy` — secrets, PII/medical logs, CORS, client credentials
- `quality.release_gate` — web/APK release checks
- `quality.diff_scope` — workstream scope против git diff
- `quality.training_quality` — силовые движки и tests
- `quality.performance_profiler` — type-check/build timing
- `quality.data_import_audit` — encoding, silent catches, import fixtures
- `quality.visual_regression` — APK markers, CSS tokens/scoping, native-hostile APIs

Не объявляй production-ready по одному PASS: медицинские факты требуют evidence/repo audit, pixel-level UI — ручной
или browser screenshot review.
