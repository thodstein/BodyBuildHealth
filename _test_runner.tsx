try {
const { calculateSupportPlan } = require('./src/engines/support-plan-engine');
console.log('Engine loaded OK');
const state = {
  profile: { weight: 80, age: 30, sex: 'male', workoutsPerWeek: 4, avgWorkoutMinutes: 60, sleepHours: 7, stressLevel: 5, smoker: false, alcohol: 'rare', caffeineMg: 200, bodyfat: 15 },
  pharma: { phase: 'course', aas: [{ id: 'testosterone_enanthate', doseMgWeek: 500, weeks: 12 }, { id: 'trenbolone_acetate', doseMgWeek: 300, weeks: 10 }], hasGH: false, hasIGF: false, hasInsulin: false, hasHCG: false, hasAI: false, hasCaber: false, hasSERM: false, hasSARMs: false, hasMGF: false, hasGLP1: false },
  goals: { healthMaintenance: false, competitionPrep: false, sleepRecovery: false, lipidCorrection: false, bloodThinning: false, liverDetox: false, bpControl: false, trainingCycle: 'maintenance', cycleWeeks: 12, previousCycles: 0, timeSinceLastCycle: 'none' },
  neuro: { dopamineScore: 0, serotoninScore: 0, gabaBalance: 'balance', memoryIssues: false, focusIssues: false, slowThinking: false, coordinationIssues: false, aggressionScore: 2, headaches: false, weatherDependent: false, sleepQuality: 'good' },
  hepatobiliary: { altAstElevation: 'none', ggtElevation: 'none', bilirubinElevation: 'none', fattyLiver: false, cholecystitis: false, alcoholHistory: 'none' },
  urinary: { creatinineElevation: 'none', ureaElevation: 'none', proteinuria: false, nephrotoxicDrugs: false, hypertension: false, diabetes: false, urinationPattern: 'normal' },
  cardio: { bpStage: 'normal', heartRate: 72, ldlElevation: 'none', hdlLow: false, triglycerides: 'normal', hctElevation: 'none', previousCVD: false, familyCVD: false },
  oda: { jointPain: 'none', ligamentIssues: false, backPain: false, injuries: [] },
  nutrition: { calories: 3000, proteinG: 200, fatG: 80, carbsG: 350, waterL: 3, saltIntake: 'normal', omega3: false, fiberG: 30, proteinGPerKg: 2.5, sodiumMg: 3000, potassiumMg: 3000 },
  contraindications: { allergies: '', hasCVD: false, hasThrombophilia: false, hasGI: false, hasProstateIssues: false, hasDiabetes: false, hasEpilepsy: false, hasMentalIllness: false, hasLiverDisease: false, hasKidneyDisease: false },
  labs: { preCourse: null, midCourse: null, postPCT: null, fullPanel: null },
  journal: { positive: [], negative: [] },
  epicrisis: { pastGyno: false, pastLibidoDrop: false, pastHctSpike: false, pastLiverIssues: false, pastKidneyIssues: false },
  toxicLoad: { hazardousWork: false, regularNSAIDs: false, otherHeavyDrugs: false, bowelFrequency: 'regular' },
  dental: { bleedingGums: false, looseTeeth: false, nightGrinding: false, boneFractures: false, cramps: false },
  genetics: { cyp19a1: 'unknown', srd5a2: 'unknown', arSensitivity: 'unknown', mthfr: 'unknown' },
  gi: { bloating: false, heartburn: false, diarrhea: false, constipation: false, diagnosedIBS: false, enzymeSupport: false, probioticUse: false },
  psych: { fearOfLoss: 1, mirrorObsession: 1, apathyOffCycle: 1 },
  injection: { glutes: 'ok', quads: 'ok', delts: 'ok', localAreas: '' },
  powerLevel: 'basic', courseWeek: 8
};
const result = calculateSupportPlan(state, 'basic', []);
console.log('Total substances:', result.substances.length);
console.log('First 20:', result.substances.slice(0,20).map(s=>s.id+'('+s.tier+')').join(', '));
console.log('Risk:', result.overallRiskBefore+'->'+result.overallRiskAfter+'%');
} catch(e) { console.error('ERROR:', e.message); }
