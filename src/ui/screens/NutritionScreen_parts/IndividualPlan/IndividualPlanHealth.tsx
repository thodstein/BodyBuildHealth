import React from 'react';
import { usePlanCtx } from './IndividualPlanContext';
import { HEALTH_ISSUES, ALLERGEN_LIST } from './types';
import { CHRONIC_CONDITIONS_LIST } from '../../../../core/contraindications';

export const IndividualPlanHealth: React.FC = () => {
  const ctx = usePlanCtx();

  const activeIssues = HEALTH_ISSUES.filter(h => ctx.healthIssues?.includes(h.id));
  const activeAllergens = ALLERGEN_LIST.filter(a => ctx.allergens?.includes(a.id));

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Health restrictions */}
      <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', marginBottom: 8 }}>🩺 Активные ограничения здоровья</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {HEALTH_ISSUES.map(h => {
            const isActive = ctx.healthIssues?.includes(h.id);
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
                  <span style={{ fontSize: 9, color: isActive ? '#8b5cf6' : 'rgba(255,255,255,0.2)' }}>{isActive ? '✓' : '+'}</span>
                </div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginTop: 2, lineHeight: 1.3 }}>{h.desc}</div>
                {isActive && (
                  <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {h.foodIds.slice(0, 8).map(fid => (
                      <span key={fid} style={{ fontSize: 6, padding: '1px 4px', borderRadius: 3, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{fid.replace(/_/g, ' ')}</span>
                    ))}
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

      {/* Summary */}
      <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
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
            <div style={{ fontSize: 16, fontWeight: 800, color: '#00e68a' }}>{[...new Set(activeIssues.flatMap(h => h.foodIds))].length}</div>
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
