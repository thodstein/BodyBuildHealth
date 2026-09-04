import React from 'react';

export const SupportGeneratorInfo: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  return (
    <div className="sup-geninfo" style={{ padding:'0 12px 80px', maxWidth:600, margin:'0 auto' }}>
      <h2 style={{ fontSize:16, fontWeight:800, color:'#fff', margin:'0 0 16px' }}>📖 Механизм-ориентированная модель (ТЗ-28)</h2>

      <div style={{ display:'flex', flexDirection:'column', gap:10, fontSize:10, color:'rgba(255,255,255,0.85)', lineHeight:1.6 }}>

        <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
          <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#00e68a' }}>1. Движок — resolvePlan (tz-mapper-engine.ts)</h3>
          <p style={{ margin:'0 0 6px' }}>Подбор поддержки строится на <b>28 механизмах риска ТЗ</b> (cv1–cv5, liv1–liv3, ren1–ren4, cns1–cns6, rep1–rep5, hem1–hem5) по 6 системам организма. Алгоритм:</p>
          <ol style={{ paddingLeft:16, margin:'4px 0' }}>
            <li><b>Фаза курса</b> — определяет протокол: 💉Курс / 🌉Мост / 🔄ПКТ / ⚧TRT (PHASE_PROTOCOL). Влияет на дозовый множитель, набор бустеров и ядерные механизмы</li>
            <li><b>PED-интенсивность</b> — 23 класса (тестостерон, трен, нандролон, оральные 17α, GH, инсулин, IGF, кленбутерол, T3) с potency-факторами. computeIntensityFactor → дозы препаратов поддержки (×1.0 TRT → ×3.0 heavy)</li>
            <li><b>Лаб-тиры</b> — 60+ маркеров с 4 уровнями (норма/грань/лечение/⛔экстрено). TIER 1 → up-титрация, TIER 2 → добавление веществ, TIER 3 → STOP AAS</li>
            <li><b>Активация bridge-механизмов</b> — риск системы + порог уровня (база/средний/макс/буст) → активация 28 механизмов</li>
            <li><b>Подбор через breadth-of-coverage</b> — каждое вещество ранжируется по количеству активированных механизмов, которые оно покрывает. Broad-spectrum (NAC, Mg, D3, цинк, омега-3, CoQ10) выбираются первыми</li>
            <li><b>Синергии</b> — computeSynergy автоматически добавляет партнёра (Iron+VitC, Serra+Natto, D3+K2, NAC+Glycine, Curcumin+Piperine, Berberine+Omega3 и др.)</li>
          </ol>
        </div>

        <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
          <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#00e68a' }}>2. PED-дозо-зависимые протоколы</h3>
          <p style={{ margin:'0 0 6px' }}>Каждый класс PED имеет научно-обоснованный набор поддержки:</p>
          <ul style={{ paddingLeft:16, margin:'4px 0' }}>
            <li><b>Тестостерон</b> — Anastrozole 0.25 мг (250 мг/нед) → 0.5 (500) → 1 мг/день (&gt;1000). Доза AI зависит от дозы T</li>
            <li><b>Нандролон</b> — Nebivolol (β1+NO, объём+HR) + Cabergoline 0.25–0.5 мг + Hesperidin+Diosmin + Dandelion + Astragalus + Cordyceps</li>
            <li><b>Трен</b> — Cabergoline + Nebivolol + Astragalus×1.5 + Cordyceps×1.3 + α-липоевая + Куркумин + Берберин + Dandelion + Hesperidin + Теанин + Глицин (нейропротекция)</li>
            <li><b>Болденон</b> — Serra+Natto+Bromelain (HCT++ mandatory) + Nebivolol</li>
            <li><b>DHT-инъекции</b> — Niacin + Bergamot 1000 (липиды↓↓)</li>
            <li><b>Winstrol</b> — Niacin 1500 + Garlic 1200 + Omega-3 6 г (lipid disaster)</li>
            <li><b>Anadrol</b> — Tamoxifen (не AI!) + Spironolactone + Hesperidin (отёки)</li>
            <li><b>GH (от 4 МЕ)</b> — Berberine 1000–2000 + α-липоевая + Taurine 1000–2000 + Metformin (&gt;6 МЕ) + Astaxanthin + Hesperidin</li>
            <li><b>Инсулин</b> — Berberine 2000 + α-липоевая + Chromium + Mg 600 + Metformin (&gt;20 МЕ)</li>
            <li><b>Кленбутерол</b> — Taurine 5000 + Mg 600 + Potassium (β2-стимуляция вымывает электролиты)</li>
            <li><b>T3/T4</b> — Calcium + D3+K2 + Nebivolol + Melatonin</li>
          </ul>
          <p style={{ margin:'4px 0 0', fontSize:9, color:'var(--text-dim)' }}>Дозы препаратов поддержки масштабируются от интенсивности курса (×1.0 TRT → ×1.5 medium → ×3.0 heavy).</p>
        </div>

        <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
          <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#00e68a' }}>3. Лабораторные тиры (TIER-система)</h3>
          <table style={{ width:'100%', fontSize:9, borderCollapse:'collapse', margin:'4px 0' }}>
            <thead><tr style={{ background:'rgba(0,0,0,0.2)' }}><th style={{ padding:'4px 6px', textAlign:'left' }}>TIER</th><th style={{ padding:'4px 6px' }}>Статус</th><th style={{ padding:'4px 6px' }}>Реакция</th></tr></thead>
            <tbody>
              <tr><td style={{ padding:'4px 6px' }}>0</td><td style={{ padding:'4px 6px' }}>🟢 Норма</td><td style={{ padding:'4px 6px' }}>—</td></tr>
              <tr><td style={{ padding:'4px 6px' }}>1</td><td style={{ padding:'4px 6px' }}>🟡 Грань</td><td style={{ padding:'4px 6px' }}>↑ доза существующего вещества (+Niacin при HDL↓, +TUDCA×2 при ALT↑, ↑Anastrozole при E2↑)</td></tr>
              <tr><td style={{ padding:'4px 6px' }}>2</td><td style={{ padding:'4px 6px' }}>🟠 Лечение</td><td style={{ padding:'4px 6px' }}>➕ новое вещество (TUDCA×2 при ALT 80–200, кровопускание при HCT 54–58, STOP GH при HbA1c&gt;6.4)</td></tr>
              <tr><td style={{ padding:'4px 6px' }}>3</td><td style={{ padding:'4px 6px' }}>🔴 Экстрено</td><td style={{ padding:'4px 6px' }}>⛔ STOP AAS (ALT&gt;200 / HCT&gt;60 / D-dimer&gt;2.5 / Creat&gt;200 / eGFR&lt;30). Камертон при CK&gt;5000 (рабдомиолиз)</td></tr>
            </tbody>
          </table>
          <p style={{ margin:'4px 0 0', fontSize:9, color:'var(--text-dim)' }}>Покрытие: 60+ маркеров (Cardio, Hepatic, Renal, Hematologic, Hormonal, Thyroid, Metabolic, Vitamins/Minerals). Полный словарь в lab-tier-ranges.ts.</p>
        </div>

        <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
          <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#00e68a' }}>4. Противопоказания — 3 источника</h3>
          <p style={{ margin:'0 0 6px' }}>Противопоказания собираются из трёх слоёв данных, дедуплицируются и группируются по веществу:</p>
          <ul style={{ paddingLeft:16, margin:'4px 0' }}>
            <li><b>📋 Каталог</b> — SUPPORT_CATALOG_DATA[].contraindications: «Язва желудка», «Гемохроматоз», «Приём антикоагулянтов»</li>
            <li><b>📏 Правила</b> — CONTRAINDICATIONS[].absolute + relative: «AV-блокада 2-3 ст», «Гиперкалиемия (K⁺&gt;5.0)», «Беременность»</li>
            <li><b>🩺 Условия</b> — checkContraindications по healthConditions пользователя: заболевания → абсолютные/относительные запреты</li>
          </ul>
          <p style={{ margin:'4px 0 0', fontSize:9, color:'var(--text-dim)' }}>Итог: жёлтая карточка «⛔ Противопоказания (N)» под списком веществ с разделением на ⛔ абсолютные и ⚠ относительные.</p>
        </div>

        <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
          <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#00e68a' }}>5. Взаимодействия — матрица пар</h3>
          <p style={{ margin:'0 0 6px' }}>Все пары веществ проверяются через DRUG_INTERACTIONS (drug-interactions.ts) и делятся на 3 уровня:</p>
          <ul style={{ paddingLeft:16, margin:'4px 0' }}>
            <li>⛔ <b>block</b> — нельзя комбинировать (tadalafil+нитраты, AI+тамоксифен, спиро+K⁺). Красная карточка</li>
            <li>⚠ <b>warn</b> — мониторинг (ниацин+статины→КФК, куркума+антикоагулянты→INR). Жёлтая</li>
            <li>🔬 <b>monitor</b> — лабораторный контроль (цинк+медь→1:10, хром+T4→разнести 3ч). Синяя</li>
          </ul>
          <p style={{ margin:'4px 0 0', fontSize:9, color:'var(--text-dim)' }}>Препараты из классов (@statin, @raas, @anticoagulant и др.) автоматически маппятся. Альтернативы указаны где возможно.</p>
        </div>

        <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
          <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#00e68a' }}>6. Менеджер препаратов — добавить/удалить/заменить</h3>
          <p style={{ margin:'0 0 6px' }}>Все манипуляции с планом — через врачебный попап с тремя табами:</p>
          <ul style={{ paddingLeft:16, margin:'4px 0' }}>
            <li>➕ <b>Добавить</b> — поиск по каталогу (SUPPORT_CATALOG_DATA), выбор стека (ALL_STACKS), избранное (localStorage). Мультивыбор</li>
            <li>➖ <b>Удалить</b> — чекбоксы по всем назначенным веществам</li>
            <li>🔄 <b>Заменить</b> — двухшаговый: препарат → замена. Лог изменений с детализацией</li>
          </ul>
          <p style={{ margin:'4px 0 0', fontSize:9, color:'var(--text-dim)' }}>После каждого действия показывается карточка «📝 Изменения» с группировкой (➕ ➖ 🔄). Кнопка «Подтвердить и применить» финализирует изменения.</p>
        </div>

        <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
          <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#00e68a' }}>7. Уровни покрытия и результат</h3>
          <table style={{ width:'100%', fontSize:9, borderCollapse:'collapse', margin:'4px 0' }}>
            <thead><tr style={{ background:'rgba(0,0,0,0.2)' }}><th style={{ padding:'4px 6px', textAlign:'left' }}>Уровень</th><th style={{ padding:'4px 6px' }}>Препаратов</th><th style={{ padding:'4px 6px' }}>Порог риска</th><th style={{ padding:'4px 6px' }}>TIER-реакция</th></tr></thead>
            <tbody>
              <tr><td style={{ padding:'4px 6px' }}>🟢 База</td><td style={{ padding:'4px 6px', textAlign:'center' }}>6–12</td><td style={{ padding:'4px 6px', textAlign:'center' }}>15%</td><td style={{ padding:'4px 6px', textAlign:'center' }}>TIER 1–2</td></tr>
              <tr><td style={{ padding:'4px 6px' }}>🟡 Средний</td><td style={{ padding:'4px 6px', textAlign:'center' }}>12–20</td><td style={{ padding:'4px 6px', textAlign:'center' }}>10%</td><td style={{ padding:'4px 6px', textAlign:'center' }}>TIER 1–2</td></tr>
              <tr><td style={{ padding:'4px 6px' }}>🔴 Максимум</td><td style={{ padding:'4px 6px', textAlign:'center' }}>18–30</td><td style={{ padding:'4px 6px', textAlign:'center' }}>6%</td><td style={{ padding:'4px 6px', textAlign:'center' }}>TIER 1–3</td></tr>
              <tr><td style={{ padding:'4px 6px' }}>🚀 Буст</td><td style={{ padding:'4px 6px', textAlign:'center' }}>25–40</td><td style={{ padding:'4px 6px', textAlign:'center' }}>4%</td><td style={{ padding:'4px 6px', textAlign:'center' }}>TIER 1–3</td></tr>
            </tbody>
          </table>
          <p style={{ margin:'4px 0 0' }}>Результат включает:</p>
          <ul style={{ paddingLeft:16, margin:'4px 0' }}>
            <li>💊 Назначено N препаратов с дозировками и титрациями (↑N%)</li>
            <li>⛔ Противопоказания (каталог + правила + условия)</li>
            <li>⚠ Взаимодействия (block/warn/monitor) на русском</li>
            <li>🧬 Синергия стека (описание синергетических связей)</li>
            <li>🛑 STOP COURSE баннер (красный, TIER 3)</li>
            <li>⚠ TIER alerts (жёлтые, TIER 1–2)</li>
            <li>🥗 Питание по анализам (grid 2×6)</li>
            <li>⚡ Доп. модули: 🦴 Суставы, 🧠 Нейропротекция, 🚀 Усиление</li>
            <li>🩺 Симптомы (8 кнопок: гино, отёки, боль в суставах, бессонница и др.)</li>
          </ul>
        </div>

        <div style={{ borderRadius:12, padding:14, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.2)' }}>
          <h3 style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:'#60a5fa' }}>Актуально — последние доработки подбора</h3>
          <ul style={{ paddingLeft:16, margin:'4px 0', fontSize:10, color:'rgba(255,255,255,0.85)', lineHeight:1.6 }}>
            <li><b>Единый риск-вход:</b> калькулятор и вкладка «Риски» (механизм-модель) используют один строитель TzSpecInput — цифры идентичны до механизма (0-100%, сумма долей = системе).</li>
            <li><b>Под-риски гемато-блока:</b> эритроцитоз / метаболизм / электролиты — из существующих механизмов hem1-hem5, в попапах и мониторинге.</li>
            <li><b>Мониторинг по препаратам поддержки:</b> план сдачи расширяется вместе с назначениями (фибринолитики → коагулограмма, ARB/диуретики → K/Na/eGFR, статины → АЛТ/КФК, метформин → глюкоза, D3/железо → уровень); baseline включает ОАМ, почечный блок, ОАК с СОЭ, ИФР-1, системные панели.</li>
            <li><b>Фарм-матрица 10 классов PED:</b> для каждого активного класса — механизмы, анализы, фаза, поддержка, врач, взаимодействия.</li>
            <li><b>Преаналитика, приём и разнесение:</b> 6 преаналитических факторов, интерференции плана, особые указания по приёму (схема + обоснование), разнесение конфликтующих пар по времени.</li>
            <li><b>Противопоказания и взаимодействия</b> — дедублированы и структурированы; рецептурные помечены «под контролем врача».</li>
            <li><b>Все 435 мех-веществ</b> имеют каталог-описания (полное покрытие, без коротких записей).</li>
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
