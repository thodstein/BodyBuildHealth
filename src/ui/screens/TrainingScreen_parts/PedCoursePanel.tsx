/**
 * PedCoursePanel.tsx — единая панель «PED / Курс» для ББ-авто и ПЛ-авто.
 *
 * 1) PedInputPanel — модернизированный ввод: чипы веществ, дозировки с
 *    подсказками, сегментированная интенсивность курса.
 * 2) PedAdaptationCard — структурированный вывод расчёта адаптации
 *    (вместо сплошного текста explainPEDAdaptation): сводные плитки
 *    MRV/восстановление/углеводы, разбивка по веществам, «как считается»,
 *    блок контроля и рисков.
 */
import React from 'react';
import type { PED, PEDAdaptation, CourseIntensity } from '../../../engines/bb/bb-ped-adaptation.engine';
import { getPedCap } from '../../../engines/bb/bb-ped-adaptation.engine';
import { CARD } from './training-ui';

const ACCENT = '#00e68a';

/** Метаданные веществ для UI (единицы/подсказки/шаг). */
export const PED_META_UI: Record<PED, { label: string; unit: string; hint: string; emoji: string; step: number; max: number; cap: number }> = {
  AAS: { label: 'ААС', unit: 'мг/нед', hint: 'Синтез белка ×2-3, восстановление ↑↑. Каждые +250 мг ≈ +5% MRV', emoji: '💉', step: 50, max: 3000, cap: 3000 },
  insulin: { label: 'Инсулин', unit: 'МЕ/день', hint: 'Суперкомпенсация гликогена. Требует высоких углеводов вокруг тренировки', emoji: '🧪', step: 5, max: 50, cap: 40 },
  MGF: { label: 'MGF', unit: 'мкг/нед', hint: 'Локальная активация сателлитных клеток в тренируемых мышцах', emoji: '🧬', step: 50, max: 500, cap: 400 },
  IGF1: { label: 'IGF-1', unit: 'мкг/день', hint: 'Системный анаболизм, гиперплазия', emoji: '🧬', step: 10, max: 500, cap: 100 },
  GH: { label: 'ГР', unit: 'МЕ/день', hint: 'Ремонт соединительной ткани, липолиз. Синергия с инсулином', emoji: '🌙', step: 1, max: 20, cap: 15 },
};

export const PED_ORDER: PED[] = ['AAS', 'insulin', 'MGF', 'IGF1', 'GH'];

const INTENSITY_UI: Array<{ id: CourseIntensity; label: string; desc: string; emoji: string }> = [
  { id: 'mild', label: 'Лёгкая', desc: 'Базовый MRV', emoji: '🌱' },
  { id: 'moderate', label: 'Умеренная', desc: '+4% MRV', emoji: '⚖️' },
  { id: 'heavy', label: 'Тяжёлая', desc: '+8% MRV', emoji: '🔥' },
];

// ─────────────────────────────────────────────────────────────
// Панель ввода: чипы + дозировки + интенсивность
// ─────────────────────────────────────────────────────────────

export const PedInputPanel: React.FC<{
  peds: PED[];
  onToggle: (p: PED) => void;
  pedDoses: Record<string, number>;
  onDose: (p: PED, v: number) => void;
  courseIntensity: CourseIntensity;
  onIntensity: (v: CourseIntensity) => void;
  /** Доп. элемент в шапке (например, переключатель АВТО в ПЛ-авто). */
  headerExtra?: React.ReactNode;
}> = ({ peds, onToggle, pedDoses, onDose, courseIntensity, onIntensity, headerExtra }) => {
  const active = peds.length > 0;
  return (
    <div className="train-pedinput" style={{ ...CARD, marginBottom: 10, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.14)', padding: 12 }}>
      {/* Шапка */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>💉 PED / Курс</div>
          <div style={{ fontSize: 10, color: '#fff', marginTop: 1, lineHeight: 1.35 }}>
            Адаптация объёмов (MRV) и восстановления под фармакологию{active ? ` · активных: ${peds.length}` : ''}
          </div>
        </div>
        {headerExtra}
      </div>

      {/* Чипы веществ */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {PED_ORDER.map(p => {
          const meta = PED_META_UI[p];
          const on = peds.includes(p);
          return (
            <button
              key={p}
              role="checkbox"
              aria-checked={on}
              onClick={() => onToggle(p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 12, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: on ? '1.5px solid ' + ACCENT : '1px solid rgba(255,255,255,0.08)',
                background: on ? 'rgba(0,230,138,0.16)' : 'rgba(255,255,255,0.02)',
                color: on ? ACCENT : '#fff',
                boxShadow: on ? '0 2px 10px rgba(0,230,138,0.18)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontSize: 13 }}>{meta.emoji}</span>
              <span>{meta.label}</span>
              <span style={{ fontSize: 9, fontWeight: 500, opacity: 0.6 }}>{meta.unit}</span>
              {on && <span style={{ fontSize: 10, color: ACCENT, fontWeight: 900 }}>✓</span>}
            </button>
          );
        })}
      </div>

      {/* Дозировки */}
      {active && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
            Дозировки
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {peds.map(p => {
              const meta = PED_META_UI[p];
              const val = pedDoses[p] || 0;
              return (
                <div key={p} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>
                    {meta.emoji} {meta.label}
                    <span style={{ color: '#fff', fontWeight: 500 }}> · {meta.unit}</span>
                  </label>
                  <input
                    type="number"
                    value={val}
                    min={0}
                    max={meta.max}
                    step={meta.step}
                    onChange={e => {
                      const v = Number(e.target.value);
                      onDose(p, Number.isFinite(v) && v >= 0 ? Math.min(v, meta.max) : 0);
                    }}
                    style={{
                      width: '100%', padding: '7px 8px', borderRadius: 9,
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                      color: '#fff', fontSize: 12, fontWeight: 800, textAlign: 'center', boxSizing: 'border-box',
                      outline: 'none', minHeight: 38,
                    }}
                  />
                  <span style={{ fontSize: 9, color: '#fff', lineHeight: 1.3 }}>{meta.hint}</span>
                  {val > meta.cap && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', lineHeight: 1.3 }}>
                      ⚠ Выше {meta.cap} {meta.unit} — кап: дальнейшее повышение дозы НЕ увеличивает MRV/восстановление
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Интенсивность курса */}
      {active && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
            Интенсивность курса
          </div>
          <div role="radiogroup" aria-label="Интенсивность курса" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {INTENSITY_UI.map(item => {
              const on = courseIntensity === item.id;
              return (
                <button
                  key={item.id}
                  role="radio"
                  aria-checked={on}
                  onClick={() => onIntensity(item.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    padding: '8px 6px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    border: on ? '1.5px solid ' + ACCENT : '1px solid rgba(255,255,255,0.08)',
                    background: on ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.02)',
                    color: on ? ACCENT : '#fff',
                  }}
                >
                  <span style={{ fontSize: 13 }}>{item.emoji}</span>
                  <span>{item.label}</span>
                  <span style={{ fontSize: 9, fontWeight: 500, opacity: 0.65 }}>{item.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Структурированная карточка расчёта адаптации
// ─────────────────────────────────────────────────────────────

const Tile: React.FC<{ label: string; value: string; color: string; hint?: string }> = ({ label, value, color, hint }) => (
  <div style={{ padding: '8px 6px', borderRadius: 10, background: color + '10', border: '1px solid ' + color + '28', textAlign: 'center' }}>
    <div style={{ fontSize: 9, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
    <div style={{ fontSize: 16, fontWeight: 900, color, lineHeight: 1.2, marginTop: 2 }}>{value}</div>
    {hint && <div style={{ fontSize: 9, color: '#fff', marginTop: 1 }}>{hint}</div>}
  </div>
);

export const PedAdaptationCard: React.FC<{ adaptation: PEDAdaptation | null; title?: string }> = ({ adaptation: a, title }) => {
  if (!a || a.activePEDs.length === 0) return null;
  const carbsLabel = a.periWorkoutCarbs === 'high' ? 'высокие' : a.periWorkoutCarbs === 'low' ? 'низкие' : 'умеренные';
  return (
    <div style={{ ...CARD, marginBottom: 10, background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.16)', padding: 12 }}>
      {/* Шапка */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#a855f7' }}>{title || '📊 Расчёт адаптации под PED'}</div>
          <div style={{ fontSize: 10, color: '#fff', marginTop: 1 }}>Пороги MEV/MAV/MRV увеличены на суммарный множитель</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#a855f7', lineHeight: 1.1 }}>×{a.combinedMrvMultiplier.toFixed(2)}</div>
          <div style={{ fontSize: 9, color: '#fff' }}>итог MRV</div>
        </div>
      </div>

      {/* Сводные плитки */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
        <Tile label="Объём (MRV)" value={'×' + a.combinedMrvMultiplier.toFixed(2)} color="#a855f7" />
        <Tile label="Восстановление" value={'×' + a.combinedRecoveryMultiplier.toFixed(2)} color="#22c55e" />
        <Tile label="Углеводы пери-WO" value={carbsLabel} color="#f59e0b" />
      </div>

      {/* 🧬 Почему достигается прибавка */}
      <div style={{ marginBottom: 10, padding: 8, borderRadius: 10, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', marginBottom: 4 }}>🧬 Почему достигается прибавка</div>
        <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.5 }}>
          Андрогены ускоряют синтез мышечного белка и регенерацию соединительной ткани → мышца выдерживает и успевает восстановить <b>больший объём</b> (порог MRV растёт). ГР/инсулин улучшают усвоение нутриентов и восстановление между сессиями. Итог: можно тренироваться больше/чаще без перетренированности — план расширяется до нового потолка, а не «на глаз».
        </div>
      </div>

      {/* Разбивка по веществам */}
      {a.perPED.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
          {a.perPED.map(pp => {
            const meta = PED_META_UI[pp.ped as PED];
            return (
              <div key={pp.ped} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{meta ? meta.emoji : '💊'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
                    {meta ? meta.label : pp.ped}
                    {pp.dose > 0 && <span style={{ color: '#fff', fontWeight: 500 }}> · {pp.dose} {meta ? meta.unit : ''}</span>}
                    {pp.dose > (meta ? meta.cap : getPedCap(pp.ped as PED)) && (
                      <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, color: '#f59e0b', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 5, padding: '1px 5px' }}>
                        кап
                      </span>
                    )}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#a855f7', whiteSpace: 'nowrap' }}>MRV ×{pp.mrvMult.toFixed(2)}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#22c55e', whiteSpace: 'nowrap' }}>В ×{pp.recMult.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 🚫 Почему больше установленного лимита нельзя */}
      {(() => {
        const totalCapped = a.combinedMrvMultiplier >= 1.99;
        const overCapPeds = a.perPED.filter(pp => pp.dose > (PED_META_UI[pp.ped as PED] ? PED_META_UI[pp.ped as PED].cap : getPedCap(pp.ped as PED)));
        if (!totalCapped && overCapPeds.length === 0) return null;
        return (
          <div style={{ marginBottom: 10, padding: 8, borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>🚫 Почему больше нельзя</div>
            <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.5 }}>
              {totalCapped && <>Суммарный потолок адаптации <b>×2.0</b> достигнут: рецепторное насыщение и предел регенерации сухожилий/ЦНС не масштабируются с дозой — дальнейшее повышение доз НЕ увеличивает MRV, добавляется только риск. </>}
              {overCapPeds.length > 0 && <>Доза выше капа вещества ({overCapPeds.map(pp => PED_META_UI[pp.ped as PED]?.label ?? pp.ped).join(', ')}): кривая «доза→восстановление» выходит на плато — прибавка перестаёт расти, растёт побочная нагрузка.</>}
            </div>
          </div>
        );
      })()}

      {/* Как считается */}
      {a.rationale.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Как считается</div>
          {a.rationale.map((r, i) => (
            <div key={i} style={{ fontSize: 10, color:'#fff', lineHeight: 1.45, paddingLeft: 10, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 0, color: '#a855f7' }}>•</span>
              {r}
            </div>
          ))}
        </div>
      )}

      {/* Риски */}
      {a.risks.length > 0 && (
        <div style={{ padding: 8, borderRadius: 10, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#f87171', marginBottom: 4 }}>⚠ Контроль и риски</div>
          {a.risks.map((r, i) => (
            <div key={i} style={{ fontSize: 10, color: '#fff', lineHeight: 1.45, paddingLeft: 10, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 0, color: '#f87171' }}>!</span>
              {r}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
