/**
 * MobilityTab.tsx — вкладка «🧘 Мобильность» дневника тренировок.
 *
 * Пользователь собирает личный протокол мобильности из библиотеки блоков
 * (методики Библиотеки + готовые потоки) и привязывает шаги к слотам:
 * ежедневная рутина / перед тренировкой / после / день отдыха.
 * Протокол отображается в сессии (SessionPlayer); чек-ины (выполнено + ROM)
 * дают приверженность и тренды ROM.
 *
 * Отображение-онли: вкладка НЕ влияет на планирование/авторегуляцию.
 */
import React, { useCallback, useMemo, useState } from 'react';
import type { DiaryHubCtx } from './diary-hub-context';
import { ACCENT, DIM, diaryCard, diaryInput } from './diary-tokens';
import { MiniLineChart } from './DiaryChart';
import {
  MOBILITY_LIBRARY, SLOT_ORDER, SLOT_LABELS, DIRECTION_LABELS, PRESET_LABELS,
  buildPresetMobility, mobilityBlockToItem, itemsForSlot, hasDailyRoutine,
  loadMobilityProtocols, upsertMobilityProtocol, deleteMobilityProtocol, duplicateMobilityProtocol,
  createMobilityProtocol, loadActiveMobility, setActiveMobility,
  loadMobilityCheckins, upsertMobilityCheckin, latestMobilityCheckin,
  mobilityAdherence, mobilityTrends, exportMobilityCheckinsCSV, buildMobilityInsights,
  type MobilityProtocol, type MobilityItem, type MobilitySlot, type MobilityDirection,
} from '../../../engines/mobility-protocol.engine';

const CARD = diaryCard;
const IN = diaryInput;

const SLOT_ICON: Record<MobilitySlot, string> = { daily: '🌅', pre: '🏋️', post: '🧘', rest_day: '🛌' };
const SLOT_COLOR: Record<MobilitySlot, string> = { daily: '#60a5fa', pre: '#f59e0b', post: '#00e68a', rest_day: '#a78bfa' };
const DIRECTION_ICON: Record<MobilityDirection, string> = { pl: '🏆', bb: '💪', both: '🌐' };

export const MobilityTab: React.FC<{ hub: DiaryHubCtx }> = () => {
  const [protocols, setProtocols] = useState<MobilityProtocol[]>(() => loadMobilityProtocols());
  const [activeId, setActiveId] = useState<string | null>(() => loadActiveMobility()?.id || null);
  const [tick, setTick] = useState(0);
  const [previewSlot, setPreviewSlot] = useState<MobilitySlot>('daily');
  const [libOpen, setLibOpen] = useState(false);
  const [libSearch, setLibSearch] = useState('');
  const [libSlot, setLibSlot] = useState<'all' | MobilitySlot>('all');
  const [customOpen, setCustomOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState<{ title: string; script: string; slot: MobilitySlot; durationMin: number }>({
    title: '', script: '', slot: 'daily', durationMin: 5,
  });
  const [checkin, setCheckin] = useState(() => {
    const last = latestMobilityCheckin();
    return { done: last?.done ?? true, romScore: last?.romScore ?? 4, note: '' };
  });
  const [checkinSaved, setCheckinSaved] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const active = useMemo(() => protocols.find(p => p.id === activeId) || null, [protocols, activeId]);

  const refresh = useCallback(() => {
    setProtocols(loadMobilityProtocols());
    setActiveId(loadActiveMobility()?.id || null);
    setTick(t => t + 1);
  }, []);

  const persist = useCallback((p: MobilityProtocol) => {
    const list = upsertMobilityProtocol(p);
    setProtocols(list);
    setActiveId(p.id);
    setActiveMobility(p.id);
  }, []);

  const selectActive = useCallback((id: string) => {
    setActiveId(id);
    setActiveMobility(id);
  }, []);

  const applyPreset = useCallback((dir: MobilityDirection) => {
    const p = buildPresetMobility(dir);
    const list = upsertMobilityProtocol(p);
    setProtocols(list);
    setActiveId(p.id);
    setActiveMobility(p.id);
  }, []);

  const createEmpty = useCallback(() => {
    const p = createMobilityProtocol('Мой протокол мобильности', 'both');
    const list = upsertMobilityProtocol(p);
    setProtocols(list);
    setActiveId(p.id);
    setActiveMobility(p.id);
  }, []);

  const removeProtocol = useCallback((id: string) => {
    const list = deleteMobilityProtocol(id);
    setProtocols(list);
    setActiveId(list.length > 0 ? list[0].id : null);
    if (list.length > 0) setActiveMobility(list[0].id);
  }, []);

  const dupProtocol = useCallback((id: string) => {
    setProtocols(duplicateMobilityProtocol(id));
  }, []);

  // ── Импорт протокола из JSON (бэкап/перенос) ──
  const importProtocol = useCallback(() => {
    setImportError(null);
    try {
      const raw = JSON.parse(importText);
      const list = upsertMobilityProtocol({ ...raw, id: `mob_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      const imported = list[list.length - 1];
      setProtocols(list);
      setActiveId(imported.id);
      setActiveMobility(imported.id);
      setImportOpen(false);
      setImportText('');
    } catch {
      setImportError('Не удалось разобрать JSON — проверьте содержимое файла');
    }
  }, [importText]);

  // ── Правка активного протокола ──
  const patchProtocol = useCallback((patch: Partial<MobilityProtocol>) => {
    if (!active) return;
    persist({ ...active, ...patch });
  }, [active, persist]);

  const updateItem = useCallback((idx: number, patch: Partial<MobilityItem>) => {
    if (!active) return;
    persist({ ...active, items: active.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) });
  }, [active, persist]);

  const removeItem = useCallback((idx: number) => {
    if (!active) return;
    persist({ ...active, items: active.items.filter((_, i) => i !== idx) });
  }, [active, persist]);

  const moveItem = useCallback((idx: number, dir: -1 | 1) => {
    if (!active) return;
    const to = idx + dir;
    if (to < 0 || to >= active.items.length) return;
    const items = [...active.items];
    const [item] = items.splice(idx, 1);
    items.splice(to, 0, item);
    persist({ ...active, items });
  }, [active, persist]);

  const addBlock = useCallback((blockId: string) => {
    if (!active) return;
    const block = MOBILITY_LIBRARY.find(b => b.id === blockId);
    if (!block) return;
    persist({ ...active, items: [...active.items, mobilityBlockToItem(block)] });
  }, [active, persist]);

  const addCustom = useCallback(() => {
    if (!active || customDraft.title.trim() === '') return;
    const item: MobilityItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      slot: customDraft.slot,
      title: customDraft.title.trim(),
      script: customDraft.script.trim(),
      durationMin: Math.max(1, Math.round(customDraft.durationMin) || 5),
    };
    persist({ ...active, items: [...active.items, item] });
    setCustomDraft({ title: '', script: '', slot: 'daily', durationMin: 5 });
    setCustomOpen(false);
  }, [active, customDraft, persist]);

  // ── Чек-ин ──
  const saveCheckin = useCallback(() => {
    upsertMobilityCheckin({
      date: new Date().toISOString().slice(0, 10),
      done: checkin.done,
      romScore: checkin.romScore,
      note: checkin.note.trim() || undefined,
    });
    setCheckinSaved(true);
    setTick(t => t + 1);
  }, [checkin]);

  // ── Аналитика ──
  const adherence = useMemo(() => mobilityAdherence(30), [tick]);
  const trends = useMemo(() => mobilityTrends(30), [tick]);
  const insights = useMemo(() => buildMobilityInsights(active), [active, tick]);

  const slotItems = useMemo(() => itemsForSlot(active, previewSlot), [active, previewSlot]);
  const filteredLibrary = useMemo(() => {
    const q = libSearch.trim().toLowerCase();
    return MOBILITY_LIBRARY.filter(b => {
      if (libSlot !== 'all' && b.slot !== libSlot) return false;
      if (q && !(b.title.toLowerCase().includes(q) || b.description.toLowerCase().includes(q) || (b.targetAreas || []).join(' ').toLowerCase().includes(q))) return false;
      return true;
    });
  }, [libSearch, libSlot]);

  const btn: React.CSSProperties = { padding: '7px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,var(--accent),#00cc7a)', color: '#000', fontWeight: 700, fontSize: 11, minHeight: 40 };
  const ghost: React.CSSProperties = { padding: '6px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.75)', cursor: 'pointer', fontSize: 10, minHeight: 36 };
  const chip = (on: boolean, color = ACCENT): React.CSSProperties => ({
    padding: '4px 10px', borderRadius: 20, cursor: 'pointer', fontSize: 10, fontWeight: 600, minHeight: 30,
    border: on ? `1px solid ${color}` : '1px solid rgba(255,255,255,0.1)',
    background: on ? `${color}22` : 'rgba(255,255,255,0.02)',
    color: on ? color : 'rgba(255,255,255,0.55)',
  });

  const downloadCSV = () => {
    try {
      const csv = exportMobilityCheckinsCSV();
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mobility_checks_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  // ── Печатный отчёт мобильности ──
  const printReport = useCallback(() => {
    const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const checks = loadMobilityCheckins();
    const adh = mobilityAdherence(30);
    const tr = mobilityTrends(30);
    const rows = [...checks].reverse().slice(0, 60).map(c => `
      <tr>
        <td>${esc(c.date)}</td><td>${esc(c.sessionId || '—')}</td>
        <td>${c.done ? 'да' : 'нет'}</td><td>${c.romScore === null ? '—' : c.romScore}</td>
        <td>${esc(c.note || '')}</td>
      </tr>`).join('');
    const itemsHtml = active && active.items.length > 0
      ? `<h2>Протокол</h2><ul>${active.items.map(it => `<li>${esc(it.title)} — ${SLOT_LABELS[it.slot]}, ${it.durationMin} мин</li>`).join('')}</ul>`
      : '';
    const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Мобильность — отчёт</title>
      <style>body{font-family:system-ui;padding:24px;color:#111}table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{border:1px solid #ddd;padding:4px 6px;text-align:left}th{background:#f5f5f5}h1{font-size:18px}h2{font-size:14px;margin-top:20px}
      .stats{display:flex;gap:20px;font-size:13px;margin:8px 0;flex-wrap:wrap}</style></head><body>
      <h1>🧘 Мобильность и гибкость — отчёт</h1>
      <div style="color:#555;font-size:12px">Сформировано: ${new Date().toLocaleString('ru-RU')}${active ? ` · протокол: ${esc(active.name)} (${active.items.length} блоков)` : ' · протокол не собран'}</div>
      <div class="stats">
        <span>Чек-инов всего: <b>${checks.length}</b></span>
        <span>За 30 дней: <b>${tr.count}</b></span>
        <span>Приверженность (30д): <b>${adh.total > 0 ? adh.pct + '%' : '—'}</b></span>
        <span>Средний ROM: <b>${tr.avgRom > 0 ? tr.avgRom.toFixed(1) : '—'}</b></span>
      </div>
      ${itemsHtml}
      <h2>Инсайты</h2>
      <ul>${insights.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
      <h2>Чек-ины (последние 60)</h2>
      <table><thead><tr><th>Дата</th><th>Сессия</th><th>Выполнено</th><th>ROM</th><th>Заметка</th></tr></thead><tbody>${rows}</tbody></table>
      <script>window.print();</script></body></html>`;
    try {
      const win = window.open('', '_blank', 'width=900,height=700');
      if (win) { win.document.write(html); win.document.close(); }
    } catch { /* SSR/блокировка — игнор */ }
  }, [active, insights]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, color: '#fff' }}>
      {/* ── Заголовок ── */}
      <div style={{ ...CARD, border: '1px solid rgba(96,165,250,0.2)', background: 'rgba(96,165,250,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#60a5fa' }}>🧘 Мобильность и гибкость</div>
          <span style={{ fontSize: 9, color: DIM }}>Собери протокол мобильности — рутина появится в сессии и в дни отдыха</span>
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 6, lineHeight: 1.5 }}>
          Источник — методики Библиотеки (CARs, позвоночник, статика, PNF, нагруженная, FRC) + готовые потоки.
          Разминка/заминка тренировки уже генерируются автоматически — здесь только то, что их дополняет:
          ежедневная рутина, подготовка проблемных зон, растяжка после и сессии в дни отдыха.
        </div>
      </div>

      {/* ── Активный протокол ── */}
      <div style={CARD}>
        <div style={{ fontSize: 10, color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>
          Активный протокол
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <select aria-label="Активный протокол" value={activeId || ''} onChange={e => selectActive(e.target.value)}
            style={{ ...IN, flex: 1, minWidth: 180, width: 'auto' }}>
            {protocols.length === 0 && <option value="">— нет протоколов —</option>}
            {protocols.map(p => (
              <option key={p.id} value={p.id}>{DIRECTION_ICON[p.direction]} {p.name} · {p.items.length} блоков</option>
            ))}
          </select>
          {active && (
            <>
              <button type="button" style={ghost} onClick={() => dupProtocol(active.id)} aria-label="Дублировать протокол">⧉ Копия</button>
              <button type="button" style={{ ...ghost, color: 'rgba(248,113,113,0.9)', border: '1px solid rgba(248,113,113,0.3)' }} onClick={() => removeProtocol(active.id)} aria-label="Удалить протокол">🗑</button>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          <button type="button" style={ghost} onClick={() => applyPreset('pl')} aria-label="Пресет ПЛ">🏆 Пресет ПЛ</button>
          <button type="button" style={ghost} onClick={() => applyPreset('bb')} aria-label="Пресет ББ">💪 Пресет ББ</button>
          <button type="button" style={ghost} onClick={() => applyPreset('both')} aria-label="Универсальный пресет">🌐 Универсал</button>
          <button type="button" style={ghost} onClick={createEmpty} aria-label="Новый пустой протокол">＋ Пустой</button>
          <button type="button" style={ghost} onClick={() => { setImportOpen(v => !v); setImportError(null); }} aria-expanded={importOpen} aria-label="Импорт протокола из JSON">📥 Импорт JSON</button>
        </div>
        {importOpen && (
          <div style={{ marginTop: 8 }}>
            <textarea aria-label="JSON протокола" style={{ ...IN, minHeight: 80, resize: 'vertical', fontFamily: 'monospace', fontSize: 10 }} placeholder='Вставьте JSON протокола (экспорт «⬇ JSON» из этой вкладки)…' value={importText} onChange={e => setImportText(e.target.value)} />
            {importError && <div style={{ fontSize: 10, color: '#ef4444', marginTop: 4 }}>{importError}</div>}
            <button type="button" style={{ ...btn, width: '100%', marginTop: 6 }} onClick={importProtocol} disabled={importText.trim() === ''}>📥 Импортировать протокол</button>
          </div>
        )}
        {active && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
            {SLOT_ORDER.map(s => {
              const n = itemsForSlot(active, s).length;
              return <span key={s} style={{ fontSize: 9, color: n > 0 ? SLOT_COLOR[s] : 'rgba(255,255,255,0.3)' }}>{SLOT_ICON[s]} {SLOT_LABELS[s]}: {n}</span>;
            })}
          </div>
        )}
      </div>

      {!active && (
        <div style={{ ...CARD, textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🧘</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Протокол мобильности ещё не собран</div>
          <div style={{ fontSize: 10, color: DIM, marginTop: 4, lineHeight: 1.5 }}>
            Начните с пресета: ПЛ (позвоночник/бёдра под присед-тягу, статика+PNF после)
            или ББ (нагруженная растяжка для stretch-гипертрофии, потоки в отдых).
          </div>
        </div>
      )}

      {active && (
        <>
          {/* ── Конструктор ── */}
          <div style={CARD}>
            <div style={{ fontSize: 10, color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>
              Конструктор протокола
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input aria-label="Название протокола" style={{ ...IN, flex: 2, minWidth: 180 }} value={active.name}
                onChange={e => patchProtocol({ name: e.target.value })} />
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {(['pl', 'bb', 'both'] as MobilityDirection[]).map(d => (
                  <button key={d} type="button" style={chip(active.direction === d)}
                    onClick={() => patchProtocol({ direction: d })} aria-label={DIRECTION_LABELS[d]}>
                    {DIRECTION_ICON[d]} {d === 'pl' ? 'ПЛ' : d === 'bb' ? 'ББ' : 'Оба'}
                  </button>
                ))}
              </div>
            </div>

            {active.items.length === 0 ? (
              <div style={{ fontSize: 10, color: DIM, padding: 14, textAlign: 'center', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 10, marginTop: 10 }}>
                Блоков нет — добавьте из библиотеки ниже или создайте свой блок.
              </div>
            ) : (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {active.items.map((it, idx) => (
                  <div key={it.id} style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <select aria-label="Слот блока" value={it.slot} onChange={e => updateItem(idx, { slot: e.target.value as MobilitySlot })}
                        style={{ ...IN, width: 150, padding: '4px 8px', fontSize: 10, minHeight: 28 }}>
                        {SLOT_ORDER.map(s => <option key={s} value={s}>{SLOT_ICON[s]} {SLOT_LABELS[s]}</option>)}
                      </select>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', flex: 1, minWidth: 140 }}>{it.title}</span>
                      <span style={{ fontSize: 9, color: DIM }}>{it.durationMin} мин</span>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button type="button" style={{ ...ghost, padding: '2px 8px', minHeight: 28 }} onClick={() => moveItem(idx, -1)} disabled={idx === 0} aria-label="Выше">↑</button>
                        <button type="button" style={{ ...ghost, padding: '2px 8px', minHeight: 28 }} onClick={() => moveItem(idx, 1)} disabled={idx === active.items.length - 1} aria-label="Ниже">↓</button>
                        <button type="button" style={{ ...ghost, padding: '2px 8px', minHeight: 28, color: 'rgba(248,113,113,0.9)' }} onClick={() => removeItem(idx)} aria-label="Удалить блок">✕</button>
                      </div>
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 4, lineHeight: 1.5 }}>
                      {it.script.length > 180 ? it.script.slice(0, 180) + '…' : it.script}
                    </div>
                    {it.sourceMethod && <div style={{ fontSize: 8, color: 'rgba(96,165,250,0.7)', marginTop: 4 }}>источник: {it.sourceMethod}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Библиотека блоков */}
            <div style={{ marginTop: 12 }}>
              <button type="button" style={{ ...ghost, width: '100%' }} onClick={() => setLibOpen(v => !v)} aria-expanded={libOpen}>
                📚 Библиотека блоков ({MOBILITY_LIBRARY.length}) {libOpen ? '▲' : '▼'}
              </button>
              {libOpen && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <input aria-label="Поиск блоков" style={{ ...IN, flex: 1, minWidth: 140 }} placeholder="Поиск…" value={libSearch} onChange={e => setLibSearch(e.target.value)} />
                    {(['all', ...SLOT_ORDER] as const).map(s => (
                      <button key={s} type="button" style={chip(libSlot === s, SLOT_COLOR[s as MobilitySlot])} onClick={() => setLibSlot(s)}>
                        {s === 'all' ? 'Все' : `${SLOT_ICON[s]} ${SLOT_LABELS[s]}`}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, maxHeight: 340, overflowY: 'auto' }}>
                    {filteredLibrary.length === 0 && <div style={{ fontSize: 10, color: DIM, padding: 10, textAlign: 'center' }}>Ничего не найдено</div>}
                    {filteredLibrary.map(b => {
                      const added = active.items.some(it => it.title === b.title && it.script === b.script);
                      return (
                        <div key={b.id} style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: SLOT_COLOR[b.slot], minWidth: 70 }}>{SLOT_ICON[b.slot]} {SLOT_LABELS[b.slot]}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', flex: 1, minWidth: 120 }}>{b.title}</span>
                            <button type="button" disabled={added} style={{ ...ghost, padding: '3px 10px', minHeight: 28, opacity: added ? 0.4 : 1 }}
                              onClick={() => addBlock(b.id)} aria-label={`Добавить ${b.title}`}>
                              {added ? '✓ добавлен' : '＋ добавить'}
                            </button>
                          </div>
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 3, lineHeight: 1.45 }}>{b.description}</div>
                          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                            {b.durationMin} мин · {b.targetAreas?.join(' · ')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Кастомный блок */}
            <div style={{ marginTop: 10 }}>
              <button type="button" style={{ ...ghost, width: '100%' }} onClick={() => setCustomOpen(v => !v)} aria-expanded={customOpen}>
                ✍️ Свой блок {customOpen ? '▲' : '▼'}
              </button>
              {customOpen && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input aria-label="Название блока" style={IN} placeholder="Название (напр. «Моя растяжка бёдер»)" value={customDraft.title}
                    onChange={e => setCustomDraft(p => ({ ...p, title: e.target.value }))} />
                  <textarea aria-label="Скрипт блока" style={{ ...IN, minHeight: 64, resize: 'vertical' }} placeholder="Что делать — пошагово, своими словами"
                    value={customDraft.script} onChange={e => setCustomDraft(p => ({ ...p, script: e.target.value }))} />
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                    {SLOT_ORDER.map(s => (
                      <button key={s} type="button" style={chip(customDraft.slot === s, SLOT_COLOR[s])} onClick={() => setCustomDraft(p => ({ ...p, slot: s }))}>
                        {SLOT_ICON[s]} {SLOT_LABELS[s]}
                      </button>
                    ))}
                    <span style={{ fontSize: 9, color: DIM, marginLeft: 4 }}>мин:</span>
                    <input aria-label="Длительность мин" type="number" min={1} max={60} style={{ ...IN, width: 56, padding: '6px 8px' }}
                      value={customDraft.durationMin} onChange={e => setCustomDraft(p => ({ ...p, durationMin: Math.max(1, Math.min(60, +e.target.value || 5)) }))} />
                  </div>
                  <button type="button" style={btn} onClick={addCustom} disabled={customDraft.title.trim() === ''}>＋ Добавить блок в протокол</button>
                </div>
              )}
            </div>
          </div>

          {/* ── Предпросмотр по слоту ── */}
          <div style={CARD}>
            <div style={{ fontSize: 10, color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>
              Предпросмотр по слоту
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
              {SLOT_ORDER.map(s => (
                <button key={s} type="button" style={chip(previewSlot === s, SLOT_COLOR[s])} onClick={() => setPreviewSlot(s)}>
                  {SLOT_ICON[s]} {SLOT_LABELS[s]}
                </button>
              ))}
            </div>
            {slotItems.length === 0 ? (
              <div style={{ fontSize: 10, color: DIM }}>Для этого слота блоков нет — добавьте или смените слот у существующих.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {slotItems.map(it => (
                  <div key={it.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{it.title} <span style={{ fontSize: 9, color: DIM, fontWeight: 400 }}>· {it.durationMin} мин</span></div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', lineHeight: 1.45 }}>{it.script}</div>
                      {it.exercises && it.exercises.length > 0 && (
                        <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {it.exercises.slice(0, 6).map((e, i) => (
                            <span key={i} style={{ fontSize: 8, padding: '2px 6px', borderRadius: 8, background: 'rgba(96,165,250,0.1)', color: 'rgba(255,255,255,0.7)' }}>
                              {e.name} {e.reps ? `· ${e.reps}` : ''}
                            </span>
                          ))}
                          {it.exercises.length > 6 && <span style={{ fontSize: 8, color: DIM }}>+{it.exercises.length - 6}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Чек-ин ── */}
          <div style={CARD}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <div style={{ fontSize: 10, color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>Чек-ин мобильности</div>
              {checkinSaved && <span style={{ fontSize: 9, color: ACCENT }}>✓ сохранено · сегодня</span>}
            </div>
            <div style={{ fontSize: 9, color: DIM, marginTop: 2 }}>Выполнил(а) рутину/сессию? Оцени ощущения в суставах 1-5.</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 10 }}>
              <button type="button" style={chip(checkin.done === true)} onClick={() => setCheckin(p => ({ ...p, done: true }))}>✓ Выполнено</button>
              <button type="button" style={chip(checkin.done === false, '#ef4444')} onClick={() => setCheckin(p => ({ ...p, done: false }))}>✕ Не выполнено</button>
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>ROM / ощущения в суставах</span>
                <span style={{ fontSize: 9, color: DIM }}>1 = жёстко, 5 = свободно</span>
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }} role="radiogroup" aria-label="ROM">
                {[1, 2, 3, 4, 5].map(v => (
                  <button key={v} type="button" role="radio" aria-checked={checkin.romScore === v} aria-label={`ROM ${v}`}
                    onClick={() => setCheckin(p => ({ ...p, romScore: v }))}
                    style={{
                      flex: 1, minHeight: 36, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                      border: checkin.romScore === v ? '1px solid rgba(96,165,250,0.5)' : '1px solid rgba(255,255,255,0.08)',
                      background: checkin.romScore === v ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.03)',
                      color: checkin.romScore === v ? '#60a5fa' : 'rgba(255,255,255,0.55)',
                    }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <input aria-label="Заметка чек-ина" style={{ ...IN, marginTop: 8 }} placeholder="заметка: что жёстко, что стало лучше…" value={checkin.note}
              onChange={e => setCheckin(p => ({ ...p, note: e.target.value }))} />
            <button type="button" style={{ ...btn, width: '100%', marginTop: 10 }} onClick={saveCheckin}>💾 Сохранить чек-ин</button>
          </div>

          {/* ── Тренды ── */}
          <div style={CARD}>
            <div style={{ fontSize: 10, color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>
              Тренды мобильности · 30 дней
            </div>
            {trends.count < 2 ? (
              <div style={{ fontSize: 10, color: DIM, lineHeight: 1.5 }}>
                Данных мало (чек-инов: {trends.count}). Отмечайте выполнение после рутины/сессий — появится график ROM и приверженность.
              </div>
            ) : (
              <>
                <MiniLineChart
                  data={trends.series.filter(s => s.romScore !== null).map(s => s.romScore as number)}
                  labels={trends.series.filter(s => s.romScore !== null).map(s => s.date.slice(5))}
                  color="#60a5fa"
                  height={70}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 8 }}>
                  <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: DIM }}>Чек-инов · 30д</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#60a5fa' }}>{trends.count}</div>
                  </div>
                  <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: DIM }}>Средний ROM</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#a78bfa' }}>{trends.avgRom > 0 ? trends.avgRom.toFixed(1) : '—'}</div>
                  </div>
                  <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: DIM }}>Приверженность</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: adherence.pct >= 70 ? '#22c55e' : adherence.pct >= 40 ? '#f59e0b' : '#ef4444' }}>
                      {adherence.total > 0 ? `${adherence.pct}%` : '—'}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 9, color: DIM, marginTop: 6, textAlign: 'center' }}>{adherence.done}/{adherence.total} дней с выполнением за 30 дней</div>
              </>
            )}
          </div>

          {/* ── Инсайты ── */}
          <div style={CARD}>
            <div style={{ fontSize: 10, color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>
              💡 Персональные инсайты
            </div>
            {insights.map((s, i) => (
              <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, padding: '6px 8px', borderRadius: 8, background: 'rgba(96,165,250,0.04)', borderLeft: '2px solid rgba(96,165,250,0.4)', marginBottom: 4 }}>
                {s}
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" style={{ ...ghost, flex: 1, marginTop: 2 }} onClick={refresh} aria-label="Обновить данные">🔄 Обновить данные</button>
        <button type="button" style={{ ...ghost, flex: 1, marginTop: 2, border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa' }} onClick={downloadCSV} aria-label="Скачать CSV чек-инов мобильности">⬇ Чек-ины CSV</button>
        <button type="button" style={{ ...ghost, flex: 1, marginTop: 2, border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa' }} onClick={printReport} aria-label="Печать отчёта мобильности">🖨 Отчёт</button>
        <button type="button" style={{ ...ghost, flex: 1, marginTop: 2 }} onClick={() => {
          if (!active) return;
          try {
            const blob = new Blob([JSON.stringify(active, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mobility_protocol_${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
          } catch { /* ignore */ }
        }} aria-label="Скачать протокол JSON">⬇ JSON</button>
      </div>
    </div>
  );
};

export default MobilityTab;
