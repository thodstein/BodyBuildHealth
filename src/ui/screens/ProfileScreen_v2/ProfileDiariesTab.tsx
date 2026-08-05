/**
 * ProfileDiariesTab — вкладка "Дневники".
 * Встроенные дневники (в Профиле) + быстрый доступ к дневникам из других блоков.
 */
import React, { useState, useEffect } from 'react';
import { db } from '../../../core/db';
import { getWeightLog, getMeasurementsLog } from '../../../engines/profile-store';
import { AccordionSection, colors } from './ui';

interface QuickLink {
  icon: string;
  label: string;
  description: string;
  target: string;
  color: string;
}

const QUICK_DIARY_LINKS: QuickLink[] = [
  { icon: '🍽', label: 'Дневник питания', description: 'Еда, вес, настроение, заметки', target: 'nutrition-diary', color: colors.green },
  { icon: '🏋️', label: 'Журнал тренировок', description: 'Упражнения, подходы, веса, RPE, RIR', target: 'workout-log', color: colors.blue },
  { icon: '💊', label: 'Мой курс', description: 'Препараты, дозы, недели, расписание', target: 'pharma-course', color: colors.warning },
  { icon: '🛡', label: 'Дневник поддержки', description: 'Заметки, настроение, приём БАДов', target: 'support-diary', color: colors.purple },
  { icon: '🩺', label: 'Симптомы', description: 'Текущие жалобы, тяжесть, динамика', target: 'symptoms', color: colors.pink },
  { icon: '🧪', label: 'Анализы', description: 'Лабораторные показатели по датам', target: 'labs-diary', color: colors.teal },
];

const QUICK_REPORT_LINKS: QuickLink[] = [
  { icon: '🏋️', label: 'Тренер-отчёт', description: 'Аналитика тренировок, прогресс', target: 'training-analytics', color: colors.blue },
  { icon: '💊', label: 'Фарма-отчёт', description: 'Курс, дозы, побочки, анализы', target: 'pharma-reports', color: colors.warning },
  { icon: '🩺', label: 'Врач-отчёт', description: 'Лабораторные показатели, динамика', target: 'labs-reports', color: colors.danger },
  { icon: '🍽', label: 'Отчёт по питанию', description: 'КБЖУ, дневник, планы', target: 'nutrition-reports', color: colors.green },
  { icon: '🛡', label: 'Отчёт поддержки', description: 'Стек, дозы, история', target: 'support-reports', color: colors.purple },
  { icon: '📊', label: 'Кастомный отчёт', description: 'Выборка любых полей', target: 'custom-report', color: colors.orange },
];

export const ProfileDiariesTab: React.FC<{ onNavigate?: (screen: string) => void }> = ({ onNavigate }) => {
  const [stats, setStats] = useState({
    weight: 0, bp: 0, sleep: 0, injection: 0, measurements: 0,
  });
  const [lastDates, setLastDates] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      try {
        const w = getWeightLog();
        const m = getMeasurementsLog();
        const bp = await db.getAll<any>('diary');
        const sleep = bp.filter((d: any) => d.type === 'sleep');
        const injection = bp.filter((d: any) => d.type === 'injection');
        const bpD = bp.filter((d: any) => d.type === 'bp');
        setStats({
          weight: w.length,
          bp: bpD.length,
          sleep: sleep.length,
          injection: injection.length,
          measurements: m.length,
        });
        const lastW = w.length > 0 ? w[w.length - 1].date : '';
        const lastM = m.length > 0 ? m[m.length - 1].date : '';
        const lastBP = bpD.length > 0 ? bpD[bpD.length - 1].date : '';
        const lastSleep = sleep.length > 0 ? sleep[sleep.length - 1].date : '';
        setLastDates({ weight: lastW, measurements: lastM, bp: lastBP, sleep: lastSleep });
      } catch {}
    })();
  }, []);

  const QuickLinkCard: React.FC<{ link: QuickLink }> = ({ link }) => (
    <button
      onClick={() => onNavigate?.(link.target)}
      style={{
        ...glassCard, cursor: 'pointer', border: 'none', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 12, minHeight: 64,
        color: colors.text,
      }}
    >
      <span style={{ fontSize: 24, lineHeight: 1 }}>{link.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: link.color }}>{link.label}</div>
        <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{link.description}</div>
      </div>
      <span style={{ color: colors.textMuted, fontSize: 18 }}>→</span>
    </button>
  );

  const glassCard: React.CSSProperties = {
    background: colors.bg,
    backdropFilter: 'blur(28px) saturate(180%)',
    WebkitBackdropFilter: 'blur(28px) saturate(180%)',
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    padding: 12,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <AccordionSection
        title="Встроенные дневники (в Профиле)"
        subtitle="Сон, замеры тела, давление, инъекции — хранятся локально"
        icon="📓"
        color={colors.orange}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
          <div style={glassCard}>
            <div style={{ fontSize: 12, color: colors.textMuted }}>💤 Сон</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: colors.text, marginTop: 4 }}>{stats.sleep} записей</div>
            <div style={{ fontSize: 10, color: colors.textSubtle, marginTop: 4 }}>
              {lastDates.sleep ? `Последняя: ${lastDates.sleep}` : 'Нет записей'}
            </div>
          </div>
          <div style={glassCard}>
            <div style={{ fontSize: 12, color: colors.textMuted }}>📏 Замеры тела</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: colors.text, marginTop: 4 }}>{stats.measurements} записей</div>
            <div style={{ fontSize: 10, color: colors.textSubtle, marginTop: 4 }}>
              {lastDates.measurements ? `Последняя: ${lastDates.measurements}` : 'Нет записей'}
            </div>
          </div>
          <div style={glassCard}>
            <div style={{ fontSize: 12, color: colors.textMuted }}>❤️ Давление</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: colors.text, marginTop: 4 }}>{stats.bp} записей</div>
            <div style={{ fontSize: 10, color: colors.textSubtle, marginTop: 4 }}>
              {lastDates.bp ? `Последняя: ${lastDates.bp}` : 'Нет записей'}
            </div>
          </div>
          <div style={glassCard}>
            <div style={{ fontSize: 12, color: colors.textMuted }}>⚖️ Вес</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: colors.text, marginTop: 4 }}>{stats.weight} записей</div>
            <div style={{ fontSize: 10, color: colors.textSubtle, marginTop: 4 }}>
              {lastDates.weight ? `Последняя: ${lastDates.weight}` : 'Нет записей'}
            </div>
          </div>
        </div>
      </AccordionSection>

      <AccordionSection
        title="Дневники в других блоках (быстрый доступ)"
        subtitle="Перейти к нужному дневнику одним кликом"
        icon="🔗"
        color={colors.blue}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {QUICK_DIARY_LINKS.map(link => (
            <QuickLinkCard key={link.target} link={link} />
          ))}
        </div>
      </AccordionSection>

      <AccordionSection
        title="Отчёты из других блоков (быстрый доступ)"
        subtitle="Готовые отчёты по модулям приложения"
        icon="📊"
        color={colors.teal}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {QUICK_REPORT_LINKS.map(link => (
            <QuickLinkCard key={link.target} link={link} />
          ))}
        </div>
      </AccordionSection>
    </div>
  );
};
