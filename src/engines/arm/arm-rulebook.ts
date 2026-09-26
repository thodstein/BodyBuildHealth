export type RulebookSchemaVersion = 1;
export type RulebookAuthority = 'WAF' | 'Armlifting USA';
export type RulebookScope = 'waf_championships' | 'event_specific_examples';
export type ArmSex = 'male' | 'female';
export type ArmSide = 'left' | 'right';
export type WafAgeGroup =
  | 'sub_junior_15'
  | 'junior_18'
  | 'youth_23'
  | 'senior'
  | 'masters_40_49'
  | 'grand_masters_50_59'
  | 'senior_grand_masters_60_69'
  | 'super_senior_grand_masters_70'
  | 'para_adult'
  | 'para_junior_23';
/**
 * Wave-1 Э1.5: тип ПЕРЕИСПОЛЬЗУЕТСЯ из канона `arm-waf.engine.ts` (type-only, без рантайм-связи),
 * раньше был продублирован тут дословно. Причина: два объявления одного union — это два
 * места, где список Para-классов может разъехаться, а он задаёт и категории 2025, и билдер.
 * Свой экспорт сохранён: `index.ts` реэкспортит его как `RulebookWafParaClass`.
 */
export type { WafParaClass } from './arm-waf.engine';
import type { WafParaClass } from './arm-waf.engine';
export type WafCategoryAgeBand = 'standard' | 'para_adult' | 'para_junior_23';
export type WafParaStyle = 'sit_down' | 'stand_up';

export interface WafWeightClass {
  readonly id: string;
  readonly label: string;
  readonly limitKg: number | null;
  readonly open: boolean;
}

export interface WafAgeRule {
  readonly minYears: number | null;
  readonly maxYears: number | null;
  readonly basis: 'calendar_year' | 'category_label';
}

export interface WafCategoryRule {
  readonly id: string;
  readonly label: string;
  readonly ageGroup: WafAgeGroup;
  readonly ageBand: WafCategoryAgeBand;
  readonly ageRule: WafAgeRule;
  readonly paraClass: WafParaClass;
  readonly style: WafParaStyle | null;
  readonly sexes: readonly ArmSex[];
  readonly weightClassesBySex: Readonly<Record<ArmSex, readonly WafWeightClass[]>>;
  readonly registrationRules: readonly string[];
}

export interface WafWeighInRules {
  readonly clothingAllowanceKg: 0;
  readonly approvedScaleRequired: true;
  readonly windowHoursBeforeCompetition: { readonly min: number; readonly max: number };
  readonly artificialLimbsIncludedRequired: true;
  readonly weightMustRegisterToZero: true;
}

export interface WafBracketRules {
  readonly format: 'double_elimination';
  readonly lossesToEliminate: 2;
  readonly seeding: 'none';
  readonly draw: 'luck_of_draw';
  readonly firstRoundSameCountry: 'avoid_if_possible';
  readonly rematch: 'avoid_except_place_standing';
  readonly callToTableSeconds: 60;
  readonly boutTimeLimit: 'none';
}

export interface WafRuleset {
  readonly kind: 'waf';
  readonly version: '2025';
  readonly categories: readonly WafCategoryRule[];
  readonly leftAndRightSeparateDays: true;
  readonly weighIn: WafWeighInRules;
  readonly bracket: WafBracketRules;
  readonly sourceSections: readonly string[];
}

export type ArmliftingUsaImplement = 'apollon_axle' | 'saxon_bar' | 'grandfather_clock';
export type ArmliftingAttemptMode = 'unlimited' | 'three_increasing_weights';
export type ArmliftingMissConsequence = 'eliminate_from_event' | 'not_specified';
export type ArmliftingWeightOrder = 'increasing' | 'not_specified';

export interface ArmliftingAttemptPolicy {
  readonly mode: ArmliftingAttemptMode;
  readonly maxAttempts: number | 'unlimited';
  readonly timeLimitSeconds: 60;
  readonly missConsequence: ArmliftingMissConsequence;
  readonly weightOrder: ArmliftingWeightOrder;
}

export interface ImplementProtocol {
  readonly id: string;
  readonly implement: ArmliftingUsaImplement;
  readonly name: string;
  readonly eventExampleId: string;
  readonly scope: 'event_specific';
  readonly attemptPolicy: ArmliftingAttemptPolicy;
  readonly sourceSections: readonly string[];
  readonly verified: true;
}

export interface ArmliftingUsaRuleset {
  readonly kind: 'armlifting_usa';
  readonly version: '2026';
  readonly protocols: readonly ImplementProtocol[];
  readonly globalRulesDefined: false;
  readonly sourceSections: readonly string[];
}

export type RulebookRules = WafRuleset | ArmliftingUsaRuleset;

export interface RulebookSource {
  readonly authority: RulebookAuthority;
  readonly title: string;
  readonly url: string;
  readonly verifiedAt: string;
  readonly sections: readonly string[];
}

export interface RulebookSnapshot {
  readonly schemaVersion: RulebookSchemaVersion;
  readonly id: string;
  readonly authority: RulebookAuthority;
  readonly version: string;
  readonly title: string;
  readonly scope: RulebookScope;
  readonly verifiedAt: string;
  readonly sources: readonly RulebookSource[];
  readonly limitations: readonly string[];
  readonly rules: RulebookRules;
}

export interface RulebookRegistry {
  readonly schemaVersion: RulebookSchemaVersion;
  readonly snapshots: readonly RulebookSnapshot[];
}

function makeWeightClasses(
  limits: readonly number[],
  openLimit: number | undefined,
): readonly WafWeightClass[] {
  const capped = limits.map((limit) => ({ id: String(limit), label: String(limit), limitKg: limit, open: false }));
  if (openLimit === undefined) return capped;
  return [...capped, { id: `+${openLimit}`, label: `+${openLimit}`, limitKg: null, open: true }];
}

function makeCategory(input: {
  id: string;
  label: string;
  ageGroup: WafAgeGroup;
  ageBand?: WafCategoryAgeBand;
  ageRule?: WafAgeRule;
  paraClass?: WafParaClass;
  style?: WafParaStyle;
  sexes: readonly ArmSex[];
  maleLimits: readonly number[];
  maleOpenLimit: number;
  femaleLimits?: readonly number[];
  femaleOpenLimit?: number;
  registrationRules?: readonly string[];
}): WafCategoryRule {
  return {
    id: input.id,
    label: input.label,
    ageGroup: input.ageGroup,
    ageBand: input.ageBand ?? 'standard',
    ageRule: input.ageRule ?? { minYears: null, maxYears: null, basis: 'calendar_year' },
    paraClass: input.paraClass ?? 'none',
    style: input.style ?? null,
    sexes: input.sexes,
    weightClassesBySex: {
      male: input.sexes.includes('male')
        ? makeWeightClasses(input.maleLimits, input.maleOpenLimit)
        : [],
      female: input.sexes.includes('female')
        ? makeWeightClasses(input.femaleLimits ?? input.maleLimits, input.femaleOpenLimit ?? input.maleOpenLimit)
        : [],
    },
    registrationRules: input.registrationRules ?? [],
  };
}

const WAF_2025_CATEGORIES: readonly WafCategoryRule[] = [
  makeCategory({
    id: 'senior-male',
    label: 'Senior Men',
    ageGroup: 'senior',
    sexes: ['male'],
    maleLimits: [55, 60, 65, 70, 75, 80, 85, 90, 100, 110],
    maleOpenLimit: 110,
  }),
  makeCategory({
    id: 'senior-female',
    label: 'Senior Women',
    ageGroup: 'senior',
    sexes: ['female'],
    maleLimits: [],
    maleOpenLimit: 90,
    femaleLimits: [50, 55, 60, 65, 70, 80, 90],
    femaleOpenLimit: 90,
  }),
  makeCategory({
    id: 'masters-40-49-male',
    label: 'Masters 40-49 Men',
    ageGroup: 'masters_40_49',
    ageRule: { minYears: 40, maxYears: 49, basis: 'calendar_year' },
    sexes: ['male'],
    maleLimits: [60, 70, 80, 90, 100, 110],
    maleOpenLimit: 110,
    registrationRules: ['masters_may_register_in_senior'],
  }),
  makeCategory({
    id: 'masters-40-49-female',
    label: 'Masters 40-49 Women',
    ageGroup: 'masters_40_49',
    ageRule: { minYears: 40, maxYears: 49, basis: 'calendar_year' },
    sexes: ['female'],
    maleLimits: [],
    maleOpenLimit: 80,
    femaleLimits: [60, 70, 80],
    femaleOpenLimit: 80,
    registrationRules: ['masters_may_register_in_senior'],
  }),
  makeCategory({
    id: 'grand-masters-50-59-male',
    label: 'Grand Masters 50-59 Men',
    ageGroup: 'grand_masters_50_59',
    ageRule: { minYears: 50, maxYears: 59, basis: 'calendar_year' },
    sexes: ['male'],
    maleLimits: [70, 80, 90, 100],
    maleOpenLimit: 100,
    registrationRules: ['masters_may_register_in_senior'],
  }),
  makeCategory({
    id: 'grand-masters-50-59-female',
    label: 'Grand Masters 50-59 Women',
    ageGroup: 'grand_masters_50_59',
    ageRule: { minYears: 50, maxYears: 59, basis: 'calendar_year' },
    sexes: ['female'],
    maleLimits: [],
    maleOpenLimit: 80,
    femaleLimits: [60, 70, 80],
    femaleOpenLimit: 80,
    registrationRules: ['masters_may_register_in_senior'],
  }),
  makeCategory({
    id: 'senior-grand-masters-60-69-male',
    label: 'Senior Grand Masters 60-69 Men',
    ageGroup: 'senior_grand_masters_60_69',
    ageRule: { minYears: 60, maxYears: 69, basis: 'calendar_year' },
    sexes: ['male'],
    maleLimits: [70, 80, 90, 100],
    maleOpenLimit: 100,
    registrationRules: ['masters_may_register_in_senior'],
  }),
  makeCategory({
    id: 'super-senior-grand-masters-70-male',
    label: 'Super Senior Grand Masters 70+ Men',
    ageGroup: 'super_senior_grand_masters_70',
    ageRule: { minYears: 70, maxYears: null, basis: 'calendar_year' },
    sexes: ['male'],
    maleLimits: [],
    maleOpenLimit: 100,
    registrationRules: ['masters_may_register_in_senior'],
  }),
  makeCategory({
    id: 'sub-junior-15-male',
    label: 'Sub-Junior 15 Boys',
    ageGroup: 'sub_junior_15',
    ageRule: { minYears: 14, maxYears: 15, basis: 'calendar_year' },
    sexes: ['male'],
    maleLimits: [45, 50, 55, 60, 65, 70],
    maleOpenLimit: 70,
    registrationRules: ['sub_junior_cannot_register_in_other_class'],
  }),
  makeCategory({
    id: 'sub-junior-15-female',
    label: 'Sub-Junior 15 Girls',
    ageGroup: 'sub_junior_15',
    ageRule: { minYears: 14, maxYears: 15, basis: 'calendar_year' },
    sexes: ['female'],
    maleLimits: [],
    maleOpenLimit: 70,
    femaleLimits: [40, 45, 50, 55, 60, 70],
    femaleOpenLimit: 70,
    registrationRules: ['sub_junior_cannot_register_in_other_class'],
  }),
  makeCategory({
    id: 'junior-18-male',
    label: 'Junior 18 Boys',
    ageGroup: 'junior_18',
    ageRule: { minYears: 16, maxYears: 18, basis: 'calendar_year' },
    sexes: ['male'],
    maleLimits: [50, 55, 60, 65, 70, 75, 80, 90],
    maleOpenLimit: 90,
    registrationRules: ['junior_cannot_register_in_youth', 'junior_may_register_in_senior'],
  }),
  makeCategory({
    id: 'junior-18-female',
    label: 'Junior 18 Girls',
    ageGroup: 'junior_18',
    ageRule: { minYears: 16, maxYears: 18, basis: 'calendar_year' },
    sexes: ['female'],
    maleLimits: [],
    maleOpenLimit: 70,
    femaleLimits: [45, 50, 55, 60, 65, 70],
    femaleOpenLimit: 70,
    registrationRules: ['junior_cannot_register_in_youth', 'junior_may_register_in_senior'],
  }),
  makeCategory({
    id: 'youth-23-male',
    label: 'Youth 23 Men',
    ageGroup: 'youth_23',
    ageRule: { minYears: 19, maxYears: 23, basis: 'calendar_year' },
    sexes: ['male'],
    maleLimits: [55, 60, 65, 70, 75, 80, 85, 90, 100, 110],
    maleOpenLimit: 110,
    registrationRules: ['youth_may_register_in_senior'],
  }),
  makeCategory({
    id: 'youth-23-female',
    label: 'Youth 23 Women',
    ageGroup: 'youth_23',
    ageRule: { minYears: 19, maxYears: 23, basis: 'calendar_year' },
    sexes: ['female'],
    maleLimits: [],
    maleOpenLimit: 90,
    femaleLimits: [50, 55, 60, 65, 70, 80, 90],
    femaleOpenLimit: 90,
    registrationRules: ['youth_may_register_in_senior'],
  }),
  makeCategory({
    id: 'para-pid-adult-male',
    label: 'Para PID Adult Men',
    ageGroup: 'para_adult',
    ageBand: 'para_adult',
    paraClass: 'PID',
    style: 'sit_down',
    sexes: ['male'],
    maleLimits: [55, 65, 75, 100],
    maleOpenLimit: 100,
  }),
  makeCategory({
    id: 'para-pid-adult-female',
    label: 'Para PID Adult Women',
    ageGroup: 'para_adult',
    ageBand: 'para_adult',
    paraClass: 'PID',
    style: 'sit_down',
    sexes: ['female'],
    maleLimits: [],
    maleOpenLimit: 65,
    femaleLimits: [55, 65],
    femaleOpenLimit: 65,
  }),
  makeCategory({
    id: 'para-piu-adult-male',
    label: 'Para PIU Adult Men',
    ageGroup: 'para_adult',
    ageBand: 'para_adult',
    paraClass: 'PIU',
    style: 'stand_up',
    sexes: ['male'],
    maleLimits: [60, 70, 80, 90],
    maleOpenLimit: 90,
  }),
  makeCategory({
    id: 'para-piu-adult-female',
    label: 'Para PIU Adult Women',
    ageGroup: 'para_adult',
    ageBand: 'para_adult',
    paraClass: 'PIU',
    style: 'stand_up',
    sexes: ['female'],
    maleLimits: [],
    maleOpenLimit: 65,
    femaleLimits: [55, 65],
    femaleOpenLimit: 65,
  }),
  makeCategory({
    id: 'para-piu-junior-23-male',
    label: 'Para PIU Junior 23 Boys',
    ageGroup: 'para_junior_23',
    ageBand: 'para_junior_23',
    ageRule: { minYears: 19, maxYears: 23, basis: 'calendar_year' },
    paraClass: 'PIU',
    style: 'stand_up',
    sexes: ['male'],
    maleLimits: [55, 65],
    maleOpenLimit: 65,
  }),
  makeCategory({
    id: 'para-piu-junior-23-female',
    label: 'Para PIU Junior 23 Girls',
    ageGroup: 'para_junior_23',
    ageBand: 'para_junior_23',
    ageRule: { minYears: 19, maxYears: 23, basis: 'calendar_year' },
    paraClass: 'PIU',
    style: 'stand_up',
    sexes: ['female'],
    maleLimits: [],
    maleOpenLimit: 50,
    femaleLimits: [50],
    femaleOpenLimit: 50,
  }),
  makeCategory({
    id: 'para-pidh-adult-male',
    label: 'Para PIDH Adult Men',
    ageGroup: 'para_adult',
    ageBand: 'para_adult',
    paraClass: 'PIDH',
    style: 'sit_down',
    sexes: ['male'],
    maleLimits: [80],
    maleOpenLimit: 80,
  }),
  makeCategory({
    id: 'para-piuh-adult-male',
    label: 'Para PIUH Adult Men',
    ageGroup: 'para_adult',
    ageBand: 'para_adult',
    paraClass: 'PIUH',
    style: 'stand_up',
    sexes: ['male'],
    maleLimits: [85],
    maleOpenLimit: 85,
  }),
  makeCategory({
    id: 'para-piuh-adult-female',
    label: 'Para PIUH Adult Women',
    ageGroup: 'para_adult',
    ageBand: 'para_adult',
    paraClass: 'PIUH',
    style: 'stand_up',
    sexes: ['female'],
    maleLimits: [],
    maleOpenLimit: 65,
    femaleLimits: [65],
    femaleOpenLimit: 65,
  }),
  makeCategory({
    id: 'para-piuh-junior-23-male',
    label: 'Para PIUH Junior 23 Boys',
    ageGroup: 'para_junior_23',
    ageBand: 'para_junior_23',
    ageRule: { minYears: 19, maxYears: 23, basis: 'calendar_year' },
    paraClass: 'PIUH',
    style: 'stand_up',
    sexes: ['male'],
    maleLimits: [60],
    maleOpenLimit: 60,
  }),
  makeCategory({
    id: 'para-vi-adult-male',
    label: 'Para VI Adult Men',
    ageGroup: 'para_adult',
    ageBand: 'para_adult',
    paraClass: 'VI',
    style: 'stand_up',
    sexes: ['male'],
    maleLimits: [60, 70, 80, 90, 100],
    maleOpenLimit: 100,
  }),
  makeCategory({
    id: 'para-vi-adult-female',
    label: 'Para VI Adult Women',
    ageGroup: 'para_adult',
    ageBand: 'para_adult',
    paraClass: 'VI',
    style: 'stand_up',
    sexes: ['female'],
    maleLimits: [],
    maleOpenLimit: 70,
    femaleLimits: [60, 70],
    femaleOpenLimit: 70,
  }),
  makeCategory({
    id: 'para-vi-junior-23-male',
    label: 'Para VI Junior 23 Boys',
    ageGroup: 'para_junior_23',
    ageBand: 'para_junior_23',
    ageRule: { minYears: 19, maxYears: 23, basis: 'calendar_year' },
    paraClass: 'VI',
    style: 'stand_up',
    sexes: ['male'],
    maleLimits: [55, 65],
    maleOpenLimit: 65,
  }),
  makeCategory({
    id: 'para-vi-junior-23-female',
    label: 'Para VI Junior 23 Girls',
    ageGroup: 'para_junior_23',
    ageBand: 'para_junior_23',
    ageRule: { minYears: 19, maxYears: 23, basis: 'calendar_year' },
    paraClass: 'VI',
    style: 'stand_up',
    sexes: ['female'],
    maleLimits: [],
    maleOpenLimit: 50,
    femaleLimits: [50],
    femaleOpenLimit: 50,
  }),
  makeCategory({
    id: 'para-hi-adult-male',
    label: 'Para HI Adult Men',
    ageGroup: 'para_adult',
    ageBand: 'para_adult',
    paraClass: 'HI',
    style: 'stand_up',
    sexes: ['male'],
    maleLimits: [60, 70, 80, 90, 100],
    maleOpenLimit: 100,
  }),
  makeCategory({
    id: 'para-hi-adult-female',
    label: 'Para HI Adult Women',
    ageGroup: 'para_adult',
    ageBand: 'para_adult',
    paraClass: 'HI',
    style: 'stand_up',
    sexes: ['female'],
    maleLimits: [],
    maleOpenLimit: 70,
    femaleLimits: [60, 70],
    femaleOpenLimit: 70,
  }),
  makeCategory({
    id: 'para-hi-junior-23-male',
    label: 'Para HI Junior 23 Boys',
    ageGroup: 'para_junior_23',
    ageBand: 'para_junior_23',
    ageRule: { minYears: 19, maxYears: 23, basis: 'calendar_year' },
    paraClass: 'HI',
    style: 'stand_up',
    sexes: ['male'],
    maleLimits: [55, 65],
    maleOpenLimit: 65,
  }),
  makeCategory({
    id: 'para-hi-junior-23-female',
    label: 'Para HI Junior 23 Girls',
    ageGroup: 'para_junior_23',
    ageBand: 'para_junior_23',
    ageRule: { minYears: 19, maxYears: 23, basis: 'calendar_year' },
    paraClass: 'HI',
    style: 'stand_up',
    sexes: ['female'],
    maleLimits: [],
    maleOpenLimit: 50,
    femaleLimits: [50],
    femaleOpenLimit: 50,
  }),
  makeCategory({
    id: 'para-cpd-adult-male',
    label: 'Para CPD Adult Men',
    ageGroup: 'para_adult',
    ageBand: 'para_adult',
    paraClass: 'CPD',
    style: 'sit_down',
    sexes: ['male'],
    maleLimits: [55, 65],
    maleOpenLimit: 65,
  }),
  makeCategory({
    id: 'para-cpu-adult-male',
    label: 'Para CPU Adult Men',
    ageGroup: 'para_adult',
    ageBand: 'para_adult',
    paraClass: 'CPU',
    style: 'stand_up',
    sexes: ['male'],
    maleLimits: [60, 70, 80],
    maleOpenLimit: 80,
  }),
];

const WAF_SOURCE: RulebookSource = {
  authority: 'WAF',
  title: 'WAF Rules & Regulations (version 2025)',
  url: 'https://www.waf-armwrestling.com/wp-content/uploads/2025/05/2025-WAF-Rules.pdf',
  verifiedAt: '2026-09-25',
  sections: ['1.3', '1.4', '1.5', '4.1.2', '5.1', '5.2.2'],
};

const ARMLIFTING_USA_SOURCE: RulebookSource = {
  authority: 'Armlifting USA',
  title: '2026 World Super Series Rules',
  url: 'https://armliftingusa.com/world-super-series-rules-1',
  verifiedAt: '2026-09-25',
  sections: ['Axle/Saxon unlimited attempts', 'Grandfather Clock'],
};

const ARMLIFTING_USA_WORLDS_SOURCE: RulebookSource = {
  authority: 'Armlifting USA',
  title: '2026 World Championships event information',
  url: 'https://armliftingusa.com/2026-world-championships',
  verifiedAt: '2026-09-25',
  sections: ['Axle/Saxon unlimited attempts', 'Grandfather Clock'],
};

const WAF_RULES: WafRuleset = {
  kind: 'waf',
  version: '2025',
  categories: WAF_2025_CATEGORIES,
  leftAndRightSeparateDays: true,
  weighIn: {
    clothingAllowanceKg: 0,
    approvedScaleRequired: true,
    windowHoursBeforeCompetition: { min: 24, max: 30 },
    artificialLimbsIncludedRequired: true,
    weightMustRegisterToZero: true,
  },
  bracket: {
    format: 'double_elimination',
    lossesToEliminate: 2,
    seeding: 'none',
    draw: 'luck_of_draw',
    firstRoundSameCountry: 'avoid_if_possible',
    rematch: 'avoid_except_place_standing',
    callToTableSeconds: 60,
    boutTimeLimit: 'none',
  },
  sourceSections: ['1.1', '1.3', '1.4', '1.5', '4.1.2', '5.1', '5.2.2', '5.2.6'],
};

const ARMLIFTING_USA_PROTOCOLS: readonly ImplementProtocol[] = [
  {
    id: 'axle-unlimited-2026',
    implement: 'apollon_axle',
    name: 'Axle 2026 event-specific unlimited attempts',
    eventExampleId: 'axle-saxon-unlimited-2026',
    scope: 'event_specific',
    attemptPolicy: {
      mode: 'unlimited',
      maxAttempts: 'unlimited',
      timeLimitSeconds: 60,
      missConsequence: 'eliminate_from_event',
      weightOrder: 'not_specified',
    },
    sourceSections: ['Axle/Saxon unlimited attempts'],
    verified: true,
  },
  {
    id: 'saxon-unlimited-2026',
    implement: 'saxon_bar',
    name: 'Saxon 2026 event-specific unlimited attempts',
    eventExampleId: 'axle-saxon-unlimited-2026',
    scope: 'event_specific',
    attemptPolicy: {
      mode: 'unlimited',
      maxAttempts: 'unlimited',
      timeLimitSeconds: 60,
      missConsequence: 'eliminate_from_event',
      weightOrder: 'not_specified',
    },
    sourceSections: ['Axle/Saxon unlimited attempts'],
    verified: true,
  },
  {
    id: 'grandfather-clock-three-2026',
    implement: 'grandfather_clock',
    name: 'Grandfather Clock 2026 event-specific three increasing weights',
    eventExampleId: 'grandfather-clock-2026',
    scope: 'event_specific',
    attemptPolicy: {
      mode: 'three_increasing_weights',
      maxAttempts: 3,
      timeLimitSeconds: 60,
      missConsequence: 'not_specified',
      weightOrder: 'increasing',
    },
    sourceSections: ['Grandfather Clock'],
    verified: true,
  },
];

const ARMLIFTING_USA_RULES: ArmliftingUsaRuleset = {
  kind: 'armlifting_usa',
  version: '2026',
  protocols: ARMLIFTING_USA_PROTOCOLS,
  globalRulesDefined: false,
  sourceSections: ['2026 World Super Series Rules', '2026 event examples'],
};

export const WAF_2025_SNAPSHOT: RulebookSnapshot = {
  schemaVersion: 1,
  id: 'waf-2025',
  authority: 'WAF',
  version: '2025',
  title: 'WAF Rules & Regulations snapshot 2025',
  scope: 'waf_championships',
  verifiedAt: '2026-09-25',
  sources: [WAF_SOURCE],
  limitations: [
    'The snapshot is limited to the cited WAF 2025 sections and does not replace event-specific instructions.',
    'A missing or unlisted category is not treated as an inferred global category.',
  ],
  rules: WAF_RULES,
};

export const ARMLIFTING_USA_2026_SNAPSHOT: RulebookSnapshot = {
  schemaVersion: 1,
  id: 'armlifting-usa-2026-examples',
  authority: 'Armlifting USA',
  version: '2026',
  title: 'Armlifting USA 2026 event-specific examples',
  scope: 'event_specific_examples',
  verifiedAt: '2026-09-25',
  sources: [ARMLIFTING_USA_SOURCE, ARMLIFTING_USA_WORLDS_SOURCE],
  limitations: [
    'These are event-specific examples, not a global Armlifting USA rulebook.',
    'No global weight classes, attempt order, or miss consequences are inferred for other events.',
    'Grandfather Clock miss consequence is not encoded because it is not specified in the source snapshot.',
  ],
  rules: ARMLIFTING_USA_RULES,
};

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object') return value;
  const objectValue = value as object;
  if (seen.has(objectValue)) return value;
  seen.add(objectValue);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key], seen);
  }
  return Object.freeze(value);
}

export function createRulebookRegistry(snapshots: readonly RulebookSnapshot[]): RulebookRegistry {
  const unique = new Map<string, RulebookSnapshot>();
  for (const snapshot of snapshots) {
    if (!unique.has(snapshot.id)) unique.set(snapshot.id, snapshot);
  }
  return deepFreeze({ schemaVersion: 1 as const, snapshots: [...unique.values()] });
}

export const ARM_RULEBOOK_REGISTRY: RulebookRegistry = createRulebookRegistry([
  WAF_2025_SNAPSHOT,
  ARMLIFTING_USA_2026_SNAPSHOT,
]);

export function getRulebookSnapshot(
  id: string,
  registry: RulebookRegistry = ARM_RULEBOOK_REGISTRY,
): RulebookSnapshot | null {
  return registry.snapshots.find((snapshot) => snapshot.id === id) ?? null;
}

export function getRulebookSnapshotFor(
  authority: RulebookAuthority,
  version: string,
  registry: RulebookRegistry = ARM_RULEBOOK_REGISTRY,
): RulebookSnapshot | null {
  return registry.snapshots.find((snapshot) => snapshot.authority === authority && snapshot.version === version) ?? null;
}

export function getImplementProtocol(
  snapshot: RulebookSnapshot,
  protocolId: string,
): ImplementProtocol | null {
  if (snapshot.rules.kind !== 'armlifting_usa') return null;
  return snapshot.rules.protocols.find((protocol) => protocol.id === protocolId) ?? null;
}

export function getImplementProtocolFor(
  snapshot: RulebookSnapshot,
  implement: ArmliftingUsaImplement,
): ImplementProtocol | null {
  if (snapshot.rules.kind !== 'armlifting_usa') return null;
  return snapshot.rules.protocols.find((protocol) => protocol.implement === implement) ?? null;
}
