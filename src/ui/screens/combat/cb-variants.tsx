/**
 * cb-variants.tsx — E6 «A/B варианты сборки».
 *
 * Раньше выбор билд-настроек был необратим: пересобрал — прошлый вариант
 * исчез, сравнить было не с чем. Теперь вариант можно сохранить, сравнить
 * по ключевым входам и вернуть план как было.
 */
import React, { useState } from 'react';
import { SectionCard, InfoBanner, Highlight, Badge, BTN_SMALL } from './CombatUI';
import {
  loadCombatVariants, addCombatVariant, removeCombatVariant, diffCombatVariants,
  type CombatVariant, COMBAT_VARIANTS_CAP,
} from '../../../engines/combat/combat-variants';
import type { CombatPlan } from '../../../engines/combat/combat.types';

export const CbVariants: React.FC<{
  plan: CombatPlan;
  onRestore: (plan: CombatPlan) => void;
  onMsg?: (m: string) => void;
}> = ({ plan, onRestore, onMsg }) => {
  const [list, setList] = React.useState<CombatVariant[]>(() => { try { return loadCombatVariants(); } catch { return []; } });
  const [name, setName] = useState('');
  const [cmp, setCmp] = useState<[string | null, string | null]>([null, null]);
  const [nonce, setNonce] = useState(0);
  const refresh = () => { try { setList(loadCombatVariants()); } catch { /* пусто */ } setNonce(n => n + 1); };

  const a = list.find(v => v.id === cmp[0]) || null;
  const b = list.find(v => v.id === cmp[1]) || null;
  const rows = a && b ? diffCombatVariants(a, b) : [];

  return (
    <SectionCard icon="🔀" title="A/B варианты сборки" subtitle={`${list.length} из ${COMBAT_VARIANTS_CAP} сохранено`}>
      <div data-cb="variants" key={nonce} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            aria-label="Название варианта"
            placeholder="Название варианта"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ flex: '1 1 140px', minWidth: 120, minHeight: 44, padding: '10px 12px', fontSize: 16, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }}
          />
          <button
            data-cb="variant-save"
            onClick={() => { try { setList(addCombatVariant(plan, name)); setName(''); refresh(); onMsg?.('💾 Вариант сохранён'); } catch { onMsg?.('⚠ Не удалось сохранить вариант'); } }}
            style={{ ...BTN_SMALL, minHeight: 44, background: 'rgba(168,85,247,0.16)', color: '#d8b4fe', border: '0.5px solid rgba(168,85,247,0.26)' }}
          >💾 Сохранить вариант</button>
        </div>

        {!list.length && (
          <InfoBanner tone="info">Вариантов пока нет. Сохраните текущую сборку, чтобы вернуться к ней позже и сравнить с другой.</InfoBanner>
        )}

        {list.map(v => (
          <div key={v.id} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 10, border: '0.5px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: 11.5, color: '#fff', fontWeight: 700, flex: '1 1 120px' }}>{v.name}</span>
            <Badge>{v.inputs.weeks}нд</Badge>
            <Badge>{v.totalSets} сетов</Badge>
            {v.hasFight && <Badge color="#ef4444">бой</Badge>}
            {v.hasWeightCut && <Badge color="#f59e0b">сгон</Badge>}
            <button
              data-cb="variant-compare"
              aria-label={`Сравнить ${v.name} как A`}
              aria-pressed={cmp[0] === v.id}
              onClick={() => setCmp([cmp[0] === v.id ? null : v.id, cmp[1]])}
              style={{ ...BTN_SMALL, minHeight: 44, padding: '8px 12px', fontSize: 12, background: cmp[0] === v.id ? 'rgba(52,199,89,0.18)' : 'rgba(255,255,255,0.05)', color: '#fff', border: '0.5px solid rgba(255,255,255,0.1)' }}
            >A</button>
            <button
              data-cb="variant-compare"
              aria-label={`Сравнить ${v.name} как B`}
              aria-pressed={cmp[1] === v.id}
              onClick={() => setCmp([cmp[0], cmp[1] === v.id ? null : v.id])}
              style={{ ...BTN_SMALL, minHeight: 44, padding: '8px 12px', fontSize: 12, background: cmp[1] === v.id ? 'rgba(96,165,250,0.18)' : 'rgba(255,255,255,0.05)', color: '#fff', border: '0.5px solid rgba(255,255,255,0.1)' }}
            >B</button>
            <button
              data-cb="variant-restore"
              aria-label={`Вернуть ${v.name}`}
              onClick={() => { onRestore(v.plan); onMsg?.(`↩ Вариант «${v.name}» восстановлен`); }}
              style={{ ...BTN_SMALL, minHeight: 44, padding: '8px 12px', fontSize: 12, background: 'rgba(168,85,247,0.16)', color: '#d8b4fe', border: '0.5px solid rgba(168,85,247,0.24)' }}
            >↩ Вернуть</button>
            <button
              data-cb="variant-remove"
              aria-label={`Удалить вариант ${v.name}`}
              onClick={() => { setList(removeCombatVariant(v.id)); setCmp([null, null]); onMsg?.('✕ Вариант удалён'); }}
              style={{ ...BTN_SMALL, minHeight: 44, padding: '8px 12px', fontSize: 12, background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '0.5px solid rgba(239,68,68,0.22)' }}
            >✕</button>
          </div>
        ))}

        {list.length >= COMBAT_VARIANTS_CAP && (
          <InfoBanner tone="warn">Хранится максимум {COMBAT_VARIANTS_CAP} вариантов — самые старые вытесняются. Удалите лишние.</InfoBanner>
        )}

        {a && b && (
          <div data-cb="variant-diff" style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: 12, border: '0.5px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>
              <Highlight color="#34c759">A: {a.name}</Highlight> · <Highlight color="#60a5fa">B: {b.name}</Highlight>
            </div>
            {rows.every(r => !r.changed) && <InfoBanner tone="info">Варианты идентичны — различаются только именем.</InfoBanner>}
            {rows.filter(r => r.changed).map(r => (
              <div key={String(r.key)} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 11, color: '#fff' }}>
                <span style={{ minWidth: 110 }}>{r.label}</span>
                <Highlight color="#34c759">{r.a}</Highlight>
                <span>→</span>
                <Highlight color="#60a5fa">{r.b}</Highlight>
              </div>
            ))}
          </div>
        )}
        {a && !b && <InfoBanner tone="info">Выберите второй вариант (B), чтобы увидеть разницу.</InfoBanner>}
        {!a && b && <InfoBanner tone="info">Выберите первый вариант (A), чтобы увидеть разницу.</InfoBanner>}
      </div>
    </SectionCard>
  );
};
