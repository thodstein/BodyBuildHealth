import React, { useState, useMemo, useCallback } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { explainStack } from '../../engines/supplement-finder.engine';
import { SUPPORT_CATALOG_DATA } from '../../data/support-database';
import { GlassCard, toFinderProfile } from './BioStackAIConstants';

export function ReportsTab({ profile, stackIds }: { profile: BioStackProfile; stackIds: string[] }) {
  const [reports, setReports] = useState<{ date: string; text: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_biostack_reports') || '[]'); } catch { return []; }
  });
  const [currentReport, setCurrentReport] = useState<string>('');

  const explanation = useMemo(() => {
    if (stackIds.length === 0) return null;
    return explainStack(stackIds, toFinderProfile(profile));
  }, [stackIds, profile]);

  const handleGenerate = useCallback(() => {
    if (!explanation || stackIds.length === 0) { setCurrentReport('❌ Стек пуст. Добавьте препараты через 🔍 Поиск или 🧩 Сборка.'); return; }
    const catData = SUPPORT_CATALOG_DATA;
    const date = new Date().toLocaleString('ru-RU');
    const lines: string[] = [];
    lines.push('═══════════════════════════════════════════');
    lines.push(`  🧬 BioStack AI — Отчёт стека`);
    lines.push(`  📅 ${date}`);
    lines.push(`  📋 Компонентов: ${stackIds.length}`);
    lines.push(`  🎯 Синергия: ${explanation.totalSynergyScore}`);
    lines.push(`  📊 Покрытие: ${explanation.completeness}%`);
    lines.push(`  💊 С дозировкой: ${explanation.totalDoseCount}/${stackIds.length}`);
    lines.push('═══════════════════════════════════════════');
    lines.push('');
    lines.push('📋 СОСТАВ СТЕКА:');
    explanation.substances.forEach(s => {
      const cat = catData[s.id];
      const name = cat?.nameRu || cat?.name || s.name;
      const dose = s.dose || (cat?.dosage?.mg ? `${cat.dosage.mg} мг${cat.dosage.timing ? ' — ' + cat.dosage.timing : ''}` : '—');
      lines.push(`  • ${name} (${s.role})`);
      lines.push(`    🧬 ${s.mechanism}`);
      lines.push(`    💊 ${dose}`);
      if (s.synergiesWith.length > 0) {
        lines.push(`    🤝 Синергии: ${s.synergiesWith.map(x => x.with + ' → ' + x.effect).join(', ')}`);
      }
    });
    if (explanation.pairwiseSynergies.length > 0) {
      lines.push('');
      lines.push('🤝 ПАРНЫЕ СИНЕРГИИ:');
      explanation.pairwiseSynergies.forEach(p => {
        const na = catData[p.a]?.nameRu || catData[p.a]?.name || p.a;
        const nb = catData[p.b]?.nameRu || catData[p.b]?.name || p.b;
        lines.push(`  • ${na} + ${nb}: ${p.effect} (${p.severity})`);
      });
    }
    if (explanation.warnings.length > 0) {
      lines.push('');
      lines.push('⚠ ПРЕДУПРЕЖДЕНИЯ:');
      explanation.warnings.forEach(w => lines.push(`  • ${w}`));
    }
    lines.push('');
    lines.push('═══════════════════════════════════════════');
    const text = lines.join('\n');
    setCurrentReport(text);
  }, [explanation, stackIds]);

  const handleSave = useCallback(() => {
    if (!currentReport || currentReport.startsWith('❌')) return;
    const date = new Date().toLocaleString('ru-RU');
    const updated = [{ date, text: currentReport }, ...reports].slice(0, 20);
    localStorage.setItem('he_biostack_reports', JSON.stringify(updated));
    setReports(updated);
  }, [currentReport, reports]);

  const handleCopy = useCallback(() => {
    if (currentReport) navigator.clipboard.writeText(currentReport);
  }, [currentReport]);

  const handleDeleteReport = useCallback((idx: number) => {
    const updated = reports.filter((_, i) => i !== idx);
    localStorage.setItem('he_biostack_reports', JSON.stringify(updated));
    setReports(updated);
  }, [reports]);

  return (
    <div style={{ paddingBottom: 80 }}>
      <GlassCard title="📊 Генерация отчёта" icon="📄" color="#60a5fa">
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
          Стек: <strong>{stackIds.length} компонентов</strong>
          {explanation && ` • Синергия: ${explanation.totalSynergyScore} • Покрытие: ${explanation.completeness}%`}
        </div>
        <button onClick={handleGenerate} style={{
          width: '100%', padding: '10px 0', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: 'pointer', marginBottom: 6,
          background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa',
        }}>📄 Сгенерировать отчёт</button>
        {currentReport && (
          <>
            <div style={{
              padding: 10, borderRadius: 8, background: '#202023', border: '1px solid rgba(255,255,255,0.04)',
              fontSize: 8, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4, whiteSpace: 'pre-wrap',
              fontFamily: 'monospace', maxHeight: 300, overflowY: 'auto', marginBottom: 6,
            }}>{currentReport}</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={handleSave} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer',
                background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a',
              }}>💾 Сохранить</button>
              <button onClick={handleCopy} style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer',
                background: '#202023', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
              }}>📋</button>
            </div>
          </>
        )}
      </GlassCard>

      {reports.length > 0 && (
        <GlassCard title={`📂 Архив отчётов (${reports.length})`} icon="🗂" color="#8b5cf6">
          {reports.map((r, i) => (
            <div key={i} style={{
              padding: '8px 10px', marginBottom: 4, borderRadius: 8, cursor: 'pointer',
              background: currentReport === r.text ? 'rgba(139,92,246,0.06)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${currentReport === r.text ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)'}`,
            }}
              onClick={() => setCurrentReport(r.text)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 9, color: '#fff' }}>📄 {r.date}</span>
                <button onClick={e => { e.stopPropagation(); handleDeleteReport(i); }}
                  style={{ padding: '2px 6px', borderRadius: 4, fontSize: 7, cursor: 'pointer',
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                  ✕
                </button>
              </div>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.text.split('\n').slice(2, 5).join(' • ')}
              </div>
            </div>
          ))}
        </GlassCard>
      )}
    </div>
  );
}
