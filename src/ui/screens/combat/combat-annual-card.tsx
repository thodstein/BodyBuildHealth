/**
 * combat-annual-card.tsx — ЕДИНЫЙ годовой ATR-блок.
 *
 * Раньше он рендерился дважды почти дословно (CombatPlanView + шаг «Экспорт»
 * конструктора) и разъехался: в экспорте не было селекта приоритета боя, из-за
 * чего второй (secondary) бой оттуда добавить было нельзя. Теперь копия одна.
 */
import React from 'react';
import { SectionCard, CardHeader, Badge, BTN_SMALL, INPUT, CombatPopupSelect, Highlight, PHASE_RU, ruLabel, TEXT_3 } from './CombatUI';

export interface AnnualCardProps {
  annual: any;
  onBuildATR?: () => void;
  annualWeeks?: number;
  setAnnualWeeks?: (n: number) => void;
  annualCycles?: number;
  setAnnualCycles?: (n: number) => void;
  startDate?: string;
  competitionName?: string;
  setCompetitionName?: (s: string) => void;
  competitionDate?: string;
  setCompetitionDate?: (s: string) => void;
  competitionWeight?: string;
  setCompetitionWeight?: (s: string) => void;
  competitionPriority?: 'main' | 'secondary';
  setCompetitionPriority?: (p: 'main' | 'secondary') => void;
  onAddCompetition?: () => void;
  onRemoveCompetition?: (id: string) => void;
  onPrintAnnual?: () => void;
  onDownloadIcs?: () => void;
}

const PHASE_COLOR = (p: string) =>
  p === 'accumulation' ? '#60a5fa' : p === 'transmutation' ? '#a855f7' : p === 'realization' ? '#ff3b30' : '#f59e0b';

/** Дней до ближайшего боя (ISO YYYY-MM-DD). null — боёв нет/дата не разобрана. */
export function daysToFirstFight(annual: any, todayIso?: string): number | null {
  const list = Array.isArray(annual?.competitions) ? annual.competitions : [];
  const dates = list.map((c: any) => c?.date).filter((d: any) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (!dates.length) return null;
  const today = todayIso || new Date().toISOString().slice(0, 10);
  const t = Date.parse(`${today}T00:00:00Z`);
  const d = Date.parse(`${dates[0]}T00:00:00Z`);
  if (!Number.isFinite(t) || !Number.isFinite(d)) return null;
  return Math.round((d - t) / 86400000);
}

export const AnnualCard: React.FC<AnnualCardProps> = (p) => {
  const { annual } = p;
  if (!annual) return null;
  const blocks: any[] = Array.isArray(annual.blocks) ? annual.blocks : [];
  const comps: any[] = Array.isArray(annual.competitions) ? annual.competitions : [];
  const dday = daysToFirstFight(annual);
  const maxBlockWeeks = blocks.reduce((m, b) => Math.max(m, b?.weeks || 0), 0);

  return (
    <div className="cb-plan-annual">
      <SectionCard icon="🗓️" title={`Годовой ATR · ${annual.totalWeeks} нед`} subtitle={`${blocks.length} блоков · синхронизация`} accent>
        <CardHeader
          icon="🗓️"
          title={`Годовой · ${annual.totalWeeks} нед · ${blocks.length} блоков`}
          subtitle={`${annual.discipline ? `${annual.discipline} · ` : ''}тапер строится автоматически`}
          accent
        />
        {dday !== null && (
          <InfoDays dday={dday} firstFight={comps[0]?.name || comps[0]?.date} />
        )}

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {p.onBuildATR && (
            <button onClick={p.onBuildATR} style={{ ...BTN_SMALL, background: 'rgba(168,85,247,0.14)', color: '#d8b4fe', border: '0.5px solid rgba(168,85,247,0.24)' }}>
              ↻ Построить {p.annualWeeks} нед ×{p.annualCycles ?? 1} ц
            </button>
          )}
          {p.setAnnualWeeks && (
            <div style={{ flex: '1 1 140px', minWidth: 0 }}>
              <CombatPopupSelect label="Длина года" value={String(p.annualWeeks)} onChange={v => p.setAnnualWeeks!(Number(v))} options={[
                { id: '12', label: '12 нед' }, { id: '24', label: '24 нед' }, { id: '36', label: '36 нед' }, { id: '52', label: '52 нед' },
              ]} />
            </div>
          )}
          {p.setAnnualCycles && (
            <div style={{ flex: '1 1 140px', minWidth: 0 }}>
              <CombatPopupSelect label="Циклы" value={String(p.annualCycles ?? 1)} onChange={v => p.setAnnualCycles!(Number(v))} options={[
                { id: '1', label: '1 цикл' }, { id: '2', label: '2 цикла' }, { id: '3', label: '3 цикла' }, { id: '4', label: '4 цикла' },
              ]} />
            </div>
          )}
          <Badge color="#a855f7" bg="rgba(168,85,247,0.10)" border="rgba(168,85,247,0.18)">
            {annual.totalWeeks} нед{p.annualCycles && p.annualCycles > 1 ? ` · ${p.annualCycles}ц` : ''}
          </Badge>
          {maxBlockWeeks >= 8 && (
            <Badge color="#f59e0b" bg="rgba(245,158,11,0.10)" border="rgba(245,158,11,0.18)">
              Блок {maxBlockWeeks}н (Issurin 8-13н)
            </Badge>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {blocks.map((b: any) => {
            const col = PHASE_COLOR(b.phase);
            return (
              <span key={b.id} style={{ padding: '5px 8px', borderRadius: 10, fontSize: 10.5, fontWeight: 700, background: `${col}12`, border: `0.5px solid ${col}22`, color: col, fontVariantNumeric: 'tabular-nums' }}>
                <Highlight color={col}>Нед {b.startWeek}-{b.startWeek + b.weeks - 1}</Highlight> · {ruLabel(PHASE_RU, b.phase)} · <Highlight color={col}>{b.weeks}нед</Highlight>{b.fightDate ? ' 🏁' : ''}
              </span>
            );
          })}
        </div>

        <div style={{ display: 'flex', height: 16, borderRadius: 10, overflow: 'hidden', border: '0.5px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.18)' }}>
          {blocks.map((b: any) => {
            const w = ((b.weeks || 0) / Math.max(1, annual.totalWeeks) * 100).toFixed(2);
            const col = PHASE_COLOR(b.phase);
            return (
              <div key={b.id} title={`${b.phase} ${b.weeks}нед`} style={{ width: `${w}%`, background: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {b.weeks}
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 10, color: TEXT_3, display: 'flex', justifyContent: 'space-between', fontVariantNumeric: 'tabular-nums' }}>
          <span>Нед 1 · {p.startDate || '—'}</span>
          <span>Нед {annual.totalWeeks}</span>
        </div>

        {comps.length > 0 && (
          <div style={{ background: 'rgba(239,68,68,0.06)', border: '0.5px solid rgba(239,68,68,0.14)', borderRadius: 12, padding: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#f87171', display: 'flex', alignItems: 'center', gap: 6 }}>
              🏁 Бои <Highlight color="#ff3b30">{comps.length}</Highlight>
            </div>
            {comps.map((c: any) => (
              <div key={c.id} style={{ fontSize: 11, color: '#fff', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Highlight color="#ff3b30">🏁 {c.name}</Highlight> — {c.date} {c.weightClass ? <Highlight>{c.weightClass}</Highlight> : ''}{' '}
                {c.priority === 'secondary' ? <Highlight color="#f59e0b">мини</Highlight> : <Highlight color="#ef4444">main</Highlight>}
                {p.onRemoveCompetition && (
                  <button onClick={() => p.onRemoveCompetition!(c.id)} aria-label={`Удалить бой ${c.name}`} style={{ ...BTN_SMALL, minHeight: 32, padding: '4px 8px', fontSize: 10, background: 'rgba(255,255,255,0.06)', color: '#fff', border: '0.5px solid rgba(255,255,255,0.1)' }}>
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {p.setCompetitionName && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <input placeholder="Название боя" value={p.competitionName} onChange={e => p.setCompetitionName!(e.target.value)} style={{ ...INPUT, flex: 1, minWidth: 140, padding: '8px 10px', fontSize: 16 }} />
            <input type="date" value={p.competitionDate} onChange={e => p.setCompetitionDate!(e.target.value)} style={{ ...INPUT, width: 150, padding: '8px 10px', fontSize: 16 }} />
            <input placeholder="Вес.кат." value={p.competitionWeight} onChange={e => p.setCompetitionWeight!(e.target.value)} style={{ ...INPUT, width: 110, padding: '8px 10px', fontSize: 16 }} />
            {p.setCompetitionPriority && (
              <CombatPopupSelect label="Приоритет боя" value={p.competitionPriority || 'main'} onChange={v => p.setCompetitionPriority!(v as any)} options={[
                { id: 'main', label: 'main · тапер 2нед', desc: 'главный бой' },
                { id: 'secondary', label: 'secondary · мини 1нед', desc: 'второстепенный' },
              ]} />
            )}
            <button onClick={p.onAddCompetition} style={{ ...BTN_SMALL, minHeight: 44, background: '#ef4444', color: '#fff', border: 'none' }}>+ Бой</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {p.onPrintAnnual && (
            <button onClick={p.onPrintAnnual} style={{ ...BTN_SMALL, minHeight: 44, background: 'rgba(255,255,255,0.06)', color: '#fff', border: '0.5px solid rgba(255,255,255,0.08)' }}>🖨 Печать года</button>
          )}
          {p.onDownloadIcs && (
            <button onClick={p.onDownloadIcs} style={{ ...BTN_SMALL, minHeight: 44, background: 'rgba(255,255,255,0.06)', color: '#fff', border: '0.5px solid rgba(255,255,255,0.08)' }}>📅 .ics</button>
          )}
        </div>
      </SectionCard>
    </div>
  );
};

const InfoDays: React.FC<{ dday: number; firstFight: string }> = ({ dday, firstFight }) => {
  const tone = dday < 0 ? '#94a3b8' : dday <= 7 ? '#ef4444' : dday <= 28 ? '#f59e0b' : '#60a5fa';
  const txt = dday < 0 ? `Бой прошёл ${Math.abs(dday)} дн. назад` : dday === 0 ? 'БОЙ СЕГОДНЯ' : `${dday} дн. до боя`;
  return (
    <div data-cb="annual-dday" style={{ display: 'flex', alignItems: 'center', gap: 8, background: `${tone}12`, border: `0.5px solid ${tone}28`, borderRadius: 12, padding: '9px 11px', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, color: '#fff' }}>🏁 {firstFight}</span>
      <span style={{ fontSize: 15, fontWeight: 800, color: tone, fontVariantNumeric: 'tabular-nums' }}>{txt}</span>
    </div>
  );
};
