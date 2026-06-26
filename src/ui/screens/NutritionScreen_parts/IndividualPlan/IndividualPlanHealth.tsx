import React from 'react';
import { usePlanCtx } from './IndividualPlanContext';
import { HEALTH_ISSUES, ALLERGEN_LIST } from './types';
import { FOOD_DB } from '../../../../core/nutrition-database';
import { CHRONIC_CONDITIONS_LIST } from '../../../../core/contraindications';

const FOOD_NAME_OVERRIDES: Record<string, string> = {
  salt: 'Соль', soy_sauce: 'Соевый соус', kfc_wings: 'KFC крылья',
  bread_white: 'Белый хлеб', pasta: 'Макароны', milk: 'Молоко',
  cheese: 'Сыр', yogurt: 'Йогурт', rice_white: 'Белый рис',
  liver: 'Печень', spinach: 'Шпинат', broccoli: 'Брокколи',
  cabbage: 'Капуста', beans: 'Фасоль', lentils: 'Чечевица',
  sugar: 'Сахар', honey: 'Мёд', chocolate: 'Шоколад',
};

const getFoodName = (fid: string): string => {
  if (FOOD_NAME_OVERRIDES[fid]) return FOOD_NAME_OVERRIDES[fid];
  const fromDb = FOOD_DB.find(f => f.id === fid);
  return fromDb?.name || fid.replace(/_/g, ' ');
};

export const IndividualPlanHealth: React.FC = () => {
  const ctx = usePlanCtx();
  const dayPlan = ctx.dayPlan;

  const activeIssues = HEALTH_ISSUES.filter(h => ctx.healthIssues?.includes(h.id));
  const activeAllergens = ALLERGEN_LIST.filter(a => ctx.allergens?.includes(a.id));

  const planFoodIds = new Set<string>();
  if (dayPlan?.meals) {
    dayPlan.meals.forEach((m: any) => {
      m.items?.forEach((it: any) => planFoodIds.add(it.id));
    });
  }
  const hasPlan = planFoodIds.size > 0;

  const getConflicts = (foodIds: string[]) => {
    return foodIds.filter(fid => planFoodIds.has(fid)).map(fid => getFoodName(fid));
  };

  const totalExcluded = [...new Set(activeIssues.flatMap(h => h.foodIds))].length;

  const getIssueCompliance = (issue: typeof HEALTH_ISSUES[0]) => {
    const conflicts = getConflicts(issue.foodIds);
    if (!hasPlan) return { status: 'info', label: 'Нет плана' };
    if (conflicts.length === 0) return { status: 'ok', label: '✓ Нет нарушений' };
    return { status: 'warn', label: `⚠ ${conflicts.length} наруш.` };
  };

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Health issue cards */}
      <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', marginBottom: 8 }}>🩺 Ограничения здоровья</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {HEALTH_ISSUES.map(h => {
            const isActive = ctx.healthIssues?.includes(h.id);
            const compliance = getIssueCompliance(h);
            const statusColor = compliance.status === 'ok' ? '#22c55e' : compliance.status === 'warn' ? '#ef4444' : '#a78bfa';
            return (
              <div key={h.id} style={{
                padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                background: isActive ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isActive ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)'}`,
              }} onClick={() => {
                const current = ctx.healthIssues || [];
                const next = isActive ? current.filter(x => x !== h.id) : [...current, h.id];
                ctx.setHealthIssues?.(next);
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 14 }}>{h.icon}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: isActive ? '#8b5cf6' : 'rgba(255,255,255,0.7)' }}>{h.label}</span>
                    <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>· {h.foodIds.length} продуктов</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {hasPlan && isActive && (
                      <span style={{ fontSize: 8, fontWeight: 700, color: statusColor }}>{compliance.label}</span>
                    )}
                    <span style={{ fontSize: 9, color: isActive ? '#8b5cf6' : 'rgba(255,255,255,0.2)' }}>{isActive ? '✓' : '+'}</span>
                  </div>
                </div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginTop: 2, lineHeight: 1.3 }}>{h.desc}</div>
                {isActive && (
                  <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {h.foodIds.slice(0, 8).map(fid => {
                      const inPlan = planFoodIds.has(fid);
                      return (
                        <span key={fid} style={{
                          fontSize: 6, padding: '1px 4px', borderRadius: 3,
                          background: inPlan ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                          color: inPlan ? '#ef4444' : 'rgba(255,255,255,0.4)',
                          textDecoration: inPlan ? 'line-through' : 'none',
                        }}>{getFoodName(fid)}</span>
                      );
                    })}
                    {h.foodIds.length > 8 && <span style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)', padding: '1px 4px' }}>+{h.foodIds.length - 8}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Allergens */}
      <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 8 }}>⚠️ Аллергены</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {ALLERGEN_LIST.map(a => {
            const isActive = ctx.allergens?.includes(a.id);
            return (
              <button key={a.id} onClick={() => {
                const current = ctx.allergens || [];
                const next = isActive ? current.filter(x => x !== a.id) : [...current, a.id];
                ctx.setAllergens?.(next);
              }} style={{
                padding: '4px 8px', borderRadius: 12, fontSize: 8, cursor: 'pointer', fontWeight: 600,
                background: isActive ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isActive ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)'}`,
                color: isActive ? '#f59e0b' : 'rgba(255,255,255,0.6)',
              }}>{a.icon} {a.label}</button>
            );
          })}
        </div>
      </div>

      {/* Plan compliance */}
      {hasPlan && (
        <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', marginBottom: 8 }}>✅ Соответствие текущего плана</div>
          {activeIssues.length === 0 ? (
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', padding: '6px 0' }}>Нет активных ограничений здоровья.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {activeIssues.map(h => {
                const conflicts = getConflicts(h.foodIds);
                return (
                  <div key={h.id} style={{
                    padding: '6px 8px', borderRadius: 8,
                    background: conflicts.length === 0 ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
                    border: `1px solid ${conflicts.length === 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: conflicts.length > 0 ? 4 : 0 }}>
                      <span style={{ fontSize: 9, fontWeight: 600, color: conflicts.length === 0 ? '#22c55e' : '#ef4444' }}>
                        {h.icon} {h.label}
                      </span>
                      <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>
                        {h.foodIds.length} зонтировано, {conflicts.length} в плане
                      </span>
                    </div>
                    {conflicts.length > 0 && (
                      <div style={{ fontSize: 7, color: '#ef4444', lineHeight: 1.4 }}>
                        ⚠ В плане есть: {conflicts.join(', ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      {activeIssues.length > 0 && (
        <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.1)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 8 }}>📋 Рекомендации</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 8, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
            {activeIssues.map(h => {
              const tips: Record<string, string> = {
                oedema: '⬇ Натрий: уберите соль, соусы, колбасы. ⬆ Калий: зелень, авокадо, батат.',
                lactose_intolerance: '⬇ Лактоза: замените молоко на безлактозное, сыр на тофу. Фермент лактаза +.',
                gluten_intolerance: '⬇ Глютен: замените пшеницу на рис, гречку, киноа. Чистые овёс (без клейковины).',
                diabetes: '⬇ GI: исключите сахар, белый рис, хлеб. ⬆ Клетчатка, белок, низкие GI (гречка, чечевица). Ужин низкоуглеводный.',
                hypertension: '⬇ Натрий <1500 мг/сут. ⬆ Калий, магний. Исключите фастфуд, консервы, сыр, колбасы.',
                gi_issues: '⬆ Термически обработанные овощи. ⬇ Сырые овощи, бобовые, молочка, жареное. Дробное питание.',
                gout: '⬇ Пурины: ограничьте печень, красное мясо, сардины, пиво. ⬆ Вода 2-3л. Молочные продукты снижают уровень МК.',
                kidney_stones: '⬇ Оксалаты: шпинат, свёкла, орехи, шоколад. ⬆ Вода 2.5-3л. Лимонная вода ингибирует камни.',
              };
              return (
                <div key={h.id} style={{ padding: '4px 0' }}>
                  <span style={{ fontWeight: 600, color: '#a78bfa' }}>{h.icon} {h.label}:</span>{' '}
                  {tips[h.id] || 'Соблюдайте диетические рекомендации вашего врача.'}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary */}
      <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', marginBottom: 8 }}>📊 Сводка</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.1)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#8b5cf6' }}>{activeIssues.length}</div>
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)' }}>Активных проблем</div>
          </div>
          <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.1)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#f59e0b' }}>{activeAllergens.length}</div>
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)' }}>Активных аллергенов</div>
          </div>
          <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.1)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#00e68a' }}>{totalExcluded}</div>
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)' }}>Исключено продуктов</div>
          </div>
          <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.1)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#f97316' }}>{(ctx.budget === 'low' ? '❌ Низкое' : ctx.budget === 'medium' ? '⚖️ Среднее' : ctx.budget === 'max' ? '⭐ Хорошее' : '💎 Отличное')}</div>
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)' }}>Качество продуктов</div>
          </div>
        </div>
      </div>
    </div>
  );
};
