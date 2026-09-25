import {
  WAF_2025_SNAPSHOT,
  type ArmliftingAttemptMode,
  type ImplementProtocol,
  type RulebookSnapshot,
  type WafBracketRules,
} from './arm-rulebook';

export interface ArmAttemptStrategyInput {
  readonly startWeightKg?: number;
  readonly targetWeightKg?: number;
  readonly stepKg?: number;
  readonly attemptCount?: number;
  readonly weightsKg?: readonly number[];
}

export interface ArmAttemptStrategy {
  readonly protocolId: string;
  readonly mode: ArmliftingAttemptMode;
  readonly maxAttempts: number | 'unlimited';
  readonly timeLimitSeconds: 60;
  readonly weightsKg: readonly number[];
  readonly scope: 'event_specific';
}

export interface ArmAttemptStrategyResult {
  readonly valid: boolean;
  readonly strategy: ArmAttemptStrategy | null;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export interface ArmImplementAttempt {
  readonly weightKg: number;
  readonly success: boolean;
  readonly durationSeconds?: number;
}

export type ArmImplementSimulationStatus = 'completed' | 'eliminated' | 'incomplete' | 'invalid';

export interface ArmImplementAttemptResult {
  readonly index: number;
  readonly weightKg: number;
  readonly success: boolean;
  readonly accepted: boolean;
  readonly timeLimitExceeded: boolean;
  readonly reason: string | null;
}

export interface ArmImplementSimulationResult {
  readonly protocolId: string;
  readonly status: ArmImplementSimulationStatus;
  readonly completedAttempts: number;
  readonly totalAttempts: number;
  readonly ignoredAttempts: number;
  readonly bestWeightKg: number | null;
  readonly timeLimitSeconds: 60;
  readonly missConsequence: ImplementProtocol['attemptPolicy']['missConsequence'];
  readonly attempts: readonly ArmImplementAttemptResult[];
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export type WafBracketName = 'upper' | 'lower' | 'place_standing';

export interface WafBracketEntrant {
  readonly id: string;
  readonly country?: string;
}

export interface WafBracketMatch {
  readonly round: number;
  readonly bracket: WafBracketName;
  readonly leftId: string;
  readonly rightId: string;
  readonly winnerId: string;
}

export interface WafBracketStanding {
  readonly id: string;
  readonly losses: number;
  readonly eliminated: boolean;
}

export interface WafBracketMatchResult extends WafBracketMatch {
  readonly loserId: string;
  readonly winnerLosses: number;
  readonly loserLosses: number;
  readonly loserEliminated: boolean;
}

export type WafBracketSimulationStatus = 'complete' | 'incomplete' | 'invalid';

export interface WafBracketSimulationResult {
  readonly status: WafBracketSimulationStatus;
  readonly championId: string | null;
  readonly standings: readonly WafBracketStanding[];
  readonly eliminated: readonly WafBracketStanding[];
  readonly matches: readonly WafBracketMatchResult[];
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function positiveOrUndefined(value: number | undefined): number | null {
  return value !== undefined && isPositiveFinite(value) ? value : null;
}

function normalizeWeights(weights: readonly number[]): number[] | null {
  if (weights.length === 0 || !weights.every(isPositiveFinite)) return null;
  return weights.map((weight) => Math.round(weight * 100) / 100);
}

function generateUnlimitedWeights(input: ArmAttemptStrategyInput): number[] | null {
  if (input.stepKg !== undefined && !isPositiveFinite(input.stepKg)) return null;
  if (input.targetWeightKg !== undefined && !isPositiveFinite(input.targetWeightKg)) return null;
  const start = positiveOrUndefined(input.startWeightKg);
  const target = positiveOrUndefined(input.targetWeightKg);
  const step = input.stepKg === undefined ? 2.5 : input.stepKg;
  if (start === null) return null;
  if (target !== null && target < start) return null;
  if (input.attemptCount !== undefined && (!Number.isInteger(input.attemptCount) || input.attemptCount <= 0)) return null;
  if (input.attemptCount !== undefined && target !== null) return null;

  const count = input.attemptCount ?? (target === null ? 0 : Math.floor((target - start) / step) + 1);
  if (count <= 0 || count > 100) return null;
  const weights: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const weight = start + index * step;
    if (target !== null && weight > target) break;
    weights.push(Math.round(weight * 100) / 100);
  }
  if (target !== null && weights[weights.length - 1] !== target) weights.push(target);
  return weights.length > 0 ? weights : null;
}

function generateClockWeights(input: ArmAttemptStrategyInput): number[] | null {
  const supplied = input.weightsKg ? normalizeWeights(input.weightsKg) : null;
  if (input.weightsKg && supplied === null) return null;
  if (supplied) return supplied;
  if (input.stepKg !== undefined && !isPositiveFinite(input.stepKg)) return null;
  if (input.targetWeightKg !== undefined && !isPositiveFinite(input.targetWeightKg)) return null;

  const start = positiveOrUndefined(input.startWeightKg);
  if (start === null) return null;
  const step = input.stepKg === undefined ? 2.5 : input.stepKg;
  const target = positiveOrUndefined(input.targetWeightKg);
  if (target !== null && target <= start + step) return null;
  const middle = Math.round((start + step) * 100) / 100;
  const last = target ?? Math.round((start + step * 2) * 100) / 100;
  if (last <= middle) return null;
  return [Math.round(start * 100) / 100, middle, Math.round(last * 100) / 100];
}

function strategyError(
  protocol: ImplementProtocol,
  errors: readonly string[],
  warnings: readonly string[],
): ArmAttemptStrategyResult {
  return {
    valid: false,
    strategy: null,
    errors,
    warnings,
  };
}

export function buildAttemptStrategy(
  protocol: ImplementProtocol,
  input: ArmAttemptStrategyInput = {},
): ArmAttemptStrategyResult {
  if (!protocol.verified) return strategyError(protocol, ['Protocol is not verified.'], []);
  const policy = protocol.attemptPolicy;
  const errors: string[] = [];
  const warnings: string[] = [];
  let weightsKg: number[] | null = null;

  if (policy.mode === 'unlimited') {
    if (input.weightsKg) {
      weightsKg = normalizeWeights(input.weightsKg);
      if (weightsKg === null) errors.push('All supplied weights must be positive finite numbers.');
    } else {
      weightsKg = generateUnlimitedWeights(input);
      if (weightsKg === null) errors.push('Unlimited strategy needs positive weights, or a start weight with a target or count.');
    }
    if (policy.weightOrder === 'not_specified') warnings.push('Weight order is not specified for this event example.');
  } else {
    const generatedWeights = generateClockWeights(input);
    weightsKg = generatedWeights;
    const maxAttempts = typeof policy.maxAttempts === 'number' ? policy.maxAttempts : 3;
    if (generatedWeights === null) errors.push('Three-attempt strategy needs three increasing positive weights.');
    else if (generatedWeights.length !== maxAttempts || generatedWeights.some((weight, index) => index > 0 && weight <= generatedWeights[index - 1])) {
      errors.push('Three-attempt strategy must contain exactly three strictly increasing weights.');
    }
  }

  if (errors.length > 0 || !weightsKg) return strategyError(protocol, errors, warnings);
  return {
    valid: true,
    strategy: {
      protocolId: protocol.id,
      mode: policy.mode,
      maxAttempts: policy.maxAttempts,
      timeLimitSeconds: policy.timeLimitSeconds,
      weightsKg,
      scope: protocol.scope,
    },
    errors: [],
    warnings,
  };
}

function simulationInvalid(
  protocol: ImplementProtocol,
  attempts: readonly ArmImplementAttemptResult[],
  errors: readonly string[],
  warnings: readonly string[] = [],
  totalAttempts = attempts.length,
): ArmImplementSimulationResult {
  return {
    protocolId: protocol.id,
    status: 'invalid',
    completedAttempts: attempts.length,
    totalAttempts,
    ignoredAttempts: 0,
    bestWeightKg: attempts.reduce<number | null>((best, attempt) => {
      if (!attempt.accepted || !attempt.success) return best;
      return best === null || attempt.weightKg > best ? attempt.weightKg : best;
    }, null),
    timeLimitSeconds: protocol.attemptPolicy.timeLimitSeconds,
    missConsequence: protocol.attemptPolicy.missConsequence,
    attempts,
    errors,
    warnings,
  };
}

export function simulateImplementProtocol(
  protocol: ImplementProtocol,
  attempts: readonly ArmImplementAttempt[],
): ArmImplementSimulationResult {
  const policy = protocol.attemptPolicy;
  const warnings: string[] = [];
  if (!protocol.verified) return simulationInvalid(protocol, [], ['Protocol is not verified.']);
  if (!Number.isInteger(attempts.length) || attempts.length < 0) return simulationInvalid(protocol, [], ['Attempts must be a finite list.']);
  if (typeof policy.maxAttempts === 'number' && attempts.length > policy.maxAttempts) {
    return simulationInvalid(protocol, [], [`Protocol allows at most ${policy.maxAttempts} attempts.`], [], attempts.length);
  }

  const results: ArmImplementAttemptResult[] = [];
  let terminated = false;
  let bestWeightKg: number | null = null;
  let previousWeight: number | null = null;
  let invalidReason: string | null = null;

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    if (terminated) break;
    const weightKg = Number(attempt.weightKg);
    if (!isPositiveFinite(weightKg)) {
      invalidReason = `Attempt ${index + 1} has an invalid weight.`;
      break;
    }
    if (attempt.durationSeconds !== undefined && (!Number.isFinite(attempt.durationSeconds) || attempt.durationSeconds < 0 || attempt.durationSeconds > policy.timeLimitSeconds)) {
      invalidReason = `Attempt ${index + 1} exceeds the ${policy.timeLimitSeconds}-second limit or has an invalid duration.`;
      break;
    }
    if (policy.mode === 'three_increasing_weights' && previousWeight !== null && weightKg <= previousWeight) {
      invalidReason = `Attempt ${index + 1} does not increase the weight.`;
      break;
    }
    const result: ArmImplementAttemptResult = {
      index,
      weightKg: Math.round(weightKg * 100) / 100,
      success: attempt.success === true,
      accepted: true,
      timeLimitExceeded: false,
      reason: null,
    };
    results.push(result);
    previousWeight = weightKg;
    if (result.success && (bestWeightKg === null || result.weightKg > bestWeightKg)) bestWeightKg = result.weightKg;
    if (!result.success && policy.missConsequence === 'eliminate_from_event') terminated = true;
  }

  if (invalidReason) {
    return simulationInvalid(protocol, results, [invalidReason], warnings, attempts.length);
  }

  const ignoredAttempts = Math.max(0, attempts.length - results.length);
  const expectedAttempts: number | null = policy.mode === 'three_increasing_weights' && typeof policy.maxAttempts === 'number'
    ? policy.maxAttempts
    : null;
  const hasMiss = results.some((attempt) => !attempt.success);
  const status: ArmImplementSimulationStatus = terminated
    ? 'eliminated'
    : expectedAttempts !== null && results.length < expectedAttempts
      ? 'incomplete'
      : attempts.length === 0
        ? 'incomplete'
        : 'completed';
  if (hasMiss && policy.missConsequence === 'not_specified') {
    warnings.push('Miss consequence is not specified by this event example; the result does not infer elimination.');
  }
  return {
    protocolId: protocol.id,
    status,
    completedAttempts: results.length,
    totalAttempts: attempts.length,
    ignoredAttempts,
    bestWeightKg,
    timeLimitSeconds: policy.timeLimitSeconds,
    missConsequence: policy.missConsequence,
    attempts: results,
    errors: [],
    warnings,
  };
}

function pairKey(leftId: string, rightId: string): string {
  return [leftId, rightId].sort().join('\u0000');
}

function bracketRules(snapshot: RulebookSnapshot): WafBracketRules | null {
  return snapshot.rules.kind === 'waf' ? snapshot.rules.bracket : null;
}

export function simulateWafBracket(
  entrants: readonly WafBracketEntrant[],
  matches: readonly WafBracketMatch[],
  snapshot: RulebookSnapshot = WAF_2025_SNAPSHOT,
): WafBracketSimulationResult {
  const rules = bracketRules(snapshot);
  const errors: string[] = [];
  const warnings: string[] = [];
  const matchResults: WafBracketMatchResult[] = [];
  if (!rules) {
    return {
      status: 'invalid',
      championId: null,
      standings: [],
      eliminated: [],
      matches: [],
      warnings,
      errors: ['The supplied rulebook snapshot is not a WAF ruleset.'],
    };
  }
  if (rules.lossesToEliminate !== 2 || rules.format !== 'double_elimination') {
    errors.push('The supplied WAF bracket rules are not the represented double-elimination format.');
  }

  const state = new Map<string, { losses: number; eliminated: boolean; country?: string }>();
  for (const entrant of entrants) {
    if (entrant.id.trim().length === 0) errors.push('Every bracket entrant must have a non-empty id.');
    if (state.has(entrant.id)) errors.push(`Duplicate bracket entrant ${entrant.id}.`);
    state.set(entrant.id, { losses: 0, eliminated: false, country: entrant.country });
  }
  if (state.size === 0) errors.push('At least one bracket entrant is required.');

  const seenPairs = new Set<string>();
  for (const match of matches) {
    if (!Number.isInteger(match.round) || match.round < 1) {
      errors.push('Every bracket match must have a positive integer round.');
      continue;
    }
    if (!['upper', 'lower', 'place_standing'].includes(match.bracket)) {
      errors.push(`Unknown bracket type ${match.bracket}.`);
      continue;
    }
    if (match.leftId === match.rightId) {
      errors.push('A bracket match cannot contain the same entrant twice.');
      continue;
    }
    const left = state.get(match.leftId);
    const right = state.get(match.rightId);
    if (!left || !right) {
      errors.push(`Bracket match references an unknown entrant: ${match.leftId} vs ${match.rightId}.`);
      continue;
    }
    if (left.eliminated || right.eliminated) {
      errors.push(`Bracket match contains an already eliminated entrant: ${match.leftId} vs ${match.rightId}.`);
      continue;
    }
    if (match.winnerId !== match.leftId && match.winnerId !== match.rightId) {
      errors.push(`Bracket winner must be one of the match entrants: ${match.leftId} vs ${match.rightId}.`);
      continue;
    }
    if (match.round === 1 && left.country && right.country && left.country === right.country) {
      warnings.push(`First-round same-country pairing avoided if possible but ${left.country} is paired with ${right.country}.`);
    }
    const key = pairKey(match.leftId, match.rightId);
    if (seenPairs.has(key) && match.bracket !== 'place_standing') {
      warnings.push(`Rematch between ${match.leftId} and ${match.rightId} is allowed only as an explicit place-standing match in the cited rules.`);
    }
    seenPairs.add(key);

    const loserId = match.winnerId === match.leftId ? match.rightId : match.leftId;
    const winner = state.get(match.winnerId)!;
    const loser = state.get(loserId)!;
    loser.losses += 1;
    loser.eliminated = loser.losses >= rules.lossesToEliminate;
    matchResults.push({
      ...match,
      loserId,
      winnerLosses: winner.losses,
      loserLosses: loser.losses,
      loserEliminated: loser.eliminated,
    });
  }

  const standings: WafBracketStanding[] = [...state.entries()].map(([id, value]) => ({
    id,
    losses: value.losses,
    eliminated: value.eliminated,
  }));
  const active = standings.filter((standing) => !standing.eliminated);
  const eliminated = standings.filter((standing) => standing.eliminated);
  if (errors.length > 0) {
    return { status: 'invalid', championId: null, standings, eliminated, matches: matchResults, warnings, errors };
  }
  if (active.length === 0) {
    return {
      status: 'invalid',
      championId: null,
      standings,
      eliminated,
      matches: matchResults,
      warnings,
      errors: ['No active entrant remains in the bracket.'],
    };
  }
  return {
    status: active.length === 1 ? 'complete' : 'incomplete',
    championId: active.length === 1 ? active[0].id : null,
    standings,
    eliminated,
    matches: matchResults,
    warnings,
    errors: [],
  };
}
