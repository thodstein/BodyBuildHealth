# BB-авто: многоблочная специализация с донорским перераспределением

## Цель

Качественный инструмент специализации: произвольная последовательность блоков (напр. 12 недель = 1-5, 6-10, 11-12), цели 1-2 мышц/зон, и режим «акцент за счёт доноров» (толщина спины за счёт прямых рук на 5 недель).

## Жёсткие ограничения

- MEV/MAV/MRV, level, trainingYears, PED/dose/courseIntensity, goal, volumeGoal, recovery, nutrition, lab, ACWR, phase/deload, indirect-коэффициенты, caps — НЕ менять.
- Baseline без tradeoff не должен меняться по объёму.
- Donor-режим — слой перераспределения уже рассчитанного ресурса.
- Косвенная нагрузка донора всегда сохраняется; direct volume не ниже effective floor (MEV).
- Не использовать excludedMuscles (семантика травмы) для доноров.

## Модель

```ts
interface SpecializationBlock {
  id: string;
  weekStart: number;
  weekEnd: number;
  targets: string[];      // 1-2 гранулярные зоны
  tradeoff?: VolumeTradeoffPolicy;
}

interface VolumeTradeoffPolicy {
  mode: 'none' | 'reduce_direct_to_floor' | 'remove_direct_when_indirect_covers_floor';
  donorMuscles: string[];
  preserveIndirect: true;
}
```

- Длина блока: 3-6 недель, дефолт 5.
- Остаток меньше 3 недель — только баланс/переход.
- Смежные блоки с одной канонической мышцей — предупреждение, не слияние.

## Донорный алгоритм

1. Построить baseline существующим конвейером.
2. Для недель активного tradeoff-блока:
   - aggregate direct/indirect/effective;
   - доноры: убрать/снизить прямые изоляции (accessory, не primary compounds) до effective floor = MEV;
   - freed = снятые сеты;
   - перенос: набор сетов получателю (pattern-matched упражнения) в пределах adapted MRV, cap 5/упражнение, session caps, equipment/mobility;
   - отчёт: снято / перенесено / не использовано.
3. Финализатор не возвращает объём доноров (feeders, arm allocation, small muscle, fill, repair, arm heads).
4. После блока объём донора восстанавливается.

## Реестр зон

`bb-specialization-registry.ts`: ключ → canonical, label, granular, patterns (RegExp), donor recommendations. Покрывает все WEAK_GROUPS-ключи.

## UI

- Один блок выбора на шаге 1.
- Список блоков: недели, цели, доноры, режим; «+ Добавить блок»; итоговая строка «нед 1-5 [A] → нед 6-10 [B] → нед 11-12 баланс».
- Миграция старых specBlocks (block1+block2) и focusGroup/weakPoints.

## Тесты

- Baseline без tradeoff неизменен.
- Multi-block: 12 нед (1-5 A, 6-10 B, 11-12 баланс), 15 нед (3 блока), продолжение тех же, смена мышц.
- Donor: back_thickness+arms, chest_upper+triceps, delt_mid+delt_rear, quads+hamstrings, glutes+quads, biceps+triceps.
- Факторы: level × years × goal × volumeGoal × PED × recovery/nutrition/lab × ACWR × фазы.
- Инварианты: 0 underfill, 0 MRV overflow, 0 single-set, indirect сохранён, донор не возвращён финализатором, восстановление после блока.
- generic/cycle/program adapt; faithful без авто-tradeoff.
