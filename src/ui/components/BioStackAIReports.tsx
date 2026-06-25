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
  const [reportMode, setReportMode] = useState<'standard' | 'doctor'>('standard');

  // ── Compatibility metrics ──
  const metrics = useMemo(() => {
    if (stackIds.length === 0) return null;
    const catData = SUPPORT_CATALOG_DATA;
    const expl = explainStack(stackIds, toFinderProfile(profile));
    const tiers = { core: 0, standard: 0, advanced: 0, specialty: 0 };
    const categories = new Map<string, number>();
    stackIds.forEach(id => {
      const c = catData[id];
      if (!c) return;
      if (c.tier && tiers[c.tier as keyof typeof tiers] !== undefined) tiers[c.tier as keyof typeof tiers]++;
      (c.category || []).forEach(cat => categories.set(cat, (categories.get(cat) || 0) + 1));
    });
    const synergyPairs = expl.pairwiseSynergies.filter(p => p.severity !== 'LOW' && p.severity !== 'none').length;
    const totalPairs = (stackIds.length * (stackIds.length - 1)) / 2;
    const synergyDensity = totalPairs > 0 ? Math.round(synergyPairs / totalPairs * 100) : 0;
    const warningsCount = expl.warnings.length;
    // compatibility score: 0-100 based on synergy density, warnings penalty
    const compatScore = Math.max(0, Math.min(100,
      Math.round(synergyDensity * 0.7 + (expl.totalSynergyScore / 100) * 30 - warningsCount * 8)
    ));
    return { ...expl, tiers, categories, synergyPairs, totalPairs, synergyDensity, compatScore, warningsCount };
  }, [stackIds, profile]);

  const handleGenerate = useCallback(() => {
    if (!metrics || stackIds.length === 0) { setCurrentReport('❌ Стек пуст. Добавьте препараты через 🔍 Поиск или 🧩 Сборка.'); return; }
    const catData = SUPPORT_CATALOG_DATA;
    const date = new Date().toLocaleString('ru-RU');

    if (reportMode === 'doctor') {
      const lines: string[] = [];
      lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      lines.push('  📋 ОТЧЁТ ДЛЯ ВРАЧА');
      lines.push('  BioStack AI — сводка текущей фармакологической поддержки');
      lines.push(`  📅 ${date}`);
      lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      lines.push('');
      lines.push('👤 ПРОФИЛЬ ПАЦИЕНТА:');
      lines.push(`  • Возраст: ${profile.age || '—'}`);
      lines.push(`  • Пол: ${profile.sex === 'male' ? 'Мужской' : profile.sex === 'female' ? 'Женский' : '—'}`);
      lines.push(`  • Вес: ${profile.weight || '—'} кг • Рост: ${profile.height || '—'} см`);
      lines.push(`  • Стаж: ${profile.experience || '—'} лет`);
      lines.push(`  • Цели: ${(profile.goals || []).filter(Boolean).join(', ') || '—'}`);
      lines.push('');
      lines.push('💊 ТЕКУЩИЙ СТЕК ПОДДЕРЖКИ:');
      lines.push(`  Всего компонентов: ${stackIds.length}`);
      metrics.substances.forEach(s => {
        const cat = catData[s.id];
        const name = cat?.nameRu || cat?.name || s.name;
        const dose = s.dose || (cat?.dosage?.mg ? `${cat.dosage.mg} мг` : '—');
        const timing = cat?.dosage?.timing || (cat as any)?.timingDosage || '—';
        lines.push(`  • ${name}`);
        lines.push(`    💊 Дозировка: ${dose}`);
        lines.push(`    ⏱ Приём: ${timing}`);
        lines.push(`    🧬 Механизм: ${s.mechanism}`);
        if (cat?.organs && cat.organs.length > 0) lines.push(`    🫀 Органы-мишени: ${cat.organs.join(', ')}`);
      });
      lines.push('');
      lines.push('🤝 МЕТРИКИ СОВМЕСТИМОСТИ:');
      lines.push(`  • Совместимость стека: ${metrics.compatScore}/100`);
      lines.push(`  • Плотность синергий: ${metrics.synergyDensity}% (${metrics.synergyPairs}/${metrics.totalPairs} пар)`);
      lines.push(`  • Предупреждений: ${metrics.warningsCount}`);
      lines.push('');
      lines.push('⚕️ КЛИНИЧЕСКИ ЗНАЧИМЫЕ ВЗАИМОДЕЙСТВИЯ:');
      const warnings = metrics.warnings || [];
      if (warnings.length > 0) {
        warnings.forEach(w => lines.push(`  ⚠ ${w}`));
      } else {
        lines.push('  ✅ Критических взаимодействий не выявлено');
      }
      lines.push('');
      lines.push('📊 ПОКАЗАТЕЛИ СТЕКА:');
      lines.push(`  • Интегральная синергия: ${metrics.totalSynergyScore}`);
      lines.push(`  • Покрытие целей: ${metrics.completeness}%`);
      lines.push(`  • Дозировки указаны: ${metrics.totalDoseCount}/${stackIds.length}`);
      lines.push(`  • Core-препаратов: ${metrics.tiers.core} • Standard: ${metrics.tiers.standard} • Advanced: ${metrics.tiers.advanced}`);
      lines.push('');
      lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      lines.push('  Сгенерировано BioStack AI — https://body-build-health.vercel.app');
      lines.push('  Данный отчёт не является медицинским заключением.');
      lines.push('  Проконсультируйтесь с врачом перед приёмом любых БАД.');
      const text = lines.join('\n');
      setCurrentReport(text);
      return;
    }

    const lines: string[] = [];
    lines.push('═══════════════════════════════════════════');
    lines.push(`  🧬 BioStack AI — Отчёт стека`);
    lines.push(`  📅 ${date}`);
    lines.push(`  📋 Компонентов: ${stackIds.length}`);
    lines.push(`  🎯 Синергия: ${metrics.totalSynergyScore}`);
    lines.push(`  📊 Покрытие: ${metrics.completeness}%`);
    lines.push(`  💊 С дозировкой: ${metrics.totalDoseCount}/${stackIds.length}`);
    lines.push(`  🤝 Совместимость: ${metrics.compatScore}/100`);
    lines.push(`  🔗 Плотность синергий: ${metrics.synergyDensity}% (${metrics.synergyPairs}/${metrics.totalPairs})`);
    lines.push('═══════════════════════════════════════════');
    lines.push('');
    lines.push('📋 СОСТАВ СТЕКА:');
    metrics.substances.forEach(s => {
      const cat = catData[s.id];
      const name = cat?.nameRu || cat?.name || s.name;
      const dose = s.dose || (cat?.dosage?.mg ? `${cat.dosage.mg} мг${cat.dosage.timing ? ' — ' + cat.dosage.timing : ''}` : '—');
      lines.push(`  • ${name} (${s.role}) [${cat?.tier || ''}]`);
      lines.push(`    🧬 ${s.mechanism}`);
      lines.push(`    💊 ${dose}`);
      if (s.synergiesWith.length > 0) {
        lines.push(`    🤝 Синергии: ${s.synergiesWith.map(x => x.with + ' → ' + x.effect).join(', ')}`);
      }
    });
    if (metrics.pairwiseSynergies.length > 0) {
      lines.push('');
      lines.push('🤝 ПАРНЫЕ СИНЕРГИИ:');
      metrics.pairwiseSynergies.forEach(p => {
        const na = catData[p.a]?.nameRu || catData[p.a]?.name || p.a;
        const nb = catData[p.b]?.nameRu || catData[p.b]?.name || p.b;
        lines.push(`  • ${na} + ${nb}: ${p.effect} (${p.severity})`);
      });
    }
    if (metrics.warnings.length > 0) {
      lines.push('');
      lines.push('⚠ ПРЕДУПРЕЖДЕНИЯ:');
      metrics.warnings.forEach(w => lines.push(`  • ${w}`));
    }
    lines.push('');
    lines.push('📊 РАСПРЕДЕЛЕНИЕ ПО ТИРАМ:');
    lines.push(`  • Core: ${metrics.tiers.core} • Standard: ${metrics.tiers.standard} • Advanced: ${metrics.tiers.advanced} • Specialty: ${metrics.tiers.specialty}`);
    lines.push('');
    lines.push('═══════════════════════════════════════════');
    const text = lines.join('\n');
    setCurrentReport(text);
  }, [metrics, stackIds]);

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
          {metrics && ` • Синергия: ${metrics.totalSynergyScore} • Покрытие: ${metrics.completeness}%`}
          {metrics && ` • Совместимость: ${metrics.compatScore}/100`}
        </div>
        {metrics && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ width: metrics.compatScore + '%', height: '100%', borderRadius: 2,
                background: metrics.compatScore >= 70 ? '#00e68a' : metrics.compatScore >= 40 ? '#f59e0b' : '#ef4444', transition: 'width 0.3s' }} />
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          <button onClick={() => setReportMode('standard')} style={{
            flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer',
            background: reportMode === 'standard' ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${reportMode === 'standard' ? 'rgba(0,230,138,0.2)' : 'rgba(255,255,255,0.06)'}`,
            color: reportMode === 'standard' ? '#00e68a' : 'rgba(255,255,255,0.5)',
          }}>📄 Стандартный</button>
          <button onClick={() => setReportMode('doctor')} style={{
            flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer',
            background: reportMode === 'doctor' ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${reportMode === 'doctor' ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.06)'}`,
            color: reportMode === 'doctor' ? '#8b5cf6' : 'rgba(255,255,255,0.5)',
          }}>🩺 К врачу</button>
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
