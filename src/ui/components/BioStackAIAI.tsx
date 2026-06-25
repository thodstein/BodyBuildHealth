import React, { useState, useMemo, useCallback } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { explainStack, buildStack, findReplacement } from '../../engines/supplement-finder.engine';
import { SUPPORT_CATALOG_DATA, ALL_INTERACTIONS } from '../../data/support-database';
import { GlassCard, toFinderProfile } from './BioStackAIConstants';

export function AITab({ profile, stackIds, setStackIds }: { profile: BioStackProfile; stackIds: string[]; setStackIds: (ids: string[]) => void }) {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const explanation = useMemo(() => {
    if (stackIds.length === 0) return null;
    return explainStack(stackIds, toFinderProfile(profile));
  }, [stackIds, profile]);

  const actions: { id: string; icon: string; label: string; desc: string; color: string }[] = [
    { id: 'why_worse', icon: '🤔', label: 'Почему мне хуже?', desc: 'Анализ возможных причин ухудшения самочувствия на текущем стеке', color: '#ef4444' },
    { id: 'optimize', icon: '⚡', label: 'Оптимизировать стек', desc: 'Улучшить синергию, покрытие целей и убрать лишние компоненты', color: '#8b5cf6' },
    { id: 'best_stack', icon: '🏆', label: 'Собрать лучший стек', desc: 'Построить оптимальный стек с нуля под ваш профиль и цели', color: '#00e68a' },
    { id: 'cheaper', icon: '💰', label: 'Сделать дешевле', desc: 'Заменить дорогие компоненты на более бюджетные аналоги', color: '#f59e0b' },
    { id: 'remove_risks', icon: '🛡️', label: 'Убрать риски', desc: 'Выявить и предложить замены для опасных комбинаций', color: '#60a5fa' },
  ];

  const handleAction = useCallback((actionId: string) => {
    setLoading(actionId);
    setResult(null);
    setTimeout(() => {
      const catData = SUPPORT_CATALOG_DATA;
      switch (actionId) {
        case 'why_worse': {
          if (!explanation || stackIds.length === 0) {
            setResult('❌ Стек пуст. Добавьте препараты.');
            break;
          }
          const lines: string[] = ['🤔 Анализ ухудшения самочувствия', ''];
          const conflicts: string[] = [];
          for (let i = 0; i < stackIds.length; i++) {
            for (let j = i + 1; j < stackIds.length; j++) {
              const idA = stackIds[i], idB = stackIds[j];
              const pair = ALL_INTERACTIONS.filter(inx =>
                (inx.substanceA === idA && inx.substanceB === idB) ||
                (inx.substanceA === idB && inx.substanceB === idA));
              pair.forEach(p => {
                if (p.type === 'conflict' || p.type === 'caution') {
                  const na = catData[idA]?.nameRu || catData[idA]?.name || idA;
                  const nb = catData[idB]?.nameRu || catData[idB]?.name || idB;
                  conflicts.push(`• ${na} + ${nb}: ${p.effect} (${p.severity === 'HIGH' ? '🔴' : '🟡'} ${p.severity})`);
                }
              });
            }
          }
          if (conflicts.length > 0) {
            lines.push('🚫 Конфликты в стеке:');
            lines.push(...conflicts);
          } else {
            lines.push('✅ Конфликтов не обнаружено');
          }
          if (explanation.warnings.length > 0) {
            lines.push('');
            lines.push('⚠ Системные предупреждения:');
            explanation.warnings.slice(0, 5).forEach(w => lines.push(`• ${w}`));
          }
          if (stackIds.length > 12) {
            lines.push('');
            lines.push(`📏 Стек большой (${stackIds.length} шт). Возможна перегрузка ЖКТ и печени.`);
          }
          lines.push('');
          lines.push('💡 Рекомендация: используйте ⚡ Оптимизировать стек для уменьшения нагрузки.');
          setResult(lines.join('\n'));
          break;
        }
        case 'optimize': {
          if (stackIds.length === 0) { setResult('❌ Стек пуст'); break; }
          const fp = toFinderProfile(profile);
          const opt = buildStack({
            baseIds: stackIds, targetSize: Math.max(stackIds.length, 8),
            goal: profile.goals[0] || undefined,
            autoFill: true, profile: fp,
          });
          const optExp = explainStack(opt.stack, fp);
          const lines: string[] = [
            '⚡ Оптимизированный стек',
            `📊 ${stackIds.length} → ${opt.stack.length} компонентов`,
            `🤝 Синергия: ${explanation?.totalSynergyScore ?? 0} → ${optExp.totalSynergyScore}`,
            `📊 Покрытие: ${explanation?.completeness ?? 0}% → ${optExp.completeness}%`,
            '',
            '📋 Состав:',
          ];
          optExp.substances.forEach(s => lines.push(`• ${s.name} — ${s.role}`));
          if (optExp.warnings.length > 0) {
            lines.push('', '⚠ Предупреждения:');
            optExp.warnings.slice(0, 3).forEach(w => lines.push(`• ${w}`));
          }
          lines.push('', '💾 Нажмите «Заменить стек» ниже, чтобы применить.');
          setResult(lines.join('\n'));
          break;
        }
        case 'best_stack': {
          const fp = toFinderProfile(profile);
          const best = buildStack({
            baseIds: stackIds, targetSize: 10,
            goal: profile.goals[0] || undefined,
            autoFill: true, profile: fp,
          });
          const bestExp = explainStack(best.stack, fp);
          const lines: string[] = [
            '🏆 Лучший стек для вашего профиля',
            `📊 ${best.stack.length} компонентов | 🤝 Синергия: ${bestExp.totalSynergyScore} | 📊 Покрытие: ${bestExp.completeness}%`,
            '',
            '📋 Состав:',
          ];
          bestExp.substances.forEach(s => {
            const cat = catData[s.id];
            const dose = s.dose || (cat?.dosage?.mg ? `${cat.dosage.mg} мг` : '');
            lines.push(`• ${s.name} — ${s.role}${dose ? ' | 💊 ' + dose : ''}`);
          });
          bestExp.substances.forEach(s => {
            const syns = s.synergiesWith.slice(0, 3);
            if (syns.length > 0) {
              lines.push(`  🤝 ${syns.map(x => x.with + ' → ' + x.effect).join(', ')}`);
            }
          });
          if (bestExp.warnings.length > 0) {
            lines.push('', '⚠ Предупреждения:');
            bestExp.warnings.slice(0, 3).forEach(w => lines.push(`• ${w}`));
          }
          setResult(lines.join('\n'));
          break;
        }
        case 'cheaper': {
          if (stackIds.length === 0) { setResult('❌ Стек пуст'); break; }
          const lines: string[] = ['💰 Оптимизация бюджета', ''];
          let found = false;
          stackIds.forEach(id => {
            const replacements = findReplacement(id, 'cheaper', toFinderProfile(profile));
            if (replacements.length > 0) {
              const r = replacements[0];
              const cat = catData[id];
              const name = cat?.nameRu || cat?.name || id;
              lines.push(`• ${name} → ${r.replacementName} (${r.priceDelta === 'cheaper' ? '💰 Дешевле' : '💰 ∼'})`);
              lines.push(`  ${r.reason}`);
              found = true;
            }
          });
          if (!found) lines.push('✅ Нет доступных бюджетных замен');
          lines.push('', '💡 Замены можно применить в 📋 Мой стек через 🔄 Заменить.');
          setResult(lines.join('\n'));
          break;
        }
        case 'remove_risks': {
          if (stackIds.length < 2) { setResult('❌ В стеке менее 2 препаратов, нет пар для анализа.'); break; }
          const lines: string[] = ['🛡️ Анализ и устранение рисков', ''];
          let riskCount = 0;
          for (let i = 0; i < stackIds.length; i++) {
            for (let j = i + 1; j < stackIds.length; j++) {
              const idA = stackIds[i], idB = stackIds[j];
              const pair = ALL_INTERACTIONS.filter(inx =>
                (inx.substanceA === idA && inx.substanceB === idB) ||
                (inx.substanceA === idB && inx.substanceB === idA));
              pair.forEach(p => {
                if (p.severity === 'HIGH' && p.type !== 'synergy') {
                  const na = catData[idA]?.nameRu || catData[idA]?.name || idA;
                  const nb = catData[idB]?.nameRu || catData[idB]?.name || idB;
                  lines.push(`🔴 ${na} + ${nb}: ${p.effect}`);
                  const replace = findReplacement(idA, 'safer', toFinderProfile(profile));
                  if (replace.length > 0) {
                    lines.push(`   → Замена: ${replace[0].replacementName}`);
                  }
                  riskCount++;
                }
              });
            }
          }
          if (riskCount === 0) lines.push('✅ Критических рисков не обнаружено');
          lines.push('', '💡 Для замен используйте 🔄 в 📋 Мой стек.');
          setResult(lines.join('\n'));
          break;
        }
        default: setResult('Неизвестное действие');
      }
      setLoading(null);
    }, 400);
  }, [explanation, stackIds, profile]);

  const handleApplyStack = useCallback(() => {
    if (!result) return;
    try {
      const catData = SUPPORT_CATALOG_DATA;
      const substLines = result.split('\n').filter(l => l.startsWith('• '));
      const ids: string[] = [];
      substLines.forEach(l => {
        const name = l.replace('• ', '').split(' — ')[0].trim();
        const entry = Object.entries(catData).find(([_, v]) => v.nameRu === name || v.name === name);
        if (entry) ids.push(entry[0]);
      });
      if (ids.length > 0) setStackIds(ids);
    } catch { /* ignore */ }
  }, [result, setStackIds]);

  return (
    <div style={{ paddingBottom: 80 }}>
      <GlassCard title="🧠 AI-ассистент стека" icon="🤖" color="#8b5cf6">
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
          Стек: <strong>{stackIds.length} компонентов</strong>
          {explanation && ` • Синергия: ${explanation.totalSynergyScore}`}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {actions.map(a => (
            <button key={a.id} onClick={() => handleAction(a.id)} disabled={loading !== null} style={{
              padding: '10px 8px', borderRadius: 10, cursor: loading === a.id ? 'wait' : 'pointer',
              background: loading === a.id ? `${a.color}12` : 'rgba(255,255,255,0.02)',
              border: `1px solid ${loading === a.id ? `${a.color}30` : 'rgba(255,255,255,0.06)'}`,
              transition: 'all 0.2s',
            }}>
              <div style={{ fontSize: 18, marginBottom: 2 }}>{loading === a.id ? '⏳' : a.icon}</div>
              <div style={{ fontSize: 9, fontWeight: 600, color: '#fff' }}>{a.label}</div>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', lineHeight: 1.2, marginTop: 2 }}>{a.desc}</div>
            </button>
          ))}
        </div>
      </GlassCard>

      {loading && (
        <div style={{ textAlign: 'center', padding: 12 }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>⏳ Анализ...</div>
        </div>
      )}

      {result && !loading && (
        <GlassCard title="📋 Результат" icon="💡" color="#00e68a">
          <div style={{
            padding: 10, borderRadius: 8, background: '#202023', border: '1px solid rgba(255,255,255,0.04)',
            fontSize: 8, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4, whiteSpace: 'pre-wrap',
            fontFamily: 'monospace', maxHeight: 350, overflowY: 'auto', marginBottom: 6,
          }}>{result}</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => navigator.clipboard.writeText(result)} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer',
              background: '#202023', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
            }}>📋 Копировать</button>
            {(result.includes('Оптимизированный') || result.includes('Лучший стек')) && (
              <button onClick={handleApplyStack} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer',
                background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a',
              }}>📥 Применить стек</button>
            )}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
