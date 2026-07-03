// @ts-nocheck
/**
 * SupportGeneratorInfo.tsx — извлечено из SupportScreen.tsx
 * Секция: protocols
 */
import React from 'react';
import { InfoErrorBoundary } from './SupportScreenData';

export const SupportGeneratorInfo: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const {
    supportLevel
  } = s;

  return (
        <div style={{ padding:'0 12px 80px', maxWidth:600, margin:'0 auto' }}>
          <h2 style={{ fontSize:16, fontWeight:800, color:'#fff', margin:'0 0 16px' }}>📖 Калькулятор поддержки v4 — методология</h2>

          <div style={{ display:'flex', flexDirection:'column', gap:10, fontSize:10, color:'rgba(255,255,255,0.85)', lineHeight:1.6 }}>

            <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#00e68a' }}>1. Сбор данных — Профиль → Данные калькулятора</h3>
              <p style={{ margin:'0 0 6px' }}>Калькулятор собирает данные из 3 источников автоматически:</p>
              <ul style={{ paddingLeft:16, margin:'4px 0' }}>
                <li><b>Профиль → Данные калькулятора:</b> профиль, неврология, фарма-стек, цели, гепатобилиарная, мочевыделительная, ССС, ОДА, питание, противопоказания, токсическая нагрузка, стоматология, генетика (MTHFR, CYP19A1, SRD5A2, AR), ЖКТ, психология, инъекции, эпикриз, журнал — заполняется один раз</li>
                <li><b>Фарма → Курс:</b> препараты, дозы, длительность — из PHARMA_DB с linkedRisks, cvProfile, pd</li>
                <li><b>Анализы (80+ маркеров):</b> АЛТ, АСТ, ЛПНП, гематокрит, эстрадиол и др. — из linked.labs + LAB_MARKER_MAP</li>
              </ul>
              <p style={{ margin:'4px 0 0', fontSize:9, color:'var(--text-dim)' }}>Нажмите «📥 Собрать данные» — калькулятор автоматически подтянет все заполненные данные и покажет чеклист готовности.</p>
            </div>

            <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#00e68a' }}>2. Расчёт рисков — 17 функций по 8 системам</h3>
              <p style={{ margin:'0 0 6px' }}>Для каждой из 8 систем организма вычисляется риск по формуле:</p>
              <p style={{ margin:'0 0 4px', fontSize:9, fontFamily:'monospace', background:'rgba(0,0,0,0.2)', padding:'4px 8px', borderRadius:6 }}>
                Risk<sub>sys</sub> = Σ rProfile + rNeuro + rPharma + rGoals + rHepatic + rRenal + rCardio + rODA + rContraind + rEpicrisis + rToxic + rGenetics + rPsych + rNutrition
              </p>
              <p style={{ margin:'4px 0 0' }}>Каждая функция учитывает специфические факторы:</p>
              <ul style={{ paddingLeft:16, margin:'4px 0' }}>
                <li><b>rPharma:</b> использует данные PHARMA_DB — linkedRisks (сила×направление), cvProfile (АД/ЧСС/тромбоз/ЦНС), pd (гепатотоксичность, нейротоксичность, липиды, HCT)</li>
                <li><b>rLabs:</b> сверяет 80+ маркеров с LAB_MARKER_MAP — отклонения умножают риск системы</li>
                <li><b>rProfile:</b> возраст, ИМТ, % жира, курение, алкоголь, кофеин, тренировочный объём</li>
              </ul>
              <p style={{ margin:'4px 0 0', fontSize:9, color:'var(--text-dim)' }}>Общий риск = max × 0.6 + avg × 0.4 — пиковые риски доминируют (печень 65% не размывается средним).</p>
            </div>

            <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#00e68a' }}>3. Подбор веществ — авто-индексатор (133 механизма × 621 код)</h3>
              <p style={{ margin:'0 0 6px' }}>Цепочка: Риск системы → Активация механизмов → Поиск веществ через авто-индексатор:</p>
              <ol style={{ paddingLeft:16, margin:'4px 0' }}>
                <li><b>Пороговая активация:</b> система с риском ≥ порога (База:15%, Средний:10%, Максимум:6%, Буст:4%) активирует свои механизмы</li>
                <li><b>Авто-индексатор (mechanism-code-bridge.ts):</b> 133 bridge-ключа → 621 код каталога → поиск ВСЕХ веществ с matching mechanisms[]</li>
                <li><b>Ранжирование:</b> tier-приоритет (core &gt; standard &gt; advanced) + синергия с уже выбранными + bestForCourse</li>
                <li><b>Фильтрация:</b> исключение по противопоказаниям, конфликтам и чёрному списку</li>
              </ol>
              <p style={{ margin:'4px 0 0', fontSize:9, color:'var(--text-dim)' }}>При добавлении нового вещества в SUPPORT_CATALOG_DATA с полем mechanisms[] — оно автоматически обнаруживается без ручного маппинга.</p>
            </div>

            <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#00e68a' }}>4. Уровни покрытия</h3>
              <table style={{ width:'100%', fontSize:9, borderCollapse:'collapse', margin:'4px 0' }}>
                <thead><tr style={{ background:'rgba(0,0,0,0.2)' }}><th style={{ padding:'4px 6px', textAlign:'left' }}>Уровень</th><th style={{ padding:'4px 6px' }}>Целевой риск</th><th style={{ padding:'4px 6px' }}>Max/систему</th></tr></thead>
                <tbody>
                  <tr><td style={{ padding:'4px 6px' }}>🟢 База</td><td style={{ padding:'4px 6px', textAlign:'center' }}>55-65%</td><td style={{ padding:'4px 6px', textAlign:'center' }}>2</td></tr>
                  <tr><td style={{ padding:'4px 6px' }}>🟡 Средний</td><td style={{ padding:'4px 6px', textAlign:'center' }}>45-55%</td><td style={{ padding:'4px 6px', textAlign:'center' }}>3</td></tr>
                  <tr><td style={{ padding:'4px 6px' }}>🟠 Максимум</td><td style={{ padding:'4px 6px', textAlign:'center' }}>30-45%</td><td style={{ padding:'4px 6px', textAlign:'center' }}>4</td></tr>
                  <tr><td style={{ padding:'4px 6px' }}>🔴 Буст</td><td style={{ padding:'4px 6px', textAlign:'center' }}>15-30%</td><td style={{ padding:'4px 6px', textAlign:'center' }}>5</td></tr>
                </tbody>
              </table>
              <p style={{ margin:'4px 0 0', fontSize:9, color:'var(--text-dim)' }}>🔥 Усиление: снижает целевой риск на 5% (буст→10%, макс→20%). 🦴 Суставы: отдельный стек, не в основном плане.</p>
            </div>

            <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#00e68a' }}>5. Синергии, стеки и конфликты</h3>
              <ul style={{ paddingLeft:16, margin:'4px 0' }}>
                <li><b>Синергии:</b> вещества с документированными синергиями (SUPPORT_CATALOG_DATA.synergies) получают приоритет при ранжировании</li>
                <li><b>Стеки (52):</b> готовые комбинации с mechanismCodes[] оцениваются по покрытию × synergyScore. Стек с рейтингом ≥70 и синергией ≥80 применяется автоматически</li>
                <li><b>Мг/кг дозировки:</b> NAC 15 мг/кг, TUDCA 10 мг/кг, CoQ10 2 мг/кг, Омега-3 30 мг/кг — 70% по весу + 30% фиксированная</li>
                <li><b>Понедельное титрование:</b> нед.1-2=60%, 3-4=80%, 5-6=90%, 7+=100%. Фарма-препараты: 50%/75%/100%</li>
                <li><b>Конфликты:</b> детектор проверяет все пары через SUPPORT_CATALOG_DATA.conflicts — показывает severity (HIGH/MEDIUM/LOW)</li>
              </ul>
            </div>

            <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#00e68a' }}>6. Персонализация</h3>
              <ul style={{ paddingLeft:16, margin:'4px 0' }}>
                <li><b>Генетика:</b> MTHFR C677T → 5-MTHF + B12; CYP19A1 ↑ → DIM; SRD5A2 ↑ → пальма сереноа; AR ↑/↓ → коррекция</li>
                <li><b>Фаза цикла:</b> 💉Курс / 🌉Мост / 🔄ПКТ / ⚧Фертильность — разные составы поддержки</li>
                <li><b>Лаб-данные:</b> отклонения маркеров → авто-добавление корректирующих веществ (Средний+)</li>
                <li><b>Противопоказания:</b> вещества конфликтующие с заболеваниями пользователя исключаются</li>
              </ul>
            </div>

            <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#00e68a' }}>7. Результат — что вы получаете</h3>
              <ul style={{ paddingLeft:16, margin:'4px 0' }}>
                <li><b>📊 Покрытие рисков:</b> прогресс-бар с риском до/после, недельным масштабом доз</li>
                <li><b>📋 План по времени:</b> таблица Утро/День/Вечер с тирами и дозировками</li>
                <li><b>🔍 Попап вещества:</b> полная карточка (механизм, формы, побочные, мониторинг, синергии, дозировка)</li>
                <li><b>⚡ Синергии:</b> описание синергетических связей в стеке с клиническим обоснованием</li>
                <li><b>⚠️ Конфликты:</b> предупреждения о несовместимых парах</li>
                <li><b>📈 Динамика рисков:</b> бары до/после по 8 системам</li>
                <li><b>🔬 Лаб-находки:</b> отклонения анализов с рекомендованными веществами</li>
                <li><b>🧩 Стеки:</b> рекомендованные комбинации с рейтингом и кнопкой «+ В план»</li>
                <li><b>📅 Таймлайн доз:</b> таблица дозировок по неделям 1→12</li>
                <li><b>📄 Отчёт:</b> структурированный отчёт по плану поддержки</li>
                <li><b>💾 Сохранение:</b> в Мои планы с проверкой дубликатов, копирование заключения</li>
              </ul>
            </div>

            <div style={{ borderRadius:12, padding:14, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
              <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#f59e0b' }}>⚠️ Важно</h3>
              <p style={{ margin:'0 0 4px', fontSize:9, lineHeight:1.3 }}><b>Информация носит ознакомительный характер.</b> Подбор поддержки должен производиться врачом с учётом индивидуальных особенностей.</p>
              <p style={{ margin:'0', fontSize:9, lineHeight:1.3 }}><b>Без лабораторных данных</b> система использует консервативные оценки. Для точного подбора необходимы свежие анализы.</p>
            </div>

          </div>
        </div>
      );
};
