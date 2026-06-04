# Split Selector Engine — Usage Guide

## Overview

**Split Selector Engine** (`src/engines/split-selector.engine.ts`) — система выбора оптимального тренировочного сплита с scoring и обоснованием.

## API Reference

### SplitCandidate Interface

```typescript
export interface SplitCandidate {
  id: string;           // Уникальный идентификатор (например: 'upper_lower_4')
  name: string;         // Отображаемое имя (например: 'Верх/Низ 4 дня')
  desc: string;         // Описание сплита
  groupsPerDay: string[][];  // Группы мышц по дням
  score: number;        // Рейтинг (0-100+)
  rationale: string[];  // Массив причин выбора
}
```

### Functions

#### selectSplit(input: TrainingInput): SplitCandidate[]
Возвращает отсортированный массив кандидатов с рейтингом и обоснованием.

```typescript
import { selectSplit } from './engines/split-selector.engine';

const candidates = selectSplit({
  goal: 'bulk',
  level: 'intermediate',
  daysPerWeek: 4,
  recovery: 70,
  fatigue: 40,
  nutrition: 80,
  weakPoints: ['chest', 'legs'],
  injuries: []
});

// Output:
// [
//   {
//     id: 'upper_lower_4',
//     name: 'Верх/Низ 4 дня',
//     desc: 'Чередование верхних и нижних дней...',
//     groupsPerDay: [['chest', 'back', 'shoulders', 'arms'], ['legs', 'core']],
//     score: 95,
//     rationale: [
//       '4 дней/нед — подходит для Верх/Низ сплита',
//       'Уровень "intermediate" — допустим для данного сплита',
//       'Цель "bulk" — оптимальна для данного сплита',
//       'Восстановление 70% >= минимального 50% для этого сплита',
//       'Отстающие группы (Грудь, Ноги) — частота 2×/нед для специализации'
//     ]
//   },
//   ...
// ]
```

#### selectBestSplit(input: TrainingInput): SplitCandidate
Возвращает лучший кандидат (с максимальным score).

```typescript
import { selectBestSplit } from './engines/split-selector.engine';

const best = selectBestSplit(input);
console.log(best.name); // 'Верх/Низ 4 дня'
console.log(best.score); // 95
console.log(best.rationale); // ['4 дней/нед — подходит...', ...]
```

#### getSplitOptions(input: TrainingInput): SplitCandidate[]
Возвращает топ-5 кандидатов.

```typescript
const options = getSplitOptions(input);
options.forEach(opt => {
  console.log(`${opt.name}: ${opt.score} points`);
  opt.rationale.forEach(r => console.log(`  - ${r}`));
});
```

## Scoring Logic

### Максимальный score: ~120+ баллов

#### 1. Days match (×3 — mandatory)
```typescript
if (split.minDays <= daysPerWeek && split.maxDays >= daysPerWeek) {
  score += 30;
  rationale.push(`${daysPerWeek} дней/нед — подходит для ${split.name}`);
} else {
  continue; // Пропуск сплита
}
```

#### 2. Level match (×2)
```typescript
if (split.levels.includes(level)) {
  score += 20;
  rationale.push(`Уровень "${level}" — допустим для данного сплита`);
} else {
  score -= 15;
  rationale.push(`Уровень "${level}" — не рекомендуется для данного сплита`);
}
```

#### 3. Goal match (×2)
```typescript
if (split.goals.includes(goal)) {
  score += 20;
  rationale.push(`Цель "${goal}" — оптимальна для данного сплита`);
} else if (goal === 'strength' && id === 'strength_4') {
  score += 25;
  rationale.push('Силовая цель → силовой сплит приоритет');
} else {
  score -= 10;
  rationale.push(`Цель "${goal}" — не оптимальна для данного сплита`);
}
```

#### 4. Recovery compatibility (×1.5)
```typescript
if (recovery >= split.minRecovery) {
  score += 15;
} else {
  score -= 20;
  rationale.push(`Восстановление ${recovery}% < минимального ${split.minRecovery}% для этого сплита`);
}
```

#### 5. Fatigue penalty (×1)
```typescript
if (fatigue > 70) {
  score -= 10;
  if (id === 'recovery_3') score += 15;
}
```

#### 6. Nutrition penalty (×1)
```typescript
if (nutrition < 50) {
  score -= 5;
  if (id === 'recovery_3') score += 10;
}
```

#### 7. Weak points priority (×1)
```typescript
if (weakPoints.length > 0 && split.weakGroupFreq >= 3) {
  score += 10;
  rationale.push(`Отстающие группы (${weakPoints.length}) — частота ${split.weakGroupFreq}×/нед для специализации`);
} else if (weakPoints.length > 0 && split.weakGroupFreq <= 1) {
  score -= 10;
  rationale.push('Частота 1×/нед — недостаточна для отстающих групп');
}
```

#### 8. Injury safety (×1)
```typescript
if (hasInjury && split.injurySafe) {
  score += 15;
  rationale.push('Безопасен при травмах — минимизация осевых нагрузок');
} else if (hasInjury && !split.injurySafe) {
  score -= 10;
  rationale.push('Осторожно: содержит упражнения с высокой нагрузкой на суставы');
}
```

#### 9. Enhanced bonus (×1)
```typescript
if (level === 'enhanced' && id.includes('6') && recovery >= 65) {
  score += 10;
  rationale.push('На курсе → повышенное восстановление позволяет высокий объём');
}
```

## Integration Example

```typescript
import { selectBestSplit, getSplitOptions } from './engines/split-selector.engine';

function PlanScreen() {
  const { profile } = useDataLink();
  const [goal, setGoal] = useState('bulk');
  const [level, setLevel] = useState('intermediate');
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [recovery, setRecovery] = useState(70);
  const [weakPoints, setWeakPoints] = useState<string[]>([]);

  const splitInput = useMemo(() => ({
    goal, level, daysPerWeek, recovery, fatigue: 40, nutrition: 80,
    weakPoints, injuries: []
  }), [goal, level, daysPerWeek, recovery, weakPoints]);

  const bestSplit = useMemo(() => selectBestSplit(splitInput), [splitInput]);
  const splitOptions = useMemo(() => getSplitOptions(splitInput), [splitInput]);

  return (
    <div className="split-selector">
      <h3>Выбранный сплит</h3>
      <div className="card">
        <h4>{bestSplit.name}</h4>
        <p>{bestSplit.desc}</p>
        
        <h5>Рейтинг: {bestSplit.score} баллов</h5>
        
        <h5>Почему этот сплит?</h5>
        <ul>
          {bestSplit.rationale.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>

        <h5>Группы мышц по дням:</h5>
        {bestSplit.groupsPerDay.map((day, i) => (
          <div key={i}>
            <strong>День {i + 1}:</strong> {day.map(g => GROUP_LABELS[g]).join(', ')}
          </div>
        ))}
      </div>

      <h3>Альтернативные варианты</h3>
      <div className="options-grid">
        {splitOptions.slice(1).map((opt) => (
          <div key={opt.id} className="option-card">
            <h4>{opt.name}</h4>
            <p>{opt.desc}</p>
            <small>Score: {opt.score}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Splits Catalog

| ID | Name | Days | Levels | Goals | Min Recovery |
|----|------|------|--------|-------|--------------|
| fullbody_3 | Фулбоди 3 дня | 3 | beginner, intermediate | maintenance, rehab, strength, bulk, cut | 40% |
| recovery_3 | Восстановительный 3x | 3 | beginner, intermediate, advanced, enhanced | rehab, maintenance | 0% |
| upper_lower_4 | Верх/Низ 4 дня | 4 | beginner, intermediate, advanced | bulk, strength, maintenance, recomp, cut | 50% |
| ppl_5 | PPL 5 дней | 5 | intermediate, advanced, enhanced | bulk, hypertrophy, recomp, strength | 55% |
| ppl_2x_6 | PPL 2× 6 дней | 6 | advanced, enhanced | bulk, hypertrophy, strength | 65% |
| push_pull_legs_6 | Push/Pull/Legs 6x | 6 | advanced, enhanced | hypertrophy, bulk | 70% |
| strength_4 | Силовой 4 дня | 4 | intermediate, advanced, enhanced | strength | 55% |
| bro_5 | Бро-сплит 5 дней | 5 | intermediate, advanced | hypertrophy, bulk | 60% |
| torso_limbs_4 | Торс/Конечности 4 дня | 4 | beginner, intermediate | rehab, maintenance, recomp | 40% |
| arnold_6 | Арнольд-сплит 6 дней | 6 | advanced, enhanced | bulk, hypertrophy | 65% |
| powerbuilding_4 | Пауэрбилдинг 4 дня | 4 | intermediate, advanced | strength, bulk, recomp | 55% |
| hypertrophy_5 | Гипертрофия 5 дней | 5 | advanced, enhanced | hypertrophy, bulk | 60% |

## Advanced Usage

### Custom Scoring

Если нужно изменить веса scoring:

```typescript
const customInput = { ...input };
// Modify weights manually
customInput.recovery = 80; // Higher recovery score
customInput.nutrition = 90; // Better nutrition

const candidates = selectSplit(customInput);
```

### Multiple Criteria

```typescript
const candidates = getSplitOptions(input);

// Filter by minimum score
const goodOptions = candidates.filter(c => c.score >= 80);

// Filter by specific level
const beginnerOptions = candidates.filter(c => c.rationale.some(r => r.includes('beginner')));
```

## Benefits

1. **Transparent**: Показывает WHY сплит выбран
2. **Dynamic**: Адаптируется к recovery, fatigue, weak points
3. **Expert**: Учитывает 9+ факторов для оптимального выбора
4. **User-friendly**: Простой API с обоснованием
5. **Extensible**: Легко добавить новые критерии

## Migration Notes

### Before (hardcoded):
```typescript
const splitKey = daysPerWeek <= 3 ? 'fullbody_3' : 'upper_lower_4';
```

### After (smart selection):
```typescript
const best = selectBestSplit(input);
const splitKey = best.id;
```

---

**Status**: ✅ Split Selector Engine — COMPLETED  
**Integration**: Ready to use in PlanScreen
