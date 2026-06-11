"""
MDSS — Medical Decision Support System v1.0
FastAPI + NumPy microservice for organ failure prediction
Hill → Monte Carlo → Logistic Sigmoid pipeline

Run: uvicorn main:app --host 0.0.0.0 --port 8000
"""

from typing import List, Optional, Dict
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="MDSS API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── CLINICAL DATABASE ───
CLINICAL_DB: Dict = {
    "renal_fsgs": {
        "name": "Фокальный сегментарный гломерулосклероз (Почки)",
        "linked_markers": ["KIM-1", "Cystatin_C", "Nephrin", "UACR", "Creatinine"],
        "k_aggression": 0.4, "z_crit": 12.0,
        "genetics": {"APOL1_mutation": 1.8, "ACE_DD": 1.2}
    },
    "hepatic_cholestasis": {
        "name": "Токсический гепатит и Холестаз (Печень)",
        "linked_markers": ["CK-18", "GLDH", "GGT", "Bile_Acids", "ALT", "AST"],
        "k_aggression": 0.6, "z_crit": 6.0,
        "genetics": {"UGT2B17_deletion": 2.0, "CYP3A4_slow": 1.5}
    },
    "cardiac_fibrosis": {
        "name": "Фиброз миокарда и ГЛЖ (Сердце)",
        "linked_markers": ["Galectin-3", "NT-proBNP", "ADMA", "oxLDL", "hs-CRP"],
        "k_aggression": 0.2, "z_crit": 24.0,
        "genetics": {"ApoE4": 1.4, "MTHFR_mutation": 1.3}
    },
    "cns_neurotoxicity": {
        "name": "Токсическая энцефалопатия (ЦНС)",
        "linked_markers": ["Cortisol_night", "HVA", "Prolactin"],
        "k_aggression": 0.5, "z_crit": 8.0,
        "genetics": {"COMT_slow": 1.7, "MAOA_mutation": 1.5}
    },
    "hpta_suppression": {
        "name": "Тотальная супрессия Оси HPTA (Эндокринная система)",
        "linked_markers": ["Inhibin_B", "SHBG", "LH", "FSH"],
        "k_aggression": 0.3, "z_crit": 10.0,
        "genetics": {"AR_CAG_short": 1.3}
    },
    "prostate_hyperplasia": {
        "name": "Гиперплазия предстательной железы",
        "linked_markers": ["PSA", "DHT"],
        "k_aggression": 0.15, "z_crit": 30.0,
        "genetics": {"AR_CAG_short": 1.6}
    }
}

# ─── PYDANTIC MODELS ───
class Biomarker(BaseModel):
    name: str = Field(..., description="Marker identifier (e.g. ALT, KIM-1)")
    value: float = Field(..., description="Measured lab value")
    ec50: float = Field(..., description="EC50 reference value")
    is_inverted: bool = Field(default=False, description="True if lower values = higher risk")

class PatientInput(BaseModel):
    t_weeks: float = Field(..., ge=0, description="Weeks of pharmacological exposure")
    genetics: List[str] = Field(default=[], description="List of detected genetic mutations")
    markers: List[Biomarker] = Field(..., description="All submitted lab biomarkers")

class OrganReport(BaseModel):
    organ_name: str
    markers_used: List[str]
    hill_score: float
    severity_95: float
    z_total: float
    risk_percentage: float
    status: str
    alert_level: int
    genetic_factor: float

class MDSSResponse(BaseModel):
    patient_exposure_weeks: float
    organ_systems_report: Dict[str, OrganReport]
    overall_max_risk: float
    overall_alert_level: int

# ─── STEP 1: Hill Function ───
def hill_score(x: float, ec50: float, is_inverted: bool) -> float:
    """Compute Hill equation: (X^n) / (EC50^n + X^n) or inverted."""
    if x <= 0 or ec50 <= 0:
        return 0.0
    n = 2.0
    xn = x ** n
    ec50n = ec50 ** n
    if is_inverted:
        return ec50n / (ec50n + xn)
    return xn / (ec50n + xn)

# ─── STEP 2: Monte Carlo ───
def monte_carlo_95(hill_val: float, iterations: int = 10000) -> float:
    """Run 10,000 simulations with 15% normal noise, return 95th percentile."""
    if hill_val <= 0:
        return 0.0
    noise = np.random.normal(0, 0.15, iterations)
    simulations = hill_val + noise
    simulations = np.clip(simulations, 0.0, 1.2)
    return float(np.percentile(simulations, 95))

# ─── STEP 3: Logistic Sigmoid ───
def logistic_risk(z_total: float, k_aggression: float, z_crit: float) -> float:
    """Sigmoid survival function: 100 / (1 + exp(-k * (Z - Z_crit))). With overflow guard."""
    arg = -k_aggression * (z_total - z_crit)
    if arg > 50:
        return 0.0
    if arg < -50:
        return 100.0
    return 100.0 / (1.0 + np.exp(arg))

# ─── RISK STRATIFICATION ───
def stratify(risk_pct: float) -> tuple:
    """Return (status_string, alert_level)."""
    if risk_pct < 20:
        return ("ЗЕЛЕНАЯ ЗОНА (Безопасно)", 0)
    elif risk_pct < 50:
        return ("ЖЕЛТАЯ ЗОНА (Субкомпенсация)", 1)
    elif risk_pct < 80:
        return ("ОРАНЖЕВАЯ ЗОНА (Начало разрушения)", 2)
    return ("КРАСНАЯ ЗОНА (Критический порог. Необходима отмена!)", 3)

# ─── GENETIC FACTOR ───
def calc_genetic_factor(organ_key: str, patient_genetics: List[str]) -> float:
    """Multiply genetic risk factors from patient mutations."""
    config = CLINICAL_DB.get(organ_key, {})
    genetics = config.get("genetics", {})
    factor = 1.0
    for gene in patient_genetics:
        if gene in genetics:
            factor *= genetics[gene]
    return factor

# ─── MAIN PIPELINE ───
def analyze_patient(input_data: PatientInput) -> MDSSResponse:
    """Run full MDSS pipeline: Hill → Monte Carlo → Logistic Sigmoid."""
    t_weeks = max(0.0, input_data.t_weeks)
    report: Dict[str, OrganReport] = {}
    overall_max_risk = 0.0
    overall_alert = 0

    for organ_key, config in CLINICAL_DB.items():
        # Find markers matching this organ system
        matched = [m for m in input_data.markers if m.name in config["linked_markers"]]
        if not matched:
            continue

        # Step 1: Hill — max of all markers (weakest link)
        max_hill = 0.0
        for m in matched:
            hs = hill_score(m.value, m.ec50, m.is_inverted)
            if hs > max_hill:
                max_hill = hs

        # Step 2: Monte Carlo
        severity_95 = monte_carlo_95(max_hill)

        # Genetic multiplier
        gen_factor = calc_genetic_factor(organ_key, input_data.genetics)

        # Step 3: Cumulative damage + Logistic Sigmoid
        z_total = severity_95 * t_weeks * gen_factor
        risk_pct = logistic_risk(z_total, config["k_aggression"], config["z_crit"])
        status, alert_level = stratify(risk_pct)

        report[organ_key] = OrganReport(
            organ_name=config["name"],
            markers_used=[m.name for m in matched],
            hill_score=round(max_hill, 4),
            severity_95=round(severity_95, 4),
            z_total=round(z_total, 2),
            risk_percentage=round(risk_pct, 1),
            status=status,
            alert_level=alert_level,
            genetic_factor=round(gen_factor, 2),
        )

        if risk_pct > overall_max_risk:
            overall_max_risk = risk_pct
        if alert_level > overall_alert:
            overall_alert = alert_level

    return MDSSResponse(
        patient_exposure_weeks=t_weeks,
        organ_systems_report=report,
        overall_max_risk=round(overall_max_risk, 1),
        overall_alert_level=overall_alert,
    )

# ─── API ENDPOINTS ───
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "version": "1.0.0", "organs_covered": len(CLINICAL_DB)}

@app.post("/analyze_risk", response_model=MDSSResponse)
async def analyze_risk(input_data: PatientInput):
    """
    Run MDSS risk analysis pipeline.
    
    Accepts patient biomarkers, exposure weeks, and genetics.
    Returns per-organ risk assessment with probability of irreversible damage.
    """
    try:
        return analyze_patient(input_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")

# ─── MAIN ───
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
