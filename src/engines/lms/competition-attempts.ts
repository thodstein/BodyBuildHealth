export interface CompetitionAttempts {
  opener: number;
  second: number;
  third: number;
  openerRange: [number, number];
  secondRange: [number, number];
  thirdRange: [number, number];
}

/** Suggested attempts from a tested max, rounded to the nearest 2.5 kg. */
export function competitionAttempts(pm: number): CompetitionAttempts {
  const round = (value: number) => Math.round(value / 2.5) * 2.5;
  const range = (low: number, high: number): [number, number] => [round(pm * low), round(pm * high)];
  return {
    opener: round(pm * 0.875),
    second: round(pm * 0.925),
    third: round(pm * 1.0),
    openerRange: range(0.85, 0.9),
    secondRange: range(0.9, 0.95),
    thirdRange: range(0.95, 1.05),
  };
}
