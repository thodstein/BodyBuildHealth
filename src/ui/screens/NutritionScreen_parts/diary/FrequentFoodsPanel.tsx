/**
 * FrequentFoodsPanel - Quick access to frequently consumed foods
 * Shows top N most eaten foods for quick logging
 */

import React, { useState, useCallback } from 'react';
import { useFrequentFoods } from '../useNutritionDiary';
import { type DiaryMealItem } from '../diary-storage-v2';

interface FrequentFoodsPanelProps {
  diary: Record<string, any>;
  onAddFood: (food: DiaryMealItem, mealType: string) => void;
  maxItems?: number;
}

type MealType = 'Завтрак' | 'Обед' | 'Ужин' | 'Перекус' | 'До тренировки' | 'После тренировки';

const MEAL_TYPES: MealType[] = ['Завтрак', 'Обед', 'Ужин', 'Перекус', 'До тренировки', 'После тренировки'];

export const FrequentFoodsPanel: React.FC<FrequentFoodsPanelProps> = ({
  diary,
  onAddFood,
  maxItems = 10,
}) => {
  const [selectedMealType, setSelectedMealType] = useState<MealType>('Перекус');
  const [showAll, setShowAll] = useState(false);
  
  const frequentFoods = useFrequentFoods(diary, showAll ? 50 : maxItems);
  
  const handleAdd = useCallback(
    (food: DiaryMealItem) => {
      onAddFood(food, selectedMealType);
    },
    [onAddFood, selectedMealType]
  );
  
  if (frequentFoods.length === 0) {
    return null; // Don't render if no frequent foods yet
  }
  
  return (
    <div className="frequent-foods-panel bg-white border rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-gray-700">
          ⚡ Быстрое добавление
          <span className="ml-2 text-xs text-gray-500">({frequentFoods.length} частых продуктов)</span>
        </h3>
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-xs text-blue-500 hover:text-blue-700"
        >
          {showAll ? 'Скрыть' : 'Показать все'}
        </button>
      </div>
      
      {/* Meal type selector */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {MEAL_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setSelectedMealType(type)}
            className={`px-3 py-1 rounded text-xs ${
              selectedMealType === type
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {type}
          </button>
        ))}
      </div>
      
      {/* Frequent foods grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {frequentFoods.map((food, idx) => (
          <button
            key={`${food.name}-${idx}`}
            onClick={() => handleAdd(food)}
            className="text-left p-2 border rounded hover:bg-blue-50 hover:border-blue-300 transition-colors"
            title={`${food.name}\n${food.kcal} ккал | Б: ${food.p} Ж: ${food.f} У: ${food.c}`}
          >
            <div className="font-medium text-sm truncate">{food.name}</div>
            <div className="text-xs text-gray-500">
              {food.qty || 100}г → <span>{Math.round((food.kcal * (food.qty || 100)) / 100)} ккал</span>
            </div>
            <div className="text-xs text-gray-400">
              Б{food.p} Ж{food.f} У{food.c}
            </div>
          </button>
        ))}
      </div>
      
      {/* Quick add info */}
      <div className="mt-2 text-xs text-gray-500">
        Нажмите на продукт, чтобы добавить в "{selectedMealType}"
      </div>
    </div>
  );
};

export default FrequentFoodsPanel;
