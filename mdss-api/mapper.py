"""
Drug-to-Pathology Mapper — Pharmacological Knowledge Graph Microservice.

FastAPI-based rule engine that maps a user's drug stack to:
  1. Active pathologies with cumulative organ stress (stack synergy).
  2. Unique set of required biomarkers for clinical monitoring.

Author: Health Engine v9 — Production Deployment
License: Proprietary
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional, Set, Tuple

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
logger = logging.getLogger("mapper")

# ---------------------------------------------------------------------------
# Pharmacological Knowledge Graph — DRUG_DATABASE
# ---------------------------------------------------------------------------
# Each drug entry maps the compound to its known organ pathologies.
# `trigger_strength` is a relative coefficient of organ aggression (>=0).
# `required_markers` are the lab biomarkers needed to monitor that pathology.
# ---------------------------------------------------------------------------

DRUG_DATABASE: Dict[str, Dict] = {
    # ---- 19-nor androgens ----
    "trenbolone": {
        "class": "19-nor_androgen",
        "pathologies": [
            {
                "id": "renal_fsgs",
                "trigger_strength": 1.5,
                "required_markers": ["KIM-1", "Cystatin_C"],
            },
            {
                "id": "cardiac_fibrosis",
                "trigger_strength": 1.2,
                "required_markers": ["Galectin-3", "NT-proBNP"],
            },
            {
                "id": "cns_neurotoxicity",
                "trigger_strength": 1.8,
                "required_markers": ["Cortisol_night", "HVA"],
            },
        ],
    },
    "nandrolone": {
        "class": "19-nor_androgen",
        "pathologies": [
            {
                "id": "cardiac_fibrosis",
                "trigger_strength": 1.0,
                "required_markers": ["Galectin-3", "NT-proBNP", "ADMA"],
            },
            {
                "id": "hpta_suppression",
                "trigger_strength": 1.5,
                "required_markers": ["Prolactin", "Inhibin_B", "LH"],
            },
        ],
    },
    # ---- 17-alpha-alkylated androgens ----
    "stanozolol": {
        "class": "17aa_androgen",
        "pathologies": [
            {
                "id": "hepatic_cholestasis",
                "trigger_strength": 1.5,
                "required_markers": ["CK-18", "GGT", "Bile_Acids", "ALP"],
            },
            {
                "id": "atherosclerosis",
                "trigger_strength": 1.6,
                "required_markers": ["ApoB", "oxLDL", "HDL"],
            },
            {
                "id": "joint_desiccation",
                "trigger_strength": 1.4,
                "required_markers": ["CTX", "COMP"],
            },
        ],
    },
    # ---- Peptide hormones ----
    "insulin": {
        "class": "peptide_hormone",
        "pathologies": [
            {
                "id": "insulin_resistance",
                "trigger_strength": 1.5,
                "required_markers": ["HOMA-IR", "C-Peptide", "HbA1c"],
            },
            {
                "id": "vascular_hypertrophy",
                "trigger_strength": 1.1,
                "required_markers": ["VEGF", "hs-CRP"],
            },
        ],
    },
    # ---- Aromatase-inhibiting androgens / veterinary ----
    "boldenone": {
        "class": "aromatase_inhibitor_androgen",
        "pathologies": [
            {
                "id": "erythrocytosis_hyperviscosity",
                "trigger_strength": 1.7,
                "required_markers": ["Hematocrit", "Ferritin", "EPO"],
            },
            {
                "id": "atherosclerosis",
                "trigger_strength": 1.2,
                "required_markers": ["ApoB", "oxLDL"],
            },
            {
                "id": "renal_fsgs",
                "trigger_strength": 0.8,
                "required_markers": ["KIM-1", "Cystatin_C"],
            },
        ],
    },
    # ---- Extended database (DHT derivatives) ----
    "oxandrolone": {
        "class": "17aa_androgen",
        "pathologies": [
            {
                "id": "hepatic_cholestasis",
                "trigger_strength": 0.9,
                "required_markers": ["CK-18", "GGT", "ALP"],
            },
            {
                "id": "atherosclerosis",
                "trigger_strength": 1.3,
                "required_markers": ["ApoB", "HDL"],
            },
        ],
    },
    "masteron": {
        "class": "dht_derivative",
        "pathologies": [
            {
                "id": "atherosclerosis",
                "trigger_strength": 1.4,
                "required_markers": ["ApoB", "HDL", "oxLDL"],
            },
            {
                "id": "androgenic_alopecia",
                "trigger_strength": 1.6,
                "required_markers": ["DHT", "SHBG"],
            },
            {
                "id": "prostate_hyperplasia",
                "trigger_strength": 1.3,
                "required_markers": ["PSA", "DHT"],
            },
        ],
    },
    "testosterone": {
        "class": "endogenous_androgen",
        "pathologies": [
            {
                "id": "hpta_suppression",
                "trigger_strength": 1.0,
                "required_markers": ["LH", "FSH", "TT", "SHBG"],
            },
            {
                "id": "erythrocytosis_hyperviscosity",
                "trigger_strength": 1.0,
                "required_markers": ["Hematocrit", "Ferritin"],
            },
            {
                "id": "atherosclerosis",
                "trigger_strength": 0.8,
                "required_markers": ["ApoB", "HDL"],
            },
        ],
    },
    "dianabol": {
        "class": "17aa_androgen",
        "pathologies": [
            {
                "id": "hepatic_cholestasis",
                "trigger_strength": 1.7,
                "required_markers": ["CK-18", "GGT", "Bile_Acids", "ALP", "ALT", "AST"],
            },
            {
                "id": "atherosclerosis",
                "trigger_strength": 1.5,
                "required_markers": ["ApoB", "oxLDL", "HDL"],
            },
            {
                "id": "renal_fsgs",
                "trigger_strength": 0.6,
                "required_markers": ["KIM-1", "Cystatin_C"],
            },
        ],
    },
    "anadrol": {
        "class": "17aa_androgen",
        "pathologies": [
            {
                "id": "hepatic_cholestasis",
                "trigger_strength": 2.0,
                "required_markers": ["CK-18", "GGT", "Bile_Acids", "ALP", "ALT", "AST", "Bilirubin"],
            },
            {
                "id": "erythrocytosis_hyperviscosity",
                "trigger_strength": 1.8,
                "required_markers": ["Hematocrit", "Ferritin", "EPO"],
            },
            {
                "id": "atherosclerosis",
                "trigger_strength": 1.3,
                "required_markers": ["ApoB", "oxLDL", "HDL"],
            },
        ],
    },
    "growth_hormone": {
        "class": "peptide_hormone",
        "pathologies": [
            {
                "id": "insulin_resistance",
                "trigger_strength": 1.2,
                "required_markers": ["HOMA-IR", "HbA1c", "IGF-1"],
            },
            {
                "id": "cardiac_fibrosis",
                "trigger_strength": 0.9,
                "required_markers": ["Galectin-3", "NT-proBNP"],
            },
            {
                "id": "acromegalic_remodeling",
                "trigger_strength": 0.7,
                "required_markers": ["IGF-1", "CTX"],
            },
        ],
    },
    "clenbuterol": {
        "class": "beta2_agonist",
        "pathologies": [
            {
                "id": "cardiac_fibrosis",
                "trigger_strength": 1.6,
                "required_markers": ["Galectin-3", "NT-proBNP", "Troponin_I"],
            },
            {
                "id": "cns_neurotoxicity",
                "trigger_strength": 0.9,
                "required_markers": ["Cortisol_night"],
            },
            {
                "id": "vascular_hypertrophy",
                "trigger_strength": 1.2,
                "required_markers": ["VEGF", "hs-CRP"],
            },
        ],
    },
}

# ---------------------------------------------------------------------------
# Pathology descriptions (human-readable labels for frontend)
# ---------------------------------------------------------------------------

PATHOLOGY_LABELS: Dict[str, str] = {
    "renal_fsgs": "FSGS / Нефропатия (почки)",
    "cardiac_fibrosis": "Фиброз миокарда / Кардиомиопатия",
    "cns_neurotoxicity": "Нейротоксичность ЦНС",
    "hpta_suppression": "Подавление оси HPTA",
    "hepatic_cholestasis": "Холестаз / Гепатотоксичность",
    "atherosclerosis": "Атеросклероз / Дислипидемия",
    "joint_desiccation": "Десикация суставов / Остеоартроз",
    "insulin_resistance": "Инсулинорезистентность / Диабет",
    "vascular_hypertrophy": "Гипертрофия сосудов / Воспаление",
    "erythrocytosis_hyperviscosity": "Эритроцитоз / Гипервязкость крови",
    "androgenic_alopecia": "Андрогенная алопеция",
    "prostate_hyperplasia": "Гиперплазия простаты",
    "acromegalic_remodeling": "Акромегалическое ремоделирование",
}

# ---------------------------------------------------------------------------
# Pydantic I/O Models
# ---------------------------------------------------------------------------


class DrugInput(BaseModel):
    """A single drug entry from the user's stack."""

    name: str = Field(
        ...,
        description="Drug name in lowercase (e.g., 'trenbolone', 'stanozolol').",
        min_length=2,
        max_length=100,
    )
    dosage_mg: float = Field(..., description="Weekly dosage in mg.", ge=0.0)

    @field_validator("name")
    @classmethod
    def _lowercase_name(cls, v: str) -> str:
        return v.strip().lower()


class StackInput(BaseModel):
    """The complete pharmacological stack submitted by the user."""

    drugs: List[DrugInput] = Field(
        ..., description="Array of drugs with dosages.", min_length=1
    )


class PathologyRisk(BaseModel):
    """Aggregated risk for a single pathology across all contributing drugs."""

    pathology_id: str = Field(..., description="Internal pathology identifier.")
    pathology_label: str = Field("", description="Human-readable pathology name.")
    cumulative_trigger_strength: float = Field(
        ..., description="Sum of trigger_strength values (stack synergy).", ge=0.0
    )
    contributing_drugs: List[str] = Field(
        ..., description="List of drug names contributing to this pathology."
    )


class MapperResponse(BaseModel):
    """Complete response from the Drug-to-Pathology Mapper."""

    active_pathologies: List[PathologyRisk] = Field(
        default_factory=list,
        description="All detected pathologies with cumulative synergy scores.",
    )
    required_biomarkers: List[str] = Field(
        default_factory=list,
        description="Unique set of biomarkers the patient should test.",
    )
    unknown_drugs: List[str] = Field(
        default_factory=list,
        description="Drugs from the request not found in the knowledge graph.",
    )
    total_drugs: int = Field(
        default=0, description="Total number of drugs in the submitted stack."
    )
    known_drugs: int = Field(
        default=0,
        description="Number of drugs successfully matched in the database.",
    )


# ---------------------------------------------------------------------------
# Core Engine — Stack-to-Pathology Mapper
# ---------------------------------------------------------------------------


def map_stack_to_pathologies(
    drugs: List[DrugInput],
) -> Tuple[Dict[str, PathologyRisk], Set[str], List[str]]:
    """
    Core mapping algorithm.

    Iterates over each drug, looks it up in DRUG_DATABASE, and aggregates:
      - `trigger_strength` sums (stack synergy — cumulative organ stress)
      - `contributing_drugs` merged per pathology_id
      - `required_markers` deduplicated into a single flat set

    Args:
        drugs: The user's drug stack.

    Returns:
        Tuple of (pathology_map, marker_set, unknown_drugs).
            - pathology_map: {pathology_id: PathologyRisk}
            - marker_set: Unique set of all required biomarkers.
            - unknown_drugs: Drug names not found in the knowledge graph.
    """
    # Internal aggregation structures
    pathology_agg: Dict[str, Dict] = {}  # pathology_id → aggregated data
    all_markers: Set[str] = set()
    unknown_drugs: List[str] = []

    for drug_entry in drugs:
        drug_name = drug_entry.name.lower().strip()

        # ---- Lookup in knowledge graph ----
        drug_data = DRUG_DATABASE.get(drug_name)

        if drug_data is None:
            unknown_drugs.append(drug_name)
            logger.warning(
                "Unknown drug '%s' — not found in DRUG_DATABASE.", drug_name
            )
            continue

        drug_class = drug_data.get("class", "unknown")
        pathologies: List[Dict] = drug_data.get("pathologies", [])

        logger.info(
            "Processing drug '%s' (class=%s, %d pathologies).",
            drug_name,
            drug_class,
            len(pathologies),
        )

        # ---- Iterate over each pathology for this drug ----
        for path in pathologies:
            pid: str = path["id"]
            strength: float = path.get("trigger_strength", 0.0)
            markers: List[str] = path.get("required_markers", [])

            # Aggregate markers globally
            all_markers.update(markers)

            # Aggregate pathology data (stack synergy)
            if pid not in pathology_agg:
                pathology_agg[pid] = {
                    "cumulative_trigger_strength": 0.0,
                    "contributing_drugs": [],
                }

            pathology_agg[pid]["cumulative_trigger_strength"] += strength
            pathology_agg[pid]["contributing_drugs"].append(drug_name)

    # ---- Build PathologyRisk objects sorted by severity ----
    active: List[PathologyRisk] = []
    for pid, agg_data in sorted(
        pathology_agg.items(),
        key=lambda item: item[1]["cumulative_trigger_strength"],
        reverse=True,
    ):
        active.append(
            PathologyRisk(
                pathology_id=pid,
                pathology_label=PATHOLOGY_LABELS.get(pid, pid),
                cumulative_trigger_strength=round(
                    agg_data["cumulative_trigger_strength"], 2
                ),
                contributing_drugs=sorted(set(agg_data["contributing_drugs"])),
            )
        )

    # Sort biomarkers alphabetically for consistent output
    sorted_markers: List[str] = sorted(all_markers)

    logger.info(
        "Mapping complete: %d pathologies, %d markers, %d unknown drugs.",
        len(active),
        len(sorted_markers),
        len(unknown_drugs),
    )

    return (active, sorted_markers, unknown_drugs)


# ---------------------------------------------------------------------------
# FastAPI Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Drug-to-Pathology Mapper",
    description=(
        "Pharmacological Knowledge Graph microservice. "
        "Maps a user's drug stack to active organ pathologies with "
        "cumulative synergy scores and required biomarkers."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — allow all origins for Telegram Mini App / PWA
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------


@app.get("/health", tags=["System"])
async def health_check() -> Dict[str, str]:
    """Liveness probe — returns server status and known drug count."""
    return {
        "status": "healthy",
        "service": "Drug-to-Pathology Mapper v1.0.0",
        "known_drugs": str(len(DRUG_DATABASE)),
    }


# ---------------------------------------------------------------------------
# Root Endpoint
# ---------------------------------------------------------------------------


@app.get("/", tags=["System"])
async def root() -> Dict[str, str]:
    """Root redirect — points to API docs."""
    return {
        "message": "Drug-to-Pathology Mapper API",
        "docs": "/docs",
        "health": "/health",
    }


# ---------------------------------------------------------------------------
# POST /map_stack_to_problems
# ---------------------------------------------------------------------------


@app.post(
    "/map_stack_to_problems",
    response_model=MapperResponse,
    tags=["Mapping"],
    summary="Map drug stack to organ pathologies",
    description=(
        "Accepts a list of drugs with dosages and returns: "
        "(1) all active pathologies with cumulative synergy scores, "
        "(2) the unique set of required biomarkers, and "
        "(3) any unknown drug names not found in the knowledge graph."
    ),
)
async def map_stack_to_problems_endpoint(payload: StackInput) -> MapperResponse:
    """
    POST endpoint: map a user's pharmacological stack to pathologies.

    Body example:
    ```json
    {
      "drugs": [
        {"name": "trenbolone", "dosage_mg": 300},
        {"name": "stanozolol", "dosage_mg": 50},
        {"name": "insulin", "dosage_mg": 10}
      ]
    }
    ```

    Returns:
        MapperResponse with active_pathologies, required_biomarkers, unknown_drugs.
    """
    if not payload.drugs:
        raise HTTPException(
            status_code=400, detail="Drug stack cannot be empty."
        )

    logger.info(
        "Received stack mapping request: %d drug(s).",
        len(payload.drugs),
    )

    # ---- Run core engine ----
    pathologies_list, biomarkers, unknowns = map_stack_to_pathologies(
        payload.drugs
    )

    # ---- Assemble response ----
    return MapperResponse(
        active_pathologies=pathologies_list,
        required_biomarkers=biomarkers,
        unknown_drugs=unknowns,
        total_drugs=len(payload.drugs),
        known_drugs=len(payload.drugs) - len(unknowns),
    )


# ---------------------------------------------------------------------------
# Entrypoint (for direct execution)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    logger.info("Starting Drug-to-Pathology Mapper on :8000")
    uvicorn.run("mapper:app", host="0.0.0.0", port=8000, reload=True)
