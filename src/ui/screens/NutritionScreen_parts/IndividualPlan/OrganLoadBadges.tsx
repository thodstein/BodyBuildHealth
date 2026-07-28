/**
 * OrganLoadBadges.tsx — P2-12: organ-load → auto restrictions with badges on products.
 *
 * Извлекает орган-специфичные предупреждения из metabolic_flags/gastro_tags продукта
 * и сопоставляет с активными проблемами здоровья пользователя.
 *
 * Бейджи показываются на чипе продукта в MealListRender, когда:
 *  - У продукта высокий потенциал нагрузки на орган
 *  - И у пользователя активна соответствующая проблема здоровья (подагра/диабет/ЖКТ/гипертония/ХБП/отёки/лактоза/глютен)
 *  - ИЛИ продукт имеет критический флаг (heavy_metal_risk HIGH, atherogenic_potential HIGH + гипертония, и т.д.)
 *
 * Дополнительно: автоматические ограничения при генерации плана — addToAutoExclude()
 * возвращает список ID для исключения (пробрасывается в excludedFoods).
 */
import type { FoodItem } from "../../../../core/nutrition-database";

export interface OrganLoadBadge {
  icon: string;
  label: string;
  color: string;
  tooltip: string;
  /** Подтверждено активным заболеванием пользователя (true) или потенциальный риск (false). */
  confirmed: boolean;
}

// ─── Маппинг флагов продукта → орган-специфичные бейджи ───
// Возвращает бейджи organ-load для конкретного продукта с учётом активных health issues.
export function getOrganLoadBadges(food: FoodItem, healthIssues: string[]): OrganLoadBadge[] {
  if (!food) return [];
  const mf = food.metabolic_flags;
  const gt = food.gastro_tags;
  const out: OrganLoadBadge[] = [];

  // ❤️ ССС / гипертония — атерогенный потенциал + натрий
  if (mf?.atherogenic_potential === 'HIGH' || (gt?.gut_irritant_potential !== 'HIGH' && food.fat > 25)) {
    if (healthIssues.includes('hypertension')) {
      out.push({
        icon: '❤️', label: 'ССС', color: '#ef4444',
        tooltip: `Высокий атерогенный потенциал (${food.macro_100g?.fats_saturated ?? '—'} г насыщ. жиров/100г). Ограничить при гипертонии.`,
        confirmed: true,
      });
    }
  }

  // 💉 Поджелудочная / диабет — гликирующий потенциал
  if (mf?.glycation_potential === 'HIGH' || food.gi > 70) {
    if (healthIssues.includes('diabetes')) {
      out.push({
        icon: '💉', label: 'Панкреас', color: '#f59e0b',
        tooltip: `Высокий гликирующий потенциал (GI=${food.gi}). Ограничить при диабете/преддиабете.`,
        confirmed: true,
      });
    }
  }

  // 🫘 Почки / ХБП / подагра — аммонийная нагрузка + пурины + PRAL
  if (mf?.ammonia_source_level === 'HIGH' || (food.id.includes('liver') || food.id.includes('kidney'))) {
    if (healthIssues.includes('kidney_stones') || healthIssues.includes('gout')) {
      out.push({
        icon: '🫘', label: 'Почки', color: '#a855f7',
        tooltip: `Высокая аммонийная/пуриновая нагрузка. Ограничить при камнях в почках/подагре.`,
        confirmed: true,
      });
    }
  }

  // 🫀 ЖКТ — fodmap + irritant potential
  if (gt?.fodmap_group === 'HIGH' || gt?.gut_irritant_potential === 'HIGH') {
    if (healthIssues.includes('gi_issues') || healthIssues.includes('lactose_intolerance')) {
      out.push({
        icon: '🫀', label: 'ЖКТ', color: '#f97316',
        tooltip: `${gt?.fodmap_group === 'HIGH' ? 'Высокий FODMAP. ' : ''}${gt?.gut_irritant_potential === 'HIGH' ? 'Раздражающий ЖКТ. ' : ''}Ограничить при проблемах с ЖКТ.`,
        confirmed: true,
      });
    }
  }

  // 🫁 Печень — гепатотоксичность / heavy metals
  if (mf?.heavy_metal_risk === 'HIGH') {
    out.push({
      icon: '🫁', label: 'Печень', color: '#ef4444',
      tooltip: `Высокий риск тяжёлых металлов. Ограничить частоту потребления.`,
      confirmed: true,
    });
  } else if (mf?.heavy_metal_risk === 'MEDIUM') {
    if (healthIssues.includes('kidney_stones')) {
      out.push({
        icon: '🫁', label: 'Печень', color: '#f59e0b',
        tooltip: `Умеренный риск тяжёлых металлов. Не чаще 1-2 раз/нед.`,
        confirmed: true,
      });
    }
  }

  // 🧠 ЦНС — стимулянт/седативный эффект
  if (mf?.cns_impact === 'STIMULANT') {
    if (healthIssues.includes('hypertension') || healthIssues.includes('gi_issues')) {
      out.push({
        icon: '🧠', label: 'ЦНС', color: '#f59e0b',
        tooltip: `Стимулятор ЦНС. Осторожно при гипертонии/ЖКТ-проблемах.`,
        confirmed: true,
      });
    }
  }

  // 🦴 Кости / PRAL — гойтрогены
  if (mf?.goitrogenic_potential === 'HIGH') {
    if (healthIssues.includes('kidney_stones')) {
      out.push({
        icon: '🦴', label: 'Кости', color: '#60a5fa',
        tooltip: `Гойтрогенный потенциал (может влиять на щитовидную). Ограничить при камнях/патологии ЩЖ.`,
        confirmed: true,
      });
    }
  }

  // 🫁 Подагра — пурины ( liver, kidney, certain fish)
  if (healthIssues.includes('gout')) {
    if (food.id.includes('liver') || food.id.includes('kidney') ||
        food.id.includes('sardine') || food.id.includes('anchov') ||
        food.id.includes('mussel') || food.id.includes('herring') ||
        food.id.includes('sprat') || food.id.includes('tuna_canned')) {
      out.push({
        icon: '🦶', label: 'Подагра', color: '#ef4444',
        tooltip: `Высокое содержание пуринов. Ограничить при подагре.`,
        confirmed: true,
      });
    }
  }

  // 🫧 Отёки — натрий
  if (healthIssues.includes('oedema')) {
    const na = food.electrolytes_100g?.sodium_mg || food.micros?.Na || 0;
    if (na > 400) {
      out.push({
        icon: '🫧', label: 'Отёк', color: '#3b82f6',
        tooltip: `Высокий натрий (${na} мг/100г). Ограничить при отёках.`,
        confirmed: true,
      });
    }
  }

  // 🥛 Лактоза
  if (healthIssues.includes('lactose_intolerance')) {
    if (food.id.includes('milk') || food.id.includes('cottage_cheese') ||
        food.id.includes('ricotta') || food.id.includes('mozzarella') ||
        food.id.includes('ice_cream') || food.id.includes('condensed_milk')) {
      out.push({
        icon: '🥛', label: 'Лактоза', color: '#f59e0b',
        tooltip: `Содержит лактозу. Ограничить при непереносимости.`,
        confirmed: true,
      });
    }
  }

  // 🌾 Глютен
  if (healthIssues.includes('gluten_intolerance')) {
    if (food.id.includes('bread') || food.id.includes('pasta') ||
        food.id.includes('oats') || food.id.includes('pancake') ||
        food.id.includes('pita') || food.id.includes('lavash') ||
        food.id.includes('muesli') || food.id.includes('pelmeni')) {
      out.push({
        icon: '🌾', label: 'Глютен', color: '#f59e0b',
        tooltip: `Содержит глютен. Ограничить при непереносимости.`,
        confirmed: true,
      });
    }
  }

  // 🟢 Гепатопротективные — позитивный бейдж
  if (mf?.hepatoprotective) {
    out.push({
      icon: '🟢', label: 'Гепато+', color: '#22c55e',
      tooltip: `Гепатопротективный потенциал. Полезно для печени.`,
      confirmed: false,
    });
  }

  return out;
}

// ─── Рендер бейджей — компактная inline-группа для чипа продукта ───
export const OrganLoadBadgeGroup: React.FC<{
  food: FoodItem;
  healthIssues: string[];
  style?: React.CSSProperties;
}> = ({ food, healthIssues, style }) => {
  const badges = getOrganLoadBadges(food, healthIssues);
  if (badges.length === 0) return null;
  // Показываем максимум 3 бейджа, чтобы не раздувать чип
  const visible = badges.slice(0, 3);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1, ...style }}>
      {visible.map((b, i) => (
        <span
          key={i}
          title={b.tooltip}
          style={{
            fontSize: 8,
            padding: '0 2px',
            borderRadius: 3,
            background: `${b.color}15`,
            color: b.color,
            fontWeight: 700,
            border: `1px solid ${b.color}30`,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontSize: 9 }}>{b.icon}</span>
          {b.label}
        </span>
      ))}
      {badges.length > 3 && (
        <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
          +{badges.length - 3}
        </span>
      )}
    </span>
  );
};

// ─── Авто-исключения при генерации плана на основе organ-load ───
// Возвращает список ID продуктов, которые должны быть исключены из автоподбора
// при активных health issues пользователя (более строгий критерий, чем бейджи).
export function getAutoExcludedFoodIds(
  foods: FoodItem[],
  healthIssues: string[]
): string[] {
  const excluded = new Set<string>();
  if (healthIssues.length === 0) return [];

  for (const food of foods) {
    const badges = getOrganLoadBadges(food, healthIssues);
    // Исключаем только confirmed-бейджи красного уровня (color === '#ef4444')
    const hasCritical = badges.some(b => b.confirmed && b.color === '#ef4444');
    if (hasCritical) excluded.add(food.id);
  }
  return Array.from(excluded);
}