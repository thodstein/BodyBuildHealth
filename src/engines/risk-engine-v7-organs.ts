// ============================================================
// Health Engine v7.0 — Organ Modules
// 11 organs × 7 mechanisms per spec (File 1 & 2)
// Heart, Vessels, Liver, Kidney, Blood, HPTA(Endocrine),
// Metabolic, GH/IGF, Insulin axis, Musculoskeletal, CNS+Neurotoxicity
// Each mechanism: Hill-Effect with k, EC50, n, lambdaAcute, lambdaChronic, lambdaFibrosis
// ============================================================

import {
  hillEffect, hillTox, stepOrganAcute, stepOrganChronic, stepFibrosis,
  compositeOrganState, hillHazard, pEventFromHazard, adaptiveRecovery,
  type HillToxParams, type OrganParams, type OrganState, type MechanismDamage, type ProtocolMode,
  getModeMultiplier
} from './risk-engine-v7-core';

export interface OrganInput {
  BPz: number; Hctz: number; Viscz: number; LVHz: number; NaH2O: number;
  Athero: number; IRz: number; TGz: number; HDLz: number; Proteinz: number;
  GHIGFcore: number; C_AAS_oral: number; Alcohol_core: number;
  ALTz: number; ASTz: number; GGTz: number; ALPz: number; Bilirubinz: number;
  eGFRz: number; Creatininez: number; Proteinuria_z: number;
  AR_eff: number; ER_eff: number; IGF1R_eff: number; GHSR_eff: number;
  IR_eff: number; mTOR: number; C_GH: number; STAT: number;
  Inflamm_core: number; Oxid_core: number; Stim_core: number; Dep_core: number;
  Psycho_core: number; Smoke_core: number; Coag_core: number; Hypo_core: number;
  tOverT: number; Stazh_life: number; Stazh_cont: number;
  Sleepz: number; Stressz: number; Activityz: number; Alcoholz: number;
  DA_z: number; Glu_z: number; GABA_z: number; Serotonin_z: number;
  S100b_z: number; PRL_z: number; LH_z: number; FSH_z: number;
  Waist_z: number; HOMAIR_z: number; TSH_z: number; Cortisol_z: number;
  eGFRz_abs: number; Creatz_abs: number;
  labValues: Record<string, number>;
  labRefs: Record<string, { mean: number; sd: number }>;
  mode: ProtocolMode;
  concentrations: Record<string, number>;
  // Drug-derived indices
  Neurotox_chem: number;  // sum of C_neuro_drug * k_neuro
  Lipid_met: number;      // TGz - HDLz + Waist_z
}

interface MP { k: number; EC50: number; n: number; la: number; lc: number; lf: number; }

// Organ params from spec: rBase, sigma, weights, hazard params
const HEART_P: OrganParams = {rBase:0.03,sigma:0.02,wAcute:0.3,wChronic:0.5,wFibrosis:0.2,hMax:0.15,EC50h:0.4,nH:2.5};
const VESSEL_P: OrganParams = {rBase:0.025,sigma:0.015,wAcute:0.25,wChronic:0.55,wFibrosis:0.2,hMax:0.12,EC50h:0.35,nH:2.5};
const LIVER_P: OrganParams = {rBase:0.035,sigma:0.02,wAcute:0.2,wChronic:0.55,wFibrosis:0.25,hMax:0.18,EC50h:0.45,nH:2.5};
const KIDNEY_P: OrganParams = {rBase:0.025,sigma:0.015,wAcute:0.2,wChronic:0.6,wFibrosis:0.2,hMax:0.12,EC50h:0.35,nH:2.5};
const BLOOD_P: OrganParams = {rBase:0.03,sigma:0.02,wAcute:0.4,wChronic:0.45,wFibrosis:0.15,hMax:0.12,EC50h:0.35,nH:2.0};
const ENDO_P: OrganParams = {rBase:0.025,sigma:0.015,wAcute:0.2,wChronic:0.65,wFibrosis:0.15,hMax:0.14,EC50h:0.4,nH:2.5};
const META_P: OrganParams = {rBase:0.02,sigma:0.01,wAcute:0.2,wChronic:0.65,wFibrosis:0.15,hMax:0.10,EC50h:0.3,nH:2.0};
const GHIGF_P: OrganParams = {rBase:0.02,sigma:0.01,wAcute:0.3,wChronic:0.6,wFibrosis:0.1,hMax:0.08,EC50h:0.3,nH:2.0};
const INS_P: OrganParams = {rBase:0.025,sigma:0.015,wAcute:0.35,wChronic:0.55,wFibrosis:0.1,hMax:0.10,EC50h:0.3,nH:2.0};
const MUSCULO_P: OrganParams = {rBase:0.015,sigma:0.01,wAcute:0.3,wChronic:0.55,wFibrosis:0.15,hMax:0.08,EC50h:0.35,nH:2.0};
const NEURO_P: OrganParams = {rBase:0.02,sigma:0.015,wAcute:0.35,wChronic:0.5,wFibrosis:0.15,hMax:0.12,EC50h:0.35,nH:2.5};

const REPRO_P: OrganParams = {rBase:0.02,sigma:0.01,wAcute:0.15,wChronic:0.7,wFibrosis:0.15,hMax:0.10,EC50h:0.3,nH:2.0};
const TX: HillToxParams = {Emax:1,EC50:2.5,n:2,threshold:0};
const TXL: HillToxParams = {Emax:1,EC50:2,n:1.8,threshold:0};
const TXS: HillToxParams = {Emax:1,EC50:2,n:1.5,threshold:0};

function he(idx: number, EC50: number, n: number): number { return hillEffect(idx, 1, EC50, n); }
function dm(idx: number, k: number, EC50: number, n: number, mode: ProtocolMode, organ: string, mechIdx: number): number {
  return k * he(idx, EC50, n) * getModeMultiplier(mode, organ, mechIdx);
}
function mkMech(j: number, dmg: number, p: MP): MechanismDamage {
  return { index: j, effect: dmg / p.k, damage: dmg, lambdaAcute: p.la, lambdaChronic: p.lc };
}

// ============================================================
// 1. HEART — 7 mechanisms (spec File 3, Section 6.1)
// ============================================================
function computeHeart(i: OrganInput): MechanismDamage[] {
  const BP=hillTox(i.BPz,TX), Hct=hillTox(i.Hctz,TX), Visc=hillTox(i.Viscz,TX), LVH=hillTox(i.LVHz,TX),
    Na=hillTox(i.NaH2O,TXL), Ath=hillTox(i.Athero,TX),
    Inf=hillTox(i.Inflamm_core,TXL), Ox=hillTox(i.Oxid_core,TXL),
    St=hillTox(i.Stim_core,TXS), SL=hillTox(i.Stazh_life,TX), SC=hillTox(i.Stazh_cont,TX),
    Cg=hillTox(i.Coag_core,TXL);
  const md=i.mode;
  // M1: Chronic hemodynamics (BP + NaH2O + stim)
  // M2: AR/mTOR hypertrophy
  // M3: GH/IGF hypertrophy
  // M4: Ischemia (viscosity + Hct)
  // M5: Volume overload (NaH2O + BP)
  // M6: Coronary endothelium (ER + MAPK)
  // M7: Integrated chronic stress
  const m: Record<number,MP> = {
    1:{k:0.15,EC50:2.5,n:2,la:0.6,lc:0.4,lf:0},
    2:{k:0.12,EC50:2,n:2,la:0.3,lc:0.7,lf:0},
    3:{k:0.10,EC50:2.5,n:2,la:0.3,lc:0.5,lf:0.2},
    4:{k:0.08,EC50:2,n:1.8,la:0.8,lc:0.2,lf:0},
    5:{k:0.10,EC50:2,n:1.5,la:0.7,lc:0.3,lf:0},
    6:{k:0.08,EC50:2,n:1.8,la:0.2,lc:0.5,lf:0.3},
    7:{k:0.06,EC50:2,n:1.5,la:0.1,lc:0.5,lf:0.4}
  };
  const d1=dm(BP*(1+i.tOverT*0.5)+0.15*St+0.1*Na, m[1].k,m[1].EC50,m[1].n,md,'heart',1);
  const d2=dm(0.4*i.AR_eff+0.4*i.mTOR+0.2*LVH, m[2].k,m[2].EC50,m[2].n,md,'heart',2);
  const d3=dm(0.5*i.IGF1R_eff+0.5*i.C_GH, m[3].k,m[3].EC50,m[3].n,md,'heart',3);
  const d4=dm(0.5*Hct+0.3*Visc+0.2*Cg, m[4].k,m[4].EC50,m[4].n,md,'heart',4);
  const d5=dm(Na+BP*0.3, m[5].k,m[5].EC50,m[5].n,md,'heart',5);
  const d6=dm(0.4*Ath+0.3*BP+0.3*Inf, m[6].k,m[6].EC50,m[6].n,md,'heart',6);
  const d7=dm(0.35*d2+0.35*d6+0.30*(SL+SC)/2, m[7].k,m[7].EC50,m[7].n,md,'heart',7);
  return [mkMech(1,d1,m[1]),mkMech(2,d2,m[2]),mkMech(3,d3,m[3]),mkMech(4,d4,m[4]),mkMech(5,d5,m[5]),mkMech(6,d6,m[6]),mkMech(7,d7,m[7])];
}

// ============================================================
// 2. VESSELS — 7 mechanisms (spec: Atherogenesis, Endothelium, Coagulation, Oxidative, Chronic/Fibrosis + 2 more from File 3)
// Expanded to 7 per spec File 1 Section 6.2
// ============================================================
function computeVessels(i: OrganInput): MechanismDamage[] {
  const m: Record<number,MP> = {
    1:{k:0.15,EC50:2.5,n:2,la:0.2,lc:0.6,lf:0.2},
    2:{k:0.12,EC50:2,n:2,la:0.5,lc:0.4,lf:0.1},
    3:{k:0.10,EC50:2,n:2,la:0.7,lc:0.3,lf:0},
    4:{k:0.08,EC50:2,n:1.8,la:0.3,lc:0.5,lf:0.2},
    5:{k:0.06,EC50:2,n:1.5,la:0.1,lc:0.5,lf:0.4},
    6:{k:0.08,EC50:2,n:1.8,la:0.2,lc:0.6,lf:0.2},
    7:{k:0.06,EC50:2.5,n:1.5,la:0.1,lc:0.5,lf:0.4}
  };
  const md=i.mode;
  // M1: Atherogenesis
  const d1=dm(i.Athero+0.15*i.Smoke_core+0.1*i.Oxid_core, m[1].k,m[1].EC50,m[1].n,md,'vessels',1);
  // M2: Endothelial dysfunction (BP + stim + inflammation)
  const d2=dm(i.BPz+0.15*i.Stim_core+i.Inflamm_core*0.3, m[2].k,m[2].EC50,m[2].n,md,'vessels',2);
  // M3: Coagulation
  const d3=dm(i.Coag_core, m[3].k,m[3].EC50,m[3].n,md,'vessels',3);
  // M4: Oxidative stress
  const d4=dm(i.Oxid_core, m[4].k,m[4].EC50,m[4].n,md,'vessels',4);
  // M5: ER/MAPK wall
  const d5=dm(0.4*i.ER_eff*i.mTOR+0.3*i.Inflamm_core+0.3*i.Oxid_core, m[5].k,m[5].EC50,m[5].n,md,'vessels',5);
  // M6: Metabolic syndrome (IR + Lipids)
  const d6=dm(0.5*i.IRz+0.5*hillTox(i.Athero,TX), m[6].k,m[6].EC50,m[6].n,md,'vessels',6);
  // M7: Smoking
  const d7=dm(i.Smoke_core, m[7].k,m[7].EC50,m[7].n,md,'vessels',7);
  return [mkMech(1,d1,m[1]),mkMech(2,d2,m[2]),mkMech(3,d3,m[3]),mkMech(4,d4,m[4]),mkMech(5,d5,m[5]),mkMech(6,d6,m[6]),mkMech(7,d7,m[7])];
}

// ============================================================
// 3. LIVER — 7 mechanisms (spec File 3 Section 6.3)
// ============================================================
function computeLiver(i: OrganInput): MechanismDamage[] {
  const m: Record<number,MP> = {
    1:{k:0.18,EC50:2,n:2,la:0.4,lc:0.4,lf:0.2},
    2:{k:0.12,EC50:2,n:2,la:0.2,lc:0.6,lf:0.2},
    3:{k:0.10,EC50:2,n:1.8,la:0.5,lc:0.4,lf:0.1},
    4:{k:0.08,EC50:2,n:1.5,la:0.1,lc:0.5,lf:0.4},
    5:{k:0.08,EC50:2,n:1.8,la:0.1,lc:0.5,lf:0.4},
    6:{k:0.06,EC50:2.5,n:1.5,la:0.2,lc:0.5,lf:0.3},
    7:{k:0.12,EC50:2,n:2,la:0.5,lc:0.3,lf:0.2}
  };
  const md=i.mode;
  const T17=i.ALTz+i.ASTz+0.3*i.C_AAS_oral;
  const Chol=i.GGTz+i.ALPz+i.Bilirubinz*0.5;
  const Steato=i.TGz+i.IRz+0.15*i.Proteinz;
  // M1: 17-alpha toxicity
  const d1=dm(T17+0.2*i.Alcohol_core, m[1].k,m[1].EC50,m[1].n,md,'liver',1);
  // M2: Cholestasis
  const d2=dm(Chol, m[2].k,m[2].EC50,m[2].n,md,'liver',2);
  // M3: Steatosis
  const d3=dm(Steato, m[3].k,m[3].EC50,m[3].n,md,'liver',3);
  // M4: IR-lipogenesis
  const d4=dm(0.5*i.IRz+0.5*hillTox(Steato,TXL), m[4].k,m[4].EC50,m[4].n,md,'liver',4);
  // M5: GH/IGF liver
  const d5=dm(0.5*i.IGF1R_eff*i.STAT+0.5*i.C_GH, m[5].k,m[5].EC50,m[5].n,md,'liver',5);
  // M6: Inflammation
  const d6=dm(i.Inflamm_core, m[6].k,m[6].EC50,m[6].n,md,'liver',6);
  // M7: Alcohol + direct chemical
  const d7=dm(0.5*i.Alcohol_core+0.5*hillTox(i.C_AAS_oral,TXS), m[7].k,m[7].EC50,m[7].n,md,'liver',7);
  return [mkMech(1,d1,m[1]),mkMech(2,d2,m[2]),mkMech(3,d3,m[3]),mkMech(4,d4,m[4]),mkMech(5,d5,m[5]),mkMech(6,d6,m[6]),mkMech(7,d7,m[7])];
}

// ============================================================
// 4. KIDNEY — 7 mechanisms (spec File 3 Section 6.4)
// ============================================================
function computeKidney(i: OrganInput): MechanismDamage[] {
  const m: Record<number,MP> = {
    1:{k:0.14,EC50:2.5,n:2,la:0.3,lc:0.5,lf:0.2},
    2:{k:0.12,EC50:2,n:2,la:0.2,lc:0.6,lf:0.2},
    3:{k:0.08,EC50:2,n:1.8,la:0.4,lc:0.4,lf:0.2},
    4:{k:0.06,EC50:2,n:1.5,la:0.5,lc:0.4,lf:0.1},
    5:{k:0.10,EC50:2,n:2,la:0.3,lc:0.5,lf:0.2},
    6:{k:0.04,EC50:2.5,n:1.5,la:0.2,lc:0.6,lf:0.2},
    7:{k:0.06,EC50:2,n:1.8,la:0.3,lc:0.5,lf:0.2}
  };
  const md=i.mode;
  const Na=hillTox(i.NaH2O,TXL);
  // M1: Hemodynamics
  const d1=dm(i.BPz+0.2*Na+0.15*i.IRz, m[1].k,m[1].EC50,m[1].n,md,'kidney',1);
  // M2: Hyperfiltration
  const d2=dm(-i.eGFRz+i.Creatininez, m[2].k,m[2].EC50,m[2].n,md,'kidney',2);
  // M3: Proteinuria
  const d3=dm(i.Proteinuria_z, m[3].k,m[3].EC50,m[3].n,md,'kidney',3);
  // M4: Viscosity
  const d4=dm(hillTox(i.Viscz,TX), m[4].k,m[4].EC50,m[4].n,md,'kidney',4);
  // M5: Metabolic contribution (IR + Lipids)
  const d5=dm(0.5*i.IRz+0.5*hillTox(i.Athero,TXL), m[5].k,m[5].EC50,m[5].n,md,'kidney',5);
  // M6: GH/IGF glomerular
  const d6=dm(0.5*i.IGF1R_eff*i.STAT+0.5*i.C_GH, m[6].k,m[6].EC50,m[6].n,md,'kidney',6);
  // M7: Nephrotoxic drugs
  const d7=dm(i.Inflamm_core, m[7].k,m[7].EC50,m[7].n,md,'kidney',7);
  return [mkMech(1,d1,m[1]),mkMech(2,d2,m[2]),mkMech(3,d3,m[3]),mkMech(4,d4,m[4]),mkMech(5,d5,m[5]),mkMech(6,d6,m[6]),mkMech(7,d7,m[7])];
}

// ============================================================
// 5. BLOOD (Hematologic) — 7 mechanisms (spec File 3 Section 6.5)
// ============================================================
function computeBlood(i: OrganInput): MechanismDamage[] {
  const m: Record<number,MP> = {
    1:{k:0.12,EC50:2,n:2,la:0.4,lc:0.5,lf:0.1},
    2:{k:0.08,EC50:2,n:1.8,la:0.3,lc:0.6,lf:0.1},
    3:{k:0.06,EC50:2.5,n:1.5,la:0.5,lc:0.4,lf:0.1},
    4:{k:0.08,EC50:2,n:1.8,la:0.6,lc:0.3,lf:0.1},
    5:{k:0.06,EC50:2,n:1.5,la:0.3,lc:0.5,lf:0.2},
    6:{k:0.10,EC50:2,n:2,la:0.4,lc:0.4,lf:0.2},
    7:{k:0.06,EC50:2,n:1.5,la:0.4,lc:0.4,lf:0.2}
  };
  const md=i.mode;
  // M1: EPO/AR erythropoiesis
  const d1=dm(0.5*i.AR_eff+0.5*hillTox(i.Hctz,TX), m[1].k,m[1].EC50,m[1].n,md,'hematologic',1);
  // M2: Hct
  const d2=dm(i.Hctz, m[2].k,m[2].EC50,m[2].n,md,'hematologic',2);
  // M3: Viscosity
  const d3=dm(hillTox(i.Viscz,TX), m[3].k,m[3].EC50,m[3].n,md,'hematologic',3);
  // M4: Coagulation
  const d4=dm(i.Coag_core, m[4].k,m[4].EC50,m[4].n,md,'hematologic',4);
  // M5: Plasma volume (NaH2O)
  const d5=dm(i.NaH2O, m[5].k,m[5].EC50,m[5].n,md,'hematologic',5);
  // M6: IR contribution
  const d6=dm(i.IRz, m[6].k,m[6].EC50,m[6].n,md,'hematologic',6);
  // M7: Inflammation
  const d7=dm(i.Inflamm_core, m[7].k,m[7].EC50,m[7].n,md,'hematologic',7);
  return [mkMech(1,d1,m[1]),mkMech(2,d2,m[2]),mkMech(3,d3,m[3]),mkMech(4,d4,m[4]),mkMech(5,d5,m[5]),mkMech(6,d6,m[6]),mkMech(7,d7,m[7])];
}

// ============================================================
// 6. HPTA / ENDOCRINE — 7 mechanisms (spec File 3 Section 6.6)
// ============================================================
function computeEndocrine(i: OrganInput): MechanismDamage[] {
  const m: Record<number,MP> = {
    1:{k:0.14,EC50:2,n:2,la:0.2,lc:0.7,lf:0.1},
    2:{k:0.12,EC50:2,n:2,la:0.3,lc:0.6,lf:0.1},
    3:{k:0.10,EC50:2,n:1.8,la:0.4,lc:0.5,lf:0.1},
    4:{k:0.08,EC50:2,n:1.8,la:0.2,lc:0.7,lf:0.1},
    5:{k:0.06,EC50:2,n:1.5,la:0.1,lc:0.7,lf:0.2},
    6:{k:0.08,EC50:2,n:1.8,la:0.3,lc:0.5,lf:0.2},
    7:{k:0.06,EC50:2,n:1.5,la:0.1,lc:0.6,lf:0.3}
  };
  const md=i.mode;
  const SL=hillTox(i.Stazh_life,TX), SC2=hillTox(i.Stazh_cont,TX);
  // M1: AR suppression
  const d1=dm(0.4*i.AR_eff+0.3*i.IRz+0.3*SL, m[1].k,m[1].EC50,m[1].n,md,'endocrine',1);
  // M2: ER suppression (aromatization)
  const d2=dm(0.5*i.ER_eff+0.3*i.AR_eff+0.2*i.IRz, m[2].k,m[2].EC50,m[2].n,md,'endocrine',2);
  // M3: Prolactin
  const d3=dm(0.5*i.PRL_z+0.3*i.Stim_core+0.2*i.Psycho_core, m[3].k,m[3].EC50,m[3].n,md,'endocrine',3);
  // M4: IR
  const d4=dm(i.IRz, m[4].k,m[4].EC50,m[4].n,md,'endocrine',4);
  // M5: Thyroid
  const d5=dm(Math.abs(i.TSH_z)*0.5+i.IRz*0.5, m[5].k,m[5].EC50,m[5].n,md,'endocrine',5);
  // M6: Cortisol
  const d6=dm(Math.abs(i.Cortisol_z)*0.5+i.Psycho_core*0.3+i.Stressz*0.2, m[6].k,m[6].EC50,m[6].n,md,'endocrine',6);
  // M7: Receptor desensitization
  const d7=dm(0.3*(SL+SC2)+0.4*i.AR_eff+0.3*i.ER_eff, m[7].k,m[7].EC50,m[7].n,md,'endocrine',7);
  return [mkMech(1,d1,m[1]),mkMech(2,d2,m[2]),mkMech(3,d3,m[3]),mkMech(4,d4,m[4]),mkMech(5,d5,m[5]),mkMech(6,d6,m[6]),mkMech(7,d7,m[7])];
}

// ============================================================
// 7. METABOLIC — 7 mechanisms (spec File 3 Section 6.7)
// ============================================================
function computeMetabolic(i: OrganInput): MechanismDamage[] {
  const m: Record<number,MP> = {
    1:{k:0.15,EC50:2,n:2,la:0.2,lc:0.7,lf:0.1},
    2:{k:0.12,EC50:2.5,n:2,la:0.1,lc:0.7,lf:0.2},
    3:{k:0.08,EC50:2,n:1.8,la:0.3,lc:0.5,lf:0.2},
    4:{k:0.08,EC50:2,n:1.5,la:0.2,lc:0.6,lf:0.2},
    5:{k:0.06,EC50:2.5,n:1.5,la:0.2,lc:0.6,lf:0.2},
    6:{k:0.08,EC50:2,n:1.8,la:0.1,lc:0.6,lf:0.3},
    7:{k:0.06,EC50:2.5,n:1.5,la:0.1,lc:0.5,lf:0.4}
  };
  const md=i.mode;
  const GH=i.IGF1R_eff+i.C_GH;
  // M1: IR
  const d1=dm(i.IRz, m[1].k,m[1].EC50,m[1].n,md,'metabolic',1);
  // M2: Visceral fat / Dyslipidemia
  const d2=dm(i.Athero, m[2].k,m[2].EC50,m[2].n,md,'metabolic',2);
  // M3: TG
  const d3=dm(i.TGz, m[3].k,m[3].EC50,m[3].n,md,'metabolic',3);
  // M4: Low HDL
  const d4=dm(-i.HDLz, m[4].k,m[4].EC50,m[4].n,md,'metabolic',4);
  // M5: GH/IGF glucose
  const d5=dm(0.5*GH+0.5*i.IRz, m[5].k,m[5].EC50,m[5].n,md,'metabolic',5);
  // M6: Liver contribution (from liver state)
  const d6=dm(i.Athero*0.5+i.IRz*0.5, m[6].k,m[6].EC50,m[6].n,md,'metabolic',6);
  // M7: Low activity
  const d7=dm(-i.Activityz, m[7].k,m[7].EC50,m[7].n,md,'metabolic',7);
  return [mkMech(1,d1,m[1]),mkMech(2,d2,m[2]),mkMech(3,d3,m[3]),mkMech(4,d4,m[4]),mkMech(5,d5,m[5]),mkMech(6,d6,m[6]),mkMech(7,d7,m[7])];
}

// ============================================================
// 8. GH/IGF — 7 mechanisms (spec File 3 Section 6.8)
// ============================================================
function computeGHIGF(i: OrganInput): MechanismDamage[] {
  const m: Record<number,MP> = {
    1:{k:0.10,EC50:2,n:2,la:0.3,lc:0.6,lf:0.1},
    2:{k:0.08,EC50:2,n:1.8,la:0.6,lc:0.4,lf:0},
    3:{k:0.08,EC50:2.5,n:2,la:0.3,lc:0.5,lf:0.2},
    4:{k:0.06,EC50:2,n:1.5,la:0.2,lc:0.6,lf:0.2},
    5:{k:0.06,EC50:2,n:1.5,la:0.2,lc:0.6,lf:0.2},
    6:{k:0.04,EC50:2.5,n:1.5,la:0.1,lc:0.6,lf:0.3},
    7:{k:0.06,EC50:2,n:1.8,la:0.3,lc:0.5,lf:0.2}
  };
  const md=i.mode;
  // M1: IGF1 excess
  const d1=dm(i.IGF1R_eff, m[1].k,m[1].EC50,m[1].n,md,'ghigf',1);
  // M2: NaH2O
  const d2=dm(i.NaH2O*0.5+i.C_GH*0.5, m[2].k,m[2].EC50,m[2].n,md,'ghigf',2);
  // M3: LVH GH/IGF
  const d3=dm(i.IGF1R_eff*i.STAT*0.5+i.C_GH*0.5, m[3].k,m[3].EC50,m[3].n,md,'ghigf',3);
  // M4: Renal (IGF+STAT)
  const d4=dm(i.IGF1R_eff*i.STAT, m[4].k,m[4].EC50,m[4].n,md,'ghigf',4);
  // M5: Hepatic (IGF+STAT)
  const d5=dm(i.IGF1R_eff*i.STAT, m[5].k,m[5].EC50,m[5].n,md,'ghigf',5);
  // M6: Tendons
  const d6=dm(i.C_GH, m[6].k,m[6].EC50,m[6].n,md,'ghigf',6);
  // M7: Glucose
  const d7=dm(i.C_GH*i.IGF1R_eff, m[7].k,m[7].EC50,m[7].n,md,'ghigf',7);
  return [mkMech(1,d1,m[1]),mkMech(2,d2,m[2]),mkMech(3,d3,m[3]),mkMech(4,d4,m[4]),mkMech(5,d5,m[5]),mkMech(6,d6,m[6]),mkMech(7,d7,m[7])];
}

// ============================================================
// 9. INSULIN AXIS — 2 mechanisms (spec: IR + Hypoglycemia)
// ============================================================
function computeInsAxis(i: OrganInput): MechanismDamage[] {
  const m: Record<number,MP> = {
    1:{k:0.14,EC50:2,n:2,la:0.2,lc:0.7,lf:0.1},
    2:{k:0.10,EC50:1.5,n:1.8,la:0.8,lc:0.2,lf:0}
  };
  const md=i.mode;
  const Hy=Math.max(0,i.Hypo_core);
  return [mkMech(1,dm(i.IRz,m[1].k,m[1].EC50,m[1].n,md,'ins_axis',1),m[1]),mkMech(2,dm(Hy,m[2].k,m[2].EC50,m[2].n,md,'ins_axis',2),m[2])];
}

// ============================================================
// 10. MUSCULOSKELETAL — 7 mechanisms (spec File 3 Section 6.9)
// ============================================================
function computeMusculoskeletal(i: OrganInput): MechanismDamage[] {
  const m: Record<number,MP> = {
    1:{k:0.10,EC50:2,n:2,la:0.5,lc:0.4,lf:0.1},
    2:{k:0.08,EC50:2.5,n:1.8,la:0.3,lc:0.5,lf:0.2},
    3:{k:0.06,EC50:2,n:1.5,la:0.4,lc:0.5,lf:0.1},
    4:{k:0.04,EC50:2.5,n:1.5,la:0.1,lc:0.7,lf:0.2},
    5:{k:0.06,EC50:2,n:1.8,la:0.5,lc:0.4,lf:0.1},
    6:{k:0.06,EC50:2,n:1.5,la:0.3,lc:0.5,lf:0.2},
    7:{k:0.08,EC50:2,n:1.8,la:0.2,lc:0.5,lf:0.3}
  };
  const md=i.mode;
  const Tendon_mech=i.C_GH*0.3+i.Activityz*0.2;
  // M1: Anabolic stimulus
  const d1=dm(i.mTOR, m[1].k,m[1].EC50,m[1].n,md,'musculoskeletal',1);
  // M2: GH-tendons
  const d2=dm(Tendon_mech, m[2].k,m[2].EC50,m[2].n,md,'musculoskeletal',2);
  // M3: Training load
  const d3=dm(Math.abs(i.Activityz), m[3].k,m[3].EC50,m[3].n,md,'musculoskeletal',3);
  // M4: Age
  const d4=dm(0, m[4].k,m[4].EC50,m[4].n,md,'musculoskeletal',4); // placeholder - age would come from profile
  // M5: Sleep
  const d5=dm(-i.Sleepz, m[5].k,m[5].EC50,m[5].n,md,'musculoskeletal',5);
  // M6: Protein
  const d6=dm(-i.Proteinz, m[6].k,m[6].EC50,m[6].n,md,'musculoskeletal',6);
  // M7: Inflammation
  const d7=dm(i.Inflamm_core, m[7].k,m[7].EC50,m[7].n,md,'musculoskeletal',7);
  return [mkMech(1,d1,m[1]),mkMech(2,d2,m[2]),mkMech(3,d3,m[3]),mkMech(4,d4,m[4]),mkMech(5,d5,m[5]),mkMech(6,d6,m[6]),mkMech(7,d7,m[7])];
}

// ============================================================
// 11. CNS + NEUROTOXICITY — 7 mechanisms (spec File 3 Section 6.10)
// ============================================================
function computeNeuroTox(i: OrganInput): MechanismDamage[] {
  const m: Record<number,MP> = {
    1:{k:0.12,EC50:2,n:2,la:0.5,lc:0.4,lf:0.1},
    2:{k:0.10,EC50:2,n:2,la:0.6,lc:0.3,lf:0.1},
    3:{k:0.08,EC50:1.8,n:1.8,la:0.7,lc:0.3,lf:0},
    4:{k:0.10,EC50:2,n:2,la:0.3,lc:0.5,lf:0.2},
    5:{k:0.08,EC50:2,n:1.8,la:0.2,lc:0.6,lf:0.2},
    6:{k:0.06,EC50:2,n:1.5,la:0.4,lc:0.4,lf:0.2},
    7:{k:0.08,EC50:2,n:1.8,la:0.5,lc:0.4,lf:0.1}
  };
  const md=i.mode;
  const SC=hillTox(i.Stazh_cont,TX);
  // M1: AR neuromodulation
  const d1=dm(0.5*i.PRL_z+0.3*i.AR_eff+0.2*i.Stim_core, m[1].k,m[1].EC50,m[1].n,md,'neuro_toxicity',1);
  // M2: Glutamate excitotoxicity
  const d2=dm(0.5*i.Glu_z+0.3*i.Stim_core+0.2*i.IRz, m[2].k,m[2].EC50,m[2].n,md,'neuro_toxicity',2);
  // M3: GABA dysregulation
  const d3=dm(0.4*i.GABA_z+0.3*i.Dep_core+0.3*i.Psycho_core, m[3].k,m[3].EC50,m[3].n,md,'neuro_toxicity',3);
  // M4: Neuroinflammation
  const d4=dm(0.5*i.Inflamm_core+0.3*i.Oxid_core+0.2*i.S100b_z, m[4].k,m[4].EC50,m[4].n,md,'neuro_toxicity',4);
  // M5: Oxidative stress neurons
  const d5=dm(0.5*i.Oxid_core+0.3*i.Glu_z+0.2*SC, m[5].k,m[5].EC50,m[5].n,md,'neuro_toxicity',5);
  // M6: BBB permeability
  const d6=dm(0.4*i.S100b_z+0.3*i.Inflamm_core+0.3*i.BPz*0.1, m[6].k,m[6].EC50,m[6].n,md,'neuro_toxicity',6);
  // M7: Serotonin imbalance
  const d7=dm(0.4*i.Serotonin_z+0.3*i.Psycho_core+0.3*i.IRz*0.15, m[7].k,m[7].EC50,m[7].n,md,'neuro_toxicity',7);
  return [mkMech(1,d1,m[1]),mkMech(2,d2,m[2]),mkMech(3,d3,m[3]),mkMech(4,d4,m[4]),mkMech(5,d5,m[5]),mkMech(6,d6,m[6]),mkMech(7,d7,m[7])];
}

// ============================================================
// REPRODUCTIVE — 7 mechanisms (spec File 3 Section 6.11)
// ============================================================
function computeReproductive(i: OrganInput): MechanismDamage[] {
  const m: Record<number,MP> = {
    1:{k:0.14,EC50:2,n:2,la:0.2,lc:0.7,lf:0.1},
    2:{k:0.12,EC50:2,n:2,la:0.3,lc:0.6,lf:0.1},
    3:{k:0.08,EC50:2.5,n:1.8,la:0.2,lc:0.6,lf:0.2},
    4:{k:0.06,EC50:2.5,n:1.5,la:0.2,lc:0.6,lf:0.2},
    5:{k:0.10,EC50:2,n:2,la:0.2,lc:0.6,lf:0.2},
    6:{k:0.06,EC50:2.5,n:1.5,la:0.1,lc:0.6,lf:0.3},
    7:{k:0.10,EC50:2,n:2,la:0.3,lc:0.5,lf:0.2}
  };
  const md=i.mode;
  const SL=hillTox(i.Stazh_life,TX), SC2=hillTox(i.Stazh_cont,TX);
  // M1: Testicular atrophy
  const d1=dm(0.4*i.AR_eff+0.3*SL+0.3*i.ER_eff, m[1].k,m[1].EC50,m[1].n,md,'reproductive',1);
  // M2: Oligospermia
  const d2=dm(0.4*i.AR_eff+0.3*SL+0.3*i.ER_eff, m[2].k,m[2].EC50,m[2].n,md,'reproductive',2);
  // M3: Morphology
  const d3=dm(0.4*i.Oxid_core+0.3*i.Inflamm_core+0.3*SL, m[3].k,m[3].EC50,m[3].n,md,'reproductive',3);
  // M4: Motility
  const d4=dm(0.3*i.IRz+0.4*i.Oxid_core+0.3*i.Psycho_core, m[4].k,m[4].EC50,m[4].n,md,'reproductive',4);
  // M5: BPH
  const d5=dm(0.4*i.AR_eff+0.3*i.ER_eff+0.3*SL, m[5].k,m[5].EC50,m[5].n,md,'reproductive',5);
  // M6: Prostate cancer risk
  const d6=dm(0.4*i.AR_eff+0.3*i.IRz+0.3*i.Oxid_core, m[6].k,m[6].EC50,m[6].n,md,'reproductive',6);
  // M7: Erectile dysfunction
  const d7=dm(0.3*i.BPz+0.3*i.IRz+0.2*i.Psycho_core+0.2*i.ER_eff, m[7].k,m[7].EC50,m[7].n,md,'reproductive',7);
  return [mkMech(1,d1,m[1]),mkMech(2,d2,m[2]),mkMech(3,d3,m[3]),mkMech(4,d4,m[4]),mkMech(5,d5,m[5]),mkMech(6,d6,m[6]),mkMech(7,d7,m[7])];
}

// ============================================================
// Aggregate + Organ State Stepping
// ============================================================

function aggregate(mechanisms: MechanismDamage[], weights: Record<number, number>): { total: number; acute: number; chronic: number; fibrosis: number } {
  let total=0,acute=0,chronic=0,fibrosis=0;
  for (const m of mechanisms) {
    const w = weights[m.index] ?? 1/mechanisms.length;
    const wd = w*m.damage; total+=wd; acute+=wd*m.lambdaAcute; chronic+=wd*m.lambdaChronic; fibrosis+=wd*(1-m.lambdaAcute-m.lambdaChronic);
  }
  return { total: Math.max(0,Math.min(1,total)), acute, chronic, fibrosis };
}

function stepOrgan(p: OrganParams, dmg: { total:number; acute:number; chronic:number; fibrosis:number }, prev: OrganState, dt: number): OrganState {
  const rA = adaptiveRecovery(p.rBase, 1.0, 1.0, 1.0);
  const acute = stepOrganAcute(prev.acute, dmg.acute, rA, p.sigma, 0);
  const chronic = stepOrganChronic(prev.chronic, dmg.chronic, rA, p.sigma, 0);
  const fibrosis = stepFibrosis(prev.fibrosis, dmg.chronic, 0.05);
  const composite = compositeOrganState(acute, chronic, fibrosis, p);
  const hazard = hillHazard(composite, p.hMax, p.EC50h, p.nH);
  const pEvent = pEventFromHazard(hazard);
  return { acute: Math.max(0,Math.min(1,acute)), chronic: Math.max(0,Math.min(1,chronic)), fibrosis: Math.max(0,Math.min(1,fibrosis)), composite: Math.max(0,Math.min(1,composite)), cumRisk: prev.cumRisk+hazard*dt, hazard, pEvent: Math.min(1,pEvent) };
}

export interface OrganModuleResult {
  organKey: string; organName: string; params: OrganParams; mechanisms: MechanismDamage[];
  totalDamage: number; acuteDamage: number; chronicDamage: number; fibrosisDamage: number; state: OrganState;
}

const S0: OrganState = { acute:0, chronic:0, fibrosis:0, composite:0, cumRisk:0, hazard:0, pEvent:0 };

function makeResult(key: string, name: string, params: OrganParams, mechs: MechanismDamage[], weights: Record<number, number>): OrganModuleResult {
  const dmg = aggregate(mechs, weights);
  const state = stepOrgan(params, dmg, S0, 1);
  return { organKey:key, organName:name, params, mechanisms:mechs, totalDamage:dmg.total, acuteDamage:dmg.acute, chronicDamage:dmg.chronic, fibrosisDamage:dmg.fibrosis, state };
}

export interface AllOrgansResult {
  heart: OrganModuleResult; vessels: OrganModuleResult; liver: OrganModuleResult; kidney: OrganModuleResult;
  blood: OrganModuleResult; endocrine: OrganModuleResult; metabolic: OrganModuleResult; ghigf: OrganModuleResult;
  ins_axis: OrganModuleResult; musculoskeletal: OrganModuleResult; neuro_toxicity: OrganModuleResult;
  reproductive: OrganModuleResult;
}

export function computeAllOrgans(inp: OrganInput): AllOrgansResult {
  return {
    heart:          makeResult('heart','Сердце',HEART_P,computeHeart(inp),{1:0.15,2:0.15,3:0.10,4:0.12,5:0.13,6:0.12,7:0.23}),
    vessels:        makeResult('vessels','Сосуды',VESSEL_P,computeVessels(inp),{1:0.18,2:0.18,3:0.14,4:0.14,5:0.12,6:0.12,7:0.12}),
    liver:          makeResult('liver','Печень',LIVER_P,computeLiver(inp),{1:0.18,2:0.14,3:0.14,4:0.12,5:0.10,6:0.10,7:0.22}),
    kidney:         makeResult('kidney','Почки',KIDNEY_P,computeKidney(inp),{1:0.20,2:0.17,3:0.16,4:0.14,5:0.13,6:0.08,7:0.12}),
    blood:          makeResult('blood','Кровь',BLOOD_P,computeBlood(inp),{1:0.20,2:0.14,3:0.10,4:0.14,5:0.08,6:0.18,7:0.16}),
    endocrine:      makeResult('endocrine','Эндокринная',ENDO_P,computeEndocrine(inp),{1:0.22,2:0.16,3:0.14,4:0.13,5:0.10,6:0.11,7:0.14}),
    metabolic:      makeResult('metabolic','Метаболизм',META_P,computeMetabolic(inp),{1:0.18,2:0.16,3:0.12,4:0.10,5:0.14,6:0.14,7:0.16}),
    ghigf:          makeResult('ghigf','GH/IGF',GHIGF_P,computeGHIGF(inp),{1:0.20,2:0.15,3:0.12,4:0.10,5:0.10,6:0.08,7:0.25}),
    ins_axis:       makeResult('ins_axis','Инсулиновая ось',INS_P,computeInsAxis(inp),{1:0.55,2:0.45}),
    musculoskeletal:makeResult('musculoskeletal','Мышцы/ОДА',MUSCULO_P,computeMusculoskeletal(inp),{1:0.15,2:0.12,3:0.15,4:0.08,5:0.18,6:0.12,7:0.20}),
    neuro_toxicity: makeResult('neuro_toxicity','Нейротоксичность',NEURO_P,computeNeuroTox(inp),{1:0.18,2:0.15,3:0.13,4:0.17,5:0.14,6:0.10,7:0.13}),
    reproductive:   makeResult('reproductive','Репродуктивная',REPRO_P,computeReproductive(inp),{1:0.20,2:0.16,3:0.10,4:0.08,5:0.18,6:0.10,7:0.18}),
  };
}

export const ORGAN_PARAMS = {
  heart:HEART_P, vessels:VESSEL_P, liver:LIVER_P, kidney:KIDNEY_P,
  blood:BLOOD_P, endocrine:ENDO_P, metabolic:META_P, ghigf:GHIGF_P,
  ins_axis:INS_P, musculoskeletal:MUSCULO_P, neuro_toxicity:NEURO_P, reproductive:REPRO_P
};