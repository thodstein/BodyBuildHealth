import React, { useState, useMemo, useCallback } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { explainStack } from '../../engines/supplement-finder.engine';
import { SUPPORT_CATALOG_DATA } from '../../data/support-database';
import { GlassCard, StatBox, toFinderProfile, estCost } from './BioStackAIConstants';
import type { LinkedData } from '../../core/data-link';

export function ReportsTab({ profile, stackIds, linked }: { profile: BioStackProfile; stackIds: string[]; linked?: LinkedData }) {
  const [reports, setReports] = useState<{ date: string; text: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_biostack_reports') || '[]'); } catch { return []; }
  });
  const [currentReport, setCurrentReport] = useState<string>('');
  const [reportMode, setReportMode] = useState<'standard' | 'doctor' | 'schedule'>('standard');

  const timingInfo = useMemo(() => {
    if (stackIds.length === 0) return null;
    const byTime: Record<string, { id: string; name: string; dose: string; timing: string }[]> = { morning:[], afternoon:[], evening:[], night:[], fasting:[] };
    let totalCost = 0;
    stackIds.forEach(id => {
      const cat = SUPPORT_CATALOG_DATA[id];
      if (!cat) return;
      const name = cat.nameRu || cat.name || id;
      const dose = cat.dosage?.mg ? `${cat.dosage.mg} мг` : '';
      const timing = (cat.dosage as any)?.timing || (cat as any)?.timingDosage || '';
      totalCost += estCost(id);
      if (timing.toLowerCase().includes('утр')) byTime.morning.push({ id, name, dose, timing });
      else if (timing.toLowerCase().includes('дн') || timing.toLowerCase().includes('обед')) byTime.afternoon.push({ id, name, dose, timing });
      else if (timing.toLowerCase().includes('вечер') || timing.toLowerCase().includes('ноч')) byTime.evening.push({ id, name, dose, timing });
      else if (timing.toLowerCase().includes('нат') || timing.toLowerCase().includes('голод')) byTime.fasting.push({ id, name, dose, timing });
      else byTime.morning.push({ id, name, dose, timing });
    });
    return { byTime, totalCost };
  }, [stackIds]);

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

    // Organ mechanism grouping
    const organMechs = new Map<string, string[]>();
    stackIds.forEach(id => {
      const c = catData[id];
      if (!c) return;
      (c.mechanisms || []).forEach((m: string) => {
        const key = m.includes('LIVER') || m.includes('HEPAT') || m.includes('BILE') ? 'Печень'
          : m.includes('HEART') || m.includes('CARDIO') || m.includes('VESSEL') ? 'ССС'
          : m.includes('NEURO') || m.includes('GABA') || m.includes('DOPAMINE') || m.includes('COGNITIVE') || m.includes('MYELIN') ? 'Нервная'
          : m.includes('IMMUNE') || m.includes('NFKB') || m.includes('ANTIINFLAMMATORY') ? 'Иммунитет'
          : m.includes('ANTIOXIDANT') || m.includes('GLUTATHIONE') || m.includes('NRF2') ? 'Антиоксидантная'
          : m.includes('INSULIN') || m.includes('AMPK') || m.includes('MITOCHONDRIAL') || m.includes('GLUCOSE') || m.includes('LIPID') ? 'Метаболизм'
          : m.includes('TESTOSTERONE') || m.includes('AROMATASE') || m.includes('PROLACTIN') || m.includes('THYROID') || m.includes('ESTROGEN') ? 'Гормональная'
          : m.includes('MEMBRANE') || m.includes('PHOSPHOLIPID') ? 'Мембраны'
          : m.includes('DETOX') || m.includes('CYP450') || m.includes('PHASE_II') || m.includes('AMMONIA') ? 'Детоксикация'
          : m.includes('ADAPTOGEN') || m.includes('CORTISOL') || m.includes('STRESS') ? 'Адаптогены'
          : 'Прочие';
        if (!organMechs.has(key)) organMechs.set(key, []);
        if (!organMechs.get(key)!.includes(m)) organMechs.get(key)!.push(m);
      });
    });

    const compatScore = Math.max(0, Math.min(100,
      Math.round(synergyDensity * 0.7 + (expl.totalSynergyScore / 100) * 30 - warningsCount * 8)
    ));
    const riskLevel = warningsCount >= 5 ? 'HIGH' : warningsCount >= 2 ? 'MEDIUM' : 'LOW';

    return { ...expl, tiers, categories, synergyPairs, totalPairs, synergyDensity, compatScore, warningsCount, riskLevel, organMechs };
  }, [stackIds, profile]);

  const handleGenerate = useCallback(() => {
    if (!metrics || stackIds.length === 0) { setCurrentReport('❌ Стек пуст. Добавьте препараты через 🔍 Поиск или 🧩 Сборка.'); return; }
    const catData = SUPPORT_CATALOG_DATA;
    const date = new Date().toLocaleString('ru-RU');
    const totalCost = timingInfo?.totalCost || stackIds.reduce((s,id) => s+estCost(id), 0);

    if (reportMode === 'schedule') {
      const lines: string[] = [];
      lines.push('═══════════════════════════════════════════');
      lines.push('  ⏰ BioStack AI — График приёма');
      lines.push(`  📅 ${date}`);
      lines.push(`  📋 Компонентов: ${stackIds.length}`);
      lines.push('═══════════════════════════════════════════');
      lines.push('');
      if (timingInfo) {
        const timeLabels: Record<string, string> = { morning:'🌅 Утро', afternoon:'☀️ День', evening:'🌆 Вечер', night:'🌙 Ночь', fasting:'🍽 Натощак' };
        Object.entries(timeLabels).forEach(([key, label]) => {
          const items = timingInfo.byTime[key] || [];
          if (items.length === 0) return;
          lines.push(`${label}:`);
          items.forEach((it, i) => {
            const ci = catData[it.id];
            const warns: string[] = [];
            if (ci?.contraindications) warns.push(...ci.contraindications.slice(0, 2));
            lines.push(`  ${i+1}. ${it.name}${it.dose ? ` (${it.dose})` : ''}${warns.length > 0 ? ` ⚠ ${warns.join('; ')}` : ''}`);
          });
          lines.push('');
        });
      }
      lines.push(`💰 Ориентир. стоимость/мес: ${totalCost.toLocaleString()} ₽`);
      lines.push('');
      lines.push('💡 Рекомендации:');
      lines.push('  • Препараты с интервалом 30-60 мин от еды');
      lines.push('  • Жирорастворимые (D3, K2, A, E, CoQ10) — с жирной пищей');
      lines.push('  • Разделить Ca и Fe (интервал ≥2ч)');
      lines.push('  • Запивать водой, не чаем/кофе');
      if (metrics.warnings.length > 0) {
        lines.push('');
        lines.push('⚠ Предупреждения:');
        metrics.warnings.slice(0, 4).forEach(w => lines.push(`  • ${w}`));
      }
      const text = lines.join('\n');
      setCurrentReport(text);
      return;
    }

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
      lines.push(`  • Системы организма: ${(profile.targetSystems || []).join(', ') || '—'}`);
      lines.push(`  • Состояния: ${(profile.healthConditions || []).join(', ') || '—'}`);
      lines.push(`  • Принимаемые препараты: ${(profile.currentMeds || []).join(', ') || '—'}`);
      lines.push('');
      lines.push('💊 ТЕКУЩИЙ СТЕК ПОДДЕРЖКИ:');
      lines.push(`  Всего компонентов: ${stackIds.length}`);
      metrics.substances.forEach(s => {
        const cat = catData[s.id];
        const name = cat?.nameRu || cat?.name || s.name;
        const dose = s.dose || (cat?.dosage?.mg ? `${cat.dosage.mg} мг` : '—');
        const timing = cat?.dosage?.timing || (cat as any)?.timingDosage || '—';
        const tier = cat?.tier || '';
        lines.push(`  • ${name} [${tier}]`);
        lines.push(`    💊 Доза: ${dose} | ⏱ ${timing}`);
        lines.push(`    🧬 Мех-м: ${s.mechanism}`);
        if (cat?.organs && cat.organs.length > 0) lines.push(`    🫀 Органы: ${cat.organs.join(', ')}`);
        if (cat?.contraindications && cat.contraindications.length > 0) lines.push(`    ⛔ Противоп.: ${cat.contraindications.join('; ')}`);
        if (cat?.sideEffects && cat.sideEffects.length > 0) lines.push(`    ⚡ Побочные: ${cat.sideEffects.slice(0, 3).join(', ')}`);
      });
      lines.push('');
      lines.push('🔬 ПОКРЫТИЕ ПО ГРУППАМ:');
      if (metrics.organMechs) {
        metrics.organMechs.forEach((mechs, group) => {
          lines.push(`  • ${group}: ${mechs.length} мех.`);
        });
      }
      lines.push('');
      lines.push('🤝 МЕТРИКИ СОВМЕСТИМОСТИ:');
      const riskLabel = metrics.riskLevel === 'HIGH' ? '🔴 Высокий' : metrics.riskLevel === 'MEDIUM' ? '🟡 Средний' : '🟢 Низкий';
      lines.push(`  • Уровень риска: ${riskLabel}`);
      lines.push(`  • Совместимость стека: ${metrics.compatScore}/100`);
      lines.push(`  • Плотность синергий: ${metrics.synergyDensity}% (${metrics.synergyPairs}/${metrics.totalPairs} пар)`);
      lines.push(`  • Предупреждений: ${metrics.warningsCount}`);
      lines.push(`  • Ориентир. стоимость/мес: ${totalCost.toLocaleString()} ₽`);
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
      lines.push(`  • Core: ${metrics.tiers.core} • Standard: ${metrics.tiers.standard} • Advanced: ${metrics.tiers.advanced} • Specialty: ${metrics.tiers.specialty}`);
      lines.push('');
      lines.push('🕐 РЕКОМЕНДУЕМЫЙ ГРАФИК ПРИЁМА:');
      if (timingInfo) {
        const tl: Record<string, string> = { morning:'🌅 Утро', afternoon:'☀️ День', evening:'🌆 Вечер', night:'🌙 Ночь', fasting:'🍽 Натощак' };
        Object.entries(tl).forEach(([k, lb]) => {
          const its = timingInfo.byTime[k] || [];
          if (its.length > 0) lines.push(`  ${lb}: ${its.map(x => x.name + (x.dose ? ' ('+x.dose+')' : '')).join(', ')}`);
        });
      }
      lines.push('');
      lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      lines.push('  Сгенерировано BioStack AI — https://body-build-health.vercel.app');
      lines.push('  Данный отчёт не является медицинским заключением.');
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
    lines.push(`  💰 Стоимость/мес: ${totalCost.toLocaleString()} ₽`);
    const riskLabel = metrics.riskLevel === 'HIGH' ? '🔴 Высокий' : metrics.riskLevel === 'MEDIUM' ? '🟡 Средний' : '🟢 Низкий';
    lines.push(`  ⚠ Уровень риска: ${riskLabel}`);
    lines.push('═══════════════════════════════════════════');
    lines.push('');
    lines.push('📋 СОСТАВ СТЕКА:');
    metrics.substances.forEach(s => {
      const cat = catData[s.id];
      const name = cat?.nameRu || cat?.name || s.name;
      const dose = s.dose || (cat?.dosage?.mg ? `${cat.dosage.mg} мг${cat.dosage.timing ? ' — ' + cat.dosage.timing : ''}` : '—');
      const cost = estCost(s.id).toLocaleString();
      lines.push(`  • ${name} (${s.role}) [${cat?.tier || ''}] ~${cost}₽`);
      lines.push(`    🧬 ${s.mechanism}`);
      lines.push(`    💊 ${dose}`);
      if (cat?.organs && cat.organs.length > 0) lines.push(`    🫀 ${cat.organs.slice(0, 4).join(', ')}`);
      if (s.synergiesWith.length > 0) {
        lines.push(`    🤝 ${s.synergiesWith.map(x => x.with + ' → ' + x.effect).join(', ')}`);
      }
      if (cat?.contraindications && cat.contraindications.length > 0) {
        lines.push(`    ⛔ ${cat.contraindications.slice(0, 2).join('; ')}`);
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
    const titrationIds = ['ashwagandha', 'rhodiola', 'shilajit', 'berberine', 'tongkat_ali', 'fadogia', 'ashwa', 'probiotics', 'bromelain', 'serrapeptase', 'nattokinase'];
    const needTitration = stackIds.filter(id => titrationIds.some(t => id.toLowerCase().includes(t)));
    if (needTitration.length > 0) {
      lines.push('📈 ВЕЩЕСТВА, ТРЕБУЮЩИЕ ТИТРОВАНИЯ:');
      needTitration.forEach(id => {
        const cat = catData[id];
        lines.push(`  • ${cat?.nameRu || cat?.name || id}: Начать с ½ дозы, увеличивать каждые 3-4 дня на 25%.`);
      });
    }
    lines.push('');
    lines.push('🔬 ПОКРЫТИЕ ПО ГРУППАМ:');
    if (metrics.organMechs) {
      metrics.organMechs.forEach((mechs, group) => {
        lines.push(`  • ${group}: ${mechs.length} мех.`);
      });
    }
    lines.push('');
    lines.push('📊 РАСПРЕДЕЛЕНИЕ ПО ТИРАМ:');
    lines.push(`  • Core: ${metrics.tiers.core} • Standard: ${metrics.tiers.standard} • Advanced: ${metrics.tiers.advanced} • Specialty: ${metrics.tiers.specialty}`);
    lines.push('');
    lines.push('📊 КАТЕГОРИИ:');
    const cats = [...metrics.categories.entries()].sort((a,b) => b[1]-a[1]);
    cats.forEach(([cat, count]) => { if (count > 0) lines.push(`  • ${cat}: ${count}`); });
    lines.push('');
    lines.push('═══════════════════════════════════════════');
    const text = lines.join('\n');
    setCurrentReport(text);
  }, [metrics, stackIds, timingInfo]);

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
          {metrics && ` • Риск: ${metrics.riskLevel === 'HIGH' ? '🔴' : metrics.riskLevel === 'MEDIUM' ? '🟡' : '🟢'}`}
        </div>
        {metrics && (
          <>
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                <div style={{ width: metrics.compatScore + '%', height: '100%', borderRadius: 2, background: metrics.compatScore >= 70 ? '#00e68a' : metrics.compatScore >= 40 ? '#f59e0b' : '#ef4444', transition: 'width 0.3s' }} />
              </div>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                <div style={{ width: metrics.synergyDensity + '%', height: '100%', borderRadius: 2, background: metrics.synergyDensity >= 60 ? '#60a5fa' : metrics.synergyDensity >= 30 ? '#f59e0b' : '#ef4444', transition: 'width 0.3s' }} />
              </div>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                <div style={{ width: Math.min(metrics.completeness, 100) + '%', height: '100%', borderRadius: 2, background: metrics.completeness >= 80 ? '#a78bfa' : '#f59e0b', transition: 'width 0.3s' }} />
              </div>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                <div style={{ width: (metrics.totalDoseCount / Math.max(stackIds.length, 1)) * 100 + '%', height: '100%', borderRadius: 2, background: metrics.totalDoseCount === stackIds.length ? '#00e68a' : '#f59e0b', transition: 'width 0.3s' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 2, marginBottom: 6 }}>
              <StatBox label="Совместимость" value={`${metrics.compatScore}`} sub="из 100" color={metrics.compatScore >= 70 ? '#00e68a' : metrics.compatScore >= 40 ? '#f59e0b' : '#ef4444'} />
              <StatBox label="Синергии" value={`${metrics.synergyDensity}%`} sub={`${metrics.synergyPairs}/${metrics.totalPairs} пар`} color={metrics.synergyDensity >= 60 ? '#60a5fa' : '#f59e0b'} />
              <StatBox label="Тиры" value={`${metrics.tiers.core}/${metrics.tiers.standard}/${metrics.tiers.advanced}`} sub="core/std/adv" color="#a78bfa" />
            </div>
            {/* Cost breakdown bar */}
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', marginBottom: 3 }}>💰 Оценка стоимости/мес</div>
              <div style={{ display: 'flex', gap: 2 }}>
                {(() => {
                  const costTiers = [
                    { key: 'low', label: '~200 ₽', color: '#22c55e', count: metrics.tiers.core },
                    { key: 'medium', label: '~800 ₽', color: '#f59e0b', count: metrics.tiers.standard },
                    { key: 'high', label: '~2500 ₽', color: '#ef4444', count: metrics.tiers.advanced + metrics.tiers.specialty },
                  ];
                  const max = Math.max(1, ...costTiers.map(t => t.count));
                  return costTiers.map(t => (
                    <div key={t.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <span style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)' }}>{t.label}</span>
                      <div style={{ width: '100%', height: Math.max(2, (t.count / max) * 24), borderRadius: '2px 2px 0 0', background: t.color }} />
                      <span style={{ fontSize: 7, fontWeight: 600, color: t.color }}>{t.count}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </>
        )}
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          <button onClick={() => setReportMode('standard')} style={{
            flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer',
            background: reportMode === 'standard' ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${reportMode === 'standard' ? 'rgba(0,230,138,0.2)' : 'rgba(255,255,255,0.06)'}`,
            color: reportMode === 'standard' ? '#00e68a' : 'rgba(255,255,255,0.5)',
          }}>📄 Стандартный</button>
          <button onClick={() => setReportMode('schedule')} style={{
            flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer',
            background: reportMode === 'schedule' ? 'rgba(250,204,21,0.1)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${reportMode === 'schedule' ? 'rgba(250,204,21,0.2)' : 'rgba(255,255,255,0.06)'}`,
            color: reportMode === 'schedule' ? '#facc15' : 'rgba(255,255,255,0.5)',
          }}>⏰ График</button>
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
