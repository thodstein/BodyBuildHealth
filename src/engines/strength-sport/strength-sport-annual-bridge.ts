/**
 * strength-sport-annual-bridge.ts — мост SS annual → общий annual-training (MANUAL блоки).
 * Изолировано, не мутирует annual-training движок, только пишет localStorage.
 */
import type { StrengthSportPlan } from './strength-sport.types';
import type { AnnualSS } from './strength-sport-annual';
import { saveAnnualSS } from './strength-sport-annual';

/**
 * SS-план → UserWeek[] для общего годового плана.
 *
 * P1 (аудит 2026-10): раньше мост терял данные — в сет уезжали только
 * `{reps, rir, restSec, note}`, а рабочий ВЕС, % ПМ, темп, холд и дистанция
 * переносокок отбрасывались. Стронг-план, вставленный в общий год, показывал
 * повторы и RIR без единого килограмма и без метра дистанции — план был
 * неисполним. UserSet поддерживает weight/pctOf1RM/tempo/holdSeconds/note,
 * поэтому теперь всё переносится (дистанция/cap — в note, отдельного поля нет).
 */
export function ssPlanToUserWeeks(plan: StrengthSportPlan): any[] {
  return plan.weeksData.map(w => ({
    week: w.week,
    phase: w.phase,
    deload: !!w.deload,
    sessions: w.sessions.map(s => ({
      id: `ss-${w.week}-${s.day}`,
      name: s.sessionTag,
      dayOfWeek: s.day - 1,
      focus: s.focus || s.sessionTag,
      character: s.character,
      estimatedMin: s.durationMin,
      blocks: s.exercises.map(ex => {
        const ws0: any = ex.workSets?.[0];
        const notes: string[] = [];
        if (ws0?.tempo) notes.push(`tempo ${ws0.tempo}`);
        if (ws0?.distanceM) notes.push(`${ws0.distanceM}м`);
        if (ws0?.timeCapS) notes.push(`cap ${ws0.timeCapS}с`);
        if (ws0?.opener) notes.push('Opener 90% 1×1');
        if (ex.warmupSets?.length) notes.push(`разминка ${ex.warmupSets.map((x: any) => `${x.reps}×${x.weight}`).join(' → ')}`);
        const repsLo = parseInt(String(ex.reps), 10) || 0;
        const repsHi = parseInt(String(ex.reps).split('-')[1] || String(ex.reps), 10) || repsLo;
        return {
          id: `blk-${ex.id}`,
          type: ex.role === 'primary' ? 'compound' : 'accessory',
          exerciseName: ex.name,
          muscle: ex.group,
          role: ex.role,
          character: ex.character,
          repsRange: repsLo > 0 && repsHi > 0 ? ([repsLo, repsHi] as [number, number]) : undefined,
          tempoSpec: ex.tempo,
          comment: ex.comment,
          warmupSets: ex.warmupSets?.map((x: any) => ({ load: x.weight, reps: x.reps })),
          sets: ex.workSets.map(ws => {
            const noteParts: string[] = [];
            if (ws.tempo) noteParts.push(`tempo ${ws.tempo}`);
            if ((ws as any).distanceM) noteParts.push(`${(ws as any).distanceM}м`);
            if ((ws as any).timeCapS) noteParts.push(`cap ${(ws as any).timeCapS}с`);
            if ((ws as any).opener) noteParts.push('Opener 90% 1×1');
            return {
              reps: ws.reps,
              rir: ws.rir,
              weight: ws.weight > 0 ? ws.weight : undefined,
              pctOf1RM: (ws as any).pct ? (ws as any).pct / 100 : undefined,
              tempo: ws.tempo,
              holdSeconds: (ws as any).holdSeconds,
              restSec: ws.restSeconds,
              note: noteParts.length ? noteParts.join(' · ') : undefined,
            };
          }),
        };
      }),
    })),
  })) as any[];
}


/**
 * Мост SS-года → общий годовой план (`he_annual_training_plan_v1`).
 *
 * P1 (аудит 2026-10): было `catch {}` — при битом сторе/квоте пользователь не
 * видел ничего, хотя кнопка сообщала «✦ Сезон собран». Теперь отказ честный:
 * функция возвращает `{ ok, note }`, а UI показывает предупреждение.
 *
 * P1: блоки SS теперь не создают ПЕРЕСЕЧЕНИЙ с уже существующими блоками года
 * — пересекающиеся SS-блоки помечаются и пропускаются (раньше два блока могли
 * claiming одни и те же недели, и общий год становился непоследовательным).
 */
export function syncStrengthAnnualToGeneral(annual: AnnualSS): { ok: boolean; note?: string } {
  try {
    const ssBlocks = annual.blocks.filter(b => !!b.plan);
    if (!ssBlocks.length) return { ok: false, note: 'SS-год без собранных блоков' };
    const raw = localStorage.getItem('he_annual_training_plan_v1');
    if (!raw) {
      // нет общего годового — создаём минимальный из SS
      const general = buildGeneralFromSS(annual, ssBlocks);
      localStorage.setItem('he_annual_training_plan_v1', JSON.stringify(general));
      window.dispatchEvent(new CustomEvent('he-annual-training-plan-updated', { detail: general }));
      writeSyncKey(annual);
      return { ok: true };
    }
    const general = JSON.parse(raw);
    const blocks: any[] = Array.isArray(general.blocks) ? general.blocks : [];
    // detect overlap with existing blocks (same calendar weeks = conflict)
    const overlaps = (startWeek: number, weeks: number): any[] =>
      blocks.filter((b: any) => {
        const s = Number(b?.ref?.startWeek), w = Number(b?.ref?.weeks);
        if (!Number.isFinite(s) || !Number.isFinite(w) || w <= 0) return false;
        return startWeek < s + w && s < startWeek + weeks;
      });
    const seen = new Set(blocks.map((b: any) => b?.ref?.blockKey));
    let added = 0;
    let already = 0;
    let conflicted = 0;
    for (const b of ssBlocks) {
      const key = `ss-${b.id}`;
      if (seen.has(key)) { already++; continue; }
      const clash = overlaps(b.startWeek, b.weeks);
      // Пересечение с САМИМ этим SS-блоком (его taper-половина или он сам из
      // прошлой синхронизации) — это «уже в плане», а не конфликт.
      const foreign = clash.filter((x: any) => {
        const k = String(x?.ref?.blockKey || '');
        return k !== key && k !== `${key}-taper`;
      });
      if (foreign.length) {
        // SS-блок claiming занятые недели общего года — не пишем молча
        conflicted++;
        continue;
      }
      const taperWeeks = b.taperWeeks && b.competitionDate ? Math.max(1, Math.min(2, b.taperWeeks)) : 0;
      if (taperWeeks > 0 && b.weeks > taperWeeks) {
        const mainWeeks = b.weeks - taperWeeks;
        blocks.push({
          ref: { blockKey: key, blockIndex: blocks.length, kind: 'MANUAL', phase: 'strength', startWeek: b.startWeek, weeks: mainWeeks, description: `SS ${b.mode} ${mainWeeks}нед` },
          config: { notes: `SS ${b.mode} ${b.plan!.mode} ${mainWeeks}нед` },
          status: 'built',
          result: { blockKey: key, kind: 'MANUAL', weeks: ssPlanToUserWeeks({ ...b.plan!, weeksData: b.plan!.weeksData.slice(0, mainWeeks) } as any), program: null, bbPlan: null, warnings: [], taperApplied: false, peakApplied: false, configHash: 'ss-bridge' },
          builtAt: new Date().toISOString(),
        });
        const taperKey = `${key}-taper`;
        if (!seen.has(taperKey)) {
          blocks.push({
            ref: { blockKey: taperKey, blockIndex: blocks.length, kind: 'MANUAL', phase: 'taper', startWeek: b.startWeek + mainWeeks, weeks: taperWeeks, description: `SS taper ${taperWeeks}нед к ${b.competitionDate}` },
            config: { notes: `taper ${taperWeeks}нед`, taper: { enabled: true, weeks: taperWeeks } },
            status: 'built',
            result: { blockKey: taperKey, kind: 'MANUAL', weeks: ssPlanToUserWeeks({ ...b.plan!, weeksData: b.plan!.weeksData.slice(mainWeeks) } as any), program: null, bbPlan: null, warnings: [], taperApplied: true, peakApplied: false, configHash: 'ss-taper-bridge' },
            builtAt: new Date().toISOString(),
          });
        }
      } else {
        blocks.push({
          ref: { blockKey: key, blockIndex: blocks.length, kind: 'MANUAL', phase: 'strength', startWeek: b.startWeek, weeks: b.weeks, description: `SS ${b.mode} ${b.weeks}нед` },
          config: { notes: `SS ${b.mode} ${b.plan!.mode} ${b.weeks}нед` },
          status: 'built',
          result: { blockKey: key, kind: 'MANUAL', weeks: ssPlanToUserWeeks(b.plan!), program: null, bbPlan: null, warnings: [], taperApplied: !!b.plan!.weeksData.some(w => w.taper), peakApplied: false, configHash: 'ss-bridge' },
          builtAt: new Date().toISOString(),
        });
      }
      general.totalWeeks = Math.max(Number(general.totalWeeks) || 0, b.startWeek + b.weeks - 1);
      added++;
    }
    if (!added && !conflicted) return { ok: true, note: already ? 'SS-блоки уже в общем годовом плане' : undefined };
    if (!added && conflicted) {
      return { ok: false, note: `SS-блоки не вписаны: недели ${conflicted} заняты другими блоками года` };
    }
    general.blocks = blocks;
    general.updatedAt = new Date().toISOString();
    localStorage.setItem('he_annual_training_plan_v1', JSON.stringify(general));
    window.dispatchEvent(new CustomEvent('he-annual-training-plan-updated', { detail: general }));
    writeSyncKey(annual);
    return { ok: true, note: conflicted ? `добавлено ${added}, пропущено ${conflicted} (пересечение с годом)` : undefined };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    try { console.warn('[SS annual bridge]', m); } catch { /* консоль недоступен */ }
    return { ok: false, note: m };
  }
}

/** Минимальный общий год из SS-блоков (когда общего ещё нет). */
function buildGeneralFromSS(annual: AnnualSS, ssBlocks: AnnualSS['blocks']): any {
  // P1 (аудит 2026-10): ключи блоков должны совпадать с merge-путём (`ss-<id>`),
  // иначе повторная синхронизация не узнаёт свои же блоки, считает их чужими
  // и сообщает ложный «пересечение недель».
  return {
    id: `annual_${Date.now()}`,
    version: 1,
    totalWeeks: annual.totalWeeks,
    direction: 'mixed',
    macroRef: null,
    blocks: ssBlocks.flatMap(b => {
      const key = `ss-${b.id}`;
      const taperWeeks = b.taperWeeks && b.competitionDate ? Math.max(1, Math.min(2, b.taperWeeks)) : 0;
      if (taperWeeks > 0 && b.plan && b.weeks > taperWeeks) {
        const mainWeeks = b.weeks - taperWeeks;
        return [
          {
            ref: { blockKey: key, blockIndex: 0, kind: 'MANUAL', phase: 'strength', startWeek: b.startWeek, weeks: mainWeeks, description: `SS ${b.mode} ${mainWeeks}нед` },
            config: { notes: `SS ${b.mode} ${b.plan?.mode || ''}` },
            status: 'built',
            result: b.plan ? { blockKey: key, kind: 'MANUAL', weeks: ssPlanToUserWeeks({ ...b.plan, weeksData: b.plan.weeksData.slice(0, mainWeeks) } as any), program: null, bbPlan: null, warnings: [], taperApplied: false, peakApplied: false, configHash: 'ss' } : undefined,
            builtAt: new Date().toISOString(),
          },
          {
            ref: { blockKey: `${key}-taper`, blockIndex: 1, kind: 'MANUAL', phase: 'taper', startWeek: b.startWeek + mainWeeks, weeks: taperWeeks, description: `SS taper ${taperWeeks}нед к ${b.competitionDate}` },
            config: { notes: `taper ${taperWeeks}нед`, taper: { enabled: true, weeks: taperWeeks } },
            status: 'built',
            result: b.plan ? { blockKey: `${key}-taper`, kind: 'MANUAL', weeks: ssPlanToUserWeeks({ ...b.plan, weeksData: b.plan.weeksData.slice(mainWeeks) } as any), program: null, bbPlan: null, warnings: [], taperApplied: true, peakApplied: false, configHash: 'ss-taper' } : undefined,
            builtAt: new Date().toISOString(),
          },
        ];
      }
      return [{
        ref: { blockKey: key, blockIndex: 0, kind: 'MANUAL', phase: 'strength', startWeek: b.startWeek, weeks: b.weeks, description: `SS ${b.mode} ${b.weeks}нед` },
        config: { notes: `SS ${b.mode} ${b.plan?.mode || ''}` },
        status: 'built',
        result: b.plan ? { blockKey: key, kind: 'MANUAL', weeks: ssPlanToUserWeeks(b.plan), program: null, bbPlan: null, warnings: [], taperApplied: !!b.taperWeeks, peakApplied: false, configHash: 'ss' } : undefined,
        builtAt: new Date().toISOString(),
      }];
    }),
    status: 'built',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function writeSyncKey(annual: AnnualSS): void {
  try {
    localStorage.setItem('he_strength_annual_sync_v1', JSON.stringify({
      updatedAt: new Date().toISOString(),
      totalWeeks: annual.totalWeeks,
      blocks: annual.blocks.map(b => ({ startWeek: b.startWeek, weeks: b.weeks, mode: b.mode })),
    }));
  } catch { /* sync-ключ — вспомогательный */ }
}
