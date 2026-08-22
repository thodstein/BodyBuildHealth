/**
 * QualityChecklistCard.tsx — чек-лист качества для ручного конструктора, доступен всем (standard тоже).
 * Проверяет 6 критериев качественной программы и предлагает 1-клик фиксы из существующих инструментов.
 */
import React from 'react';
import { CARD, BTN, BTN_GHOST, DIM, DIM_STRONG, ACCENT } from './training-ui';
import { newId } from '../../../engines/user-program/user-program.types';
import type { UserProgram } from '../../../engines/user-program/user-program.types';
import { computePlanQualityFor, muscleAwareSets, makeSetsFromTemplate, suggestExercisesForGroup } from '../../../engines/manual-constructor';
import { loadTrainingProfile } from './training-profile';
import { GROUP_RU } from './program-types';
import { applyPhaseModulation } from '../../../engines/manual-constructor';
import { resizeTrainingSessions } from './program-editor-logic';
import { distributePhases } from './phase-periodization';

interface Props {
  program: UserProgram;
  onChange: (p: UserProgram) => void;
  showToast: (m: string) => void;
  tprofile: any;
  labMrv: number;
}

export const QualityChecklistCard: React.FC<Props> = ({ program, onChange, showToast, tprofile, labMrv }) => {
  const dir = program.meta.direction;
  const weeks = program.meta.weeks;
  const days = program.meta.daysPerWeek;

  // --- helpers ---
  const hasTitle = !!(program.meta.title && program.meta.title.trim().length >= 3);
  const hasWeeks = dir === 'bb' ? (program.bb?.weeks.length ?? 0) >= 1 : dir === 'pl' ? ((program.pl?.customWeeks?.length ?? 0) >= 1 || !!program.pl?.sourceCycleId) : ((program.hybrid?.bbWeeks?.length ?? 0) >= 1 || !!(program.hybrid?.plRef?.sourceCycleId));
  const hasEmptySessions = (() => {
    if (dir === 'bb' && program.bb) return program.bb.weeks.some(w => w.sessions.length === 0 || w.sessions.some(s => !(s.blocks ?? []).some(b => b.exerciseName && b.exerciseName.trim())));
    if (dir === 'pl' && program.pl?.customWeeks) return program.pl.customWeeks.some(w => w.days.some(d => !(d.exercises ?? []).some(e => e.name && e.name.trim())));
    if (dir === 'hybrid' && program.hybrid) return (program.hybrid.bbWeeks ?? []).some(w => w.sessions.some(s => !(s.blocks ?? []).some(b => b.exerciseName && b.exerciseName.trim())));
    return false;
  })();
  const daysMismatch = dir === 'bb' && program.bb ? (program.bb.weeks[0]?.sessions.length ?? 0) !== days : false;
  const q = (() => { try { return computePlanQualityFor(program, program.meta.level, { onCourse: tprofile?.onCourse ?? false, courseIntensity: tprofile?.courseIntensity ?? 'moderate', labMult: labMrv }); } catch { return null; } })();
  const volumeOk = q ? q.perMuscle.every(m => m.status === 'ok' || m.status === 'high') : false;
  const volumeIssues = q ? q.perMuscle.filter(m => m.status === 'low' || m.status === 'over').slice(0, 3) : [];
  const hasDeload = (() => {
    if (weeks < 6) return true;
    if (dir === 'bb' && program.bb) return program.bb.weeks.some(w => w.deload || w.phase === 'deload');
    if (dir === 'pl' && program.pl?.customWeeks) return program.pl.customWeeks.some(w => w.deload);
    if (dir === 'hybrid' && program.hybrid) return (program.hybrid.bbWeeks ?? []).some(w => (w as any).deload);
    return true;
  })();
  const phaseOk = (() => {
    try {
      const dist = distributePhases(weeks, 0, program.meta.goal === 'powerlifting' ? 'strength' : 'bulk');
      return dist.length >= 2;
    } catch { return true; }
  })();

  const checks: Array<{ id: string; label: string; ok: boolean; warn?: boolean; hint: string; fix?: () => void; fixLabel?: string }> = [
    { id: 'title', label: 'Название', ok: hasTitle, hint: hasTitle ? '✓ ' + program.meta.title : 'Укажите название (≥3 символов)', },
    { id: 'weeks', label: 'Структура', ok: hasWeeks && !hasEmptySessions, warn: hasWeeks && hasEmptySessions, hint: !hasWeeks ? 'Нет недель' : hasEmptySessions ? 'Есть пустые тренировки — заполните 1 кликом' : `${weeks} нед × ${days}д/нед`,
      fix: hasEmptySessions ? () => {
        if (dir === 'bb' && program.bb) {
          const prof = loadTrainingProfile();
          const updated = program.bb.weeks.map(w => ({
            ...w,
            sessions: w.sessions.map(s => {
              if ((s.blocks ?? []).some(b => b.exerciseName && b.exerciseName.trim())) return s;
              const txt = (s.focus || s.name || '').toLowerCase();
              let ms: string[] = [];
              if (txt.includes('грудь')) ms = ['chest','triceps'];
              else if (txt.includes('спин')) ms = ['back','biceps'];
              else if (txt.includes('ног')) ms = ['legs','shoulders'];
              else if (txt.includes('плеч')) ms = ['shoulders','arms'];
              else ms = ['chest','back'];
              const blocks = ms.slice(0,2).map(m=> {
                const exs = suggestExercisesForGroup(m, program.meta.level, 1, (prof.equipment ?? []) as any, [], [], (prof as any).avoidAxialLoad ?? false, (prof.favoriteExercises ?? []) as any, (prof.excludedExercises ?? []) as any);
                const wgt = (prof.workMax ?? {} as any)[m] ?? 40;
                const sets = makeSetsFromTemplate(muscleAwareSets(m, program.meta.level) as any, wgt);
                return { id: newId('blk'), type: (exs[0]?.type === 'compound' ? 'compound' : 'accessory') as 'compound' | 'accessory', exerciseName: exs[0]?.name ?? '', muscle: m, role: (exs[0]?.type === 'compound' ? 'primary' : 'accessory') as 'primary' | 'accessory', sets: sets.length ? sets : [{ reps: 10, rir: 2 } as any] };
              });
              return { ...s, blocks };
            }),
          }));
          onChange({ ...program, bb: { ...program.bb!, weeks: updated } });
          showToast('⚡ Пустые тренировки заполнены');
        }
      } : undefined, fixLabel: '⚡ Заполнить пустые',
    },
    { id: 'volume', label: 'Объём', ok: volumeOk, warn: !volumeOk && !!q, hint: q ? (volumeOk ? `✓ ${q.score}/100 ${q.grade}` : `${q.score}/100 ${q.grade} — ${volumeIssues.map(v=> (GROUP_RU[v.muscle] ?? v.muscle) + (v.status==='low' ? ' ↓' : ' ↑')).join(', ')}`) : 'Нет данных',
      fix: volumeIssues.length ? () => {
        // 1-клик фикс первого недобора/перегруза
        const first = volumeIssues[0];
        if (!first || !program.bb?.weeks[0]?.sessions[0]) return;
        if (first.status === 'low') {
          const prof = loadTrainingProfile();
          const exs = suggestExercisesForGroup(first.muscle, program.meta.level, 1, (prof.equipment ?? []) as any, [], [], (prof as any).avoidAxialLoad ?? false, (prof.favoriteExercises ?? []) as any, (prof.excludedExercises ?? []) as any);
          const w = (prof.workMax ?? {} as any)[first.muscle] ?? 40;
          const sets = makeSetsFromTemplate(muscleAwareSets(first.muscle, program.meta.level) as any, w);
          const nb: any = { id: newId('blk'), type: 'accessory' as const, exerciseName: exs[0]?.name ?? '', muscle: first.muscle, role: 'accessory' as const, sets: sets.length ? sets : [{ reps: 10, rir: 2, weight: w, restSec: 90 }] };
          const updated: any = { ...program, bb: { ...program.bb!, weeks: (program.bb!.weeks as any).map((wk: any, wi: number) => wi === 0 ? { ...wk, sessions: wk.sessions.map((s: any, si: number) => si === 0 ? { ...s, blocks: [...s.blocks, nb] } : s) } : wk) } };
          onChange(updated);
          showToast('➕ ' + (GROUP_RU[first.muscle] ?? first.muscle));
        } else {
          const w0 = program.bb!.weeks[0];
          const s0 = w0.sessions[0];
          const idx = [...s0.blocks].map((b, i) => ({ b, i })).filter(x => x.b.muscle === first.muscle).pop()?.i;
          if (idx == null) return;
          const blk = s0.blocks[idx];
          let newBlocks;
          if (blk.sets.length > 1) newBlocks = s0.blocks.map((b, i) => i === idx ? { ...b, sets: b.sets.slice(0, -1) } : b);
          else newBlocks = s0.blocks.filter((_, i) => i !== idx);
          const updated: any = { ...program, bb: { ...program.bb!, weeks: program.bb!.weeks.map((wk, wi) => wi === 0 ? { ...wk, sessions: wk.sessions.map((s, si) => si === 0 ? { ...s, blocks: newBlocks } : s) } : wk) } };
          onChange(updated);
          showToast('➖ ' + (GROUP_RU[first.muscle] ?? first.muscle));
        }
      } : undefined, fixLabel: volumeIssues[0]?.status === 'low' ? '＋ Добавить' : volumeIssues[0]?.status === 'over' ? '− Убрать' : undefined,
    },
    { id: 'phases', label: 'Фазы', ok: phaseOk && hasDeload, warn: !hasDeload && weeks >= 6, hint: !phaseOk ? 'Нет фаз' : !hasDeload && weeks >=6 ? 'Нет делода (рекомендуется)' : `${weeks} нед — фазы распределены`,
      fix: !hasDeload && weeks >=6 && program.bb ? () => {
        const updated = applyPhaseModulation(program.bb!.weeks, { goal: program.meta.goal, level: program.meta.level, weeksTotal: weeks });
        onChange({ ...program, bb: { ...program.bb!, weeks: updated } });
        showToast('📈 Фазы и делод применены');
      } : undefined, fixLabel: '📈 Фазы',
    },
    { id: 'days', label: 'Дни', ok: !daysMismatch, warn: daysMismatch, hint: daysMismatch ? `⚠ ${days}д/нед ↔ в неделе ${program.bb?.weeks[0]?.sessions.length ?? 0}` : `✓ ${days}д/нед`,
      fix: daysMismatch ? () => {
        const w = program.bb!.weeks;
        const updated = w.map(week => ({ ...week, sessions: resizeTrainingSessions(week.sessions, days, week.deload) }));
        onChange({ ...program, bb: { ...program.bb!, weeks: updated as any } });
        showToast('✓ Выровнено ' + days + 'д/нед');
      } : undefined, fixLabel: '↔ Выровнять',
    },
  ];

  const okCount = checks.filter(c => c.ok).length;
  const total = checks.length;
  const pct = Math.round((okCount/total)*100);
  const barColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ ...CARD, padding: 10, borderLeft: `3px solid ${barColor}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: barColor }}>✅ Чек-лист качества</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: barColor }}>{okCount}/{total} · {pct}%</span>
        <div style={{ flex: 1, minWidth: 80, maxWidth: 120, height: 6, borderRadius: 6, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{ width: pct + '%', height: '100%', background: barColor }} />
        </div>
        <span style={{ fontSize: 10, color: DIM }}>{pct >=80 ? 'готово к сохранению' : pct >=50 ? 'нужны правки' : 'требует внимания'}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {checks.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 8, background: c.ok ? 'rgba(34,197,94,0.06)' : c.warn ? 'rgba(245,158,11,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${c.ok ? 'rgba(34,197,94,0.15)' : c.warn ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'}`}}>
            <span style={{ width: 18, height: 18, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, background: c.ok ? '#22c55e' : c.warn ? '#f59e0b' : '#ef4444', color: '#fff' }}>{c.ok ? '✓' : c.warn ? '!' : '✕'}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: c.ok ? '#22c55e' : c.warn ? '#f59e0b' : '#ef4444', minWidth: 60 }}>{c.label}</span>
            <span style={{ fontSize: 11, color: DIM_STRONG, flex: 1 }}>{c.hint}</span>
            {c.fix && <button onClick={c.fix} style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 10, minHeight: 28, borderColor: c.warn ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)', color: c.warn ? '#f59e0b' : '#ef4444' }}>{c.fixLabel}</button>}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: DIM, fontStyle: 'italic' }}>1 клик — исправляет прямо в программе. Подробности — в «Анализ» (pro) и в «Итоге».</div>
    </div>
  );
};
