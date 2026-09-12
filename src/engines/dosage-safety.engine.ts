// Dosage safety — гарды поверх calculateDose (движок не тронут).
import { PHARMA_DB, getPharmaDetail } from '../core/pharma-database';

export interface DosageSafetyIssue {
  level: 'ok' | 'warn' | 'stop';
  code: string;
  text: string;
}

export function checkDosageRange(substanceId: string, weeklyMg: number): DosageSafetyIssue | null {
  if (!substanceId || !(weeklyMg > 0)) return null;
  const det: any = getPharmaDetail(substanceId);
  const range = det?.dosageRange;
  if (!range) return null;
  // dosageRange: пробуем min/max либо строку — парсим числа
  const nums = JSON.stringify(range).match(/(\d+(?:\.\d+)?)/g)?.map(Number) ?? [];
  if (nums.length === 0) return null;
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  if (weeklyMg < lo)
    return { level: 'warn', code: 'below_range', text: `Ниже справочного диапазона (${lo}–${hi}): эффект может отсутствовать` };
  if (weeklyMg > hi)
    return { level: 'warn', code: 'above_range', text: `Выше справочного диапазона (${lo}–${hi}): риск ×, сверься с врачом` };
  return { level: 'ok', code: 'in_range', text: 'В справочном диапазоне' };
}

// Подбор шприца по объёму (Jordan 2021: минимальный вмещающий точнее).
export function recommendSyringe(volumeMl: number): { size: string; note: string } {
  if (!(volumeMl > 0)) return { size: '—', note: 'Нет объёма' };
  if (volumeMl <= 0.3) return { size: 'U-100 0.3 мл (30u)', note: 'Минимальный вмещающий — точнее' };
  if (volumeMl <= 0.5) return { size: 'U-100 0.5 мл (50u)', note: 'Минимальный вмещающий — точнее' };
  if (volumeMl <= 1) return { size: 'U-100 1 мл (100u)', note: 'Стандарт' };
  return { size: 'Делить на 2 инъекции', note: 'Объём >1 мл за раз — сплит' };
}

export function dosageGuards(volumeMl: number, syringeId: string): DosageSafetyIssue[] {
  const out: DosageSafetyIssue[] = [];
  if (volumeMl > 0 && volumeMl < 0.05)
    out.push({ level: 'warn', code: 'tiny_draw', text: 'Доза <5u — добавь воды/концентрацию ниже, иначе ошибка метки' });
  if (volumeMl > 1)
    out.push({ level: 'stop', code: 'over_1ml', text: 'Объём >1 мл — не влезет в инсулиновый шприц, дели' });
  const s = String(syringeId || '').toUpperCase();
  if (s.includes('U-40') || s.includes('U40'))
    out.push({ level: 'stop', code: 'u40', text: 'U-40 ≠ U-100: 1u = 0.025 мл (×2.5 ошибка). Этот расчёт — U-100' });
  if (out.length === 0) out.push({ level: 'ok', code: 'draw_ok', text: 'Объём читаем на шкале' });
  return out;
}

export function substanceName(id: string): string {
  return PHARMA_DB[id]?.name || id;
}
