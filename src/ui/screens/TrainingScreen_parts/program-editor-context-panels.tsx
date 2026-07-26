/**
 * program-editor-context-panels.tsx — контекстные панели прямо в ProgramEditor.
 *
 * В отличие от калькуляторов-в-зоне "⚡ Интеллект" (BbToolsCard, PlWeakpointsCard,
 * VolumeOptimizerTab и т.п.), эти панели работают НА ТЕКУЩЕЙ редактируемой
 * программе: они не задают вопросы пользователю, а ВЫВОДЯТ её состояние:
 * текущий объём по группам, MRV-баланс, отсутствующие слабые группы.
 *
 * Это превращает "общие калькуляторы" в "панели для конструирования программ".
 */
import React, { useMemo } from 'react';
import type { UserProgram } from '../../../engines/user-program/user-program.types';
import { GROUP_RU, ACCENT, DIM, SET_TEMPLATES } from './program-types';
import { getVolumeLandmarks } from '../../../engines/volume-landmarks.engine';
import { LMS_CYCLES, getCycleById } from '../../../data/lms-cycles/lms-cycle-index';
import type { SRDaySpec } from '../../../data/lms-cycles/lms-types';

const DIM_STRONG = 'rgba(255,255,255,0.85)';
const CARD: React.CSSProperties = {
  background: 'rgba(24,24,27,0.5)',
  borderRadius: 12,
  padding: 10,
  border: '1px solid rgba(255,255,255,0.05)',
};

const MUSCLE_ORDER = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;

/** Сравнить текущие сеты с MRV/MAV по уровню. */
function compareWithLandmarks(level: string, current: number, muscle: string): { status: 'over' | 'high' | 'ok' | 'low' | 'u_meaning'; label: string; pct: number } {
  try {
    const lm = getVolumeLandmarks(level, muscle);
    if (!lm) return { status: 'u_meaning', label: 'нет ландмарок', pct: 0 };
    if (current > lm.mrv) return { status: 'over', label: `⚠ > MRV (${lm.mrv})`, pct: Math.round((current / lm.mrv) * 100) };
    if (current >= lm.mav) return { status: 'high', label: `🔶 MAV→${lm.mav} (MRV ${lm.mrv})`, pct: Math.round((current / lm.mav) * 100) };
    if (current >= lm.mev) return { status: 'ok', label: `✅ в MEV→MAV`, pct: Math.round((current / lm.mev) * 100) };
    return { status: 'low', label: `⬇ ниже MEV (${lm.mev})`, pct: Math.round((current / lm.mev) * 100) };
  } catch { return { status: 'u_meaning', label: 'ошибка ландмарок', pct: 0 }; }
}

/** ────────────────────────────────────────────────────────────────────────
 *  BBContextPanel: текущее состояние ББ-программы внутри ProgramEditor.
 *  Показывает: распределение MRV по группам, статус нагрузки, weak-point покрытие.
 *  Использует те же движки (calcBBPlanMetrics-style вычисления), но без UI-ввода.
 *  ──────────────────────────────────────────────────────────────────────── */
export const BbContextPanel: React.FC<{ program: UserProgram; level: string }> = ({ program, level }) => {
  const bb = program.bb;

  const weeklySetsByMuscle = useMemo(() => {
    if (!bb) return {};
    const out: Record<string, number> = {};
    for (const w of bb.weeks) {
      for (const s of w.sessions) {
        for (const b of s.blocks) {
          if (b.muscle) out[b.muscle] = (out[b.muscle] || 0) + b.sets.reduce((sum, set) => sum + (set.reps ? 1 : 0), 0);
        }
      }
    }
    return out;
  }, [bb]);

  const statusByMuscle = useMemo(() => {
    return MUSCLE_ORDER.map((g) => {
      const cur = weeklySetsByMuscle[g] || 0;
      const cmp = compareWithLandmarks(level, cur, g);
      return { muscle: g, current: cur, ...cmp, missing: 'weak' };
    }).filter((row) => row.current > 0 || ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'].includes(row.muscle));
  }, [weeklySetsByMuscle, level]);

  if (!bb) return null;

  const totalSets = Object.values(weeklySetsByMuscle).reduce((a, b) => a + b, 0);
  const ungrouped = Object.keys(weeklySetsByMuscle).filter((k) => !MUSCLE_ORDER.includes(k as any));

  const totalWeeks = bb.weeks.length;
  const totalSessions = bb.weeks.reduce((sum, w) => sum + w.sessions.length, 0);
  const compoundBlocks = bb.weeks.reduce((sum, w) => sum + w.sessions.reduce((s2, s) => s2 + s.blocks.filter((b) => b.type === 'compound').length, 0), 0);

  if (totalSessions === 0) {
    return (
      <div style={{ ...CARD, padding: 10, borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>📋 Текущая программа</div>
        <div style={{ fontSize: 11, color: DIM, marginTop: 4 }}>
          Нет ни одной сессии. Добавьте первую сессию и упражнения — панель покажет MRV-баланс и ссылки на инструменты.
        </div>
        <div style={{ fontSize: 10, color: DIM, marginTop: 6, lineHeight: 1.5 }}>
          💡 Используйте кнопку <b>«⚡ Заполнить автоматически»</b> выше, чтобы получить черновик с подобранными упражнениями.
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '2px solid rgba(0,230,138,0.2)' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, marginBottom: 6 }}>📋 Состояние ББ-программы</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 6, marginBottom: 8 }}>
        <Mini label="Недели" value={totalWeeks} />
        <Mini label="Сессии" value={totalSessions} />
        <Mini label="Базовых" value={compoundBlocks} />
        <Mini label="Сетов/нед" value={totalSets} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {statusByMuscle.map((row) => (
          <div key={row.muscle} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
            <span style={{ fontSize: 10, color: DIM_STRONG, flex: '0 0 90px' }}>{GROUP_RU[row.muscle] ?? row.muscle}</span>
            <span style={{ flex: 1, fontSize: 10, color: row.status === 'over' ? '#ef4444' : row.status === 'low' ? '#3b82f6' : DIM_STRONG }}>{row.label}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: row.status === 'over' ? '#ef4444' : row.status === 'low' ? '#3b82f6' : ACCENT, minWidth: 28, textAlign: 'right' }}>{row.current} с</span>
          </div>
        ))}
        {ungrouped.length > 0 && (
          <div style={{ fontSize: 10, color: DIM, padding: '2px 6px', fontStyle: 'italic' }}>
            ⚠ Не сгруппированы: {ungrouped.map((u) => GROUP_RU[u] ?? u).join(', ')}
          </div>
        )}
      </div>

      <div style={{ marginTop: 8, padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>🔗 Конструкторские инструменты (для этого плана)</div>
        <div style={{ fontSize: 10, color: DIM, lineHeight: 1.5 }}>
          Измените состав группы мышц → панель выше покажет, где вы у цели, где слишком мало/много.
          Откройте сессию для редактирования упражнений, сетов, RIR, веса, отдыха — все поля редактируемы.
        </div>
      </div>
    </div>
  );
};

const Mini: React.FC<{ label: string; value: number | string }> = ({ label, value }) => (
  <div style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, textAlign: 'center' }}>
    <div style={{ fontSize: 11, color: DIM, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
    <div style={{ fontSize: 13, fontWeight: 800, color: DIM_STRONG }}>{value}</div>
  </div>
);

/** ────────────────────────────────────────────────────────────────────────
 *  PLContextPanel: текущее состояние ПЛ-программы.
 *  Показывает: какой LMS-цикл выбран, ПМ-прогресс по неделям, weak-points покрытие.
 *  + Полная визуализация упражнений цикла (week1 + weeks[1..N]) с расчётом весов из ПМ.
 *  ──────────────────────────────────────────────────────────────────────── */
export const PLContextPanel: React.FC<{ program: UserProgram }> = ({ program }) => {
  const pl = program.pl;

  const cycle = useMemo(() => {
    try { if (!pl?.sourceCycleId) return null; return getCycleById(pl.sourceCycleId); } catch { return null; }
  }, [pl?.sourceCycleId]);

  if (!pl) return null;

  /** Вычислить рабочий вес по % от ПМ (если известны). */
  const calcWeight = (pct: number, lift: 'squat' | 'bench' | 'dead'): number | null => {
    const pm = pl.workMax?.[lift];
    if (!pm || pm <= 0) return null;
    return Math.round((pm * pct) / 2.5) * 2.5;
  };

  if (!cycle) {
    return (
      <div style={{ ...CARD, padding: 10, borderLeft: '2px solid #ef4444' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#ef4444' }}>⚠ Цикл не выбран</div>
        <div style={{ fontSize: 11, color: DIM, marginTop: 4 }}>
          Вернитесь в список программ и подключите LMS-цикл через «Подключить LMS-цикл».
        </div>
      </div>
    );
  }

  const wm = pl.workMax || {};
  const weakPts = pl.weakPoints || [];

  // Сборка недель для визуализации: week1 (anchor) + weeks[1..N] если есть, иначе повтор week1 + делод на 7-й.
  const allWeeks: SRDaySpec[][] = useMemo(() => {
    const out: SRDaySpec[][] = [];
    if (cycle.week1) out.push(cycle.week1);
    if (cycle.weeks && cycle.weeks.length > 0) {
      for (let i = 1; i < cycle.weeks.length; i++) out.push(cycle.weeks[i]);
    } else {
      // Нет explicitWeeks — повтор week1 с поправкой РМ (~+0.5% / нед).
      for (let w = 1; w < cycle.meta.weeks; w++) out.push(cycle.week1);
    }
    return out;
  }, [cycle]);

  return (
    <div style={{ ...CARD, padding: 10, borderLeft: '2px solid rgba(167,139,250,0.3)' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa', marginBottom: 6 }}>🏆 LMS-цикл</div>

      <div style={{ padding: '6px 8px', background: 'rgba(167,139,250,0.06)', borderRadius: 6, marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: DIM_STRONG }}>{cycle.meta.title}</div>
        <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>
          {cycle.meta.sessionsPerWeek} дн/нед · {cycle.meta.weeks} нед · {cycle.meta.level} · {cycle.meta.period}
        </div>
      </div>

      <div style={{ fontSize: 10, fontWeight: 800, color: ACCENT, marginBottom: 4 }}>🎯 Ваши ПМ (для расчёта весов из %)</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
        <WmField label="Присед" value={wm.squat} subHint={wm.squat ? `→ ${calcWeight(0.85, 'squat')}кг @85%` : undefined} />
        <WmField label="Жим" value={wm.bench} subHint={wm.bench ? `→ ${calcWeight(0.85, 'bench')}кг @85%` : undefined} />
        <WmField label="Тяга" value={wm.dead} subHint={wm.dead ? `→ ${calcWeight(0.85, 'dead')}кг @85%` : undefined} />
      </div>

      <div style={{ fontSize: 10, fontWeight: 800, color: ACCENT, marginBottom: 4 }}>⚠ Слабые точки (приоритет акцента)</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        {weakPts.length === 0 ? (
          <div style={{ fontSize: 10, color: DIM }}>Не выбраны.</div>
        ) : (
          weakPts.map((w) => (
            <span key={w} style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(0,230,138,0.18)', border: '1px solid rgba(0,230,138,0.4)', color: '#fff', fontSize: 10 }}>
              {GROUP_RU[w] ?? w}
            </span>
          ))
        )}
      </div>

      <div style={{ fontSize: 10, fontWeight: 800, color: '#a78bfa', marginBottom: 4 }}>📅 Расписание (сессия → день)</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
        {pl.schedule.length > 0 ? (
          pl.schedule.map((s, i) => (
            <div key={i} style={{ fontSize: 10, color: DIM_STRONG, padding: '4px 6px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
              Сессия {s.sessionIdx + 1} → {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][s.dayOfWeek] ?? '?'}
            </div>
          ))
        ) : (
          <div style={{ fontSize: 10, color: DIM }}>Расписание пустое. Укажите дни/нед выше и нажмите ⚡ авто-сборка.</div>
        )}
      </div>

      {/* УПРАЖНЕНИЯ ЦИКЛА ПО НЕДЕЛЯМ — самое важное, что покажет trainer реальные упражнения из LMS. */}
      <div style={{ fontSize: 10, fontWeight: 800, color: '#a78bfa', marginBottom: 4 }}>
        🏋️ Упражнения цикла ({allWeeks.length} нед × {cycle.week1?.length ?? 0} сессий)
      </div>
      <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 2 }}>
        {allWeeks.map((week, wi) => (
          <div key={wi} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 6, borderLeft: '2px solid #a78bfa' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: DIM_STRONG, marginBottom: 4 }}>
              Неделя {wi + 1}{wi === 0 ? ' (anchor)' : ''}{wi > 0 && cycle.meta.correctionPct ? ` · PM × ${(1 + (wi * cycle.meta.correctionPct * 100)).toFixed(1)}%` : ''}
            </div>
            {week.length === 0 && <div style={{ fontSize: 11, color: DIM }}>Дней нет.</div>}
            {week.map((day, di) => (
              <div key={di} style={{ marginBottom: 4, padding: '4px 6px', background: 'rgba(0,0,0,0.25)', borderRadius: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa' }}>День {di + 1}</div>
                {day.exercises.map((ex: { name: string; group: string; sets: Array<{ pct: number; reps: number; sets: number }> }, ei: number) => {
                  const liftMatch = /скам|скват|жим|тяг|прис/i.test((ex.name || '') + ' ' + (ex.group || ''));
                  let lift: 'squat' | 'bench' | 'dead' | null = null;
                  if (liftMatch) {
                    if (/жим/i.test(ex.name + ' ' + (ex.group || ''))) lift = 'bench';
                    else if (/тяг/i.test(ex.name)) lift = 'dead';
                    else lift = 'squat';
                  }
                  const wmVal = lift ? (wm[lift] ?? null) : null;
                  return (
                    <div key={ei} style={{ fontSize: 11, color: DIM_STRONG, padding: '2px 0', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      <span style={{ color: DIM, minWidth: 14 }}>{ei + 1}.</span>
                      <span style={{ flex: 1, fontWeight: 600 }}>{ex.name}</span>
                      <span style={{ fontSize: 11, color: DIM }}>{ex.group}</span>
                      {ex.sets.map((s, si) => (
                        <span key={si} style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(167,139,250,0.15)', color: '#a78bfa', fontSize: 11, fontWeight: 600, minHeight: 24 }}>
                          {s.sets}×{s.reps}@{Math.round(s.pct * 100)}%
                          {wmVal ? `=${Math.round((wmVal * s.pct) / 2.5) * 2.5}кг` : ''}
                        </span>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 8, padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', marginBottom: 4 }}>🔗 Конструкторские инструменты PL</div>
        <div style={{ fontSize: 10, color: DIM, lineHeight: 1.5 }}>
          Изменяйте ПМ и слабые группы → веса на всех сессиях цикла автоматически перерассчитаются из %.
          Заметки к циклу — ваш дневник, отдельно от процентовок LMS.
        </div>
      </div>
    </div>
  );
};

const WmField: React.FC<{ label: string; value: number | undefined; subHint?: string }> = ({ label, value, subHint }) => (
  <div style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, textAlign: 'center' }}>
    <div style={{ fontSize: 11, color: DIM }}>{label}</div>
    <div style={{ fontSize: 14, fontWeight: 800, color: value ? ACCENT : DIM }}>{value ?? '—'}</div>
    {subHint && <div style={{ fontSize: 11, color: DIM, marginTop: 2 }}>{subHint}</div>}
  </div>
);

/** Проверка, что LMS_CYCLES не пустой (lazy-импорт). */
if (!LMS_CYCLES || !Array.isArray(LMS_CYCLES) || LMS_CYCLES.length === 0) {
  // eslint-disable-next-line no-console
  console.warn('[program-editor-context-panels] LMS_CYCLES not loaded — PLContextPanel может не работать.');
}

/** Проверка экспорта getCycleById — graceful fallback если API изменилось. */
const _hasGetCycleById = typeof getCycleById === 'function';
