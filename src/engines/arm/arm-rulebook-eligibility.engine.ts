import {
  WAF_2025_SNAPSHOT,
  type ArmSex,
  type ArmSide,
  type RulebookSnapshot,
  type WafCategoryRule,
  type WafParaClass,
  type WafWeightClass,
  type WafAgeGroup,
} from './arm-rulebook';

export type WafEligibilityStatus = 'eligible' | 'ineligible' | 'needs_review';
export type WafEligibilityCheckStatus = 'pass' | 'fail' | 'review';

export interface WafTournamentEntry {
  readonly id: string;
  readonly name?: string;
  readonly sex: ArmSex;
  readonly ageYears: number;
  readonly bodyWeightKg: number;
  readonly arm: ArmSide;
  readonly paraClass?: WafParaClass;
  readonly requestedCategoryId?: string;
  readonly country?: string;
}

export interface WafWeighInRecord {
  readonly atIso: string;
  readonly bodyWeightKg: number;
  readonly approvedScale?: boolean;
  readonly clothingKg?: number;
  readonly artificialLimbsIncluded?: boolean;
}

export interface WafEligibilityContext {
  readonly competitionAtIso: string;
  readonly weighIn?: WafWeighInRecord;
}

export interface WafEligibilityCheck {
  readonly id: string;
  readonly status: WafEligibilityCheckStatus;
  readonly detail: string;
}

export interface WafEligibilityResult {
  readonly entryId: string;
  readonly status: WafEligibilityStatus;
  readonly selectedCategory: WafCategoryRule | null;
  readonly eligibleCategories: readonly WafCategoryRule[];
  readonly weightClass: WafWeightClass | null;
  readonly weighInHoursBefore: number | null;
  readonly checks: readonly WafEligibilityCheck[];
  readonly reasons: readonly string[];
}

const HOUR_MS = 60 * 60 * 1000;

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function parseIso(value: string): number | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function ageGroupFor(ageYears: number): WafAgeGroup | null {
  if (!Number.isFinite(ageYears) || ageYears < 14) return null;
  if (ageYears <= 15) return 'sub_junior_15';
  if (ageYears <= 18) return 'junior_18';
  if (ageYears <= 23) return 'youth_23';
  if (ageYears <= 39) return 'senior';
  if (ageYears <= 49) return 'masters_40_49';
  if (ageYears <= 59) return 'grand_masters_50_59';
  if (ageYears <= 69) return 'senior_grand_masters_60_69';
  return 'super_senior_grand_masters_70';
}

function ageMatchesCategory(ageYears: number, ageGroup: WafAgeGroup | null, category: WafCategoryRule): boolean {
  if (ageGroup === null) return false;
  const { minYears, maxYears } = category.ageRule;
  if (minYears !== null && ageYears < minYears) return false;
  if (maxYears !== null && ageYears > maxYears) return false;
  if (category.ageBand === 'para_adult') return ageYears >= 19;
  if (category.ageBand === 'para_junior_23') return ageYears >= 19 && ageYears <= 23;
  if (category.ageGroup === 'senior') return ageYears >= 16;
  return category.ageGroup === ageGroup;
}

function categoryMatchesEntry(
  entry: WafTournamentEntry,
  ageGroup: WafAgeGroup | null,
  category: WafCategoryRule,
): boolean {
  const paraClass = entry.paraClass ?? 'none';
  if (!category.sexes.includes(entry.sex)) return false;
  if (category.paraClass !== paraClass) return false;
  if (paraClass === 'none' && category.ageBand !== 'standard') return false;
  if (paraClass !== 'none' && category.ageBand === 'standard') return false;
  return ageMatchesCategory(entry.ageYears, ageGroup, category);
}

function preferredCategory(
  candidates: readonly WafCategoryRule[],
  ageGroup: WafAgeGroup | null,
  paraClass: WafParaClass,
): WafCategoryRule | null {
  if (candidates.length === 0) return null;
  if (paraClass !== 'none') {
    const paraBand = ageGroup === 'youth_23' ? 'para_junior_23' : 'para_adult';
    return candidates.find((category) => category.ageBand === paraBand) ?? candidates[0];
  }
  return candidates.find((category) => category.ageGroup === ageGroup) ?? candidates[0];
}

function weightClassFor(category: WafCategoryRule, sex: ArmSex, weightKg: number): WafWeightClass | null {
  const classes = category.weightClassesBySex[sex] ?? [];
  return (
    classes.find((weightClass) => !weightClass.open && weightKg <= (weightClass.limitKg ?? Number.POSITIVE_INFINITY)) ??
    classes.find((weightClass) => weightClass.open) ??
    null
  );
}

function addCheck(
  checks: WafEligibilityCheck[],
  id: string,
  status: WafEligibilityCheckStatus,
  detail: string,
): void {
  checks.push({ id, status, detail });
}

function resultFor(
  entry: WafTournamentEntry,
  selectedCategory: WafCategoryRule | null,
  eligibleCategories: readonly WafCategoryRule[],
  weightClass: WafWeightClass | null,
  weighInHoursBefore: number | null,
  checks: readonly WafEligibilityCheck[],
): WafEligibilityResult {
  const hasFailure = checks.some((check) => check.status === 'fail');
  const hasReview = checks.some((check) => check.status === 'review');
  const status: WafEligibilityStatus = hasFailure ? 'ineligible' : hasReview ? 'needs_review' : 'eligible';
  return {
    entryId: entry.id,
    status,
    selectedCategory,
    eligibleCategories,
    weightClass,
    weighInHoursBefore,
    checks,
    reasons: checks.filter((check) => check.status !== 'pass').map((check) => check.detail),
  };
}

export function evaluateWafEligibility(
  entry: WafTournamentEntry,
  context: WafEligibilityContext,
  snapshot: RulebookSnapshot = WAF_2025_SNAPSHOT,
): WafEligibilityResult {
  const checks: WafEligibilityCheck[] = [];
  if (snapshot.rules.kind !== 'waf') {
    addCheck(checks, 'rulebook', 'fail', 'The supplied rulebook snapshot is not a WAF ruleset.');
    return resultFor(entry, null, [], null, null, checks);
  }

  if (entry.id.trim().length === 0) addCheck(checks, 'entry_id', 'fail', 'A non-empty entry id is required.');
  if (!isPositiveFinite(entry.bodyWeightKg)) addCheck(checks, 'entry_body_weight', 'fail', 'Body weight must be a positive finite number.');
  if (!['left', 'right'].includes(entry.arm)) addCheck(checks, 'entry_arm', 'fail', 'The entry must specify left or right.');

  const ageGroup = ageGroupFor(entry.ageYears);
  if (ageGroup === null) addCheck(checks, 'entry_age', 'fail', 'The entry age is outside the represented WAF age categories.');

  const candidates = ageGroup === null
    ? []
    : snapshot.rules.categories.filter((category) => categoryMatchesEntry(entry, ageGroup, category));
  let selectedCategory: WafCategoryRule | null = null;
  if (entry.requestedCategoryId) {
    selectedCategory = snapshot.rules.categories.find((category) => category.id === entry.requestedCategoryId) ?? null;
    if (!selectedCategory) {
      addCheck(checks, 'requested_category', 'fail', `Requested category ${entry.requestedCategoryId} is not present in the snapshot.`);
    } else if (!categoryMatchesEntry(entry, ageGroup, selectedCategory)) {
      addCheck(checks, 'requested_category', 'fail', `Requested category ${selectedCategory.id} does not match sex, age, or para class.`);
    }
  } else {
    selectedCategory = preferredCategory(candidates, ageGroup, entry.paraClass ?? 'none');
    if (!selectedCategory) addCheck(checks, 'category', 'fail', 'No matching WAF category is represented in the snapshot.');
  }

  const eligibleCategories = entry.requestedCategoryId && selectedCategory && categoryMatchesEntry(entry, ageGroup, selectedCategory)
    ? [selectedCategory]
    : candidates;

  const competitionAt = parseIso(context.competitionAtIso);
  if (competitionAt === null) addCheck(checks, 'competition_time', 'fail', 'Competition time must be a valid ISO date.');

  let weighInHoursBefore: number | null = null;
  let measuredWeightKg = entry.bodyWeightKg;
  if (!context.weighIn) {
    addCheck(checks, 'weigh_in', 'review', 'Weigh-in record is missing; eligibility requires a recorded weigh-in.');
    addCheck(checks, 'approved_scale', 'review', 'Approved scale status is unknown.');
    addCheck(checks, 'clothing_allowance', 'review', 'Clothing allowance status is unknown.');
    addCheck(checks, 'artificial_limbs', 'review', 'Artificial-limb inclusion status is unknown.');
  } else {
    const weighInAt = parseIso(context.weighIn.atIso);
    if (weighInAt === null) {
      addCheck(checks, 'weigh_in_time', 'fail', 'Weigh-in time must be a valid ISO date.');
    } else if (competitionAt === null) {
      addCheck(checks, 'weigh_in_window', 'fail', 'Weigh-in window cannot be checked without a valid competition time.');
    } else {
      weighInHoursBefore = (competitionAt - weighInAt) / HOUR_MS;
      const min = snapshot.rules.weighIn.windowHoursBeforeCompetition.min;
      const max = snapshot.rules.weighIn.windowHoursBeforeCompetition.max;
      if (weighInHoursBefore < min || weighInHoursBefore > max) {
        addCheck(checks, 'weigh_in_window', 'fail', `Weigh-in must be ${min}–${max} hours before competition.`);
      } else {
        addCheck(checks, 'weigh_in_window', 'pass', `Weigh-in is ${weighInHoursBefore.toFixed(2)} hours before competition.`);
      }
    }
    if (isPositiveFinite(context.weighIn.bodyWeightKg)) {
      measuredWeightKg = context.weighIn.bodyWeightKg;
    } else {
      addCheck(checks, 'weigh_in_body_weight', 'fail', 'Weigh-in body weight must be a positive finite number.');
    }
    if (context.weighIn.approvedScale === true) addCheck(checks, 'approved_scale', 'pass', 'Weigh-in scale is marked approved.');
    else if (context.weighIn.approvedScale === false) addCheck(checks, 'approved_scale', 'fail', 'WAF requires an approved scale.');
    else addCheck(checks, 'approved_scale', 'review', 'Approved scale status is unknown.');
    if (context.weighIn.clothingKg === snapshot.rules.weighIn.clothingAllowanceKg) {
      addCheck(checks, 'clothing_allowance', 'pass', 'Clothing allowance is zero as required.');
    } else if (context.weighIn.clothingKg === undefined) {
      addCheck(checks, 'clothing_allowance', 'review', 'Clothing allowance is unknown.');
    } else {
      addCheck(checks, 'clothing_allowance', 'fail', 'WAF 2025 allows no clothing allowance.');
    }
    if (context.weighIn.artificialLimbsIncluded === snapshot.rules.weighIn.artificialLimbsIncludedRequired) {
      addCheck(checks, 'artificial_limbs', 'pass', 'Artificial-limb inclusion is recorded.');
    } else if (context.weighIn.artificialLimbsIncluded === undefined) {
      addCheck(checks, 'artificial_limbs', 'review', 'Artificial-limb inclusion is unknown.');
    } else {
      addCheck(checks, 'artificial_limbs', 'fail', 'Artificial-limb inclusion must be recorded as included.');
    }
  }

  let weightClass: WafWeightClass | null = null;
  if (selectedCategory) {
    weightClass = weightClassFor(selectedCategory, entry.sex, measuredWeightKg);
    if (weightClass && (weightClass.open || measuredWeightKg <= (weightClass.limitKg ?? Number.POSITIVE_INFINITY))) {
      addCheck(checks, 'weight_class', 'pass', `Measured weight fits ${weightClass.label}.`);
    } else {
      addCheck(checks, 'weight_class', 'fail', `Measured weight does not fit ${selectedCategory.label}.`);
    }
  } else {
    addCheck(checks, 'weight_class', 'fail', 'Weight class cannot be selected without a valid category.');
  }

  return resultFor(entry, selectedCategory, eligibleCategories, weightClass, weighInHoursBefore, checks);
}

export function evaluateWafEntries(
  entries: readonly WafTournamentEntry[],
  context: WafEligibilityContext,
  snapshot: RulebookSnapshot = WAF_2025_SNAPSHOT,
): WafEligibilityResult[] {
  return entries.map((entry) => evaluateWafEligibility(entry, context, snapshot));
}
