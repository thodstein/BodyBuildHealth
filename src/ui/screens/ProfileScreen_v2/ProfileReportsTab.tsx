/**
 * ProfileReportsTab — вкладка «📊 Отчёты» Профиля (открывается из hero-карточки «Отчёты»).
 * Подвкладки:
 *  - «Комплексный отчёт» — сводный отчёт для врача/тренера (ReportsScreen).
 *  - «Отчёты по блокам» — быстрые переходы к страницам отчётов модулей приложения
 *    (открывают ИМЕННО страницы отчётов с кнопками генерации, а не главные страницы блоков).
 *  - «Архив отчётов» — сохранённые отчёты всех блоков из localStorage.
 */
import React, { useState, useEffect } from 'react';
import { colors } from './ui';
import { NativeIcon, type NativeIconName } from '../../native/NativeIcons';
import { ReportsScreen } from '../ReportsScreen';

/* ── Источники отчётов блоков (единый список для подвкладок) ── */

export interface ReportSource {
  current: string;
  label: string;
  icon: NativeIconName;
  target: string;
  archiveKeys: string[];
  color: string;
  desc: string;
}

export const REPORT_SOURCES: ReportSource[] = [
  {
    current: 'he_training_report_current',
    label: 'Тренер-отчёт',
    icon: 'dumbbell',
    target: 'training-analytics',
    archiveKeys: ['he_training_reports'],
    color: colors.blue,
    desc: 'Анализ силы, прогрессии, объёма, восстановления',
  },
  {
    current: 'he_nutrition_report_current',
    label: 'Отчёт по питанию',
    icon: 'leaf',
    target: 'nutrition-reports',
    archiveKeys: ['he_nutrition_report_archive'],
    color: colors.green,
    desc: 'КБЖУ за день/неделю/месяц, микронутриенты',
  },
  {
    current: 'he_labs_report_current',
    label: 'Врач-отчёт',
    icon: 'cross',
    target: 'labs-reports',
    archiveKeys: ['he_lab_reports'],
    color: colors.danger,
    desc: 'Анализы: отклонения, динамика по фазам',
  },
  {
    current: 'he_support_reports',
    label: 'Отчёт поддержки',
    icon: 'shield',
    target: 'support-reports',
    archiveKeys: ['he_support_reports_archive', 'he_support_reports'],
    color: colors.purple,
    desc: 'Стек, фазы, перекрёстные риски, совместимость',
  },
  {
    current: 'he_pharma_report_current',
    label: 'Фарма-отчёт',
    icon: 'pill',
    target: 'pharma-reports',
    archiveKeys: ['he_pharma_reports'],
    color: colors.warning,
    desc: 'Оценка курса: баланс, безопасность, длительность',
  },
  {
    current: 'he_risk_report_current',
    label: 'Отчёт по рискам',
    icon: 'alertTriangle',
    target: 'risk-reports',
    archiveKeys: ['he_risk_reports'],
    color: '#f97316',
    desc: 'Риск по системам органов, динамика',
  },
  {
    current: 'he_profile_reports',
    label: 'Комплексный отчёт',
    icon: 'chart',
    target: 'custom-report',
    archiveKeys: ['he_profile_reports'],
    color: colors.orange,
    desc: 'Сводный отчёт по разделам профиля',
  },
];

export interface StoredReport {
  date?: string;
  generatedAt?: string;
  timestamp?: number;
  [key: string]: unknown;
}

/** Собрать ВСЕ сохранённые отчёты источника (текущий + архив). */
export function readReportEntries(src: ReportSource): StoredReport[] {
  const list: StoredReport[] = [];
  const push = (raw: string | null) => {
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) list.push(...parsed);
      else if (parsed) list.push(parsed);
    } catch {}
  };
  push(localStorage.getItem(src.current));
  for (const key of src.archiveKeys) push(localStorage.getItem(key));
  return list;
}

export type ReportsView = 'comprehensive' | 'blocks' | 'archive';

const VIEW_TABS: { id: ReportsView; label: string; icon: NativeIconName; color: string }[] = [
  { id: 'comprehensive', label: 'Комплексный отчёт', icon: 'chart', color: colors.blue },
  { id: 'blocks', label: 'Отчёты по блокам', icon: 'grid', color: colors.teal },
  { id: 'archive', label: 'Архив отчётов', icon: 'inbox', color: colors.orange },
];

export const ProfileReportsTab: React.FC<{
  onNavigate?: (screen: string) => void;
  initialView?: ReportsView;
}> = ({ onNavigate, initialView }) => {
  const [view, setView] = useState<ReportsView>(initialView || 'comprehensive');

  useEffect(() => {
    if (initialView) setView(initialView);
  }, [initialView]);

  return (
    <div className="profile-reports pf-reports" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="profile-reports-tabs pf-rep-tabs" style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', overflowX: 'auto', scrollbarWidth: 'none', padding: 4, margin: -4, borderRadius: 16 }} role="tablist" aria-label="Разделы отчётов">
        {VIEW_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            role="tab"
            aria-selected={view === t.id}
            className="profile-reports-tab pf-rep-tab"
            data-active={view === t.id}
            style={{
              padding: '9px 16px',
              borderRadius: 999,
              cursor: 'pointer',
              fontSize: 12.5,
              fontWeight: 800,
              minHeight: 44,
              flexShrink: 0,
              whiteSpace: 'nowrap',
              border: `1px solid ${view === t.id ? colors.primary : 'rgba(255,255,255,0.10)'}`,
              background: view === t.id ? 'linear-gradient(135deg, rgba(52,211,153,0.28), rgba(52,211,153,0.10))' : 'rgba(255,255,255,0.04)',
              color: view === t.id ? '#fff' : 'rgba(255,255,255,0.65)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              boxShadow: view === t.id ? '0 4px 16px rgba(52,211,153,0.25), inset 0 1px 0 rgba(255,255,255,0.12)' : 'none',
            }}
          >
            <span aria-hidden="true" style={{ display: 'inline-flex', color: view === t.id ? colors.primary : 'rgba(255,255,255,0.5)' }}><NativeIcon name={t.icon} size={13} /></span>
            {t.label}
          </button>
        ))}
      </div>

      {view === 'comprehensive' && (
        <div style={{ padding: '0 0 12px' }}>
          <ReportsScreen />
        </div>
      )}

      {view === 'blocks' && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '-0.2px' }}><span style={{ display: 'inline-flex', color: colors.teal }}><NativeIcon name="grid" size={15} /></span> Отчёты по блокам</div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)', marginBottom: 12, lineHeight: 1.5 }}>
            Переход к страницам отчётов модулей: откроется именно отчёт с кнопкой генерации, а не главная страница блока.
          </div>
          <div role="list" className="profile-reports-list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {REPORT_SOURCES.map((src) => {
              const list = readReportEntries(src);
              const last = list[0];
              return (
                <button
                  key={src.target}
                  onClick={() => onNavigate?.(src.target)}
                  className="profile-reports-item"
                  role="listitem"
                  aria-label={`Открыть ${src.label}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 13,
                    padding: '13px 14px',
                    borderRadius: 18,
                    cursor: 'pointer',
                    textAlign: 'left',
                    minHeight: 68,
                    background: `linear-gradient(135deg, ${src.color}1f, ${src.color}08)`,
                    border: `1px solid ${src.color}40`,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
                    color: colors.text,
                    transition: 'transform 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)';
                  }}
                >
                  <div
                    aria-hidden="true"
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      background: `linear-gradient(135deg, ${src.color}30, ${src.color}10)`,
                      border: `1px solid ${src.color}45`,
                      boxShadow: `0 4px 14px ${src.color}28, inset 0 1px 0 rgba(255,255,255,0.12)`,
                      color: '#fff',
                    }}
                  >
                    <NativeIcon name={src.icon} size={21} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff', letterSpacing: '-0.1px' }}>
                      {src.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 3, lineHeight: 1.4 }}>{src.desc}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                      {list.length === 0
                        ? 'Нет отчётов'
                        : `${list.length} ${list.length === 1 ? 'отчёт' : list.length < 5 ? 'отчёта' : 'отчётов'}${last?.date ? ` · последний ${new Date(last.date).toLocaleDateString('ru-RU')}` : ''}`}
                    </div>
                  </div>
                  <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${src.color}1a`, border: `1px solid ${src.color}35`, color: '#fff', fontSize: 14, fontWeight: 800 }}>→</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {view === 'archive' && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '-0.2px' }}><span style={{ display: 'inline-flex', color: colors.orange }}><NativeIcon name="inbox" size={15} /></span> Архив отчётов</div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)', marginBottom: 12, lineHeight: 1.5 }}>
            Сохранённые отчёты всех блоков. Каждый пункт ведёт к странице отчёта своего модуля.
          </div>
          {REPORT_SOURCES.every((src) => readReportEntries(src).length === 0) ? (
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12.5, padding: 16, textAlign: 'center', borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.14)' }}>📭 Архив отчётов пуст.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {REPORT_SOURCES.flatMap((src) =>
                readReportEntries(src).map((rep, i) => ({ src, rep, key: `${src.target}-${i}` })),
              ).map(({ src, rep, key }) => (
                <button
                  key={key}
                  onClick={() => onNavigate?.(src.target)}
                  aria-label={`Открыть архив: ${src.label}`}
                  className="profile-reports-item"
                  style={{
                    padding: '12px 14px',
                    borderRadius: 15,
                    textAlign: 'left',
                    cursor: 'pointer',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    color: colors.text,
                    minHeight: 56,
                  }}
                >
                  <div style={{ color: '#fff', fontWeight: 800, fontSize: 12.5 }}>{src.label}</div>
                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                    {rep.date ? new Date(rep.date).toLocaleString('ru-RU') : 'Архивный отчёт'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};