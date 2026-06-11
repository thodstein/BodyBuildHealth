"""
Compliance & Uncertainty Engine — Python FastAPI Microservice

Tracks lab discipline: if labs are overdue (>4 weeks grace period),
applies a Penalty Multiplier to cumulative organ risk (Data Decay).

Integrated with Hill function + Survival Sigmoid pipeline.

Author: Health Engine v9 — Production
"""

from __future__ import annotations

import math
import logging
from datetime import date, timedelta
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("compliance")

# ═══════════════════════════════════════════════════════════════════════════
# CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════

GRACE_PERIOD_WEEKS = 4.0
PENALTY_RATE_PER_WEEK = 0.15
MAX_PENALTY = 3.0

DISCLAIMER_TEXT = (
    "⚠️ ВНИМАНИЕ: Несоблюдение графика сдачи анализов (раз в 4 недели) "
    "делает расчет рисков некорректным. Расчет вероятности патологий "
    "производится на основании динамики маркеров. В случае несвоевременного "
    "заполнения данных, система переходит в режим 'пессимистичного прогноза' "
    "и риски пересчитываются со штрафным коэффициентом неопределенности."
)

# ═══════════════════════════════════════════════════════════════════════════
# Pydantic Models
# ═══════════════════════════════════════════════════════════════════════════


class Biomarker(BaseModel):
    """Single lab biomarker with EC50 reference."""

    name: str = Field(..., min_length=1, max_length=80)
    value: float = Field(..., ge=0.0)
    ec50: float = Field(..., ge=0.01)
    is_inverted: bool = Field(False, description="Lower value = higher risk (e.g. SHBG, HDL).")


class PatientData(BaseModel):
    """Patient input with cycle dates, genetics, and biomarkers."""

    cycle_start_date: date = Field(..., description="Date when the pharmacological cycle began.")
    latest_lab_date: date = Field(..., description="Date of the most recent blood work.")
    current_date: Optional[date] = Field(None, description="Defaults to today if not provided.")
    genetics: List[str] = Field(default_factory=list, description="Genetic variants, e.g. ['APOL1_mutation'].")
    markers: List[Biomarker] = Field(default_factory=list, description="Lab biomarker values.")
    k_aggression: float = Field(0.4, description="Organ aggression coefficient (for sigmoid).", ge=0.01, le=5.0)
    z_crit: float = Field(12.0, description="Critical Z threshold.", ge=1.0, le=100.0)

    @field_validator("current_date", mode="before")
    @classmethod
    def _default_current(cls, v: Optional[date]) -> date:
        if v is None:
            return date.today()
        return v


# ── Response Models ──


class ComplianceWarning(BaseModel):
    """System warnings about data freshness and penalty application."""

    disclaimer: str
    penalty_status: str
    weeks_on_cycle: float
    weeks_since_last_lab: float
    compliance_status: str  # 'compliant' | 'overdue' | 'critical'


class RiskAnalysis(BaseModel):
    """Risk analysis results with penalty applied."""

    penalty_multiplier_applied: float
    worst_hill_score: float
    severity_95th: float
    z_total_raw: float
    z_total_adjusted: float
    probability_percent: float
    clinical_status: str
    active_19nor_penalty: bool


class ComplianceResponse(BaseModel):
    """Complete response from compliance-aware risk analysis."""

    system_warnings: ComplianceWarning
    risk_analysis: RiskAnalysis
    organ_details: Dict[str, Dict] = Field(default_factory=dict)


# ═══════════════════════════════════════════════════════════════════════════
# CORE ENGINE — Functions
# ═══════════════════════════════════════════════════════════════════════════


def calc_penalty_multiplier(weeks_since_lab: float) -> float:
    """
    Penalty = 1.0 + max(0, weeks_since_lab - 4.0) * 0.15
    Capped at MAX_PENALTY.
    """
    if weeks_since_lab <= GRACE_PERIOD_WEEKS:
        return 1.0
    raw = 1.0 + (weeks_since_lab - GRACE_PERIOD_WEEKS) * PENALTY_RATE_PER_WEEK
    return min(MAX_PENALTY, raw)


def get_compliance_status(weeks_since_lab: float) -> str:
    if weeks_since_lab <= GRACE_PERIOD_WEEKS:
        return "compliant"
    if weeks_since_lab <= 12.0:
        return "overdue"
    return "critical"


def hill_score(value: float, ec50: float, inverted: bool = False) -> float:
    """
    Hill function: H(X) = X² / (EC50² + X²).
    Inverted: H(X) = EC50² / (X² + EC50²) — for markers where lower = risk.
    """
    x2 = value * value
    ec2 = ec50 * ec50
    if inverted:
        return ec2 / (x2 + ec2)
    return x2 / (ec2 + x2)


def survival_sigmoid(z_total: float, k_aggression: float = 0.4, z_crit: float = 12.0) -> float:
    """
    Logistic sigmoid: Risk = 100 / (1 + exp(-k * (Z - Z_crit)))
    Overflow guard: exponent > 50 → 100%, exponent < -50 → 0%.
    """
    exponent = -k_aggression * (z_total - z_crit)

    if exponent > 50.0:
        return 100.0
    if exponent < -50.0:
        return 0.0

    return 100.0 / (1.0 + math.exp(exponent))


def classify_risk(probability: float) -> Dict[str, object]:
    """Translates probability to clinical status and alert level."""
    if probability >= 80.0:
        return {"status": "КРАСНАЯ ЗОНА — Немедленное вмешательство", "alert_level": 3}
    if probability >= 50.0:
        return {"status": "ОРАНЖЕВАЯ ЗОНА — Повышенный риск", "alert_level": 2}
    if probability >= 20.0:
        return {"status": "ЖЁЛТАЯ ЗОНА — Мониторинг", "alert_level": 1}
    return {"status": "ЗЕЛЁНАЯ ЗОНА — Низкий риск", "alert_level": 0}


# ═══════════════════════════════════════════════════════════════════════════
# FastAPI Application
# ═══════════════════════════════════════════════════════════════════════════

app = FastAPI(
    title="MDSS Compliance & Uncertainty Engine",
    description=(
        "Data Decay penalty calculator + Survival Sigmoid risk analysis. "
        "Applies penalty multiplier when labs are overdue (>4 weeks)."
    ),
    version="1.0.0",
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


@app.get("/health", tags=["System"])
async def health() -> Dict[str, str]:
    return {"status": "healthy", "service": "Compliance & Uncertainty Engine v1.0.0"}


@app.get("/", tags=["System"])
async def root() -> Dict[str, str]:
    return {"message": "Compliance & Uncertainty Engine API", "docs": "/docs"}


# ── POST /analyze_with_compliance ──


@app.post("/analyze_with_compliance", response_model=ComplianceResponse, tags=["Analysis"])
async def analyze_with_compliance(payload: PatientData) -> ComplianceResponse:
    """
    Full compliance-aware risk analysis.

    Steps:
      1. Calculate weeks on cycle and weeks since last lab.
      2. Compute penalty multiplier.
      3. Hill scores for all biomarkers → worst marker.
      4. Worst-case 95th percentile (15% noise).
      5. Z_total = severity95 * t_weeks * gen_factor * penalty_multiplier.
      6. Survival sigmoid → risk probability with overflow guard.
      7. Return warnings + analysis.
    """
    logger.info(
        "Analyzing compliance: cycle=%s, last_lab=%s, markers=%d",
        payload.cycle_start_date, payload.latest_lab_date, len(payload.markers),
    )

    # ── Step 1: Date arithmetic ──
    today = payload.current_date or date.today()
    delta_cycle = (today - payload.cycle_start_date).days
    delta_lab = (today - payload.latest_lab_date).days

    weeks_on_cycle = max(0.0, delta_cycle / 7.0)
    weeks_since_lab = max(0.0, delta_lab / 7.0)

    # ── Step 2: Penalty ──
    penalty_mult = calc_penalty_multiplier(weeks_since_lab)
    compliance = get_compliance_status(weeks_since_lab)

    if penalty_mult <= 1.0:
        penalty_status = "✅ Анализы актуальны. Штраф не применяется."
    else:
        days_overdue = int((weeks_since_lab - GRACE_PERIOD_WEEKS) * 7)
        penalty_status = (
            f"[АКТИВНО] Применен штрафной коэффициент: {penalty_mult:.2f}x "
            f"из-за просрочки анализов на {days_overdue} дней."
        )

    system_warnings = ComplianceWarning(
        disclaimer=DISCLAIMER_TEXT,
        penalty_status=penalty_status,
        weeks_on_cycle=round(weeks_on_cycle, 1),
        weeks_since_last_lab=round(weeks_since_lab, 1),
        compliance_status=compliance,
    )

    # ── Step 3: Hill scores — worst marker ──
    worst_hill = 0.0
    if payload.markers:
        for m in payload.markers:
            hs = hill_score(m.value, m.ec50, m.is_inverted)
            if hs > worst_hill:
                worst_hill = hs

    # ── Step 4: Worst-case 95th percentile ──
    severity_95 = worst_hill * 1.15

    # ── Step 5: Genetic factor ──
    gen_factor = 1.0
    # Simple genetic lookup
    genetic_map: Dict[str, float] = {
        "APOL1_mutation": 1.8,
        "ACE_DD": 1.2,
        "UGT2B17_deletion": 2.0,
        "CYP3A4_slow": 1.5,
        "ApoE4": 1.4,
        "ACTN3_RR": 1.3,
        "COMT_slow": 1.7,
        "BDNF_val66met": 1.5,
        "AR_CAG_short": 1.6,
        "SHBG_rs1799941": 1.4,
        "SRD5A2_V89L": 1.3,
    }
    for g in payload.genetics:
        gf = genetic_map.get(g, 1.0)
        if gf > gen_factor:
            gen_factor = gf

    # ── Step 6: Z_total with penalty ──
    z_raw = severity_95 * weeks_on_cycle * gen_factor
    z_adjusted = z_raw * penalty_mult

    # ── Step 7: Sigmoid ──
    probability = survival_sigmoid(z_adjusted, payload.k_aggression, payload.z_crit)
    classification = classify_risk(probability)

    logger.info(
        "Result: penalty=%.2f, z_adjusted=%.1f, probability=%.1f%%, status=%s",
        penalty_mult, z_adjusted, probability, classification["status"],
    )

    risk_analysis = RiskAnalysis(
        penalty_multiplier_applied=round(penalty_mult, 2),
        worst_hill_score=round(worst_hill, 2),
        severity_95th=round(severity_95, 2),
        z_total_raw=round(z_raw, 1),
        z_total_adjusted=round(z_adjusted, 1),
        probability_percent=round(probability, 1),
        clinical_status=str(classification["status"]),
        active_19nor_penalty=any("19nor" in g.lower() for g in payload.genetics),
    )

    return ComplianceResponse(
        system_warnings=system_warnings,
        risk_analysis=risk_analysis,
        organ_details={},
    )


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting Compliance & Uncertainty Engine on :8000")
    uvicorn.run("compliance_service:app", host="0.0.0.0", port=8000, reload=True)
