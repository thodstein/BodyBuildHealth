/**
 * ContestPeakWeekCard.tsx — единый рендер 7-дневного протокола пик-недели ББ.
 *
 * Э0.3: один компонент вместо 4 дублирующих рендеров (BbAuto шаг «contest»,
 * PeakWeekTab, PeakingPanel; MacrocyclePanel оставляет компактную строку).
 * Принимает готовый BBContestPrepResult движка, ничего не пересчитывает.
 */
import React from 'react';
import {
  PHASE_LABELS_RU, PEAK_PHASE_COLORS,
  type BBContestPrepResult, type PeakDayPhase,
} from '../../../engines/bb/bb-contest-prep.engine';

export interface ContestPeakWeekCardProps {
  result: BBContestPrepResult;
  /** Заголовок карточки. По умолчанию «🎭 Пик-неделя (тапер ББ)». */
  title?: string;
  /** Только таблица без внешней обёртки (для CalcSection и др.). */
  bare?: boolean;
  showCompetitions?: boolean;
  showRationale?: boolean;
  showWarnings?: boolean;
  showPotassiumNote?: boolean;
  showPhaseLegend?: boolean;
  /** Поз-колонка (мин/день). По умолчанию видна. */
  showPosing?: boolean;
  /** Строка стратегий (карбс/вода/Na/вес). По умолчанию видна. */
  showStrategyLine?: boolean;
}

const LEGEND: Array<[PeakDayPhase, string]> = [
  ['deplete_1', 'Деплеция'],
  ['load_1', 'Загрузка'],
  ['peak', 'Пик'],
  ['show', 'Шоу'],
];

export const ContestPeakWeekCard: React.FC<ContestPeakWeekCardProps> = ({
  result,
  title,
  bare = false,
  showCompetitions = true,
  showRationale = true,
  showWarnings = true,
  showPotassiumNote = true,
  showPhaseLegend = true,
  showPosing = true,
  showStrategyLine = true,
}) => {
  const body = (
    <>
      {showStrategyLine && (
        <div style={{ fontSize: 10, color: '#fff', marginBottom: 6 }}>
          {result.config.carbLoadStrategy} загрузка · вода {result.config.waterStrategy} · Na {result.config.sodiumStrategy} · {result.config.weightKg} кг
        </div>
      )}
      {showCompetitions && result.competitions.length > 0 && (
        <div style={{ marginBottom: 6, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {result.competitions.map(c => {
            const isMain = result.mainCompetition?.id === c.id;
            return (
              <span key={c.id} style={{
                padding: '2px 8px', borderRadius: 999, fontSize: 9, fontWeight: isMain ? 800 : 600,
                background: isMain ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.05)',
                border: isMain ? '1px solid rgba(251,191,36,0.5)' : '1px solid rgba(255,255,255,0.12)',
                color: isMain ? '#fbbf24' : '#fff',
              }}>
                {isMain ? '★ ' : ''}{c.name}{c.priority ? ` [${c.priority}]` : ''}
              </span>
            );
          })}
        </div>
      )}
      {showPhaseLegend && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {LEGEND.map(([ph, label]) => (
            <span key={ph} style={{ padding: '2px 8px', borderRadius: 999, fontSize: 9, fontWeight: 700, background: PEAK_PHASE_COLORS[ph] + '18', color: PEAK_PHASE_COLORS[ph], border: `1px solid ${PEAK_PHASE_COLORS[ph]}40` }}>
              ● {label}
            </span>
          ))}
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse', minWidth: 480 }}>
          <thead>
            <tr style={{ color: '#fff', textAlign: 'left' }}>
              <th style={{ padding: '4px 6px' }}>День</th>
              <th style={{ padding: '4px 6px' }}>Фаза</th>
              <th style={{ padding: '4px 6px', textAlign: 'right' }}>Ккал</th>
              <th style={{ padding: '4px 6px', textAlign: 'right' }}>Б/У/Ж</th>
              <th style={{ padding: '4px 6px' }}>💧 Вода</th>
              <th style={{ padding: '4px 6px', textAlign: 'right' }}>Na мг</th>
              <th style={{ padding: '4px 6px', textAlign: 'right' }}>Клетч.</th>
              <th style={{ padding: '4px 6px' }}>🏋️ Трен.</th>
              {showPosing && <th style={{ padding: '4px 6px' }}>🎭 Позы</th>}
            </tr>
          </thead>
          <tbody>
            {result.peakWeek.map(d => {
              const phColor = PEAK_PHASE_COLORS[d.phase];
              return (
                <tr key={d.day} style={{
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                  borderLeft: `3px solid ${phColor}`,
                  background: d.day === 7 ? 'linear-gradient(90deg, rgba(251,191,36,0.12), rgba(251,191,36,0.03))' : undefined,
                }}>
                  <td style={{ padding: '4px 6px', fontWeight: 700, color: d.day === 7 ? '#fbbf24' : '#fff' }}>
                    {d.day === 7 ? '🎬 Show' : `Д${d.day}`}
                    <div style={{ fontSize: 8, fontWeight: 400, color: 'rgba(255,255,255,0.55)' }}>{d.date.slice(5).replace('-', '.')}</div>
                  </td>
                  <td style={{ padding: '4px 6px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 8, fontWeight: 700, background: phColor + '18', color: phColor, border: `1px solid ${phColor}40` }}>
                      {PHASE_LABELS_RU[d.phase]}
                    </span>
                  </td>
                  <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 700 }}>{d.kcal}</td>
                  <td style={{ padding: '4px 6px', textAlign: 'right' }}>{d.proteinG}/{d.carbsG}/{d.fatG}</td>
                  <td style={{ padding: '4px 6px' }}>{d.waterLiters}л</td>
                  <td style={{ padding: '4px 6px', textAlign: 'right' }}>{d.sodiumMg}</td>
                  <td style={{ padding: '4px 6px', textAlign: 'right' }}>≤{d.fiberMaxG}г</td>
                  <td style={{ padding: '4px 6px' }}>{d.training.minutes > 0 ? `${d.training.minutes}'` : '—'}</td>
                  {showPosing && <td style={{ padding: '4px 6px' }}>{d.posingMinutes}'</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showRationale && result.rationale.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#fff' }}>
          {result.rationale.map((r, i) => <div key={i}>{r}</div>)}
        </div>
      )}
      {showPotassiumNote && result.peakWeek[0] && (
        <div style={{ marginTop: 4, fontSize: 9, color: '#fff' }}>
          K {result.peakWeek[0].potassiumMg} мг — не снижать всю неделю. Белок {result.peakWeek[0].proteinG} г — постоянный.
        </div>
      )}
      {showWarnings && result.warnings.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {result.warnings.map((w, i) => (
            <div key={i} style={{ fontSize: 10, color: '#f87171', marginTop: 2 }}>{w}</div>
          ))}
        </div>
      )}
    </>
  );
  if (bare) return <>{body}</>;
  return (
    <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.15)' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#ec4899', marginBottom: 8 }}>
        {title ?? '🎭 Пик-неделя (тапер ББ)'} · шоу {result.config.showDate}
      </div>
      {body}
    </div>
  );
};

export default ContestPeakWeekCard;
