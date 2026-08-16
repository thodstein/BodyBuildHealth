/**
 * Diary Backup Extras — восстановление дневников психо/мобильности/разминки
 * из JSON-бэкапа дневника (полный бэкап в DiaryToolsView).
 *
 * Чистая функция: мерж по ключу (разминка — дата, психо/мобильность —
 * дата+sessionId), добавляются только отсутствующие записи. Возвращает
 * количество добавленного по каждому дневнику.
 *
 * @module diary-backup-engine
 */

import { loadCheckins, upsertCheckin } from './mindset-protocol.engine';
import { loadMobilityCheckins, upsertMobilityCheckin } from './mobility-protocol.engine';
import { loadWarmupLog, upsertWarmupLog, warmupLogForDate } from './warmup.engine';
import { loadCooldownLog, upsertCooldownLog, cooldownLogForDate } from './cooldown.engine';
import { loadStretchLog, upsertStretchLog, stretchLogForDate } from './stretch-session.engine';

export interface DiaryBackupExtras {
  warmupDiary?: unknown[];
  cooldownDiary?: unknown[];
  stretchSessions?: unknown[];
  mindsetChecks?: unknown[];
  mobilityChecks?: unknown[];
}

export interface RestoreCounts {
  warmup: number;
  cooldown: number;
  stretch: number;
  mind: number;
  mob: number;
}

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

export function restoreDiaryExtras(data: DiaryBackupExtras): RestoreCounts {
  let warmup = 0, cooldown = 0, stretch = 0, mind = 0, mob = 0;

  if (Array.isArray(data.warmupDiary)) {
    for (const raw of data.warmupDiary) {
      const e = raw as any;
      if (!e || typeof e !== 'object' || typeof e.date !== 'string' || !DATE_RE.test(e.date)) continue;
      if (warmupLogForDate(e.date)) continue;
      upsertWarmupLog({
        date: e.date,
        done: !!e.done,
        quality: typeof e.quality === 'number' ? e.quality : null,
        totalItems: typeof e.totalItems === 'number' ? e.totalItems : undefined,
        doneItems: typeof e.doneItems === 'number' ? e.doneItems : undefined,
        skippedReason: str(e.skippedReason),
        note: str(e.note),
      });
      warmup++;
    }
  }

  if (Array.isArray(data.cooldownDiary)) {
    for (const raw of data.cooldownDiary) {
      const e = raw as any;
      if (!e || typeof e !== 'object' || typeof e.date !== 'string' || !DATE_RE.test(e.date)) continue;
      if (cooldownLogForDate(e.date)) continue;
      upsertCooldownLog({
        date: e.date,
        done: !!e.done,
        quality: typeof e.quality === 'number' ? e.quality : null,
        totalItems: typeof e.totalItems === 'number' ? e.totalItems : undefined,
        doneItems: typeof e.doneItems === 'number' ? e.doneItems : undefined,
        skippedReason: str(e.skippedReason),
        note: str(e.note),
      });
      cooldown++;
    }
  }

  if (Array.isArray(data.stretchSessions)) {
    for (const raw of data.stretchSessions) {
      const e = raw as any;
      if (!e || typeof e !== 'object' || typeof e.date !== 'string' || !DATE_RE.test(e.date)) continue;
      if (stretchLogForDate(e.date)) continue;
      upsertStretchLog({
        date: e.date,
        focus: str(e.focus) as any,
        durationMin: typeof e.durationMin === 'number' ? e.durationMin : 10,
        done: !!e.done,
        quality: typeof e.quality === 'number' ? e.quality : null,
        note: str(e.note),
      });
      stretch++;
    }
  }

  const mindKeys = new Set(loadCheckins().map(c => `${c.date}|${c.sessionId || ''}`));
  if (Array.isArray(data.mindsetChecks)) {
    for (const raw of data.mindsetChecks) {
      const c = raw as any;
      if (!c || typeof c !== 'object' || typeof c.date !== 'string' || !DATE_RE.test(c.date)) continue;
      const k = `${c.date}|${c.sessionId || ''}`;
      if (mindKeys.has(k)) continue;
      upsertCheckin({
        date: c.date,
        sessionId: str(c.sessionId),
        confidence: typeof c.confidence === 'number' ? c.confidence : 3,
        arousal: typeof c.arousal === 'number' ? c.arousal : 3,
        focus: typeof c.focus === 'number' ? c.focus : 3,
        protocolFollowed: typeof c.protocolFollowed === 'boolean' ? c.protocolFollowed : null,
        note: str(c.note),
      });
      mindKeys.add(k);
      mind++;
    }
  }

  const mobKeys = new Set(loadMobilityCheckins().map(c => `${c.date}|${c.sessionId || ''}`));
  if (Array.isArray(data.mobilityChecks)) {
    for (const raw of data.mobilityChecks) {
      const c = raw as any;
      if (!c || typeof c !== 'object' || typeof c.date !== 'string' || !DATE_RE.test(c.date)) continue;
      const k = `${c.date}|${c.sessionId || ''}`;
      if (mobKeys.has(k)) continue;
      upsertMobilityCheckin({
        date: c.date,
        sessionId: str(c.sessionId),
        done: !!c.done,
        romScore: typeof c.romScore === 'number' ? c.romScore : null,
        note: str(c.note),
      });
      mobKeys.add(k);
      mob++;
    }
  }

  return { warmup, cooldown, stretch, mind, mob };
}
