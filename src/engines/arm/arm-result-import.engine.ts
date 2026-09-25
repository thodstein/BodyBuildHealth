/**
 * arm-result-import.engine.ts — PRO-7 P2: импорт результатов соревнований.
 *
 * Понимает два формата, которые реально отдают organizers/lifters:
 *  - JSON: { date, implement, attempts: [{ weightKg, success }] } (или массив таких);
 *  - CSV/текст: строки «снаряд, попытка, вес, результат» либо «попытка,вес,результат».
 *
 * Ничего не додумывает: неизвестный снаряд, мусорные веса и промахи без попытки
 * отбрасываются с честной строкой-предупреждением. Импорт идёт в журнал
 * помоста (he_arm_platform_log) через savePlatformLogEntry.
 */
import { loadPlatformLog, platformWrFor, savePlatformLogEntry, type PlatformLogEntry } from './arm-platform.engine';

export interface ArmResultImportAttempt {
  attempt: number;
  weightKg: number;
  success: boolean;
}

export interface ArmResultImportResult {
  entries: ArmResultImportAttempt[];
  implement: string;
  dateIso: string;
  bestKg: number;
  wrPct: number;
  totalKg: number;
  warnings: string[];
  errors: string[];
}

const IMPLEMENT_ALIASES: Record<string, string> = {
  rt: 'rolling_thunder',
  rolling_thunder: 'rolling_thunder',
  'rolling thunder': 'rolling_thunder',
  axle: 'apollon_axle',
  apollon: 'apollon_axle',
  apollon_axle: 'apollon_axle',
  saxon: 'saxon_bar',
  saxon_bar: 'saxon_bar',
  hub: 'hub',
  pinch: 'pinch_block',
  pinch_block: 'pinch_block',
  coc: 'coc_gripper',
  coc_gripper: 'coc_gripper',
  grandfather: 'grandfather_clock',
  grandfather_clock: 'grandfather_clock',
  anvil: 'anvil',
  'country crush': 'country_crush',
  country_crush: 'country_crush',
};

const MAX_ATTEMPTS = 12;
const MAX_WEIGHT_KG = 500;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeArmImplement(raw: string): string | null {
  const key = String(raw ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  return IMPLEMENT_ALIASES[key] ?? IMPLEMENT_ALIASES[key.replace(/ /g, '_')] ?? null;
}

function parseWeight(raw: string): number | null {
  const value = Number(String(raw ?? '').trim().replace(',', '.').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(value) || value <= 0 || value > MAX_WEIGHT_KG) return null;
  return Math.round(value * 100) / 100;
}

function parseSuccess(raw: string): boolean | null {
  const value = String(raw ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'ok', 'good', 'сорван', 'взят'].includes(value)) {
    if (value === 'сорван') return false;
    return true;
  }
  if (['0', 'false', 'no', 'n', 'fail', 'bad', 'промах', 'мимо'].includes(value)) return false;
  return null;
}

function normalizeDate(raw: unknown, fallback: string, warnings: string[]): string {
  const value = String(raw ?? '').trim();
  if (!value) return fallback;
  if (DATE_RE.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isFinite(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  warnings.push(`Дата «${value}» не распознана — использована ${fallback}.`);
  return fallback;
}

function fallbackDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Разбор JSON-импорта: объект или массив объектов со снарядом и попытками. */
export function parseArmResultJson(raw: string): ArmResultImportResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const today = fallbackDate();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { entries: [], implement: '', dateIso: today, bestKg: 0, wrPct: 0, totalKg: 0, warnings, errors: ['Файл не читается как JSON.'] };
  }
  const records = Array.isArray(parsed) ? parsed : [parsed];
  if (records.length === 0) errors.push('В файле нет записей.');
  if (records.length > 1) warnings.push(`В файле ${records.length} записей — импортируется первая (журнал поместа — по одному соревнованию).`);
  const record = (records[0] ?? {}) as Record<string, unknown>;
  const implementRaw = String(record.implement ?? record.sport ?? '');
  const implement = normalizeArmImplement(implementRaw);
  if (!implement) {
    errors.push(implementRaw ? `Снаряд «${implementRaw}» не распознан.` : 'В файле нет поля implement (снаряд).');
  }
  const dateIso = normalizeDate(record.date ?? record.dateIso ?? record.date_competition, today, warnings);
  const attemptsRaw = Array.isArray(record.attempts) ? record.attempts : [];
  if (!implement) {
    // Снаряд не распознан — попытки не накапливаем: в журнал помоста запись без
    // снаряда бессмысленна, а «примерно угадать» нельзя.
    return finalize({ entries: [], implement: '', dateIso, warnings, errors });
  }
  const entries: ArmResultImportAttempt[] = [];
  for (const [index, item] of attemptsRaw.entries()) {
    const a = (item ?? {}) as Record<string, unknown>;
    const weightKg = parseWeight(String(a.weightKg ?? a.weight ?? ''));
    const success = a.success === true || String(a.success ?? '').toLowerCase() === 'true' ? true : a.success === false || String(a.success ?? '').toLowerCase() === 'false' ? false : parseSuccess(String(a.result ?? ''));
    const attempt = Number(a.attempt ?? index + 1);
    if (weightKg == null) { warnings.push(`Попытка ${attempt}: вес не распознан — пропущена.`); continue; }
    if (success == null) { warnings.push(`Попытка ${attempt}: результат не распознан — пропущена.`); continue; }
    entries.push({ attempt: Number.isFinite(attempt) && attempt > 0 ? Math.round(attempt) : index + 1, weightKg, success });
    if (entries.length >= MAX_ATTEMPTS) { warnings.push(`Больше ${MAX_ATTEMPTS} попыток не импортируем.`); break; }
  }
  if (attemptsRaw.length === 0) errors.push('В файле нет списка попыток (attempts).');
  return finalize({ entries, implement: implement ?? '', dateIso, warnings, errors });
}

/** Разбор CSV/текста: «снаряд,попытка,вес,результат» или «попытка,вес,результат». */
export function parseArmResultCsv(raw: string, fallbackImplement = ''): ArmResultImportResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const today = fallbackDate();
  const lines = String(raw ?? '').split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const entries: ArmResultImportAttempt[] = [];
  let implement = normalizeArmImplement(fallbackImplement) ?? '';
  let dateIso = today;
  for (const line of lines) {
    if (DATE_RE.test(line)) { dateIso = line; continue; }
    if (line.toLowerCase().startsWith('снаряд')) continue;
    // Разделитель: `;`/tab — всегда; запятая — только если их нет в строке
    // (иначе «55,5» разорвалось бы на две ячейки).
    const delim = /[;\t]/.test(line) ? /[;\t]/ : /,/;
    const cells = line.split(delim).map(c => c.trim().replace(/^"|"$/g, ''));
    let attempt = 1;
    let weightRaw = '';
    let resultRaw = '';
    if (cells.length >= 4) {
      const maybeImpl = normalizeArmImplement(cells[0]);
      if (maybeImpl) { implement = maybeImpl; cells.splice(0, 1); }
    }
    if (cells.length >= 3) {
      attempt = Number(cells[0]) || entries.length + 1;
      weightRaw = cells[1];
      resultRaw = cells[2];
    } else if (cells.length === 2) {
      weightRaw = cells[0];
      resultRaw = cells[1];
    } else {
      warnings.push(`Строка «${line}» не разобрана — пропущена.`);
      continue;
    }
    const weightKg = parseWeight(weightRaw);
    const success = parseSuccess(resultRaw);
    if (weightKg == null) { warnings.push(`Попытка ${attempt}: вес «${weightRaw}» не распознан — пропущена.`); continue; }
    if (success == null) { warnings.push(`Попытка ${attempt}: результат «${resultRaw}» не распознан — пропущена.`); continue; }
    entries.push({ attempt: Number.isFinite(attempt) && attempt > 0 ? Math.round(attempt) : entries.length + 1, weightKg, success });
    if (entries.length >= MAX_ATTEMPTS) { warnings.push(`Больше ${MAX_ATTEMPTS} попыток не импортируем.`); break; }
  }
  if (!implement) errors.push('Не указан снаряд (столбец «снаряд» или fallback).');
  if (entries.length === 0 && errors.length === 0) errors.push('В файле не нашлось ни одной распознанной попытки.');
  return finalize({ entries, implement, dateIso, warnings, errors });
}

function finalize(input: { entries: ArmResultImportAttempt[]; implement: string; dateIso: string; warnings: string[]; errors: string[] }): ArmResultImportResult {
  const best = input.entries.filter(e => e.success).reduce((max, e) => Math.max(max, e.weightKg), 0);
  const totalKg = input.entries.reduce((sum, e) => sum + e.weightKg, 0);
  const wr = input.implement ? platformWrFor(input.implement, 'male') : 0;
  const wrPct = wr > 0 && best > 0 ? Math.round((best / wr) * 1000) / 10 : 0;
  return {
    entries: input.entries,
    implement: input.implement,
    dateIso: input.dateIso,
    bestKg: best,
    wrPct,
    totalKg: Math.round(totalKg * 100) / 100,
    warnings: input.warnings,
    errors: input.errors,
  };
}

/** Импорт в журнал помоста: по одной записи на попытку (факт), %WR — по лучшему. */
export function applyArmResultImport(result: ArmResultImportResult, sex = 'male'): PlatformLogEntry[] {
  if (result.errors.length > 0 || result.entries.length === 0 || !result.implement) return loadPlatformLog();
  let log = loadPlatformLog();
  for (const entry of result.entries) {
    log = savePlatformLogEntry({ implement: result.implement, sex, weightKg: entry.weightKg, success: entry.success, dateIso: result.dateIso });
  }
  return log;
}
