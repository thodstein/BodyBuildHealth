/**
 * CardioManageStep.tsx — шаг 4 v3: таб-эксклюзив.
 * 5 табов: Интеграции | Экспорт | Неделя | Библиотека | Сценарии
 * Экспорт сгруппирован (Поделиться / Файлы), библиотека grid.
 */
import React, { useState } from 'react';
import {
  cardioCycleSummary, buildCardioSummaryText, cardioCycleToUserProgram, CARDIO_GOAL_LABELS,
  cardioToNutritionPayload, buildCardioTcx, buildCardioZwo, cardioCtlSeries,
  loadCardioCycles, cardioYearPlan, buildCardioYearText,
  type CardioCycle, type CardioScenario,
} from '../../../engines/lms/cardio.engine';
import { CARDIO_KCAL_NOTE_KEY } from './planner-bridge-handlers';
import { loadCardioLog } from '../../../engines/lms/cardio-diary.engine';
import { SPORT_LABELS, type CardioLink, type CardioLinkSport } from '../../../engines/lms/cardio-bridge';
import { applyToPlanner } from './planner-bridge';
import { CardioWeekEditor } from './CardioWeekEditor';
import { CardioTaperStep } from './CardioTaperStep';
import { SectionCard, ROW, LABEL, BTN, BTN_PRIMARY, BTN_DANGER, BTN_SMALL, InfoBanner, Tabs, Badge, EmptyState } from './CardioUI';

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
  /** PRO taper-применение: персист делает родитель (snapshot + save + flash). */
  onApplyTaper?: (next: CardioCycle, reason: string) => void;
}> = ({ cycle, library, scenarios, link, macroLink, comparison, annualCardioMap, onBuildAnnualCardio, onClearAnnualCardio, onLinkTo, onUnlink, onAttachMacro, onDetachMacro, onExport, onPrint, onDuplicate, onActivate, onCompare, onRemove, onChanged, onSaveScenario, onLoadScenario, onRemoveScenario, onApplyTaper }) => {
  const [copyFlash, setCopyFlash] = useState(false);
  const [nutriFlash, setNutriFlash] = useState(false);
  const [yearFlash, setYearFlash] = useState(false);

  const yearPlan = (() => {
    const mapped = annualCardioMap && Object.keys(annualCardioMap).length > 0
      ? library.filter(c => Object.values(annualCardioMap).includes(c.id))
      : null;
    if (mapped && mapped.length > 0) {
      // порядок по startDate если есть, иначе как в library (совпадает с блоками года)
      const ordered = [...mapped].sort((a, b) => String(a.startDate ?? '').localeCompare(String(b.startDate ?? '')));
      return cardioYearPlan(ordered);
    }
    return cardioYearPlan(library.slice(0, 4));
  })();

  const copyYear = () => {
    const mappedIds = annualCardioMap ? Object.values(annualCardioMap) : [];
    const cycles = mappedIds.length > 0
      ? loadCardioCycles().filter(c => mappedIds.includes(c.id)).sort((a, b) => String(a.startDate ?? '').localeCompare(String(b.startDate ?? '')))
      : loadCardioCycles().slice(0, 4);
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

  const downloadZwo = () => {
    if (!cycle) return;
    try {
      const blob = new Blob([buildCardioZwo(cycle)], { type: 'application/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cycle.id}.zwo`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setCopyFlash(true);
      window.setTimeout(() => setCopyFlash(false), 2500);
    } catch { /* ignore */ }
  };

  const [libraryFilter, setLibraryFilter] = useState('');
  const [librarySort, setLibrarySort] = useState<'date' | 'weeks' | 'kcal'>('date');
  const [libraryPage, setLibraryPage] = useState(0);
  const LIB_PAGE_SIZE = 6;
  const filteredLibrary = library
    .filter(c => {
      if (!libraryFilter.trim()) return true;
      const q = libraryFilter.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.goal.toLowerCase().includes(q) || CARDIO_GOAL_LABELS[c.goal].toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (librarySort === 'weeks') return b.totalWeeks - a.totalWeeks;
      if (librarySort === 'kcal') return cardioCycleSummary(b).avgKcalPerWeek - cardioCycleSummary(a).avgKcalPerWeek;
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
  const libraryPages = Math.max(1, Math.ceil(filteredLibrary.length / LIB_PAGE_SIZE));
  const pagedLibrary = filteredLibrary.slice(libraryPage * LIB_PAGE_SIZE, (libraryPage + 1) * LIB_PAGE_SIZE);

  const [tab, setTab] = useState<'integrations' | 'export' | 'week' | 'taper' | 'library' | 'scenarios'>('integrations');
  const TABS = [
    { id: 'integrations', label: 'Интеграции', icon: '🔗' },
    { id: 'export', label: 'Экспорт', icon: '📤' },
    { id: 'week', label: 'Неделя', icon: '🛠' },
    { id: 'taper', label: 'Тапер', icon: '📉' },
    { id: 'library', label: 'Библиотека', icon: '📚' },
    { id: 'scenarios', label: 'Сценарии', icon: '📸' },
  ] as const;

  return (
    <div className="train-cardiomanage" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Tabs tabs={TABS as unknown as { id: string; label: string; icon?: string }[]} active={tab} onChange={v => setTab(v as typeof tab)} />

      {tab === 'integrations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionCard title="🔗 Силовой план (ссылка, не копия)">
            {cycle && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)' }}>
                Активный цикл: <b style={{ color: '#4ade80' }}>{cycle.name}</b> — подключается к конструкторам.
              </div>
            )}
            {link ? (
              <div style={ROW}>
                <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 700 }}>Подключено к {SPORT_LABELS[link.sport]}</span>
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

          <SectionCard title="🗓 Годовой план (macrocycle.cardioCycleId)">
            {macroLink?.cycleId ? (
              <div style={ROW}>
                <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 700 }}>Привязано к годовому плану {macroLink.kind === 'pl' ? 'ПЛ' : 'ББ'}</span>
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
                <button style={BTN_PRIMARY} onClick={onBuildAnnualCardio} title="Собрать кардио на каждый блок годового плана">
                  ❤️ Собрать кардио по блокам года
                </button>
                {Object.keys(annualCardioMap ?? {}).length > 0 && onClearAnnualCardio && (
                  <button style={BTN_DANGER} onClick={onClearAnnualCardio}>🗑 Сбросить</button>
                )}
              </div>
            )}
            {Object.keys(annualCardioMap ?? {}).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Object.entries(annualCardioMap!).map(([blockKey, cycleId]) => {
                  const c = library.find(x => x.id === cycleId);
                  if (!c) return <div key={blockKey} style={{ fontSize: 11, color: '#f87171' }}>⚠ Блок {blockKey}: цикл {cycleId} не найден</div>;
                  const cs = cardioCycleSummary(c);
                  return (
                    <div key={blockKey} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '8px 10px' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: GOAL_COLOR[c.goal] ?? '#fff', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{c.name}</span>
                      <Badge bg="rgba(255,255,255,0.06)" border="rgba(255,255,255,0.10)" color="rgba(255,255,255,0.72)">{CARDIO_GOAL_LABELS[c.goal]} · {c.totalWeeks} нед</Badge>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)' }}>{cs.avgMinutesPerWeek} мин · {cs.avgKcalPerWeek} ккал</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                Кардио-циклы года не собраны: постройте макроцикл в ПЛ/ББ-авто, затем соберите кардио по блокам.
              </div>
            )}
          </SectionCard>

          <SectionCard title="📆 Год кардио (до 4 циклов)">
            {yearPlan ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 2, height: 20, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {yearPlan.blocks.map(b => (
                    <div key={b.cycle.id} title={`${b.cycle.name}: нед ${b.startWeek}-${b.startWeek + b.totalWeeks - 1}`} style={{ flex: b.totalWeeks, background: GOAL_COLOR[b.cycle.goal] ?? '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff' }}>
                      {b.totalWeeks >= 8 ? `${b.startWeek}` : ''}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {yearPlan.blocks.map(b => (
                    <div key={b.cycle.id} style={ROW}>
                      <span style={{ width: 48, fontSize: 11, fontWeight: 800, color: GOAL_COLOR[b.cycle.goal] ?? '#888' }}>нед {b.startWeek}</span>
                      <span style={{ flex: 1, fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.cycle.name}</span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)' }}>{CARDIO_GOAL_LABELS[b.cycle.goal]} · {b.summary.avgMinutesPerWeek} мин</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)' }}>
                  Итого: {yearPlan.totalWeeks} нед · {yearPlan.avgMinutesPerWeek} мин/нед · {yearPlan.avgKcalPerWeek} ккал/нед
                </div>
                {(() => {
                  try {
                    const pseudo = { weeks: yearPlan.blocks.flatMap(b => b.cycle.weeks), totalWeeks: yearPlan.totalWeeks } as unknown as import('../../../engines/lms/cardio.engine').CardioCycle;
                    const ctl = cardioCtlSeries(pseudo);
                    const last = ctl[ctl.length - 1];
                    if (!last) return null;
                    return <div style={{ fontSize: 11, color: last.tsb > 5 && last.tsb < 15 ? '#4ade80' : last.tsb < -10 ? '#f87171' : '#fbbf24' }}>📈 Год CTL {last.ctl} · ATL {last.atl} · TSB {last.tsb > 0 ? '+' : ''}{last.tsb}</div>;
                  } catch { return null; }
                })()}
                <button style={BTN_SMALL} onClick={copyYear}>{yearFlash ? '✅ Год в буфере' : '📋 Сводка года в буфер'}</button>
              </div>
            ) : (
              <EmptyState icon="📭" title="Циклов пока нет" desc="Соберите и сохраните циклы, чтобы увидеть год." />
            )}
          </SectionCard>
        </div>
      )}

      {tab === 'export' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!cycle ? (
            <EmptyState icon="📤" title="Нет активного цикла" desc="Соберите цикл на шаге Предпросмотр, чтобы экспортировать." />
          ) : (
            <>
              <SectionCard title="📤 Поделиться">
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 4 }}>Сводки и заметки — в буфер обмена</div>
                <div style={ROW}>
                  <button style={BTN} onClick={copySummary}>{copyFlash ? '✅ Сводка скопирована' : '📋 Сводка цикла'}</button>
                  <button style={{ ...BTN, borderColor: 'rgba(250,204,21,0.32)', color: '#facc15' }} onClick={sendToNutrition}>{nutriFlash ? '✅ Расход передан' : '🍽 В питание'}</button>
                  <button style={{ ...BTN, borderColor: 'rgba(34,197,94,0.32)', color: '#22c55e' }} onClick={copyYear}>{yearFlash ? '✅ Год в буфере' : '📆 Год кардио'}</button>
                </div>
              </SectionCard>
              <SectionCard title="📁 Файлы">
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 4 }}>Календарь и тренировочные файлы</div>
                <div style={ROW}>
                  <button style={BTN} onClick={() => onExport(cycle)}>📅 Календарь .ics</button>
                  <button style={BTN} onClick={downloadTcx}>📤 Тренировка .tcx</button>
                  <button style={BTN} onClick={downloadZwo}>🚴 Zwift .zwo</button>
                  <button style={BTN} onClick={() => onPrint(cycle)}>🖨 Печать / PDF</button>
                </div>
              </SectionCard>
              <SectionCard title="📦 В программу">
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>Откройте кардио как отдельную программу в ручном конструкторе</div>
                <button style={{ ...BTN_PRIMARY, alignSelf: 'flex-start' }} onClick={sendToProgram}>{copyFlash ? '✅ Отправлено' : '📦 Открыть как программу'}</button>
              </SectionCard>
            </>
          )}
        </div>
      )}

      {tab === 'week' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <CardioWeekEditor cycle={cycle} onChanged={onChanged} />
        </div>
      )}

      {tab === 'taper' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {onApplyTaper
            ? <CardioTaperStep cycle={cycle} onApply={onApplyTaper} />
            : <EmptyState icon="📉" title="Taper недоступен" desc="Обновите конструктор: нет обработчика применения." />}
        </div>
      )}

      {tab === 'library' && (
        <SectionCard title={`📚 Библиотека (${filteredLibrary.length}/${library.length})`}>
          {library.length === 0 && <EmptyState icon="📚" title="Пока пусто" desc="Соберите первый цикл на шаге Предпросмотр." />}
          {library.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={libraryFilter} onChange={e => { setLibraryFilter(e.target.value); setLibraryPage(0); }} placeholder="🔍 Поиск: имя/цель" style={{ flex: '1 1 160px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 12 }} />
              <button onClick={() => setLibrarySort('date')} style={librarySort === 'date' ? { ...BTN_SMALL, background: 'rgba(0,230,138,0.18)', border: '1px solid rgba(0,230,138,0.4)', color: '#00e68a' } : BTN_SMALL}>📅 Дата</button>
              <button onClick={() => setLibrarySort('weeks')} style={librarySort === 'weeks' ? { ...BTN_SMALL, background: 'rgba(0,230,138,0.18)', border: '1px solid rgba(0,230,138,0.4)', color: '#00e68a' } : BTN_SMALL}>⏱ Нед</button>
              <button onClick={() => setLibrarySort('kcal')} style={librarySort === 'kcal' ? { ...BTN_SMALL, background: 'rgba(0,230,138,0.18)', border: '1px solid rgba(0,230,138,0.4)', color: '#00e68a' } : BTN_SMALL}>🔥 Ккал</button>
              {filteredLibrary.length > LIB_PAGE_SIZE && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{libraryPage + 1}/{libraryPages}</span>}
              {libraryPage > 0 && <button style={BTN_SMALL} onClick={() => setLibraryPage(p => Math.max(0, p - 1))}>‹</button>}
              {libraryPage + 1 < libraryPages && <button style={BTN_SMALL} onClick={() => setLibraryPage(p => p + 1)}>›</button>}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
            {pagedLibrary.map(c => {
              const s = cardioCycleSummary(c);
              const active = cycle?.id === c.id;
              return (
                <div key={c.id} style={{ padding: 10, borderRadius: 12, background: active ? 'linear-gradient(180deg, rgba(0,230,138,0.10), rgba(0,230,138,0.03))' : 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))', border: active ? '1px solid rgba(0,230,138,0.36)' : '1px solid rgba(255,255,255,0.07)', borderLeft: `3px solid ${active ? '#00e68a' : 'rgba(255,255,255,0.16)'}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{active ? '⭐ ' : ''}{c.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <Badge bg={GOAL_COLOR[c.goal] ? GOAL_COLOR[c.goal] + '22' : 'rgba(255,255,255,0.06)'} border={GOAL_COLOR[c.goal] ? GOAL_COLOR[c.goal] + '44' : 'rgba(255,255,255,0.12)'} color={GOAL_COLOR[c.goal] ?? '#fff'}>{CARDIO_GOAL_LABELS[c.goal]}</Badge>
                    <Badge>{c.totalWeeks} нед</Badge>
                    <Badge>{s.avgMinutesPerWeek} мин/нед</Badge>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {active ? null : <button style={{ ...BTN_PRIMARY, minHeight: 36, padding: '6px 10px', flex: '1 1 auto' }} onClick={() => onActivate(c)}>Активировать</button>}
                    <button style={{ ...BTN_SMALL, flex: '1 1 auto' }} onClick={() => onDuplicate(c)}>⧉ Копия</button>
                    <button style={BTN_SMALL} onClick={() => onCompare(c)}>⇄ Сравнить</button>
                    <button style={BTN_SMALL} onClick={() => onExport(c)}>📅</button>
                    <button style={BTN_SMALL} onClick={() => onPrint(c)}>🖨</button>
                    <button style={{ ...BTN_DANGER, minHeight: 36, padding: '6px 10px' }} onClick={() => onRemove(c)}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
          {comparison && <InfoBanner tone="info">{comparison}</InfoBanner>}
        </SectionCard>
      )}

      {tab === 'scenarios' && (
        <SectionCard title={`📸 Сценарии (${scenarios.length}/6)`} right={<button style={BTN_PRIMARY} onClick={onSaveScenario}>💾 Сохранить сценарий</button>}>
          {scenarios.length === 0 && <EmptyState icon="📸" title="Сценариев нет" desc="Сохраните текущий цикл для сравнения вариантов." />}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 8 }}>
            {scenarios.map(sc => {
              const s = cardioCycleSummary(sc.cycle);
              return (
                <div key={sc.id} style={{ padding: 10, borderRadius: 12, background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.07)', borderLeft: '3px solid rgba(167,139,250,0.55)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={ROW}>
                    <span style={{ fontSize: 13, fontWeight: 800, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sc.name}</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>{new Date(sc.savedAt).toLocaleDateString('ru-RU')}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <Badge>{sc.cycle.totalWeeks} нед</Badge>
                    <Badge>{s.avgMinutesPerWeek} мин/нед</Badge>
                    <Badge bg="rgba(167,139,250,0.14)" border="rgba(167,139,250,0.28)" color="#a78bfa">{s.hiitWeeks} HIIT</Badge>
                  </div>
                  <div style={ROW}>
                    <button style={{ ...BTN_PRIMARY, flex: 1 }} onClick={() => onLoadScenario(sc)}>Загрузить</button>
                    <button style={BTN_DANGER} onClick={() => onRemoveScenario(sc.id)}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}
    </div>
  );
};
