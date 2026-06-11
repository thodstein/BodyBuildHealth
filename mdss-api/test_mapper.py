"""Smoke test for mapper.py"""
import json
import sys
sys.path.insert(0, '.')

from mapper import (
    app, DrugInput, StackInput, MapperResponse, 
    map_stack_to_pathologies, DRUG_DATABASE
)

# Count unique pathologies across all drugs
all_pids = set()
for d in DRUG_DATABASE.values():
    for p in d["pathologies"]:
        all_pids.add(p["id"])

print(f"Known drugs: {len(DRUG_DATABASE)}")
print(f"Unique pathologies: {len(all_pids)}")

# Test Pydantic models
s = StackInput(drugs=[
    DrugInput(name='trenbolone', dosage_mg=300),
    DrugInput(name='stanozolol', dosage_mg=50),
])
print(f"StackInput OK: {len(s.drugs)} drugs")

# Test core engine with stack synergy
drugs = [
    DrugInput(name='trenbolone', dosage_mg=300),
    DrugInput(name='nandrolone', dosage_mg=400),
    DrugInput(name='stanozolol', dosage_mg=50),
    DrugInput(name='boldenone', dosage_mg=600),
]
pathologies, markers, unknowns = map_stack_to_pathologies(drugs)

# Verify synergy: renal_fsgs from trenbolone (1.5) + boldenone (0.8) = 2.3
renal = next((p for p in pathologies if p.pathology_id == 'renal_fsgs'), None)
cardiac = next((p for p in pathologies if p.pathology_id == 'cardiac_fibrosis'), None)

print(f"\nStack synergy check:")
print(f"  renal_fsgs: strength={renal.cumulative_trigger_strength} (expected 2.3), drugs={renal.contributing_drugs}")
print(f"  cardiac_fibrosis: strength={cardiac.cumulative_trigger_strength} (expected 2.2), drugs={cardiac.contributing_drugs}")
print(f"  Total pathologies: {len(pathologies)}")
print(f"  Unique biomarkers: {len(markers)}")
print(f"  Unknown drugs: {unknowns}")

# Full response
resp = MapperResponse(
    active_pathologies=pathologies,
    required_biomarkers=markers,
    unknown_drugs=unknowns,
    total_drugs=len(drugs),
    known_drugs=len(drugs) - len(unknowns),
)

print(f"\nFull JSON response:")
print(json.dumps(resp.model_dump(), indent=2, ensure_ascii=False))

# Verify no duplicate biomarkers
assert len(markers) == len(set(markers)), "DUPLICATE BIOMARKERS DETECTED"
assert renal is not None and abs(renal.cumulative_trigger_strength - 2.3) < 0.01, "WRONG RENAL SYNERGY"
assert len(unknowns) == 0, "UNKNOWN DRUGS FOUND"

print(f"\nALL CHECKS PASSED")
