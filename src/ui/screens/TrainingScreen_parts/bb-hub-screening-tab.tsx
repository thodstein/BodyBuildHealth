/**
 * bb-hub-screening-tab.tsx — W6: таб «Скрининг» вынесен из BBDiagnosticsHub (бог-файл).
 *
 * Перенос БЕЗ изменений поведения: блок скрин-таба (260 строк) физически перемещён
 * сюда, все имена резолвятся из пропсов-деструктуризации, поэтому тела не тронуты.
 * Документ-разрез: docs/BB-DIAGNOSTICS-HUB-PRO-2-2026-10.md §6 п.6.
 */
import React from 'react';
import { localIsoDate } from '../../../core/local-date';
import { OHS_NORMS } from '../../../engines/strength-sport/strength-sport-ohs.engine';
import { PAIN_LOCATIONS, provocationFor, PAIN_MONITOR_DISCLAIMER } from '../../../engines/bb/bb-pain-monitor.engine';
import { ERIR_DISCLAIMER } from '../../../engines/bb/bb-shoulder-screen.engine';
import { YBT_DISCLAIMER } from '../../../engines/bb/bb-ybt-lq.engine';
import { benchCorrections, BENCH_DISCLAIMER } from '../../../engines/bb/bb-bench-screen.engine';
import { NHE_DISCLAIMER, ADDUCTOR_HONESTY } from '../../../engines/bb/bb-posterior-readiness.engine';
import { HINGE_LOAD_NOTE } from '../../../engines/bb/bb-hinge-screen.engine';
import { SCREENING_DISCLAIMER, VIDEO_GUIDE } from '../../../engines/bb/bb-movement-to-plan.engine';
import { BbCheckCard, BbNum, BbSheetSelect } from './bb-hub-controls';
import type { BBState } from './BBDiagnosticsHub';

export interface BbScreeningTabProps {
  state: BBState;
  setState: React.Dispatch<React.SetStateAction<BBState>>;
  setToast: (v: string) => void;
  touchScreen: () => void;
  ohs: any;
  moveDriver: any;
  singleLeg: any;
  shoulderV: any;
  rotV: any;
  hingeV: any;
  loadedV: any;
  loadedHingeV: any;
  ybtV: any;
  asymText: string;
  driverSubs: any;
  benchV: any;
  painMon: any;
  painJointTendon: any;
  nheV: any;
  adductorV: any;
  erIrV: any;
  screenPriority: string[];
  screenHist: any[];
  setScreenHist: React.Dispatch<React.SetStateAction<any[]>>;
  screenCodes: string[];
  screenDelta: any;
  teenGate: { blocked: boolean; note: string };
  applyMobilityToProfile: () => void;
  trackedRu: (codes: string[]) => string;
}

export const BbScreeningTab: React.FC<BbScreeningTabProps> = (props) => {
  const {
    state, setState, setToast, touchScreen, ohs, moveDriver, singleLeg, shoulderV, rotV,
    hingeV, loadedV, loadedHingeV, ybtV, asymText, driverSubs, benchV, painMon,
  painJointTendon, nheV, adductorV, erIrV, screenPriority, screenHist, setScreenHist,
    screenCodes, screenDelta, teenGate, applyMobilityToProfile, trackedRu,
  } = props;
  return (
            <div data-bb="mobility-tab" onClick={touchScreen}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Скрининг — присед с руками вверх (6 признаков) + одна нога + драйвер
                {!state.screenTouched && <span style={{ color: '#f59e0b' }}> · не пройден: отметь признаки или введи замеры</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }} data-bb="ohs-grid">
                <BbCheckCard active={state.ohsHeelsFlat} title="Пятки плоско" desc="стопы не отрываются" onToggle={() => setState(s => ({ ...s, ohsHeelsFlat: !s.ohsHeelsFlat }))} />
                <BbCheckCard active={!state.ohsKneeValgus} title="Без вальгуса" desc="колени не сводятся" onToggle={() => setState(s => ({ ...s, ohsKneeValgus: !s.ohsKneeValgus }))} />
                <BbCheckCard active={state.ohsHipBelowParallel} title="Таз ниже параллели" desc="глубина приседа" onToggle={() => setState(s => ({ ...s, ohsHipBelowParallel: !s.ohsHipBelowParallel }))} />
                <BbCheckCard active={state.ohsTrunkUpright} title="Корпус вертикально" desc="грудь вверх" onToggle={() => setState(s => ({ ...s, ohsTrunkUpright: !s.ohsTrunkUpright }))} />
                <BbCheckCard active={state.ohsArmsOverMidfoot} title="Руки над стопой" desc="руки над серединой стопы" onToggle={() => setState(s => ({ ...s, ohsArmsOverMidfoot: !s.ohsArmsOverMidfoot }))} />
                <BbCheckCard active={state.ohsLumbarNeutral} title="Нейтраль поясницы" desc="без округления" onToggle={() => setState(s => ({ ...s, ohsLumbarNeutral: !s.ohsLumbarNeutral }))} />
                <BbCheckCard active={!state.ppTilt} title="Таз без «подворота»" desc="глубина до нейтрали таза (не ФАИ-паттерн)" onToggle={() => setState(s => ({ ...s, ppTilt: !s.ppTilt }))} />
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: !state.screenTouched ? 'rgba(255,255,255,0.03)' : ohs.level === 'ok' ? 'rgba(34,197,94,0.08)' : ohs.level === 'warn' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${ohs.level === 'ok' ? 'rgba(34,197,94,0.18)' : ohs.level === 'warn' ? 'rgba(245,158,11,0.18)' : 'rgba(239,68,68,0.18)'}`, marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }} data-bb="ohs-verdict">
                  {state.screenTouched
                    ? `Присед-тест ${ohs.totalScore}/6 · ${ohs.level === 'ok' ? 'хорошо' : ohs.level === 'warn' ? 'есть замечания' : 'нужна работа'} · несдано ${ohs.failed}${ohs.primaryDriver ? ` · ${ohs.primaryDriver}` : ''}`
                    : 'Присед-тест: не пройден — отметь 7 признаков (или введи КТС), иначе результат не считается'}
                </div>
                {state.screenTouched && <div style={{ fontSize: 11, color: '#fff', marginTop: 4 }}>{ohs.recommendation}</div>}
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(0,230,138,0.07)', border: '1px solid rgba(0,230,138,0.16)', marginBottom: 6 }} data-bb="driver-card">
                <div style={{ fontSize: 12, fontWeight: 800, color: '#00e68a' }}>🎯 Драйвер: {moveDriver.label} ({Math.round(moveDriver.confidence * 100)}%)</div>
                <div style={{ fontSize: 11, color: '#fff', marginTop: 4 }}>{moveDriver.fix}</div>
                <div style={{ marginTop: 6 }}>
                  <BbCheckCard active={state.handsOnHipsBetter} title="Руки на бёдрах чистят поясницу" desc="присед с руками на бёдрах лучше — виноваты широчайшие" onToggle={() => setState((s) => ({ ...s, handsOnHipsBetter: !s.handsOnHipsBetter }))} accent="#60a5fa" />
                </div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }} data-bb="single-leg">
                <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Одна нога — сплит-присед + RDL (5 повторов на сторону, качество)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                  <BbSheetSelect label="Сплит-присед Л" value={state.splitL} onChange={(v) => setState((s) => ({ ...s, splitL: v as any }))} options={[{ id: '', label: 'Не проверял' }, { id: 'pass', label: 'Чисто' }, { id: 'fail', label: 'Гуляет' }]} testId="bb-split-l" />
                  <BbSheetSelect label="Сплит-присед П" value={state.splitR} onChange={(v) => setState((s) => ({ ...s, splitR: v as any }))} options={[{ id: '', label: 'Не проверял' }, { id: 'pass', label: 'Чисто' }, { id: 'fail', label: 'Гуляет' }]} testId="bb-split-r" />
                  <BbSheetSelect label="RDL на ноге Л" value={state.rdlL} onChange={(v) => setState((s) => ({ ...s, rdlL: v as any }))} options={[{ id: '', label: 'Не проверял' }, { id: 'pass', label: 'Чисто' }, { id: 'fail', label: 'Гуляет' }]} testId="bb-rdl-l" />
                  <BbSheetSelect label="RDL на ноге П" value={state.rdlR} onChange={(v) => setState((s) => ({ ...s, rdlR: v as any }))} options={[{ id: '', label: 'Не проверял' }, { id: 'pass', label: 'Чисто' }, { id: 'fail', label: 'Гуляет' }]} testId="bb-rdl-r" />
                </div>
                <div style={{ fontSize: 11, color: singleLeg.weakSide ? '#f59e0b' : '#22c55e' }} data-bb="single-leg-verdict">{singleLeg.text}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
                  <BbNum label="Угломер FPPA Л, ° (необязательно)" value={state.fppaL} onChange={(v) => setState(s => ({ ...s, fppaL: v }))} placeholder="—" step={1} testId="bb-fppa-l" />
                  <BbNum label="Угломер FPPA П, ° (необязательно)" value={state.fppaR} onChange={(v) => setState(s => ({ ...s, fppaR: v }))} placeholder="—" step={1} testId="bb-fppa-r" />
                </div>
                <div style={{ fontSize: 10, color: '#fff', opacity: 0.85, marginTop: 4 }}>Угломер — только tiebreak при чистой качественной оценке (разрыв ≥10°). Без угломера вердикт не меняется.</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }} data-bb="shoulder-screen">
                <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Плечо у стены + ротация грудного (жим/ОHP-зона)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                  <BbCheckCard active={state.shBackOnWall} title="Спина на стене" desc="пятки/ягодицы/лопатки плотно" onToggle={() => setState((s) => ({ ...s, shBackOnWall: !s.shBackOnWall }))} />
                  <BbCheckCard active={state.shHeadOnWall} title="Голова на стене" desc="затылок касается, поясница плоская" onToggle={() => setState((s) => ({ ...s, shHeadOnWall: !s.shHeadOnWall }))} />
                  <BbCheckCard active={state.shBicepsAtEars} title="Бицепс у ушей" desc="руки вверх без ухода вперёд" onToggle={() => setState((s) => ({ ...s, shBicepsAtEars: !s.shBicepsAtEars }))} />
                  <BbCheckCard active={state.shRibsDown} title="Рёбра вниз" desc="поясница не прогибается" onToggle={() => setState((s) => ({ ...s, shRibsDown: !s.shRibsDown }))} />
                  <BbCheckCard active={state.shNoShrug} title="Без шрагов" desc="плечи не к ушам" onToggle={() => setState((s) => ({ ...s, shNoShrug: !s.shNoShrug }))} />
                </div>
                <div style={{ fontSize: 11, color: shoulderV.pass ? '#22c55e' : '#f59e0b' }} data-bb="shoulder-verdict">{shoulderV.text}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
                  <BbNum label="Ротация грудного Л, °" value={state.rotL} onChange={(v) => setState(s => ({ ...s, rotL: v }))} placeholder="50" step={1} testId="bb-rot-l" />
                  <BbNum label="Ротация грудного П, °" value={state.rotR} onChange={(v) => setState(s => ({ ...s, rotR: v }))} placeholder="50" step={1} testId="bb-rot-r" />
                </div>
                <div style={{ fontSize: 11, color: '#fff', marginTop: 4 }} data-bb="rot-verdict">{rotV.text}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
                  <BbNum label="ER кг (ручной динам.)" value={state.erKg} onChange={(v) => setState(s => ({ ...s, erKg: v }))} placeholder="—" step={0.5} testId="bb-er-kg" />
                  <BbNum label="IR кг (ручной динам.)" value={state.irKg} onChange={(v) => setState(s => ({ ...s, irKg: v }))} placeholder="—" step={0.5} testId="bb-ir-kg" />
                </div>
                <div style={{ fontSize: 11, color: erIrV.warn ? '#f59e0b' : '#fff', marginTop: 4 }} data-bb="erir-verdict">{erIrV.text}</div>
                {!teenGate.blocked && <div style={{ fontSize: 10, color: '#fff', opacity: 0.85, marginTop: 4 }} data-bb="erir-disclaimer">{ERIR_DISCLAIMER}</div>}
                <div style={{ fontSize: 10, color: '#fff', opacity: 0.85, marginTop: 4 }}>Норма ротации ≥50°/сторона, разрыв ≥10° — чинить слабую. Тест стоя у стены, руки вверх, 3 повтора.</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }} data-bb="hinge-screen">
                <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Шарнир (палка) + присед под нагрузкой</div>
                <BbSheetSelect label="Палка: затылок/лопатки/крестец" value={state.hingeDowel} onChange={(v) => setState((s) => ({ ...s, hingeDowel: v as any }))} options={[{ id: '', label: 'Не проверял' }, { id: 'full', label: 'Держится (3 точки)' }, { id: 'lumbar_loss', label: 'Поясница отрывается' }, { id: 'neck_loss', label: 'Затылок отрывается' }, { id: 'both', label: 'Теряются обе' }]} testId="bb-hinge" />
                <div style={{ fontSize: 11, color: hingeV.pass ? '#22c55e' : '#f59e0b', marginTop: 4 }} data-bb="hinge-verdict">{hingeV.text}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 6 }}>
                  <BbSheetSelect label="Присед без веса" value={state.sqBody} onChange={(v) => setState((s) => ({ ...s, sqBody: v as any }))} options={[{ id: '', label: '—' }, { id: 'pass', label: 'Чисто' }, { id: 'fail', label: 'Плывёт' }]} testId="bb-sq-body" />
                  <BbSheetSelect label="Гриф 20 кг" value={state.sqBar} onChange={(v) => setState((s) => ({ ...s, sqBar: v as any }))} options={[{ id: '', label: '—' }, { id: 'pass', label: 'Чисто' }, { id: 'fail', label: 'Плывёт' }]} testId="bb-sq-bar" />
                  <BbSheetSelect label="Рабочий вес" value={state.sqWork} onChange={(v) => setState((s) => ({ ...s, sqWork: v as any }))} options={[{ id: '', label: '—' }, { id: 'pass', label: 'Чисто' }, { id: 'fail', label: 'Плывёт' }]} testId="bb-sq-work" />
                </div>
                <div style={{ fontSize: 11, color: loadedV.degraded ? '#f59e0b' : '#fff', marginTop: 4 }} data-bb="loaded-verdict">{loadedV.text}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
                  <BbSheetSelect label="RDL под весом" value={state.rdlLoaded} onChange={(v) => setState((s) => ({ ...s, rdlLoaded: v as any }))} options={[{ id: '', label: '—' }, { id: 'pass', label: 'Нейтраль держится' }, { id: 'fail', label: 'Поясница уходит' }]} testId="bb-rdl-loaded" />
                  <BbSheetSelect label="Тяга с пола" value={state.floorLoaded} onChange={(v) => setState((s) => ({ ...s, floorLoaded: v as any }))} options={[{ id: '', label: '—' }, { id: 'pass', label: 'Нейтраль держится' }, { id: 'fail', label: 'Поясница уходит' }]} testId="bb-floor-loaded" />
                </div>
                <div style={{ fontSize: 11, color: loadedHingeV.degraded ? '#f59e0b' : '#fff', marginTop: 4 }} data-bb="loaded-hinge-verdict">{loadedHingeV.text}</div>
                {!teenGate.blocked && <div style={{ fontSize: 10, color: '#fff', opacity: 0.85, marginTop: 4 }} data-bb="hinge-load-note">{HINGE_LOAD_NOTE}</div>}
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }} data-bb="ybt-screen">
                <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>YBT-баланс (3 направления, босиком)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  <BbNum label="Anterior Л, см" value={state.ybtL} onChange={(v) => setState(s => ({ ...s, ybtL: v }))} placeholder="—" step={0.5} testId="bb-ybt-l" />
                  <BbNum label="Anterior П, см" value={state.ybtR} onChange={(v) => setState(s => ({ ...s, ybtR: v }))} placeholder="—" step={0.5} testId="bb-ybt-r" />
                  <BbNum label="Длина конечности, см (ASIS→лодыжка)" value={state.limbCm} onChange={(v) => setState(s => ({ ...s, limbCm: v }))} placeholder="—" step={0.5} testId="bb-limb" />
                  <BbNum label="Posteromedial Л, см" value={state.ybtPmL} onChange={(v) => setState(s => ({ ...s, ybtPmL: v }))} placeholder="—" step={0.5} testId="bb-ybt-pm-l" />
                  <BbNum label="Posteromedial П, см" value={state.ybtPmR} onChange={(v) => setState(s => ({ ...s, ybtPmR: v }))} placeholder="—" step={0.5} testId="bb-ybt-pm-r" />
                  <BbNum label="Posterolateral Л, см" value={state.ybtPlL} onChange={(v) => setState(s => ({ ...s, ybtPlL: v }))} placeholder="—" step={0.5} testId="bb-ybt-pl-l" />
                  <BbNum label="Posterolateral П, см" value={state.ybtPlR} onChange={(v) => setState(s => ({ ...s, ybtPlR: v }))} placeholder="—" step={0.5} testId="bb-ybt-pl-r" />
                  <BbNum label="Голень, см (справочно)" value={state.shinCm} onChange={(v) => setState(s => ({ ...s, shinCm: v }))} placeholder="—" step={0.5} testId="bb-shin" />
                </div>
                <div style={{ fontSize: 11, color: ybtV.warn ? '#f59e0b' : '#fff', marginTop: 4 }} data-bb="ybt-verdict">{ybtV.text}</div>
                <div style={{ fontSize: 10, color: '#fff', opacity: 0.85, marginTop: 4 }} data-bb="ybt-disclaimer">{YBT_DISCLAIMER} · пороги: асимметрия anterior &gt;4 см, композит &lt;94% (по 3 направлениям).</div>
                <div style={{ fontSize: 11, color: '#fff', marginTop: 4 }} data-bb="asym-priority">{asymText}</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }} data-bb="bench-screen">
                <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Жим лёжа — хват и техника (главный плечевой риск)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                  <BbNum label="Хват, см (между указательными)" value={state.benchGripCm} onChange={(v) => setState(s => ({ ...s, benchGripCm: v }))} placeholder="—" step={1} testId="bb-bench-grip" />
                  <BbNum label="Отведение плеча, °" value={state.benchAbduction} onChange={(v) => setState(s => ({ ...s, benchAbduction: v }))} placeholder="—" step={1} testId="bb-bench-abd" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                  <BbSheetSelect label="Точка касания" value={state.benchTouch} onChange={(v) => setState((s) => ({ ...s, benchTouch: v as any }))} options={[{ id: '', label: 'Не проверял' }, { id: 'nipple', label: 'Линия сосков' }, { id: 'upper_abs', label: 'Живот (арка)' }, { id: 'neck', label: 'У шеи' }]} testId="bb-bench-touch" />
                  <BbSheetSelect label="Лопатки" value={state.benchScapula} onChange={(v) => setState((s) => ({ ...s, benchScapula: v as any }))} options={[{ id: '', label: '—' }, { id: 'retracted', label: 'Сведены' }, { id: 'neutral', label: 'Нейтрально' }, { id: 'released', label: 'Распущены' }]} testId="bb-bench-scapula" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                  <BbCheckCard active={!state.benchElbowsBelow} title="Локти не ниже скамьи" desc="плечо в безопасном коридоре" onToggle={() => setState(s => ({ ...s, benchElbowsBelow: !s.benchElbowsBelow }))} />
                  <BbCheckCard active={!state.benchPain} title="Без боли в жиме" desc="боль → техника + правило боли" accent="#ef4444" onToggle={() => setState(s => ({ ...s, benchPain: !s.benchPain }))} />
                </div>
                <div style={{ fontSize: 11, color: benchV.level === 'fix' ? '#f59e0b' : '#fff' }} data-bb="bench-verdict">{benchV.text}</div>
                {benchCorrections(benchV).length > 1 && (
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 10, color: '#fff', lineHeight: 1.5 }} data-bb="bench-fixes">
                    {benchCorrections(benchV).map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                )}
                <div style={{ fontSize: 10, color: '#fff', opacity: 0.85, marginTop: 4 }} data-bb="bench-disclaimer">{BENCH_DISCLAIMER}{benchV.gripBaw != null ? ` · хват ${benchV.gripBaw} BAW` : ' · BAW — из ширины плеч в «Пропорциях»'}</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }} data-bb="pain-monitor">
                <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Боль-мониторинг (правило ≤5 днём / &lt;5 утром)</div>
                <BbSheetSelect label="Локация боли" value={state.pmLoc} onChange={(v) => setState((s) => ({ ...s, pmLoc: v as any }))} options={[{ id: '', label: 'Не заполнено' }, ...PAIN_LOCATIONS.map((p) => ({ id: p.id, label: p.label }))]} testId="bb-pm-loc" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6, marginBottom: 6 }}>
                  <BbNum label="Боль во время, 0–10" value={state.pmDuring} onChange={(v) => setState(s => ({ ...s, pmDuring: v }))} placeholder="—" step={1} testId="bb-pm-during" />
                  <BbNum label="Боль на утро, 0–10" value={state.pmMorning} onChange={(v) => setState(s => ({ ...s, pmMorning: v }))} placeholder="—" step={1} testId="bb-pm-morning" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
                  <BbCheckCard active={!state.pmRising} title="Не растёт по неделям" desc="тренд стабилен/падает" onToggle={() => setState(s => ({ ...s, pmRising: !s.pmRising }))} accent="#f59e0b" />
                  <BbCheckCard active={!state.pmNight} title="Без ночной боли" desc="ночью не беспокоит" accent="#ef4444" onToggle={() => setState(s => ({ ...s, pmNight: !s.pmNight }))} />
                  <BbCheckCard active={!state.pmSharp} title="Без резкой боли" desc="боль тупая, не «прострел»" accent="#ef4444" onToggle={() => setState(s => ({ ...s, pmSharp: !s.pmSharp }))} />
                </div>
                <div style={{ fontSize: 11, color: painMon.verdict.level === 'red' ? '#ef4444' : painMon.verdict.level === 'yellow' ? '#f59e0b' : '#fff' }} data-bb="pm-verdict">{painMon.verdict.text}</div>
                {painMon.verdict.tested && <div style={{ fontSize: 11, color: '#fff', marginTop: 4 }} data-bb="pm-advice">{painMon.verdict.advice}</div>}
                {state.pmLoc && <div style={{ fontSize: 10, color: '#fff', opacity: 0.85, marginTop: 4 }} data-bb="pm-provocation">Провокация: {provocationFor(state.pmLoc)}</div>}
                {painJointTendon && <div style={{ fontSize: 11, color: '#fff', marginTop: 4 }} data-bb="pm-tendon">{painJointTendon.text}</div>}
                <div style={{ fontSize: 10, color: '#fff', opacity: 0.85, marginTop: 4 }} data-bb="pm-disclaimer">{PAIN_MONITOR_DISCLAIMER}</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }} data-bb="posterior-readiness">
                <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Задняя цепь — NHE (эксцентрик) + аддукторы</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
                  <BbNum label="NHE повторов Л" value={state.nheL} onChange={(v) => setState(s => ({ ...s, nheL: v }))} placeholder="—" step={1} testId="bb-nhe-l" />
                  <BbNum label="NHE повторов П" value={state.nheR} onChange={(v) => setState(s => ({ ...s, nheR: v }))} placeholder="—" step={1} testId="bb-nhe-r" />
                  <BbNum label="Контроль до угла, °" value={state.nheAngle} onChange={(v) => setState(s => ({ ...s, nheAngle: v }))} placeholder="—" step={5} testId="bb-nhe-angle" />
                </div>
                <div style={{ fontSize: 11, color: nheV.level === 'ok' || nheV.level === 'not_tested' ? '#fff' : '#f59e0b' }} data-bb="nhe-verdict">{nheV.text}</div>
                <div style={{ fontSize: 10, color: '#fff', opacity: 0.85, marginTop: 4 }} data-bb="nhe-disclaimer">{NHE_DISCLAIMER}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6, marginBottom: 6 }}>
                  <BbNum label="Сжатие аддукторов Л, кг" value={state.addL} onChange={(v) => setState(s => ({ ...s, addL: v }))} placeholder="—" step={1} testId="bb-add-l" />
                  <BbNum label="Сжатие аддукторов П, кг" value={state.addR} onChange={(v) => setState(s => ({ ...s, addR: v }))} placeholder="—" step={1} testId="bb-add-r" />
                </div>
                <BbSheetSelect label="Copenhagen, уровень" value={state.cphLevel} onChange={(v) => setState((s) => ({ ...s, cphLevel: v as any }))} options={[{ id: '', label: '—' }, { id: 'L0', label: 'L0 — изометрия' }, { id: 'L1', label: 'L1 — короткий рычаг' }, { id: 'L2', label: 'L2 — полный' }, { id: 'L3', label: 'L3 — динамика' }]} testId="bb-cph-level" />
                <div style={{ fontSize: 11, color: adductorV.level === 'weak' ? '#f59e0b' : '#fff', marginTop: 4 }} data-bb="adductor-verdict">{adductorV.text}</div>
                <div style={{ fontSize: 10, color: '#fff', opacity: 0.85, marginTop: 4 }} data-bb="adductor-honesty">{ADDUCTOR_HONESTY}</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }} data-bb="scap-video">
                <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Лопатка/боль + видео + замены</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                  <BbCheckCard active={!state.painArc} title="Без боли 60–120°" desc="дуга подъёма чистая" onToggle={() => setState((s) => ({ ...s, painArc: !s.painArc }))} accent="#ef4444" />
                  <BbCheckCard active={!state.scapWinging} title="Лопатка стабильна" desc="без крыловидности" onToggle={() => setState((s) => ({ ...s, scapWinging: !s.scapWinging }))} accent="#60a5fa" />
                </div>
                {(state.painArc || state.scapWinging) && (
                  <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 6 }} data-bb="scap-note">
                    {state.painArc ? 'Боль в дуге 60–120°: жимы над головой и тяги за голову — стоп до врача; нейтральный хват + лицо-тяги. ' : ''}
                    {state.scapWinging ? 'Крыловидность: стена-слайды + серратус (кулак вверх у стены) 2×12, жим — с паузой и сведением.' : ''}
                    Скрининг, не диагноз.
                  </div>
                )}
                <BbCheckCard active={state.videoTwoAngles} title="Видео с 2 ракурсов" desc="5 повторов, босиком, спереди + сбоку" onToggle={() => setState((s) => ({ ...s, videoTwoAngles: !s.videoTwoAngles }))} accent="#a855f7" />
                <div style={{ fontSize: 10, color: '#fff', opacity: 0.85, marginTop: 4 }} data-bb="video-guide">{VIDEO_GUIDE}</div>
                <div style={{ fontSize: 11, color: '#fff', marginTop: 6 }} data-bb="driver-subs">
                  Замены под драйвер: {driverSubs.prefer.length ? driverSubs.prefer.join(' · ') : '—'}
                  {driverSubs.avoid.length ? ` (убрать: ${driverSubs.avoid.join(' · ')})` : ''} — {driverSubs.note}
                </div>
                <div style={{ fontSize: 10, color: '#fff', opacity: 0.85, marginTop: 4 }} data-bb="screening-disclaimer">{SCREENING_DISCLAIMER}</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.16)', marginBottom: 6 }} data-bb="screen-priority">
                <div style={{ fontSize: 12, fontWeight: 800, color: '#00e68a', marginBottom: 4 }}>🧭 Что чинить первым (горизонт 4–6 нед)</div>
                <ol style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: '#fff', lineHeight: 1.5 }}>
                  {screenPriority.map((p, i) => <li key={i}>{p}</li>)}
                </ol>
                {teenGate.blocked && <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4 }} data-bb="teen-gate">{teenGate.note}</div>}
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }} data-bb="screen-history">
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                  <b style={{ fontSize: 11, color: '#fff' }}>📸 Снимки скрининга ({screenHist.length})</b>
                  <button onClick={() => {
                    // П1/R7: снимок v:3 — OHS + D1–D5 + R1–R6 коды (legacy без v / v:2 мигрируют в дельте, не регрессом)
                    const entry = { date: localIsoDate(), fails: screenCodes, v: 3 };
                    setScreenHist((prev) => {
                      const next = [...prev, entry].slice(-10);
                      try { localStorage.setItem('he_bb_screen_history', JSON.stringify(next)); } catch { /* noop */ }
                      return next;
                    });
                    setToast(`✓ Снимок скрининга ${entry.date} сохранён`);
                    setTimeout(() => setToast(''), 2000);
                  }} data-bb="screen-snapshot" style={{ minHeight: 44, padding: '8px 12px', borderRadius: 10, background: 'rgba(0,230,138,0.12)', border: '1px solid rgba(0,230,138,0.22)', color: '#00e68a', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Снимок сегодня</button>
                </div>
                <div style={{ fontSize: 11, color: '#fff' }} data-bb="screen-delta">{screenDelta.text}</div>
                {(screenDelta.tracked?.length ?? 0) > 0 && (
                  <div style={{ fontSize: 10, color: '#fff', marginTop: 2, opacity: 0.9 }} data-bb="screen-tracked" title={screenDelta.tracked.join(', ')}>
                    Новый трекинг: {trackedRu(screenDelta.tracked)}
                  </div>
                )}
                {(() => {
                  try {
                    const last = screenHist.length ? screenHist[screenHist.length - 1] : null;
                    if (!last) return null;
                    const days = Math.floor((Date.now() - new Date(last.date + 'T12:00:00').getTime()) / 86400000);
                    if (days > 42) {
                      return <div style={{ marginTop: 4, color: '#f59e0b' }} data-bb="screen-stale">⏰ Снимку {days} дн — пора перепроверить (норма re-screen 4–6 нед).</div>;
                    }
                    return null;
                  } catch { return null; }
                })()}
                {/* W4: авто-напоминание о re-screen, даже если снимков ещё не делали —
                    опирается на дату прохождения скрининга (screenDoneAt). */}
                {state.screenTouched && state.screenDoneAt && (() => {
                  try {
                    const days = Math.floor((Date.now() - new Date(state.screenDoneAt + 'T12:00:00').getTime()) / 86400000);
                    if (days >= 28) {
                      return <div style={{ marginTop: 4, color: '#f59e0b' }} data-bb="screen-rescreen">⏰ Скрининг пройден {days} дн назад — перепроверь (норма 4–6 нед) и нажми «Снимок сегодня», иначе дельта не построится.</div>;
                    }
                    return null;
                  } catch { return null; }
                })()}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }} data-bb="ankle-grid">
                <BbNum label="КТС левая, см" value={state.ktwL} onChange={(v) => setState(s => ({ ...s, ktwL: v }))} placeholder="12" step={0.5} testId="bb-ktw-l" />
                <BbNum label="КТС правая, см" value={state.ktwR} onChange={(v) => setState(s => ({ ...s, ktwR: v }))} placeholder="12" step={0.5} testId="bb-ktw-r" />
                <BbNum label="Дорсифлексия, °" value={state.ankleDeg} onChange={(v) => setState(s => ({ ...s, ankleDeg: v }))} placeholder="35" step={1} testId="bb-ankle-deg" />
              </div>
              {/* W1: гониометр плеча — заявленная норма 180° теперь реально проверяется
                  (без поля сегмент «руки» не видел ограничения плеча за компенсацией). */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }} data-bb="shoulder-flex">
                <BbNum label="Сгибание плеча, ° (норма 180)" value={state.shoulderFlexDeg} onChange={(v) => setState(s => ({ ...s, shoulderFlexDeg: v }))} placeholder="180" step={1} testId="bb-shoulder-flex" />
                <span style={{ gridColumn: 'span 2', fontSize: 10, color: '#fff', opacity: 0.85, alignSelf: 'center' }}>
                  {ohs.shoulderNote || 'Гониометр: рука вверх у стены, замер по дуге. Без него сегмент «руки» считается как раньше.'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }} data-bb="ankle-straight">
                <BbNum label="КТС прям. колено Л, см" value={state.ktwStraightL} onChange={(v) => setState(s => ({ ...s, ktwStraightL: v }))} placeholder="12" step={0.5} testId="bb-ktw-straight-l" />
                <BbNum label="КТС прям. колено П, см" value={state.ktwStraightR} onChange={(v) => setState(s => ({ ...s, ktwStraightR: v }))} placeholder="12" step={0.5} testId="bb-ktw-straight-r" />
                <BbNum label="Сгибание бедра, °" value={state.hipFlexDeg} onChange={(v) => setState(s => ({ ...s, hipFlexDeg: v }))} placeholder="120" step={1} testId="bb-hip-flex" />
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }} data-bb="heel-row">
                <span style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>Подпятка 2,5 см</span>
                <button onClick={() => setState(s => ({ ...s, heelRetest: 'better' }))} aria-pressed={state.heelRetest === 'better'} data-bb="heel-better" style={{ minHeight: 44, padding: '8px 14px', borderRadius: 999, border: '1px solid', borderColor: state.heelRetest === 'better' ? '#22c55e' : 'rgba(255,255,255,0.12)', background: state.heelRetest === 'better' ? 'rgba(34,197,94,0.14)' : 'rgba(255,255,255,0.04)', color: state.heelRetest === 'better' ? '#22c55e' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Стало лучше</button>
                <button onClick={() => setState(s => ({ ...s, heelRetest: 'same' }))} aria-pressed={state.heelRetest === 'same'} data-bb="heel-same" style={{ minHeight: 44, padding: '8px 14px', borderRadius: 999, border: '1px solid', borderColor: state.heelRetest === 'same' ? '#f59e0b' : 'rgba(255,255,255,0.12)', background: state.heelRetest === 'same' ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.04)', color: state.heelRetest === 'same' ? '#f59e0b' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Без изменений</button>
                <button onClick={() => setState(s => ({ ...s, heelRetest: '' }))} data-bb="heel-reset" style={{ minHeight: 44, padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 12, cursor: 'pointer' }}>Сброс</button>
                <span style={{ fontSize: 11, color: '#fff' }}>Норма ≥{OHS_NORMS.kneeToWallCm.optimal} см · разница Л/П ≥2 см — чинить отстающую</span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <button onClick={applyMobilityToProfile} data-bb="mobility-to-profile" style={{ minHeight: 48, flex: '1 1 200px', padding: '10px 14px', borderRadius: 10, background: ohs.failed > 0 ? 'rgba(59,130,246,0.14)' : 'rgba(34,197,94,0.10)', border: `1px solid ${ohs.failed > 0 ? 'rgba(59,130,246,0.22)' : 'rgba(34,197,94,0.18)'}`, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>→ В профиль {ohs.failed ? `(${ohs.failed}/6)` : '(порядок)'}</button>
              </div>
              <div style={{ fontSize: 11, color: '#fff', marginTop: 6 }}>Скорость/VBT — <b>⚡ Анализ силы</b> · Траектория/углы из видео — <b>ТА/СМ видеоразбор</b> · Суставы — <b>🦴 Суставы и ортопедия</b> · Нагрузка — <b>⚡ Интеллект</b> (здесь только скрининг, без дублей).</div>
          </div>
  );
};
