/**
 * PeakWeekTab.tsx — под-вкладка «🏁 Тапер ББ» планировщика питания.
 *
 * Единая система пикинг-подготовки (bb-contest-prep.engine):
 * настройка протокола → тапер тренировок (Библиотека методик) → пик-неделя
 * 7 дней (ккал/БЖУ/вода/Na/K/тренировки/позы) → таймлайн дня шоу.
 *
 * «🏁 Применить тапер-план ББ» — сохраняет конфиг в профиль (goals.bbPeakConfig)
 * и перегенерирует план питания с оверлеем по реальной дате шоу.
 */
import React, { useMemo, useState } from 'react';
import {
  buildBBContestPrep, validateBBContestPrepConfig, isoToday, isoAddDays,
  CONTEST_CATEGORY_LABELS, PHASE_LABELS_RU,
  type BBContestPrepConfig, type BBContestCategory,
} from '../../../../engines/bb/bb-contest-prep.engine';
import { GlassCard, inputStyle, selectStyle } from './ui';
import { usePlanCtx } from './IndividualPlanContext';
import { getProfile } from '../../../../core/profile-manager';

const ACCENT = '#f59e0b';
const CARD: React.CSSProperties = { padding: 10, borderRadius: 12, background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 10 };
const DIM = 'rgba(255,255,255,0.55)';
const LBL: React.CSSProperties = { fontSize: 10, color: DIM, marginBottom: 2 };
const BTN_PRIMARY: React.CSSProperties = { flex: 1, padding: 11, borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 12, minHeight: 44, background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#000' };
const BTN_GHOST: React.CSSProperties = { flex: 1, padding: 11, borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 11, minHeight: 44, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' };

const MALE_CATS: BBContestCategory[] = ['mens_physique', 'classic_physique', 'mens_bb', 'bb_212'];
const FEMALE_CATS: BBContestCategory[] = ['bikini', 'figure', 'wellness', 'womens_physique', 'womens_bb'];

const STRATEGY_LABELS: Record<string, string> = {
  front: 'Front-load (3 дня, раньше)',
  moderate: 'Классика 3/3 (рекомендуется)',
  back: 'Back-load (2 дня, поздно)',
  classic: 'Classic: load + cut (опытные)',
  minimal: 'Minimal: без манипуляций (безопасно)',
  constant: 'Constant: натрий не трогаем (современно)',
  cut_2d: 'Cut за 2 дня',
  cut_3d: 'Cut за 3 дня (классика)',
};

const WATER_HINTS: Record<string, string> = {
  classic: 'Load 6–10 л → ступенчатый cut → глотки. Только опытные, здоровые почки.',
  moderate: 'Мягкий cut: обычная вода + снижение в последние 2 дня.',
  minimal: 'Обычный питьевой режим. Для новичков и первых пиков.',
};

function defaultConfig(sex: 'male' | 'female', weightKg: number, bbCategory: string): BBContestPrepConfig {
  const fallback: BBContestCategory = sex === 'female' ? 'bikini' : 'mens_physique';
  const known = (sex === 'female' ? FEMALE_CATS : MALE_CATS).find(c => c === bbCategory) ?? fallback;
  return {
    sex,
    category: known,
    weightKg: Math.max(40, Math.min(200, weightKg || 80)),
    bodyFatPct: undefined,
    experienceLevel: 'intermediate',
    enhanced: false,
    prepCount: 0,
    showDate: isoAddDays(isoToday(), 28),
    weeksOut: 3,
    trainingProtocol: 'bb',
    carbLoadStrategy: 'moderate',
    waterStrategy: 'minimal',
    sodiumStrategy: 'constant',
  };
}

export const PeakWeekTab: React.FC = () => {
  const ctx = usePlanCtx();
  const { bbPrepConfig, setBBPrepConfig, applyBBPeakToPlan, weight, sex, bodyFatPct, bbCategory } = ctx;

  const [draft, setDraft] = useState<BBContestPrepConfig>(() => bbPrepConfig ?? defaultConfig(sex, weight, bbCategory));
  const [savedFlash, setSavedFlash] = useState(false);

  const patch = (p: Partial<BBContestPrepConfig>) => setDraft(prev => ({ ...prev, ...p }));

  const validation = useMemo(() => validateBBContestPrepConfig(draft), [draft]);
  const effDraft = useMemo(() => {
    const v = validateBBContestPrepConfig(draft);
    return v.ok ? { ...draft, ...v.forced } : draft;
  }, [draft]);
  const result = useMemo(() => {
    try { return buildBBContestPrep(effDraft); } catch { return null; }
  }, [effDraft]);

  const autofillFromProfile = () => {
    try {
      const p = getProfile();
      const s = (p.settings || {}) as any;
      const w = Number(s.personal?.weight) || weight || 80;
      const sx: 'male' | 'female' = (s.personal?.sex === 'female' ? 'female' : 'male');
      const cat = String((s as any)?.goals?.bbCategory || '');
      const known = (sx === 'female' ? FEMALE_CATS : MALE_CATS).find(c => c === cat);
      patch({
        sex: sx,
        category: known ?? (sx === 'female' ? 'bikini' : 'mens_physique'),
        weightKg: Math.max(40, Math.min(200, w)),
        bodyFatPct: Number(s.personal?.bodyFat) > 0 ? Number(s.personal?.bodyFat) : undefined,
        allergens: Array.isArray(s.nutrition?.foodAllergies) ? s.nutrition.foodAllergies.filter((x: unknown): x is string => typeof x === 'string') : undefined,
      });
    } catch { /* ignore */ }
  };

  const flash = (fn: () => void) => { fn(); setSavedFlash(true); window.setTimeout(() => setSavedFlash(false), 1800); };

  const applyConfigured = () => {
    if (!validation.ok) return;
    applyBBPeakToPlan(effDraft);
  };
  const saveToProfile = () => {
    if (!validation.ok) return;
    setBBPrepConfig(effDraft);
    flash(() => {});
  };
  const removePrep = () => { applyBBPeakToPlan(null); setDraft(defaultConfig(sex, weight, bbCategory)); };

  const catsFor = draft.sex === 'female' ? FEMALE_CATS : MALE_CATS;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>🏁 Тапер ББ — пикинг к шоу</div>
      <div style={{ fontSize: 10, color: DIM, lineHeight: 1.5 }}>
        Единая система: тренировочный тапер (Библиотека методик) + пик-неделя 7 дней (еда/вода/натрий/позы).
        Кнопка «🏁 Применить тапер-план ББ» накладывает протокол на план питания по реальной дате шоу.
      </div>

      <GlassCard title="Атлет и тайминг" icon="👤" color={ACCENT}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div>
            <div style={LBL}>Пол</div>
            <select value={draft.sex} style={selectStyle} onChange={e => patch({ sex: e.target.value as any, category: (e.target.value === 'female' ? 'bikini' : 'mens_physique') })}>
              <option value="male">Мужской</option>
              <option value="female">Женский</option>
            </select>
          </div>
          <div>
            <div style={LBL}>Категория</div>
            <select value={draft.category} style={selectStyle} onChange={e => patch({ category: e.target.value as BBContestCategory })}>
              {catsFor.map(c => <option key={c} value={c}>{CONTEST_CATEGORY_LABELS[c]}</option>)}
            </select>
          </div>
          <div>
            <div style={LBL}>Вес тела (кг)</div>
            <input type="number" min={40} max={200} value={draft.weightKg} style={inputStyle} onChange={e => patch({ weightKg: Number(e.target.value) || 80 })} />
          </div>
          <div>
            <div style={LBL}>% жира сейчас</div>
            <input type="number" min={3} max={60} step={0.5} value={draft.bodyFatPct ?? ''} placeholder={`${bodyFatPct || '—'}`} style={inputStyle} onChange={e => patch({ bodyFatPct: e.target.value === '' ? undefined : Number(e.target.value) })} />
          </div>
          <div>
            <div style={LBL}>📅 Дата шоу</div>
            <input type="date" value={draft.showDate} style={inputStyle} onChange={e => patch({ showDate: e.target.value })} />
          </div>
          <div>
            <div style={LBL}>Уровень</div>
            <select value={draft.experienceLevel} style={selectStyle} onChange={e => patch({ experienceLevel: e.target.value as any })}>
              <option value="beginner">Новичок</option>
              <option value="intermediate">Средний</option>
              <option value="advanced">Продвинутый</option>
            </select>
          </div>
          <div>
            <div style={LBL}>Пройденных пиков</div>
            <input type="number" min={0} max={50} value={draft.prepCount} style={inputStyle} onChange={e => patch({ prepCount: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 10, color: DIM, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={draft.enhanced} onChange={e => patch({ enhanced: e.target.checked })} />
              💉 На курсе
            </label>
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Стратегии протокола" icon="🎯" color="#ec4899">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
          <div>
            <div style={LBL}>Тренировочный протокол (Библиотека методик)</div>
            <select value={draft.trainingProtocol} style={selectStyle} onChange={e => patch({ trainingProtocol: e.target.value as any })}>
              <option value="bb">Бодибилдинг (4 нед: наполнение → прорисовка → шоу)</option>
              <option value="classic">Классический WF (перегрузка → суперкомпенсация)</option>
              <option value="pl">Пауэрлифтинг (3 нед, интенсивность к 100%)</option>
            </select>
          </div>
          <div>
            <div style={LBL}>Недель тапера (накладывается на последние недели плана)</div>
            <select value={String(draft.weeksOut)} style={selectStyle} onChange={e => patch({ weeksOut: Number(e.target.value) })}>
              {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} недел{n === 1 ? 'я' : n < 4 ? 'и' : 'и'}</option>)}
            </select>
          </div>
          <div>
            <div style={LBL}>🍚 Карб-загрузка</div>
            <select value={draft.carbLoadStrategy} style={selectStyle} onChange={e => patch({ carbLoadStrategy: e.target.value as any })}>
              <option value="moderate">{STRATEGY_LABELS.moderate}</option>
              <option value="front">{STRATEGY_LABELS.front}</option>
              <option value="back">{STRATEGY_LABELS.back}</option>
            </select>
          </div>
          <div>
            <div style={LBL}>💧 Вода</div>
            <select value={draft.waterStrategy} style={selectStyle} onChange={e => patch({ waterStrategy: e.target.value as any })}>
              <option value="minimal">{STRATEGY_LABELS.minimal}</option>
              <option value="moderate">Moderate: мягкий cut</option>
              <option value="classic">{STRATEGY_LABELS.classic}</option>
            </select>
            <div style={{ fontSize: 9, color: DIM, marginTop: 2 }}>{WATER_HINTS[draft.waterStrategy]}</div>
          </div>
          <div>
            <div style={LBL}>🧂 Натрий</div>
            <select value={draft.sodiumStrategy} style={selectStyle} onChange={e => patch({ sodiumStrategy: e.target.value as any })}>
              <option value="constant">{STRATEGY_LABELS.constant}</option>
              <option value="cut_2d">{STRATEGY_LABELS.cut_2d}</option>
              <option value="cut_3d">{STRATEGY_LABELS.cut_3d}</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 10, color: DIM, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={!!draft.preferLowFiberCarbs} onChange={e => patch({ preferLowFiberCarbs: e.target.checked })} />
              Низковолокнистые карбс (рис/хлебцы)
            </label>
            <label style={{ fontSize: 10, color: DIM, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={draft.creatineStrategy === 'stop'} onChange={e => patch({ creatineStrategy: e.target.checked ? 'stop' : 'continue' })} />
              Прекратить креатин
            </label>
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Безопасность" icon="🛡" color="#60a5fa">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {['kidney', 'heart', 'hypertension'].map(id => (
            <label key={id} style={{ fontSize: 10, color: DIM, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="checkbox"
                checked={(draft.contraindications || []).includes(id)}
                onChange={e => patch({
                  contraindications: e.target.checked
                    ? [...(draft.contraindications || []), id]
                    : (draft.contraindications || []).filter(c => c !== id),
                })}
              />
              {id === 'kidney' ? 'Почки' : id === 'heart' ? 'Сердце' : 'Гипертония'}
            </label>
          ))}
        </div>
        {validation.warnings.length > 0 && (
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {validation.warnings.map((w, i) => (
              <div key={i} style={{ fontSize: 9, color: '#fbbf24', lineHeight: 1.4, padding: '4px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>{w}</div>
            ))}
          </div>
        )}
        {!validation.ok && (
          <div style={{ marginTop: 6, fontSize: 10, color: '#ef4444' }}>
            {validation.errors.map((e, i) => <div key={i}>✕ {e}</div>)}
          </div>
        )}
      </GlassCard>

      {result && (
        <>
          <div style={CARD}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>📊 Готовность</div>
            <div style={{ fontSize: 11, color: result.readiness.verdict === 'behind' ? '#f87171' : result.readiness.verdict === 'ahead' ? '#4ade80' : '#60a5fa', lineHeight: 1.5 }}>
              {result.readiness.note}
            </div>
          </div>

          <div style={CARD}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>📉 Тапер тренировок ({result.taper.length} нед)</div>
            {result.taper.map(t => (
              <div key={t.weekOffset} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 10 }}>
                <div>
                  <span style={{ fontWeight: 700, color: '#a855f7' }}>Нед {t.weekOffset}</span>
                  <span style={{ color: '#fff', marginLeft: 6 }}>{t.label}</span>
                  <div style={{ color: DIM, marginTop: 1 }}>{t.focus}</div>
                </div>
                <div style={{ textAlign: 'right', color: DIM }}>
                  <div>Объём <b style={{ color: '#a855f7' }}>{Math.round(t.volumePct * 100)}%</b></div>
                  <div>Вес <b style={{ color: '#a855f7' }}>{Math.round(t.intensityPct * 100)}%</b></div>
                  <div>RIR {t.rirMin}–{t.rirMax}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={CARD}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>🍚 Пик-неделя (7 дней) · шоу {draft.showDate}</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, minWidth: 460 }}>
                <thead>
                  <tr style={{ color: DIM, textAlign: 'left' }}>
                    <th style={{ padding: '3px 4px' }}>День</th>
                    <th style={{ padding: '3px 4px' }}>Фаза</th>
                    <th style={{ padding: '3px 4px', textAlign: 'right' }}>Ккал</th>
                    <th style={{ padding: '3px 4px', textAlign: 'right' }}>Б</th>
                    <th style={{ padding: '3px 4px', textAlign: 'right' }}>У</th>
                    <th style={{ padding: '3px 4px', textAlign: 'right' }}>Ж</th>
                    <th style={{ padding: '3px 4px', textAlign: 'right' }}>💧л</th>
                    <th style={{ padding: '3px 4px', textAlign: 'right' }}>Na мг</th>
                    <th style={{ padding: '3px 4px' }}>Тренировка</th>
                  </tr>
                </thead>
                <tbody>
                  {result.peakWeek.map(d => (
                    <tr key={d.day} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: d.day === 7 ? 'rgba(245,158,11,0.08)' : undefined }}>
                      <td style={{ padding: '3px 4px', fontWeight: 700, color: d.day === 7 ? ACCENT : '#fff' }}>{d.day === 7 ? '🎬' : `D-${7 - d.day}`}<div style={{ fontSize: 8, color: DIM, fontWeight: 400 }}>{d.date.slice(5).replace('-', '.')}</div></td>
                      <td style={{ padding: '3px 4px', color: '#ec4899' }}>{PHASE_LABELS_RU[d.phase]}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'right' }}>{d.kcal}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'right' }}>{d.proteinG}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'right' }}>{d.carbsG}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'right' }}>{d.fatG}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'right' }}>{d.waterLiters}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'right' }}>{d.sodiumMg}</td>
                      <td style={{ padding: '3px 4px', color: DIM }}>{d.training.type === 'Отдых' ? '—' : d.training.type.split(' ')[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 6, fontSize: 9, color: DIM }}>K {result.peakWeek[0]?.potassiumMg} мг — не снижается всю неделю. Белок {result.peakWeek[0]?.proteinG} г — постоянный.</div>
          </div>

          <div style={CARD}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>⏰ День шоу по часам (сцена {draft.schedule?.stage || '12:00'})</div>
            {result.showTimeline.map((t, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: 8, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 10 }}>
                <span style={{ color: ACCENT, fontWeight: 700 }}>{t.time}</span>
                <div>
                  <span style={{ color: '#fff', fontWeight: 600 }}>{t.action}</span>
                  <div style={{ color: DIM }}>{t.detail}</div>
                </div>
              </div>
            ))}
          </div>

          {result.warnings.length > 0 && (
            <div style={CARD}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#f87171', marginBottom: 4 }}>⚠ Предупреждения</div>
              {result.warnings.map((w, i) => <div key={i} style={{ fontSize: 9, color: '#f87171', lineHeight: 1.45, marginBottom: 2 }}>{w}</div>)}
            </div>
          )}
        </>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={autofillFromProfile} style={BTN_GHOST}>📋 Из профиля</button>
        <button disabled={!validation.ok} onClick={saveToProfile} style={{ ...BTN_GHOST, opacity: validation.ok ? 1 : 0.4 }}>
          {savedFlash ? '✅ Сохранено' : '💾 Сохранить в профиль'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button disabled={!validation.ok} onClick={applyConfigured} style={{ ...BTN_PRIMARY, opacity: validation.ok ? 1 : 0.45 }}>
          🏁 Применить тапер-план ББ
        </button>
        {bbPrepConfig && (
          <button onClick={removePrep} style={{ ...BTN_GHOST, borderColor: 'rgba(239,68,68,0.3)', color: '#f87171', flex: '0 0 auto', padding: '11px 14px' }}>🗑 Снять</button>
        )}
      </div>
      <div style={{ fontSize: 9, color: DIM, textAlign: 'center', paddingBottom: 4 }}>
        Применение накладывает протокол на план питания (вкладка «🥗 План») по реальной дате шоу
        и сохраняется в профиль — его же читает «🏆 Шоу ББ» и сборка ББ-плана.
      </div>
    </div>
  );
};

export default PeakWeekTab;
