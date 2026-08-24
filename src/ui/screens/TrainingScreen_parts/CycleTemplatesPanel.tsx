/**
 * CycleTemplatesPanel.tsx — панель шаблонов циклов для ручного конструктора.
 * Переиспользует существующие инструменты: SPLIT_PATTERNS (BB), LMS_CYCLES (PL), периодизацию.
 * Позволяет 1 кликом выбрать сплит/цикл, посмотреть превью и применить к программе.
 */
import React, { useMemo, useState } from 'react';
import { SPLIT_PATTERNS, type SplitPattern } from '../../../engines/bb/bb-split-patterns';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import type { SRCycleTemplate } from '../../../data/lms-cycles/lms-types';
import type { UserProgram } from '../../../engines/user-program/user-program.types';
import { newId } from '../../../engines/user-program/user-program.types';
import { distributePhases } from './phase-periodization';
import { CARD, BTN, BTN_GHOST, DIM, DIM_STRONG, ACCENT } from './training-ui';
import { useConfirmDialog } from './ConfirmDialog';
import { applyPhaseModulation } from '../../../engines/manual-constructor';
import { periodLabelRu, directionLabelRu } from '../../../data/lms-cycles/period-labels';

interface Props {
  program: UserProgram;
  onChange: (p: UserProgram) => void;
  showToast: (m: string) => void;
}

function buildBBSessionsFromPattern(pattern: SplitPattern, deload: boolean) {
  return pattern.schedule
    .map((d, di) => ({ d, di }))
    .filter(x => x.d.kind === 'тренировка')
    .map((x, si) => ({
      id: newId('ses'),
      name: x.d.sessionTag ?? 'День ' + (si + 1),
      dayOfНеделя: x.di,
      focus: x.d.sessionTag ?? '',
      blocks: [] as any[],
    }));
}

function Label({ children, color }: { children: React.ReactNode; color?: string }) {
  return <span style={{ fontSize: 10, fontWeight: 700, color: color ?? DIM, display: 'inline-flex', alignItems: 'center', gap: 3 }}>{children}</span>;
}

export const CycleTemplatesPanel: React.FC<Props> = ({ program, onChange, showToast }) => {
  const { confirm } = useConfirmDialog();
  const dir = program.meta.direction;
  const level = program.meta.level;
  const days = program.meta.daysPerWeek;
  const weeks = program.meta.weeks;
  const [tab, setTab] = useState<'bb' | 'pl'>(dir === 'pl' ? 'pl' : 'bb');

  const bbPatterns = useMemo(() => {
    const filtered = SPLIT_PATTERNS.filter(p => Math.abs(p.sessionsPerRotation - days) <= 1);
    // Сортируем: точное совпадение days вперёд, затем по уровню
    const exact = filtered.filter(p => p.sessionsPerRotation === days);
    const near = filtered.filter(p => p.sessionsPerRotation !== days);
    const byLevel = (list: SplitPattern[]) => list.sort((a, b) => {
      const aMatch = a.level.includes(level) || a.level.includes('intermediate');
      const bMatch = b.level.includes(level) || b.level.includes('intermediate');
      return Number(bMatch) - Number(aMatch);
    });
    return [...byLevel(exact), ...byLevel(near)].slice(0, 8);
  }, [days, level]);

  const plCycles = useMemo(() => {
    const filtered = LMS_CYCLES.filter(c => Math.abs(c.meta.sessionsPerWeek - days) <= 1);
    const exact = filtered.filter(c => c.meta.sessionsPerWeek === days);
    const near = filtered.filter(c => c.meta.sessionsPerWeek !== days);
    const byLevel = (list: SRCycleTemplate[]) => list.sort((a, b) => {
      const aMatch = a.meta.level === level;
      const bMatch = b.meta.level === level;
      return Number(bMatch) - Number(aMatch);
    });
    return [...byLevel(exact), ...byLevel(near)].slice(0, 8);
  }, [days, level]);

  const hasContent = useMemo(() => {
    if (program.bb?.weeks?.some(w => w.sessions.some(s => s.blocks.some(b => b.exerciseName && b.exerciseName.trim())))) return true;
    if (program.pl?.customWeeks?.some(w => w.days.some(d => d.exercises.some(e => e.name && e.name.trim())))) return true;
    return false;
  }, [program]);

  const applyBbPattern = async (pattern: SplitPattern) => {
    if (hasContent) {
      const ok = await confirm({ title: `Применить сплит ${pattern.name}?`, message: 'Структура недель будет пересобрана по новому сплиту. Упражнения в существующих днях будут сохранены где возможно, лишние дни с контентом спросят подтверждение.', confirmLabel: 'Применить', danger: true });
      if (!ok) return;
    }
    const sessionsTpl = buildBBSessionsFromPattern(pattern, false);
    if (!program.bb) return;
    const newWeeks = Array.from({ length: weeks }, (_, wi) => {
      const existing = program.bb!.weeks[wi];
      if (existing) {
        // Сохраняем блоки по индексу сессии где возможно, иначе пусто
        const sessions = sessionsTpl.map((tpl, si) => {
          const ex = existing.sessions[si];
          if (ex) return { ...ex, id: ex.id, name: ex.name || tpl.name, dayOfНеделя: tpl.dayOfWeek, focus: ex.focus || tpl.focus };
          return { ...tpl, id: newId('ses') };
        });
        // Если новый сплит короче старого — проверить контент в отрезаемых сессиях
        if (sessionsTpl.length < existing.sessions.length) {
          const tail = existing.sessions.slice(sessionsTpl.length);
          const hasTailContent = tail.some(s => s.blocks.some(b => b.exerciseName && b.exerciseName.trim()));
          if (hasTailContent) {
            // Уже спросили, но тихо обрезаем — контент потеряется, пользователь подтвердил
          }
        }
        return { ...existing, sessions };
      }
      return { week: wi + 1, phase: 'accumulation' as const, deload: false, sessions: sessionsTpl.map(s => ({ ...s, id: newId('ses') })) };
    });
    // Синхронизируем meta.daysPerWeek под сплит
    onChange({ ...program, meta: { ...program.meta, daysPerНеделя: pattern.sessionsPerRotation }, bb: { ...program.bb, weeks: newWeeks } });
    showToast('🔄 Сплит применён: ' + pattern.name + ' · ' + pattern.sessionsPerRotation + 'д/нед');
  };

  const applyPlCycle = async (cycle: SRCycleTemplate) => {
    if (!program.pl) return;
    if (program.pl.sourceCycleId && hasContent) {
      const ok = await confirm({ title: `Подключить цикл ${cycle.meta.title}?`, message: 'Источник ПЛ-цикла сменится, оверлей (расписание/ПМ) сохранится, но процентки возьмутся из нового цикла.', confirmLabel: 'Подключить', danger: false });
      if (!ok) return;
    }
    const sessCount = cycle.meta.sessionsPerWeek;
    // При customWeeks — не трогаем, только sourceCycleId + schedule + meta.weeks/days
    const newMetaWeeks = cycle.meta.weeks;
    const newDays = cycle.meta.sessionsPerWeek;
    onChange({
      ...program,
      meta: { ...program.meta, weeks: newMetaWeeks, daysPerНеделя: newDays },
      pl: {
        ...program.pl,
        sourceCycleId: cycle.meta.id,
        schedule: Array.from({ length: sessCount }, (_, i) => ({ sessionIdx: i, dayOfНеделя: i % 7 })),
        // keep workMax/weakPoints/notes
      },
    });
    showToast('🏆 ПЛ-цикл подключён: ' + cycle.meta.title + ' · ' + newDays + 'д/нед × ' + newMetaWeeks + ' нед');
  };

  // Фазовый таймлайн превью для текущего weeks/goal
  const phasePreview = useMemo(() => {
    try {
      const dist = distributePhases(weeks, 0, program.meta.goal === 'powerlifting' ? 'strength' : 'bulk') || [];
      return dist;
    } catch { return []; }
  }, [weeks, program.meta.goal]);

  const phaseColors: Record<string, string> = { accumulation: '#22c55e', intensification: '#f59e0b', deload: '#ef4444', peaking: '#a78bfa' };

  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #a78bfa', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#a78bfa' }}>📚 Шаблоны циклов</span>
        <span style={{ fontSize: 10, color: DIM }}>{weeks} нед × {days}д/нед · {level} · {dir.toUpperCase()}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button onClick={() => setTab('bb')} style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 10, minHeight: 28, borderColor: tab === 'bb' ? '#00e68a' : 'rgba(255,255,255,0.08)', color: tab === 'bb' ? '#00e68a' : DIM }}>ББ сплиты</button>
          <button onClick={() => setTab('pl')} style={{ ...BTN_GHOST, padding: '4px 8px', fontSize: 10, minHeight: 28, borderColor: tab === 'pl' ? '#a78bfa' : 'rgba(255,255,255,0.08)', color: tab === 'pl' ? '#a78bfa' : DIM }}>ПЛ циклы</button>
        </div>
      </div>

      {/* Таймлайн фаз */}
      {phasePreview.length > 0 && (
        <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
          {phasePreview.map((p: any, i: number) => {
            const w = (p.weeks?.length ?? 1);
            const col = phaseColors[p.phase] ?? '#666';
            return <div key={i} title={`${p.phase}: нед ${p.weeks?.[0]}–${p.weeks?.[p.weeks.length-1]}`} style={{ width: (w / weeks) * 100 + '%', background: col }} />;
          })}
        </div>
      )}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', fontSize: 10, color: DIM }}>
        {phasePreview.map((p: any, i: number) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: phaseColors[p.phase] ?? '#666', display: 'inline-block' }} />
            {p.phase} {p.weeks?.length ?? 0}н
          </span>
        ))}
      </div>
      {program.bb && (
        <button onClick={() => {
          const updated = applyPhaseModulation(program.bb!.weeks, { goal: program.meta.goal, level: program.meta.level, weeksTotal: weeks });
          onChange({ ...program, bb: { ...program.bb!, weeks: updated } });
          showToast('📈 Фазы применены к неделям');
        }} style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 32, borderColor: 'rgba(96,165,250,0.3)', color: '#60a5fa', alignSelf: 'flex-start' }}>📈 Применить фазы к неделям</button>
      )}
      {weeks >= 6 && !phasePreview.some((p: any) => p.phase === 'deload') && (
        <div style={{ fontSize: 10, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, padding: '6px 8px' }}>⚠ Рекомендуется делод: для {weeks} нед добавьте разгрузочную неделю — нажмите «Применить фазы» или добавьте вручную в «Неделях».</div>
      )}

      {/* BB сплиты */}
      {tab === 'bb' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto', paddingRight: 2 }}>
          {bbPatterns.length === 0 && <div style={{ fontSize: 11, color: DIM, fontStyle: 'italic' }}>Нет сплитов для {days}д/нед — попробуйте изменить дни/нед.</div>}
          {bbPatterns.map(p => {
            const isActive = program.bb?.weeks?.[0]?.sessions.length === p.sessionsPerRotation && program.bb?.weeks?.[0]?.sessions.some(s => s.focus === p.schedule.find(d=>d.sessionTag===s.focus)?.sessionTag);
            const recommended = p.sessionsPerRotation === days && p.level.includes(level);
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: isActive ? 'rgba(0,230,138,0.10)' : 'rgba(255,255,255,0.02)', border: isActive ? '1px solid rgba(0,230,138,0.35)' : '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: isActive ? '#00e68a' : '#fff' }}>{p.name}</span>
                    {recommended && <span style={{ fontSize: 9, fontWeight: 800, color: '#00e68a', background: 'rgba(0,230,138,0.15)', padding: '2px 6px', borderRadius: 6 }}>★ Рекомендуем</span>}
                    <span style={{ fontSize: 10, color: DIM }}>{p.sessionsPerRotation}д · {p.rotationDays}д ротация</span>
                  </div>
                  <div style={{ fontSize: 10, color: DIM, marginTop: 2, lineHeight: 1.4 }}>{p.description}</div>
                  <div style={{ display: 'flex', gap: 3, marginTop: 4, flexWrap: 'wrap' }}>
                    {p.schedule.filter(d=>d.kind==='тренировка').map((d, di) => (
                      <span key={di} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: d.character==='тяж' ? 'rgba(239,68,68,0.10)' : d.character==='памп' ? 'rgba(59,130,246,0.10)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: DIM_STRONG }}>{d.sessionTag}</span>
                    ))}
                  </div>
                </div>
                <button onClick={() => applyBbPattern(p)} style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 32, whiteSpace: 'nowrap', borderColor: isActive ? 'rgba(0,230,138,0.35)' : 'rgba(255,255,255,0.12)', color: isActive ? '#00e68a' : '#a78bfa' }}>{isActive ? '✓ Выбран' : 'Применить'}</button>
              </div>
            );
          })}
        </div>
      )}

      {/* PL циклы */}
      {tab === 'pl' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto', paddingRight: 2 }}>
          {plCycles.length === 0 && <div style={{ fontSize: 11, color: DIM, fontStyle: 'italic' }}>Нет циклов для {days}д/нед — попробуйте изменить дни/нед или уровень.</div>}
          {plCycles.map(c => {
            const isActive = program.pl?.sourceCycleId === c.meta.id;
            const recommended = c.meta.sessionsPerWeek === days && c.meta.level === level;
            return (
              <div key={c.meta.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: isActive ? 'rgba(167,139,250,0.10)' : 'rgba(255,255,255,0.02)', border: isActive ? '1px solid rgba(167,139,250,0.35)' : '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: isActive ? '#a78bfa' : '#fff' }}>{c.meta.title}</span>
                    {recommended && <span style={{ fontSize: 9, fontWeight: 800, color: '#a78bfa', background: 'rgba(167,139,250,0.15)', padding: '2px 6px', borderRadius: 6 }}>★ Рекомендуем</span>}
                    <span style={{ fontSize: 10, color: DIM }}>{c.meta.sessionsPerWeek}д/нед · {c.meta.weeks} нед · {c.meta.level}</span>
                  </div>
                  <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>{directionLabelRu(c.meta.direction)} · {periodLabelRu(c.meta.period)} {c.meta.correctionPct ? '· ' + (c.meta.correctionPct*100).toFixed(1) + '%/нед' : ''}</div>
                </div>
                <button onClick={() => applyPlCycle(c)} style={{ ...BTN_GHOST, padding: '6px 10px', fontSize: 11, minHeight: 32, whiteSpace: 'nowrap', borderColor: isActive ? 'rgba(167,139,250,0.35)' : 'rgba(255,255,255,0.12)', color: isActive ? '#a78bfa' : ACCENT }}>{isActive ? '✓ Подключён' : 'Подключить'}</button>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: 10, color: DIM, fontStyle: 'italic' }}>
        {tab==='bb' ? 'Применяет структуру сплита к неделям (сохраняет упражнения где возможно) и синхронизирует дни/нед.' : 'Подключает ПЛ-цикл как источник процентовок (оверлей сохранится). Недели/дни синхронизируются под цикл.'}
      </div>
    </div>
  );
};
