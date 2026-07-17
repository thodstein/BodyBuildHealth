import React, { useMemo, useState } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { explainStack } from '../../engines/supplement-finder.engine';
import { selectStack } from '../../engines/biostack-clinical-v2.engine';
import { SUPPORT_CATALOG_DATA } from '../../data/support-database';
import { toFinderProfile, GlassCard, showToast } from './BioStackAIConstants';
import type { LinkedData } from '../../core/data-link';

function estCost(id: string): number {
  const e = SUPPORT_CATALOG_DATA[id];
  const price = (e as any)?.priceRub ?? (e as any)?.price ?? 0;
  return typeof price === 'number' ? price : 0;
}
function name(id: string): string { const e = SUPPORT_CATALOG_DATA[id]; return e?.nameRu || e?.name || id; }

export function ExportTab({ profile, stackIds, setStackIds, linked }: { profile: BioStackProfile; stackIds: string[]; setStackIds: (ids: string[]) => void; linked?: LinkedData }) {
  const [copied, setCopied] = useState(false);

  const exportText = useMemo(() => {
    if (stackIds.length === 0) return '';
    const exp = explainStack(stackIds, toFinderProfile(profile));
    const lab = linked?.labAnalysis || null;
    const safety = selectStack(stackIds, profile, 'comprehensive', lab);
    const total = stackIds.reduce((s, id) => s + estCost(id), 0);
    const L: string[] = [];
    L.push(`💊 БИОСТАК — ПЛАН ПОДДЕРЖКИ`);
    L.push(`Дата: ${new Date().toLocaleDateString('ru-RU')}`);
    L.push(`Профиль: уровень ${profile.experience || '—'} · системы: ${(profile.targetSystems || []).join(', ') || '—'}`);
    if (profile.healthConditions?.length) L.push(`Здоровье: ${profile.healthConditions.join(', ')}`);
    L.push(``);
    L.push(`📋 СОСТАВ (${stackIds.length} в-в, ~${total}₽/мес):`);
    stackIds.forEach((id, i) => {
      const e = SUPPORT_CATALOG_DATA[id];
      const dose = e?.dosage ? `${e.dosage.mg}${typeof e.dosage.mg === 'number' ? ' мг' : ''}${e.dosage.timing ? ` (${e.dosage.timing})` : ''}` : '';
      L.push(`${i + 1}. ${name(id)}${dose ? ` — ${dose}` : ''}`);
    });
    L.push(``);
    L.push(`🛡 БЕЗОПАСНОСТЬ:`);
    L.push(`• Индекс: ${Math.max(0, 100 - safety.hardStops.length * 25 - safety.drugExclusions.length * 15 - safety.drugTitrations.length * 5 - safety.ulWarnings.length * 3 - safety.redundancy.length * 2)}/100`);
    if (safety.hardStops.length) L.push(`• ⛔ Противопоказания: ${safety.hardStops.map(h => h.substanceName).join(', ')}`);
    if (safety.drugExclusions.length) L.push(`• 💊 Исключить по ЛС: ${safety.drugExclusions.map(e => e.substanceName).join(', ')}`);
    if (safety.ulWarnings.length) L.push(`• 🧪 Превышение UL: ${safety.ulWarnings.map(w => w.name).join(', ')}`);
    if (safety.labAdjustments.length) L.push(`• 🩸 Лаб. коррекции: ${safety.labAdjustments.length}`);
    L.push(``);
    L.push(`🤝 СИНЕРГИЯ: скор ${exp?.totalSynergyScore ?? '—'} · покрытие ${exp?.completeness ?? 0}%`);
    if (exp?.warnings?.length) {
      L.push(``);
      L.push(`⚠ ПРЕДУПРЕЖДЕНИЯ:`);
      exp.warnings.slice(0, 5).forEach(w => L.push(`• ${w}`));
    }
    return L.join('\n');
  }, [stackIds, profile, linked]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
      showToast('✅ Сводка скопирована в буфер', 'success');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast('❌ Не удалось скопировать', 'error');
    }
  };

  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=480,height=720');
    if (!w) { showToast('❌ Заблокировано всплывающее окно', 'error'); return; }
    w.document.write(`<html><head><title>Биостак — план</title>
      <meta charset="utf-8"/>
      <style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding:18px;color:#111;line-height:1.5;font-size:13px}pre{white-space:pre-wrap;font-size:12px}</style>
      </head><body><pre>${exportText.replace(/</g, '&lt;')}</pre>
      <script>window.onload=function(){window.print();}<\/script></body></html>`);
    w.document.close();
  };

  if (stackIds.length === 0) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 40, color: 'rgba(255,255,255,0.3)' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📤</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>Нет стека для экспорта</div>
        <div style={{ fontSize: 10, marginTop: 4 }}>Соберите стек во вкладке 📋 Мой стек</div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <GlassCard title="📤 Экспорт плана поддержки" icon="📤" color="#00e68a">
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, marginBottom: 8 }}>
          Сводка включает состав стека, стоимость, индекс клинической безопасности (selectStack: противопоказания, исключения по ЛС, UL, дублирование путей) и предупреждения.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={handleCopy} style={{
            padding: '11px 0', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            background: copied ? 'rgba(34,197,94,0.12)' : 'rgba(0,230,138,0.1)',
            border: '1px solid rgba(0,230,138,0.25)', color: '#00e68a',
          }}>{copied ? '✅ Скопировано' : '📋 Копировать сводку (Telegram/чат)'}</button>
          <button onClick={handlePrint} style={{
            padding: '11px 0', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', color: '#60a5fa',
          }}>🖨 Печать / сохранить в PDF</button>
        </div>
      </GlassCard>

      <GlassCard title="👁 Предпросмотр" icon="👁" color="#a78bfa">
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 10, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, margin: 0 }}>{exportText}</pre>
      </GlassCard>
    </div>
  );
}
