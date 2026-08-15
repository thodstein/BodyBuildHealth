/**
 * CardioConstructor.tsx — полноценный пошаговый мастер кардио-цикла
 * (зона «Планировщик», режим «Кардио»). Шаги:
 *  1 Параметры → 2 Старты → 3 Предпросмотр → 4 Управление → 5 Дневник.
 * Создаёт CardioCycle, сохраняет в библиотеку, подключает к ПЛ/ББ/ручному
 * конструктору ссылкой, экспортирует в .ics. Спецификация:
 * docs/CARDIO-CYCLE-INTEGRATION-PLAN.md
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildCardioCycle, cardioPlanToCycle, buildCardioPlan,
  loadCardioCycles, saveCardioCycle, removeCardioCycle,
  loadActiveCardioCycle, setActiveCardioCycle,
  buildCardioIcs, buildCardioPrintHtml, compareCardioCycles, formatCardioComparison,
  type CardioCycle, type CardioGoal, type CardioCompetitionRef,
} from '../../../engines/lms/cardio.engine';
import {
  getCardioLink, setCardioLink, clearCardioLink, subscribeCardioLink,
  SPORT_LABELS, type CardioLinkSport,
} from '../../../engines/lms/cardio-bridge';
import {
  deserializeMacro, serializeMacro, deserializeBbMacro, serializeBbMacro,
  attachCardioToMacro, detachCardioFromMacro,
} from '../../../engines/lms/macrocycle.engine';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { acuteChronicRatio, toDailyLoads } from '../../../engines/pro/training-load.engine';
import { CardioParamsStep } from './CardioParamsStep';
import { CardioCompsStep, type CompDraft } from './CardioCompsStep';
import { CardioPreviewStep } from './CardioPreviewStep';
import { CardioManageStep } from './CardioManageStep';
import { CardioDiaryStep } from './CardioDiaryStep';

type CardioStep = 'params' | 'comps' | 'preview' | 'manage' | 'diary';

const STEPS: { id: CardioStep; icon: string; label: string }[] = [
  { id: 'params', icon: '⚙️', label: 'Параметры' },
  { id: 'comps', icon: '🏁', label: 'Старты' },
  { id: 'preview', icon: '📋', label: 'Предпросмотр' },
  { id: 'manage', icon: '🔗', label: 'Управление' },
  { id: 'diary', icon: '📓', label: 'Дневник' },
];

const NAV_BTN: React.CSSProperties = {
  padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
  color: '#fff', minHeight: 44, whiteSpace: 'nowrap',
};
const NAV_BTN_PRIMARY: React.CSSProperties = {
  ...NAV_BTN, background: 'rgba(0,230,138,0.18)', border: '1px solid rgba(0,230,138,0.5)', color: '#00e68a',
};

function downloadIcs(cycle: CardioCycle): void {
  try {
    const blob = new Blob([buildCardioIcs(cycle)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cycle.id}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch { /* ignore */ }
}

function printCycle(cycle: CardioCycle): void {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(buildCardioPrintHtml(cycle));
  w.document.close();
  w.print();
}

export const CardioConstructor: React.FC = () => {
  // Шаг 1-2: параметры
  const [step, setStep] = useState<CardioStep>('params');
  const [goal, setGoal] = useState<CardioGoal>('cut');
  const [totalWeeks, setTotalWeeks] = useState(12);
  const [daysAvailable, setDaysAvailable] = useState(5);
  const [recoveryLow, setRecoveryLow] = useState(false);
  const [comps, setComps] = useState<CardioCompetitionRef[]>([]);
  const [compDraft, setCompDraft] = useState<CompDraft>({ name: '', week: '' });

  // Результат и библиотека
  const [cycle, setCycle] = useState<CardioCycle | null>(null);
  const [library, setLibrary] = useState<CardioCycle[]>([]);
  const [link, setLink] = useState(getCardioLink());
  const [macroLink, setMacroLink] = useState<{ kind: 'pl' | 'bb'; cycleId?: string } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [comparison, setComparison] = useState<string | null>(null);

  const readMacroLink = useCallback(() => {
    try {
      const rawPL = localStorage.getItem('he_pl_macro');
      if (rawPL) {
        const m = deserializeMacro(rawPL);
        if (m) { setMacroLink({ kind: 'pl', cycleId: m.cardioCycleId }); return; }
      }
      const rawBB = localStorage.getItem('he_bb_macro');
      if (rawBB) {
        const m = deserializeBbMacro(rawBB);
        if (m) { setMacroLink({ kind: 'bb', cycleId: m.cardioCycleId }); return; }
      }
      setMacroLink(null);
    } catch { setMacroLink(null); }
  }, []);
  useEffect(() => { readMacroLink(); }, [readMacroLink]);

  const reload = useCallback(() => { setLibrary(loadCardioCycles()); }, []);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    setCycle(loadActiveCardioCycle());
    const un = subscribeCardioLink(l => setLink(l));
    return un;
  }, []);

  const flashMsg = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(null), 3000); };

  const refreshActive = () => { setCycle(loadActiveCardioCycle()); reload(); };

  const build = () => {
    const c = buildCardioCycle({
      goal,
      totalWeeks,
      daysAvailable,
      recoveryLow,
      competitions: comps,
    });
    saveCardioCycle(c);
    setActiveCardioCycle(c);
    setCycle(c);
    reload();
    flashMsg('✅ Кардио-цикл собран и сохранён в библиотеку');
  };

  const migrateFromPlan = () => {
    const plan = buildCardioPlan({ goal: goal === 'mass' ? 'mass' : goal === 'cut' ? 'cut' : goal === 'recovery' ? 'recovery' : 'maintenance' });
    const c = cardioPlanToCycle(plan, goal);
    saveCardioCycle(c);
    setActiveCardioCycle(c);
    setCycle(c);
    reload();
    flashMsg('✅ Недельный план мигрирован в CardioCycle');
  };

  const duplicate = (c: CardioCycle) => {
    const copy: CardioCycle = { ...c, id: `cardio-${Date.now()}`, name: c.name + ' (копия)', createdAt: new Date().toISOString() };
    saveCardioCycle(copy);
    setActiveCardioCycle(copy);
    setCycle(copy);
    reload();
    flashMsg('⧉ Сценарий продублирован');
  };

  const activate = (c: CardioCycle) => { setActiveCardioCycle(c); setCycle(c); flashMsg('⭐ Активный цикл: ' + c.name); };

  const compareWith = (c: CardioCycle) => {
    if (!cycle) { flashMsg('⚠ Сначала соберите или выберите активный цикл'); return; }
    const cmp = compareCardioCycles(cycle, c);
    setComparison(`${cycle.name} ⇄ ${c.name}: ${formatCardioComparison(cmp)}`);
  };

  const linkTo = (sport: CardioLinkSport) => {
    if (!cycle) { flashMsg('⚠ Сначала соберите или выберите кардио-цикл'); return; }
    setCardioLink({ cycleId: cycle.id, sport, linkedAt: new Date().toISOString() });
    flashMsg(`🔗 Кардио подключено к ${SPORT_LABELS[sport]}`);
  };

  const unlink = () => { clearCardioLink(); flashMsg('🔓 Кардио отключено от силового плана'); };

  const attachMacro = (kind: 'pl' | 'bb') => {
    if (!cycle) { flashMsg('⚠ Сначала соберите или выберите кардио-цикл'); return; }
    const key = kind === 'pl' ? 'he_pl_macro' : 'he_bb_macro';
    try {
      const raw = localStorage.getItem(key);
      const m = kind === 'pl' ? (raw ? deserializeMacro(raw) : null) : (raw ? deserializeBbMacro(raw) : null);
      if (!m) { flashMsg(kind === 'pl' ? '⚠ Годовой план ПЛ не найден — постройте в ПЛ-авто' : '⚠ Годовой план ББ не найден — постройте в ББ-авто'); return; }
      const linked = attachCardioToMacro(m, cycle.id);
      localStorage.setItem(key, kind === 'pl' ? serializeMacro(linked as never) : serializeBbMacro(linked as never));
      setMacroLink({ kind, cycleId: cycle.id });
      flashMsg(`🗓 Кардио привязано к годовому плану (${kind === 'pl' ? 'ПЛ' : 'ББ'})`);
    } catch { flashMsg('⚠ Не удалось привязать кардио к годовому плану'); }
  };

  const detachMacro = () => {
    if (!macroLink) return;
    const key = macroLink.kind === 'pl' ? 'he_pl_macro' : 'he_bb_macro';
    try {
      const raw = localStorage.getItem(key);
      const m = macroLink.kind === 'pl' ? (raw ? deserializeMacro(raw) : null) : (raw ? deserializeBbMacro(raw) : null);
      if (m) localStorage.setItem(key, macroLink.kind === 'pl' ? serializeMacro(detachCardioFromMacro(m) as never) : serializeBbMacro(detachCardioFromMacro(m) as never));
      setMacroLink(null);
      flashMsg('🔓 Кардио отвязано от годового плана');
    } catch { flashMsg('⚠ Не удалось отвязать кардио'); }
  };

  const removeCycle = (c: CardioCycle) => {
    removeCardioCycle(c.id);
    if (cycle?.id === c.id) { setActiveCardioCycle(null); setCycle(null); }
    reload();
  };

  const acwrValue = useMemo(() => {
    try {
      const srpe = loadSRPESessions();
      return srpe.length >= 2 ? acuteChronicRatio(toDailyLoads(srpe)).ratio : null;
    } catch { return null; }
  }, []);

  const stepIdx = STEPS.findIndex(s => s.id === step);
  const goNext = () => {
    if (step === 'preview' && !cycle) { build(); return; }
    if (stepIdx < STEPS.length - 1) setStep(STEPS[stepIdx + 1].id);
  };
  const goPrev = () => { if (stepIdx > 0) setStep(STEPS[stepIdx - 1].id); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', minWidth: 0, maxWidth: '100%' }}>
      {/* Шапка мастера */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#00e68a' }}>❤️ Кардио-конструктор</div>
        {cycle && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.25)', borderRadius: 20, padding: '4px 10px' }}>⭐ {cycle.name}</div>}
      </div>

      {/* Степпер */}
      <div style={{ display: 'flex', gap: 4, padding: 6, borderRadius: 12, background: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {STEPS.map((s, i) => {
          const active = step === s.id;
          const done = i < stepIdx;
          return (
            <button
              key={s.id}
              onClick={() => setStep(s.id)}
              style={{
                flex: '1 0 auto', minWidth: 84, padding: '8px 6px', borderRadius: 9, cursor: 'pointer',
                border: active ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)',
                background: active ? 'rgba(0,230,138,0.18)' : done ? 'rgba(0,230,138,0.06)' : 'rgba(255,255,255,0.02)',
                color: active ? '#fff' : 'var(--text-dim)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontSize: 15 }}>{done ? '✅' : s.icon}</span>
              <span>{i + 1} {s.label}</span>
            </button>
          );
        })}
      </div>

      {flash && <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.25)', color: '#4ade80', fontSize: 12, fontWeight: 700 }} role="status">{flash}</div>}

      {/* Шаги */}
      {step === 'params' && (
        <CardioParamsStep
          goal={goal} setGoal={setGoal}
          totalWeeks={totalWeeks} setTotalWeeks={setTotalWeeks}
          daysAvailable={daysAvailable} setDaysAvailable={setDaysAvailable}
          recoveryLow={recoveryLow} setRecoveryLow={setRecoveryLow}
        />
      )}
      {step === 'comps' && (
        <CardioCompsStep comps={comps} setComps={setComps} draft={compDraft} setDraft={setCompDraft} totalWeeks={totalWeeks} />
      )}
      {step === 'preview' && (
        <>
          <CardioPreviewStep cycle={cycle} onBuild={build} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={NAV_BTN} onClick={migrateFromPlan}>📦 Мигрировать недельный план</button>
          </div>
        </>
      )}
      {step === 'manage' && (
        <CardioManageStep
          cycle={cycle} library={library} link={link} macroLink={macroLink} comparison={comparison}
          onLinkTo={linkTo} onUnlink={unlink} onAttachMacro={attachMacro} onDetachMacro={detachMacro}
          onExport={downloadIcs} onPrint={printCycle} onDuplicate={duplicate} onActivate={activate}
          onCompare={compareWith} onRemove={removeCycle} onChanged={refreshActive}
        />
      )}
      {step === 'diary' && (
        <CardioDiaryStep cycle={cycle} acwr={acwrValue} recoveryLow={recoveryLow} onChanged={refreshActive} />
      )}

      {/* Навигация */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <button style={NAV_BTN} onClick={goPrev} disabled={stepIdx === 0} aria-label="Назад">← Назад</button>
        {stepIdx < STEPS.length - 1 && (
          <button style={NAV_BTN_PRIMARY} onClick={goNext} aria-label="Далее">
            {step === 'preview' && !cycle ? '🛠 Собрать и далее →' : 'Далее →'}
          </button>
        )}
      </div>
    </div>
  );
};
