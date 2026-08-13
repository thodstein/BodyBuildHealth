/** MixPresetsCard.tsx — Пресеты здоровья (тренировочные миксы оздоровительной направленности).
 *  Калькулятор-карточка в зоне «Интеллект тренировки»: 7 готовых составов pre/intra/post
 *  (жиросжигание, суставы, ЖКТ, сон, гидратация, противовоспалительный, иммунитет).
 *  REUSE: training-mix-scoring.engine (MIX_TEMPLATES, getDefaultTemplate, resolveTemplateItems),
 *  support-plan-bridge (pushSubsToPlan), training-profile, TrainingPopups (PopupNumber). */
import React, { useState, useMemo } from 'react';
import {
  MIX_TEMPLATES, resolveTemplateItems, type MixTemplate, type MixRenderItem,
} from '../../../engines/training-mix-scoring.engine';
import { loadTrainingProfile } from './training-profile';
import { pushSubsToPlan } from './support-plan-bridge';
import { PopupNumber } from '../SRCBBScreen_parts/TrainingPopups';
import {
  saveMixToDiaryAndFavorites, queueMixToSupportPlan,
  type SaveMixResult, type PlanSubstance,
} from '../../../engines/training-plan-save.engine';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
const CARD: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 };
const H: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: ACCENT, margin: '0 0 8px' };

const TIMING_RU: Record<string, string> = { pre: 'До тренировки', intra: 'Во время', post: 'После' };

/** ID пресетов здоровья (в порядке из MIX_TEMPLATES). */
const HEALTH_GOALS = ['fat_loss', 'joint', 'gut', 'sleep', 'hydration', 'antiinflammatory', 'immunity'];

export const MixPresetsCard: React.FC = () => {
  const prof = useMemo(() => loadTrainingProfile(), []);
  const [goal, setGoal] = useState<string>('fat_loss');
  const [bwInput, setBwInput] = useState<number>(prof.bodyWeight || 80);
  const [mult, setMult] = useState<number>(1);
  const [pushed, setPushed] = useState(false);
  const [savePopup, setSavePopup] = useState<{ step: 'confirm' | 'done'; toPlan: boolean; result: SaveMixResult | null } | null>(null);

  // только пресеты здоровья, по id (goal у antiinflammatory/immunity совпадает — ловим по id)
  const tpls: MixTemplate[] = useMemo(
    () => HEALTH_GOALS.map(id => MIX_TEMPLATES.find(t => t.id === id)).filter(Boolean) as MixTemplate[],
    [],
  );
  const tpl = useMemo(() => tpls.find(t => t.id === goal) || tpls[0], [tpls, goal]);

  const phases = useMemo(() => {
    if (!tpl) return null;
    return {
      pre: resolveTemplateItems(tpl.pre, mult, bwInput),
      intra: resolveTemplateItems(tpl.intra, mult, bwInput),
      post: resolveTemplateItems(tpl.post, mult, bwInput),
    };
  }, [tpl, mult, bwInput]);

  const allIds = useMemo(() => {
    if (!phases) return [] as string[];
    return (['pre', 'intra', 'post'] as const).flatMap(t => phases[t].map(r => r.id)).filter(Boolean);
  }, [phases]);

  const planSubstances: PlanSubstance[] = useMemo(() => {
    if (!phases) return [] as PlanSubstance[];
    return (['pre', 'intra', 'post'] as const).flatMap(t =>
      phases[t].map(r => ({
        id: r.id, name: r.name, dose: String(r.dose ?? ''), unit: r.unit || 'мг', mg: r.mg, note: r.note, timing: t,
      })),
    );
  }, [phases]);

  const presetTitle = tpl ? tpl.name.replace(/^[^\s]+\s/, '') : goal;

  const chip = (active: boolean) => ({
    padding: '6px 10px', borderRadius: 10, cursor: 'pointer', fontSize: 10, fontWeight: 700,
    background: active ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.04)',
    border: active ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.08)',
    color: active ? ACCENT : 'rgba(255,255,255,0.7)', transition: 'all 0.15s', textAlign: 'center' as const,
  });

  const onPush = () => {
    const n = pushSubsToPlan(allIds, 'mix', `Микс: ${tpl?.name || goal}`);
    if (n > 0) { setPushed(true); setTimeout(() => setPushed(false), 1800); }
    else alert('Все вещества микса относятся к питанию (белок/креатин/аминокислоты) — в план поддержки не добавлены.');
  };

  const Item: React.FC<{ r: MixRenderItem }> = ({ r }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div>
        <div style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>{r.name}</div>
        <div style={{ fontSize: 10, color: DIM }}>{r.note}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 11, color: ACCENT, fontWeight: 700 }}>{r.dose}{r.unit}</div>
        <div style={{ fontSize: 10, color: DIM }}>{r.mg >= 1000 ? (r.mg / 1000).toFixed(1) + 'г' : r.mg + 'мг'}</div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={H}>🧪 Пресеты здоровья (тренировочные миксы)</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 10 }}>
        Готовые составы pre/intra/post: жиросжигание, суставы, ЖКТ, сон, гидратация, противовоспалительный, иммунитет. Выберите цель, подгоните вес и множитель дозы.
      </div>

      <div style={CARD}>
        <div style={H}>🎯 Цель пресета</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
          {tpls.map(t => {
            const label = t.name.replace(/^[^\s]+\s/, ''); // убрать эмодзи-префикс
            return <div key={t.id} onClick={() => setGoal(t.id)} style={chip(goal === t.id)}>{label}</div>;
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <PopupNumber label="⚖️ Вес тела" value={bwInput} min={30} max={250} suffix=" кг" onChange={setBwInput} />
          <PopupNumber label="Множитель дозы" value={mult} min={0.5} max={2} step={0.1} suffix="×" onChange={setMult} />
        </div>
      </div>

      {tpl && phases && (
        <div style={CARD}>
          <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, margin: '0 0 4px' }}>{tpl.name}</div>
          <div style={{ fontSize: 10, color: DIM, marginBottom: 8 }}>{tpl.description}</div>
          {(['pre', 'intra', 'post'] as const).map(t => {
            const items = phases[t];
            if (!items || items.length === 0) return null;
            return (
              <div key={t} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, margin: '6px 0 4px' }}>⏱️ {TIMING_RU[t]} ({items.length})</div>
                {items.map((r, i) => <Item key={i} r={r} />)}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>
          Сохранение пресета: запись в дневник тренировок + вещества в избранное БАД + рекомендации. Также можно отправить все вещества пресета «{presetTitle}» напрямую в план поддержки.
        </div>
        <button onClick={() => { if (planSubstances.length > 0) setSavePopup({ step: 'confirm', toPlan: false, result: null }); }}
          style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44, marginBottom: 8 }}>
          💾 Сохранить в дневник и избранное
        </button>
        <button onClick={onPush} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: pushed ? 'rgba(0,230,138,0.9)' : 'linear-gradient(135deg,#8b5cf6,#7c3aed)', color: '#fff', fontWeight: 800, fontSize: 13, minHeight: 44 }}>
          {pushed ? '✓ Добавлено в план поддержки' : '📋 В план поддержки'}
        </button>
      </div>

      {savePopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 16 }} onClick={e => { if (e.target === e.currentTarget && savePopup.step === 'done') setSavePopup(null); }}>
          <div style={{ maxWidth: 420, width: '100%', background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}>
            {savePopup.step === 'confirm' ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 10 }}>💾 Сохранение пресета «{presetTitle}»</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: 'rgba(255,255,255,0.85)', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}><span>📓</span><span><b>Дневник тренировок</b> — запись с составом ({planSubstances.length} веществ) и дозами.</span></div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: 'rgba(255,255,255,0.85)', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}><span>⭐</span><span><b>Избранное БАД</b> — добавятся вещества набора (без дублей).</span></div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: 'rgba(255,255,255,0.85)', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}><span>💊</span><span><b>Рекомендации</b> — анализ препаратов: дозы, предупреждения, мониторинг, конфликты. Сохранятся в избранном БАД.</span></div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '10px 0', padding: 10, borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)', cursor: 'pointer', fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
                  <input type="checkbox" checked={savePopup.toPlan} onChange={e => setSavePopup(prev => prev ? { ...prev, toPlan: e.target.checked } : prev)} style={{ marginTop: 2 }} />
                  <span>🧮 <b>Внести в план поддержки</b> — вещества попадут в калькулятор поддержки: расчёт рисков, дозировок и карточка «Тренировочные миксы и пресеты здоровья».</span>
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setSavePopup(null)} style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.75)', minHeight: 44 }}>Отмена</button>
                  <button onClick={() => {
                    try {
                      const input = {
                        title: `Пресет: ${presetTitle}`,
                        kind: 'preset' as const,
                        goal,
                        score: undefined as number | undefined,
                        label: undefined as string | undefined,
                        weightKg: bwInput,
                        substances: planSubstances,
                      };
                      const result = saveMixToDiaryAndFavorites(input);
                      if (savePopup.toPlan) queueMixToSupportPlan(result.rec);
                      setSavePopup({ step: 'done', toPlan: savePopup.toPlan, result });
                    } catch { /* ignore */ }
                  }} style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', minHeight: 44 }}>Сохранить</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#00e68a', marginBottom: 10 }}>✅ Сохранено</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: 'rgba(255,255,255,0.85)', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}><span>📓</span><span>Запись «{presetTitle}» добавлена в <b>дневник тренировок</b> ({planSubstances.length} веществ).</span></div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: 'rgba(255,255,255,0.85)', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}><span>⭐</span><span>В <b>избранное БАД</b> добавлено{savePopup.result && savePopup.result.addedFavCount > 0 ? ` новых веществ: +${savePopup.result.addedFavCount}` : ' новых веществ: 0 (уже в избранном)'}.</span></div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: 'rgba(255,255,255,0.85)', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}><span>💊</span><span><b>Рекомендации сохранены</b>: {savePopup.result ? savePopup.result.rec.substances.length : 0} препаратов проанализировано.</span></div>
                {savePopup.toPlan && <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: 'rgba(255,255,255,0.85)', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}><span>🧮</span><span>Внесено в <b>план поддержки</b> — карточка «Тренировочные миксы и пресеты здоровья» в калькуляторе.</span></div>}
                <button onClick={() => setSavePopup(null)} style={{ marginTop: 12, width: '100%', padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', minHeight: 44 }}>Готово</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MixPresetsCard;
