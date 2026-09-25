/**
 * arm-rulebook-panel.tsx — PRO-7 P2: правила соревнований одной карточкой.
 *
 * Армрестлинг: WAF 2025 (снапшот) — категория/весовая по полу, возрасту, весу и
 * рабочей руке + честный статус проверок (без взвешивания = needs_review).
 * Армлифтинг: Armlifting USA 2026 event-specific протоколы снаряда — попытки
 * (unlimited / three increasing) и симуляция попыток с последствием промаха.
 *
 * Ничего не додумывается: снапшоты неполны (см. limitations), вывод помечен
 * event-specific, решение по допуску/протоколу — за организатором.
 */
import React from 'react';
import { AdBanner, AdChip, AdField, AdGrid, AdSec, AdStat } from './arm-design-system';
import {
  ARMLIFTING_USA_2026_SNAPSHOT,
  WAF_2025_SNAPSHOT,
  getImplementProtocolFor,
  type ArmliftingUsaImplement,
  type ArmSide,
  type ArmSex,
} from '../../../engines/arm/arm-rulebook';
import { evaluateWafEligibility } from '../../../engines/arm/arm-rulebook-eligibility.engine';
import { buildAttemptStrategy, simulateImplementProtocol } from '../../../engines/arm/arm-rulebook-simulation.engine';

const IMPLEMENTS: Array<{ id: ArmliftingUsaImplement; label: string }> = [
  { id: 'apollon_axle', label: 'Axle (аполлон)' },
  { id: 'saxon_bar', label: 'Saxon' },
  { id: 'grandfather_clock', label: 'Grandfather Clock' },
];

function num(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export const ArmRulebookPanel: React.FC<{ discipline: string; weightKg?: number; ageYears?: number; sex?: string }> = ({
  discipline,
  weightKg,
  ageYears,
  sex,
}) => {
  const isLift = discipline === 'armlifting';

  const [wafWeight, setWafWeight] = React.useState(String(weightKg && weightKg > 0 ? weightKg : ''));
  const [wafAge, setWafAge] = React.useState(String(ageYears && ageYears > 0 ? ageYears : ''));
  const [wafSex, setWafSex] = React.useState<ArmSex>(sex === 'female' ? 'female' : 'male');
  const [wafArm, setWafArm] = React.useState<ArmSide>('right');

  const [impl, setImpl] = React.useState<ArmliftingUsaImplement>('apollon_axle');
  const [startKg, setStartKg] = React.useState('');
  const [targetKg, setTargetKg] = React.useState('');
  const [stepKg, setStepKg] = React.useState('2.5');
  const [attemptHits, setAttemptHits] = React.useState('1,0,1');

  const waf = React.useMemo(() => {
    const weight = num(wafWeight);
    const age = num(wafAge);
    if (!weight || !age) return null;
    return evaluateWafEligibility(
      { id: 'local', sex: wafSex, ageYears: age, bodyWeightKg: weight, arm: wafArm },
      { competitionAtIso: new Date().toISOString() },
      WAF_2025_SNAPSHOT,
    );
  }, [wafWeight, wafAge, wafSex, wafArm]);

  const protocol = React.useMemo(
    () => getImplementProtocolFor(ARMLIFTING_USA_2026_SNAPSHOT, impl),
    [impl],
  );

  const strategy = React.useMemo(() => {
    if (!protocol) return null;
    return buildAttemptStrategy(protocol, {
      startWeightKg: num(startKg),
      targetWeightKg: num(targetKg),
      stepKg: num(stepKg),
    });
  }, [protocol, startKg, targetKg, stepKg]);

  const simulation = React.useMemo(() => {
    if (!protocol || !strategy?.valid || !strategy.strategy) return null;
    const hits = attemptHits.split(',').map(v => v.trim()).filter(v => v.length > 0);
    const weights = strategy.strategy.weightsKg;
    const attempts = weights
      .slice(0, hits.length)
      .map((weight, index) => ({ weightKg: weight, success: hits[index] === '1' }));
    if (attempts.length === 0) return null;
    return simulateImplementProtocol(protocol, attempts);
  }, [protocol, strategy, attemptHits]);

  if (isLift) {
    return (
      <AdSec
        title="📜 Правила: протокол снаряда (Armlifting USA 2026)"
        hook="rulebook-lift"
        collapsible
        defaultOpen={false}
        summary={protocol ? protocol.attemptPolicy.mode : '—'}
      >
        <AdGrid cols="2">
          <AdField label="Снаряд">
            <div className="ad-chips">
              {IMPLEMENTS.map(o => (
                <AdChip key={o.id} active={impl === o.id} onClick={() => setImpl(o.id)}>{o.label}</AdChip>
              ))}
            </div>
          </AdField>
          <AdField label="Шаг, кг">
            <input aria-label="Шаг попыток" value={stepKg} onChange={e => setStepKg(e.target.value)} inputMode="decimal" placeholder="2.5" />
          </AdField>
          <AdField label="Опенер, кг">
            <input aria-label="Опенер кг" value={startKg} onChange={e => setStartKg(e.target.value)} inputMode="decimal" placeholder="100" />
          </AdField>
          <AdField label="Цель, кг">
            <input aria-label="Цель попыток кг" value={targetKg} onChange={e => setTargetKg(e.target.value)} inputMode="decimal" placeholder="112.5" />
          </AdField>
        </AdGrid>
        {protocol ? (
          <>
            <div className="ad-stats">
              <AdStat value={protocol.attemptPolicy.mode === 'unlimited' ? '∞' : protocol.attemptPolicy.maxAttempts} label="Попыток" />
              <AdStat value={`${protocol.attemptPolicy.timeLimitSeconds} с`} label="Лимит подъёма" />
              <AdStat
                value={protocol.attemptPolicy.missConsequence === 'eliminate_from_event' ? 'выбывание' : 'не указан'}
                label="Промах"
              />
            </div>
            <div className="ad-list" data-arm="rulebook-strategy">
              {strategy?.valid && strategy.strategy ? (
                <>
                  <div className="ad-finding" data-level="info">
                    Попытки: {strategy.strategy.weightsKg.join(' / ')} кг
                  </div>
                  {strategy.strategy.maxAttempts === 'unlimited' && (
                    <div className="ad-muted">Порядок весов в источнике не задан — приложение не упорядочивает их за тебя.</div>
                  )}
                </>
              ) : (
                (strategy?.errors ?? ['Введи опенер — покажем попытки по протоколу.']).map((line, i) => (
                  <div key={i} className="ad-finding" data-level="warn">{line}</div>
                ))
              )}
              {(strategy?.warnings ?? []).map((line, i) => (
                <div key={`w${i}`} className="ad-muted">{line}</div>
              ))}
            </div>
            <AdField label="Результат попыток (1 = взят, 0 = промах)">
              <input aria-label="Результат попыток" value={attemptHits} onChange={e => setAttemptHits(e.target.value)} placeholder="1,0,1" />
            </AdField>
            {simulation && (
              <div className="ad-list" data-arm="rulebook-sim">
                <div className="ad-finding" data-level={simulation.status === 'eliminated' ? 'critical' : simulation.status === 'completed' ? 'ok' : 'warn'}>
                  Статус: {simulation.status === 'eliminated' ? 'выбывание' : simulation.status === 'completed' ? 'завершено' : 'не завершено'} · принято {simulation.completedAttempts}/{simulation.totalAttempts} · лучший {simulation.bestWeightKg ?? '—'} кг
                </div>
                {simulation.attempts.map(a => (
                  <div key={a.index} className="ad-muted">
                    Попытка {a.index + 1}: {a.weightKg} кг — {a.success ? 'взят' : 'промах'}{a.reason ? ` (${a.reason})` : ''}
                  </div>
                ))}
                {(simulation.warnings ?? []).map((line, i) => <div key={i} className="ad-muted">{line}</div>)}
                {(simulation.errors ?? []).map((line, i) => <div key={`e${i}`} className="ad-finding" data-level="critical">{line}</div>)}
              </div>
            )}
          </>
        ) : null}
        <AdBanner>
          Снапшот событийный: глобальных правил Armlifting USA в источнике нет, весовых категорий и порядка попыток приложение не выдумывает. Финальный протокол — у организатора.
        </AdBanner>
      </AdSec>
    );
  }

  return (
    <AdSec
      title="📜 Правила: категория и допуск (WAF 2025)"
      hook="rulebook-waf"
      collapsible
      defaultOpen={false}
      summary={waf ? (waf.status === 'eligible' ? 'допуск' : waf.status === 'needs_review' ? 'нужна проверка' : 'не допущен') : 'нужны вес и возраст'}
    >
      <AdGrid cols="2">
        <AdField label="Вес тела, кг">
          <input aria-label="Вес тела кг" value={wafWeight} onChange={e => setWafWeight(e.target.value)} inputMode="decimal" placeholder="75" />
        </AdField>
        <AdField label="Возраст, лет">
          <input aria-label="Возраст лет" value={wafAge} onChange={e => setWafAge(e.target.value)} inputMode="numeric" placeholder="28" />
        </AdField>
      </AdGrid>
      <AdGrid cols="2">
        <AdField label="Пол">
          <div className="ad-chips">
            <AdChip active={wafSex === 'male'} onClick={() => setWafSex('male')}>М</AdChip>
            <AdChip active={wafSex === 'female'} onClick={() => setWafSex('female')}>Ж</AdChip>
          </div>
        </AdField>
        <AdField label="Рабочая рука">
          <div className="ad-chips">
            <AdChip active={wafArm === 'left'} onClick={() => setWafArm('left')}>Левая</AdChip>
            <AdChip active={wafArm === 'right'} onClick={() => setWafArm('right')}>Правая</AdChip>
          </div>
        </AdField>
      </AdGrid>
      {waf ? (
        <>
          <div className="ad-stats">
            <AdStat
              value={waf.status === 'eligible' ? 'допуск' : waf.status === 'needs_review' ? 'проверка' : 'нет'}
              label="Статус"
            />
            <AdStat value={waf.selectedCategory?.label ?? '—'} label="Категория" />
            <AdStat value={waf.weightClass?.label ?? '—'} label="Весовая" />
          </div>
          <div className="ad-list" data-arm="rulebook-checks">
            {waf.checks.map(check => (
              <div key={check.id} className="ad-finding" data-level={check.status === 'pass' ? 'ok' : check.status === 'fail' ? 'critical' : 'warn'}>
                {check.id}: {check.detail}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="ad-muted">Введи вес и возраст — покажем категорию и весовую по снапшоту WAF 2025.</div>
      )}
      <AdBanner>
        Взвешивание в окне 24–30 ч, одобренные весы и нулевая поправка на одежду проверяются по факту взвешивания — без записи это «нужна проверка», а не «допущен». Финальный допуск — у организатора.
      </AdBanner>
    </AdSec>
  );
};
