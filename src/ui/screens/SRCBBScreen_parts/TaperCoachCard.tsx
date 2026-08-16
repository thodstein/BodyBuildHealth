/**
 * TaperCoachCard.tsx — 🧠 ТРЕНЕРСКАЯ КАРТОЧКА тапера/пика ПЛ (вынесена из SRCBBScreen,
 * чтобы не перегружать главный экран): авто-подбор схемы, вердикт готовности к старту,
 * сравнение сценариев «что если…», оценка прикидов из дневника, копирование сводки.
 */
import React from 'react';
import type { LMSBuildOutput } from '../../../engines/lms/lms-builder.engine';
import {
  recommendTaperConfig, coachPLPeakPlan, pmFeasibility, projectPmToMeet,
  compareTaperScenarios, evaluateMeetAttemptsFromDiary, buildTaperCoachPrintHtml,
  type TaperCoachCtx, type TaperConfigRecommendation,
} from '../../../engines/lms/lms-taper-coach.engine';
import { MEET_STRATEGY_PCT_LABEL, type MeetStrategy } from '../../../engines/lms/competition-attempts';

const BTN_GHOST: React.CSSProperties = { padding: '8px 16px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', minHeight: 36 };

export interface TaperCoachCardProps {
  /** Текущий план ПЛ (с тапером или без). */
  builtSrc: LMSBuildOutput | null;
  /** Тапер уже применён к плану (показывать вердикт/сценарии/оценку). */
  hasTaper: boolean;
  /** Строит контекст спортсмена (усталость/ACWR/дневник/вес/ПМ). */
  buildCtx: () => TaperCoachCtx;
  /** Применить рекомендацию (схема/длительность/весовая цель/mock/пост-старт). */
  applyRecommendation: (r: TaperConfigRecommendation) => void;
  /** Текущая стратегия прикидов. */
  attemptStrategy: MeetStrategy;
  /** Сменить стратегию прикидов (из оценки по дневнику). */
  onStrategyChange: (s: MeetStrategy) => void;
  /** Сессии дневника тренировок (WorkoutSession[]) для оценки прикидов. */
  diarySessions: unknown[];
  /** Показать сообщение пользователю. */
  onNote: (msg: string) => void;
}

const copyText = (text: string, done: () => void) => {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch { /* ignore */ }
      document.body.removeChild(ta);
    });
  } else {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch { /* ignore */ }
    document.body.removeChild(ta);
  }
};

export const TaperCoachCard: React.FC<TaperCoachCardProps> = ({ builtSrc, hasTaper, buildCtx, applyRecommendation, attemptStrategy, onStrategyChange, diarySessions, onNote }) => {
  const ctx = buildCtx();
  return (
    <div style={{ padding: 8, borderRadius: 10, background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.18)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa' }}>🧠 Тренерская работа</div>
        <button
          onClick={() => { try { applyRecommendation(recommendTaperConfig(buildCtx())); } catch (error) { onNote(`⚠ Ошибка подбора: ${(error as Error).message}`); } }}
          style={{ ...BTN_GHOST, border: '1px solid rgba(167,139,250,0.4)', color: '#a78bfa', background: 'rgba(139,92,246,0.1)' }}
          title="Автоматически подобрать схему тапера, длительность, весовую цель, mock meet и пост-старт под ваши усталость/ACWR/вес/план ПМ"
        >🤖 Подобрать тапер автоматически</button>
      </div>

      {builtSrc && hasTaper && (() => {
        try {
          const verdict = coachPLPeakPlan(builtSrc, buildCtx());
          const scoreColor = verdict.score >= 85 ? '#22c55e' : verdict.score >= 65 ? '#eab308' : verdict.score >= 40 ? '#f97316' : '#ef4444';
          const feas = pmFeasibility(buildCtx());
          const weeksToMeet = ctx.weeksToMeet ?? 1;
          const projected = builtSrc.weeks[builtSrc.weeks.length - 1]?.pmRow
            ? projectPmToMeet(builtSrc.weeks[builtSrc.weeks.length - 1].pmRow, builtSrc.template?.meta?.correctionPct ?? 0.005, weeksToMeet) : null;
          return (
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: scoreColor }}>{verdict.score}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>{verdict.label}</span>
                {projected && (() => {
                  const sq = projected['Присед'] ?? projected['Приседания со штангой'];
                  if (!sq) return null;
                  return <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>· прогноз к старту: присед ≈ {sq} кг</span>;
                })()}
              </div>
              {verdict.notes.slice(0, 6).map((n, i) => (
                <div key={i} style={{ fontSize: 10, color: n.severity === 'danger' ? '#f87171' : n.severity === 'warn' ? '#fbbf24' : n.severity === 'info' ? '#93c5fd' : 'rgba(255,255,255,0.7)', padding: '2px 0', lineHeight: 1.4 }}>{n.icon} {n.text}</div>
              ))}
              {feas.status !== 'realistic' && feas.lifts.length > 0 && (
                <div style={{ fontSize: 10, color: feas.status === 'unrealistic' ? '#f87171' : '#fbbf24', marginTop: 3 }}>🎯 {feas.summary}</div>
              )}
              <button
                onClick={() => { try { applyRecommendation(verdict.actions ?? recommendTaperConfig(buildCtx())); } catch (error) { onNote(`⚠ Ошибка: ${(error as Error).message}`); } }}
                style={{ ...BTN_GHOST, marginTop: 6, border: '1px solid rgba(0,230,138,0.3)', color: '#00e68a', background: 'rgba(0,230,138,0.06)' }}
                title="Применить рекомендуемые настройки тапера (схема/длительность/весовая цель/mock/пост-старт) — затем нажмите «📉 Добавить тапер к плану»"
              >✅ Применить рекомендации тренера</button>
              <button
                onClick={() => {
                  try {
                    const lines = [
                      `🧠 Тренерский вердикт: ${verdict.score}/100 — ${verdict.label}`,
                      ...verdict.notes.map(n => `${n.icon} ${n.text}`),
                      feas.summary && feas.lifts.length > 0 ? `🎯 ${feas.summary}` : '',
                      projected && projected['Присед'] ? `🔮 Прогноз к старту: присед ≈ ${projected['Присед']} кг` : '',
                    ].filter(Boolean);
                    copyText(lines.join('\n'), () => onNote('📋 Вердикт тренера скопирован в буфер'));
                  } catch (error) { onNote(`⚠ Не удалось скопировать: ${(error as Error).message}`); }
                }}
                style={{ ...BTN_GHOST, marginTop: 6, marginLeft: 6, border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.03)' }}
                title="Скопировать полную сводку вердикта тренера (score, заметки, достижимость ПМ, прогноз)"
              >📋 Копировать вердикт</button>
              <button
                onClick={() => {
                  try {
                    const w = window.open('', '_blank', 'width=900,height=700');
                    if (w) { w.document.write(buildTaperCoachPrintHtml(verdict, buildCtx())); w.document.close(); w.print(); }
                    else onNote('⚠ Браузер заблокировал всплывающее окно — разрешите попапы для печати.');
                  } catch (error) { onNote(`⚠ Не удалось открыть печать: ${(error as Error).message}`); }
                }}
                style={{ ...BTN_GHOST, marginTop: 6, marginLeft: 6, border: '1px solid rgba(96,165,250,0.4)', color: '#93c5fd', background: 'rgba(96,165,250,0.08)' }}
                title="Печать полной тренерской сводки (score, заметки, достижимость ПМ, сценарии) — PDF через диалог печати"
              >🖨 Печать сводки (PDF)</button>

              {/* 🔀 Сравнение сценариев тапера */}
              <div style={{ marginTop: 8, padding: 6, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#a78bfa', marginBottom: 4 }}>🔀 Сравнение сценариев («что если…»)</div>
                {(() => {
                  const cmp = compareTaperScenarios(buildCtx());
                  return (
                    <>
                      {cmp.results.slice(0, 5).map((r) => (
                        <div key={r.scenario.id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 10, padding: '2px 0' }}>
                          <span style={{ minWidth: 26, fontWeight: 800, color: r.scenario.id === cmp.best.scenario.id ? '#00e68a' : 'rgba(255,255,255,0.5)' }}>{r.score}</span>
                          <span style={{ flex: 1, color: 'rgba(255,255,255,0.8)' }}>{r.summary}</span>
                          {r.scenario.id === cmp.best.scenario.id && <span style={{ fontSize: 9, color: '#00e68a', fontWeight: 700 }}>лучший</span>}
                        </div>
                      ))}
                      <button
                        onClick={() => { applyRecommendation({ mode: cmp.best.scenario.mode, taperWeeks: cmp.best.scenario.taperWeeks, weightGoal: 'auto', mockMeet: true, postMeet: true, strategy: attemptStrategy, rationale: [`🔀 Лучший сценарий: ${cmp.best.summary}`] }); }}
                        style={{ ...BTN_GHOST, marginTop: 4, border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa', background: 'rgba(139,92,246,0.08)' }}
                        title="Применить лучший сценарий (схема + длительность) — затем «📉 Добавить тапер к плану»"
                      >🎯 Применить лучший сценарий</button>
                    </>
                  );
                })()}
              </div>

              {/* 🩺 Оценка прикидов из дневника */}
              {(() => {
                const attempts = [...builtSrc.weeks].reverse().find(w => w.meetAttempts)?.meetAttempts;
                if (!attempts) return null;
                const evalRes = evaluateMeetAttemptsFromDiary(attempts, diarySessions as never);
                if (!evalRes) return null;
                return (
                  <div style={{ marginTop: 6, padding: 6, borderRadius: 8, background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.14)' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#93c5fd', marginBottom: 2 }}>🩺 Оценка прикидов по дневнику</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{evalRes.summary}</div>
                    {evalRes.nextStrategy !== attemptStrategy && (
                      <button
                        onClick={() => { onStrategyChange(evalRes.nextStrategy); onNote(`🏁 Стратегия прикидов обновлена по факту дневника: ${MEET_STRATEGY_PCT_LABEL[evalRes.nextStrategy]} — нажмите «🔄 Обновить прикиды».`); }}
                        style={{ ...BTN_GHOST, marginTop: 4, border: '1px solid rgba(96,165,250,0.4)', color: '#93c5fd', background: 'rgba(96,165,250,0.08)' }}
                      >📌 Применить стратегию «{MEET_STRATEGY_PCT_LABEL[evalRes.nextStrategy]}»</button>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        } catch { return null; }
      })()}
    </div>
  );
};

export default TaperCoachCard;
