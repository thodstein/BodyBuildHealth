"""
MDSS Advanced Diagnostics — 5-Engine Microservice (Python FastAPI + NumPy)

Production-ready monolith implementing:
  1. PK/PD Engine — concentration accumulation, half-life simulation
  2. Interaction Engine — receptor-level drug-drug conflict detection
  3. Vitals Engine — daily telemetry alert analysis (HRV, RHR, BP)
  4. BioAge Engine — phenotypic aging from toxic load + vitals
  5. PCT & HPTA Reboot Engine — PCT start day + reboot probability

All 5 engines are invoked sequentially by POST /advanced_diagnostics.

Author: Health Engine v9 — Production
"""

from __future__ import annotations

import math
import logging
from typing import Dict, List, Optional, Tuple

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator, model_validator

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("advanced_diagnostics")

# ═══════════════════════════════════════════════════════════════════════════
# CONSTANTS — Pharmacological Knowledge Base
# ═══════════════════════════════════════════════════════════════════════════

# Half-life in DAYS (not hours) per ester type
ESTER_HALF_LIFE_DAYS: Dict[str, float] = {
    "propionate": 0.8,
    "acetate": 1.0,
    "enanthate": 4.5,
    "cypionate": 5.0,
    "decanoate": 7.5,
    "undecanoate": 21.0,
    "oral": 0.3,
    "phenylpropionate": 1.5,   # NPP
    "hexahydrobenzylcarbonate": 6.0,  # Parabolan
}

# Receptor-level drug-drug interaction rules
INTERACTION_RULES: List[Dict] = [
    {
        "drugs": ["boldenone", "primobolan"],
        "severity": "critical",
        "message": (
            "КРИТИЧЕСКИЙ РИСК: Обвал Эстрадиола (E2) до нуля. "
            "Болденон + Примоболан не ароматизируются → нулевой E2 → "
            "риск остеопороза, нейротоксичности, депрессии, разрушения суставов."
        ),
        "mechanism": "Двойная блокада ароматазы: оба препарата — non-aromatizable DHT-производные. "
                     "E2 необходим для нейропротекции (BDNF↑), костного ремоделирования (остеобласты), "
                     "либидо (дофаминовый тонус), суставной смазки (синовиальная жидкость).",
    },
    {
        "drugs": ["boldenone", "masteron"],
        "severity": "critical",
        "message": (
            "КРИТИЧЕСКИЙ РИСК: Обвал Эстрадиола (E2) до нуля. "
            "Болденон (не ароматизируется) + Мастерон (анти-эстроген через SHBG↓) → "
            "критически низкий E2."
        ),
        "mechanism": "Болденон = 0% ароматизации. Мастерон = конкурент AR + SHBG↓ → свободный E2↑ "
                     "но затем быстрый клиренс. Нетто-эффект: E2 < 5 пг/мл.",
    },
    {
        "drugs": ["nandrolone", "finasteride"],
        "severity": "critical",
        "message": (
            "КРИТИЧЕСКИЙ РИСК: Блокада 5-AR оставляет активный нандролон вместо слабого ДГН. "
            "Риск тотальной эректильной дисфункции (Deca-Dick)."
        ),
        "mechanism": "5α-редуктаза (SRD5A2) конвертирует нандролон → ДГН (DHN) — слабый андроген. "
                     "Финастерид блокирует SRD5A2 → нандролон остаётся в неизменённом виде → "
                     "сильная AR-активация гипофиза → подавление ЛГ + прогестогеновый эффект → "
                     "ПРЛ↑, либидо↓, ЭД.",
    },
    {
        "drugs": ["nandrolone", "dutasteride"],
        "severity": "critical",
        "message": (
            "КРИТИЧЕСКИЙ РИСК: Дутастерид блокирует оба изофермента 5-AR (тип I + II). "
            "Нандролон не метаболизируется в ДГН. Риск Deca-Dick 80%+."
        ),
        "mechanism": "Дутастерид = неселективный ингибитор SRD5A1 + SRD5A2. "
                     "Полная блокада конверсии нандролон→ДГН.",
    },
    {
        "drugs": ["trenbolone", "clenbuterol"],
        "severity": "critical",
        "message": (
            "КРИТИЧЕСКИЙ РИСК: Перегорание парасимпатической ЦНС и кардиотоксичность. "
            "Тренболон (GABA_A-антагонист) + Кленбутерол (β2-агонист) → "
            "симпатический овердрайв, тахикардия, апоптоз кардиомиоцитов."
        ),
        "mechanism": "Тренболон → GABA_A-антагонизм → CNS excitation → тревожность, бессонница. "
                     "Кленбутерол → β2-AR → cAMP↑ → Ca²⁺ перегрузка кардиомиоцитов → "
                     "некроз/апоптоз миокарда. Синергия: оба ↑ ЧСС + ↑ потребность O₂ миокарда.",
    },
]

# 19-nor substances (used for PCT probability adjustment)
NINETEEN_NOR_DRUGS: List[str] = ["trenbolone", "nandrolone", "trestolone"]

# ---------------------------------------------------------------------------
# Pydantic I/O Models
# ---------------------------------------------------------------------------


class DrugDose(BaseModel):
    """Single drug entry with ester and dosing schedule."""

    name: str = Field(..., description="Drug name in lowercase.", min_length=1, max_length=80)
    ester: str = Field(..., description="Ester type: enanthate, propionate, oral, etc.", min_length=1, max_length=40)
    mg_per_week: float = Field(..., description="Total weekly dose in mg.", ge=0.0)
    injections_per_week: int = Field(..., description="Number of injections per week.", ge=1, le=14)

    @field_validator("name")
    @classmethod
    def _lowercase_name(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("ester")
    @classmethod
    def _lowercase_ester(cls, v: str) -> str:
        return v.strip().lower()


class VitalsManual(BaseModel):
    """Morning vitals — user-provided telemetry."""

    hrv: float = Field(..., description="Heart Rate Variability (ms). Normal: 50-100.", ge=1.0, le=300.0)
    rhr: float = Field(..., description="Resting Heart Rate (bpm). Normal: 50-75.", ge=20.0, le=200.0)
    bp_sys: float = Field(..., description="Systolic BP (mmHg). Normal: 100-130.", ge=60.0, le=250.0)
    bp_dia: float = Field(..., description="Diastolic BP (mmHg). Normal: 60-85.", ge=30.0, le=150.0)


class PatientData(BaseModel):
    """Complete patient input for advanced diagnostics."""

    age_chronological: float = Field(..., description="Chronological age in years.", ge=15.0, le=100.0)
    drugs: List[DrugDose] = Field(default_factory=list, description="Current pharmacological stack.")
    vitals: VitalsManual = Field(
        default_factory=lambda: VitalsManual(hrv=50.0, rhr=65.0, bp_sys=120.0, bp_dia=80.0),
        description="Daily morning vitals.",
    )
    has_19nor_in_history: bool = Field(False, description="Whether 19-nor androgens were used in the past 6 months.")


# ── Response Models ──

class PKPDOutput(BaseModel):
    """Per-drug PK/PD analysis result."""

    drug_name: str
    ester: str
    half_life_days: float
    elimination_rate: float
    peak_conc_mg: float
    trough_conc_mg: float
    peak_trough_delta_pct: float
    hormonal_swing_flag: bool
    daily_profile: List[float]  # mg/day for first 30 days


class InteractionOutput(BaseModel):
    """Single drug-drug interaction alert."""

    severity: str
    drugs_involved: List[str]
    message: str
    mechanism: str


class VitalsOutput(BaseModel):
    """Vitals analysis with alerts."""

    hrv: float
    rhr: float
    bp_sys: float
    bp_dia: float
    alerts: List[str]


class BioAgeOutput(BaseModel):
    """Biological age computation."""

    chronological_age: float
    biological_age: float
    age_acceleration: float
    bp_penalty: float
    hrv_penalty: float
    toxic_load_penalty: float
    aging_rate: str


class PCTRebootOutput(BaseModel):
    """PCT timing and success probability."""

    pct_start_day: int
    longest_half_life_drug: str
    longest_half_life_days: float
    levels_at_pct_start: float
    has_19nor: bool
    reboot_success_probability: float  # 0-100
    recommendation: str


class AdvancedDiagnosticsResponse(BaseModel):
    """Aggregated response from all 5 engines."""

    pkpd: List[PKPDOutput]
    interactions: List[InteractionOutput]
    vitals: VitalsOutput
    bioage: BioAgeOutput
    pct_reboot: PCTRebootOutput
    summary: str  # Human-readable overall assessment


# ═══════════════════════════════════════════════════════════════════════════
# ENGINE 1: PK/PD — Concentration Simulation
# ═══════════════════════════════════════════════════════════════════════════


def compute_pkpd(drugs: List[DrugDose]) -> List[PKPDOutput]:
    """
    Simulates 30-day concentration profile for each drug.

    Formula: C_t = C_0 * exp(-k * t), where k = ln(2) / T1/2.
    Peak/trough delta > 40% → hormonal swing flag.
    """
    results: List[PKPDOutput] = []

    for drug in drugs:
        # Determine half-life
        t_half = ESTER_HALF_LIFE_DAYS.get(drug.ester)
        if t_half is None:
            # Fallback: estimate from injection frequency
            t_half = 7.0 / drug.injections_per_week
            logger.warning(
                "Unknown ester '%s' for '%s', using estimated half-life %.1f days.",
                drug.ester, drug.name, t_half,
            )

        k = math.log(2) / max(t_half, 0.01)  # elimination rate per day
        dose_per_injection = drug.mg_per_week / max(drug.injections_per_week, 1)
        interval_days = 7.0 / drug.injections_per_week

        # Simulate 30 days
        daily_profile: List[float] = [0.0] * 30
        current_conc = 0.0

        for day in range(30):
            current_conc *= math.exp(-k * 1.0)  # decay over 1 day
            if day % max(1, int(interval_days)) == 0:
                current_conc += dose_per_injection
            daily_profile[day] = round(current_conc, 2)

        # Peak and trough from last steady-state cycle
        peak_conc = max(daily_profile[-14:]) if len(daily_profile) >= 14 else max(daily_profile)
        trough_conc = min(daily_profile[-14:]) if len(daily_profile) >= 14 else min(daily_profile)

        delta_pct = ((peak_conc - trough_conc) / max(peak_conc, 0.01)) * 100.0
        hormonal_swing = delta_pct > 40.0

        if hormonal_swing:
            logger.info(
                "Hormonal swing detected for %s (%s): peak=%.1f, trough=%.1f, delta=%.1f%%",
                drug.name, drug.ester, peak_conc, trough_conc, delta_pct,
            )

        results.append(PKPDOutput(
            drug_name=drug.name,
            ester=drug.ester,
            half_life_days=round(t_half, 2),
            elimination_rate=round(k, 4),
            peak_conc_mg=round(peak_conc, 2),
            trough_conc_mg=round(trough_conc, 2),
            peak_trough_delta_pct=round(delta_pct, 1),
            hormonal_swing_flag=hormonal_swing,
            daily_profile=daily_profile,
        ))

    return results


# ═══════════════════════════════════════════════════════════════════════════
# ENGINE 2: Interactions — Drug-Drug Conflict Detection
# ═══════════════════════════════════════════════════════════════════════════


def compute_interactions(drug_names: List[str]) -> List[InteractionOutput]:
    """Checks all drug pairs against INTERACTION_RULES."""
    results: List[InteractionOutput] = []
    lower_names = [n.lower().strip() for n in drug_names]
    seen_pairs: set = set()

    for rule in INTERACTION_RULES:
        rule_drugs = [d.lower().strip() for d in rule["drugs"]]
        # Check both orderings
        for i, d1 in enumerate(rule_drugs):
            for d2 in rule_drugs[i + 1:]:
                if d1 in lower_names and d2 in lower_names:
                    pair_key = f"{d1}+{d2}"
                    if pair_key in seen_pairs:
                        continue
                    seen_pairs.add(pair_key)
                    results.append(InteractionOutput(
                        severity=rule["severity"],
                        drugs_involved=[d1, d2],
                        message=rule["message"],
                        mechanism=rule["mechanism"],
                    ))

    return results


# ═══════════════════════════════════════════════════════════════════════════
# ENGINE 3: Vitals — Telemetry Analysis
# ═══════════════════════════════════════════════════════════════════════════


def compute_vitals(v: VitalsManual) -> VitalsOutput:
    """Analyzes morning vitals and generates alerts."""
    alerts: List[str] = []

    if v.hrv < 35.0:
        alerts.append(
            "ВНИМАНИЕ: Истощение ЦНС (Симпатический овердрайв). "
            f"HRV = {v.hrv:.0f} мс < 35 мс. "
            "Рекомендация: делоад-неделя, магний 400 мг, мелатонин 3-5 мг, дыхательные практики."
        )
    if v.rhr > 75.0:
        alerts.append(
            "ВНИМАНИЕ: Перегрузка миокарда или гиперволемия. "
            f"RHR = {v.rhr:.0f} уд/мин > 75. "
            "Рекомендация: проверка гематокрита (HCT), флеботомия при HCT > 52%, гидратация 3-4 л/день."
        )
    if v.bp_sys > 140.0 or v.bp_dia > 90.0:
        alerts.append(
            "ВНИМАНИЕ: Гипертензия. Риск нефропатии и ГЛЖ (гипертрофия левого желудочка). "
            f"АД = {v.bp_sys:.0f}/{v.bp_dia:.0f}. "
            "Рекомендация: телмисартан 40-80 мг, ограничение натрия до 2 г/день, кардио 3×/нед."
        )

    return VitalsOutput(
        hrv=v.hrv,
        rhr=v.rhr,
        bp_sys=v.bp_sys,
        bp_dia=v.bp_dia,
        alerts=alerts,
    )


# ═══════════════════════════════════════════════════════════════════════════
# ENGINE 4: BioAge — Phenotypic Aging Calculator
# ═══════════════════════════════════════════════════════════════════════════


def compute_bioage(
    chronological_age: float,
    vitals: VitalsManual,
    total_weekly_mg: float,
) -> BioAgeOutput:
    """
    Converts toxic load + vitals into biological age acceleration.

    Formula:
      BioAge = ChronologicalAge + BP_penalty + HRV_penalty + Toxic_Load

    Where:
      BP_penalty  = (bp_sys - 120) * 0.15  (if bp_sys > 120)
      HRV_penalty = (60 - hrv) * 0.2       (if hrv < 60)
      Toxic_Load  = total_weekly_mg / 200

    Every 200 mg/week of AAS adds ~1 year of accelerated aging.
    """
    bp_penalty = max(0.0, (vitals.bp_sys - 120.0) * 0.15)
    hrv_penalty = max(0.0, (60.0 - vitals.hrv) * 0.2)
    toxic_penalty = total_weekly_mg / 200.0

    bio_age = chronological_age + bp_penalty + hrv_penalty + toxic_penalty
    age_acceleration = bio_age - chronological_age

    rate_per_year = 1.0 + max(0.0, age_acceleration)
    aging_rate = f"Вы стареете на {rate_per_year:.2f} лет за календарный год."

    logger.info(
        "BioAge: chronological=%.1f, biological=%.1f, acceleration=%.1f, "
        "BP_penalty=%.2f, HRV_penalty=%.2f, Toxic=%.2f",
        chronological_age, bio_age, age_acceleration,
        bp_penalty, hrv_penalty, toxic_penalty,
    )

    return BioAgeOutput(
        chronological_age=round(chronological_age, 1),
        biological_age=round(bio_age, 2),
        age_acceleration=round(age_acceleration, 2),
        bp_penalty=round(bp_penalty, 2),
        hrv_penalty=round(hrv_penalty, 2),
        toxic_load_penalty=round(toxic_penalty, 2),
        aging_rate=aging_rate,
    )


# ═══════════════════════════════════════════════════════════════════════════
# ENGINE 5: PCT & HPTA Reboot — Timing + Success Probability
# ═══════════════════════════════════════════════════════════════════════════


def compute_pct_reboot(
    drugs: List[DrugDose],
    has_19nor_history: bool,
) -> PCTRebootOutput:
    """
    Computes PCT start day and reboot success probability.

    Algorithm:
      1. Find the drug with the longest ester half-life in the stack.
      2. Simulate its elimination from the last injection until
         total active concentration drops below 2.0 mg.
      3. PCT start day = number of days until < 2.0 mg threshold.
      4. Success probability: base 85%, -25% per 19-nor, -10% if >10 weeks.
    """
    if not drugs:
        return PCTRebootOutput(
            pct_start_day=0,
            longest_half_life_drug="none",
            longest_half_life_days=0.0,
            levels_at_pct_start=0.0,
            has_19nor=has_19nor_history,
            reboot_success_probability=100.0 if not has_19nor_history else 60.0,
            recommendation="Нет активных препаратов. ПКТ не требуется.",
        )

    # Find drug with longest half-life
    longest_drug = None
    longest_th = 0.0

    for drug in drugs:
        th = ESTER_HALF_LIFE_DAYS.get(drug.ester, 7.0)
        if th > longest_th:
            longest_th = th
            longest_drug = drug

    if longest_drug is None:
        return PCTRebootOutput(
            pct_start_day=14,
            longest_half_life_drug="unknown",
            longest_half_life_days=7.0,
            levels_at_pct_start=1.0,
            has_19nor=has_19nor_history,
            reboot_success_probability=70.0,
            recommendation="Стандартный протокол ПКТ: начните через 14 дней.",
        )

    # Simulate elimination from last injection
    # Total systemic load: sum of all drugs' residual concentrations
    k = math.log(2) / max(longest_th, 0.01)
    dose_per_injection = longest_drug.mg_per_week / max(longest_drug.injections_per_week, 1)

    # Initial concentration after last injection (estimate)
    # Using steady-state approximation
    interval_days = 7.0 / max(longest_drug.injections_per_week, 1)
    acc_factor = 1.0 / (1.0 - math.exp(-k * interval_days))
    initial_conc = dose_per_injection * acc_factor

    # Day-by-day until < 2.0 mg
    current = initial_conc
    pct_day = 0
    for day in range(1, 90):
        current = initial_conc * math.exp(-k * day)
        if current < 2.0:
            pct_day = day
            break
    else:
        pct_day = 90

    # Zero-day check
    if pct_day == 0:
        # Already under threshold — start PCT immediately
        # But wait at least 3 days after last injection
        pct_day = max(3, int(3.0 * longest_th))

    levels_at_start = round(current, 2)

    # Success probability
    # Check 19-nor presence in current stack
    has_19nor_now = any(d.name.lower().strip() in NINETEEN_NOR_DRUGS for d in drugs)
    effective_19nor = has_19nor_now or has_19nor_history

    # Calculate longest continuous exposure weeks (simplified: use half-life as proxy)
    base_prob = 85.0
    if effective_19nor:
        base_prob -= 40.0  # 19-nor penalty
    if longest_th > 10.0:
        base_prob -= 15.0  # long ester penalty

    prob = max(5.0, min(100.0, base_prob))

    # Recommendation
    rec = (
        f"Начать ПКТ на {pct_day}-й день после последней инъекции. "
    )
    if effective_19nor:
        rec += (
            f"ОБНАРУЖЕН 19-nor (нандролон/тренболон) — метаболиты сохраняются до 18 месяцев. "
            f"Вероятность успешного ребута HPTA снижена ({prob:.0f}%). "
            f"Расширенный протокол: Кломифен 50/25/25 + Тамоксифен 20/10 + ХГЧ 500 МЕ 2×/нед × 3 нед до ПКТ."
        )
    else:
        rec += (
            f"Стандартный протокол ПКТ: Кломифен 50/25/25/12.5 мг × 4 нед + Тамоксифен 20/10 мг × 4 нед."
        )

    return PCTRebootOutput(
        pct_start_day=pct_day,
        longest_half_life_drug=longest_drug.name,
        longest_half_life_days=round(longest_th, 1),
        levels_at_pct_start=levels_at_start,
        has_19nor=effective_19nor,
        reboot_success_probability=round(prob, 1),
        recommendation=rec,
    )


# ---------------------------------------------------------------------------
# FastAPI Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="MDSS Advanced Diagnostics — 5-Engine Analytical Microservice",
    description=(
        "Production-ready analytics pipeline: "
        "PK/PD simulation, Drug-Drug Interactions, Vitals telemetry, "
        "BioAge calculator, PCT & HPTA Reboot timer. "
        "All 5 engines invoked via POST /advanced_diagnostics."
    ),
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ──


@app.get("/health", tags=["System"])
async def health() -> Dict[str, str]:
    return {
        "status": "healthy",
        "service": "MDSS Advanced Diagnostics v2.0.0",
        "engines": "5",
    }


@app.get("/", tags=["System"])
async def root() -> Dict[str, str]:
    return {"message": "MDSS Advanced Diagnostics API", "docs": "/docs", "health": "/health"}


# ── Super-Endpoint: POST /advanced_diagnostics ──


@app.post("/advanced_diagnostics", response_model=AdvancedDiagnosticsResponse, tags=["Diagnostics"])
async def advanced_diagnostics(payload: PatientData) -> AdvancedDiagnosticsResponse:
    """
    Invokes all 5 engines sequentially and returns a unified report.

    Input: PatientData (age, drug stack, vitals, 19-nor history).
    Output: PK/PD profiles, interaction alerts, vitals analysis,
            BioAge computation, PCT reboot plan.
    """
    logger.info("Processing advanced diagnostics: %d drug(s), age %.0f.", len(payload.drugs), payload.age_chronological)

    # ── Engine 1: PK/PD ──
    pkpd_results = compute_pkpd(payload.drugs)

    # ── Engine 2: Interactions ──
    drug_names = [d.name for d in payload.drugs]
    interaction_results = compute_interactions(drug_names)

    # ── Engine 3: Vitals ──
    vitals_results = compute_vitals(payload.vitals)

    # ── Engine 4: BioAge ──
    total_mg = sum(d.mg_per_week for d in payload.drugs)
    bioage_results = compute_bioage(payload.age_chronological, payload.vitals, total_mg)

    # ── Engine 5: PCT Reboot ──
    pct_results = compute_pct_reboot(payload.drugs, payload.has_19nor_in_history)

    # ── Summary ──
    summary_parts: List[str] = []

    swing_flags = [r for r in pkpd_results if r.hormonal_swing_flag]
    if swing_flags:
        summary_parts.append(
            f"⚠ Гормональные качели: {len(swing_flags)} препарат(ов) с дельтой >40% — "
            f"{', '.join(r.drug_name for r in swing_flags)}."
        )

    if interaction_results:
        crit = [i for i in interaction_results if i.severity == "critical"]
        if crit:
            summary_parts.append(
                f"🔴 {len(crit)} критических межлекарственных конфликта: "
                f"{', '.join('+'.join(i.drugs_involved) for i in crit)}."
            )

    if vitals_results.alerts:
        summary_parts.append(f"🟡 {len(vitals_results.alerts)} предупреждений по витальным показателям.")

    if bioage_results.age_acceleration > 2.0:
        summary_parts.append(
            f"⏳ Ускоренное старение: +{bioage_results.age_acceleration:.1f} лет к биологическому возрасту."
        )

    if pct_results.has_19nor:
        summary_parts.append(
            f"💊 19-nor в анамнезе — вероятность ребута HPTA: {pct_results.reboot_success_probability:.0f}%."
        )

    summary = "; ".join(summary_parts) if summary_parts else (
        "✅ Все показатели в пределах нормы. Продолжайте мониторинг."
    )

    return AdvancedDiagnosticsResponse(
        pkpd=pkpd_results,
        interactions=interaction_results,
        vitals=vitals_results,
        bioage=bioage_results,
        pct_reboot=pct_results,
        summary=summary,
    )


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting MDSS Advanced Diagnostics on :8000")
    uvicorn.run("advanced_diagnostics:app", host="0.0.0.0", port=8000, reload=True)
