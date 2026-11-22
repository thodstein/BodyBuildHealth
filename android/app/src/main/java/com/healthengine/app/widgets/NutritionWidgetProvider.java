package com.healthengine.app.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

import com.healthengine.app.R;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/**
 * Homescreen-виджет «Питание» — аналитика КБЖУ кругами за день / неделю / месяц.
 *
 * Слева крупный круг калорий, справа Б/Ж/У; ниже сводка, вода и кнопки.
 * Период хранится per-widget (чипы «Д · Н · М»): неделя и месяц показывают
 * среднее в день против дневной цели, в сводке — сумма за период и число дней
 * с записями. Агрегаты приходят готовыми в снапшоте (`periods`), поэтому
 * переключение периода не требует WebView.
 *
 * «＋ Еда» открывает компактный нативный редактор (WidgetQuickAddActivity)
 * без запуска приложения и сразу пишет запись в очередь `type=food`.
 * «Скан» и «Фото» уводят в приложение прямо в нужный сценарий: распознавание
 * штрихкода / этикетки требует WebView-движков, нативно их не продублировать.
 */
public class NutritionWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_WATER = "com.healthengine.app.action.WIDGET_WATER";
    /** «−250 мл»: коррекция воды, если порцию нажали по ошибке. */
    public static final String ACTION_WATER_MINUS = "com.healthengine.app.action.WIDGET_WATER_MINUS";
    public static final String ACTION_FOOD = "com.healthengine.app.action.WIDGET_NUT_FOOD";
    /** «↩»: отменить последнюю запись еды за сегодня. */
    public static final String ACTION_FOOD_UNDO = "com.healthengine.app.action.WIDGET_NUT_FOOD_UNDO";
    /** Переключение периода аналитики: day / week / month (per-widget). */
    public static final String ACTION_PERIOD = "com.healthengine.app.action.WIDGET_NUT_PERIOD";
    /** Листание дат «‹ ›»: extra `step` = ±1 (per-widget, только «День»). */
    public static final String ACTION_DAY = "com.healthengine.app.action.WIDGET_NUT_DAY";
    /** Тап по чипу «недавние / избранное»: в интенте сам продукт и его `index`. */
    public static final String ACTION_QUICK = "com.healthengine.app.action.WIDGET_NUT_QUICK";
    /** Сам продукт чипа (JSON): тап пишет ровно то, что нарисовано на виджете. */
    public static final String EXTRA_QUICK_ITEM = "quick_item";
    /** «✕» в списке дня: удалить позицию (date + meal + index). */
    public static final String ACTION_ITEM_DEL = "com.healthengine.app.action.WIDGET_NUT_ITEM_DEL";
    public static final String EXTRA_ML = "ml";
    public static final String EXTRA_WIDGET_ID = "widget_id";
    public static final String EXTRA_PERIOD = "period";
    public static final String EXTRA_STEP = "step";
    public static final String EXTRA_INDEX = "index";
    public static final String EXTRA_DATE = "date";
    public static final String EXTRA_MEAL = "meal";

    private static final int C_TEXT = 0xFFE2ECFF;
    private static final int C_MUTED = 0xFF8FA3C4;
    private static final int C_ACCENT = 0xFFC9F73A;
    private static final int C_DANGER = 0xFFFF6B6B;

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        updateAll(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        try {
            if (intent == null) return;
            String action = intent.getAction();
            if (ACTION_PERIOD.equals(action)) {
                int widgetId = intent.getIntExtra(EXTRA_WIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
                if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) return;
                WidgetStore.setNutritionPeriod(context, widgetId, intent.getStringExtra(EXTRA_PERIOD));
                // Смена периода начинается с сегодняшнего дня: иначе возврат к
                // «Дню» показывал бы вчерашний и кнопки добавления были скрыты.
                WidgetStore.setNutritionDayOffset(context, widgetId, 0);
                updateWidget(context, widgetId);
                return;
            }
            if (ACTION_WATER_MINUS.equals(action)) {
                int ml = intent.getIntExtra(EXTRA_ML, 250);
                if (ml <= 0) ml = 250;
                if (ml > 2000) ml = 2000;
                JSONObject item = new JSONObject();
                item.put("type", "water_remove");
                item.put("ml", ml);
                item.put("ts", System.currentTimeMillis());
                WidgetStore.enqueue(context, item);
                optimisticWater(context, -ml);
                updateAll(context);
                try {
                    WaterQuickWidgetProvider.updateAll(context);
                } catch (Exception ignored) {}
                return;
            }
            if (ACTION_FOOD_UNDO.equals(action)) {
                undoLastFood(context);
                return;
            }
            if (ACTION_DAY.equals(action)) {
                int widgetId = intent.getIntExtra(EXTRA_WIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
                if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) return;
                int step = intent.getIntExtra(EXTRA_STEP, 0);
                int next = WidgetStore.getNutritionDayOffset(context, widgetId) + step;
                WidgetStore.setNutritionDayOffset(context, widgetId, next);
                updateWidget(context, widgetId);
                return;
            }
            if (ACTION_QUICK.equals(action)) {
                addQuickFood(context, intent.getIntExtra(EXTRA_INDEX, -1),
                        intent.getStringExtra(EXTRA_QUICK_ITEM));
                return;
            }
            if (ACTION_ITEM_DEL.equals(action)) {
                removeDayItem(context,
                        intent.getIntExtra(EXTRA_WIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID),
                        intent.getStringExtra(EXTRA_DATE),
                        intent.getStringExtra(EXTRA_MEAL),
                        intent.getIntExtra(EXTRA_INDEX, -1));
                return;
            }
            if (ACTION_WATER.equals(action)) {
                int ml = intent.getIntExtra(EXTRA_ML, 250);
                if (ml <= 0) ml = 250;
                if (ml > 2000) ml = 2000;
                JSONObject item = new JSONObject();
                item.put("type", "water");
                item.put("ml", ml);
                item.put("ts", System.currentTimeMillis());
                WidgetStore.enqueue(context, item);
                optimisticWater(context, ml);
                updateAll(context);
                try {
                    WaterQuickWidgetProvider.updateAll(context);
                } catch (Exception ignored) {}
                return;
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onDeleted(Context context, int[] appWidgetIds) {
        try {
            for (int id : appWidgetIds) WidgetStore.clearNutritionState(context, id);
        } catch (Exception ignored) {}
        super.onDeleted(context, appWidgetIds);
    }

    public static void updateAll(Context context) {
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(context);
            ComponentName cn = new ComponentName(context, NutritionWidgetProvider.class);
            int[] ids = mgr.getAppWidgetIds(cn);
            for (int id : ids) {
                mgr.updateAppWidget(id, build(context, id));
                // Список позиций живёт в RemoteViewsService: без notify он
                // показывал бы вчерашний набор строк после добавления/удаления.
                try {
                    mgr.notifyAppWidgetViewDataChanged(id, R.id.w_nut_items);
                } catch (Exception ignored) {}
            }
        } catch (Exception ignored) {}
        // Двойной виджет аналитики читает тот же снапшот питания.
        try {
            NutritionPanelWidgetProvider.updateAll(context);
        } catch (Exception ignored) {}
    }

    static void updateWidget(Context context, int widgetId) {
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(context);
            mgr.updateAppWidget(widgetId, build(context, widgetId));
            try {
                mgr.notifyAppWidgetViewDataChanged(widgetId, R.id.w_nut_items);
            } catch (Exception ignored) {}
        } catch (Exception ignored) {}
    }

    /**
     * Вода из виджета должна быть видна сразу, не дожидаясь синка из WebView.
     * Снапшот пополняется оптимистично (включая агрегаты периода); при
     * следующем syncAllWidgets JS пересчитает воду из he_water_log.
     *
     * `ml` может быть отрицательным — кнопка «−250 мл»; ниже нуля не уходим.
     */
    static void optimisticWater(Context context, int ml) {
        try {
            JSONObject d = WidgetStore.getJson(context, WidgetStore.KEY_NUTRITION);
            int before = Math.max(0, d.optInt("waterMl", 0));
            int next = Math.max(0, before + ml);
            d.put("waterMl", next);
            JSONObject periods = d.optJSONObject("periods");
            if (periods != null) {
                JSONObject dayStats = periods.optJSONObject("day");
                // Был ли сегодняшний день уже посчитан в среднем недели/месяца.
                boolean counted = dayStats == null
                        ? before > 0
                        : dayStats.optInt("waterDays", 0) > 0;
                boolean countedNow = next > 0;
                for (String key : new String[]{"day", "week", "month"}) {
                    JSONObject p = periods.optJSONObject(key);
                    if (p == null) continue;
                    int left = Math.max(0, p.optInt("waterMl", 0) + ml);
                    p.put("waterMl", left);
                    if ("day".equals(key)) {
                        // Вода обнулилась — день перестаёт быть «днём с водой»:
                        // иначе среднее за неделю делилось бы на пустой день.
                        p.put("waterDays", countedNow ? 1 : 0);
                    } else if (countedNow && !counted) {
                        p.put("waterDays", Math.max(0, p.optInt("waterDays", 0) + 1));
                    } else if (!countedNow && counted) {
                        p.put("waterDays", Math.max(0, p.optInt("waterDays", 0) - 1));
                    }
                    periods.put(key, p);
                }
                d.put("periods", periods);
            }
            WidgetStore.putJson(context, WidgetStore.KEY_NUTRITION, d);
        } catch (Exception ignored) {}
    }

    /**
     * Еда из нативного редактора: круги обновляются сразу, без входа в приложение.
     * Заодно запоминаем запись в `lastFood` — по ней рисуется кнопка «↩».
     */
    static void optimisticFood(Context context, String name, String meal,
                               int kcal, int p, int f, int c, int qty) {
        if (name == null || name.trim().isEmpty()) return;
        try {
            JSONObject d = WidgetStore.getJson(context, WidgetStore.KEY_NUTRITION);
            String date = dayIso(0);
            // Первая запись дня добавляет день в счётчики периодов: иначе среднее
            // за неделю делилось бы на прежнее число дней и было бы завышено.
            boolean firstOfDay = dayRecordDays(d) <= 0;
            applyFoodTotals(d, kcal, p, f, c);
            if (firstOfDay) shiftPeriodDays(d, 1);
            JSONObject last = new JSONObject();
            last.put("name", name.length() > 40 ? name.substring(0, 40) : name);
            String m = meal == null ? "" : meal;
            last.put("meal", m.length() > 32 ? m.substring(0, 32) : m);
            last.put("date", date);
            last.put("kcal", Math.max(0, kcal));
            last.put("protein", Math.max(0, p));
            last.put("fat", Math.max(0, f));
            last.put("carbs", Math.max(0, c));
            if (qty > 0) last.put("qty", qty);
            // Сначала дописываем строку в список дня, потом запоминаем её адрес:
            // «↩» должен снимать именно эту запись, даже если приём не последний.
            int index = appendDayItem(d, date, last);
            if (index >= 0) last.put("index", index);
            d.put("lastFood", last);
            WidgetStore.putJson(context, WidgetStore.KEY_NUTRITION, d);
        } catch (Exception ignored) {}
    }

    /**
     * Правка порции записи (тап по строке списка дня): строка и круги меняются
     * сразу, не дожидаясь синка. Пропорции те же, что в дневнике
     * (`withDiaryItemQty` на JS-стороне): КБЖУ от сохранённой порции, поэтому
     * `old * newQty / oldQty`. Адрес обязан совпасть (дата + приём + индекс) —
     * иначе не правим ничего.
     */
    static void optimisticFoodEdit(Context context, String date, String meal, int index, int qty) {
        if (date == null || meal == null || index < 0 || qty <= 0) return;
        try {
            JSONObject d = WidgetStore.getJson(context, WidgetStore.KEY_NUTRITION);
            JSONObject days = d.optJSONObject("days");
            JSONObject day = days == null ? null : days.optJSONObject(date);
            JSONArray items = day == null ? null : day.optJSONArray("items");
            // Адрес записи — `meal` + `index` (позиция внутри приёма), а не позиция
            // в плоском списке: в списке дня сначала идут все позиции завтрака,
            // потом обеда, и `items.optJSONObject(index)` попал бы в чужую строку.
            int at = -1;
            JSONObject it = null;
            for (int i = 0; items != null && i < items.length(); i++) {
                JSONObject cand = items.optJSONObject(i);
                if (cand == null) continue;
                if (meal.equals(cand.optString("meal", "")) && cand.optInt("index", -1) == index) {
                    it = cand;
                    at = i;
                    break;
                }
            }
            if (it == null || at < 0) return;

            int oldQty = Math.max(1, Math.min(5000, it.optInt("qty", 100)));
            int nextQty = Math.min(5000, qty);
            float factor = (float) nextQty / oldQty;

            int oldKcal = it.optInt("kcal", 0);
            int oldP = it.optInt("p", 0);
            int oldF = it.optInt("f", 0);
            int oldC = it.optInt("c", 0);
            int newKcal = Math.max(0, Math.round(oldKcal * factor));
            int newP = Math.max(0, Math.round(oldP * factor));
            int newF = Math.max(0, Math.round(oldF * factor));
            int newC = Math.max(0, Math.round(oldC * factor));
            int dkcal = newKcal - oldKcal;
            int dp = newP - oldP;
            int df = newF - oldF;
            int dc = newC - oldC;

            applyFoodTotals(d, dkcal, dp, df, dc);
            it.put("kcal", newKcal);
            it.put("p", newP);
            it.put("f", newF);
            it.put("c", newC);
            it.put("qty", nextQty);
            items.put(at, it);
            day.put("kcal", Math.max(0, day.optInt("kcal", 0) + dkcal));
            day.put("p", Math.max(0, day.optInt("p", 0) + dp));
            day.put("f", Math.max(0, day.optInt("f", 0) + df));
            day.put("c", Math.max(0, day.optInt("c", 0) + dc));
            day.put("items", items);
            days.put(date, day);
            d.put("days", days);

            // «↩» адресует эту же запись — её числа тоже новые, иначе отмена
            // вычла бы старую порцию.
            JSONObject last = d.optJSONObject("lastFood");
            if (last != null
                    && date.equals(last.optString("date", ""))
                    && meal.equals(last.optString("meal", ""))
                    && last.optInt("index", -1) == index) {
                last.put("kcal", newKcal);
                last.put("protein", newP);
                last.put("fat", newF);
                last.put("carbs", newC);
                last.put("qty", nextQty);
                d.put("lastFood", last);
            }
            WidgetStore.putJson(context, WidgetStore.KEY_NUTRITION, d);
        } catch (Exception ignored) {}
    }

    /** Дней с записями по счётчику периода «день» — то же число, что считает JS. */
    private static int dayRecordDays(JSONObject d) {
        JSONObject periods = d.optJSONObject("periods");
        JSONObject day = periods == null ? null : periods.optJSONObject("day");
        return day == null ? 0 : Math.max(0, day.optInt("days", 0));
    }

    /**
     * Сдвиг «дней с записями» во всех периодах. Периоды считает JS; между синками
     * держим их согласованными: без этого первая еда дня не попадала в среднее за
     * неделю, а снятие последней записи не убирало день из среднего.
     */
    private static void shiftPeriodDays(JSONObject d, int delta) throws JSONException {
        if (delta == 0) return;
        JSONObject periods = d.optJSONObject("periods");
        if (periods == null) return;
        for (String key : new String[]{"day", "week", "month"}) {
            JSONObject p = periods.optJSONObject(key);
            if (p == null) continue;
            p.put("days", Math.max(0, p.optInt("days", 0) + delta));
            periods.put(key, p);
        }
        d.put("periods", periods);
    }

    /** Порядок приёмов как в дневнике (`MEAL_PRESETS` на JS-стороне). */
    private static final String[] MEAL_ORDER = {
            "Завтрак", "Второй завтрак", "Обед", "Полдник", "Ужин", "Перекус",
            "До тренировки", "После тренировки", "Поздний перекус"
    };

    private static int mealRank(String meal) {
        for (int i = 0; i < MEAL_ORDER.length; i++) {
            if (MEAL_ORDER[i].equals(meal)) return i;
        }
        return MEAL_ORDER.length; // незнакомый приём — в конце списка
    }

    /**
     * Дописываем позицию в список дня снапшота — чтобы «✕» и список на столе
     * сразу видели только что добавленное, не дожидаясь синка из WebView.
     *
     * Ставим её не в конец, а в свой приём (порядок как в дневнике): иначе
     * «Завтрак», добавленный после «Ужина», прыгал бы в конец списка.
     * Возвращает `index` внутри приёма — адрес для «✕»/«↩»; −1, если дня нет.
     */
    private static int appendDayItem(JSONObject d, String date, JSONObject food) {
        try {
            JSONObject days = d.optJSONObject("days");
            if (days == null) return -1;
            JSONObject day = days.optJSONObject(date);
            if (day == null) return -1; // дня в снапшоте нет — синк всё равно его пришлёт
            JSONArray items = day.optJSONArray("items");
            if (items == null) items = new JSONArray();
            String meal = food.optString("meal", "");
            int rank = mealRank(meal);
            int index = 0;
            int insertAt = items.length();
            for (int i = 0; i < items.length(); i++) {
                JSONObject it = items.optJSONObject(i);
                if (it == null) continue;
                if (meal.equals(it.optString("meal", ""))) index++;
                if (insertAt == items.length() && rank < mealRank(it.optString("meal", ""))) {
                    insertAt = i;
                }
            }
            JSONObject item = new JSONObject();
            item.put("name", food.optString("name", ""));
            item.put("kcal", Math.max(0, food.optInt("kcal", 0)));
            item.put("p", Math.max(0, food.optInt("protein", 0)));
            item.put("f", Math.max(0, food.optInt("fat", 0)));
            item.put("c", Math.max(0, food.optInt("carbs", 0)));
            item.put("meal", meal);
            item.put("index", index);
            int qty = food.optInt("qty", 0);
            if (qty > 0) item.put("qty", qty);
            JSONArray next = new JSONArray();
            for (int i = 0; i < items.length(); i++) {
                if (i == insertAt) next.put(item);
                JSONObject it = items.optJSONObject(i);
                if (it != null) next.put(it);
            }
            if (insertAt >= items.length()) next.put(item);
            day.put("items", next);
            day.put("kcal", Math.max(0, day.optInt("kcal", 0) + item.optInt("kcal", 0)));
            day.put("p", Math.max(0, day.optInt("p", 0) + item.optInt("p", 0)));
            day.put("f", Math.max(0, day.optInt("f", 0) + item.optInt("f", 0)));
            day.put("c", Math.max(0, day.optInt("c", 0) + item.optInt("c", 0)));
            days.put(date, day);
            return index;
        } catch (Exception ignored) {
            // Список дня — украшение: без него запись всё равно уйдёт в очередь.
            return -1;
        }
    }

    /**
     * Снимаем последнюю позицию дня из снапшота — путь для старого снапшота без
     * адреса записи. Плоский список идёт в порядке дневника, поэтому последняя
     * строка и есть «последняя запись последнего непустого приёма». Индексы
     * внутри приёма не сдвигаем: свежий снапшот придёт с ближайшим синком.
     *
     * Возвращает true, если день остался без записей: тогда его надо убрать из
     * счётчиков периодов.
     */
    private static boolean removeLastDayItem(JSONObject d, String date) {
        try {
            JSONObject days = d.optJSONObject("days");
            JSONObject day = days == null ? null : days.optJSONObject(date);
            JSONArray items = day == null ? null : day.optJSONArray("items");
            if (items == null || items.length() == 0) return false;
            JSONObject last = items.optJSONObject(items.length() - 1);
            if (last == null) return false;
            JSONArray next = new JSONArray();
            for (int i = 0; i < items.length() - 1; i++) next.put(items.optJSONObject(i));
            day.put("items", next);
            day.put("kcal", Math.max(0, day.optInt("kcal", 0) - Math.max(0, last.optInt("kcal", 0))));
            day.put("p", Math.max(0, day.optInt("p", 0) - Math.max(0, last.optInt("p", 0))));
            day.put("f", Math.max(0, day.optInt("f", 0) - Math.max(0, last.optInt("f", 0))));
            day.put("c", Math.max(0, day.optInt("c", 0) - Math.max(0, last.optInt("c", 0))));
            days.put(date, day);
            return next.length() == 0;
        } catch (Exception ignored) {
            // КБЖУ дня уже снято выше — расхождение подтянет ближайший синк.
            return false;
        }
    }

    /**
     * «↩»: снимаем последнюю запись еды дня. В дневнике её убирает JS при
     * следующем синке (`type=food_remove`), здесь — сразу уменьшаем круги на
     * её КБЖУ и снимаем `lastFood`, чтобы двойной тап не списал дважды.
     *
     * Запись адресуется (день + приём + индекс), как только адрес есть в
     * `lastFood`: иначе JS снял бы «последнюю запись дня», а кнопка обещала
     * конкретную — при добавлении в «Завтрак» после «Ужина» это была бы чужая еда.
     */
    static void undoLastFood(Context context) {
        try {
            JSONObject d = WidgetStore.getJson(context, WidgetStore.KEY_NUTRITION);
            JSONObject last = d.optJSONObject("lastFood");
            if (last == null) return;
            String date = last.optString("date", "");
            if (date.isEmpty()) date = dayIso(0);
            String meal = last.optString("meal", "");
            int index = last.optInt("index", -1);
            boolean addressed = !meal.isEmpty() && index >= 0;

            JSONObject item = new JSONObject();
            item.put("type", "food_remove");
            item.put("date", date);
            if (addressed) {
                item.put("meal", meal);
                item.put("index", index);
            }
            item.put("ts", System.currentTimeMillis());
            WidgetStore.enqueue(context, item);

            if (addressed) {
                // Точечно: снимаем ровно ту строку, которую обещала кнопка.
                optimisticRemoveItem(context, date, meal, index);
            } else {
                // Старый снапшот без адреса: снимаем последнюю позицию дня.
                applyFoodDelta(context,
                        -Math.max(0, last.optInt("kcal", 0)),
                        -Math.max(0, last.optInt("protein", 0)),
                        -Math.max(0, last.optInt("fat", 0)),
                        -Math.max(0, last.optInt("carbs", 0)));
                JSONObject next = WidgetStore.getJson(context, WidgetStore.KEY_NUTRITION);
                boolean emptied = removeLastDayItem(next, date);
                // День остался без записей — убираем его из среднего недели/месяца.
                if (emptied && date.equals(dayIso(0))) shiftPeriodDays(next, -1);
                WidgetStore.putJson(context, WidgetStore.KEY_NUTRITION, next);
            }
            JSONObject next = WidgetStore.getJson(context, WidgetStore.KEY_NUTRITION);
            next.remove("lastFood");
            WidgetStore.putJson(context, WidgetStore.KEY_NUTRITION, next);
            updateAll(context);
        } catch (Exception ignored) {}
    }

    /**
     * Тап по чипу «недавние / избранное»: пишем блюдо в день без ввода КБЖУ.
     * `raw` — продукт, который был нарисован на чипе. Если его нет (старый
     * PendingIntent после обновления APK), берём `quick[index]` из снапшота.
     */
    static void addQuickFood(Context context, int index, String raw) {
        JSONObject q = parseQuickItem(raw);
        if (q == null) {
            if (index < 0) return;
            JSONObject d = WidgetStore.getJson(context, WidgetStore.KEY_NUTRITION);
            JSONArray quick = d.optJSONArray("quick");
            q = quick == null ? null : quick.optJSONObject(index);
        }
        if (q == null) return;
        try {
            String name = q.optString("name", "").trim();
            if (name.isEmpty()) return;
            int kcal = Math.max(0, q.optInt("kcal", 0));
            int p = Math.max(0, q.optInt("p", 0));
            int f = Math.max(0, q.optInt("f", 0));
            int c = Math.max(0, q.optInt("c", 0));
            int qty = q.optInt("qty", 100);
            if (qty <= 0) qty = 100;
            if (qty > 5000) qty = 5000;
            String meal = q.optString("meal", "");
            if (meal.isEmpty()) meal = mealForNow();
            JSONObject item = new JSONObject();
            item.put("type", "food");
            item.put("name", name);
            item.put("kcal", kcal);
            item.put("p", p);
            item.put("f", f);
            item.put("c", c);
            item.put("qty", qty);
            item.put("meal", meal);
            // Продукт из избранного/дневника: дневник узнает его по id.
            String foodId = q.optString("foodId", "").trim();
            if (!foodId.isEmpty()) item.put("foodId", foodId);
            item.put("ts", System.currentTimeMillis());
            WidgetStore.enqueue(context, item);
            optimisticFood(context, name, meal, kcal, p, f, c, qty);
            updateAll(context);
        } catch (Exception ignored) {}
    }

    /** Продукт чипа из интента; пустой или битый JSON — null (тогда берём индекс). */
    private static JSONObject parseQuickItem(String raw) {
        if (raw == null || raw.isEmpty()) return null;
        try {
            JSONObject q = new JSONObject(raw);
            return q.optString("name", "").trim().isEmpty() ? null : q;
        } catch (JSONException e) {
            return null;
        }
    }

    /** «✕» в списке дня: удалить позицию (date + meal + index) и пересчитать снапшот. */
    static void removeDayItem(Context context, int widgetId, String date, String meal, int index) {
        if (date == null || meal == null || index < 0) return;
        try {
            JSONObject item = new JSONObject();
            item.put("type", "food_remove");
            item.put("date", date);
            item.put("meal", meal);
            item.put("index", index);
            item.put("ts", System.currentTimeMillis());
            WidgetStore.enqueue(context, item);
            optimisticRemoveItem(context, date, meal, index);
            if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) updateWidget(context, widgetId);
            else updateAll(context);
        } catch (Exception ignored) {}
    }

    /**
     * Убираем строку из снапшота сразу, не дожидаясь синка: иначе список на
     * столе «отпрыгнул» бы обратно до следующего открытия приложения. Индексы
     * оставшихся позиций того же приёма сдвигаем — они адреса для следующих «✕».
     */
    private static void optimisticRemoveItem(Context context, String date, String meal, int index) {
        try {
            JSONObject d = WidgetStore.getJson(context, WidgetStore.KEY_NUTRITION);
            JSONObject days = d.optJSONObject("days");
            JSONObject day = days == null ? null : days.optJSONObject(date);
            if (day == null) return;
            JSONArray items = day.optJSONArray("items");
            if (items == null) return;
            JSONArray next = new JSONArray();
            int kcal = 0, p = 0, f = 0, c = 0;
            boolean removed = false;
            for (int i = 0; i < items.length(); i++) {
                JSONObject it = items.optJSONObject(i);
                if (it == null) continue;
                boolean sameMeal = meal.equals(it.optString("meal", ""));
                if (!removed && sameMeal && it.optInt("index", -1) == index) {
                    kcal = Math.max(0, it.optInt("kcal", 0));
                    p = Math.max(0, it.optInt("p", 0));
                    f = Math.max(0, it.optInt("f", 0));
                    c = Math.max(0, it.optInt("c", 0));
                    removed = true;
                    continue;
                }
                if (removed && sameMeal) {
                    it.put("index", Math.max(0, it.optInt("index", 0) - 1));
                }
                next.put(it);
            }
            if (!removed) return;
            day.put("items", next);
            day.put("kcal", Math.max(0, day.optInt("kcal", 0) - kcal));
            day.put("p", Math.max(0, day.optInt("p", 0) - p));
            day.put("f", Math.max(0, day.optInt("f", 0) - f));
            day.put("c", Math.max(0, day.optInt("c", 0) - c));
            if (days != null) {
                days.put(date, day);
                d.put("days", days);
            }
            // Сегодняшний день продублирован в корне снапшота и в агрегатах.
            if (date.equals(dayIso(0))) {
                d.put("kcal", Math.max(0, d.optInt("kcal", 0) - kcal));
                d.put("protein", Math.max(0, d.optInt("protein", 0) - p));
                d.put("fat", Math.max(0, d.optInt("fat", 0) - f));
                d.put("carbs", Math.max(0, d.optInt("carbs", 0) - c));
                JSONObject periods = d.optJSONObject("periods");
                if (periods != null) {
                    for (String key : new String[]{"day", "week", "month"}) {
                        JSONObject period = periods.optJSONObject(key);
                        if (period == null) continue;
                        period.put("kcal", Math.max(0, period.optInt("kcal", 0) - kcal));
                        period.put("protein", Math.max(0, period.optInt("protein", 0) - p));
                        period.put("fat", Math.max(0, period.optInt("fat", 0) - f));
                        period.put("carbs", Math.max(0, period.optInt("carbs", 0) - c));
                        periods.put(key, period);
                    }
                    d.put("periods", periods);
                }
                // Сняли последнюю запись дня — дня с записями больше нет.
                if (next.length() == 0) shiftPeriodDays(d, -1);
            }
            WidgetStore.putJson(context, WidgetStore.KEY_NUTRITION, d);
        } catch (Exception ignored) {}
    }

    /** ISO-дата для сдвига дня: 0 — сегодня, −1 — вчера (локальный календарь). */
    static String dayIso(int offset) {
        try {
            Calendar c = Calendar.getInstance();
            c.add(Calendar.DAY_OF_MONTH, offset);
            return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(c.getTime());
        } catch (Exception e) {
            return "";
        }
    }

    /** Подпись дня в шапке: «Сегодня» / «Вчера» / «21 нояб.». */
    static String dayLabel(int offset) {
        if (offset == 0) return "Сегодня";
        if (offset == -1) return "Вчера";
        try {
            Calendar c = Calendar.getInstance();
            c.add(Calendar.DAY_OF_MONTH, offset);
            return new SimpleDateFormat("d MMM", Locale.forLanguageTag("ru")).format(c.getTime());
        } catch (Exception e) {
            return "";
        }
    }

    /** Строка для RemoteViews: длиннее не влезет, а обрезать надо по границе. */
    static String clipText(String value, int max) {
        String v = value == null ? "" : value.trim();
        return v.length() > max ? v.substring(0, max - 1) + "…" : v;
    }

    /**
     * КБЖУ в корне снапшота и в агрегатах периодов: +еда, −отмена. Число дней
     * с записями не трогает — за него отвечает `shiftPeriodDays` (иначе первая
     * запись дня и снятие последней расходились с тем, что считает JS).
     */
    private static void applyFoodTotals(JSONObject d, int kcal, int p, int f, int c)
            throws JSONException {
        d.put("kcal", Math.max(0, d.optInt("kcal", 0) + kcal));
        d.put("protein", Math.max(0, d.optInt("protein", 0) + p));
        d.put("fat", Math.max(0, d.optInt("fat", 0) + f));
        d.put("carbs", Math.max(0, d.optInt("carbs", 0) + c));
        JSONObject periods = d.optJSONObject("periods");
        if (periods != null) {
            for (String key : new String[]{"day", "week", "month"}) {
                JSONObject period = periods.optJSONObject(key);
                if (period == null) continue;
                period.put("kcal", Math.max(0, period.optInt("kcal", 0) + kcal));
                period.put("protein", Math.max(0, period.optInt("protein", 0) + p));
                period.put("fat", Math.max(0, period.optInt("fat", 0) + f));
                period.put("carbs", Math.max(0, period.optInt("carbs", 0) + c));
                periods.put(key, period);
            }
            d.put("periods", periods);
        }
    }

    /** Сдвиг КБЖУ в снапшоте и агрегатах: положительный — еда, отрицательный — отмена. */
    private static boolean applyFoodDelta(Context context, int kcal, int p, int f, int c) {
        try {
            JSONObject d = WidgetStore.getJson(context, WidgetStore.KEY_NUTRITION);
            applyFoodTotals(d, kcal, p, f, c);
            WidgetStore.putJson(context, WidgetStore.KEY_NUTRITION, d);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    static RemoteViews build(Context context, int widgetId) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_nutrition);
        JSONObject d = WidgetStore.getJson(context, WidgetStore.KEY_NUTRITION);
        String period = WidgetStore.getNutritionPeriod(context, widgetId);
        boolean sum = !"day".equals(period);

        JSONObject periods = d.optJSONObject("periods");
        JSONObject pd = periods != null ? periods.optJSONObject(period) : null;
        // Листание дат есть только у «Дня»: неделя и месяц всегда текущие.
        int dayOffset = sum ? 0 : WidgetStore.getNutritionDayOffset(context, widgetId);
        // Прошлый день — только чтение и удаление: добавление «в прошлое»
        // писало бы в сегодняшний день, поэтому кнопки добавления скрыты.
        boolean past = !sum && dayOffset != 0;
        JSONObject dayJson = null;
        if (past) {
            JSONObject days = d.optJSONObject("days");
            dayJson = days == null ? null : days.optJSONObject(dayIso(dayOffset));
        }

        int target = Math.max(0, d.optInt("targetKcal", 0));
        int tProtein = Math.max(0, d.optInt("targetProtein", 0));
        int tFat = Math.max(0, d.optInt("targetFat", 0));
        int tCarbs = Math.max(0, d.optInt("targetCarbs", 0));
        int tWater = Math.max(0, d.optInt("waterTargetMl", 0));

        int totalKcal;
        int totalProtein;
        int totalFat;
        int totalCarbs;
        int totalWater;
        int days;
        int waterDays;
        if (pd != null) {
            totalKcal = Math.max(0, pd.optInt("kcal", 0));
            totalProtein = Math.max(0, pd.optInt("protein", 0));
            totalFat = Math.max(0, pd.optInt("fat", 0));
            totalCarbs = Math.max(0, pd.optInt("carbs", 0));
            totalWater = Math.max(0, pd.optInt("waterMl", 0));
            days = Math.max(0, pd.optInt("days", 0));
            waterDays = Math.max(0, pd.optInt("waterDays", 0));
        } else if (past) {
            // Прошлый день из снапшота: цели общие, факт — именно этого дня.
            // Если снапшот его ещё не знает (старый кэш) — честно пустой день.
            totalKcal = dayJson == null ? 0 : Math.max(0, dayJson.optInt("kcal", 0));
            totalProtein = dayJson == null ? 0 : Math.max(0, dayJson.optInt("p", 0));
            totalFat = dayJson == null ? 0 : Math.max(0, dayJson.optInt("f", 0));
            totalCarbs = dayJson == null ? 0 : Math.max(0, dayJson.optInt("c", 0));
            totalWater = dayJson == null ? 0 : Math.max(0, dayJson.optInt("waterMl", 0));
            JSONArray items = dayJson == null ? null : dayJson.optJSONArray("items");
            days = items != null && items.length() > 0 ? 1 : 0;
            waterDays = totalWater > 0 ? 1 : 0;
        } else {
            totalKcal = Math.max(0, d.optInt("kcal", 0));
            totalProtein = Math.max(0, d.optInt("protein", 0));
            totalFat = Math.max(0, d.optInt("fat", 0));
            totalCarbs = Math.max(0, d.optInt("carbs", 0));
            totalWater = Math.max(0, d.optInt("waterMl", 0));
            boolean hasDay = d.has("kcal") || d.has("targetKcal");
            days = hasDay ? 1 : 0;
            waterDays = totalWater > 0 ? 1 : 0;
        }

        // Неделя/месяц: кольца и «факт» показывают среднее в ДЕНЬ (сравнивать
        // сумму за 30 дней с дневной целью было бы бессмысленно), сводка — сумму.
        int dayDiv = Math.max(1, days);
        int kcal = Math.round(totalKcal / (float) dayDiv);
        int protein = Math.round(totalProtein / (float) dayDiv);
        int fat = Math.round(totalFat / (float) dayDiv);
        int carbs = Math.round(totalCarbs / (float) dayDiv);
        int waterDiv = Math.max(1, waterDays);
        int waterAvg = Math.round(totalWater / (float) waterDiv);
        int water = sum ? waterAvg : totalWater;
        boolean has = days > 0 || totalWater > 0
                || (!sum && dayOffset == 0 && (d.has("kcal") || d.has("targetKcal")));

        int queue = WidgetStore.queueSize(context);

        v.setTextViewText(R.id.w_nut_date, sum ? dateLabel(period) : dayLabel(dayOffset));
        stylePeriodChip(v, R.id.w_nut_p_day, "day".equals(period));
        stylePeriodChip(v, R.id.w_nut_p_week, "week".equals(period));
        stylePeriodChip(v, R.id.w_nut_p_month, "month".equals(period));
        v.setOnClickPendingIntent(R.id.w_nut_p_day, periodAction(context, widgetId, "day"));
        v.setOnClickPendingIntent(R.id.w_nut_p_week, periodAction(context, widgetId, "week"));
        v.setOnClickPendingIntent(R.id.w_nut_p_month, periodAction(context, widgetId, "month"));
        // Стрелки листания дат — только у «Дня»; глубже недели снапшот не хранит.
        if (sum) {
            v.setViewVisibility(R.id.w_nut_prev, View.GONE);
            v.setViewVisibility(R.id.w_nut_next, View.GONE);
        } else {
            v.setViewVisibility(R.id.w_nut_prev, dayOffset > -6 ? View.VISIBLE : View.INVISIBLE);
            v.setViewVisibility(R.id.w_nut_next, dayOffset < 0 ? View.VISIBLE : View.INVISIBLE);
            v.setOnClickPendingIntent(R.id.w_nut_prev, dayStepAction(context, widgetId, -1, 61));
            v.setOnClickPendingIntent(R.id.w_nut_next, dayStepAction(context, widgetId, 1, 62));
        }

        // Очередь быстрых записей (вода/еда, ещё не разобранные приложением).
        if (queue > 0) {
            v.setTextViewText(R.id.w_nut_queue, "⏳ " + queue);
            v.setViewVisibility(R.id.w_nut_queue, View.VISIBLE);
            v.setContentDescription(R.id.w_nut_queue, "В очереди: " + queue);
        } else {
            v.setViewVisibility(R.id.w_nut_queue, View.GONE);
        }

        // ---- Круги КБЖУ ----
        int kcalPct = target > 0 ? Math.min(100, Math.round(kcal * 100f / target)) : 0;
        v.setProgressBar(R.id.w_nut_kcal_ring, 100, kcalPct, false);
        v.setTextViewText(R.id.w_nut_kcal_pct, target > 0 ? (kcalPct + "%") : "—");
        v.setTextColor(R.id.w_nut_kcal_pct,
                target > 0 && kcal > target ? C_DANGER : (kcalPct >= 100 ? C_ACCENT : 0xFFFFFFFF));
        v.setTextViewText(R.id.w_nut_kcal_value, formatNum(kcal));
        v.setTextViewText(R.id.w_nut_kcal_target,
                target > 0 ? ("из " + formatNum(target) + " ккал") : "цель не задана");
        v.setTextColor(R.id.w_nut_kcal_target, target > 0 && kcal > target ? C_DANGER : C_MUTED);

        setRing(v, R.id.w_nut_p_ring, R.id.w_nut_p_pct, R.id.w_nut_p_value, protein, tProtein);
        setRing(v, R.id.w_nut_f_ring, R.id.w_nut_f_pct, R.id.w_nut_f_value, fat, tFat);
        setRing(v, R.id.w_nut_c_ring, R.id.w_nut_c_pct, R.id.w_nut_c_value, carbs, tCarbs);

        // ---- Сводка ----
        String summary;
        if (!has) {
            summary = sum ? ("За " + periodWord(period) + " записей нет — добавьте еду")
                    : (past ? "За этот день записей нет" : "Данных за сегодня пока нет — добавьте еду");
        } else if (sum) {
            summary = "Σ " + formatNum(totalKcal) + " ккал " + periodWord(period)
                    + " · " + days + " " + plural(days, "день", "дня", "дней") + " с записями";
        } else if (past) {
            // Прошлый день — не «осталось», а итог: цель уже не догнать.
            String macros = "";
            if (protein > 0) macros += " · Б" + protein;
            if (fat > 0) macros += " Ж" + fat;
            if (carbs > 0) macros += " У" + carbs;
            summary = "Съедено " + formatNum(kcal) + " ккал" + macros;
        } else if (target > 0) {
            int left = target - kcal;
            if (left > 0) {
                // Остаток Б/Ж/У в граммах — как в дневнике, а не только ккал:
                // одной цифры калорий мало, чтобы понять, чего не хватает.
                String macros = "";
                if (tProtein > 0) macros += " · Б" + Math.max(0, tProtein - protein);
                if (tFat > 0) macros += " Ж" + Math.max(0, tFat - fat);
                if (tCarbs > 0) macros += " У" + Math.max(0, tCarbs - carbs);
                summary = macros.isEmpty()
                        ? ("Осталось " + formatNum(left) + " ккал из " + formatNum(target))
                        : ("Осталось " + formatNum(left) + " ккал" + macros);
            } else if (left == 0) {
                summary = "Цель дня закрыта: " + formatNum(target) + " ккал";
            } else {
                summary = "Перебор " + formatNum(-left) + " ккал из " + formatNum(target);
            }
        } else {
            summary = "Съедено " + formatNum(kcal) + " ккал · цель не задана";
        }
        v.setTextViewText(R.id.w_nut_summary, summary);
        v.setTextColor(R.id.w_nut_summary, target > 0 && kcal > target ? C_DANGER : C_MUTED);

        // ---- Вода ----
        int waterPct = tWater > 0 && !sum ? Math.min(100, Math.round(water * 100f / tWater))
                : (tWater > 0 && waterDays > 0 ? Math.min(100, Math.round(water * 100f / tWater)) : 0);
        boolean waterDone = tWater > 0 && water >= tWater;
        String waterLine;
        if (sum) {
            waterLine = waterDays == 0
                    ? ("Вода за " + periodWord(period) + " не записана")
                    : ("Вода " + formatNum(totalWater) + " мл " + periodWord(period)
                            + " · ср " + formatNum(waterAvg));
        } else {
            waterLine = tWater > 0
                    ? ((waterDone ? "✓ " : "") + "Вода " + formatNum(water) + " / " + formatNum(tWater) + " мл")
                    : (water > 0 ? ("Вода " + formatNum(water) + " мл") : "Вода не записана");
        }
        v.setTextViewText(R.id.w_nut_water_label, waterLine);
        v.setTextViewText(R.id.w_nut_water_pct,
                tWater > 0 ? (waterDone ? "цель" : (waterPct + "%")) : " ");
        v.setTextColor(R.id.w_nut_water_pct, waterDone ? C_ACCENT : C_MUTED);
        v.setProgressBar(R.id.w_nut_water_bar, 100, waterPct, false);

        // ---- Быстрое добавление (избранное / недавние) и список дня ----
        JSONArray quick = !sum && !past ? d.optJSONArray("quick") : null;
        int[] quickIds = {R.id.w_nut_q1, R.id.w_nut_q2, R.id.w_nut_q3};
        boolean quickOn = false;
        for (int i = 0; i < quickIds.length; i++) {
            JSONObject q = quick != null ? quick.optJSONObject(i) : null;
            String qname = q == null ? "" : q.optString("name", "").trim();
            if (qname.isEmpty()) {
                v.setViewVisibility(quickIds[i], View.GONE);
                continue;
            }
            quickOn = true;
            v.setViewVisibility(quickIds[i], View.VISIBLE);
            v.setTextViewText(quickIds[i], clipText(qname, 14));
            v.setContentDescription(quickIds[i],
                    "Добавить: " + qname + ", " + q.optInt("kcal", 0) + " ккал");
            v.setOnClickPendingIntent(quickIds[i], quickAddAction(context, i, q, 63 + i));
        }
        v.setViewVisibility(R.id.w_nut_quick_row, quickOn ? View.VISIBLE : View.GONE);

        // Список позиций дня — RemoteViewsService: строки скроллятся, «✕» удаляет.
        v.setViewVisibility(R.id.w_nut_items_box, sum ? View.GONE : View.VISIBLE);
        if (!sum) {
            Intent adapter = new Intent(context, NutritionItemsWidgetService.class);
            adapter.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
            adapter.setData(Uri.parse("he://nut-items/" + widgetId));
            v.setRemoteAdapter(R.id.w_nut_items, adapter);
            v.setEmptyView(R.id.w_nut_items, R.id.w_nut_items_empty);
            // В прошлом дне кнопок добавления нет — «добавьте еду» там не подсказка.
            v.setTextViewText(R.id.w_nut_items_empty,
                    past ? "За этот день записей нет" : "Пока пусто — добавьте еду");
        }

        // ---- Действия ----
        // Прошлый день только читается: добавление ушло бы в сегодняшний день.
        v.setViewVisibility(R.id.w_nut_actions, past ? View.GONE : View.VISIBLE);
        v.setViewVisibility(R.id.w_nut_water_actions, past ? View.GONE : View.VISIBLE);
        v.setOnClickPendingIntent(R.id.w_nut_water_minus, waterMinusAction(context, 250, 40));
        v.setOnClickPendingIntent(R.id.w_nut_water, waterAction(context, 250, 41));
        v.setOnClickPendingIntent(R.id.w_nut_water500, waterAction(context, 500, 42));
        v.setOnClickPendingIntent(R.id.w_nut_food, foodAction(context, mealForNow(), 45));
        // «↩» показываем только когда в дне есть что отменять: снапшот несёт
        // последнюю запись (`lastFood`), её же снимает JS по `type=food_remove`.
        JSONObject lastFood = d.optJSONObject("lastFood");
        if (lastFood != null) {
            String lastName = lastFood.optString("name", "");
            v.setViewVisibility(R.id.w_nut_food_undo, View.VISIBLE);
            v.setOnClickPendingIntent(R.id.w_nut_food_undo, foodUndoAction(context, 48));
            v.setContentDescription(R.id.w_nut_food_undo,
                    lastName.isEmpty() ? "Отменить последнюю запись еды" : "Отменить: " + lastName);
        } else {
            v.setViewVisibility(R.id.w_nut_food_undo, View.GONE);
        }
        v.setOnClickPendingIntent(R.id.w_nut_scan,
                TrainingWidgetProvider.openApp(context, WidgetStore.TARGET_NUTRITION_SCAN, 46));
        v.setOnClickPendingIntent(R.id.w_nut_photo,
                TrainingWidgetProvider.openApp(context, WidgetStore.TARGET_NUTRITION_PHOTO, 47));
        // «Свой» — не «открыть дневник», а свой объём воды: диалог с полем «мл».
        v.setOnClickPendingIntent(R.id.w_nut_open, waterCustomAction(context, 43));
        v.setOnClickPendingIntent(R.id.w_nut_root,
                TrainingWidgetProvider.openApp(context, WidgetStore.TARGET_NUTRITION, 44));

        // TalkBack: подписи кнопок. Без них диктор читает «＋ Еда» и «−250» как
        // набор символов, а «Свой» вообще непонятно к чему относится.
        v.setContentDescription(R.id.w_nut_prev, "Предыдущий день");
        v.setContentDescription(R.id.w_nut_next, "Следующий день");
        v.setContentDescription(R.id.w_nut_p_day, "Период: день");
        v.setContentDescription(R.id.w_nut_p_week, "Период: неделя");
        v.setContentDescription(R.id.w_nut_p_month, "Период: месяц");
        v.setContentDescription(R.id.w_nut_food, "Добавить еду");
        v.setContentDescription(R.id.w_nut_scan, "Сканировать штрихкод в приложении");
        v.setContentDescription(R.id.w_nut_photo, "Сфотографировать этикетку в приложении");
        v.setContentDescription(R.id.w_nut_water_minus, "Убрать 250 мл воды");
        v.setContentDescription(R.id.w_nut_water, "Добавить 250 мл воды");
        v.setContentDescription(R.id.w_nut_water500, "Добавить 500 мл воды");
        v.setContentDescription(R.id.w_nut_open, "Свой объём воды");

        // TalkBack: весь виджет читается одной фразой, а не набором цифр без подписей.
        String scope = periodWord(period);
        String a11y = has
                ? ("Питание " + scope + ": " + formatNum(kcal) + " из " + (target > 0 ? formatNum(target) : "—")
                        + " ккал в день, белки " + protein + " из " + tProtein
                        + ", жиры " + fat + " из " + tFat
                        + ", углеводы " + carbs + " из " + tCarbs + " грамм"
                        + (sum ? (", дней с записями " + days) : ""))
                : ("Питание " + scope + ": записей пока нет");
        v.setContentDescription(R.id.w_nut_root, a11y);
        return WidgetStyle.apply(context, v, R.id.w_nut_root);
    }

    /** Круг макроса: процент внутри, «факт / цель» под ним. */
    private static void setRing(RemoteViews v, int ringId, int pctId, int valueId, int value, int target) {
        int pct = target > 0 ? Math.min(100, Math.round(value * 100f / target)) : 0;
        v.setProgressBar(ringId, 100, pct, false);
        v.setTextViewText(pctId, target > 0 ? (pct + "%") : "—");
        v.setTextColor(pctId, target > 0 && value > target ? C_DANGER : 0xFFFFFFFF);
        // Тесно в 3 колонки: «98/150» без пробелов вокруг слэша.
        v.setTextViewText(valueId,
                target > 0 ? (value + "/" + target) : String.valueOf(value));
        v.setTextColor(valueId, target > 0 && value >= target ? C_ACCENT : C_TEXT);
    }

    static void stylePeriodChip(RemoteViews v, int id, boolean on) {
        v.setInt(id, "setBackgroundResource", on ? R.drawable.widget_chip_on : R.drawable.widget_chip);
        v.setTextColor(id, on ? 0xFF07111F : C_TEXT);
    }

    /** 1380 -> «1 380»: тысячи читаются как в дневнике. */
    static String formatNum(int n) {
        try {
            return String.format(Locale.US, "%,d", n).replace(',', ' ');
        } catch (Exception e) {
            return String.valueOf(n);
        }
    }

    /** «день» / «неделя» / «месяц» — подписи в сводке и TalkBack. */
    static String periodNoun(String period) {
        if ("week".equals(period)) return "неделя";
        if ("month".equals(period)) return "месяц";
        return "день";
    }

    /** «за день» / «за неделю» / «за месяц». */
    static String periodWord(String period) {
        if ("week".equals(period)) return "за неделю";
        if ("month".equals(period)) return "за месяц";
        return "за день";
    }

    /** Подпись периода в шапке: дата дня, диапазон недели или месяц. */
    static String dateLabel(String period) {
        try {
            Locale ru = Locale.forLanguageTag("ru");
            Calendar c = Calendar.getInstance();
            if ("month".equals(period)) {
                return new SimpleDateFormat("LLLL yyyy", ru).format(c.getTime());
            }
            if ("week".equals(period)) {
                int back = (c.get(Calendar.DAY_OF_WEEK) + 5) % 7; // Пн=0 … Вс=6
                Calendar start = (Calendar) c.clone();
                start.add(Calendar.DAY_OF_MONTH, -back);
                Calendar end = (Calendar) start.clone();
                end.add(Calendar.DAY_OF_MONTH, 6);
                String from = new SimpleDateFormat("d", ru).format(start.getTime());
                String to = new SimpleDateFormat("d MMM", ru).format(end.getTime());
                return "нед. " + from + "–" + to;
            }
            return new SimpleDateFormat("EEE, d MMM", ru).format(new Date());
        } catch (Exception e) {
            return "";
        }
    }

    static String plural(int n, String one, String few, String many) {
        int mod10 = Math.abs(n) % 10;
        int mod100 = Math.abs(n) % 100;
        if (mod10 == 1 && mod100 != 11) return one;
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
        return many;
    }

    /**
     * Приём по времени суток — границы ровно как у дневника (`mealForNow` в
     * `useDiaryMealTypes`): 5–11 завтрак, 11–16 обед, 16–22 ужин, иначе перекус.
     * Прежние 11/15/18/23 отправляли еду в 17:00 в «Перекус», а в 2 часа ночи —
     * в «Завтрак», и блюдо на виджете попадало не в тот приём, что в дневнике.
     */
    static String mealForNow() {
        try {
            int h = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY);
            if (h >= 5 && h < 11) return "Завтрак";
            if (h < 16) return "Обед";
            if (h < 22) return "Ужин";
            return "Перекус";
        } catch (Exception e) {
            return "Перекус";
        }
    }

    static PendingIntent waterAction(Context context, int ml, int code) {
        Intent i = new Intent(context, NutritionWidgetProvider.class);
        i.setAction(ACTION_WATER);
        i.putExtra(EXTRA_ML, ml);
        return PendingIntent.getBroadcast(context, code, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** «−250 мл»: та же вода, но вычитание — запись `type=water_remove`. */
    static PendingIntent waterMinusAction(Context context, int ml, int code) {
        Intent i = new Intent(context, NutritionWidgetProvider.class);
        i.setAction(ACTION_WATER_MINUS);
        i.putExtra(EXTRA_ML, ml);
        return PendingIntent.getBroadcast(context, code, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** «↩»: отмена последней записи еды дня. */
    static PendingIntent foodUndoAction(Context context, int code) {
        Intent i = new Intent(context, NutritionWidgetProvider.class);
        i.setAction(ACTION_FOOD_UNDO);
        return PendingIntent.getBroadcast(context, code, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** «‹ ›»: листание дат. RequestCode свой у каждого виджета, иначе extras перетираются. */
    static PendingIntent dayStepAction(Context context, int widgetId, int step, int code) {
        Intent i = new Intent(context, NutritionWidgetProvider.class);
        i.setAction(ACTION_DAY);
        i.putExtra(EXTRA_WIDGET_ID, widgetId);
        i.putExtra(EXTRA_STEP, step);
        int req = code * 1000 + (Math.abs(widgetId) % 900);
        return PendingIntent.getBroadcast(context, req, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /**
     * Чип «недавнее / избранное»: в интенте лежит сам продукт, а `index` — только
     * подсказка для обратной совместимости. Раньше тап читал `quick[index]` из
     * снапшота: если между отрисовкой и тапом снапшот пересобрался (добавили еду,
     * синк), записывалось другое блюдо — не то, что на чипе.
     */
    static PendingIntent quickAddAction(Context context, int index, JSONObject food, int code) {
        Intent i = new Intent(context, NutritionWidgetProvider.class);
        i.setAction(ACTION_QUICK);
        i.putExtra(EXTRA_INDEX, index);
        if (food != null) i.putExtra(EXTRA_QUICK_ITEM, food.toString());
        return PendingIntent.getBroadcast(context, code, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static PendingIntent periodAction(Context context, int widgetId, String period) {
        Intent i = new Intent(context, NutritionWidgetProvider.class);
        i.setAction(ACTION_PERIOD);
        i.putExtra(EXTRA_WIDGET_ID, widgetId);
        i.putExtra(EXTRA_PERIOD, period);
        int code = 100000 + (Math.abs(widgetId) % 1000) * 4 + ("week".equals(period) ? 1 : "month".equals(period) ? 2 : 0);
        return PendingIntent.getBroadcast(context, code, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** «Свой» объём воды: тот же нативный диалог, но с полем «мл» вместо КБЖУ. */
    static PendingIntent waterCustomAction(Context context, int code) {
        Intent i = new Intent(context, WidgetQuickAddActivity.class);
        i.setAction("com.healthengine.app.action.WIDGET_WATER_CUSTOM");
        i.putExtra(WidgetQuickAddActivity.EXTRA_KIND, WidgetQuickAddActivity.KIND_WATER);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, code, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** «＋ Еда»: компактный нативный редактор еды поверх лаунчера. */
    static PendingIntent foodAction(Context context, String meal, int code) {
        Intent i = new Intent(context, WidgetQuickAddActivity.class);
        i.setAction(ACTION_FOOD);
        i.putExtra(WidgetQuickAddActivity.EXTRA_KIND, WidgetQuickAddActivity.KIND_FOOD);
        i.putExtra(WidgetQuickAddActivity.EXTRA_MEAL, meal);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, code, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
