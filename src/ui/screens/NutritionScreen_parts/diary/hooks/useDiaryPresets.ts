import { useState, useCallback } from 'react';
import { readJSONArr } from '../../diary-storage-v2';

export function useDiaryPresets({ diaryData, selectedDate, saveDiary, showToast, safeSet, extractQty }: {
  diaryData: Record<string, any>;
  selectedDate: string;
  saveDiary: (data: any) => void;
  showToast: (msg: string) => void;
  safeSet: (key: string, data: any) => void;
  extractQty: (item: any) => number;
}) {
  const [dayPresets, setDayPresets] = useState<any[]>(() => readJSONArr<any>('he_day_presets'));
  const [mealPresets, setMealPresets] = useState<any[]>(() => readJSONArr<any>('he_meal_presets'));
  const [presetDialog, setPresetDialog] = useState<{ meal: string; items: any[] } | null>(null);
  const [presetName, setPresetName] = useState('');
  const [dayPresetDialogOpen, setDayPresetDialogOpen] = useState(false);
  const [dayPresetName, setDayPresetName] = useState('');

  const savePreset = useCallback((meal: string, items: any[]) => {
    setPresetDialog({ meal, items });
    setPresetName(`${meal} (набор)`);
  }, []);

  const confirmSavePreset = useCallback(() => {
    if (!presetDialog) return;
    const name = presetName.trim();
    if (!name) { showToast('❌ Введите название'); return; }
    const { items } = presetDialog;
    // Normalize to per-100g to fix "Не собирается набор еды" — previously saved scaled kcal directly
    const presetItems = items.map((i: any) => {
      const qty = extractQty(i);
      const factor = qty > 0 ? 100 / qty : 1;
      return {
        name: i.name,
        kcal: Math.round((i.kcal || 0) * factor),
        p: Math.round((i.p || 0) * factor * 10) / 10,
        f: Math.round((i.f || 0) * factor * 10) / 10,
        c: Math.round((i.c || 0) * factor * 10) / 10,
        qty,
        category: i.category, foodId: i.foodId,
      };
    });
    const preset = { name, items: presetItems };
    setMealPresets(prev => {
      const upd = [...prev, preset];
      safeSet('he_meal_presets', upd);
      return upd;
    });
    setPresetDialog(null);
    setPresetName('');
    showToast('✅ Набор сохранён');
  }, [presetDialog, presetName, extractQty, safeSet, showToast]);

  const saveDayPreset = useCallback(() => {
    const day = diaryData[selectedDate];
    if (!day?.meals || Object.keys(day.meals).length === 0) { showToast('❌ День пуст'); return; }
    setDayPresetName(`Шаблон ${selectedDate}`);
    setDayPresetDialogOpen(true);
  }, [diaryData, selectedDate, showToast]);

  const confirmSaveDayPreset = useCallback(() => {
    const name = dayPresetName.trim();
    if (!name) { showToast('❌ Введите название'); return; }
    const day = diaryData[selectedDate];
    if (!day?.meals) return;
    const upd = [...dayPresets, { name, meals: JSON.parse(JSON.stringify(day.meals)) }];
    setDayPresets(upd);
    safeSet('he_day_presets', upd);
    setDayPresetDialogOpen(false);
    setDayPresetName('');
    showToast('💾 Шаблон дня сохранён');
  }, [diaryData, selectedDate, dayPresets, dayPresetName, safeSet, showToast]);

  const loadDayPreset = useCallback((preset: any) => {
    const data = { ...diaryData };
    if (!data[selectedDate]) data[selectedDate] = { meals: {} };
    for (const [meal, items] of Object.entries(preset.meals as Record<string, any[]>)) {
      if (!data[selectedDate].meals[meal]) data[selectedDate].meals[meal] = [];
      (data[selectedDate].meals[meal] as any).push(...JSON.parse(JSON.stringify(items)));
    }
    saveDiary(data);
    showToast(`✅ Шаблон "${preset.name}" добавлен`);
  }, [diaryData, selectedDate, saveDiary, showToast]);

  return {
    dayPresets, mealPresets,
    presetDialog, setPresetDialog, presetName, setPresetName,
    dayPresetDialogOpen, setDayPresetDialogOpen, dayPresetName, setDayPresetName,
    savePreset, confirmSavePreset, saveDayPreset, confirmSaveDayPreset, loadDayPreset,
  };
}
