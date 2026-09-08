/** Central helper for pharma frequency → injections per week.
 * Handles all formats used across codebase:
 * - number: direct count
 * - string: 'daily' (7), 'eod' (3.5), '1x/wk', '2x/wk', '3x/wk', '2x/week', '1,4' (day list)
 * Falls back to 2 for invalid.
 */
export function injectionsPerWeek(freq: number | string | undefined | null): number {
  if (typeof freq === 'number' && Number.isFinite(freq) && freq > 0) return freq;
  if (freq == null) return 2;
  const s = String(freq).trim().toLowerCase();
  if (!s) return 2;
  if (s === 'daily') return 7;
  if (s === 'eod') return 3.5;
  // '2x/wk', '3x/week', '2-3x/week' (range → avg), '2x / week' variations
  const rangeM = s.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*x\s*\/\s*w(?:eek|k)?/);
  if (rangeM) {
    const a = parseFloat(rangeM[1]); const b = parseFloat(rangeM[2]);
    if (Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0) return (a + b) / 2;
  }
  const m = s.match(/(\d+(?:\.\d+)?)\s*x\s*\/\s*w(?:eek|k)?/);
  if (m) {
    const v = parseFloat(m[1]);
    if (Number.isFinite(v) && v > 0) return v;
  }
  // '1-2x/d' or '2-3x/d' daily range → weekly avg
  const rangeD = s.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*x\s*\/\s*d/);
  if (rangeD) {
    const a = parseFloat(rangeD[1]); const b = parseFloat(rangeD[2]);
    if (Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0) return ((a + b) / 2) * 7;
  }
  const mDay = s.match(/(\d+(?:\.\d+)?)\s*x\s*\/\s*d/);
  if (mDay) {
    const v = parseFloat(mDay[1]);
    if (Number.isFinite(v) && v > 0) return v * 7;
  }
  // '1,4' or '0,2,4' day indices
  if (s.includes(',')) {
    const parts = s.split(',').map(v => parseInt(v.trim(), 10)).filter(n => !isNaN(n) && n >= 0 && n < 7);
    if (parts.length > 0 && parts.length <= 7) return parts.length;
  }
  const num = parseFloat(s);
  if (Number.isFinite(num) && num > 0 && num <= 7) return num;
  return 2;
}

/** Weekly dose from CourseEntry doseValue + doseUnit + frequency.
 * - '/wk' or '/week' → already weekly
 * - '/d' or '/day' → per day → *7
 * - otherwise → per-injection → * injectionsPerWeek
 */
export function weeklyDose(doseValue: number, doseUnit: string | undefined, frequency: number | string | undefined): number {
  const dv = Number(doseValue) || 0;
  if (!dv) return 0;
  const unit = String(doseUnit || '').toLowerCase();
  if (unit.includes('/wk') || unit.includes('/week')) return dv;
  if (unit.includes('/d') || unit.includes('/day')) return dv * 7;
  const perWeek = injectionsPerWeek(frequency);
  return dv * perWeek;
}
