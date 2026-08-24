/**
 * CardioManageStep.tsx — шаг 4 мастера кардио: интеграции (ПЛ/ББ/ручной,
 * годовой план), экспорт (.ics/.tcx/печать/питание), редактор недели,
 * библиотека с карточками и сценарии. Структура: секции с навигацией.
 */
import React, { useState } from 'react';
import {
  cardioCycleSummary, buildCardioSummaryText, cardioCycleToUserProgram, CARDIO_GOAL_LABELS,
  cardioToNutritionPayload, buildCardioTcx,
  loadCardioCycles, cardioYearPlan, buildCardioYearText,
  type CardioCycle, type CardioScenario,
} from '../../../engines/lms/cardio.engine';
import { CARDIO_KCAL_NOTE_KEY } from './planner-bridge-handlers';
import { loadCardioLog } from '../../../engines/lms/cardio-diary.engine';
import { SPORT_LABELS, type CardioLink, type CardioLinkSport } from '../../../engines/lms/cardio-bridge';
import { applyToPlanner } from './planner-bridge';
import { CardioWeekEditor } from './CardioWeekEditor';
import { SectionCard, GroupHeading, ROW, LABEL, HINT_SM, BTN, BTN_PRIMARY, BTN_DANGER, BTN_SMALL, InfoBanner, Tabs, Badge, EmptyState } from './CardioUI';

const GOAL_COLOR: Record<string, string> = {
  health: '#22c55e', mass: '#3b82f6', cut: '#f59e0b', recomp: '#a78bfa',
  maintenance: '#8b5cf6', recovery: '#71717a',
  bb_prep: '#ec4899', pl_prep: '#06b6d4', bb_taper: '#ef4444',
};

export const CardioManageStep: React.FC<{
  cycle: CardioCycle | null;
  library: CardioCycle[];
  scenarios: CardioScenario[];
  link: CardioLink | null;
  macroLink: { kind: 'pl' | 'bb'; cycleId?: string } | null;
  comparison: string | null;
  annualCardioMap?: Record<string, string>;
  onBuildAnnualCardio?: () => void;
  onClearAnnualCardio?: () => void;
  onLinkTo: (sport: CardioLinkSport) => void;
  onUnlink: () => void;
  onAttachMacro: (kind: 'pl' | 'bb') => void;
  onDetachMacro: () => void;
  onExport: (c: CardioCycle) => void;
  onPrint: (c: CardioCycle) => void;
  onDuplicate: (c: CardioCycle) => void;
  onActivate: (c: CardioCycle) => void;
  onSaveScenario: () => void;
  onLoadScenario: (sc: CardioScenario) => void;
  onRemoveScenario: (id: string) => void;
  onCompare: (c: CardioCycle) => void;
  onRemove: (c: CardioCycle) => void;
  onChanged: () => void;
}> = ({ cycle, library, scenarios, link, macroLink, comparison, annualCardioMap, onBuildAnnualCardio, onClearAnnualCardio, onLinkTo, onUnlink, onAttachMacro, onDetachMacro, onExport, onPrint, onDuplicate, onActivate, onCompare, onRemove, onChanged, onSaveScenario, onLoadScenario, onRemoveScenario }) => {
  const [copyFlash, setCopyFlash] = useState(false);
  const [nutriFlash, setNutriFlash] = useState(false);
  const [yearFlash, setYearFlash] = useState(false);

  /** Год кардио из библиотеки (до 4 циклов) — для визуализации последовательности. */
  const yearPlan = cardioYearPlan(library.slice(0, 4));

  /** «📆 Год кардио»: последовательность циклов из библиотеки → сводка в буфер. */
  const copyYear = () => {
    const cycles = loadCardioCycles().slice(0, 4);
    const plan = cardioYearPlan(cycles);
    if (!plan) { setYearFlash(true); window.setTimeout(() => setYearFlash(false), 2500); return; }
    const text = buildCardioYearText(plan);
    try {
      navigator.clipboard.writeText(text).then(() => setYearFlash(true)).catch(() => { setYearFlash(true); });
    } catch { setYearFlash(true); }
    if (!navigator.clipboard) setYearFlash(true);
    window.setTimeout(() => setYearFlash(false), 2500);
  };

  const copySummary = () => {
    if (!cycle) return;
    const text = buildCardioSummaryText(cycle);
    try {
      navigator.clipboard.writeText(text).then(() => setCopyFlash(true)).catch(() => fallbackCopy(text));
    } catch { fallbackCopy(text); }
    if (!navigator.clipboard) fallbackCopy(text);
    window.setTimeout(() => setCopyFlash(false), 2500);
  };

  /** «🍽 В питание»: расход кардио → заметка для планировщика питания + буфер. */
  const sendToNutrition = () => {
    if (!cycle) return;
    const p = cardioToNutritionPayload(cycle, loadCardioLog());
    try {
      localStorage.setItem(CARDIO_KCAL_NOTE_KEY, JSON.stringify({ cycleId: cycle.id, avgKcalPerWeek: p.avgKcalPerWeek, avgMinutesPerWeek: p.avgMinutesPerWeek, updatedAt: new Date().toISOString() }));
    } catch { /* ignore */ }
    try {
      navigator.clipboard.writeText(p.text).then(() => setNutriFlash(true)).catch(() => fallbackCopy(p.text));
    } catch { fallbackCopy(p.text); }
    if (!navigator.clipboard) fallbackCopy(p.text);
    window.setTimeout(() => setNutriFlash(false), 2500);
  };

  const fallbackCopy = (text: string) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopyFlash(true);
    } catch { /* ignore */ }
  };

  const sendToProgram = () => {
    if (!cycle) return;
    try {
      const prog = cardioCycleToUserProgram(cycle);
      applyToPlanner({ kind: 'program', label: cycle.name, data: { program: prog } });
      setCopyFlash(true);
      window.setTimeout(() => setCopyFlash(false), 2500);
    } catch { /* ignore */ }
  };

  const downloadTcx = () => {
    if (!cycle) return;
    try {
      const blob = new Blob([buildCardioTcx(cycle)], { type: 'application/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cycle.id}.tcx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setCopyFlash(true);
      window.setTimeout(() => setCopyFlash(false), 2500);
    } catch { /* ignore */ }
  };

  const [tab, setTab] = useState<'integrations' | 'export' | 'week' | 'library' | 'scenarios'>('integrations');
  const TABS = [
    { id: 'integrations', label: 'Интеграции', icon: '🔗' },
    { id: 'export', label: 'Экспорт', icon: '📤' },
    { id: 'week', label: 'Неделя', icon: '🛠' },
    { id: 'library', label: 'Библиотека', icon: '📚' },
    { id: 'scenarios', label: 'Сценарии', icon: '📸' },
  ] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      <Tabs tabs={TABS as unknown as { id: string; label: string; icon?: string }[]} active={tab} onChange={v => { setTab(v as typeof tab); const el = document.getElementById('sec-' + v); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} />

          <GroupHeading icon="🔗" text="Интеграции" desc="Подключите кардио-цикл к силовому плану ссылкой (без копии) или к годовому плану." />
          <SectionCard id="sec-integrations" title="Силовой план (ссылка, не копия)">
        {cycle && (
          <div style={{ fontSize: 10, color: '#fff' }}>
            Активный цикл: <b style={{ color: '#4ade80' }}>{cycle.name}</b> — будет подключаться к конструкторам.
          </div>
        )}
        {link ? (
          <div style={ROW}>
            <span style={{ fontSize: 12, color: '#4ade80' }}>Подключено к {SPORT_LABELS[link.sport]}</span>
            <button style={BTN_DANGER} onClick={onUnlink}>Отключить</button>
          </div>
        ) : (
          <div style={ROW}>
            <button style={BTN} onClick={() => onLinkTo('pl')}>🏆 К ПЛ-авто</button>
            <button style={BTN} onClick={() => onLinkTo('bb')}>💪 К ББ-авто</button>
            <button style={BTN} onClick={() => onLinkTo('manual')}>✋ К ручному</button>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Годовой план (macrocycle.cardioCycleId)">
        {macroLink?.cycleId ? (
          <div style={ROW}>
            <span style={{ fontSize: 12, color: '#4ade80' }}>Привязано к годовому плану {macroLink.kind === 'pl' ? 'ПЛ' : 'ББ'}</span>
            <button style={BTN_DANGER} onClick={onDetachMacro}>Отвязать</button>
          </div>
        ) : (
          <div style={ROW}>
            <button style={BTN} onClick={() => onAttachMacro('pl')}>🏆 К плану ПЛ</button>
            <button style={BTN} onClick={() => onAttachMacro('bb')}>💪 К плану ББ</button>
          </div>
        )}
      </SectionCard>

      <SectionCard title="❤️ Кардио по блокам года">
        {onBuildAnnualCardio && (
          <div style={ROW}>
            <button style={BTN} onClick={onBuildAnnualCardio} title="Собрать кардио-цикл на каждый блок годового плана (цель из фазы, taper/пик к старту) и сохранить в библиотеку">
              ❤️ Собрать кардио по блокам года
            </button>
            {Object.keys(annualCardioMap ?? {}).length > 0 && onClearAnnualCardio && (
              <button style={BTN_DANGER} onClick={onClearAnnualCardio} title="Удалить собранные кардио-циклы года из библиотеки и сбросить привязку">
                🗑 Сбросить
              </button>
            )}
          </div>
        )}
        {Object.keys(annualCardioMap ?? {}).length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
            {Object.entries(annualCardioMap!).map(([blockKey, cycleId]) => {
              const c = library.find(x => x.id === cycleId);
              if (!c) {
                return (
                  <div key={blockKey} style={{ fontSize: 10, color: '#fff' }}>
                    ⚠ Блок {blockKey}: цикл {cycleId} не найден в библиотеке
                  </div>
                );
              }
              const cs = cardioCycleSummary(c);
              return (
                <div key={blockKey} style={ROW}>
                  <span style={{ fontSize: 10, color: '#fff', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                  <span style={{ fontSize: 10, color: '#fff' }}>{CARDIO_GOAL_LABELS[c.goal]} · {c.totalWeeks} нед</span>
                  <span style={{ fontSize: 10, color: '#fff' }}>{cs.avgMinutesPerWeek} мин/нед · {cs.avgKcalPerWeek} ккал</span>
                </div>
              );
            })}
          </div>
        ) : (
          onBuildAnnualCardio && (
            <div style={{ marginTop: 6, fontSize: 10, color: '#fff' }}>
              Кардио-циклы года не собраны: постройте макроцикл (ПЛ/ББ-авто, «Годовой план»), затем соберите кардио по блокам — каждый блок получит цикл по фазе (prep/taper/пик у стартов).
            </div>
          )
        )}
      </SectionCard>

          <GroupHeading icon="📤" text="Экспорт" desc="Календарь, тренировочный файл, печать, сводка и передача расхода в питание." />
          {cycle && (
            <SectionCard id="sec-export" title="Экспорт">
          <div style={ROW}>
            <button style={BTN} onClick={() => onExport(cycle)}>📅 Календарь .ics</button>
            <button style={BTN} onClick={downloadTcx} title="Экспорт сессий в .tcx (Garmin Training Center)">📤 .tcx</button>
            <button style={BTN} onClick={() => onPrint(cycle)}>🖨 Печать / PDF</button>
            <button style={BTN} onClick={copySummary} aria-label="Скопировать сводку">
              {copyFlash ? '✅ Сводка скопирована' : '📋 Сводка'}
            </button>
            <button style={{ ...BTN, borderColor: 'rgba(96,165,250,0.4)', color: '#60a5fa' }} onClick={sendToProgram} title="Открыть кардио-цикл как отдельную программу в ручном конструкторе (выполнение как обычная программа)">
              {copyFlash ? '✅ Отправлено' : '📦 Как отдельную программу'}
            </button>
            <button style={{ ...BTN, borderColor: 'rgba(250,204,21,0.4)', color: '#facc15' }} onClick={sendToNutrition} title="Передать расход кардио (ккал/нед + сегодня) в планировщик питания — заметка + буфер">
              {nutriFlash ? '✅ Расход передан' : '🍽 В питание'}
            </button>
            <button style={{ ...BTN, borderColor: 'rgba(34,197,94,0.4)', color: '#22c55e' }} onClick={copyYear} title="Сводка «Год кардио»: последовательность циклов из библиотеки (до 4) в буфер">
              {yearFlash ? '✅ Год в буфере' : '📆 Год кардио'}
            </button>
          </div>
        </SectionCard>
      )}
      <GroupHeading icon="📆" text="Год кардио" desc="Последовательность циклов из библиотеки (до 4) — как блоки года." />
      <SectionCard id="sec-year" title="📆 Год кардио" right={
        <button style={BTN} onClick={copyYear} title="Сводка «Год кардио» в буфер" aria-label="Год кардио в буфер">
          {yearFlash ? '✅ Год в буфере' : '📋 Сводка в буфер'}
        </button>
      }>
        {yearPlan ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 2, height: 18, borderRadius: 3, overflow: 'hidden' }}>
              {yearPlan.blocks.map(b => (
                <div key={b.cycle.id} title={`${b.cycle.name}: нед ${b.startWeek}-${b.startWeek + b.totalWeeks - 1}`} style={{ flex: b.totalWeeks, background: GOAL_COLOR[b.cycle.goal] ?? '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#fff', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {b.totalWeeks >= 10 ? `${b.startWeek}` : ''}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {yearPlan.blocks.map(b => (
                <div key={b.cycle.id} style={ROW}>
                  <span style={{ width: 40, fontSize: 11, fontWeight: 800, color: GOAL_COLOR[b.cycle.goal] ?? '#888' }}>нед {b.startWeek}</span>
                  <span style={{ flex: 1, fontSize: 11, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.cycle.name}</span>
                  <span style={{ fontSize: 10, color: '#fff' }}>{CARDIO_GOAL_LABELS[b.cycle.goal]} · {b.totalWeeks} нед</span>
                  <span style={{ fontSize: 10, color: '#fff' }}>{b.summary.avgMinutesPerWeek} мин/нед</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: '#fff' }}>
              Итого: {yearPlan.totalWeeks} нед · в среднем {yearPlan.avgMinutesPerWeek} мин/нед · {yearPlan.avgKcalPerWeek} ккал/нед
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: '#fff' }}>
            Циклов в библиотеке пока нет — соберите и сохраните циклы, чтобы увидеть их последовательность за год.
          </div>
        )}
      </SectionCard>

          <GroupHeading icon="🛠" text="Конструктор недели" desc="Раскладка по дням, ±10% минут и редактор сессий конкретной недели." />
          <div id="sec-week">
            <CardioWeekEditor cycle={cycle} onChanged={onChanged} />
          </div>

          <GroupHeading icon="📚" text="Библиотека циклов" desc="Сохранённые циклы: активировать, копировать, сравнить, экспортировать." />
          <SectionCard id="sec-library" title={`Библиотека (${library.length})`}>
        {library.length === 0 && <div style={{ fontSize: 11, color: '#fff' }}>Пока пусто — соберите первый цикл на шаге «Предпросмотр».</div>}
        {library.map(c => {
          const s = cardioCycleSummary(c);
          return (
            <div key={c.id} className="ck-week" style={{ padding: 8, borderRadius: 10, background: cycle?.id === c.id ? 'linear-gradient(180deg, rgba(0,230,138,0.10), rgba(0,230,138,0.03))' : 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))', border: cycle?.id === c.id ? '1px solid rgba(0,230,138,0.4)' : '1px solid rgba(255,255,255,0.07)', borderLeft: `3px solid ${cycle?.id === c.id ? '#00e68a' : 'rgba(255,255,255,0.18)'}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={ROW}>
                <span style={{ fontSize: 12, fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cycle?.id === c.id ? '⭐ ' : ''}{c.name}
                </span>
                <span style={{ fontSize: 10, color: '#fff' }}>{c.totalWeeks} нед · {s.avgMinutesPerWeek} мин/нед · {CARDIO_GOAL_LABELS[c.goal]}</span>
              </div>
              <div style={ROW}>
                {cycle?.id !== c.id && <button style={{ ...BTN_PRIMARY, minHeight: 32, padding: '5px 10px' }} onClick={() => onActivate(c)}>Активировать</button>}
                <button style={{ ...BTN, minHeight: 32, padding: '5px 10px' }} onClick={() => onDuplicate(c)}>⧉ Копия</button>
                <button style={{ ...BTN, minHeight: 32, padding: '5px 10px' }} onClick={() => onCompare(c)}>⇄ Сравнить</button>
                <button style={{ ...BTN, minHeight: 32, padding: '5px 10px' }} onClick={() => onExport(c)}>📅</button>
                <button style={{ ...BTN, minHeight: 32, padding: '5px 10px' }} onClick={() => onPrint(c)}>🖨</button>
                <button style={{ ...BTN_DANGER, minHeight: 32, padding: '5px 10px' }} onClick={() => onRemove(c)}>🗑</button>
              </div>
            </div>
          );
        })}
        {comparison && <InfoBanner tone="info">{comparison}</InfoBanner>}
      </SectionCard>

          <GroupHeading icon="📸" text="Сценарии" desc="Снапшоты циклов для сравнения вариантов (до 6)." />
          <SectionCard id="sec-scenarios" title={`Сценарии (${scenarios.length}/6)`} right={
            <button style={BTN_PRIMARY} onClick={onSaveScenario} title="Сохранить текущий активный цикл как сценарий">💾 Сохранить сценарий</button>
          }>
        {scenarios.length === 0 && <div style={{ fontSize: 11, color: '#fff' }}>Сценариев нет — сохраните текущий цикл для сравнения вариантов.</div>}
        {scenarios.map(sc => {
          const s = cardioCycleSummary(sc.cycle);
          return (
            <div key={sc.id} className="ck-week" style={{ padding: 8, borderRadius: 10, background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.07)', borderLeft: '3px solid rgba(167,139,250,0.55)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={ROW}>
                <span style={{ fontSize: 12, fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sc.name}</span>
                <span style={{ fontSize: 10, color: '#fff' }}>{new Date(sc.savedAt).toLocaleDateString('ru-RU')} · {sc.cycle.totalWeeks} нед · {s.avgMinutesPerWeek} мин/нед · {s.hiitWeeks} HIIT</span>
              </div>
              <div style={ROW}>
                <button style={{ ...BTN_PRIMARY, minHeight: 32, padding: '5px 10px' }} onClick={() => onLoadScenario(sc)}>Загрузить</button>
                <button style={{ ...BTN_DANGER, minHeight: 32, padding: '5px 10px' }} onClick={() => onRemoveScenario(sc.id)}>🗑</button>
              </div>
            </div>
          );
        })}
      </SectionCard>
    </div>
  );
};
