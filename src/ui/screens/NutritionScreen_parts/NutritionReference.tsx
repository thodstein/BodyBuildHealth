import React, { useMemo, useState } from 'react';
import { FOOD_DB, calcBBQualityScore } from '../../../core/nutrition-database';
import { ModernHero, ModernPill, modernCardBg } from './nutrition-modern-kit';
import {
  NUTRITION_RULES,
  INSULIN_GUIDE,
  INSULIN_DISCLAIMER,
  RECOMMENDED_FOODS,
  FOOD_SYNERGIES,
  RESTRICTED,
  QUALITY_PROTEINS,
  QUALITY_CARBS,
  QUALITY_FATS,
  QUALITY_VEGGIES,
  RDA_ROWS,
  GI_ROWS,
  DIAAS_TIERS,
  SOURCES_FOOTER,
  type ReferenceRule,
} from './nutrition-reference-data';

const scoreColor = (s: number) => s >= 9 ? '#22c55e' : s >= 7 ? '#f59e0b' : s >= 5 ? '#f97316' : '#ef4444';

/** Живой скор из FOOD_DB по совпадению имени; null — показать fallback. */
function liveScoreFor(name: string): number | null {
  const q = name.toLowerCase().replace(/\(.*\)/, '').trim();
  const tokens = q.split(/[\s,]+/).filter(t => t.length > 2);
  const hit = FOOD_DB.find(f => {
    const n = f.name.toLowerCase();
    if (n === q || n.includes(q) || (q.length > 4 && n.includes(q.slice(0, 8)))) return true;
    const overlap = tokens.filter(t => n.includes(t)).length;
    return tokens.length >= 2 && overlap >= Math.min(2, tokens.length);
  });
  if (!hit) return null;
  const live = hit.bb_quality_score ?? calcBBQualityScore(hit);
  return Math.round(live * 10) / 10;
}

type GoalFilter = 'all' | 'mass' | 'cut' | 'health';

export const NutritionReference: React.FC = () => {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setOpenSections(prev => { const s = new Set(prev); if (s.has(k)) s.delete(k); else s.add(k); return s; });
  const [search, setSearch] = useState('');
  const [goal, setGoal] = useState<GoalFilter>('all');
  const [weight, setWeight] = useState('80');

  const counts = useMemo(() => ({
    rules: NUTRITION_RULES.length,
    synergy: FOOD_SYNERGIES.length,
    cats: Object.keys(RECOMMENDED_FOODS).length,
    insulin: INSULIN_GUIDE.length,
  }), []);

  const wKg = Math.max(40, Math.min(180, parseFloat((weight || '').replace(',', '.')) || 80));
  const protLow = Math.round(wKg * 1.6);
  const protHigh = Math.round(wKg * 2.2);
  const perMealLow = Math.round(wKg * 0.4);
  const perMealHigh = Math.round(wKg * 0.55);
  const waterLow = (wKg * 0.03).toFixed(1);
  const waterHigh = (wKg * 0.04).toFixed(1);

  const visibleRules = goal === 'all' ? NUTRITION_RULES : NUTRITION_RULES.filter(r => !r.goals || r.goals.includes(goal));

  const allSearchable = useMemo(() => [
    ...NUTRITION_RULES.map((r, i) => ({ kind: '📋', title: r.title, body: `${r.body}${r.dose ? ` · Норма: ${r.dose}` : ''}`, id: `r${i}` })),
    ...INSULIN_GUIDE.map((r, i) => ({ kind: '💉', title: r.title, body: r.body, id: `i${i}` })),
    ...FOOD_SYNERGIES.map((s, i) => ({ kind: '🍽', title: s.pair, body: `${s.effect}. ${s.note}`, id: `s${i}` })),
    ...RESTRICTED.map((r, i) => ({ kind: '⚠️', title: r.item, body: r.note, id: `re${i}` })),
    ...Object.entries(RECOMMENDED_FOODS).flatMap(([cat, v]) => v.items.map((it, j) => ({ kind: '🥗', title: it, body: `Категория: ${cat}`, id: `f${cat}${j}` }))),
    ...[...QUALITY_PROTEINS, ...QUALITY_CARBS, ...QUALITY_FATS, ...QUALITY_VEGGIES].map((q, i) => ({ kind: '⭐', title: q.name, body: `Оценка качества: ${q.score}/10`, id: `q${i}` })),
    ...RDA_ROWS.map((r, i) => ({ kind: '🧪', title: r.nutrient, body: `RDA: ${r.rda}. UL: ${r.ul}. ${r.note}`, id: `rda${i}` })),
    ...GI_ROWS.map((r, i) => ({ kind: '📊', title: r.food, body: `ГИ ${r.gi}. ${r.note}`, id: `gi${i}` })),
  ], []);

  const filtered = search.trim().length >= 2
    ? allSearchable.filter(item => {
        const q = search.toLowerCase();
        return item.title.toLowerCase().includes(q) || item.body.toLowerCase().includes(q);
      })
    : null;

  return (
    <div className="nut-ref" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <ModernHero icon="📖" title="Справочник питания" subtitle={`Правила (${counts.rules}), синергии (${counts.synergy}), категории продуктов (${counts.cats}), оценки качества и нормы — всё для осознанного питания. Поиск по всему контенту.`} stats={[
        { k: 'Правил', v: counts.rules, sub: 'питания', col: '#00e68a', bg: 'rgba(0,230,138,0.08)' },
        { k: 'Синергий', v: counts.synergy, sub: 'пар', col: '#a78bfa', bg: 'rgba(167,139,250,0.08)' },
        { k: 'Категорий', v: counts.cats, sub: 'продуктов', col: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
      ]} />

      {/* Единственный поиск (дубль удалён) */}
      <div style={{ ...modernCardBg, padding: 12 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Поиск по правилам, синергиям, продуктам, нормам…"
          aria-label="Поиск по справочнику"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: '#202023', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box', boxShadow: search ? '0 0 0 1px rgba(0,230,138,0.3)' : 'none' }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {([['all', 'Все'], ['mass', 'Масса'], ['cut', 'Сушка'], ['health', 'Здоровье']] as [GoalFilter, string][]).map(([v, label]) => (
            <ModernPill key={v} active={goal === v} onClick={() => setGoal(v)}>{label}</ModernPill>
          ))}
        </div>
      </div>

      {filtered && filtered.length > 0 && (
        <div style={{ padding: '6px 8px', borderRadius: 10, background: '#202023', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 4 }}>
          <div style={{ fontSize: 12, color: '#fff', marginBottom: 4, fontWeight: 600 }}>Результатов: {filtered.length}</div>
          {filtered.slice(0, 30).map(item => (
            <div key={item.id} style={{ padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: 12, lineHeight: 1.5 }}>
              <span style={{ color: '#00e68a', fontWeight: 700 }}>{item.kind} {item.title}</span>
              <div style={{ color: '#fff', marginTop: 1 }}>{item.body.slice(0, 220)}</div>
            </div>
          ))}
          {filtered.length > 30 && <div style={{ fontSize: 11, color: '#fff', textAlign: 'center', padding: 4 }}>…и ещё {filtered.length - 30} результатов</div>}
        </div>
      )}

      {filtered && filtered.length === 0 && (
        <div style={{ padding: 14, borderRadius: 10, background: '#202023', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center', fontSize: 12, color: '#fff' }}>Ничего не найдено. Попробуйте другой запрос.</div>
      )}

      {!search && (
        <>
      <SectionCard title={`🧮 Мои нормы (вес ${wKg} кг)`} isOpen={openSections.has('calc')} onToggle={() => toggle('calc')}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: '#fff' }}>Вес, кг:</span>
          <input value={weight} onChange={e => setWeight(e.target.value)} inputMode="decimal" aria-label="Вес для расчёта норм" style={{ width: 80, padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: '#202023', color: '#fff', fontSize: 13 }} />
        </div>
        <div style={{ fontSize: 12, color: '#fff', lineHeight: 1.7 }}>
          <div>🥩 Белок: <b>{protLow}–{protHigh} г/сут</b> (1.6–2.2 г/кг)</div>
          <div>🍽 На приём: <b>{perMealLow}–{perMealHigh} г</b> (0.4–0.55 г/кг ×4+)</div>
          <div>💧 Вода: <b>{waterLow}–{waterHigh} л/сут</b> (30–40 мл/кг + 0.5–1 л/ч тренировки)</div>
          <div>🌾 Клетчатка: <b>≥25 г/сут</b> (ориентир 14 г/1000 ккал)</div>
          <div>💊 Креатин: <b>3–5 г/день</b> (моногидрат, с едой)</div>
        </div>
        <div style={{ fontSize: 10, color: '#fff', marginTop: 4 }}>Формулы из правил выше (ISSN 2017; EFSA). На дефиците — верхний край белка.</div>
      </SectionCard>

      <SectionCard title={`📋 Правила питания (${visibleRules.length})`} isOpen={openSections.has('rules')} onToggle={() => toggle('rules')}>
        {goal !== 'all' && <div style={{ fontSize: 10, color: '#fff', marginBottom: 4 }}>Фильтр: {goal === 'mass' ? 'Масса' : goal === 'cut' ? 'Сушка' : 'Здоровье'} — общие правила + релевантные.</div>}
        {visibleRules.map((r, i) => <RuleItem key={i} rule={r} />)}
      </SectionCard>

      <SectionCard title={`💉 Инсулин: harm-reduction (${INSULIN_GUIDE.length})`} isOpen={openSections.has('insulin')} onToggle={() => toggle('insulin')} color="#ef4444">
        <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 11, color: '#fff', lineHeight: 1.6 }}>
          ⚠️ {INSULIN_DISCLAIMER}
        </div>
        {INSULIN_GUIDE.map((r, i) => <RuleItem key={i} rule={r} />)}
      </SectionCard>

      <SectionCard title={`🍽 Рекомендуемые продукты (${counts.cats} категорий)`} isOpen={openSections.has('foods')} onToggle={() => toggle('foods')}>
        {Object.entries(RECOMMENDED_FOODS).map(([cat, { items, color, bg }]) => (
          <div key={cat} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 4, letterSpacing: 0.3 }}>{cat}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {items.map((item, j) => (
                <span key={j} style={{ padding: '3px 8px', borderRadius: 12, fontSize: 10, background: bg, color, border: `1px solid ${color}20`, whiteSpace: 'nowrap' }}>{item}</span>
              ))}
            </div>
          </div>
        ))}
      </SectionCard>

      <SectionCard title="⭐ Качество продуктов (живой скор из базы)" isOpen={openSections.has('qpro')} onToggle={() => toggle('qpro')}>
        <div style={{ fontSize: 10, color: '#fff', marginBottom: 4 }}>Скор подтягивается из FOOD_DB (bb_quality_score), статичное число — только если продукт не найден в базе.</div>
        <ScoreSection label={`Белки (${QUALITY_PROTEINS.length})`} color="#3b82f6" items={QUALITY_PROTEINS} />
      </SectionCard>

      <SectionCard title="⭐ Качество продуктов — углеводы" isOpen={openSections.has('qcar')} onToggle={() => toggle('qcar')}>
        <ScoreSection label={`Углеводы (${QUALITY_CARBS.length})`} color="#f97316" items={QUALITY_CARBS} />
      </SectionCard>

      <SectionCard title="⭐ Качество продуктов — жиры" isOpen={openSections.has('qfat')} onToggle={() => toggle('qfat')}>
        <ScoreSection label={`Жиры (${QUALITY_FATS.length})`} color="#f59e0b" items={QUALITY_FATS} />
      </SectionCard>

      <SectionCard title="⭐ Качество продуктов — овощи и зелень" isOpen={openSections.has('qveg')} onToggle={() => toggle('qveg')}>
        <ScoreSection label={`Овощи/зелень (${QUALITY_VEGGIES.length})`} color="#22c55e" items={QUALITY_VEGGIES} />
      </SectionCard>

      <SectionCard title="🧪 Микронутриенты: RDA и верхние уровни" isOpen={openSections.has('rda')} onToggle={() => toggle('rda')}>
        <div style={{ fontSize: 10, color: '#fff', marginBottom: 4 }}>Ориентиры EFSA/IOM. Не назначение — сверяться с анализами и врачом.</div>
        {RDA_ROWS.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, fontSize: 11, color: '#fff', lineHeight: 1.5, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', flexWrap: 'wrap' }}>
            <b style={{ minWidth: 130 }}>{r.nutrient}</b>
            <span>RDA: {r.rda}</span>
            <span>UL: {r.ul}</span>
            <span style={{ flexBasis: '100%' }}>{r.note}</span>
          </div>
        ))}
      </SectionCard>

      <SectionCard title="📊 ГИ-ориентиры и качество белка" isOpen={openSections.has('gi')} onToggle={() => toggle('gi')}>
        {GI_ROWS.map((r, i) => (
          <div key={i} style={{ fontSize: 11, color: '#fff', lineHeight: 1.5, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <b>{r.food}</b> — ГИ {r.gi}. {r.note}
          </div>
        ))}
        <div style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6', margin: '8px 0 4px' }}>DIAAS (FAO 2013) — тиры</div>
        {DIAAS_TIERS.map((t, i) => (
          <div key={i} style={{ fontSize: 11, color: '#fff', lineHeight: 1.5, padding: '4px 0' }}>
            <b>{t.tier}:</b> {t.examples}. {t.note}
          </div>
        ))}
      </SectionCard>

      <SectionCard title={`🍽 Сочетаемость продуктов (${FOOD_SYNERGIES.length} пар)`} isOpen={openSections.has('synergy')} onToggle={() => toggle('synergy')}>
        {FOOD_SYNERGIES.map((p, j) => {
          const typeColor = p.type === 'synergy' ? '#22c55e' : p.type === 'conflict' ? '#ef4444' : '#f59e0b';
          const typeIcon = p.type === 'synergy' ? '⊕' : p.type === 'conflict' ? '⊖' : '○';
          const bg = p.type === 'synergy' ? 'rgba(34,197,94,0.06)' : p.type === 'conflict' ? 'rgba(239,68,68,0.05)' : 'rgba(245,158,11,0.05)';
          return (
            <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '4px 6px', background: bg, borderRadius: 8, marginBottom: 3, border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ minWidth: 20, height: 20, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: typeColor + '15', color: typeColor, fontWeight: 800, fontSize: 12 }}>{typeIcon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{p.pair}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: typeColor, background: typeColor + '12', padding: '2px 6px', borderRadius: 6, whiteSpace: 'nowrap' }}>{p.effect}</span>
                  {p.inV2 && <span style={{ fontSize: 9, color: '#00e68a', border: '1px solid rgba(0,230,138,0.3)', padding: '2px 6px', borderRadius: 6 }}>учтено в v2-скоринге</span>}
                </div>
                <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.5 }}>{p.note}</div>
              </div>
            </div>
          );
        })}
      </SectionCard>

      <SectionCard title={`⚠️ Ограничить (${RESTRICTED.length} пунктов)`} isOpen={openSections.has('restricted')} onToggle={() => toggle('restricted')} color="#ef4444">
        {RESTRICTED.map((w, j) => (
          <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: '#fff', lineHeight: 1.5, marginBottom: 4, padding: '4px 8px', borderRadius: 8, background: 'rgba(239,68,68,0.03)' }}>
            <span style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }}>✕</span>
            <div>
              <span style={{ fontWeight: 600, color: '#ef4444' }}>{w.item}</span>
              <span style={{ color: '#fff', marginLeft: 2 }}>— {w.note}</span>
            </div>
          </div>
        ))}
      </SectionCard>

      <SectionCard title="📚 Источники" isOpen={openSections.has('sources')} onToggle={() => toggle('sources')}>
        {SOURCES_FOOTER.map((s, i) => (
          <div key={i} style={{ fontSize: 10, color: '#fff', lineHeight: 1.6, padding: '2px 0' }}>• {s}</div>
        ))}
        <div style={{ fontSize: 10, color: '#fff', marginTop: 4 }}>Контент обновлён: 2026. Числа — ориентиры из указанных источников, не медицинские назначения.</div>
      </SectionCard>

        </>
      )}

    </div>
  );
};

const SectionCard: React.FC<{ title: string; isOpen: boolean; onToggle: () => void; color?: string; children: React.ReactNode }> = ({ title, isOpen, onToggle, color, children }) => (
  <div style={{ ...modernCardBg, padding: 12, border: isOpen ? `1px solid ${color || '#00e68a'}18` : '1px solid rgba(255,255,255,0.06)', background: isOpen ? `${color || '#00e68a'}06` : '#18181b' }}>
    <button onClick={onToggle} style={{ width: '100%', padding: '8px 10px', cursor: 'pointer', background: isOpen ? `${color || '#00e68a'}10` : 'rgba(255,255,255,0.02)', border: '1px solid transparent', borderRadius: 10, color: color || '#fff', fontWeight: 700, fontSize: 13, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 22, height: 22, borderRadius: 8, background: isOpen ? (color || '#00e68a') + '18' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', color: isOpen ? (color || '#00e68a') : '#fff' }}>›</span>
      {title}
      <span style={{ marginLeft: 'auto', fontSize: 9, padding: '2px 6px', borderRadius: 999, background: isOpen ? (color || '#00e68a') + '14' : 'rgba(255,255,255,0.04)', color: isOpen ? (color || '#00e68a') : '#fff', border: `1px solid ${isOpen ? (color || '#00e68a') + '20' : 'rgba(255,255,255,0.06)'}` }}>{isOpen ? '▲' : '▼'}</span>
    </button>
    {isOpen && <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>}
  </div>
);

const RuleItem: React.FC<{ rule: ReferenceRule }> = ({ rule }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: expanded ? `1px solid ${rule.color}20` : '1px solid rgba(255,255,255,0.06)', background: expanded ? `${rule.color}08` : '#202023', boxShadow: expanded ? `0 4px 12px ${rule.color}10` : 'none' }}>
      <button onClick={() => setExpanded(!expanded)} style={{ width: '100%', padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: expanded ? `${rule.color}12` : 'transparent', border: 'none', color: '#fff', textAlign: 'left', fontSize: 12, fontWeight: 600 }}>
        <span style={{ width: 24, height: 24, borderRadius: 8, background: expanded ? rule.color + '20' : 'rgba(255,255,255,0.06)', color: expanded ? rule.color : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', border: `1px solid ${expanded ? rule.color + '30' : 'rgba(255,255,255,0.06)'}` }}>›</span>
        <span style={{ flex: 1 }}>{rule.title}</span>
        <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 999, background: expanded ? rule.color + '14' : 'rgba(255,255,255,0.04)', color: expanded ? rule.color : '#fff', border: `1px solid ${expanded ? rule.color + '20' : 'rgba(255,255,255,0.06)'}` }}>{expanded ? 'Свернуть' : 'Подробнее'}</span>
      </button>
      {expanded && (
        <div style={{ padding: '10px 12px 12px 44px', fontSize: 11, color: '#fff', lineHeight: 1.6, borderTop: `1px solid ${rule.color}12`, background: 'rgba(0,0,0,0.12)' }}>
          <div>{rule.body}</div>
          {rule.dose && <div style={{ marginTop: 6 }}><span style={{ fontWeight: 700, color: rule.color }}>Норма: </span>{rule.dose}</div>}
          {rule.source && <div style={{ marginTop: 4, fontSize: 10 }}>Источник: {rule.source}</div>}
        </div>
      )}
    </div>
  );
};

const ScoreSection: React.FC<{ label: string; color: string; items: { name: string; score: number }[] }> = ({ label, color, items }) => (
  <>
    <h5 style={{ margin: '6px 0 4px', fontSize: 12, color, letterSpacing: 0.3 }}>{label}</h5>
    {items.map((p, j) => {
      const live = liveScoreFor(p.name);
      const shown = live ?? p.score;
      return (
        <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <div style={{ minWidth: 44, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: scoreColor(shown) + '15', color: scoreColor(shown), fontWeight: 800, fontSize: 10 }}>{shown}/10</div>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{p.name}</span>
          {live != null && <span style={{ fontSize: 9, color: '#00e68a' }}>· из базы</span>}
        </div>
      );
    })}
  </>
);
