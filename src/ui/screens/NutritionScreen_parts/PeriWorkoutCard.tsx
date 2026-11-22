import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useDataLink } from '../../../core/data-link';
import { ModernHero, modernCardBg } from './nutrition-modern-kit';
import { loadSessions } from '../../../engines/workout-logger.engine';
import { computePeriWorkoutNutrition } from '../../../engines/nutrition-periworkout.engine';
import {
  readPeriSync,
  subscribePeriSync,
  subscribeRationUpdated,
  requestPeriApply,
  writePeriSync,
  clearPeriSync,
  resolvePeriBudget,
} from './IndividualPlan/planner-peri-budget';
import { readPlannedSession } from './IndividualPlan/planner-planned-tonnage';
import { writePlannerPrefsPatch } from './IndividualPlan/planner-prefs';
import { FOOD_DB } from '../../../core/nutrition-database';

const SMALL: React.CSSProperties = { color: '#fff', fontSize: 11, lineHeight: 1.4 };
const CARD: React.CSSProperties = {
  background: '#18181b',
  borderRadius: 14,
  border: '1px solid rgba(0,230,138,0.18)',
  padding: 12,
  marginBottom: 10,
};

const INTENSITY_META = {
  low: { icon: '🧘', label: 'Низкая', desc: 'Восстановительная · техника · кардио', color: '#60a5fa' },
  medium: { icon: '💪', label: 'Средняя', desc: 'Рабочая · обычная силовая', color: '#00e68a' },
  high: { icon: '🔥', label: 'Высокая', desc: 'Тяжёлая · длинная · отказные', color: '#f59e0b' },
} as const;

const SOURCE_META = {
  plan: { icon: '📋', label: 'Из плана тренировок', color: '#00e68a' },
  lastSession: { icon: '🏋️', label: 'По последней сессии', color: '#60a5fa' },
  manual: { icon: '✍️', label: 'Ручной ввод', color: '#a78bfa' },
} as const;

type PopupKind = null | 'intensity' | 'volume' | 'duration';

export const PeriWorkoutCard: React.FC = () => {
  const linked = useDataLink();
  // Вес — из тех же данных, что читает планировщик (personal.weight), иначе бюджет
  // окна считался от другого числа и карточка с рационом расходились.
  const bw = linked.profile?.settings?.personal?.weight || (linked.profile?.settings as any)?.weight || 80;
  const goal = linked.profile?.settings?.primaryGoal || 'strength';
  const training = linked.profile?.settings?.training;
  const pharma = linked.profile?.settings?.pharma;
  const [overrideVol, setOverrideVol] = useState<number>(0);
  const [overrideDur, setOverrideDur] = useState<number>(0);
  const [popup, setPopup] = useState<PopupKind>(null);
  const [draft, setDraft] = useState('');

  // ─── Синхронизация с планом тренировок (he_peri_sync, только по кнопке) ───
  const [syncState, setSyncState] = useState(() => readPeriSync());
  const [rationTick, setRationTick] = useState(0);
  /** Плановый день из he_pl_runtime — источник кнопки «Взять из плана тренировок». */
  const planned = useMemo(() => readPlannedSession(), [rationTick]);
  const last = useMemo(() => loadSessions()[0], [rationTick]);
  // P2-fix: `planned`/`last` жили в useMemo([]) — после перегенерации плана карточка
  // показывала старый тоннаж. Теперь обновляются по событиям синка и перезаписи рациона.
  useEffect(() => {
    const onSync = () => {
      setSyncState(readPeriSync());
      setRationTick((v) => v + 1);
    };
    const un1 = subscribePeriSync(onSync);
    const un2 = subscribeRationUpdated(() => setRationTick((v) => v + 1));
    return () => {
      un1();
      un2();
    };
  }, []);
  /** Что движок РЕАЛЬНО применил в рационе (he_day_plan.peri) — эталон для чисел. */
  const applied = useMemo(() => {
    try {
      const dp: any = JSON.parse(localStorage.getItem('he_day_plan') || 'null');
      const p = dp?.peri;
      if (!p || typeof p !== 'object') return null;
      const a = p.actual && typeof p.actual === 'object' ? p.actual : {};
      const n = (v: any) => Math.round(Number(v) || 0);
      return {
        preCarbG: n(p.preCarbG),
        postCarbG: n(p.postCarbG),
        intraCarbG: n(p.intraCarbG),
        postProteinG: n(p.postProteinG),
        built: {
          prew: !!(p.built && p.built.prew),
          postw: !!(p.built && p.built.postw),
          intra: !!(p.built && p.built.intra),
        },
        // Факт тарелки того дня, что сохранён (ручные правки обновляют he_day_plan).
        actual: {
          preCarbG: n(a.preCarbG),
          postCarbG: n(a.postCarbG),
          intraCarbG: n(a.intraCarbG),
          postProteinG: n(a.postProteinG),
        },
      };
    } catch {
      return null;
    }
  }, [rationTick, syncState]);

  const inferredIntensity =
    (last?.avgIntensity || 0) >= 8
      ? 'high'
      : (last?.avgIntensity || 0) > 0 && (last?.avgIntensity || 0) <= 6
        ? 'low'
        : (training?.minutesPerSession || 60) >= 90
          ? 'high'
          : 'medium';
  const [intensity, setIntensity] = useState<'low' | 'medium' | 'high'>(inferredIntensity);
  const sessionVolume = overrideVol || last?.totalVolume || 0;
  const durationMin = overrideDur || last?.durationMin || 0;

  // Сырой протокол — «рекомендация» без капов (показываем рядом, чтобы не «врать»).
  const plan = useMemo(
    () =>
      computePeriWorkoutNutrition({
        sessionVolume,
        durationMin,
        bodyWeight: bw,
        goal,
        intensity,
        ped: {
          hasInsulin: pharma?.hasInsulin,
          hasGH: pharma?.hasGH,
          hasIGF: pharma?.hasIGF,
          insulinIU: pharma?.insulinIU,
          ghIU: pharma?.ghIU,
        },
      }),
    [
      sessionVolume,
      durationMin,
      bw,
      goal,
      intensity,
      pharma?.hasInsulin,
      pharma?.hasGH,
      pharma?.hasIGF,
      pharma?.insulinIU,
      pharma?.ghIU,
    ],
  );

  // ЕДИНЫЙ бюджет: карточка и движок рациона читают его из одного модуля
  // (`planner-peri-budget`). Приоритет — сохранённый синк (тоннаж из плана),
  // иначе последняя сессия, иначе плановый день.
  const fallback = useMemo(() => {
    if (sessionVolume > 0 || durationMin > 0) {
      return { tonnageKg: sessionVolume, durationMin, intensity, source: 'lastSession' as const };
    }
    if (planned) {
      return {
        tonnageKg: planned.tonnageKg,
        durationMin: planned.durationMin,
        intensity: planned.intensity,
        source: planned.source as any,
        dayLabel: planned.dayLabel,
      };
    }
    return undefined;
  }, [sessionVolume, durationMin, intensity, planned]);

  const budget = useMemo(
    () =>
      resolvePeriBudget({
        bodyWeight: bw,
        goal,
        stored: syncState,
        ped: {
          hasInsulin: pharma?.hasInsulin,
          hasGH: pharma?.hasGH,
          hasIGF: pharma?.hasIGF,
          insulinIU: pharma?.insulinIU,
          ghIU: pharma?.ghIU,
        },
        fallback,
      }),
    [bw, goal, syncState, fallback, pharma?.hasInsulin, pharma?.hasGH, pharma?.hasIGF, pharma?.insulinIU, pharma?.ghIU],
  );

  /** Фактические окна в рационе (he_day_plan) — что человек видит в приёмах. */
  const inRation = useMemo(() => {
    try {
      const dp: any = JSON.parse(localStorage.getItem('he_day_plan') || 'null');
      const meals: any[] = Array.isArray(dp?.meals) ? dp.meals : [];
      const pick = (type: string) => meals.find((m) => m?.type === type);
      const macroOf = (m: any, key: 'c' | 'p') => {
        if (!m) return 0;
        const items = Array.isArray(m.items) ? m.items : [];
        if (items.length === 0) return Math.round(Number(m?.totals?.[key]) || 0);
        return Math.round(
          items.reduce((s: number, it: any) => {
            if (typeof it?.[key] === 'number') return s + it[key];
            const f = FOOD_DB.find((x) => x.id === it?.id);
            const per100 = key === 'c' ? f?.carbs || 0 : f?.protein || 0;
            return s + (per100 * (Number(it?.amount) || 0)) / 100;
          }, 0),
        );
      };
      const pre = pick('preworkout');
      const post = pick('postworkout');
      const intra = pick('intra');
      return {
        has: meals.length > 0,
        preCarbG: macroOf(pre, 'c'),
        postCarbG: macroOf(post, 'c'),
        postProteinG: macroOf(post, 'p'),
        intraCarbG: macroOf(intra, 'c'),
      };
    } catch {
      return { has: false, preCarbG: 0, postCarbG: 0, postProteinG: 0, intraCarbG: 0 };
    }
  }, [rationTick, syncState]);

  /** Кнопка «Взять из плана тренировок» — синк по требованию, без авто-магии. */
  const applyPlanSync = useCallback(() => {
    if (!planned) {
      try {
        (window as any).showToast?.('План тренировок не найден — заполните план в разделе «Тренировки»', 'error');
      } catch {}
      return;
    }
    writePeriSync({
      source: planned.source,
      tonnageKg: planned.tonnageKg,
      durationMin: planned.durationMin,
      intensity: planned.intensity,
      sets: planned.sets,
      dayLabel: planned.dayLabel,
      signature: planned.signature,
    });
    // Тумблер планировщика включаем тоже: иначе рацион не возьмёт бюджет,
    // и «В рационе сейчас» навсегда останется ⚠.
    try {
      writePlannerPrefsPatch({ periSync: true });
    } catch {}
    // И просим пересобрать рацион в ТЕКУЩЕЙ длине плана: иначе окна в приёмах
    // остаются от прошлой генерации (карточка показывала ⚠ «перегенерируйте»).
    requestPeriApply();
    setRationTick((v) => v + 1);
    try {
      (window as any).showToast?.('Пери-воркаут синхронизирован с планом тренировок', 'success');
    } catch {}
  }, [planned]);

  const resetSync = useCallback(() => {
    clearPeriSync();
    setRationTick((v) => v + 1);
  }, []);

  const syncStale = !!syncState?.signature && !!planned?.signature && syncState.signature !== planned.signature;
  const srcMeta = SOURCE_META[(budget?.meta.source || 'lastSession') as keyof typeof SOURCE_META];

  // Карточка показывает ФАКТ рациона (те же числа, что в приёмах), а цель движка —
  // в блоке «В рационе сейчас». При ручной правке тоннажа/длительности/интенсивности
  // честнее пересчёт бюджета — тогда показываем бюджет/протокол.
  const _sessionEdited = overrideVol > 0 || overrideDur > 0 || (!!syncState && intensity !== syncState.intensity);
  const appliedNum = applied && !_sessionEdited ? applied : null;
  // Числа окон = ФАКТ рациона (ровно как в приёмах): карточка и рацион не расходятся.
  // Пока движок не применил бюджет (applied нет) — показываем бюджет/протокол.
  const factOf = (k: 'preCarbG' | 'postCarbG' | 'intraCarbG' | 'postProteinG'): number | null => {
    if (!appliedNum) return null;
    const live = (inRation as any)?.[k];
    return inRation.has && typeof live === 'number' ? Math.round(live) : appliedNum.actual[k];
  };
  const dispPreCarb = factOf('preCarbG') ?? (budget ? budget.preCarbG : plan.pre.carbsG);
  const dispPostCarb = factOf('postCarbG') ?? (budget ? budget.postCarbG : plan.post.carbsG);
  const dispPostProtein = factOf('postProteinG') ?? (budget ? budget.postProteinG : plan.post.proteinG);
  const dispIntraPerH = budget ? budget.intraCarbGPerH : plan.intra.carbsGPerH;
  const dispVol = overrideVol || (budget?.meta.tonnageKg ?? sessionVolume);
  const dispDur = overrideDur || (budget?.meta.durationMin ?? durationMin);
  // Движок считает окно «во время» в ГРАММАХ: г/ч × длительность, с капом ёмкости
  // (40 г/ч, 30–90 г). Бюджет отдаёт уже посчитанную сумму — сравнение честное.
  const dispIntraG =
    factOf('intraCarbG') ?? (budget ? budget.intraCarbG : Math.round((dispIntraPerH * (dispDur || 60)) / 60));
  /** Движок не строил интра-окно (короткая сессия / интра выключена) — не обещаем граммы. */
  const intraNotBuilt = !!appliedNum && !appliedNum.built.intra;
  // «Сколько влезает в окно» — цель, которую поставил движок (не факт тарелки).
  const capPre = appliedNum ? appliedNum.preCarbG : dispPreCarb;
  const capPost = appliedNum ? appliedNum.postCarbG : dispPostCarb;
  const capIntra = appliedNum ? appliedNum.intraCarbG : dispIntraG;

  const openPopup = useCallback(
    (kind: Exclude<PopupKind, null>) => {
      if (kind === 'volume') setDraft(String(overrideVol || budget?.meta.tonnageKg || last?.totalVolume || ''));
      if (kind === 'duration') setDraft(String(overrideDur || budget?.meta.durationMin || last?.durationMin || ''));
      setPopup(kind);
    },
    [overrideVol, overrideDur, budget, last?.totalVolume, last?.durationMin],
  );

  const closePopup = useCallback(() => setPopup(null), []);

  const saveDraft = useCallback(() => {
    const v = Math.round(Number(draft) || 0);
    if (popup === 'volume') setOverrideVol(Math.max(0, Math.min(100000, v)));
    if (popup === 'duration') setOverrideDur(Math.max(0, Math.min(300, v)));
    setPopup(null);
  }, [draft, popup]);

  const intMeta = INTENSITY_META[intensity];

  const rowBtn: React.CSSProperties = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.07)',
    background: '#202023',
    color: '#fff',
    cursor: 'pointer',
    minHeight: 56,
    textAlign: 'left',
  };

  /** Строка сравнения «бюджет vs рацион» — общий вид для трёх окон. */
  const compareRow = (label: string, icon: string, want: number, actual: number, unit: string) => {
    const ok = Math.abs(want - actual) <= Math.max(8, Math.round(want * 0.15));
    const col = ok ? '#86efac' : '#fbbf24';
    return (
      <div
        key={label}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 8px',
          borderRadius: 8,
          background: ok ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.08)',
          border: `1px solid ${ok ? 'rgba(34,197,94,0.16)' : 'rgba(245,158,11,0.2)'}`,
        }}
      >
        <span style={{ fontSize: 12 }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', flex: 1 }}>{label}</span>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
          {actual}
          <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}> / {want}</span> {unit}
        </span>
        <span style={{ fontSize: 11, color: col, fontWeight: 900 }}>{ok ? '✅' : '⚠'}</span>
      </div>
    );
  };

  return (
    <div className="nut-peri" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <ModernHero
        icon="🥤"
        title="Пери-воркаут"
        subtitle="Углеводы/белок/жидкость до/во время/после — на основе тоннажа, длительности и массы тела. Синхронизация с планом тренировок — по кнопке."
        stats={[
          { k: 'Масса', v: bw + 'кг', sub: goal, col: '#00e68a', bg: 'rgba(0,230,138,0.08)' },
          {
            k: 'Тоннаж',
            v: dispVol ? Math.round(dispVol / 1000) + 'т' : '—',
            sub: budget?.meta.source === 'plan' ? 'из плана' : 'кг·повт',
            col: '#60a5fa',
            bg: 'rgba(96,165,250,0.08)',
          },
          {
            k: 'Длит.',
            v: dispDur ? dispDur + 'м' : '—',
            sub: intMeta.label,
            col: '#f59e0b',
            bg: 'rgba(245,158,11,0.08)',
          },
        ]}
      />

      {/* ─── Синхронизация с планом тренировок ─── */}
      <div
        style={{
          ...modernCardBg,
          padding: 12,
          border: syncState ? '1px solid rgba(0,230,138,0.22)' : '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: `${srcMeta.color}1f`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
            }}
          >
            🔗
          </span>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Синхронизация с планом</div>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 9,
              padding: '3px 8px',
              borderRadius: 999,
              background: `${srcMeta.color}18`,
              color: srcMeta.color,
              border: `1px solid ${srcMeta.color}30`,
              fontWeight: 700,
            }}
          >
            {srcMeta.icon} {srcMeta.label}
          </span>
        </div>

        {syncState ? (
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: 8 }}>
            {syncState.dayLabel ? (
              <span style={{ color: '#fff', fontWeight: 700 }}>{syncState.dayLabel} · </span>
            ) : null}
            {Math.round(syncState.tonnageKg).toLocaleString('ru-RU')} кг·повт · {syncState.durationMin} мин ·{' '}
            {INTENSITY_META[syncState.intensity].label.toLowerCase()}
            {syncState.sets ? ` · ${syncState.sets} сетов` : ''}
            {syncStale ? (
              <div style={{ color: '#fbbf24', fontWeight: 700, marginTop: 4 }}>
                ⚠ План тренировок изменился после синка — нажмите «Взять из плана» заново.
              </div>
            ) : null}
          </div>
        ) : (
          <div
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.55)',
              lineHeight: 1.5,
              marginBottom: 8,
            }}
          >
            {planned
              ? `План тренировок найден: ${planned.dayLabel || 'день'} · ${Math.round(planned.tonnageKg).toLocaleString('ru-RU')} кг·повт · ${planned.durationMin} мин. Нажмите кнопку, чтобы рацион взял эти окна.`
              : 'План тренировок не найден — окна считаются по последней завершённой сессии.'}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={applyPlanSync}
            aria-label="Взять пери-окна из плана тренировок"
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(135deg,#00e68a,#00c8a0)',
              color: '#000',
              fontWeight: 800,
              fontSize: 11,
              cursor: 'pointer',
              minHeight: 44,
            }}
          >
            🔄 Взять из плана тренировок
          </button>
          {syncState ? (
            <button
              onClick={resetSync}
              aria-label="Сбросить синхронизацию"
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.7)',
                fontWeight: 700,
                fontSize: 11,
                cursor: 'pointer',
                minHeight: 44,
              }}
            >
              Сбросить
            </button>
          ) : null}
        </div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4, marginTop: 6 }}>
          Карточка и рацион используют один бюджет: окно получает не больше своей ёмкости (до 60 г / после 75 г),
          остаток углеводов остаётся в основных приёмах — дневная сумма не меняется.
        </div>
      </div>

      {/* Настройки сессии — один блок, значения вводятся через попапы */}
      <div style={{ ...modernCardBg, padding: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Настройки сессии</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => openPopup('intensity')}
            aria-label="Выбрать интенсивность"
            aria-haspopup="dialog"
            className="nut-peri-intbtn"
            style={{ ...rowBtn, borderColor: `${intMeta.color}44` }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: `${intMeta.color}1f`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              {intMeta.icon}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: 'block',
                  fontSize: 8,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.45)',
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                }}
              >
                Интенсивность
              </span>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: intMeta.color }}>
                {intMeta.label}{' '}
                <span style={{ fontWeight: 500, fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>· {intMeta.desc}</span>
              </span>
            </span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>›</span>
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              onClick={() => openPopup('volume')}
              aria-label="Ввести тоннаж"
              aria-haspopup="dialog"
              className="nut-peri-volbtn"
              style={rowBtn}
            >
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: 'rgba(96,165,250,0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                🏋️
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 8,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.45)',
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                  }}
                >
                  Тоннаж
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 800,
                    color: '#fff',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {dispVol ? `${Math.round(dispVol).toLocaleString('ru-RU')} кг` : '—'}
                </span>
              </span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>›</span>
            </button>
            <button
              onClick={() => openPopup('duration')}
              aria-label="Ввести длительность"
              aria-haspopup="dialog"
              className="nut-peri-durbtn"
              style={rowBtn}
            >
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: 'rgba(245,158,11,0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                ⏱
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 8,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.45)',
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                  }}
                >
                  Длит.
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 800,
                    color: '#fff',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {dispDur ? `${dispDur} мин` : '—'}
                </span>
              </span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>›</span>
            </button>
          </div>
          <div style={{ ...SMALL, color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>
            Авто: по плану тренировок (включён синк) или по avg RPE последней сессии; тап по строке — точный ввод.
          </div>
        </div>
        {last ? (
          <div
            style={{
              marginTop: 10,
              padding: '8px 10px',
              borderRadius: 10,
              background: 'rgba(96,165,250,0.06)',
              border: '1px solid rgba(96,165,250,0.12)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                background: 'rgba(96,165,250,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
              }}
            >
              🏋️
            </span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>
                {last.date} · {last.focus}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>
                {Math.round(last.totalVolume)} кг·повт · {last.durationMin} мин · {last.totalSets} сетов
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              marginTop: 10,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.02)',
              border: '1px dashed rgba(255,255,255,0.06)',
              textAlign: 'center',
              fontSize: 10,
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            Нет тренировок — введи тоннаж/длительность вручную, синхронизируй план или заверши тренировку в блоке
            Тренировки.
          </div>
        )}
      </div>

      {dispVol > 0 || dispDur > 0 ? (
        <>
          <div style={{ ...modernCardBg, padding: 12, border: '1px solid rgba(245,158,11,0.14)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'rgba(245,158,11,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                }}
              >
                ⏰
              </span>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>До тренировки</div>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 9,
                  padding: '3px 7px',
                  borderRadius: 999,
                  background: 'rgba(245,158,11,0.10)',
                  color: '#f59e0b',
                  border: '1px solid rgba(245,158,11,0.18)',
                }}
              >
                {plan.pre.timing}
              </span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b' }}>
              {dispPreCarb}г{' '}
              <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>углеводов</span>
            </div>
            {budget && Math.round(budget.recommended.preCarbG) > capPre + 2 ? (
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                протокол рекомендует {Math.round(budget.recommended.preCarbG)} г — в окно влезает до {capPre} г
              </div>
            ) : null}
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 6, lineHeight: 1.4 }}>
              {plan.pre.note}
            </div>
          </div>
          <div style={{ ...modernCardBg, padding: 12, border: '1px solid rgba(96,165,250,0.14)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'rgba(96,165,250,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                }}
              >
                💧
              </span>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa' }}>Во время</div>
            </div>
            {intraNotBuilt ? (
              <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa' }}>В рационе интра-окно не строится</div>
            ) : (
              <div style={{ fontSize: 18, fontWeight: 800, color: '#60a5fa' }}>
                {dispIntraPerH > 0 ? `${dispIntraG}г` : 'без углеводов'}{' '}
                <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>
                  · {dispIntraPerH} г/ч · {plan.intra.fluidMlPerH} мл/ч
                </span>
              </div>
            )}
            {intraNotBuilt ? (
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                Движок строит окно «во время» только для сессии ≥75 мин при включённом интра-питании — здесь его нет,
                поэтому и граммов в рационе нет.
              </div>
            ) : null}
            {!intraNotBuilt && budget && budget.recommended.intraCarbG > capIntra ? (
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                рекомендация протокола {budget.recommended.intraCarbG} г — в окно влезает до {capIntra} г (ёмкость{' '}
                {budget.intraCapG} г при {budget.meta.durationMin} мин)
              </div>
            ) : null}
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 6, lineHeight: 1.4 }}>
              {plan.intra.note}
            </div>
          </div>
          <div style={{ ...modernCardBg, padding: 12, border: '1px solid rgba(0,230,138,0.14)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'rgba(0,230,138,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                }}
              >
                🔄
              </span>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#00e68a' }}>После</div>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 9,
                  padding: '3px 7px',
                  borderRadius: 999,
                  background: 'rgba(0,230,138,0.10)',
                  color: '#00e68a',
                  border: '1px solid rgba(0,230,138,0.18)',
                }}
              >
                {plan.post.timing}
              </span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#00e68a' }}>
              {dispPostCarb}г{' '}
              <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>углей +</span>{' '}
              {dispPostProtein}г{' '}
              <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>белка</span>
            </div>
            {budget && Math.round(budget.recommended.postCarbG) > capPost + 2 ? (
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                протокол рекомендует {Math.round(budget.recommended.postCarbG)} г — в окно влезает до {capPost} г
              </div>
            ) : null}
            {budget && Math.round(budget.recommended.postProteinG) > dispPostProtein + 2 ? (
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                протокол: {Math.round(budget.recommended.postProteinG)} г белка (0.35 г/кг) — в рационе{' '}
                {dispPostProtein} г, остаток белка в основных приёмах.
              </div>
            ) : null}
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 6, lineHeight: 1.4 }}>
              {plan.post.note}
            </div>
          </div>

          {/* ─── Что реально стоит в рационе (he_day_plan) ─── */}
          {inRation.has && syncState && applied ? (
            <div style={{ ...modernCardBg, padding: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>🍽️</span>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>В рационе сейчас</div>
                <span style={{ marginLeft: 'auto', fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
                  факт / бюджет окна
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {applied.built.prew
                  ? compareRow('До тренировки', '⏰', applied.preCarbG, inRation.preCarbG, 'г У')
                  : null}
                {applied.built.intra
                  ? compareRow('Во время', '💧', applied.intraCarbG, inRation.intraCarbG, 'г У')
                  : null}
                {applied.built.postw
                  ? compareRow('После — углеводы', '🔄', applied.postCarbG, inRation.postCarbG, 'г У')
                  : null}
                {applied.built.postw
                  ? compareRow('После — белок', '🥩', applied.postProteinG, inRation.postProteinG, 'г Б')
                  : null}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4, marginTop: 6 }}>
                Слева — что поставил движок, справа — фактическая тарелка. Ручные правки порций и подсказки рецептов
                могут сдвинуть факт: кнопка «Взять из плана тренировок» пересобирает рацион заново.
              </div>
            </div>
          ) : null}
          {inRation.has && syncState && !applied ? (
            <div style={{ ...CARD, borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.06)' }}>
              <div style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700, lineHeight: 1.5 }}>
                Синк есть, но рацион ещё не пересобран под него — окна в приёмах пока по обычным долям. Нажмите «Взять
                из плана тренировок» или перегенерируйте план.
              </div>
            </div>
          ) : null}

          <div style={{ ...CARD, borderColor: 'rgba(96,165,250,0.2)' }}>
            <div style={{ fontSize: 11, color: '#60a5fa', fontWeight: 700 }}>
              💧 Жидкость за сессию: ~{budget?.fluidMl ?? plan.fluidTotalMl} мл
            </div>
          </div>
          {plan.safetyWarnings.length > 0 && (
            <div style={{ ...CARD, borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}>
              <div style={{ fontSize: 11, color: '#f87171', fontWeight: 700, marginBottom: 4 }}>⚠️ PED-контекст</div>
              {plan.safetyWarnings.map((warning, i) => (
                <div key={i} style={{ ...SMALL, marginBottom: 3 }}>
                  {warning}
                </div>
              ))}
            </div>
          )}
          <div
            style={{
              padding: 10,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Обоснование</div>
            {plan.rationale.map((t, i) => (
              <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, marginBottom: 2 }}>
                {t}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ ...SMALL, textAlign: 'center', padding: 20 }}>
          Введите тоннаж/длительность, синхронизируйте план или завершите тренировку.
        </div>
      )}

      {/* ── Попапы ввода ── */}
      {popup && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={
            popup === 'intensity'
              ? 'Интенсивность тренировки'
              : popup === 'volume'
                ? 'Тоннаж сессии'
                : 'Длительность сессии'
          }
          className="nut-peri-popup"
          onClick={(e) => {
            if (e.target === e.currentTarget) closePopup();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') closePopup();
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            className="nut-peri-sheet"
            style={{
              width: '100%',
              maxWidth: 380,
              padding: 20,
              borderRadius: 20,
              background: 'linear-gradient(135deg, #1a1c26 0%, #18181b 100%)',
              border: '1px solid rgba(0,230,138,0.2)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              backdropFilter: 'blur(20px)',
            }}
          >
            {popup === 'intensity' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: 'linear-gradient(135deg,#00e68a,#00c8a0)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                    }}
                  >
                    📊
                  </span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Интенсивность</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Множитель углеводов до/после</div>
                  </div>
                  <button
                    onClick={closePopup}
                    aria-label="Закрыть"
                    className="nut-peri-close"
                    style={{
                      marginLeft: 'auto',
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.04)',
                      color: 'rgba(255,255,255,0.6)',
                      cursor: 'pointer',
                      fontSize: 14,
                    }}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(Object.keys(INTENSITY_META) as Array<keyof typeof INTENSITY_META>).map((k) => {
                    const m = INTENSITY_META[k];
                    const active = intensity === k;
                    return (
                      <button
                        key={k}
                        onClick={() => {
                          setIntensity(k);
                          closePopup();
                        }}
                        aria-pressed={active}
                        aria-label={`Интенсивность: ${m.label}`}
                        className="nut-peri-opt"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '12px 14px',
                          borderRadius: 14,
                          cursor: 'pointer',
                          minHeight: 56,
                          textAlign: 'left',
                          border: active ? `1.5px solid ${m.color}` : '1px solid rgba(255,255,255,0.07)',
                          background: active ? `linear-gradient(135deg, ${m.color}22, ${m.color}0d)` : '#202023',
                          color: '#fff',
                          boxShadow: active ? `0 4px 16px ${m.color}30` : 'none',
                        }}
                      >
                        <span
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 10,
                            background: `${m.color}1f`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 16,
                          }}
                        >
                          {m.icon}
                        </span>
                        <span style={{ flex: 1 }}>
                          <span
                            style={{
                              display: 'block',
                              fontSize: 13,
                              fontWeight: 800,
                              color: active ? m.color : '#fff',
                            }}
                          >
                            {m.label}
                          </span>
                          <span style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>
                            {m.desc}
                          </span>
                        </span>
                        <span
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 999,
                            border: `1.5px solid ${active ? m.color : 'rgba(255,255,255,0.2)'}`,
                            background: active ? m.color : 'transparent',
                            color: '#000',
                            fontSize: 12,
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {active ? '✓' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={closePopup}
                  className="nut-peri-done"
                  style={{
                    width: '100%',
                    marginTop: 14,
                    padding: '11px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg,#00e68a,#00c8a0)',
                    color: '#000',
                    fontWeight: 700,
                    cursor: 'pointer',
                    minHeight: 48,
                  }}
                >
                  Готово
                </button>
              </>
            )}
            {(popup === 'volume' || popup === 'duration') && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background:
                        popup === 'volume'
                          ? 'linear-gradient(135deg,#60a5fa,#3b82f6)'
                          : 'linear-gradient(135deg,#f59e0b,#f97316)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                    }}
                  >
                    {popup === 'volume' ? '🏋️' : '⏱'}
                  </span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>
                      {popup === 'volume' ? 'Тоннаж сессии' : 'Длительность'}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                      {popup === 'volume' ? 'кг·повт · влияет на углеводы' : 'минут · влияет на интра-окно'}
                    </div>
                  </div>
                  <button
                    onClick={closePopup}
                    aria-label="Закрыть"
                    className="nut-peri-close"
                    style={{
                      marginLeft: 'auto',
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.04)',
                      color: 'rgba(255,255,255,0.6)',
                      cursor: 'pointer',
                      fontSize: 14,
                    }}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <button
                    onClick={() =>
                      setDraft(String(Math.max(0, (Number(draft) || 0) - (popup === 'volume' ? 1000 : 5))))
                    }
                    aria-label="Уменьшить значение"
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: '#202023',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 20,
                      fontWeight: 600,
                    }}
                  >
                    −
                  </button>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <input
                      autoFocus
                      type="number"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveDraft();
                      }}
                      aria-label={popup === 'volume' ? 'Тоннаж, кг' : 'Длительность, минут'}
                      placeholder={popup === 'volume' ? String(Math.round(dispVol) || 8000) : String(dispDur || 60)}
                      className="nut-peri-input"
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: 12,
                        background: '#202023',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: '#fff',
                        fontSize: 22,
                        fontWeight: 800,
                        textAlign: 'center',
                        outline: 'none',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    />
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                      {popup === 'volume' ? 'килограмм·повторений' : 'минут'}
                    </div>
                  </div>
                  <button
                    onClick={() => setDraft(String((Number(draft) || 0) + (popup === 'volume' ? 1000 : 5)))}
                    aria-label="Увеличить значение"
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: '#202023',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 20,
                      fontWeight: 600,
                    }}
                  >
                    +
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  {(popup === 'volume' ? [3000, 8000, 12000, 20000] : [45, 60, 75, 90, 120]).map((v) => (
                    <button
                      key={v}
                      onClick={() => setDraft(String(v))}
                      aria-label={`${v}`}
                      aria-pressed={Number(draft) === v}
                      className="nut-peri-chip"
                      style={{
                        padding: '8px 14px',
                        borderRadius: 999,
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: Number(draft) === v ? 'rgba(0,230,138,0.12)' : '#202023',
                        color: Number(draft) === v ? '#00e68a' : 'rgba(255,255,255,0.75)',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 700,
                        minHeight: 44,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {popup === 'volume' ? `${(v / 1000).toLocaleString('ru-RU')}т` : `${v} мин`}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    onClick={closePopup}
                    className="nut-peri-cancel"
                    style={{
                      flex: 1,
                      padding: '11px',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.04)',
                      color: 'rgba(255,255,255,0.7)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      minHeight: 48,
                    }}
                  >
                    Отмена
                  </button>
                  <button
                    onClick={saveDraft}
                    className="nut-peri-save"
                    style={{
                      flex: 1,
                      padding: '11px',
                      borderRadius: 12,
                      border: 'none',
                      background: 'linear-gradient(135deg,#00e68a,#00c8a0)',
                      color: '#000',
                      fontWeight: 700,
                      cursor: 'pointer',
                      minHeight: 48,
                      boxShadow: '0 4px 16px rgba(0,230,138,0.25)',
                    }}
                  >
                    ✓ Сохранить
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(PeriWorkoutCard);
