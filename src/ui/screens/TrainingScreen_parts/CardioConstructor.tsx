/**
 * CardioConstructor.tsx — отдельный равноправный конструктор кардио-цикла
 * (зона «Планировщик», режим «Кардио»). Создаёт CardioCycle, сохраняет в
 * библиотеку, подключает к ПЛ-авто/ББ-авто/ручному конструктору ссылкой,
 * экспортирует в .ics. Спецификация: docs/CARDIO-CYCLE-INTEGRATION-PLAN.md
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildCardioCycle, cardioCycleSummary, cardioPlanToCycle, buildCardioPlan,
  loadCardioCycles, saveCardioCycle, removeCardioCycle,
  loadActiveCardioCycle, setActiveCardioCycle,
  buildCardioIcs, buildCardioPrintHtml,
  CARDIO_GOAL_LABELS, CARDIO_PHASE_LABELS,
  type CardioCycle, type CardioGoal, type CardioType,
} from '../../../engines/lms/cardio.engine';
import {
  getCardioLink, setCardioLink, clearCardioLink, subscribeCardioLink,
  SPORT_LABELS, type CardioLinkSport,
} from '../../../engines/lms/cardio-bridge';
import { CardioDiaryPanel } from './CardioDiaryPanel';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { acuteChronicRatio, toDailyLoads } from '../../../engines/pro/training-load.engine';

const BTN: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
  color: '#fff', minHeight: 40, whiteSpace: 'nowrap',
};
const BTN_PRIMARY: React.CSSProperties = {
  ...BTN, background: 'rgba(0,230,138,0.16)', border: '1px solid rgba(0,230,138,0.4)', color: '#00e68a',
};
const BTN_DANGER: React.CSSProperties = {
  ...BTN, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171',
};
const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 8,
};
const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' };
const LABEL: React.CSSProperties = { fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 };
const CHIP: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-dim)', fontWeight: 600,
};
const CHIP_ACTIVE: React.CSSProperties = {
  ...CHIP, border: '1px solid rgba(0,230,138,0.5)', background: 'rgba(0,230,138,0.15)', color: '#fff',
};

const TYPE_LABEL: Record<CardioType, string> = {
  zone2: 'Zone 2', hiit: 'HIIT', miss: 'MISS', recovery: 'Recovery',
};
const GOALS: CardioGoal[] = ['health', 'mass', 'cut', 'recomp', 'maintenance', 'recovery'];

function downloadIcs(cycle: CardioCycle): void {
  const blob = new Blob([buildCardioIcs(cycle)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${cycle.id}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function printCycle(cycle: CardioCycle): void {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(buildCardioPrintHtml(cycle));
  w.document.close();
  w.print();
}

interface CompDraft { name: string; week: string }

export const CardioConstructor: React.FC = () => {
  const [goal, setGoal] = useState<CardioGoal>('cut');
  const [totalWeeks, setTotalWeeks] = useState(12);
  const [daysAvailable, setDaysAvailable] = useState(5);
  const [recoveryLow, setRecoveryLow] = useState(false);
  const [comps, setComps] = useState<CompDraft[]>([]);
  const [compDraft, setCompDraft] = useState<CompDraft>({ name: '', week: '' });
  const [cycle, setCycle] = useState<CardioCycle | null>(null);
  const [library, setLibrary] = useState<CardioCycle[]>([]);
  const [link, setLink] = useState(getCardioLink());
  const [flash, setFlash] = useState<string | null>(null);
  const [showWeeks, setShowWeeks] = useState(false);

  const reload = useCallback(() => { setLibrary(loadCardioCycles()); }, []);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    setCycle(loadActiveCardioCycle());
    const un = subscribeCardioLink(l => setLink(l));
    return un;
  }, []);

  const flashMsg = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(null), 3000); };

  const build = () => {
    const c = buildCardioCycle({
      goal,
      totalWeeks,
      daysAvailable,
      recoveryLow,
      competitions: comps.filter(x => x.name.trim() && Number(x.week) > 0).map((x, i) => ({ id: `comp-${i}`, name: x.name.trim(), week: Math.min(Math.max(1, Math.round(Number(x.week))), totalWeeks) })),
    });
    saveCardioCycle(c);
    setActiveCardioCycle(c);
    setCycle(c);
    reload();
    flashMsg('✅ Кардио-цикл собран и сохранён');
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

  const linkTo = (sport: CardioLinkSport) => {
    if (!cycle) { flashMsg('⚠ Сначала соберите или выберите кардио-цикл'); return; }
    setCardioLink({ cycleId: cycle.id, sport, linkedAt: new Date().toISOString() });
    flashMsg(`🔗 Кардио подключено к ${SPORT_LABELS[sport]}`);
  };

  const unlink = () => { clearCardioLink(); flashMsg('🔓 Кардио отключено от силового плана'); };

  const acwrValue = useMemo(() => {
    try {
      const srpe = loadSRPESessions();
      return srpe.length >= 2 ? acuteChronicRatio(toDailyLoads(srpe)).ratio : null;
    } catch { return null; }
  }, []);

  const summary = useMemo(() => cycle ? cardioCycleSummary(cycle) : null, [cycle]);
  const phaseColors: Record<string, string> = {
    base: '#22c55e', build: '#3b82f6', maintenance: '#8b5cf6', contest_prep: '#f59e0b', taper: '#eab308', peak: '#ef4444', transition: '#71717a',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', minWidth: 0, maxWidth: '100%' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#00e68a' }}>
        ❤️ Кардио-конструктор
      </div>

      {flash && <div style={{ ...CARD, borderColor: 'rgba(0,230,138,0.35)', background: 'rgba(0,230,138,0.08)', color: '#4ade80', fontSize: 12, fontWeight: 600 }} role="status">{flash}</div>}

      {/* Параметры */}
      <div style={CARD}>
        <div style={LABEL}>Цель</div>
        <div style={ROW}>
          {GOALS.map(g => (
            <button key={g} style={goal === g ? CHIP_ACTIVE : CHIP} onClick={() => setGoal(g)}>{CARDIO_GOAL_LABELS[g]}</button>
          ))}
        </div>
        <div style={ROW}>
          <span style={LABEL}>Недель</span>
          <button style={BTN} onClick={() => setTotalWeeks(w => Math.max(1, w - 1))} aria-label="Меньше недель">−</button>
          <span style={{ fontSize: 13, fontWeight: 700, minWidth: 30, textAlign: 'center' }}>{totalWeeks}</span>
          <button style={BTN} onClick={() => setTotalWeeks(w => Math.min(52, w + 1))} aria-label="Больше недель">+</button>
          <span style={{ ...LABEL, marginLeft: 10 }}>Дней/нед</span>
          <button style={BTN} onClick={() => setDaysAvailable(d => Math.max(0, d - 1))} aria-label="Меньше дней">−</button>
          <span style={{ fontSize: 13, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{daysAvailable}</span>
          <button style={BTN} onClick={() => setDaysAvailable(d => Math.min(7, d + 1))} aria-label="Больше дней">+</button>
        </div>
        <div style={ROW}>
          <button style={recoveryLow ? CHIP_ACTIVE : CHIP} onClick={() => setRecoveryLow(v => !v)}>
            {recoveryLow ? '🧘 Низкое восстановление (HIIT убран)' : '🟢 Восстановление в норме'}
          </button>
        </div>
      </div>

      {/* Соревнования */}
      <div style={CARD}>
        <div style={LABEL}>🏁 Соревнования (taper + пик-неделя)</div>
        {comps.map((c, i) => (
          <div key={i} style={ROW}>
            <span style={{ fontSize: 12 }}>{c.name} · нед {c.week}</span>
            <button style={BTN_DANGER} onClick={() => setComps(comps.filter((_, j) => j !== i))} aria-label={`Удалить ${c.name}`}>✕</button>
          </div>
        ))}
        <div style={ROW}>
          <input
            value={compDraft.name}
            onChange={e => setCompDraft(d => ({ ...d, name: e.target.value }))}
            placeholder="Название (например, Шоу)"
            style={{ flex: 1, minWidth: 120, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 12 }}
          />
          <input
            value={compDraft.week}
            onChange={e => setCompDraft(d => ({ ...d, week: e.target.value }))}
            placeholder="Неделя"
            inputMode="numeric"
            style={{ width: 80, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 12 }}
          />
          <button style={BTN_PRIMARY} onClick={() => { if (compDraft.name.trim() && Number(compDraft.week) > 0) { setComps([...comps, compDraft]); setCompDraft({ name: '', week: '' }); } }}>+ Добавить</button>
        </div>
      </div>

      {/* Действия */}
      <div style={ROW}>
        <button style={BTN_PRIMARY} onClick={build}>🛠 Собрать цикл</button>
        <button style={BTN} onClick={migrateFromPlan}>📦 Из недельного плана</button>
      </div>

      {/* Текущий цикл */}
      {cycle && summary && (
        <div style={CARD}>
          <div style={ROW}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{cycle.name}</span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{cycle.totalWeeks} нед · {summary.avgMinutesPerWeek} мин/нед · {summary.avgKcalPerWeek} ккал/нед</span>
            <span style={{ fontSize: 11, color: '#f59e0b' }}>{summary.hiitWeeks} нед с HIIT</span>
          </div>
          <button style={BTN} onClick={() => setShowWeeks(v => !v)}>
            {showWeeks ? '▾ Скрыть недели' : '▸ Недели'}
          </button>
          {showWeeks && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {cycle.weeks.map(w => (
                <div key={w.week} style={ROW} >
                  <span style={{ width: 28, fontSize: 11, fontWeight: 700, color: phaseColors[w.phase] ?? '#888' }}>{w.week}</span>
                  <span style={{ width: 70, fontSize: 11, color: 'var(--text-dim)' }}>{CARDIO_PHASE_LABELS[w.phase]}{w.deload ? ' · делод' : ''}{w.taper ? ' · taper' : ''}</span>
                  <span style={{ flex: 1, fontSize: 11, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {w.sessions.map(s => `${TYPE_LABEL[s.type]} ${s.durationMin}×${s.weeklyFrequency}`).join(' · ')}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', minWidth: 60, textAlign: 'right' }}>{w.totalMinutes} мин · {w.totalKcal} ккал</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Дневник выполнения */}
      <CardioDiaryPanel cycle={cycle} acwr={acwrValue} recoveryLow={recoveryLow} />

      {/* Подключение к силовому плану */}
      <div style={CARD}>
        <div style={LABEL}>🔗 Подключение к силовому плану (ссылка, не копия)</div>
        {link ? (
          <div style={ROW}>
            <span style={{ fontSize: 12, color: '#4ade80' }}>Подключено к {SPORT_LABELS[link.sport]} ({link.cycleId})</span>
            <button style={BTN_DANGER} onClick={unlink}>Отключить</button>
          </div>
        ) : (
          <div style={ROW}>
            <button style={BTN} onClick={() => linkTo('pl')}>🏆 Подключить к ПЛ-авто</button>
            <button style={BTN} onClick={() => linkTo('bb')}>💪 Подключить к ББ-авто</button>
            <button style={BTN} onClick={() => linkTo('manual')}>✋ Подключить к ручному</button>
          </div>
        )}
      </div>

      {/* Библиотека */}
      <div style={CARD}>
        <div style={LABEL}>📚 Библиотека циклов ({library.length})</div>
        {library.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Пока пусто — соберите первый цикл выше.</div>}
        {library.map(c => (
          <div key={c.id} style={ROW}>
            <button
              style={cycle?.id === c.id ? CHIP_ACTIVE : CHIP}
              onClick={() => activate(c)}
              title={c.rationale.join(' ')}
            >
              {cycle?.id === c.id ? '⭐ ' : ''}{c.name}
            </button>
            <button style={BTN} onClick={() => duplicate(c)} aria-label={`Дублировать ${c.name}`}>⧉</button>
            <button style={BTN} onClick={() => downloadIcs(c)} aria-label={`Экспорт ${c.name}`}>📅 .ics</button>
            <button style={BTN} onClick={() => printCycle(c)} aria-label={`Печать ${c.name}`}>🖨</button>
            <button style={BTN_DANGER} onClick={() => { removeCardioCycle(c.id); if (cycle?.id === c.id) { setActiveCardioCycle(null); setCycle(null); } reload(); }} aria-label={`Удалить ${c.name}`}>🗑</button>
          </div>
        ))}
      </div>
    </div>
  );
};
