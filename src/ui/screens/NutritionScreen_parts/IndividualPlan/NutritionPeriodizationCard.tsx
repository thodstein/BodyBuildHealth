/**
 * NutritionPeriodizationCard.tsx — карточка «🍽 Периодизация питания» (PRO).
 *
 * Показывает ВЕСЬ горизонт питания вперёд: неделю за неделей (фазы контест-препа
 * → taper → peak → post-show, либо цель + карб-периодизация) и день за днём
 * (тренировка/отдых, тяжёлый день, рефид, diet-break) с фактическими целями
 * КБЖУ/воды/натрия/калия. Источник — единый чистый движок
 * `planner-nutrition-periodization.engine` (показанное = сгенерированному дню).
 *
 * Только подача: печать, горизонт, раскрытие недель. Логики расчёта здесь нет.
 */

import React, { useMemo, useState } from 'react';
import { GlassCard } from './ui';
import type { GoalId, CarbPeriodization } from './types';
import type { BBContestPrepPlan } from '../../../../engines/bb/bb-contest-prep.engine';
import {
  buildNutritionPeriodization,
  prepPeriodizationHorizon,
  PERIODIZATION_GOAL_RU,
  type PeriodizationBase,
  type PeriodizationDay,
  type PeriodizationWeek,
} from './planner-nutrition-periodization.engine';

interface Props {
  prepPlan: BBContestPrepPlan | null;
  base: PeriodizationBase;
  goal: GoalId;
  carbPeriodization: CarbPeriodization;
  isTrainingDayForOffset: (offset: number) => boolean;
  heavyTrainDay?: string | null;
  dayLabels?: string[];
  postShowTrack?: 'recovery' | 'reverse';
  todayIso: string;
  specialMeals?: { date: string; type: 'refeed' | 'cheat_meal' | 'fast' }[];
  weightLog?: { date: string; weightKg: number }[];
  /** Deep-link: клик по дню периода → открыть этот день в плане (если он сгенерирован). */
  onOpenDay?: (date: string) => void;
}

const PREP_ACCENT = '#f59e0b';
const GENERAL_ACCENT = '#00e68a';

const escHtml = (s: string): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const chipStyle = (color: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '3px 8px', borderRadius: 999, fontSize: 9.5, fontWeight: 800,
  background: `${color}18`, border: `1px solid ${color}44`, color: '#fff',
});

const th: React.CSSProperties = {
  padding: '6px 4px', fontSize: 9, fontWeight: 800, color: '#fff',
  textAlign: 'right', whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  padding: '6px 4px', fontSize: 10, color: '#fff', textAlign: 'right',
  fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
};

const WeekMarkers: React.FC<{ w: PeriodizationWeek }> = ({ w }) => (
  <span style={{ display: 'inline-flex', gap: 3, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
    {w.heavyDays > 0 && <span title="Тяжёлые дни" style={chipStyle('#60a5fa')}>🏋️{w.heavyDays}</span>}
    {w.refeedDays > 0 && <span title="Рефид" style={chipStyle('#a855f7')}>🔄{w.refeedDays}</span>}
    {w.dietBreakDays > 0 && <span title="Diet-break" style={chipStyle('#22c55e')}>🏖{w.dietBreakDays}</span>}
    {w.peakWeek && <span title="Пик-неделя" style={chipStyle('#f472b6')}>🎭</span>}
  </span>
);

const DayMarkers: React.FC<{ d: PeriodizationDay }> = ({ d }) => (
  <span style={{ display: 'inline-flex', gap: 3 }}>
    {d.isHeavy && <span title="Тяжёлый день" style={chipStyle('#60a5fa')}>🏋️</span>}
    {d.isRefeed && <span title="Рефид" style={chipStyle('#a855f7')}>🔄</span>}
    {d.isCheat && <span title="Читмил" style={chipStyle('#fb923c')}>🍔</span>}
    {d.isFast && <span title="Фастинг" style={chipStyle('#94a3b8')}>⏳</span>}
    {d.isDietBreak && <span title="Diet-break" style={chipStyle('#22c55e')}>🏖</span>}
    {d.isPeakWeek && <span title="Пик-неделя" style={chipStyle('#f472b6')}>🎭</span>}
    {d.isPostShow && <span title="Post-show" style={chipStyle('#eab308')}>🔄</span>}
  </span>
);

export const NutritionPeriodizationCard: React.FC<Props> = ({
  prepPlan, base, goal, carbPeriodization, isTrainingDayForOffset,
  heavyTrainDay, dayLabels, postShowTrack, todayIso, specialMeals, weightLog, onOpenDay,
}) => {
  const mode: 'prep' | 'general' = prepPlan ? 'prep' : 'general';
  const accent = mode === 'prep' ? PREP_ACCENT : GENERAL_ACCENT;
  const prepHorizon = useMemo(() => prepPeriodizationHorizon(prepPlan), [prepPlan]);
  const [horizon, setHorizon] = useState<number>(mode === 'prep' ? prepHorizon : 4);
  const [openWeek, setOpenWeek] = useState<number | null>(1);

  // При смене препа — пересобрать горизонт (новый showDate/prepWeeks).
  const horizonEff = mode === 'prep' && horizon > prepHorizon ? prepHorizon : horizon;

  // Стабильный ключ мемоизации: объект base и колбэк тренировок создаются заново
  // каждый рендер родителя, поэтому мемоизируем по ЗНАЧЕНИЯМ (иначе пересчёт на
  // каждый рендер). trainSig сэмплирует график на 14 дней (weekly/EOD/pattern).
  const baseKey = `${base.kcal}|${base.proteinG}|${base.fatG}|${base.carbsG}|${base.waterMl}|${base.sodiumMg}`;
  const trainSig = useMemo(
    () => Array.from({ length: 14 }, (_, i) => (isTrainingDayForOffset(i) ? '1' : '0')).join(''),
    [isTrainingDayForOffset],
  );
  const startDate = mode === 'prep' && prepPlan ? prepPlan.preparation.startDate : todayIso;
  const specialKey = useMemo(
    () => (specialMeals || []).map(s => `${s.date}:${s.type}`).sort().join(','),
    [specialMeals],
  );
  const weightSig = useMemo(
    () => (weightLog || []).map(w => `${w.date}:${w.weightKg}`).sort().join(','),
    [weightLog],
  );
  const sig = `${mode}|${startDate}|${horizonEff}|${baseKey}|${goal}|${carbPeriodization}|${trainSig}|${heavyTrainDay || ''}|${postShowTrack || ''}|${prepPlan?.id || ''}|${prepPlan?.updatedAt || ''}|${specialKey}|${weightSig}`;

  const periodization = useMemo(() => buildNutritionPeriodization({
    startDate,
    horizonWeeks: horizonEff,
    prepPlan,
    base,
    goal,
    carbPeriodization,
    isTrainingDayForOffset,
    heavyTrainDay,
    dayLabels,
    postShowTrack,
    specialMeals,
    weightLog,
  }), [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  const horizonOptions = useMemo(() => {
    const opts = [1, 4, 8, 12].filter(w => w <= prepHorizon || mode === 'general');
    const uniq = Array.from(new Set(opts));
    return uniq;
  }, [prepHorizon, mode]);

  const printReport = () => {
    try {
      const p = periodization;
      const rows = p.days.map(d => `<tr>
        <td>${escHtml(d.date)}</td><td>${escHtml(d.weekday)}</td>
        <td>${escHtml(d.phaseLabel)}</td>
        <td>${d.isTraining ? 'тренировка' : 'отдых'}${d.isHeavy ? ' · тяжёлый' : ''}</td>
        <td style="text-align:right">${d.kcal}</td>
        <td style="text-align:right">${d.proteinG}/${d.fatG}/${d.carbsG}</td>
        <td style="text-align:right">${(() => { const wk = p.weeks.find(x => x.weekIndex === Math.floor(d.offset / 7) + 1); if (!wk) return '—'; const t = wk.targetWeightKg; const a = wk.actualWeightKg; return (t != null ? '🎯' + t : '') + (a != null ? (t != null ? ' / ' : '') + '⚖️' + a : '') || '—'; })()}</td>
        <td style="text-align:right">${(d.waterMl / 1000).toFixed(1)} л</td>
        <td style="text-align:right">${d.sodiumMg} мг</td>
        <td>${[d.isRefeed ? 'рефид' : '', d.isDietBreak ? 'diet-break' : '', d.isPeakWeek ? 'пик' : '', d.isPostShow ? 'post-show' : ''].filter(Boolean).join(', ')}</td>
      </tr>`).join('');
      const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Периодизация питания</title>
      <style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding:18px;color:#111}
      h1{font-size:20px;margin:0 0 4px} .sub{color:#444;font-size:12px;margin-bottom:12px}
      table{border-collapse:collapse;width:100%;font-size:11px} th,td{border:1px solid #ccc;padding:4px 6px}
      th{background:#f2f2f2;text-align:left} @page{margin:12mm}</style></head><body>
      <h1>🍽 Периодизация питания</h1>
      <div class="sub">${mode === 'prep' ? '🏁 Контест-преп' : '🎯 ' + escHtml(PERIODIZATION_GOAL_RU[goal] || '')} · старт ${escHtml(p.startDate)}${p.showDate ? ' · шоу ' + escHtml(p.showDate) : ''} · углеводы: ${escHtml(p.carbLabel)}</div>
      <table><thead><tr><th>Дата</th><th>День</th><th>Фаза</th><th>Тип</th><th>Ккал</th><th>Б/Ж/У</th><th>Вес</th><th>Вода</th><th>Na</th><th>Метки</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <p style="font-size:11px;color:#444;margin-top:12px">${p.notes.map(escHtml).join('<br>')}</p>
      </body></html>`;
      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); setTimeout(() => { try { w.print(); } catch {} }, 250); }
    } catch { /* печать недоступна */ }
  };

  return (
    <GlassCard title="Периодизация питания" icon="🍽" color={accent}>
      <div data-periodization="1" data-mode={mode} data-horizon={horizonEff}>
        {/* Шапка: режим + углеводы */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          <span style={chipStyle(accent)}>{mode === 'prep' ? '🏁 Контест-преп' : `🎯 ${PERIODIZATION_GOAL_RU[goal] || 'Цель'}`}</span>
          <span style={chipStyle('#f97316')}>🍚 {periodization.carbLabel}</span>
          {mode === 'prep' && periodization.showDate && <span style={chipStyle('#f472b6')}>🎭 шоу {periodization.showDate}</span>}
        </div>

        {/* Сводка */}
        <div data-periodization-summary style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          <span style={chipStyle('#60a5fa')}>🏋️ {periodization.summary.trainingDays} трен.</span>
          {periodization.summary.prepWeeks > 0 && <span style={chipStyle('#f59e0b')}>📉 подготовка {periodization.summary.prepWeeks} нед</span>}
          {periodization.summary.taperWeeks > 0 && <span style={chipStyle('#8b5cf6')}>📉 taper {periodization.summary.taperWeeks} нед</span>}
          {periodization.summary.refeedDays > 0 && <span style={chipStyle('#a855f7')}>🔄 {periodization.summary.refeedDays} рефид</span>}
          {periodization.summary.dietBreakDays > 0 && <span style={chipStyle('#22c55e')}>🏖 {periodization.summary.dietBreakDays} break</span>}
          {periodization.summary.peakWeekDays > 0 && <span style={chipStyle('#f472b6')}>🎭 {periodization.summary.peakWeekDays} пик</span>}
        </div>

        {/* Горизонт */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {horizonOptions.map(w => (
            <button key={w} data-horizon-btn={w} onClick={() => { setHorizon(w); setOpenWeek(1); }}
              style={{
                minHeight: 44, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 11, fontWeight: 800,
                background: horizonEff === w ? `${accent}22` : 'rgba(255,255,255,0.06)',
                border: horizonEff === w ? `1px solid ${accent}` : '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
              }}>{w} нед</button>
          ))}
          {mode === 'prep' && (
            <button data-horizon-btn="prep" onClick={() => { setHorizon(prepHorizon); setOpenWeek(1); }}
              style={{
                minHeight: 44, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 11, fontWeight: 800,
                background: horizonEff === prepHorizon ? `${accent}22` : 'rgba(255,255,255,0.06)',
                border: horizonEff === prepHorizon ? `1px solid ${accent}` : '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
              }}>🏁 Весь преп</button>
          )}
          <button data-periodization-print onClick={printReport}
            style={{
              minHeight: 44, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 11, fontWeight: 800,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', marginLeft: 'auto',
            }}>🖨 Печать</button>
        </div>

        {/* Таблица недель */}
        <div style={{ overflowX: 'auto' }}>
          <table data-periodization-weeks style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left' }}>Нед</th>
                <th style={{ ...th, textAlign: 'left' }}>Фаза</th>
                <th style={th}>Ккал</th>
                <th style={th}>Б/Ж/У</th>
                <th style={th}>Вес</th>
                <th style={th}>Вода</th>
                <th style={th}>Na</th>
                <th style={th}>Метки</th>
              </tr>
            </thead>
            <tbody>
              {periodization.weeks.map(w => {
                const open = openWeek === w.weekIndex;
                return (
                  <React.Fragment key={w.weekIndex}>
                    <tr data-week={w.weekIndex} data-open={open} onClick={() => setOpenWeek(open ? null : w.weekIndex)}
                      style={{ cursor: 'pointer', background: open ? 'rgba(255,255,255,0.04)' : 'transparent', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <td style={{ ...td, textAlign: 'left', fontWeight: 800 }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 3, background: w.phaseColor, marginRight: 6 }} />
                        {w.weekIndex}
                      </td>
                      <td style={{ ...td, textAlign: 'left' }}>{w.phaseLabel || '—'}</td>
                      <td style={td}>{w.avgKcal}</td>
                      <td style={td}>{w.avgProteinG}/{w.avgFatG}/{w.avgCarbsG}</td>
                      <td style={td}>
                        {w.targetWeightKg != null ? `🎯${w.targetWeightKg}` : ''}
                        {w.actualWeightKg != null ? `${w.targetWeightKg != null ? ' / ' : ''}⚖️${w.actualWeightKg}` : ''}
                        {w.weightDeltaKg != null && w.weightDeltaKg !== 0
                          ? <span style={{ color: w.weightDeltaKg > 0 ? '#f59e0b' : '#22c55e', fontWeight: 800 }}>{` ${w.weightDeltaKg > 0 ? '+' : ''}${w.weightDeltaKg}`}</span>
                          : null}
                        {(w.targetWeightKg == null && w.actualWeightKg == null) ? '—' : ''}
                      </td>
                      <td style={td}>{(w.waterMl / 1000).toFixed(1)} л</td>
                      <td style={td}>{w.sodiumMg}</td>
                      <td style={td}><WeekMarkers w={w} /></td>
                    </tr>
                    {open && periodization.days.slice((w.weekIndex - 1) * 7, w.weekIndex * 7).map(d => (
                      <tr key={d.date} data-day={d.date} onClick={onOpenDay ? () => onOpenDay(d.date) : undefined}
                        style={{ background: 'rgba(255,255,255,0.02)', cursor: onOpenDay ? 'pointer' : 'default' }}>
                        <td style={{ ...td, textAlign: 'left', fontWeight: 700, paddingLeft: 14 }}>{onOpenDay ? '▸ ' : ''}{d.weekday} {d.date.slice(8)}</td>
                        <td style={{ ...td, textAlign: 'left' }}>{d.isTraining ? '🏋️' : '🛌'}{d.isHeavy ? ' тяж' : ''}</td>
                        <td style={td}>{d.kcal}</td>
                        <td style={td}>{d.proteinG}/{d.fatG}/{d.carbsG}</td>
                        <td style={td}>{(d.waterMl / 1000).toFixed(1)} л</td>
                        <td style={td}>{d.sodiumMg}</td>
                        <td style={td}><DayMarkers d={d} /></td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Заметки */}
        <div data-periodization-notes style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {periodization.notes.map((n, i) => (
            <div key={i} style={{ fontSize: 10.5, lineHeight: 1.45, color: '#fff' }}>{n}</div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
};
