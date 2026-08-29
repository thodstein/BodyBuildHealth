# Metabolic Hub Pro — Evidence & Formulas

**14 в 1**: Вода · Шаги · КБЖУ · Жир · Stress Load (SLI) · Кровь · EA · Алко · Белок · Поиск · NEAT · AT · Thyroid/HOMA · Lipid/FLI

Канон — `src/engines/metabolic-hub.engine.ts:1`, `src/core/metabolic-constants.ts:1`, UI `src/ui/screens/Shared/MetabolicHub.tsx:1`. Источник истины — профиль `he_profile_v2` + дневник `he_nutrition_v2`.

## Evidence град

- **A** — RCT/meta: Helms/ISSN/Morton/Loucks/Hall (крепко)
- **B** — cohort/DLW: Westerterp/FAO/Hodgdon/JP/Baker/Levine/Trexler/Kim/Wallace (умеренно)
- **C** — observational: Suter alcohol (иллюстративно)
- **E** — эвристика: SLI/AAS (не peer-reviewed, помечено ⚠️)

DLW band ±12% Westerterp 1999 показан во всех TDEE.

## Формулы

### BMR — 7 формул + выбор
- Mifflin-St Jeor 1990 (A): `10W+6.25H-5A+5/-161`
- Cunningham 1991 `500+22×LBM` для LBM≥60 (ошибка <4%)
- Katch-McArdle `370+21.6×LBM`
- Owen 1986 для BMI≥30
- Ten Haaf 2014 для 18-35 атлетов
- Harris-Benedict R 1984 Roza-Shizgal — классика сравнения
- Henry Oxford 2005 (FAO/WHO замена Schofield) — вес-доминант и weight+height (HenryFull)
- Livingston 2005 — BMI-зависим, Frankfield 2015 лучший при BMI>35

Выбор `computeBMR:42` → с BF: Cunningham/Katch, без BF: Deurenberg lean (не фикс 15/22% — ошибка 13%), FFMI cap 26.2 Helms 2023 (Kouri 25 устарел), саркопения непрерывно `-0.0015/год после 50` Pontzer 2021.

### TEF — Westerterp 2004
`P 25% C 7% F 3% Alc 15% Suter 1992` — PAL FAO уже включает ~10%, TEF в хабе информативен (BEE=BMR+TEF, TEE=BMR×PAL).

### PAL — FAO 2001 + Levine 2002
`low 1.40 medium 1.55 high 1.75 very_high 1.95` + `trainAdd 0.040/нед MET`, `cardioAdd 0.030/ч`, `very_high` для 2×/д. Дедуп `palTrainingAdd/palCardioAdd`. DLW band ±12%.

### Вода — EFSA 2010 + IOM 2004 + Baker 2017
`IOM 35/33/30 мл/кг (M/F/>60)` база, lean×40/fat×20 — экспериментальная справка. Baker полный панель: Na 900мг/л средн., Cl×1.5, K 180мг/л, Mg 12мг/л на литр пота. Климат Sawka нелинейно.

### Жир — Hodgdon 1984 Navy (дюймы) + FFMI Kouri/Helms
`Navy ±3.5%`, `FFMI_norm +6.1×(1.80-H)`, лимит 26.2. JP3/7 ±3% Siri, Durnin-Womersley ±4% 4-site, BIA Kyle 2004 400-900 Ом. Deurenberg `1.2×BMI+0.23×age-10.8×sex-5.4` завышает у BMI>27 — помечено.

### Stress Load Index (бывш. HPA) — E
`50+(stress-5)×4.5+(7-sleep)×5.5+(3-sleepQ)×4+(acwr-1.15)×28 + кофеин/алко/TSH` — веса invented, шкала 0-100 invented, дисклеймер E. Для диагноза — PSS-10+PSQI+слюна 4 точки Clow 2004. AAS EXP −14% Heber 1985.

### Кровь — ESC 2023 / ASA
Зоны `<48 норма 48-51 внимание 51-54 донация >54 стоп >60 критично`, вода +300/500/750, железо ZERO >51, `hgb≈hct×3.4` (MCHC).

### EA — Loucks 2007 / IOC 2014 / Mountjoy 2018
`(EI-EEE)/FFM`, `EEE net = gross×0.85` (вычет RMR во время упр.), `F LEA <30 M <25`, `F optimal ≥45 M ≥40`.

### Алко — Atwater 7.1 + Suter 1992
`TEF 15%`, блок жира `illustration 22/45/73%` ступенями + `exact g×1.2%` линейно (Suter Fig2).

### Белок — Morton 2018 / Schoenfeld-Aragon 2018 / Res 2012
`2.5г leuc`, `0.40г/кг/прием ×4`, ceiling `0.55г/кг waste`, `DIAAS 0.11 whey vs 0.07 plant`, `pre-sleep 35г казеин +0.22кг LBM`.

### Maintenance — Hall 2011
Плотность `p×9400+(1-p)×1800` Forbes `p via BF` (7700 фикс ошибка 45% у сухих), `AT Trexler −80-120ккал` при >3нед дефицита, `adapt exp(-t/90)` непрерывно, DLW band. Goal `Hall+AT` days=|totalKcal|/500×1/adapt.

### NEAT — Levine 1999/2002
`+40ккал/ч стоя, fidget +90/−40, ходьба steps×0.04×W/70`.

### Thyroid — Kim 2014, HOMA — Wallace 2004
`FT4 17 средн. +2.2%/pmol`, `TSH>4.5 ×0.95`, HOMA `<1.4 optimal 1.4-2.5 attention ≥2.5 IR` → угли ≤3г/кг.

### Lipid — Mensink 2003, FLI — Bedogni 2006
`SFA 10г +12 LDL / fiber 10г −5`, `FLI logit 0.953×lnTG+0.139×BMI+0.718×lnGGT+0.053×waist → <30 нет стеатоза >60 стеатоз`. PSMF Blackburn EA<15, menstrual Benton +1.2кг лютеин.

## AAS
Все `aasMult` EXP ⚠️: вода +12%, TDEE +8%, КБЖУ +10%, SLI −14%, FFMI +1.8 Bhasin 600мг → +2кг воды ~3% (не +12%). Точнее через +FFM Cunningham.

## Тесты
`metabolic-hub.test.ts:1` 68 тестов, `nutrition-v2-audit` 4, `tSC` свои 0.
