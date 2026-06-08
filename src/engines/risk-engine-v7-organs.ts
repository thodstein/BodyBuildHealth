// ============================================================
// Health Engine v7.0 — Organ Modules
// 7 mechanisms per organ + Neurotoxicity
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
  ALTz: number; ASTz: number; eGFRz: number; Creatininez: number;
  AR_eff: number; ER_eff: number; IGF1R_eff: number; GHSR_eff: number;
  IR_eff: number; mTOR: number; C_GH: number;
  Inflamm_core: number; Oxid_core: number; Stim_core: number; Dep_core: number;
  Psycho_core: number; Smoke_core: number; Coag_core: number; Hypo_core: number;
  tOverT: number; Stazh_life: number; Stazh_cont: number;
  Sleepz: number; Stressz: number; Activityz: number; Alcoholz: number;
  DA_z: number; Glu_z: number; GABA_z: number; Serotonin_z: number;
  S100b_z: number; PRL_z: number;
  labValues: Record<string, number>;
  labRefs: Record<string, { mean: number; sd: number }>;
  mode: ProtocolMode;
  concentrations: Record<string, number>;
}

interface MP { k: number; EC50: number; n: number; la: number; lc: number; lf: number; }

const HEART_P: OrganParams = {rBase:0.03,sigma:0.02,wAcute:0.3,wChronic:0.5,wFibrosis:0.2,hMax:0.15,EC50h:0.4,nH:2.5};
const VESSEL_P: OrganParams = {rBase:0.025,sigma:0.015,wAcute:0.25,wChronic:0.55,wFibrosis:0.2,hMax:0.12,EC50h:0.35,nH:2.5};
const LIVER_P: OrganParams = {rBase:0.035,sigma:0.02,wAcute:0.2,wChronic:0.55,wFibrosis:0.25,hMax:0.18,EC50h:0.45,nH:2.5};
const KIDNEY_P: OrganParams = {rBase:0.025,sigma:0.015,wAcute:0.2,wChronic:0.6,wFibrosis:0.2,hMax:0.12,EC50h:0.35,nH:2.5};
const META_P: OrganParams = {rBase:0.02,sigma:0.01,wAcute:0.2,wChronic:0.65,wFibrosis:0.15,hMax:0.10,EC50h:0.3,nH:2.0};
const GHIGF_P: OrganParams = {rBase:0.02,sigma:0.01,wAcute:0.3,wChronic:0.6,wFibrosis:0.1,hMax:0.08,EC50h:0.3,nH:2.0};
const INS_P: OrganParams = {rBase:0.025,sigma:0.015,wAcute:0.35,wChronic:0.55,wFibrosis:0.1,hMax:0.10,EC50h:0.3,nH:2.0};
const NEURO_P: OrganParams = {rBase:0.02,sigma:0.015,wAcute:0.35,wChronic:0.5,wFibrosis:0.15,hMax:0.12,EC50h:0.35,nH:2.5};
const ENDO_P: OrganParams = {rBase:0.025,sigma:0.015,wAcute:0.2,wChronic:0.65,wFibrosis:0.15,hMax:0.14,EC50h:0.4,nH:2.5};
const HEMA_P: OrganParams = {rBase:0.03,sigma:0.02,wAcute:0.4,wChronic:0.45,wFibrosis:0.15,hMax:0.12,EC50h:0.35,nH:2.0};
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

function computeHeart(i: OrganInput): MechanismDamage[] {
  const BP=hillTox(i.BPz,TX),Hct=hillTox(i.Hctz,TX),Visc=hillTox(i.Viscz,TX),LVH=hillTox(i.LVHz,TX),
    Na=hillTox(i.NaH2O,TXL),Ath=hillTox(i.Athero,TX),Inf=hillTox(i.Inflamm_core,TXL),
    Ox=hillTox(i.Oxid_core,TXL),St=hillTox(i.Stim_core,TXS),SL=hillTox(i.Stazh_life,TX),SC=hillTox(i.Stazh_cont,TX),Cg=hillTox(i.Coag_core,TXL);
  const m: Record<number,MP> = {1:{k:0.15,EC50:2.5,n:2,la:0.6,lc:0.4,lf:0},2:{k:0.12,EC50:2,n:2,la:0.3,lc:0.7,lf:0},3:{k:0.10,EC50:2.5,n:2,la:0.7,lc:0.3,lf:0},4:{k:0.08,EC50:2,n:1.8,la:0.8,lc:0.2,lf:0},5:{k:0.14,EC50:2.5,n:2,la:0.2,lc:0.6,lf:0.2},6:{k:0.08,EC50:2,n:1.8,la:0.3,lc:0.5,lf:0.2},7:{k:0.06,EC50:2,n:1.5,la:0.1,lc:0.5,lf:0.4}};
  const md=i.mode;
  const d1=dm(i.BPz*i.tOverT+SL*0.3+SC*0.2, m[1].k,m[1].EC50,m[1].n,md,'heart',1);
  const d2=dm(0.4*i.AR_eff+0.4*i.mTOR+0.2*LVH, m[2].k,m[2].EC50,m[2].n,md,'heart',2);
  const d3=dm(0.5*Hct+0.3*Visc+0.2*Cg, m[3].k,m[3].EC50,m[3].n,md,'heart',3);
  const d4=dm(Na, m[4].k,m[4].EC50,m[4].n,md,'heart',4);
  const d5=dm(0.4*Ath+0.3*BP+0.3*Inf, m[5].k,m[5].EC50,m[5].n,md,'heart',5);
  const d6=dm(0.5*Ox+0.3*St+0.2*Inf, m[6].k,m[6].EC50,m[6].n,md,'heart',6);
  const d7=dm(0.35*d2+0.35*d5+0.30*(SL+SC)/2, m[7].k,m[7].EC50,m[7].n,md,'heart',7);
  return [mkMech(1,d1,m[1]),mkMech(2,d2,m[2]),mkMech(3,d3,m[3]),mkMech(4,d4,m[4]),mkMech(5,d5,m[5]),mkMech(6,d6,m[6]),mkMech(7,d7,m[7])];
}

function computeVessels(i: OrganInput): MechanismDamage[] {
  const m: Record<number,MP> = {1:{k:0.15,EC50:2.5,n:2,la:0.2,lc:0.6,lf:0.2},2:{k:0.12,EC50:2,n:2,la:0.5,lc:0.4,lf:0.1},3:{k:0.10,EC50:2,n:2,la:0.7,lc:0.3,lf:0},4:{k:0.08,EC50:2,n:1.8,la:0.3,lc:0.5,lf:0.2},5:{k:0.06,EC50:2,n:1.5,la:0.1,lc:0.5,lf:0.4}};
  const md=i.mode;
  const d1=dm(i.Athero+0.15*i.Smoke_core+0.1*i.Oxid_core,m[1].k,m[1].EC50,m[1].n,md,'vessels',1);
  const d2=dm(i.BPz+0.15*i.Stim_core+i.Inflamm_core*0.3,m[2].k,m[2].EC50,m[2].n,md,'vessels',2);
  const d3=dm(i.Coag_core,m[3].k,m[3].EC50,m[3].n,md,'vessels',3);
  const d4=dm(i.Oxid_core,m[4].k,m[4].EC50,m[4].n,md,'vessels',4);
  const d5=dm(0.35*d1+0.35*d2+0.30*d4,m[5].k,m[5].EC50,m[5].n,md,'vessels',5);
  return [mkMech(1,d1,m[1]),mkMech(2,d2,m[2]),mkMech(3,d3,m[3]),mkMech(4,d4,m[4]),mkMech(5,d5,m[5])];
}

function computeLiver(i: OrganInput): MechanismDamage[] {
  const m: Record<number,MP> = {1:{k:0.18,EC50:2,n:2,la:0.4,lc:0.4,lf:0.2},2:{k:0.12,EC50:2,n:2,la:0.2,lc:0.6,lf:0.2},3:{k:0.10,EC50:2,n:1.8,la:0.5,lc:0.4,lf:0.1},4:{k:0.08,EC50:2,n:1.5,la:0.1,lc:0.5,lf:0.4}};
  const md=i.mode; const T17=i.ALTz+i.ASTz+0.3*i.C_AAS_oral;
  const d1=dm(T17+0.2*i.Alcohol_core,m[1].k,m[1].EC50,m[1].n,md,'liver',1);
  const SC=i.TGz+i.IRz+0.15*i.Proteinz;
  const d2=dm(SC,m[2].k,m[2].EC50,m[2].n,md,'liver',2);
  const d3=dm(i.Inflamm_core,m[3].k,m[3].EC50,m[3].n,md,'liver',3);
  const i4=0.35*d1+0.35*d2+0.30*d3;
  const d4=dm(i4,m[4].k,m[4].EC50,m[4].n,md,'liver',4);
  return [mkMech(1,d1,m[1]),mkMech(2,d2,m[2]),mkMech(3,d3,m[3]),mkMech(4,d4,m[4])];
}

function computeKidney(i: OrganInput): MechanismDamage[] {
  const m: Record<number,MP> = {1:{k:0.14,EC50:2.5,n:2,la:0.3,lc:0.5,lf:0.2},2:{k:0.12,EC50:2,n:2,la:0.2,lc:0.6,lf:0.2},3:{k:0.08,EC50:2,n:1.8,la:0.4,lc:0.4,lf:0.2}};
  const md=i.mode; const Na=hillTox(i.NaH2O,TXL);
  const d1=dm(i.BPz+0.2*Na+0.15*i.IRz,m[1].k,m[1].EC50,m[1].n,md,'kidney',1);
  const FC=-i.eGFRz+i.Creatininez;
  const d2=dm(FC,m[2].k,m[2].EC50,m[2].n,md,'kidney',2);
  const d3=dm(i.Inflamm_core,m[3].k,m[3].EC50,m[3].n,md,'kidney',3);
  return [mkMech(1,d1,m[1]),mkMech(2,d2,m[2]),mkMech(3,d3,m[3])];
}

function computeMetabolic(i: OrganInput): MechanismDamage[] {
  const m: Record<number,MP> = {1:{k:0.15,EC50:2,n:2,la:0.2,lc:0.7,lf:0.1},2:{k:0.12,EC50:2.5,n:2,la:0.1,lc:0.7,lf:0.2},3:{k:0.08,EC50:2,n:1.8,la:0.3,lc:0.5,lf:0.2}};
  const md=i.mode; const GH=i.IGF1R_eff+i.C_GH;
  return [mkMech(1,dm(i.IRz,m[1].k,m[1].EC50,m[1].n,md,'metabolic',1),m[1]),mkMech(2,dm(i.Athero,m[2].k,m[2].EC50,m[2].n,md,'metabolic',2),m[2]),mkMech(3,dm(GH,m[3].k,m[3].EC50,m[3].n,md,'metabolic',3),m[3])];
}

function computeGHIGF(i: OrganInput): MechanismDamage[] {
  const m: Record<number,MP> = {1:{k:0.10,EC50:2,n:2,la:0.3,lc:0.6,lf:0.1},2:{k:0.08,EC50:2,n:1.8,la:0.6,lc:0.4,lf:0}};
  const md=i.mode; const GH2=0.5*i.C_GH+0.5*i.NaH2O;
  return [mkMech(1,dm(i.IGF1R_eff,m[1].k,m[1].EC50,m[1].n,md,'ghigf',1),m[1]),mkMech(2,dm(GH2,m[2].k,m[2].EC50,m[2].n,md,'ghigf',2),m[2])];
}

function computeInsAxis(i: OrganInput): MechanismDamage[] {
  const m: Record<number,MP> = {1:{k:0.14,EC50:2,n:2,la:0.2,lc:0.7,lf:0.1},2:{k:0.10,EC50:1.5,n:1.8,la:0.8,lc:0.2,lf:0}};
  const md=i.mode; const Hy=Math.max(0,i.Hypo_core);
  return [mkMech(1,dm(i.IRz,m[1].k,m[1].EC50,m[1].n,md,'ins_axis',1),m[1]),mkMech(2,dm(Hy,m[2].k,m[2].EC50,m[2].n,md,'ins_axis',2),m[2])];
}

function computeNeuroTox(i: OrganInput): MechanismDamage[] {
  const m: Record<number,MP> = {1:{k:0.12,EC50:2,n:2,la:0.5,lc:0.4,lf:0.1},2:{k:0.10,EC50:2,n:2,la:0.6,lc:0.3,lf:0.1},3:{k:0.08,EC50:1.8,n:1.8,la:0.7,lc:0.3,lf:0},4:{k:0.10,EC50:2,n:2,la:0.3,lc:0.5,lf:0.2},5:{k:0.08,EC50:2,n:1.8,la:0.2,lc:0.6,lf:0.2},6:{k:0.06,EC50:2,n:1.5,la:0.4,lc:0.4,lf:0.2},7:{k:0.08,EC50:2,n:1.8,la:0.5,lc:0.4,lf:0.1}};
  const md=i.mode; const SC=hillTox(i.Stazh_cont,TX);
  return [
    mkMech(1,dm(0.5*i.PRL_z+0.3*i.AR_eff+0.2*i.Stim_core,m[1].k,m[1].EC50,m[1].n,md,'neuro_toxicity',1),m[1]),
    mkMech(2,dm(0.5*i.Glu_z+0.3*i.Stim_core+0.2*i.IRz,m[2].k,m[2].EC50,m[2].n,md,'neuro_toxicity',2),m[2]),
    mkMech(3,dm(0.4*i.GABA_z+0.3*i.Dep_core+0.3*i.Psycho_core,m[3].k,m[3].EC50,m[3].n,md,'neuro_toxicity',3),m[3]),
    mkMech(4,dm(0.5*i.Inflamm_core+0.3*i.Oxid_core+0.2*i.S100b_z,m[4].k,m[4].EC50,m[4].n,md,'neuro_toxicity',4),m[4]),
    mkMech(5,dm(0.5*i.Oxid_core+0.3*i.Glu_z+0.2*SC,m[5].k,m[5].EC50,m[5].n,md,'neuro_toxicity',5),m[5]),
    mkMech(6,dm(0.4*i.S100b_z+0.3*i.Inflamm_core+0.3*i.BPz*0.1,m[6].k,m[6].EC50,m[6].n,md,'neuro_toxicity',6),m[6]),
    mkMech(7,dm(0.4*i.Serotonin_z+0.3*i.Psycho_core+0.3*i.IRz*0.15,m[7].k,m[7].EC50,m[7].n,md,'neuro_toxicity',7),m[7]),
  ];
}

function computeEndocrine(i: OrganInput): MechanismDamage[] {
  const m: Record<number,MP> = {1:{k:0.14,EC50:2,n:2,la:0.2,lc:0.7,lf:0.1},2:{k:0.12,EC50:2,n:2,la:0.3,lc:0.6,lf:0.1},3:{k:0.10,EC50:2,n:1.8,la:0.4,lc:0.5,lf:0.1},4:{k:0.08,EC50:2,n:1.8,la:0.2,lc:0.7,lf:0.1},5:{k:0.06,EC50:2,n:1.5,la:0.1,lc:0.7,lf:0.2},6:{k:0.08,EC50:2,n:1.8,la:0.3,lc:0.5,lf:0.2},7:{k:0.06,EC50:2,n:1.5,la:0.1,lc:0.6,lf:0.3}};
  const md=i.mode; const SL=hillTox(i.Stazh_life,TX),SC2=hillTox(i.Stazh_cont,TX);
  return [
    mkMech(1,dm(0.4*i.AR_eff+0.3*i.IRz+0.3*SL,m[1].k,m[1].EC50,m[1].n,md,'endocrine',1),m[1]),
    mkMech(2,dm(0.5*i.ER_eff+0.3*i.AR_eff+0.2*i.IRz,m[2].k,m[2].EC50,m[2].n,md,'endocrine',2),m[2]),
    mkMech(3,dm(0.5*i.PRL_z+0.3*i.Stim_core+0.2*i.Psycho_core,m[3].k,m[3].EC50,m[3].n,md,'endocrine',3),m[3]),
    mkMech(4,dm(i.IRz,m[4].k,m[4].EC50,m[4].n,md,'endocrine',4),m[4]),
    mkMech(5,dm(0.4*i.IRz+0.3*i.Inflamm_core+0.3*i.Oxid_core,m[5].k,m[5].EC50,m[5].n,md,'endocrine',5),m[5]),
    mkMech(6,dm(0.4*i.Psycho_core+0.3*i.Stressz+0.3*i.IRz,m[6].k,m[6].EC50,m[6].n,md,'endocrine',6),m[6]),
    mkMech(7,dm(0.35*i.AR_eff+0.35*i.ER_eff+0.3*SC2,m[7].k,m[7].EC50,m[7].n,md,'endocrine',7),m[7]),
  ];
}

function computeHematologic(i: OrganInput): MechanismDamage[] {
  const m: Record<number,MP> = {1:{k:0.14,EC50:2.5,n:2,la:0.5,lc:0.4,lf:0.1},2:{k:0.10,EC50:2,n:1.8,la:0.6,lc:0.3,lf:0.1},3:{k:0.06,EC50:2,n:1.5,la:0.4,lc:0.5,lf:0.1},4:{k:0.08,EC50:2,n:1.8,la:0.5,lc:0.4,lf:0.1},5:{k:0.05,EC50:2,n:1.5,la:0.2,lc:0.6,lf:0.2},6:{k:0.10,EC50:2,n:2,la:0.7,lc:0.3,lf:0},7:{k:0.06,EC50:2,n:1.5,la:0.3,lc:0.5,lf:0.2}};
  const md=i.mode;
  return [
    mkMech(1,dm(i.Hctz,m[1].k,m[1].EC50,m[1].n,md,'hematologic',1),m[1]),
    mkMech(2,dm(0.6*i.Hctz+0.4*i.Coag_core,m[2].k,m[2].EC50,m[2].n,md,'hematologic',2),m[2]),
    mkMech(3,dm(0.5*i.Inflamm_core+0.5*i.Stim_core,m[3].k,m[3].EC50,m[3].n,md,'hematologic',3),m[3]),
    mkMech(4,dm(0.4*i.Viscz+0.3*i.Hctz+0.3*i.Coag_core,m[4].k,m[4].EC50,m[4].n,md,'hematologic',4),m[4]),
    mkMech(5,dm(0.5*Math.abs(Math.min(0,-i.Hctz))+0.5*i.Inflamm_core,m[5].k,m[5].EC50,m[5].n,md,'hematologic',5),m[5]),
    mkMech(6,dm(i.Coag_core,m[6].k,m[6].EC50,m[6].n,md,'hematologic',6),m[6]),
    mkMech(7,dm(0.4*i.Oxid_core+0.3*i.Inflamm_core+0.3*i.C_AAS_oral,m[7].k,m[7].EC50,m[7].n,md,'hematologic',7),m[7]),
  ];
}

function computeReproductive(i: OrganInput): MechanismDamage[] {
  const m: Record<number,MP> = {1:{k:0.12,EC50:2,n:2,la:0.1,lc:0.7,lf:0.2},2:{k:0.10,EC50:2,n:1.8,la:0.1,lc:0.8,lf:0.1},3:{k:0.06,EC50:2,n:1.5,la:0.1,lc:0.7,lf:0.2},4:{k:0.05,EC50:2,n:1.5,la:0.2,lc:0.6,lf:0.2},5:{k:0.08,EC50:2,n:1.8,la:0.1,lc:0.7,lf:0.2},6:{k:0.06,EC50:2,n:1.5,la:0.1,lc:0.6,lf:0.3},7:{k:0.08,EC50:2,n:1.8,la:0.3,lc:0.5,lf:0.2}};
  const md=i.mode; const SL=hillTox(i.Stazh_life,TX);
  return [
    mkMech(1,dm(0.5*i.AR_eff+0.3*SL+0.2*i.IRz,m[1].k,m[1].EC50,m[1].n,md,'reproductive',1),m[1]),
    mkMech(2,dm(0.4*i.AR_eff+0.3*SL+0.3*i.ER_eff,m[2].k,m[2].EC50,m[2].n,md,'reproductive',2),m[2]),
    mkMech(3,dm(0.4*i.Oxid_core+0.3*i.Inflamm_core+0.3*SL,m[3].k,m[3].EC50,m[3].n,md,'reproductive',3),m[3]),
    mkMech(4,dm(0.3*i.IRz+0.4*i.Oxid_core+0.3*i.Psycho_core,m[4].k,m[4].EC50,m[4].n,md,'reproductive',4),m[4]),
    mkMech(5,dm(0.4*i.AR_eff+0.3*i.ER_eff+0.3*SL,m[5].k,m[5].EC50,m[5].n,md,'reproductive',5),m[5]),
    mkMech(6,dm(0.4*i.AR_eff+0.3*i.IRz+0.3*i.Oxid_core,m[6].k,m[6].EC50,m[6].n,md,'reproductive',6),m[6]),
    mkMech(7,dm(0.3*i.BPz+0.3*i.IRz+0.2*i.Psycho_core+0.2*i.ER_eff,m[7].k,m[7].EC50,m[7].n,md,'reproductive',7),m[7]),
  ];
}

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
  metabolic: OrganModuleResult; ghigf: OrganModuleResult; ins_axis: OrganModuleResult; neuro_toxicity: OrganModuleResult;
  endocrine: OrganModuleResult; hematologic: OrganModuleResult; reproductive: OrganModuleResult;
}

export function computeAllOrgans(inp: OrganInput): AllOrgansResult {
  return {
    heart:          makeResult('heart','Сердце',HEART_P,computeHeart(inp),{1:0.20,2:0.15,3:0.15,4:0.10,5:0.18,6:0.12,7:0.10}),
    vessels:        makeResult('vessels','Сосуды',VESSEL_P,computeVessels(inp),{1:0.25,2:0.25,3:0.20,4:0.15,5:0.15}),
    liver:          makeResult('liver','Печень',LIVER_P,computeLiver(inp),{1:0.30,2:0.25,3:0.20,4:0.25}),
    kidney:         makeResult('kidney','Почки',KIDNEY_P,computeKidney(inp),{1:0.40,2:0.35,3:0.25}),
    metabolic:      makeResult('metabolic','Метаболизм',META_P,computeMetabolic(inp),{1:0.40,2:0.35,3:0.25}),
    ghigf:          makeResult('ghigf','GH/IGF',GHIGF_P,computeGHIGF(inp),{1:0.60,2:0.40}),
    ins_axis:       makeResult('ins_axis','Инсулиновая ось',INS_P,computeInsAxis(inp),{1:0.55,2:0.45}),
    neuro_toxicity: makeResult('neuro_toxicity','Нейротоксичность',NEURO_P,computeNeuroTox(inp),{1:0.18,2:0.15,3:0.12,4:0.18,5:0.12,6:0.10,7:0.15}),
    endocrine:      makeResult('endocrine','Эндокринная',ENDO_P,computeEndocrine(inp),{1:0.20,2:0.18,3:0.15,4:0.14,5:0.12,6:0.10,7:0.11}),
    hematologic:    makeResult('hematologic','Кроветворная',HEMA_P,computeHematologic(inp),{1:0.18,2:0.15,3:0.10,4:0.14,5:0.08,6:0.20,7:0.15}),
    reproductive:   makeResult('reproductive','Репродуктивная',REPRO_P,computeReproductive(inp),{1:0.20,2:0.18,3:0.12,4:0.10,5:0.15,6:0.10,7:0.15}),
  };
}

export const ORGAN_PARAMS = {heart:HEART_P,vessels:VESSEL_P,liver:LIVER_P,kidney:KIDNEY_P,metabolic:META_P,ghigf:GHIGF_P,ins_axis:INS_P,neuro_toxicity:NEURO_P,endocrine:ENDO_P,hematologic:HEMA_P,reproductive:REPRO_P};


