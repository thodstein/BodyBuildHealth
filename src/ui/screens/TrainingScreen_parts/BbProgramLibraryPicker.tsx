/**
 * BbProgramLibraryPicker.tsx — расширенный пикер готовых программ для ББ-авто конструктора.
 *
 * В отличие от обычного PopupSelect — поддерживает:
 *  - фильтр-чипсы по категории (Все / 🚺 Женские / 💪 Масса / ✂️ Сушка / ⚡ Памп / 🎯 Сила+масса)
 *  - живой поиск по названию/автору/описанию
 *  - раскрываемое описание программы
 *  - группировку по источнику (Библиотека / Авторские / ПРОФ-циклы)
 *
 * Сам компонент берёт готовый список программ (агрегат FULL+WOMENS+CUSTOM+bbCycle)
 * из BbAutoConstructor и не зависит от того, как именно они получены.
 */
import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { cardBtnStyle } from '../SRCBBScreen_parts/TrainingPopups';
import type { FullProgram } from '../../../engines/complete-program-library.engine';

const ACCENT = '#00e68a';

const PortalOverlay: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => {
  if (typeof document === 'undefined') return null;
  return ReactDOM.createPortal(
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 280, display: 'flex',
      alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)',
    }}>
      {children}
    </div>,
    document.body,
  );
};

// P2.14: унификация — канонические значения goal + daysPerWeek + level
type FilterKey = 'all' | 'women' | 'mass' | 'cut' | 'pump' | 'strength_mass' | 'rehab' | 'beginner' | 'intermediate' | 'advanced' | '3d' | '4d' | '5d' | '6d';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'women', label: '🚺 Женские' },
  { key: 'mass', label: '💪 Масса' },
  { key: 'cut', label: '✂️ Сушка' },
  { key: 'pump', label: '🔥 Пампинг' },
  { key: 'strength_mass', label: '🎯 Сила+Масса' },
  { key: 'rehab', label: '⚕️ Реабилитация' },
  { key: 'beginner', label: '🌱 Новичок' },
  { key: 'intermediate', label: '📈 Средний' },
  { key: 'advanced', label: '🏆 Продвинутый' },
  { key: '3d', label: '📅 3 дн' },
  { key: '4d', label: '📅 4 дн' },
  { key: '5d', label: '📅 5 дн' },
  { key: '6d', label: '📅 6 дн' },
];

/** Источник программы — для визуальной пометки в списке. */
function sourceTag(p: FullProgram): { text: string; color: string } | null {
  const id = p.id || '';
  if (id.startsWith('women_')) return { text: '🚺 Ж', color: '#ec4899' };
  if (id.startsWith('bb_cycle_') || id.startsWith('cycle-bb')) return { text: '🏋', color: '#a78bfa' };
  // Всё, что не в полном библиотечном наборе — считаем «авторским/addon»
  // (FULL_PROGRAM_LIBRARY come from complete-program-library.engine без id-префиксов)
  return null;
}

function matchFilter(p: FullProgram, key: FilterKey): boolean {
  if (key === 'all') return true;
  if (key === 'women') return p.id.startsWith('women_') || /женск|жен/i.test(p.name);
  // P2.14: унифицированный goal — теперь ищем по goal в любом регистре
  if (key === 'mass') return /mass|hypertrophy|bodybuilding|масс|гиперт/i.test((p.goal || '') + (p.type || '') + p.name);
  if (key === 'cut') return /peaking|cut|рельеф|сушк/i.test((p.goal || '') + (p.type || '') + p.name);
  if (key === 'pump') return /pump|памп|hypertrophy/i.test((p.goal || '') + (p.type || '') + p.name);
  if (key === 'strength_mass') return /strength_mass|сила \+ масса|powerbuild/i.test((p.goal || '') + (p.type || '') + p.name) || (p.direction === 'both');
  if (key === 'rehab') return p.goal === 'rehab' || /реабил/i.test((p.type || '') + p.name);
  // P2.14: фильтры по уровню
  if (key === 'beginner') return p.level === 'beginner';
  if (key === 'intermediate') return p.level === 'intermediate';
  if (key === 'advanced') return (p.level as string) === 'advanced' || (p.level as string) === 'enhanced';
  // P2.14: фильтры по дням в неделю
  if (key === '3d') return p.daysPerWeek === 3;
  if (key === '4d') return p.daysPerWeek === 4;
  if (key === '5d') return p.daysPerWeek === 5;
  if (key === '6d') return p.daysPerWeek === 6;
  return true;
  return true;
}

export const BbProgramLibraryPicker: React.FC<{
  value: string | null;
  label: string;
  programs: FullProgram[];
  onSelect: (program: FullProgram) => void;
  disabledIds?: string[];
}> = ({ value, label, programs, onSelect, disabledIds }) => {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');

  const deduped = useMemo(() => {
    const seen = new Set<string>();
    const out: FullProgram[] = [];
    for (const p of programs) {
      if (!p || !p.id || seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
    }
    return out;
  }, [programs]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return deduped.filter(p => {
      if (!matchFilter(p, filter)) return false;
      if (s) {
        const hay = `${p.name} ${p.author} ${p.type} ${p.description || ''} ${p.goal} ${p.direction || ''}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [deduped, filter, search]);

  const sel = deduped.find(p => p.id === value);
  const disabled = useMemo(() => new Set(disabledIds || []), [disabledIds]);

  return <>
    <button onClick={() => setOpen(true)} style={{ ...cardBtnStyle(!!value), width: '100%' }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: value ? ACCENT : 'rgba(255,255,255,0.4)' }}>
        {sel ? `${sel.name} · ${sel.durationWeeks} нед · ${sel.daysPerWeek}×/нед · ${sel.level}` : 'Выбрать программу...'}
      </div>
      {value && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>Всего в библиотеке: {deduped.length}</div>}
    </button>
    {open && (
      <PortalOverlay onClose={() => setOpen(false)}>
        <div onClick={e => e.stopPropagation()} style={{
          width: '92%', maxWidth: 460, maxHeight: '80vh', borderRadius: 16,
          background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
        }}>
          <div style={{ height: 3, background: 'linear-gradient(90deg,#00e68a,#00c853)' }} />
          <div style={{ padding: '12px 14px', maxHeight: 'calc(80vh - 3px)', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT }}>{label}</div>
              <button onClick={() => setOpen(false)} style={{
                padding: '4px 8px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.06)',
                color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}>✕</button>
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
              Библиотека: {deduped.length} программ · фильтр: {filtered.length}
            </div>
            <input type='text' value={search} onChange={e => setSearch(e.target.value)} placeholder='🔍 Поиск: название, автор, цель...'
              autoFocus
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)',
                color: '#fff', fontSize: 12, boxSizing: 'border-box', marginBottom: 10,
              }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
              {FILTERS.map(f => {
                const active = filter === f.key;
                return <button key={f.key} onClick={() => setFilter(f.key)} style={{
                  padding: '6px 10px', borderRadius: 999, cursor: 'pointer', fontSize: 10, fontWeight: 700,
                  background: active ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.04)',
                  border: active ? '1px solid rgba(0,230,138,0.4)' : '1px solid rgba(255,255,255,0.06)',
                  color: active ? ACCENT : 'rgba(255,255,255,0.7)',
                }}>{f.label}</button>;
              })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.length === 0 && (
                <div style={{ padding: '20px 12px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
                  Ничего не найдено. Сбросьте фильтр или измените запрос.
                </div>
              )}
              {filtered.map(p => {
                const isSel = p.id === value;
                const isDisabled = disabled.has(p.id);
                const srcTag = sourceTag(p);
                return <button key={p.id} disabled={isDisabled} onClick={() => { if (isDisabled) return; onSelect(p); setOpen(false); }}
                  style={{
                    display: 'block', width: '100%', padding: '9px 11px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    fontSize: 11, fontWeight: isSel ? 700 : 500,
                    background: isSel ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
                    border: isSel ? '1px solid rgba(0,230,138,0.35)' : '1px solid rgba(255,255,255,0.06)',
                    color: isSel ? ACCENT : isDisabled ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.85)',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                    <span style={{ flex: 1 }}>
                      {srcTag && <span style={{ color: srcTag.color, marginRight: 4 }}>{srcTag.text}</span>}
                      {p.name}
                      {isSel && <span style={{ fontSize: 10, marginLeft: 4 }}>✓</span>}
                    </span>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
                      {p.durationWeeks} нед · {p.daysPerWeek}× · {p.level}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 3, fontSize: 9, color: 'rgba(255,255,255,0.45)' }}>
                    {p.type && <span>📋 {p.type}</span>}
                    {p.goal && <span>🎯 {p.goal}</span>}
                    {p.direction && <span>🗺️ {p.direction}</span>}
                  </div>
                  {p.description && (
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 3, lineHeight: 1.4 }}>
                      {p.description.slice(0, 140)}{p.description.length > 140 ? '…' : ''}
                    </div>
                  )}
                  {isDisabled && <div style={{ fontSize: 9, color: 'rgba(255,107,107,0.7)', marginTop: 3 }}>Недоступно для текущей конфигурации</div>}
                </button>;
              })}
            </div>
            <button onClick={() => setOpen(false)} style={{
              width: '100%', marginTop: 12, padding: '10px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
              color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 12, cursor: 'pointer',
            }}>Закрыть</button>
          </div>
        </div>
      </PortalOverlay>
    )}
  </>;
};

export default BbProgramLibraryPicker;