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
          🔗 Отправить все вещества пресета «{tpl?.name}» в план поддержки (белок/креатин/аминокислоты исключаются автоматически).
        </div>
        <button onClick={onPush} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: pushed ? 'rgba(0,230,138,0.9)' : 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>
          {pushed ? '✓ Добавлено в план поддержки' : '📋 В план поддержки'}
        </button>
      </div>
    </div>
  );
};

export default MixPresetsCard;
