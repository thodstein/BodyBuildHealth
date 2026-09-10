/**
 * strength-sport-sm-auto-angles.engine.ts — АВТО-УГЛЫ ИЗ ТАБЛИЦЫ (SM PRO P7)
 *
 * Нормы — из sm-pose-check (Hindle 2021): йок hip ROM [30,46] / knee ROM [43,65],
 * лог-локаут shoulder ≥150°. Движок берёт ту же таблицу углов, что ручной разбор
 * (t,таз,колено,голеностоп,плечо — русская шапка тоже понимается), считает ROM
 * (макс−мин) и судит автоматом. Кривая таблица (нет чисел) — честная ошибка,
 * а не «ОК». Он-девайс видео осознанно не делаем (см. PRO-план §4).
 *
 * Чистый движок, без UI/storage.
 */

import { SM_POSE_NORMS } from './strength-sport-sm-pose-check.engine';

export interface SMAutoAngles {
  hipROM: number | null;
  kneeROM: number | null;
  shoulderMax: number | null;
  n: number;
}

export interface SMAutoAnglesResult {
  valid: true;
  verdict: 'ok' | 'warn' | 'critical';
  angles: SMAutoAngles;
  lines: string[];
}

export interface SMAutoAnglesError {
  valid: false;
  error: string;
}

const splitRows = (csv: string): string[][] =>
  String(csv || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(/[;,]/).map((c) => c.trim()));

const RU_HEAD: Record<string, string> = {
  'время': 't', 't': 't', 'time': 't',
  'таз': 'hip', 'hip': 'hip',
  'колено': 'knee', 'knee': 'knee',
  'голеностоп': 'ankle', 'ankle': 'ankle',
  'плечо': 'shoulder', 'shoulder': 'shoulder',
};

function parseAnglesTable(csv: string): Array<Record<string, number>> | null {
  const rows = splitRows(csv);
  if (rows.length < 2) return null;
  const head = rows[0].map((c) => RU_HEAD[c.toLowerCase()] || c.toLowerCase());
  const hasAngles = ['hip', 'knee', 'ankle', 'shoulder'].some((k) => head.includes(k));
  if (!hasAngles) return null;
  const out: Array<Record<string, number>> = [];
  for (const r of rows.slice(1)) {
    const rec: Record<string, number> = {};
    head.forEach((h, i) => {
      const v = parseFloat(String(r[i] ?? '').replace(',', '.'));
      if (Number.isFinite(v)) rec[h] = v;
    });
    if (Object.keys(rec).length) out.push(rec);
  }
  return out.length ? out : null;
}

const romOf = (rows: Array<Record<string, number>>, key: string): number | null => {
  const vs = rows.map((r) => r[key]).filter((v) => Number.isFinite(v));
  if (vs.length < 2) return null;
  return Math.round((Math.max(...vs) - Math.min(...vs)) * 10) / 10;
};

const maxOf = (rows: Array<Record<string, number>>, key: string): number | null => {
  const vs = rows.map((r) => r[key]).filter((v) => Number.isFinite(v));
  if (!vs.length) return null;
  return Math.max(...vs);
};

/** Таблица → ROM → вердикт (йок/фермер — ROM, лог — плечо). */
export function smAutoAnglesFromCsv(
  csvText: string,
  liftId: string,
): SMAutoAnglesResult | SMAutoAnglesError {
  const rows = parseAnglesTable(csvText);
  if (!rows) {
    return { valid: false, error: 'Таблица не распознана: нужны колонки время,таз,колено,голеностоп,плечо и ≥1 строка чисел' };
  }
  const low = String(liftId || '').toLowerCase();
  const isLog = low.includes('log') || low.includes('лог') || low.includes('press') || low.includes('axle');
  const angles: SMAutoAngles = {
    hipROM: romOf(rows, 'hip'),
    kneeROM: romOf(rows, 'knee'),
    shoulderMax: maxOf(rows, 'shoulder'),
    n: rows.length,
  };
  const lines: string[] = [];
  let bad = 0;
  if (isLog) {
    if (angles.shoulderMax == null) {
      return { valid: false, error: 'Нет колонки плеча — для лога нужна (shoulder/плечо)' };
    }
    if (angles.shoulderMax >= SM_POSE_NORMS.overheadShoulderAvg) {
      lines.push(`Авто: плечо макс ${angles.shoulderMax}° ≥ ${SM_POSE_NORMS.overheadShoulderAvg}° — руки над опорой (n=${angles.n})`);
    } else {
      bad++;
      lines.push(`Авто: плечо макс ${angles.shoulderMax}° < ${SM_POSE_NORMS.overheadShoulderAvg}° — лог впереди (n=${angles.n})`);
    }
    return { valid: true, verdict: bad ? 'warn' : 'ok', angles, lines };
  }
  const label = low.includes('farmer') || low.includes('фермер') ? 'Фермер' : 'Йок';
  if (angles.hipROM != null) {
    if (angles.hipROM >= SM_POSE_NORMS.yokeHipRom.min && angles.hipROM <= SM_POSE_NORMS.yokeHipRom.max) {
      lines.push(`Авто: ${label} hip ROM ${angles.hipROM}° — норма [${SM_POSE_NORMS.yokeHipRom.min},${SM_POSE_NORMS.yokeHipRom.max}]`);
    } else if (angles.hipROM < SM_POSE_NORMS.yokeHipRom.min) {
      bad++;
      lines.push(`Авто: ${label} hip ROM ${angles.hipROM}° < ${SM_POSE_NORMS.yokeHipRom.min}° — укорочен`);
    } else {
      bad++;
      lines.push(`Авто: ${label} hip ROM ${angles.hipROM}° > ${SM_POSE_NORMS.yokeHipRom.max}° — разболтан`);
    }
  }
  if (angles.kneeROM != null) {
    if (angles.kneeROM >= SM_POSE_NORMS.yokeKneeRom.min && angles.kneeROM <= SM_POSE_NORMS.yokeKneeRom.max) {
      lines.push(`Авто: ${label} knee ROM ${angles.kneeROM}° — норма [${SM_POSE_NORMS.yokeKneeRom.min},${SM_POSE_NORMS.yokeKneeRom.max}]`);
    } else if (angles.kneeROM < SM_POSE_NORMS.yokeKneeRom.min) {
      bad += 2;
      lines.push(`Авто: ${label} knee ROM ${angles.kneeROM}° < ${SM_POSE_NORMS.yokeKneeRom.min}° — семенишь: распусти шаг к 1.1 м`);
    } else {
      bad++;
      lines.push(`Авто: ${label} knee ROM ${angles.kneeROM}° > ${SM_POSE_NORMS.yokeKneeRom.max}° — глубокий сед на ходу`);
    }
  }
  if (!lines.length) {
    return { valid: false, error: 'Нет колонок таза/колена — для переноски нужны (таз/колено)' };
  }
  const verdict = bad === 0 ? 'ok' : bad >= 2 ? 'critical' : 'warn';
  return { valid: true, verdict, angles, lines };
}
