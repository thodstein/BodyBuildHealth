/**
 * cb-camp-intel.tsx — E4 «поверхности движка».
 *
 * К движку причислено ~30 функций, у которых НОЛЬ потребителей: движок их
 * честно считал, а интерфейс показывал либо ничего, либо рукописный текст,
 * который мог разойтись с расчётом. Здесь они получают экран.
 *
 * Каждая строка — прямой вызов движковой функции, без пересказа: если движок
 * посчитает иначе, поменяется и карточка.
 */
import React, { useMemo } from 'react';
import { SectionCard, InfoBanner, Highlight, Badge } from './CombatUI';
import type { CombatPlan } from '../../../engines/combat/combat.types';
import { weightCutSafetyBanner } from '../../../engines/combat/combat-weight-cut.engine';
import { coreVolumeCheck } from '../../../engines/combat/combat-core.engine';
import { conditioningBudgetCost, conditioningNeedsAerobicMaintenance } from '../../../engines/combat/combat-conditioning.engine';
import { combatLoadStatus, combatHrvReportEwma, vbtVelocityForPct } from '../../../engines/combat/combat-monitoring.engine';
import { vbtRecommendationCombat } from '../../../engines/combat/combat-vbt.engine';
import { getNeckMeta, ufcNeckMatrixCategory } from '../../../engines/combat/combat-neck.engine';

const CORE_LABELS: Record<string, string> = {
  antiExt: 'антиэкс-тензия',
  antiRot: 'антиротация',
  antiLat: 'антилатераль',
  rotPower: 'ротационная мощь',
};

export const CbCampIntelCard: React.FC<{
  plan: CombatPlan;
  acwr?: { ratio: number; zone: string } | null;
  velocityLoss?: number | null;
  outsideSessions?: number;
}> = ({ plan, acwr, velocityLoss, outsideSessions }) => {
  const rows = useMemo(() => {
    const out: { key: string; icon: string; title: string; tone: 'ok' | 'warn' | 'danger'; body: string; badge?: string }[] = [];

    // 1. Сгон — баннер безопасности от движка (раньше UI писал текст руками,
    //    и ISSN-проверки «>15 г клетчатки при сгоне >4 кг» не доходили до экрана)
    const snap: any = plan?.inputSnapshot || {};
    const wc = snap?.weightCutProtocol || null;
    const banner = weightCutSafetyBanner(wc ?? null, snap?.bodyweightKg, snap?.sex);
    if (wc || banner) {
      out.push({
        key: 'wc',
        icon: '⚖️',
        title: 'Сгон веса',
        tone: banner ? (banner.startsWith('⛔') || banner.includes('Same-day') ? 'danger' : 'warn') : 'ok',
        body: banner || `Протокол собран: цель ${(wc?.targetLossKg ?? 0).toFixed(1)} кг · вода ${(wc?.waterCutL ?? 0).toFixed(1)} л · натрий ${wc?.sodiumCutG ?? 0} г`,
      });
    }

    // 2. Кор — 4 оси (антиэкс/антирот/антилат/ротационная мощь)
    const weekIds = (plan?.weeksData || []).flatMap(w => w.sessions.flatMap(s => s.exercises.map(e => e.id)));
    if (weekIds.length) {
      const core = coreVolumeCheck(weekIds as string[]);
      const parts = (Object.keys(CORE_LABELS) as (keyof typeof CORE_LABELS)[])
        .map(k => `${CORE_LABELS[k]} ${core[k as keyof typeof core] as number}`).join(' · ');
      out.push({
        key: 'core',
        icon: '🧱',
        title: 'Кор по осям',
        tone: core.ok ? 'ok' : 'warn',
        body: parts,
        badge: core.ok ? '4/4 оси' : 'пробел',
      });
    }

    // 3. Кондиционирование — стоимость бюджета + аэробная поддержка
    const cond: any = (plan as any)?.conditioning;
    if (cond?.sessions?.length) {
      const perWeek = cond.sessions.map((wk: any[]) => conditioningBudgetCost(wk as any));
      const worst = Math.max(0, ...perWeek);
      const needsAerobic = conditioningNeedsAerobicMaintenance(outsideSessions ?? 0);
      out.push({
        key: 'cond',
        icon: '🫁',
        title: 'Бюджет кондиционирования',
        tone: worst >= 10 ? 'warn' : 'ok',
        body: `съедает ${worst}% бюджета объёма (худшая неделя) · сессий ${cond.sessions.length}/нед${needsAerobic ? ' · нужна аэробная поддержка (≥5 внешних сессий)' : ''}`,
        badge: needsAerobic ? 'аэроба' : undefined,
      });
    }

    // 4. Нагрузка — ACWR/HRV/VBT одной строкой от движка
    const loadNotes = combatLoadStatus(acwr as any, null, typeof velocityLoss === 'number' ? velocityLoss : null);
    const hrv = combatHrvReportEwma();
    if (hrv) loadNotes.push(`HRV (EWMA ${hrv.ewma}): ${hrv.note}`);
    if (loadNotes.length) {
      out.push({
        key: 'load',
        icon: '📡',
        title: 'Нагрузка и восстановление',
        tone: /danger|critical/i.test(loadNotes.join(' ')) ? 'danger' : /caution/i.test(loadNotes.join(' ')) ? 'warn' : 'ok',
        body: loadNotes.join(' · '),
      });
    }

    // 5. Скорость — рекомендация движка по потере темпа
    if (typeof velocityLoss === 'number' && velocityLoss > 0) {
      const rec = vbtRecommendationCombat(velocityLoss);
      out.push({
        key: 'vbt',
        icon: '⚡',
        title: 'Потеря скорости',
        tone: velocityLoss > 30 ? 'danger' : velocityLoss > 20 ? 'warn' : 'ok',
        body: `${velocityLoss}% · ${rec.action} (RIR+${rec.rirAdd} · объём ×${rec.volumeMult})`,
        badge: velocityLoss > 30 ? 'стоп' : velocityLoss > 20 ? 'коррекция' : 'норма',
      });
    }

    // 6. Шея — матрица UFC по фактическим упражнениям плана
    const neckIds = [...new Set((plan?.weeksData || []).flatMap(w => w.sessions.flatMap(s => s.exercises.map(e => e.id))).filter(id => !!getNeckMeta(id)))];
    if (neckIds.length) {
      const cats = [...new Set(neckIds.map(ufcNeckMatrixCategory))];
      out.push({
        key: 'neck',
        icon: '🦒',
        title: 'Шейная матрица (UFC)',
        tone: cats.length >= 2 ? 'ok' : 'warn',
        body: `${neckIds.length} упражн. · ${cats.join(' / ')}`,
        badge: cats.length >= 2 ? 'разносторонне' : 'одна ось',
      });
    }

    // 7. Ориентир скорости по %ПМ — движок знает, какой скорости ждать на
    //    каждом диапазоне интенсивности; сверяться было не с чем.
    //    План хранит кг, а не %ПМ, поэтому показываем референс-лестницу.
    const ladder = [95, 90, 85, 80, 75, 70, 60]
      .map(p => ({ p, z: vbtVelocityForPct(p) }))
      .filter(x => !!x.z) as { p: number; z: { velocity: number; quality: string } }[];
    if (ladder.length) {
      out.push({
        key: 'vpct',
        icon: '🎚',
        title: 'Ориентир скорости по %ПМ',
        tone: 'ok',
        body: ladder.map(x => `${x.p}% ≈ ${x.z.velocity.toFixed(2)}`).join(' · '),
        badge: 'VBT-лестница',
      });
    }

    return out;
  }, [plan, acwr, velocityLoss, outsideSessions]);

  if (!rows.length) return null;

  return (
    <SectionCard icon="🧠" title="Разведка лагеря" subtitle="расчёты движка, которые раньше не доходили до экрана" accent>
      <div className="cb-camp-intel" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(r => (
          <InfoBanner key={r.key} tone={r.tone === 'danger' ? 'warn' : r.tone === 'warn' ? 'warn' : 'info'}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Highlight color={r.tone === 'ok' ? '#34c759' : r.tone === 'warn' ? '#f59e0b' : '#ef4444'}>{r.icon} {r.title}</Highlight>
              <span style={{ color: '#fff' }}>{r.body}</span>
              {r.badge && <Badge color={r.tone === 'ok' ? '#34c759' : '#f59e0b'}>{r.badge}</Badge>}
            </span>
          </InfoBanner>
        ))}
      </div>
    </SectionCard>
  );
};
