/**
 * bb-step-prep-cycle.tsx — отдельный режим «🏁 Prep-цикл» ББ-авто (не трогает обычную
 * сборку), вынесен из god-component `BbAutoConstructor.tsx` (§4.3, этап 3). Перенос 1-в-1:
 * логика/тексты/стили не менялись, state-ссылки/хендлеры переданы явными props.
 * Чистые деривации (catOpts/prepProfile/muscleRu) перенесены вместе с шагом.
 */
import React from 'react';
import {
  PREP_ACCENT_OPTIONS, PREP_MINIMAL_OPTIONS, PREP_MINIMAL_MODE_LABELS, prepSplitProfile,
  type PrepMinimalMode,
} from '../../../engines/bb/bb-prep-splits';
import {
  recommendMinimalMode, prepCutProjection, posingPlanForCategory, savePosingCheckin, getPosingCheckins,
  posingWeekStats, prepCardioPlan, buildPrepNutritionPlan, buildPrepSeason,
  type PrepCycleResult,
} from '../../../engines/bb/bb-prep-cycle.engine';
import {
  CATEGORY_PROFILES, isoAddDays, isoToday, computeReadiness, configFromPlan, prepTrainingCompliance,
  nutritionTargetsForPrepDate, PREP_PHASE_LABELS, PREP_PHASE_COLORS,
  type PrepWeightAdvice, type PrepPhaseKey, type PeakNutritionBase, type BBContestCategory,
  type ContestEventEntry,
} from '../../../engines/bb/bb-contest-prep.engine';
import { getPattern } from '../../../engines/bb/bb-split-patterns';
import { loadSessions } from '../../../engines/workout-logger.engine';
import { PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
import { BTN, BTN_GHOST } from './training-ui';
import { chipBtn } from './bb-auto-constructor-shared';

export type PrepStepId = 'params' | 'accent' | 'split' | 'nutrition' | 'result';

const PREP_MUSCLE_RU: Record<string, string> = {
  chest: 'Грудь', back: 'Спина', shoulders: 'Плечи', arms: 'Руки', biceps: 'Бицепс', triceps: 'Трицепс',
  quads: 'Квадрицепс', hamstrings: 'Бицепс бедра', glutes: 'Ягодицы', calves: 'Икры', abs: 'Пресс', traps: 'Трапеции',
  legs: 'Ноги', core: 'Кор', forearms: 'Предплечья',
  delt_mid: 'Средняя дельта', delt_front: 'Передняя дельта', delt_rear: 'Задняя дельта',
  back_width: 'Ширина спины', back_thickness: 'Толщина спины', chest_upper: 'Верх груди', chest_lower: 'Низ груди',
};

export interface BbPrepCycleStepProps {
  prepStep: PrepStepId;
  setPrepStep: React.Dispatch<React.SetStateAction<PrepStepId>>;
  /** Выход из prep-режима: setPrepMode(false) + setPrepResult(null). */
  setPrepMode: React.Dispatch<React.SetStateAction<boolean>>;
  setPrepResult: React.Dispatch<React.SetStateAction<PrepCycleResult | null>>;
  prepSex: 'male' | 'female';
  prepCat: BBContestCategory;
  setPrepCat: React.Dispatch<React.SetStateAction<BBContestCategory>>;
  pcWeeks: number;
  setPcWeeks: React.Dispatch<React.SetStateAction<number>>;
  prepTaper: number;
  setPrepTaper: React.Dispatch<React.SetStateAction<number>>;
  pcShowDate: string;
  setPcShowDate: React.Dispatch<React.SetStateAction<string>>;
  prepComps: ContestEventEntry[];
  setPrepComps: React.Dispatch<React.SetStateAction<ContestEventEntry[]>>;
  prepMainId: string;
  setPrepMainId: React.Dispatch<React.SetStateAction<string>>;
  prepCompDraft: { name: string; date: string; priority: 'A' | 'B' | 'C' };
  setPrepCompDraft: React.Dispatch<React.SetStateAction<{ name: string; date: string; priority: 'A' | 'B' | 'C' }>>;
  prepBodyFat: number | undefined;
  setPrepBodyFat: React.Dispatch<React.SetStateAction<number | undefined>>;
  prepAccent: string[];
  setPrepAccent: React.Dispatch<React.SetStateAction<string[]>>;
  prepMinimal: string[];
  setPrepMinimal: React.Dispatch<React.SetStateAction<string[]>>;
  prepMinMode: PrepMinimalMode;
  setPrepMinMode: React.Dispatch<React.SetStateAction<PrepMinimalMode>>;
  minRec: ReturnType<typeof recommendMinimalMode>;
  prepSplit: string;
  setPrepSplit: React.Dispatch<React.SetStateAction<string>>;
  prepStale: boolean;
  profileWeight: number;
  prepVolumeStrategy: 'gentle' | 'balanced' | 'aggressive';
  setPrepVolumeStrategy: React.Dispatch<React.SetStateAction<'gentle' | 'balanced' | 'aggressive'>>;
  prepDeloadEvery: number;
  setPrepDeloadEvery: React.Dispatch<React.SetStateAction<number>>;
  pcBusy: boolean;
  prepResult: PrepCycleResult | null;
  prepSeason: ReturnType<typeof buildPrepSeason> | null;
  weightAdvice: PrepWeightAdvice | null;
  handleApplyWeightAdjustment: (caloriesDelta: number, cardioDelta: number) => void;
  posingMin: number;
  setPosingMin: React.Dispatch<React.SetStateAction<number>>;
  posingList: ReturnType<typeof getPosingCheckins>;
  setPosingList: React.Dispatch<React.SetStateAction<ReturnType<typeof getPosingCheckins>>>;
  handleBuildPrep: () => void;
  handleBuildSeason: () => void;
  handleSavePrepCycle: () => void;
  handleOpenPrepPlan: () => void;
  handleSaveVariant: () => void;
  handlePrintPrepSummary: () => void;
  handleExportPrepIcs: () => void;
  handleExportPrepJson: () => void;
  flash: (m: string) => void;
}

export const BbPrepCycleStep: React.FC<BbPrepCycleStepProps> = ({
  prepStep, setPrepStep, setPrepMode, setPrepResult,
  prepSex, prepCat, setPrepCat, pcWeeks, setPcWeeks, prepTaper, setPrepTaper, pcShowDate, setPcShowDate,
  prepComps, setPrepComps, prepMainId, setPrepMainId, prepCompDraft, setPrepCompDraft,
  prepBodyFat, setPrepBodyFat, prepAccent, setPrepAccent, prepMinimal, setPrepMinimal,
  prepMinMode, setPrepMinMode, minRec, prepSplit, setPrepSplit, prepStale, profileWeight,
  prepVolumeStrategy, setPrepVolumeStrategy, prepDeloadEvery, setPrepDeloadEvery, pcBusy,
  prepResult, prepSeason, weightAdvice, handleApplyWeightAdjustment,
  posingMin, setPosingMin, posingList, setPosingList,
  handleBuildPrep, handleBuildSeason, handleSavePrepCycle, handleOpenPrepPlan, handleSaveVariant,
  handlePrintPrepSummary, handleExportPrepIcs, handleExportPrepJson, flash,
}) => {
  const muscleRu = (m: string) => PREP_MUSCLE_RU[m] || m;
  const catOpts = (Object.keys(CATEGORY_PROFILES) as BBContestCategory[]).filter(c => CATEGORY_PROFILES[c].sex === prepSex);
  const prepProfile = prepSplitProfile(prepCat);
  const steps: Array<{ id: PrepStepId; label: string }> = [
    { id: 'params', label: '⚙️ Параметры' },
    { id: 'accent', label: '⭐ Акценты/Минимум' },
    { id: 'split', label: '📐 Сплит' },
    { id: 'nutrition', label: '🍽 Prep-питание' },
    { id: 'result', label: '📋 Результат' },
  ];
  const stepIdx = steps.findIndex(s => s.id === prepStep);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#ec4899' }}>🏁 Prep-цикл</span>
        <span style={{ fontSize: 10, color: '#fff' }}>Отдельный режим подготовки к соревнованиям (не трогает обычную сборку)</span>
        <button style={{ ...BTN_GHOST, marginLeft: 'auto', color: '#fb7185', borderColor: 'rgba(244,63,94,0.3)' }} onClick={() => { setPrepMode(false); setPrepResult(null); }}>✕ Выйти из prep</button>
      </div>

      {/* Шаги */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
        {steps.map((s, i) => (
          <button key={s.id} onClick={() => { if (i < stepIdx) setPrepStep(s.id); }} style={{
            padding: '6px 10px', borderRadius: 999, border: 'none', cursor: i < stepIdx ? 'pointer' : 'default',
            fontSize: 10, fontWeight: 800, minHeight: 32,
            background: prepStep === s.id ? 'linear-gradient(135deg,#ec4899,#be185d)' : 'rgba(255,255,255,0.05)',
            color: prepStep === s.id ? '#fff' : '#fff',
          }}>{s.label}</button>
        ))}
      </div>

      {prepStep === 'params' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>⚙️ Параметры Prep-цикла</div>
          <PopupSelect
            label={`🎭 Категория (${prepSex === 'female' ? 'женские' : 'мужские'})`}
            value={prepCat}
            onChange={v => setPrepCat(v as BBContestCategory)}
            options={catOpts.map(c => ({ id: c, label: CATEGORY_PROFILES[c].label }))}
          />
          {prepProfile.balanceNote && <div style={{ fontSize: 10, color: '#fff', padding: '8px 10px', borderRadius: 10, background: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.2)' }}>💡 {prepProfile.balanceNote}</div>}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 130 }}>
              <div style={{ fontSize: 10, color: '#fff', marginBottom: 4 }}>Длительность, недель (4-26)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => setPcWeeks(w => Math.max(4, w - 1))} style={chipBtn('-')}>−</button>
                <span style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 14 }}>{pcWeeks}</span>
                <button onClick={() => setPcWeeks(w => Math.min(26, w + 1))} style={chipBtn('+')}>+</button>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 130 }}>
              <div style={{ fontSize: 10, color: '#fff', marginBottom: 4 }}>Тапер, недель (1-4)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => setPrepTaper(t => Math.max(1, Math.min(4, t - 1)))} style={chipBtn('-')}>−</button>
                <span style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 14 }}>{prepTaper}</span>
                <button onClick={() => setPrepTaper(t => Math.min(4, t + 1))} style={chipBtn('+')}>+</button>
              </div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: '#fff' }}>Подготовка {Math.max(1, pcWeeks - prepTaper - 1)} нед → тапер {prepTaper} нед → пик-неделя (1) → шоу</div>

          <label style={{ fontSize: 10, color: '#fff' }}>Дата соревнования (якорь фаз и тапера)</label>
          <input type="date" value={pcShowDate} onChange={e => e.target.value && setPcShowDate(e.target.value)} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: 12, width: '100%', boxSizing: 'border-box' }} />

          {/* Доп. соревнования сезона (A/B/C) — пик-неделя строится под главный */}
          <div style={{ fontSize: 10, color: '#fff' }}>Доп. старты сезона (необязательно):</div>
          {prepComps.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontWeight: 700, color: c.priority === 'A' ? '#fbbf24' : c.priority === 'B' ? '#60a5fa' : '#fff' }}>[{c.priority}]</span>
              <span style={{ flex: 1 }}>{c.name}</span>
              <span style={{ color: '#fff' }}>{c.date}</span>
              <button onClick={() => setPrepMainId(c.id)} style={{ ...chipBtn('', prepMainId === c.id), padding: '2px 6px', minHeight: 24, fontSize: 9 }}>★ главный</button>
              <button onClick={() => { setPrepComps(prev => prev.filter(x => x.id !== c.id)); if (prepMainId === c.id) setPrepMainId(''); }} style={{ ...chipBtn('', false), padding: '2px 6px', minHeight: 24, fontSize: 9, color: '#f87171' }}>✕</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={prepCompDraft.name} placeholder="Название" onChange={e => setPrepCompDraft(d => ({ ...d, name: e.target.value }))} style={{ flex: 1, minWidth: 90, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: 10 }} />
            <input type="date" value={prepCompDraft.date} onChange={e => setPrepCompDraft(d => ({ ...d, date: e.target.value }))} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: 10 }} />
            <PopupSelect
              label="Приоритет"
              value={prepCompDraft.priority}
              onChange={v => setPrepCompDraft(d => ({ ...d, priority: v as 'A' | 'B' | 'C' }))}
              options={[{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }, { id: 'C', label: 'C' }]}
            />
            <button onClick={() => {
              const name = prepCompDraft.name.trim();
              const date = prepCompDraft.date;
              if (!name || !date) { flash('Укажите название и дату старта'); return; }
              setPrepComps(prev => [...prev, { id: `comp_${Date.now().toString(36)}`, name, date, priority: prepCompDraft.priority }]);
              setPrepCompDraft({ name: '', date: '', priority: 'B' });
              setPrepResult(null);
            }} style={BTN_GHOST}>➕ Добавить</button>
          </div>

          <label style={{ fontSize: 10, color: '#fff' }}>Текущий % жира (для оценки готовности; необязательно)</label>
          <input type="number" min={3} max={60} value={prepBodyFat ?? ''} onChange={e => setPrepBodyFat(e.target.value ? Number(e.target.value) : undefined)} placeholder="напр. 14" style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: 12, width: '100%', boxSizing: 'border-box' }} />

          <button style={{ ...BTN, width: '100%' }} onClick={() => setPrepStep('accent')}>Далее: акценты/минимум →</button>
        </div>
      )}

      {prepStep === 'accent' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>⭐ Акцент (1-2 мышцы) — для формы и баланса</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PREP_ACCENT_OPTIONS.map(m => {
              const on = prepAccent.includes(m);
              const disabled = !on && prepAccent.length >= 2;
              return <button key={m} disabled={disabled} onClick={() => setPrepAccent(prev => on ? prev.filter(x => x !== m) : [...prev, m])} style={{ ...chipBtn(m, on), opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>{muscleRu(m)}</button>;
            })}
          </div>

          <div style={{ fontSize: 12, fontWeight: 800 }}>⬇ Минимальная нагрузка — чтобы акцент получил ресурс (общая форма сохранена)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PREP_MINIMAL_OPTIONS.map(m => {
              const on = prepMinimal.includes(m);
              return <button key={m} onClick={() => setPrepMinimal(prev => on ? prev.filter(x => x !== m) : [...prev, m])} style={{ ...chipBtn(m, on, true) }}>{muscleRu(m)}</button>;
            })}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {(['reduce_direct_to_floor', 'remove_direct_when_indirect_covers_floor'] as PrepMinimalMode[]).map(mode => {
              const on = prepMinMode === mode;
              return <button key={mode} onClick={() => setPrepMinMode(mode)} style={{ ...chipBtn(mode, on), minHeight: 36, fontSize: 10 }}>⚖ {PREP_MINIMAL_MODE_LABELS[mode]}</button>;
            })}
          </div>
          {prepMinimal.length > 0 && prepMinMode !== minRec.mode && (
            <div style={{ fontSize: 10, color: '#fbbf24', padding: '8px 10px', borderRadius: 10, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>💡 Рекомендация: «{PREP_MINIMAL_MODE_LABELS[minRec.mode]}» — {minRec.reason}</div>
          )}
          {prepMinimal.length === 0 && <div style={{ fontSize: 10, color: '#fff' }}>Минимальная нагрузка не задана — акцент получит приоритет, остальные мышцы в поддерживающем объёме.</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...BTN_GHOST, flex: 1 }} onClick={() => setPrepStep('params')}>← Назад</button>
            <button style={{ ...BTN, flex: 1 }} onClick={() => setPrepStep('split')}>Далее: сплит →</button>
          </div>
        </div>
      )}

      {prepStep === 'split' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>📐 Сплит подготовки</div>
          <PopupSelect
            label={`📐 Сплит (рекомендуемые для ${CATEGORY_PROFILES[prepCat].label})`}
            value={prepSplit}
            onChange={setPrepSplit}
            options={prepProfile.recommendedSplits.map(id => {
              const p = getPattern(id);
              return { id, label: p ? p.name : id };
            })}
          />
          {(() => {
            const p = getPattern(prepSplit);
            if (!p) return null;
            return <div style={{ fontSize: 10, color: '#fff', padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)' }}>{p.description}</div>;
          })()}
          <div style={{ fontSize: 10, color: '#fff' }}>Всего дней: {getPattern(prepSplit)?.sessionsPerRotation ?? '—'} / ротация {getPattern(prepSplit)?.rotationDays ?? '—'}</div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...BTN_GHOST, flex: 1 }} onClick={() => setPrepStep('accent')}>← Назад</button>
            <button style={{ ...BTN, flex: 1 }} onClick={() => setPrepStep('nutrition')}>Далее: питание →</button>
          </div>
        </div>
      )}

      {prepStep === 'nutrition' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>🍽 Prep-питание и тапер</div>
          {prepStale && <div style={{ fontSize: 10, color: '#f87171', padding: '8px 10px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>⚠ Параметры изменены после сборки — результат будет пересобран.</div>}
          <div style={{ fontSize: 11, color: '#fff', lineHeight: 1.5 }}>
            Prep-цикл строит единый план подготовки (дефицит по категории), тапер последних {prepTaper} нед и пик-неделю под дату {pcShowDate}.
            Он будет применён в планировщике питания автоматически (вкладка «🏁 Тапер ББ» и дневные цели).
          </div>
          <div style={{ fontSize: 10, color: '#fff' }}>Текущий вес: {profileWeight} кг · пол: {prepSex === 'female' ? 'женский' : 'мужской'} · категория: {CATEGORY_PROFILES[prepCat].label}</div>

          {/* Стратегия объёма подготовки */}
          <div>
            <div style={{ fontSize: 10, color: '#fff', marginBottom: 4 }}>Стратегия объёма подготовки (как сильно снижать к финалу):</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {([['gentle', '🛡 Сохранить массу'], ['balanced', '⚖ Сбалансированно'], ['aggressive', '🔥 Агрессивная сушка']] as const).map(([id, label]) => {
                const on = prepVolumeStrategy === id;
                return <button key={id} type="button" onClick={() => setPrepVolumeStrategy(id)} style={{ ...chipBtn(id, on), minHeight: 36, fontSize: 10 }}>{label}</button>;
              })}
            </div>
            <div style={{ fontSize: 9, color: '#fff', marginTop: 4 }}>Объём держится на уровне обычного ББ-авто (MAV) во всей подготовке; стратегия влияет на финальный спуск к таперу.</div>
          </div>

          {/* Prep-делоды */}
          <div>
            <div style={{ fontSize: 10, color: '#fff', marginBottom: 4 }}>🔄 Prep-делод (разгрузка каждые N недель подготовки):</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {([[0, 'Выкл'], [4, '4 нед'], [5, '5 нед'], [6, '6 нед']] as const).map(([id, label]) => {
                const on = prepDeloadEvery === id;
                return <button key={id} type="button" onClick={() => setPrepDeloadEvery(id)} style={{ ...chipBtn(String(id), on), minHeight: 36, fontSize: 10 }}>{label}</button>;
              })}
            </div>
            <div style={{ fontSize: 9, color: '#fff', marginTop: 4 }}>Делод: объём ×0.7, RIR +2 — сброс усталости и сохранение мышц при длительном дефиците (Helms 2017).</div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...BTN_GHOST, flex: 1 }} onClick={() => setPrepStep('split')}>← Назад</button>
            <button style={{ ...BTN, flex: 1, background: 'linear-gradient(135deg,#ec4899,#be185d)', color: '#fff' }} disabled={pcBusy} onClick={handleBuildPrep}>{pcBusy ? '⏳ Сборка...' : '🏁 Собрать prep-цикл'}</button>
          </div>
          <button style={{ ...BTN_GHOST, width: '100%', borderColor: '#60a5fa', color: '#60a5fa' }} disabled={pcBusy || prepComps.length < 2} onClick={handleBuildSeason}>
            🏁 Собрать сезон (по всем {prepComps.length >= 2 ? `${prepComps.length} стартам` : 'стартам — добавьте ≥2'})
          </button>
        </div>
      )}

      {prepStep === 'result' && prepResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>📋 Готово — Prep-цикл</div>
          {prepSeason && (
            <div style={{ fontSize: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)' }}>
              <div style={{ fontWeight: 800, color: '#60a5fa', marginBottom: 4 }}>🏁 Сезон: {prepSeason.cycles.length} старта</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {prepSeason.summary.map((s, i) => (
                  <button key={i} onClick={() => { setPrepResult(prepSeason.cycles[i]); setPrepStep('result'); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left', padding: '6px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>
                    <span style={{ fontWeight: 700, color: s.priority === 'A' ? '#fbbf24' : '#fff' }}>[{s.priority ?? '—'}]</span>
                    <span style={{ flex: 1 }}>{s.name}</span>
                    <span style={{ color: '#fff' }}>{s.date} · {s.totalWeeks} нед (подг {s.prepWeeks}+тапер {s.taperWeeks}+пик)</span>
                  </button>
                ))}
              </div>
              {prepSeason.warnings.length > 0 && <div style={{ color: '#fbbf24', marginTop: 4 }}>{prepSeason.warnings.join(' ')}</div>}
            </div>
          )}
          {prepStale && (
            <div style={{ fontSize: 10, color: '#f87171', padding: '8px 10px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
              ⚠ Параметры изменены после сборки — результат устарел. Вернитесь и нажмите «🏁 Собрать prep-цикл» заново.
            </div>
          )}
          {prepResult.warnings.map((w, i) => <div key={i} style={{ fontSize: 10, color: '#fbbf24', padding: '8px 10px', borderRadius: 10, background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>{w}</div>)}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {prepResult.phases.map(p => {
              const dateStr = p.dateStart && p.dateEnd
                ? (p.key === 'show_day' ? ` 📅 ${p.dateStart}` : ` 📅 ${p.dateStart.slice(5)}–${p.dateEnd.slice(5)}`)
                : '';
              return (
                <span key={p.key} title={`${p.note ?? ''}`} style={{ padding: '4px 9px', borderRadius: 999, fontSize: 9, fontWeight: 700, background: `${p.color}22`, border: `1px solid ${p.color}55`, color: p.color }}>
                  {p.label} · нед {p.weekStart}-{p.weekEnd}{dateStr}
                </span>
              );
            })}
          </div>

          <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.5 }}>
            <div>⭐ Акцент: {prepResult.accentMuscles.length ? prepResult.accentMuscles.map(muscleRu).join(', ') : 'без акцента'}</div>
            <div>⬇ Минимальная нагрузка: {prepResult.minimalMuscles.length ? prepResult.minimalMuscles.map(muscleRu).join(', ') : 'не задана'} · {PREP_MINIMAL_MODE_LABELS[prepResult.minimalMode]}</div>
            <div>📐 Сплит: {getPattern(prepResult.config.splitPatternId || '')?.name ?? prepResult.config.splitPatternId}</div>
            <div>🗓 Шоу: {prepResult.prepPlan.showDate} · недель в плане: {prepResult.bbPlan.weeks.length}</div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2 }}>По неделям (фаза · дата):</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {prepResult.bbPlan.weeks.map((w: any, i) => {
              const phaseKey = (w.contestPhase ?? 'preparation') as PrepPhaseKey;
              const ph = PREP_PHASE_LABELS[phaseKey] || String(w.contestPhase);
              const color = PREP_PHASE_COLORS[phaseKey] || '#888';
              const phase = prepResult.prepPlan.phases.find(p => (w.week ?? 0) >= p.weekStart && (w.week ?? 0) <= p.weekEnd);
              const dStr = phase?.dateEnd ? isoAddDays(phase.dateEnd, -7 * (phase.weekEnd - (w.week ?? 0))).slice(5) : '';
              return <span key={i} title={`нед ${w.week}`} style={{ padding: '3px 7px', borderRadius: 8, fontSize: 9, background: `${color}18`, border: `1px solid ${color}44`, color }}>н{w.week} {ph}{dStr ? ` ${dStr}` : ''}</span>;
            })}
          </div>

          {/* ⚖️ Адаптация по весу */}
          {weightAdvice && weightAdvice.status !== 'no_data' && (
            <div style={{ fontSize: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)' }}>
              <div style={{ fontWeight: 800, color: '#60a5fa', marginBottom: 4 }}>⚖️ Адаптация по весу: {weightAdvice.status}</div>
              <div style={{ color: '#fff' }}>{weightAdvice.recommendation}</div>
              {weightAdvice.adjustCalories !== 0 && <button style={{ ...BTN_GHOST, marginTop: 6, marginRight: 6 }} onClick={() => handleApplyWeightAdjustment(weightAdvice.adjustCalories, 0)}>{weightAdvice.adjustCalories > 0 ? '+' : ''}{weightAdvice.adjustCalories} ккал</button>}
              {weightAdvice.adjustCardioMin !== 0 && <button style={{ ...BTN_GHOST, marginTop: 6 }} onClick={() => handleApplyWeightAdjustment(0, weightAdvice.adjustCardioMin)}>{weightAdvice.adjustCardioMin > 0 ? '+' : ''}{weightAdvice.adjustCardioMin} мин кардио/нед</button>}
            </div>
          )}

          {/* Что учтено в объёме */}
          <div style={{ fontSize: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontWeight: 800, color: '#fff', marginBottom: 4 }}>🧮 Что учтено в объёме</div>
            <div style={{ color: '#fff' }}>
              Цель: {prepResult.config.enhanced ? 'поддержание массы (PED)' : prepResult.config.experienceLevel} · стаж {prepResult.config.trainingYears ?? '—'} г · {prepResult.config.enhanced ? 'курс' : 'натурал'}
              {prepResult.config.bodyFat != null ? ` · %жира ${prepResult.config.bodyFat}` : ''}
              {prepResult.config.hrvMs != null ? ` · HRV ${prepResult.config.hrvMs}` : ''}
              {prepResult.config.sleepHours != null ? ` · сон ${prepResult.config.sleepHours}ч` : ''}
              {prepResult.config.stressLevel != null ? ` · стресс ${prepResult.config.stressLevel}` : ''}
              {prepResult.config.labMrvMultiplier != null ? ` · лаб ×${prepResult.config.labMrvMultiplier}` : ''}
              {prepResult.config.pedDoses ? ' · дозы PED' : ''}
            </div>
            <div style={{ color: '#fff', marginTop: 2 }}>MRV-капы и целевой объём рассчитаны с учётом уровня, стажа, PED, восстановления, питания и лаборатории.</div>
          </div>

          {/* 📉 План объёма подготовки (каскад) — долгий режим, а не только тапер */}
          {prepResult.volumePlan && (
            <div style={{ fontSize: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <div style={{ fontWeight: 800, color: '#60a5fa', marginBottom: 4 }}>📉 Объём подготовки (каскад на весь цикл, не только тапер)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                {prepResult.volumePlan.phases.map((ph, i) => (
                  <span key={i} style={{ padding: '3px 8px', borderRadius: 8, fontSize: 9, fontWeight: 700, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#93c5fd' }}>
                    нед {Math.max(1, Math.ceil(ph.fromPct * prepResult.prepWeeks))}–{Math.min(prepResult.prepWeeks, Math.ceil(ph.toPct * prepResult.prepWeeks))} · ×{ph.volumeMult.toFixed(2)} · RIR {ph.rir[0]}-{ph.rir[1]}
                  </span>
                ))}
                <span style={{ padding: '3px 8px', borderRadius: 8, fontSize: 9, fontWeight: 700, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24' }}>→ тапер ×0.6 → пик</span>
              </div>
              <div style={{ color: '#fff' }}>
                🎯 Целевой объём на группу мышц/нед: базовый {prepResult.volumePlan.targetSetsPerMusclePerWeek[0]}–{prepResult.volumePlan.targetSetsPerMusclePerWeek[1]} сетов
                → <b style={{ color: '#93c5fd' }}>~{prepResult.volumePlan.scaledTargetSetsPerMusclePerWeek[0]}–{prepResult.volumePlan.scaledTargetSetsPerMusclePerWeek[1]}</b> с учётом PED/стажа/уровня
              </div>
              <div style={{ color: '#fff', marginTop: 2 }}>{prepResult.volumePlan.note}</div>
              <div style={{ color: '#fff', marginTop: 2 }}>База 10–15 сетов/группу/нед — для натурала/среднего стажа. У продвинутого атлета (стаж, PED, уровень) целевой объём выше — это уже заложено в плане. Объём подготовки снижается лишь умеренно; тапер — финальный спуск к пику.</div>
            </div>
          )}

          {/* 🎯 Вердикт готовности по %жира */}
          {(() => {
            try {
              const rd = computeReadiness({ ...configFromPlan(prepResult.prepPlan), bodyFatPct: prepResult.config.bodyFatPct });
              const color = rd.verdict === 'on_track' ? '#4ade80' : rd.verdict === 'ahead' ? '#22c55e' : '#fbbf24';
              return (
                <div style={{ fontSize: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(34,197,94,0.05)', border: `1px solid ${color}44` }}>
                  <div style={{ fontWeight: 800, color, marginBottom: 4 }}>
                    🎯 Готовность: {rd.verdict === 'on_track' ? 'по графику' : rd.verdict === 'ahead' ? 'уже у цели' : 'сушка не дожата'}
                    {rd.targetBf != null ? ` · цель ~${rd.targetBf}%` : ''}
                    {rd.gap != null ? ` · осталось ${rd.gap}%` : ''}
                  </div>
                  <div style={{ color: '#fff' }}>{rd.note}</div>
                </div>
              );
            } catch { return null; }
          })()}

          {/* 🏃 Кардио подготовки */}
          {(() => {
            try {
              const cp = prepCardioPlan(prepResult.config);
              return (
                <div style={{ fontSize: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(251,146,60,0.06)', border: '1px solid rgba(251,146,60,0.2)' }}>
                  <div style={{ fontWeight: 800, color: '#fb923c', marginBottom: 4 }}>🏃 Кардио подготовки: ~{cp.minutesPerWeek} мин/нед · ~{cp.stepsPerDay} шагов/день</div>
                  <div style={{ color: '#fff' }}>{cp.zone}</div>
                  <div style={{ color: '#fff', marginTop: 2 }}>{cp.note}</div>
                </div>
              );
            } catch { return null; }
          })()}

          {/* 📉 Прогноз сушки к шоу */}
          {(() => {
            const proj = prepCutProjection(prepResult.prepPlan, profileWeight, prepBodyFat);
            const ok = proj.canReachByShow;
            return (
              <div style={{ fontSize: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <div style={{ fontWeight: 800, color: ok ? '#4ade80' : '#fbbf24', marginBottom: 4 }}>
                  📉 Сушка к шоу · цель ~{proj.targetBodyFatPct}% · темп {proj.weeklyRateKg} кг/нед
                </div>
                <div style={{ color: '#fff' }}>
                  {proj.targetWeightKg != null && <>Целевой вес ~{proj.targetWeightKg} кг · </>}
                  до шоу {proj.weeksToShow} нед · прогноз веса на шоу ~{proj.projectedShowWeightKg} кг.
                </div>
                <div style={{ color: ok ? '#fff' : '#fbbf24', marginTop: 2 }}>{proj.note}</div>
              </div>
            );
          })()}

          {/* 📈 Выполнение подготовки по дневнику */}
          {(() => {
            try {
              const compliance = prepTrainingCompliance(
                prepResult.prepPlan,
                prepResult.bbPlan.weeks.map((w: any) => ({
                  week: (w as any).week,
                  contestPhase: (w as any).contestPhase,
                  plannedSets: (w.sessions || []).reduce((a: number, s: any) => a + (s.exercises || []).reduce((b: number, e: any) => b + (e.sets || 0), 0), 0),
                })),
                loadSessions().map(s => ({ date: s.date, totalSets: s.totalSets })),
              );
              const past = compliance.weeks.filter(w => w.status !== 'upcoming');
              if (compliance.completedWeeks === 0) return null;
              return (
                <div style={{ fontSize: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)' }}>
                  <div style={{ fontWeight: 800, color: '#a78bfa', marginBottom: 4 }}>📈 Выполнение подготовки: {Math.round(compliance.overallPct * 100)}% · завершено {compliance.completedWeeks} из {compliance.elapsedWeeks} нед</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                    {compliance.weeks.map((cw, i) => {
                      const color = cw.status === 'upcoming' ? '#fff' : cw.status === 'done' ? '#4ade80' : cw.status === 'partial' ? '#fbbf24' : '#f87171';
                      return <span key={i} title={`нед ${cw.week}: факт ${cw.actualSets}/${cw.plannedSets} сетов (${cw.dateStart}–${cw.dateEnd})`} style={{ padding: '2px 6px', borderRadius: 6, fontSize: 8, background: `${color}22`, border: `1px solid ${color}55`, color }}>н{cw.week} {cw.status === 'upcoming' ? '⏳' : `${Math.round(cw.pct * 100)}%`}</span>;
                    })}
                  </div>
                  <div style={{ color: '#fff' }}>{compliance.recommendation}</div>
                </div>
              );
            } catch { return null; }
          })()}

          {/* 🍽 Питание на сегодня (из единого prep-плана) */}
          {(() => {
            try {
              const base: PeakNutritionBase = {
                kcal: Math.round(profileWeight * 31),
                proteinG: Math.round(profileWeight * 2.2),
                fatG: Math.round(profileWeight * (prepSex === 'female' ? 0.8 : 0.6)),
                carbsG: 0,
                waterMl: 3000,
                sodiumMg: 2800,
              };
              const nt = nutritionTargetsForPrepDate(isoToday(), prepResult.prepPlan, base);
              return (
                <div style={{ fontSize: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <div style={{ fontWeight: 800, color: '#4ade80', marginBottom: 4 }}>🍽 Питание на сегодня {nt.phaseLabel ? `· ${nt.phaseLabel}` : ''}</div>
                  <div style={{ color: '#fff' }}>
                    {nt.kcal} ккал · Б {nt.proteinG}г · У {nt.carbsG}г · Ж {nt.fatG}г
                    {nt.waterMl ? ` · 💧 ${(nt.waterMl / 1000).toFixed(1)}л` : ''}
                    {nt.sodiumMg ? ` · Na ${nt.sodiumMg}мг` : ''}
                  </div>
                  {nt.note && <div style={{ color: '#fff', marginTop: 2 }}>{nt.note}</div>}
                  <div style={{ color: '#fff', marginTop: 3 }}>Эти цели уже применяет планировщик питания (вкладка «🏁 Тапер ББ»).</div>
                </div>
              );
            } catch { return null; }
          })()}

          {/* 🍽 План питания подготовки (недели/фазы/макро/рефиды/микро) */}
          {(() => {
            try {
              const np = buildPrepNutritionPlan(prepResult.prepPlan, prepResult.config);
              return (
                <div style={{ fontSize: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.18)' }}>
                  <div style={{ fontWeight: 800, color: '#4ade80', marginBottom: 4 }}>🍽 План питания подготовки</div>
                  <div style={{ color: '#fff', marginBottom: 4 }}>{np.note}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                    {np.weeks.slice(0, 20).map(w => (
                      <span key={w.week} title={w.note} style={{ padding: '3px 7px', borderRadius: 7, fontSize: 8.5, fontWeight: 700, background: w.phase === 'peak_week' ? 'rgba(236,72,153,0.12)' : w.phase === 'taper' ? 'rgba(245,158,11,0.12)' : w.refeed ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${w.refeed ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`, color: w.phase === 'peak_week' ? '#f472b6' : w.phase === 'taper' ? '#fbbf24' : '#fff' }}>
                        н{w.week} {w.phase === 'preparation' ? (w.refeed ? 'рефид' : 'prep') : w.phase === 'final_preparation' ? 'финал' : w.phase === 'taper' ? 'тапер' : 'пик'} · {w.kcal}кк · Б{w.proteinG}/У{w.carbsG}/Ж{w.fatG}
                      </span>
                    ))}
                  </div>
                  <div style={{ color: '#fff' }}>
                    <div>⚖ {np.refeedStrategy}</div>
                    <div>🍗 {np.mealTiming.join(' ')}</div>
                    <div>💊 {np.micronutrients.join(' ')}</div>
                    <div>💧 {np.hydration}</div>
                    <div>🏃 Кардио-расход: ~{np.cardioKcalPerWeek} ккал/нед</div>
                    {np.femaleNotes.map((f, i) => <div key={i} style={{ color: '#f9a8d4' }}>👩 {f}</div>)}
                  </div>
                </div>
              );
            } catch { return null; }
          })()}

          {/* 🎭 Позирование */}
          {(() => {
            const pp = posingPlanForCategory(prepCat);
            const todayDone = posingList.find(e => e.date === isoToday());
            const stats = posingWeekStats(posingList, 7);
            return (
              <div style={{ fontSize: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)' }}>
                <div style={{ fontWeight: 800, color: '#c084fc', marginBottom: 4 }}>🎭 Позирование · {pp.minutesPerDay} мин/день · {stats.days ? `за 7д: ${stats.totalMin} мин (сред. ${stats.avgMin})` : 'за 7д: нет отметок'}</div>
                <div style={{ color: '#fff', marginBottom: 6 }}>{pp.poses.join(' · ')}</div>
                <div style={{ color: '#fff', marginBottom: 6 }}>{pp.note}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="number" min={0} max={120} value={posingMin || ''} onChange={e => setPosingMin(e.target.value ? Number(e.target.value) : 0)} placeholder="мин" style={{ width: 70, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: 10 }} />
                  <button style={BTN_GHOST} onClick={() => {
                    const next = savePosingCheckin({ date: isoToday(), minutes: posingMin || pp.minutesPerDay });
                    setPosingList(next);
                    setPosingMin(0);
                    flash(`🎭 Позирование отмечено${todayDone ? ' (обновлено)' : ''}`);
                  }}>{todayDone ? '✏️ Обновить отметку' : '✅ Отметить сегодня'}</button>
                  {todayDone && <span style={{ color: '#4ade80' }}>сегодня: {todayDone.minutes} мин ✓</span>}
                </div>
              </div>
            );
          })()}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            <button style={{ ...BTN, flex: '1 1 140px', background: 'linear-gradient(135deg,#ec4899,#be185d)', color: '#fff' }} onClick={handleSavePrepCycle}>💾 Сохранить в профиль</button>
            <button style={{ ...BTN_GHOST, flex: '1 1 140px' }} onClick={handleOpenPrepPlan}>🗓 Открыть как план</button>
            <button style={{ ...BTN_GHOST, flex: '1 1 140px', borderColor: '#22c55e', color: '#22c55e' }} onClick={() => handleSaveVariant()}>💾 Вариант</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button style={BTN_GHOST} onClick={handlePrintPrepSummary}>🖨 Сводка prep (PDF)</button>
            <button style={BTN_GHOST} onClick={handleExportPrepIcs}>📅 Фазы (.ics)</button>
            <button style={BTN_GHOST} onClick={handleExportPrepJson}>📥 JSON тренеру</button>
          </div>
          <button style={{ ...BTN_GHOST, width: '100%' }} onClick={() => setPrepStep('params')}>← Редактировать параметры</button>
        </div>
      )}
    </div>
  );
};
