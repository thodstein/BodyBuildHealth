import { buildClinicalStack } from '../src/engines/biostack-clinical-recommender.ts';

const baseProfile = {
  age: 30, weight: 80, height: 180, sex: 'male', experience: 'advanced',
  healthConditions: [], avoidIds: [], avoidMeds: [], targetOrgans: [],
  targetSystems: [], currentMeds: [], drugAllergies: [], jointSymptoms: [],
  neuroSymptoms: [], cnsSymptoms: [], injuries: [], currentSupplements: [],
  autoFilledFields: [],
} as any;

function scenario(name: string, profile: any, opts: any) {
  const r = buildClinicalStack(profile, opts);
  console.log(`\n=== ${name} ===`);
  console.log('substances:', r.substances.map(s => s.id));
  console.log('excluded:', r.excluded.length);
  console.log('coverage:', r.coveragePercent);
}

// 1) Liver-only filter (the original bug report)
scenario('liver-only filter', baseProfile, {
  filterOrgans: ['hepatic'], filterMechanisms: [], filterMarkers: [],
  evidenceLevel: 'all', maxStackSize: 20, useCourse: false, useLabs: false, useProfile: true,
});

// 2) No filters, no course — baseline orientational stack
scenario('no filters baseline', baseProfile, {
  filterOrgans: [], filterMechanisms: [], filterMarkers: [],
  evidenceLevel: 'all', maxStackSize: 20, useCourse: false, useLabs: false, useProfile: true,
});

// 3) Cardio filter should keep cardio-relevant and exclude liver-only
scenario('cardio-only filter', { ...baseProfile, targetOrgans: ['cardio'] }, {
  filterOrgans: ['cardio'], filterMechanisms: [], filterMarkers: [],
  evidenceLevel: 'all', maxStackSize: 20, useCourse: false, useLabs: false, useProfile: true,
});

// 4) Multiple organs (hepatic + cardio)
scenario('hepatic+cardio filter', { ...baseProfile, targetOrgans: ['hepatic', 'cardio'] }, {
  filterOrgans: ['hepatic', 'cardio'], filterMechanisms: [], filterMarkers: [],
  evidenceLevel: 'all', maxStackSize: 20, useCourse: false, useLabs: false, useProfile: true,
});

// 5) Mechanism filter (cv1 = cardiac remodelling)
scenario('cv1 mechanism filter', baseProfile, {
  filterOrgans: [], filterMechanisms: ['cv1'], filterMarkers: [],
  evidenceLevel: 'all', maxStackSize: 20, useCourse: false, useLabs: false, useProfile: true,
});

// 6) With course (AAS) but no organic filter
const courseProfile = {
  ...baseProfile,
  currentMeds: ['test_enan'],
  avoidMeds: [],
};
scenario('course + no filter', courseProfile, {
  filterOrgans: [], filterMechanisms: [], filterMarkers: [],
  evidenceLevel: 'all', maxStackSize: 20, useCourse: true, useLabs: false, useProfile: true,
});

// 7) With course + liver filter (should keep hCG/AI/TUDCA/NAC but drop magnesium/CoQ10)
scenario('course + liver filter', courseProfile, {
  filterOrgans: ['hepatic'], filterMechanisms: [], filterMarkers: [],
  evidenceLevel: 'all', maxStackSize: 20, useCourse: true, useLabs: false, useProfile: true,
});

// 8) Renal-only filter (should include kidney-relevant: potassium, magnesium, alpha_lipoic, cordyceps, etc.)
scenario('renal-only filter', baseProfile, {
  filterOrgans: ['renal'], filterMechanisms: [], filterMarkers: [],
  evidenceLevel: 'all', maxStackSize: 20, useCourse: false, useLabs: false, useProfile: true,
});

// 9) CNS-only filter (should include nervous system: magnesium, zinc, omega3, l_theanine, etc.)
scenario('cns-only filter', baseProfile, {
  filterOrgans: ['cns'], filterMechanisms: [], filterMarkers: [],
  evidenceLevel: 'all', maxStackSize: 20, useCourse: false, useLabs: false, useProfile: true,
});

// 10) Reproductive-only filter (should include tongkat, ashwagandha, zinc, etc.)
scenario('reproductive-only filter', baseProfile, {
  filterOrgans: ['reproductive'], filterMechanisms: [], filterMarkers: [],
  evidenceLevel: 'all', maxStackSize: 20, useCourse: false, useLabs: false, useProfile: true,
});

// 11) Hematologic-only filter (should include iron, b12, folate, aspirin, etc.)
scenario('hematologic-only filter', baseProfile, {
  filterOrgans: ['hematologic'], filterMechanisms: [], filterMarkers: [],
  evidenceLevel: 'all', maxStackSize: 20, useCourse: false, useLabs: false, useProfile: true,
});

// 12) Multi-organ: renal+cardio filter
scenario('renal+cardio filter', baseProfile, {
  filterOrgans: ['renal', 'cardio'], filterMechanisms: [], filterMarkers: [],
  evidenceLevel: 'all', maxStackSize: 20, useCourse: false, useLabs: false, useProfile: true,
});
