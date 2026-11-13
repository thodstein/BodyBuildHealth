import React from 'react';
import type { PlanResult } from '../../../engines/support-plan';
import { computeWeekScale } from '../../../engines/support-plan/substances';
import { SUB_NAMES } from '../../../engines/support-plan/engine-helpers';
import { formatDose } from '../../../data/dose-units';

const ACCENT = '#00e68a';

const TIME_LABELS: Record<string, string> = {
  morning: 'Утро (с завтраком)',
  afternoon: 'День (с обедом)',
  evening: 'Вечер (за 1-2 ч до сна)',
};

const TIME_ICONS: Record<string, string> = {
  morning: '🌅',
  afternoon: '☀️',
  evening: '🌙',
};

export interface WeeklyPlanViewProps {
  planResult: PlanResult;
  courseWeek: number;
}

export const WeeklyPlanView: React.FC<WeeklyPlanViewProps> = ({ planResult, courseWeek }) => {
  const currentWeek = courseWeek || 1;
  const totalWeeks = Math.max(currentWeek, 12);

  const weeks = Array.from({ length: totalWeeks }, (_, i) => i + 1);

  return (
    <div className="sup-weekplan" style={{ padding: '0' }}>
      {/* Week Timeline Bar */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
          📅 План по неделям (титрация доз)
        </div>
        <div style={{ display: 'flex', gap: 2, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
          {weeks.map(w => {
            const scale = computeWeekScale(w);
            const isCurrent = w === currentWeek;
            const color = scale < 0.6 ? '#f59e0b' : scale < 0.8 ? '#eab308' : scale < 1.0 ? '#22c55e' : ACCENT;
            return (
              <div
                key={w}
                style={{
                  flex: '0 0 auto',
                  textAlign: 'center',
                  padding: '2px 4px',
                  borderRadius: 4,
                  background: isCurrent ? 'rgba(0,230,138,0.12)' : 'transparent',
                  border: isCurrent ? '1px solid ' + ACCENT : '1px solid transparent',
                  minWidth: 28,
                }}
              >
                <div style={{ fontSize: 7, fontWeight: 700, color: isCurrent ? ACCENT : 'rgba(255,255,255,0.5)' }}>
                  {w}
                </div>
                <div style={{
                  height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', marginTop: 1, overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', width: (scale * 100) + '%', borderRadius: 2,
                    background: color, transition: 'width 0.3s',
                  }} />
                </div>
                <div style={{ fontSize: 5, color, fontWeight: 600 }}>
                  ×{scale.toFixed(1)}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 3, fontSize: 6, color: 'rgba(255,255,255,0.3)' }}>
          <span>🟡 Адаптация</span>
          <span>🟢 Основной</span>
          <span style={{ color: ACCENT }}>Текущая нед.</span>
        </div>
      </div>

      {/* Weekly dosage info */}
      <div style={{
        padding: '8px 10px', borderRadius: 8, marginBottom: 10,
        background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.12)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: ACCENT }}>
            Нед. {currentWeek}
          </span>
          <span style={{
            fontSize: 8, fontWeight: 700,
            color: computeWeekScale(currentWeek) < 1.0 ? '#f59e0b' : ACCENT,
            padding: '2px 8px', borderRadius: 6,
            background: computeWeekScale(currentWeek) < 1.0 ? 'rgba(245,158,11,0.1)' : 'rgba(0,230,138,0.1)',
          }}>
            {computeWeekScale(currentWeek) < 1.0
              ? 'Адаптация: ввод в курс'
              : 'Полные дозы'}
          </span>
        </div>
        {computeWeekScale(currentWeek) < 1.0 && (
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', lineHeight: 1.3 }}>
            Ввод в курс: дозы наращиваются по неделям (титрация). Расписание ниже показывает
            ЦЕЛЕВЫЕ дозы плана — их же видно в карточках веществ.
          </div>
        )}
      </div>

      {/* Schedule — 3 time blocks */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
          ⏰ Расписание приёма
        </div>
        {['morning', 'afternoon', 'evening'].map(block => {
          const timeData = planResult.schedule.find(s => s.timeBlock === block);
          const substances = timeData?.substances || [];
          if (substances.length === 0) return null;
          return (
            <div
              key={block}
              style={{
                padding: '8px', borderRadius: 8, marginBottom: 5,
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <div style={{ fontSize: 9, fontWeight: 700, color: '#fff', marginBottom: 3 }}>
                {TIME_ICONS[block]} {TIME_LABELS[block]}
                <span style={{ marginLeft: 6, fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>
                  {substances.length} преп.
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {substances.map(s => {
                  const scaledDose = `${s.dose}`;
                  return (
                    <span
                      key={s.id}
                      style={{
                        padding: '2px 7px', borderRadius: 5,
                        background: block === 'morning' ? 'rgba(251,191,36,0.08)' : block === 'afternoon' ? 'rgba(59,130,246,0.08)' : 'rgba(139,92,246,0.08)',
                        border: '1px solid ' + (block === 'morning' ? 'rgba(251,191,36,0.2)' : block === 'afternoon' ? 'rgba(59,130,246,0.2)' : 'rgba(139,92,246,0.2)'),
                        fontSize: 7, color: 'rgba(255,255,255,0.8)', fontWeight: 600,
                      }}
                    >
                      {s.name}
                      <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 3 }}>
                        {scaledDose}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* UL по ФАКТИЧЕСКИМ дозам плана (а не по типовой дозе каталога) */}
      {planResult.ulWarnings && planResult.ulWarnings.length > 0 && (
        <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.18)' }}>
          <div style={{ fontSize: 7, color: '#f59e0b', fontWeight: 700, marginBottom: 3 }}>
            ⚠ Пределы доз (UL) по фактическим дозам плана ({planResult.ulWarnings.length})
          </div>
          {planResult.ulWarnings.map((w, i) => {
            const name = planResult.substances.find(s => s.id === w.substanceId)?.name
              || SUB_NAMES[w.substanceId] || w.substanceId;
            const applied = w.appliedDoseMg && w.appliedDoseMg > 0 ? w.appliedDoseMg : null;
            // SafeLevel (железо) — не UL: подписывать его «UL» значит пугать
            // порогом токсичности, которого регулятор не устанавливал.
            const limitLabel = w.limitKind === 'SafeLevel' ? 'safe level' : 'UL';
            return (
              <div key={`${w.substanceId}-${i}`} style={{ fontSize: 6.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.45 }}>
                <span style={{ color: '#fbbf24', fontWeight: 700 }}>{name}</span>: расчёт {formatDose(w.substanceId, w.currentDoseMg)}
                {applied !== null && applied < w.currentDoseMg
                  ? <> → ограничено до <span style={{ color: '#fbbf24', fontWeight: 700 }}>{formatDose(w.substanceId, applied)}</span></>
                  : null}
                {' '}· {limitLabel} {formatDose(w.substanceId, w.ulMg)} ({w.percentUL}% от {limitLabel}){w.risk ? ` — ${w.risk}` : ''}
              </div>
            );
          })}
          <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>
            Проверены дозы, которые план реально назначает. Вещества, которые титруются движком
            (магний, цинк, D3, селен, витамин C), капаются до предела; для остальных превышение
            показывается как предупреждение — дозу в плане не меняем.
          </div>
        </div>
      )}

      {/* Per-mechanism coverage summary */}
      {(() => {
        const mechs = planResult.mechanisms || [];
        if (mechs.length === 0) return null;
        const covered = mechs.filter(m => m.covered !== false);
        const uncovered = (planResult.uncoveredMechanisms || []).slice().sort((a, b) => b.risk - a.risk);
        const percent = mechs.length > 0 ? Math.round((covered.length / mechs.length) * 100) : 0;
        const shown = uncovered.slice(0, 8);
        return (
          <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 6, background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.1)' }}>
            <div style={{ fontSize: 7, color: '#60a5fa', fontWeight: 700, marginBottom: 3 }}>
              🎯 Закрыто {covered.length} из {mechs.length} механизмов риска ({percent}%)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {covered.map((m, i) => (
                <span key={`${m.mechKey}-${i}`} title={`${m.systemLabel}${m.confidence ? ` · док. ${m.confidence}` : ''}`} style={{
                  padding: '1px 4px', borderRadius: 3,
                  background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)',
                  fontSize: 6, color: '#60a5fa',
                }}>
                  {m.mechLabel}
                </span>
              ))}
            </div>
            {uncovered.length > 0 && (
              <>
                <div style={{ fontSize: 7, color: '#fbbf24', fontWeight: 700, margin: '6px 0 3px' }}>
                  ⚠ Не закрыто ({uncovered.length}): поддержка не даёт k этим механизмам
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {shown.map((m, i) => (
                    <span key={`${m.mechKey}-un-${i}`} title={m.systemLabel} style={{
                      padding: '1px 4px', borderRadius: 3,
                      background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)',
                      fontSize: 6, color: '#fbbf24',
                    }}>
                      {m.mechLabel} · {m.risk}
                    </span>
                  ))}
                  {uncovered.length > shown.length && (
                    <span style={{ fontSize: 6, color: 'rgba(255,255,255,0.4)', alignSelf: 'center' }}>
                      +{uncovered.length - shown.length} ещё
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default WeeklyPlanView;
